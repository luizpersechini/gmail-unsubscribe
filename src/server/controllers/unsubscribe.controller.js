const runManager = require('../jobs/runManager');

class UnsubscribeController {
  static async startRun(req, res, next) {
    try {
      const options = req.body || {};
      const run = await runManager.createRun(options);
      res.status(202).json(run);
    } catch (error) {
      next(error);
    }
  }

  static async listRuns(_req, res, next) {
    try {
      const runs = runManager.listRuns();
      res.json(runs);
    } catch (error) {
      next(error);
    }
  }

  static async getRun(req, res, next) {
    try {
      const run = runManager.getRun(req.params.runId);
      if (!run) {
        return res.status(404).json({
          error: 'NotFound',
          message: 'Run not found',
        });
      }
      res.json(run);
    } catch (error) {
      next(error);
    }
  }

  static async getRunLogs(req, res, next) {
    try {
      const run = runManager.getRun(req.params.runId);
      if (!run) {
        return res.status(404).json({
          error: 'NotFound',
          message: 'Run not found',
        });
      }
      res.json(run.logs || []);
    } catch (error) {
      next(error);
    }
  }

  static async cancelRun(req, res, next) {
    try {
      const run = await runManager.cancelRun(req.params.runId);
      if (!run) {
        return res.status(404).json({
          error: 'NotFound',
          message: 'Run not found',
        });
      }
      res.json(run);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = UnsubscribeController;
