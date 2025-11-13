import { StatusBadge } from './StatusBadge';

const statusVariants = {
  queued: 'warning',
  running: 'warning',
  completed: 'success',
  failed: 'danger',
  cancelled: 'neutral',
};

export function RunDetails({ run, logs, onCancel, refreshing }) {
  if (!run) {
    return (
      <div className="glass-panel flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
        <p className="text-base font-medium text-slate-300">Select a run to see the details.</p>
        <p className="text-sm text-slate-500">
          You will find the email-by-email results, captured screenshots, and a chronological activity log here.
        </p>
      </div>
    );
  }

  const variant = statusVariants[run.status] || 'neutral';

  const stats = [
    { label: 'Processed', value: run.stats?.processed ?? 0 },
    { label: 'Succeeded', value: run.stats?.succeeded ?? 0 },
    { label: 'Failed', value: run.stats?.failed ?? 0 },
    { label: 'Deleted', value: run.stats?.deleted ?? 0 },
  ];

  return (
    <div className="glass-panel grid h-full grid-cols-1 gap-6 rounded-2xl p-6 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-400">Started</p>
            <h3 className="text-lg font-semibold text-slate-100">
              {new Date(run.createdAt).toLocaleString()}
            </h3>
          </div>
          <StatusBadge variant={variant}>{run.status}</StatusBadge>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-center"
            >
              <p className="text-xs uppercase tracking-wide text-slate-400">{stat.label}</p>
              <p className="mt-1 text-xl font-semibold text-slate-50">{stat.value}</p>
            </div>
          ))}
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-200">Email Results</h4>
            {run.status === 'running' && (
              <button
                onClick={() => onCancel?.(run.id)}
                className="inline-flex items-center gap-2 rounded-lg border border-rose-500/60 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
              >
                Cancel run
              </button>
            )}
          </div>

          <div className="mt-3 max-h-60 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 scrollbar-thin">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">Subject</th>
                  <th className="px-4 py-3 text-left">Sender</th>
                  <th className="px-4 py-3 text-left">Outcome</th>
                  <th className="px-4 py-3 text-left">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {(run.results || []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">
                      No emails processed yet. Results will appear here as the run progresses.
                    </td>
                  </tr>
                )}
                {(run.results || []).map((item) => (
                  <tr key={item.messageId} className="hover:bg-slate-900/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-100">{item.subject}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.messageId}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">{item.sender}</td>
                    <td className="px-4 py-3">
                      <StatusBadge variant={item.success ? 'success' : 'danger'}>
                        {item.success ? 'success' : 'failed'}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">{item.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {run.results?.some((item) => item.screenshots?.length) && (
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-400">
              <p className="font-semibold text-slate-200">Screenshots captured:</p>
              <ul className="mt-2 space-y-1">
                {run.results
                  .flatMap((item) => item.screenshots || [])
                  .map((shot) => (
                    <li key={shot} className="truncate">
                      {shot}
                    </li>
                  ))}
              </ul>
              <p className="mt-2 text-xs text-slate-500">
                Screenshots are saved on the server inside the <code className="text-brand-300">screenshots/</code> folder for auditing.
              </p>
            </div>
          )}
        </section>
      </div>

      <aside className="lg:col-span-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-200">Activity Log</h4>
          {refreshing && (
            <span className="text-xs text-slate-400">Updating...</span>
          )}
        </div>
        <div className="mt-3 max-h-[420px] space-y-3 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm scrollbar-thin">
          {logs.length === 0 && (
            <p className="text-slate-500">
              The log stream will appear here while the automation runs. It includes DeepSeek analysis,
              browser steps, and any warnings to look at.
            </p>
          )}
          {logs.map((entry) => (
            <div
              key={entry.id}
              className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"
            >
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                <StatusBadge
                  variant={
                    entry.level === 'error'
                      ? 'danger'
                      : entry.level === 'warn'
                      ? 'warning'
                      : 'neutral'
                  }
                  className="uppercase"
                >
                  {entry.level}
                </StatusBadge>
              </div>
              <p className="mt-2 text-sm text-slate-200">{entry.message}</p>
              {entry.context && Object.keys(entry.context).length > 0 && (
                <pre className="mt-2 overflow-x-auto rounded bg-slate-900/70 p-2 text-xs text-slate-400">
                  {JSON.stringify(entry.context, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
