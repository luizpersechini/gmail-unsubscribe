const { EventEmitter } = require('events');
const { randomUUID } = require('crypto');
const path = require('path');
const fs = require('fs/promises');
const config = require('../config');
const logger = require('../utils/logger');
const emailService = require('../services/emailService');
const unsubscribeService = require('../services/unsubscribeService');

class RunManager extends EventEmitter {
  constructor() {
    super();
    this.runs = new Map();
    this.dataFile = path.join(config.storage.dataDir, 'runs.json');
    this.queue = [];
    this.activeRuns = new Set();
    this._loadFromDisk();
  }

  async _loadFromDisk() {
    try {
      const raw = await fs.readFile(this.dataFile, 'utf8');
      const parsed = JSON.parse(raw);
      parsed.forEach((run) => {
        run.logs = run.logs || [];
        run.stats = run.stats || {
          total: 0,
          processed: 0,
          succeeded: 0,
          failed: 0,
          deleted: 0,
        };
        run.results = run.results || [];
        this.runs.set(run.id, run);
      });
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn({ err: error }, 'Failed to load runs from disk');
      }
    }
  }

  async _persist() {
    const list = Array.from(this.runs.values()).sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );
    await fs.writeFile(this.dataFile, JSON.stringify(list, null, 2));
  }

  _normalizeOptions(options = {}) {
    const maxEmails = Number(options.maxEmails) || config.settings.maxEmailsPerRun;
    return {
      maxEmails: Math.min(Math.max(maxEmails, 1), 100),
      query: options.query || 'category:promotions',
      autoDelete:
        options.autoDelete === undefined
          ? config.settings.deleteAfterUnsubscribe
          : Boolean(options.autoDelete),
      permanentDelete:
        options.permanentDelete === undefined
          ? config.settings.permanentDelete
          : Boolean(options.permanentDelete),
    };
  }

  _createInitialRun(options = {}) {
    const id = randomUUID();
    const now = new Date().toISOString();
    const normalizedOptions = this._normalizeOptions(options);
    return {
      id,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      options: normalizedOptions,
      stats: {
        total: 0,
        processed: 0,
        succeeded: 0,
        failed: 0,
        deleted: 0,
      },
      results: [],
      logs: [],
    };
  }

  async createRun(options) {
    const run = this._createInitialRun(options);
    this.runs.set(run.id, run);
    await this._persist();

    this.emit('runQueued', run);
    this.queue.push(run.id);
    this._drainQueue();

    return run;
  }

  _drainQueue() {
    while (
      this.activeRuns.size < config.settings.maxConcurrentJobs &&
      this.queue.length > 0
    ) {
      const runId = this.queue.shift();
      this._execute(runId).catch((error) => {
        logger.error({ err: error, runId }, 'Run execution failed');
      });
    }
  }

  getRun(runId) {
    return this.runs.get(runId) || null;
  }

  listRuns() {
    return Array.from(this.runs.values()).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  }

  async cancelRun(runId) {
    const run = this.runs.get(runId);
    if (!run) {
      return null;
    }

    if (['completed', 'failed', 'cancelled'].includes(run.status)) {
      return run;
    }

    run.status = 'cancelled';
    run.updatedAt = new Date().toISOString();
    run.logs.push({
      level: 'warn',
      message: 'Run cancelled by user',
      timestamp: run.updatedAt,
    });

    await this._persist();
    this.emit('runUpdated', run);
    this.queue = this.queue.filter((id) => id !== runId);

    return run;
  }

  async appendLog(runId, level, message, context = {}) {
    const run = this.runs.get(runId);
    if (!run) return;

    const entry = {
      id: randomUUID(),
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
    };
    run.logs.push(entry);
    if (run.logs.length > 300) {
      run.logs.splice(0, run.logs.length - 300);
    }
    run.updatedAt = entry.timestamp;

    await this._persist();
    this.emit('runLog', run, entry);
  }

  async _execute(runId) {
    const run = this.runs.get(runId);
    if (!run) return;

    this.activeRuns.add(runId);

    run.status = 'running';
    run.startedAt = new Date().toISOString();
    run.updatedAt = run.startedAt;
    run.stats = {
      total: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
      deleted: 0,
    };
    run.results = [];
    await this._persist();
    await this.appendLog(runId, 'info', 'Run started', run.options);

    const log = (level, message, context = {}) =>
      this.appendLog(runId, level, message, context);

    try {
      const emails = await emailService.fetchPromotionEmails({
        query: run.options.query,
        maxResults: run.options.maxEmails,
      });
      run.stats.total = emails.length;
      await this._persist();
      await log('info', `Fetched ${emails.length} email(s) to process`);

      for (const message of emails) {
        if (run.status === 'cancelled') {
          await log('warn', 'Run cancelled, stopping processing');
          break;
        }

        const subject = emailService.getSubject(message);
        const sender = emailService.getSender(message);
        const context = { messageId: message.id, subject, sender };

        await log('info', 'Processing email', context);

        const emailLog = (level, message, extra = {}) =>
          this.appendLog(runId, level, message, { ...context, ...extra });

        const result = await unsubscribeService.processMessage(message, run.options, emailLog);
        run.results.push(result);

        run.stats.processed += 1;
        if (result.success) {
          run.stats.succeeded += 1;
          await log('info', 'Unsubscribe succeeded', { ...context, detail: result.detail });

          if (run.options.autoDelete) {
            const deleted = await emailService.deleteMessage(
              message.id,
              run.options.permanentDelete
            );
            if (deleted) {
              run.stats.deleted += 1;
              await log('info', 'Email deleted after unsubscribe', context);
            }
          }
        } else {
          run.stats.failed += 1;
          await log('warn', 'Unsubscribe failed', { ...context, detail: result.detail });
        }

        await this._persist();
      }

      if (run.status !== 'cancelled') {
        run.status = 'completed';
        run.completedAt = new Date().toISOString();
        await log('info', 'Run completed successfully', { stats: run.stats });
      }
    } catch (error) {
      run.status = 'failed';
      run.error = {
        message: error.message,
        stack: error.stack,
      };
      await log('error', 'Run failed', { error: error.message });
      logger.error({ err: error, runId }, 'Run failed with error');
    } finally {
      run.updatedAt = new Date().toISOString();
      await this._persist();
      this.activeRuns.delete(runId);
      this.emit('runUpdated', run);
      this._drainQueue();
    }
  }
}

module.exports = new RunManager();
