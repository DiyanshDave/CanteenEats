import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import StaffLayout from "../layouts/StaffLayout.jsx";
import api from "../services/api.js";

const REFRESH_INTERVAL = 7000;
const FILTERS = ["All Active", "Queued", "Preparing", "Ready"];
const COLUMNS = [
  { status: "QUEUED", label: "Queued", key: "queued", tone: "blue", action: "Start Preparing", next: "PREPARING" },
  { status: "PREPARING", label: "Preparing", key: "preparing", tone: "orange", action: "Mark Ready", next: "READY" },
  { status: "READY", label: "Ready for pickup", key: "ready", tone: "green", action: "Mark Completed", next: "COMPLETED" },
];
const EMPTY_SUMMARY = { queuedCount: 0, preparingCount: 0, readyCount: 0, completedCount: 0, cancelledCount: 0 };

const errorMessage = (error, fallback) => {
  if (error.response?.status === 401) return "Your session has expired. Please log in again.";
  return error.response?.data?.message || fallback;
};
const formatTime = (date) => date ? new Date(date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—";
const formatDateTime = (date) => date ? new Date(date).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Not recorded";
const orderItemName = (item) => item.nameSnapshot || item.product?.name || "Menu item";
const orderId = (order) => order.orderId || order._id;

const toneClasses = {
  blue: { badge: "bg-blue-50 text-blue-700", dot: "bg-blue-500", border: "border-t-blue-500" },
  orange: { badge: "bg-orange-50 text-orange-800", dot: "bg-orange-500", border: "border-t-orange-500" },
  green: { badge: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", border: "border-t-emerald-500" },
};

function MetricCard({ label, value, color, detail }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
    <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-600">{label}</p><span className={`h-2.5 w-2.5 rounded-full ${color}`} /></div>
    <p className="mt-3 text-3xl font-bold tracking-tight text-navy">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p>
  </article>;
}

function OrderCard({ order, column, onDetails, onAdvance, busy }) {
  const tone = toneClasses[column.tone];
  const id = orderId(order);
  const items = order.items || [];
  const stamp = column.status === "QUEUED" ? order.createdAt : column.status === "READY" ? order.updatedAt : order.createdAt;
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card transition hover:shadow-card-hover sm:p-5">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Queue token</p><p className="mt-0.5 text-2xl font-extrabold tracking-tight text-navy">{order.token || "—"}</p></div>
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${tone.badge}`}><span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />{column.label}</span>
    </div>
    <button type="button" onClick={() => onDetails(id)} className="mt-1 max-w-full truncate text-left text-xs font-medium text-slate-400 underline decoration-slate-300 underline-offset-2 hover:text-blue-700" aria-label={`View details for order ${order.token || id}`}>Order {String(id || "").slice(-8).toUpperCase()}</button>
    <ul className="mt-4 space-y-2 border-t border-slate-100 pt-3">
      {items.map((item, index) => <li key={`${item.product?._id || item.product || orderItemName(item)}-${index}`} className="flex items-baseline justify-between gap-3 text-sm"><span className="min-w-0 truncate font-medium text-slate-700">{orderItemName(item)}</span><span className="shrink-0 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">× {item.quantity}</span></li>)}
      {items.length === 0 && <li className="text-sm text-slate-400">Order details unavailable</li>}
    </ul>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-slate-500">
      <span>{column.status === "QUEUED" && Number.isFinite(order.estimatedWaitMinutes) ? `Est. wait ${order.estimatedWaitMinutes} min` : "Updated"}</span><time dateTime={stamp || undefined}>{formatTime(stamp)}</time>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-2">
      <button type="button" onClick={() => onDetails(id)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100">Details</button>
      <button type="button" disabled={busy} onClick={() => onAdvance(id, column.next)} className="rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-wait disabled:opacity-60">{busy ? "Updating…" : column.action}</button>
    </div>
  </article>;
}

function OrderDetails({ order, loading, error, onClose }) {
  useEffect(() => {
    const handleKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="order-details-title" className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Kitchen order</p><h2 id="order-details-title" className="mt-1 text-2xl font-bold text-navy">{order?.token || "Order details"}</h2></div><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50" aria-label="Close order details">Close</button></div>
      {loading && <div className="py-12 text-center text-sm text-slate-500" role="status">Loading order details…</div>}
      {error && !loading && <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</div>}
      {order && !loading && <div className="mt-6 space-y-6">
        <div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-medium text-slate-500">Status</p><p className="mt-1 font-bold text-navy">{order.status}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-medium text-slate-500">Customer</p><p className="mt-1 truncate font-bold text-navy">{order.user?.name || "Student"}</p></div></div>
        <div><h3 className="text-sm font-bold text-navy">Items</h3><ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100 px-3">{(order.items || []).map((item, index) => <li key={`${item.product?._id || item.product || orderItemName(item)}-${index}`} className="flex justify-between gap-4 py-3 text-sm"><span className="font-medium text-slate-700">{orderItemName(item)}</span><span className="shrink-0 text-slate-500">× {item.quantity}</span></li>)}</ul></div>
        <div className="flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-sm font-semibold text-slate-600">Order total</span><span className="text-xl font-extrabold text-navy">₹{Number(order.totalAmount || 0).toFixed(2)}</span></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-blue-50/70 p-3"><p className="text-xs font-bold uppercase tracking-wide text-blue-800">Estimated wait</p><p className="mt-1 text-sm font-semibold text-slate-700">{Number.isFinite(order.estimatedWaitMinutes) ? `${order.estimatedWaitMinutes} minutes` : "Not available"}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Order ID</p><p className="mt-1 break-all font-mono text-xs text-slate-600">{order._id}</p></div></div>
        <div><h3 className="text-sm font-bold text-navy">Timeline</h3><dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3">{[["Placed", order.createdAt], ["Queued", order.queuedAt], ["Preparing", order.preparingAt], ["Ready", order.readyAt], ["Completed", order.completedAt], ["Cancelled", order.cancelledAt]].filter(([, date]) => date).map(([label, date]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-0.5 text-sm font-medium text-slate-700">{formatDateTime(date)}</dd></div>)}</dl></div>
      </div>}
    </section>
  </div>;
}

const StaffDashboard = () => {
  const { user, logout } = useAuth();
  const [queue, setQueue] = useState({ queued: [], preparing: [], ready: [] });
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [pageError, setPageError] = useState("");
  const [filter, setFilter] = useState("All Active");
  const [busyOrder, setBusyOrder] = useState(null);
  const [actionError, setActionError] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const detailRequestId = useRef(0);

  const refresh = useCallback(async ({ silent = false, signal } = {}) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (silent) setRefreshing(true);
    try {
      const [queueResponse, summaryResponse] = await Promise.all([
        api.get("/staff/queue", { signal }),
        api.get("/staff/orders/summary", { signal }),
      ]);
      if (!mounted.current) return;
      const nextQueue = queueResponse.data || {};
      setQueue({ queued: nextQueue.queued || [], preparing: nextQueue.preparing || [], ready: nextQueue.ready || [] });
      setSummary({ ...EMPTY_SUMMARY, ...(summaryResponse.data?.summary || {}) });
      setPageError("");
      setLastUpdatedAt(new Date());
    } catch (error) {
      if (error.code === "ERR_CANCELED") return;
      if (!mounted.current) return;
      setPageError(errorMessage(error, "We couldn't load the kitchen queue. Check your connection and try again."));
    } finally {
      inFlight.current = false;
      if (mounted.current) { setInitialLoading(false); setRefreshing(false); }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    refresh({ signal: controller.signal });
    const interval = window.setInterval(() => refresh({ silent: true, signal: controller.signal }), REFRESH_INTERVAL);
    return () => { mounted.current = false; inFlight.current = false; controller.abort(); window.clearInterval(interval); };
  }, [refresh]);

  const openDetails = useCallback(async (id) => {
    if (!id) return;
    const requestId = ++detailRequestId.current;
    setSelectedOrder(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      const response = await api.get(`/staff/orders/${id}`);
      if (requestId === detailRequestId.current) {
        setSelectedOrder(response.data?.order || null);
        if (!response.data?.order) setDetailError("Order details were not returned by the server.");
      }
    } catch (error) {
      if (requestId === detailRequestId.current) setDetailError(errorMessage(error, "We couldn't load this order. Please try again."));
    } finally { if (requestId === detailRequestId.current) setDetailLoading(false); }
  }, []);

  const advanceOrder = useCallback(async (id, status) => {
    setBusyOrder(id);
    setActionError("");
    try {
      await api.patch(`/orders/${id}/status`, { status });
      await refresh();
      if (selectedOrder?._id === id) {
        const response = await api.get(`/staff/orders/${id}`);
        setSelectedOrder(response.data?.order || null);
      }
    } catch (error) {
      setActionError(errorMessage(error, "The order status could not be updated. Please try again."));
    } finally { setBusyOrder(null); }
  }, [refresh, selectedOrder]);

  const activeCount = queue.queued.length + queue.preparing.length + queue.ready.length;
  const shownColumns = filter === "All Active" ? COLUMNS : COLUMNS.filter((column) => column.label.toLowerCase().startsWith(filter.toLowerCase()));

  return <StaffLayout user={user} onLogout={logout}>
    <div className="mx-auto max-w-[1600px] px-4 pb-12 pt-7 sm:px-7 lg:px-10 lg:pt-9">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-semibold text-blue-700">Kitchen operations</p><h1 className="mt-1 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">Order board</h1><p className="mt-2 text-sm text-slate-500">Manage incoming orders and keep the pickup line moving.</p></div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><span className={`h-2 w-2 rounded-full ${refreshing ? "animate-pulse bg-orange-500" : "bg-emerald-500"}`} />{refreshing ? "Refreshing…" : lastUpdatedAt ? `Live · updated ${formatTime(lastUpdatedAt)}` : "Connecting…"}</div>
      </div>

      <section aria-label="Order summary" className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard label="Queued" value={summary.queuedCount} color="bg-blue-500" detail="Waiting to start"/><MetricCard label="Preparing" value={summary.preparingCount} color="bg-orange-500" detail="In the kitchen"/><MetricCard label="Ready" value={summary.readyCount} color="bg-emerald-500" detail="Awaiting pickup"/><MetricCard label="Completed" value={summary.completedCount} color="bg-slate-400" detail="Orders handed over"/><MetricCard label="Cancelled" value={summary.cancelledCount} color="bg-red-400" detail="Cancelled orders"/>
      </section>

      <div className="mt-9 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div><h2 className="text-xl font-bold text-navy">Kitchen queue <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 align-middle text-sm font-bold text-slate-600">{activeCount}</span></h2><p className="mt-1 text-sm text-slate-500">Orders are grouped by their current kitchen status.</p></div>
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Filter orders">
          {FILTERS.map((name) => <button type="button" role="tab" aria-selected={filter === name} key={name} onClick={() => setFilter(name)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition sm:px-3.5 sm:text-sm ${filter === name ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{name}</button>)}
        </div>
      </div>

      {actionError && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{actionError}</div>}
      {pageError && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert"><span>{pageError}</span><button type="button" onClick={() => refresh()} className="font-bold underline underline-offset-2">Retry</button></div>}

      {initialLoading ? <div className="grid gap-4 pt-5 md:grid-cols-2 xl:grid-cols-3" aria-label="Loading orders">{[1, 2, 3].map((n) => <div key={n} className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}</div> : <div className={`grid gap-5 pt-5 ${shownColumns.length === 1 ? "mx-auto max-w-2xl" : "md:grid-cols-2 xl:grid-cols-3"}`}>
        {shownColumns.map((column) => {
          const orders = queue[column.key];
          const tone = toneClasses[column.tone];
          return <section key={column.key} aria-labelledby={`column-${column.key}`} className={`min-w-0 rounded-2xl border border-slate-200 border-t-4 ${tone.border} bg-slate-50/70 p-3.5 sm:p-4`}>
            <div className="mb-3 flex items-center justify-between gap-2"><h3 id={`column-${column.key}`} className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-navy"><span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />{column.label}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tone.badge}`}>{orders.length}</span></div>
            <div className="space-y-3">{orders.map((order) => <OrderCard key={orderId(order)} order={order} column={column} onDetails={openDetails} onAdvance={advanceOrder} busy={busyOrder === orderId(order)} />)}</div>
            {orders.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 px-4 py-9 text-center"><p className="text-sm font-semibold text-slate-600">{column.status === "QUEUED" ? "No orders are waiting." : `No orders ${column.status === "READY" ? "ready for pickup" : "being prepared"}.`}</p><p className="mt-1 text-xs text-slate-400">New activity will appear automatically.</p></div>}
          </section>;
        })}
        {filter === "All Active" && activeCount === 0 && !pageError && <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 10h16l-1.4 9H5.4L4 10Z" strokeLinejoin="round"/><path d="M8 10a4 4 0 0 1 8 0" strokeLinecap="round"/></svg></div><h3 className="mt-3 font-bold text-navy">No active orders</h3><p className="mt-1 text-sm text-slate-500">The kitchen queue is clear. New orders will show up here automatically.</p></div>}
      </div>}
      <p className="mt-5 text-right text-xs text-slate-400">Auto refresh every {REFRESH_INTERVAL / 1000} seconds</p>
    </div>
    {(selectedOrder || detailLoading || detailError) && <OrderDetails order={selectedOrder} loading={detailLoading} error={detailError} onClose={() => { detailRequestId.current += 1; setSelectedOrder(null); setDetailError(""); setDetailLoading(false); }} />}
  </StaffLayout>;
};

export default StaffDashboard;
