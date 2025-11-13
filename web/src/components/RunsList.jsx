import clsx from 'clsx';
import { StatusBadge } from './StatusBadge';

const statusVariants = {
  queued: 'warning',
  running: 'warning',
  completed: 'success',
  failed: 'danger',
  cancelled: 'neutral',
};

export function RunsList({ runs, selectedRunId, onSelect }) {
  if (!runs.length) {
    return (
      <div className="glass-panel flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
        <p className="text-sm">No runs yet. Start your first unsubscribe session to see it here.</p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="space-y-3">
        {runs.map((run) => {
          const variant = statusVariants[run.status] || 'neutral';
          return (
            <button
              key={run.id}
              onClick={() => onSelect(run.id)}
              className={clsx(
                'w-full rounded-xl border px-4 py-3 text-left transition',
                run.id === selectedRunId
                  ? 'border-brand-400 bg-brand-500/10 shadow-glow'
                  : 'border-slate-800 bg-slate-900/40 hover:border-brand-500/60 hover:bg-brand-500/10'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-100">
                    {new Date(run.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Processed {run.stats?.processed ?? 0} / {run.stats?.total ?? 0} emails
                  </p>
                </div>
                <StatusBadge variant={variant} className="shrink-0">
                  {run.status}
                </StatusBadge>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
