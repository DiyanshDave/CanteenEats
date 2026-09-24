import { useEffect } from "react";

export const getManagementError = (error, fallback) => {
  const status = error.response?.status;
  if (status === 401) return "Your session has expired. Please log in again.";
  if (status === 403) return "Your account is not allowed to perform this action.";
  if (status === 404) return "This record no longer exists. Refresh the list and try again.";
  if (!error.response) return "The server is unavailable. Check your connection and try again.";
  return error.response.data?.message || fallback;
};

export function ManagementModal({ title, subtitle, onClose, children, wide = false }) {
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="management-modal-title" className={`max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7 ${wide ? "max-w-2xl" : "max-w-xl"}`}>
      <div className="mb-6 flex items-start justify-between gap-4"><div><h2 id="management-modal-title" className="text-xl font-bold text-navy">{title}</h2>{subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}</div><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Close</button></div>
      {children}
    </section>
  </div>;
}

export function ManagementField({ label, className = "", children, ...props }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>{children || <input {...props} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-navy outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"/>}</label>;
}

export function ManagementNotice({ children, tone = "error" }) {
  const styles = tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800";
  return <div role={tone === "success" ? "status" : "alert"} className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

export function ConfirmDialog({ title, message, confirmLabel = "Delete", busy = false, error = "", onConfirm, onCancel }) {
  return <ManagementModal title={title} onClose={onCancel}>
    <p className="text-sm leading-6 text-slate-600">{message}</p>
    {error && <div className="mt-4"><ManagementNotice>{error}</ManagementNotice></div>}
    <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onCancel} disabled={busy} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button><button type="button" onClick={onConfirm} disabled={busy} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60">{busy ? "Deleting…" : confirmLabel}</button></div>
  </ManagementModal>;
}

export function PageLoading({ rows = 4 }) {
  return <div className="space-y-3" aria-label="Loading records">{Array.from({ length: rows }, (_, index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div>;
}

export function StatusBadge({ children, tone = "neutral" }) {
  const tones = { neutral: "bg-slate-100 text-slate-700", good: "bg-emerald-50 text-emerald-700", warning: "bg-orange-50 text-orange-800", danger: "bg-red-50 text-red-700" };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${tones[tone] || tones.neutral}`}><span className={`h-1.5 w-1.5 rounded-full ${tone === "good" ? "bg-emerald-500" : tone === "warning" ? "bg-orange-500" : tone === "danger" ? "bg-red-500" : "bg-slate-400"}`}/>{children}</span>;
}
