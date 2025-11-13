import { useEffect, useMemo, useState } from 'react';
import { api } from './api/client';
import { RunForm } from './components/RunForm';
import { RunsList } from './components/RunsList';
import { RunDetails } from './components/RunDetails';
import { StatusBadge } from './components/StatusBadge';

export default function App() {
  const [status, setStatus] = useState(null);
  const [config, setConfig] = useState(null);
  const [runs, setRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [activeRun, setActiveRun] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loadingRun, setLoadingRun] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [appStatus, appConfig] = await Promise.all([
          api.getAppStatus(),
          api.getConfig(),
        ]);
        if (!mounted) return;
        setStatus(appStatus);
        setConfig(appConfig);
      } catch (err) {
        if (mounted) {
          setError(err.message);
        }
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchRuns = async () => {
      try {
        const data = await api.listRuns();
        if (!mounted) return;
        setRuns(data);
        setSelectedRunId((prev) => prev ?? (data[0]?.id ?? null));
      } catch (err) {
        if (mounted) {
          setError(err.message);
        }
      }
    };
    fetchRuns();
    const interval = setInterval(fetchRuns, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!selectedRunId) {
      setActiveRun(null);
      setLogs([]);
      return;
    }

    let mounted = true;
    let timeoutId;

    const fetchDetails = async () => {
      setRefreshing(true);
      try {
        const [runData, logData] = await Promise.all([
          api.getRun(selectedRunId),
          api.getRunLogs(selectedRunId),
        ]);
        if (!mounted) return;
        setActiveRun(runData);
        setLogs(logData);
        const delay = runData.status === 'running' || runData.status === 'queued' ? 2000 : 7000;
        timeoutId = setTimeout(fetchDetails, delay);
      } catch (err) {
        if (mounted) {
          setError(err.message);
          timeoutId = setTimeout(fetchDetails, 7000);
        }
      } finally {
        if (mounted) {
          setRefreshing(false);
        }
      }
    };

    fetchDetails();

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [selectedRunId]);

  const handleStartRun = async (options) => {
    setLoadingRun(true);
    setError(null);
    setInfo(null);
    try {
      const run = await api.startRun(options);
      setRuns((prev) => [run, ...prev]);
      setSelectedRunId(run.id);
      setInfo('New unsubscribe session started. Watch the details panel for live updates.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingRun(false);
    }
  };

  const handleCancelRun = async (runId) => {
    try {
      await api.cancelRun(runId);
      setRuns((prev) =>
        prev.map((run) => (run.id === runId ? { ...run, status: 'cancelled' } : run))
      );
      setInfo('Run cancelled. Existing progress remains visible in the log.');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAuthorize = async () => {
    setError(null);
    try {
      const data = await api.getAuthUrl();
      if (data.url) {
        window.open(data.url, '_blank', 'noopener');
        setInfo('Authorization window opened. Paste the returned code into the server terminal when prompted.');
      }
      // refresh status afterwards
      const updated = await api.getAppStatus();
      setStatus(updated);
    } catch (err) {
      setError(err.message);
    }
  };

  const gmailReady = Boolean(status?.authorized);
  const deepseekReady = Boolean(config?.deepseek?.hasApiKey);
  const gmailConfigured = Boolean(config?.gmail?.hasClientId && config?.gmail?.hasClientSecret);

  const canStartRun = gmailReady;

  useEffect(() => {
    if (!error) return undefined;
    const timeout = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(timeout);
  }, [error]);

  useEffect(() => {
    if (!info) return undefined;
    const timeout = setTimeout(() => setInfo(null), 6000);
    return () => clearTimeout(timeout);
  }, [info]);

  const headerBadges = useMemo(
    () => [
      {
        label: gmailReady
          ? 'Gmail connected'
          : gmailConfigured
          ? 'Authorize Gmail'
          : 'Gmail credentials missing',
        variant: gmailReady ? 'success' : gmailConfigured ? 'warning' : 'danger',
        action: gmailReady ? null : handleAuthorize,
      },
      {
        label: deepseekReady ? 'DeepSeek ready' : 'DeepSeek API key missing',
        variant: deepseekReady ? 'success' : 'warning',
        action: null,
      },
      {
        label: `${runs.length} run${runs.length === 1 ? '' : 's'} stored`,
        variant: 'neutral',
      },
    ],
    [gmailReady, gmailConfigured, deepseekReady, runs.length]
  );

  return (
    <div className="min-h-screen bg-slate-950/95 pb-12">
      <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-slate-50">
              Gmail Unsubscribe Control Center
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Monitor automation runs, review detailed logs, and keep your inbox lean without losing the audit trail.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {headerBadges.map((badge) => (
              <button
                key={badge.label}
                type="button"
                onClick={badge.action || undefined}
                disabled={!badge.action}
                className={!badge.action ? 'cursor-default' : 'transition hover:scale-[1.02]'}
              >
                <StatusBadge variant={badge.variant}>{badge.label}</StatusBadge>
              </button>
            ))}
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        {info && (
          <div className="mb-4 rounded-xl border border-brand-500/40 bg-brand-500/10 px-4 py-3 text-sm text-brand-100">
            {info}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6">
            <RunForm onSubmit={handleStartRun} disabled={!canStartRun} loading={loadingRun} />
            <RunsList runs={runs} selectedRunId={selectedRunId} onSelect={setSelectedRunId} />
          </div>

          <div className="lg:col-span-2">
            <RunDetails
              run={activeRun}
              logs={logs}
              onCancel={handleCancelRun}
              refreshing={refreshing}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
