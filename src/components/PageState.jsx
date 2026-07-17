import React from 'react';
import { AlertCircle, CheckCircle2, Info, Inbox, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PageLoadingSkeleton({ cards = 4, rows = 5, label = 'Loading page' }) {
  return (
    <div className="app-page animate-pulse" role="status" aria-live="polite" aria-label={label}>
      <span className="sr-only">{label}…</span>
      <div className="space-y-3" aria-hidden="true">
        <div className="h-3 w-28 rounded-full bg-emerald-100" />
        <div className="h-8 w-64 max-w-[75%] rounded-lg bg-slate-200" />
        <div className="h-4 w-96 max-w-full rounded bg-slate-100" />
      </div>
      {cards > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: cards }, (_, index) => (
            <div key={index} className="h-28 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="h-3 w-2/3 rounded bg-slate-100" />
              <div className="mt-4 h-7 w-1/3 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      )}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-hidden="true">
        <div className="mb-5 h-10 rounded-xl bg-slate-100" />
        <div className="space-y-3">
          {Array.from({ length: rows }, (_, index) => (
            <div key={index} className="h-16 rounded-xl bg-slate-50" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SectionLoadingSkeleton({ rows = 3, label = 'Loading content' }) {
  return (
    <div className="space-y-3 py-6" role="status" aria-live="polite" aria-label={label}>
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-20 animate-pulse rounded-xl border border-slate-100 bg-slate-100/70" aria-hidden="true" />
      ))}
    </div>
  );
}

const feedbackStyles = {
  success: { icon: CheckCircle2, className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  error: { icon: AlertCircle, className: 'border-rose-200 bg-rose-50 text-rose-800' },
  warning: { icon: TriangleAlert, className: 'border-amber-200 bg-amber-50 text-amber-800' },
  info: { icon: Info, className: 'border-blue-200 bg-blue-50 text-blue-800' },
};

export function FeedbackBanner({ type = 'info', title, children, actionLabel, onAction, className = '' }) {
  const config = feedbackStyles[type] || feedbackStyles.info;
  const Icon = config.icon;
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${config.className} ${className}`} role={type === 'error' ? 'alert' : 'status'} aria-live={type === 'error' ? 'assertive' : 'polite'}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-1' : ''}>{children}</div>}
      </div>
      {actionLabel && onAction && <Button type="button" variant="outline" size="sm" onClick={onAction}>{actionLabel}</Button>}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, actionLabel, onAction }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
        <Icon className="h-6 w-6 text-slate-400" aria-hidden="true" />
      </div>
      <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      {description && <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>}
      {actionLabel && onAction && <Button type="button" onClick={onAction} className="mt-5 bg-emerald-700 text-white hover:bg-emerald-800">{actionLabel}</Button>}
    </div>
  );
}
