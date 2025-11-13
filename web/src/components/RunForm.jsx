import { useState } from 'react';

const defaultValues = {
  maxEmails: 10,
  autoDelete: false,
  permanentDelete: false,
  query: 'category:promotions',
};

export function RunForm({ onSubmit, disabled, loading }) {
  const [form, setForm] = useState(defaultValues);

  const updateField = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit?.(form);
  };

  const handleReset = () => {
    setForm(defaultValues);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-panel rounded-2xl p-6 shadow-glow"
    >
      <header className="mb-6">
        <h2 className="text-xl font-semibold text-slate-100">Start New Session</h2>
        <p className="mt-1 text-sm text-slate-400">
          Choose how many promotional emails to process and what to do after unsubscribing.
        </p>
      </header>

      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-200">
            Maximum Emails
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={form.maxEmails}
            onChange={(event) => updateField('maxEmails', Number(event.target.value))}
            className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-2 text-slate-100 focus:border-brand-400 focus:outline-none focus:ring focus:ring-brand-500/30"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-200">
            Gmail Search Query
          </label>
          <input
            type="text"
            value={form.query}
            onChange={(event) => updateField('query', event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-2 text-slate-100 focus:border-brand-400 focus:outline-none focus:ring focus:ring-brand-500/30"
            placeholder="category:promotions OR label:some-label"
          />
          <p className="mt-1 text-xs text-slate-400">
            Advanced: customize which emails to scan using Gmail search syntax.
          </p>
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
          <input
            type="checkbox"
            checked={form.autoDelete}
            onChange={(event) => updateField('autoDelete', event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900 text-brand-400 focus:ring-brand-500"
          />
          <div>
            <p className="text-sm font-medium text-slate-100">Delete emails after success</p>
            <p className="text-xs text-slate-400">
              Moving them to trash keeps your inbox tidy. Disable if you want to double-check manually.
            </p>
          </div>
        </label>

        {form.autoDelete && (
          <label className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
            <input
              type="checkbox"
              checked={form.permanentDelete}
              onChange={(event) => updateField('permanentDelete', event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900 text-brand-400 focus:ring-brand-500"
            />
            <div>
              <p className="text-sm font-medium text-slate-100">Skip trash (permanent delete)</p>
              <p className="text-xs text-slate-400">
                Only enable this if you are confident you will not need the email again.
              </p>
            </div>
          </label>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
        >
          Reset
        </button>

        <button
          type="submit"
          disabled={disabled || loading}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-cyan-500/30 transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-slate-600"
        >
          {loading ? 'Starting...' : 'Start Unsubscribe Run'}
        </button>
      </div>
    </form>
  );
}
