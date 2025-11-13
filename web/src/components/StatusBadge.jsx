import clsx from 'clsx';

const variants = {
  success: 'bg-emerald-500/15 text-emerald-400 border border-emerald-400/40',
  warning: 'bg-amber-500/15 text-amber-300 border border-amber-300/40',
  danger: 'bg-rose-500/20 text-rose-300 border border-rose-300/40',
  neutral: 'bg-slate-800 text-slate-200 border border-slate-700',
};

export function StatusBadge({ variant = 'neutral', children, className }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
