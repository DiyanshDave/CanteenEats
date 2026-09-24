import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import AdminLayout from "../layouts/AdminLayout.jsx";
import api from "../services/api.js";

const REFRESH_INTERVAL = 20000;
const INITIAL_DATA = { overview: null, popularItems: [], peakHours: [], lowStock: [] };
const INITIAL_ERRORS = { overview: "", popularItems: "", peakHours: "", lowStock: "" };
const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatHour = (hour) => `${String(Number(hour)).padStart(2, "0")}:00`;
const getError = (error) => error.response?.data?.message || "This section couldn't be loaded. Try refreshing.";

function StatCard({ label, value, note, color }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
    <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-600">{label}</p><span className={`h-2.5 w-2.5 rounded-full ${color}`} /></div>
    <p className="mt-3 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">{value}</p><p className="mt-1 text-xs text-slate-500">{note}</p>
  </article>;
}

function LoadingPanel() {
  return <div className="space-y-3" aria-label="Loading dashboard data"><div className="h-5 w-1/3 animate-pulse rounded bg-slate-100"/><div className="h-14 animate-pulse rounded-xl bg-slate-100"/><div className="h-14 animate-pulse rounded-xl bg-slate-100"/></div>;
}

function Panel({ title, subtitle, action, error, loading, empty, children }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-navy">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div>{action}</div>
    {loading ? <LoadingPanel/> : error ? <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</div> : empty ? <div className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">No data available yet.</div> : children}
  </section>;
}

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [data, setData] = useState(INITIAL_DATA);
  const [errors, setErrors] = useState(INITIAL_ERRORS);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const requestCycle = useRef(0);

  const refresh = useCallback(async ({ silent = false, signal } = {}) => {
    if (inFlight.current) return;
    const cycle = requestCycle.current;
    inFlight.current = true;
    if (silent) setRefreshing(true);
    const requests = [
      api.get("/analytics/overview", { signal }),
      api.get("/analytics/popular-items?limit=5", { signal }),
      api.get("/analytics/peak-hours", { signal }),
      api.get("/inventory/low-stock", { signal }),
    ];
    const results = await Promise.allSettled(requests);
    if (mounted.current && cycle === requestCycle.current) {
      const nextData = {};
      const nextErrors = {};
      const keys = ["overview", "popularItems", "peakHours", "lowStock"];
      results.forEach((result, index) => {
        const key = keys[index];
        if (result.status === "fulfilled") {
          const response = result.value.data || {};
          nextErrors[key] = "";
          if (key === "overview") nextData[key] = response.overview || null;
          if (key === "popularItems") nextData[key] = Array.isArray(response.items) ? response.items : [];
          if (key === "peakHours") nextData[key] = Array.isArray(response.peakHours) ? response.peakHours : [];
          if (key === "lowStock") nextData[key] = Array.isArray(response.items) ? response.items : [];
        } else {
          nextErrors[key] = getError(result.reason);
        }
      });
      setData((current) => ({ ...current, ...Object.fromEntries(Object.entries(nextData).filter(([, value]) => value !== null)) }));
      setErrors((current) => ({ ...current, ...nextErrors }));
      setLoaded(true);
      if (results.some((result) => result.status === "fulfilled")) setLastUpdated(new Date());
    }
    if (cycle !== requestCycle.current) return;
    inFlight.current = false;
    if (mounted.current) setRefreshing(false);
  }, []);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    refresh({ signal: controller.signal });
    const interval = window.setInterval(() => refresh({ silent: true, signal: controller.signal }), REFRESH_INTERVAL);
    return () => { mounted.current = false; requestCycle.current += 1; inFlight.current = false; controller.abort(); window.clearInterval(interval); };
  }, [refresh]);

  const overview = data.overview || {};
  const peakHour = data.peakHours.reduce((peak, hour) => !peak || hour.orderCount > peak.orderCount ? hour : peak, null);
  const hasErrors = Object.values(errors).some(Boolean);
  const loading = !loaded;
  const metric = (key, formatter = (value) => value) => overview[key] !== undefined ? formatter(overview[key]) : loading || errors.overview ? "—" : formatter(0);

  return <AdminLayout user={user} onLogout={logout}>
    <div className="mx-auto max-w-[1600px] px-4 pb-12 pt-7 sm:px-7 lg:px-10 lg:pt-9">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-semibold text-blue-700">Management overview</p><h1 className="mt-1 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">Dashboard</h1><p className="mt-2 text-sm text-slate-500">Today’s operations, with quick signals from sales and inventory.</p></div>
        <div className="flex flex-wrap items-center gap-3"><span className="text-xs font-medium text-slate-500">{refreshing ? "Refreshing…" : lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Loading live data"}</span><button type="button" onClick={() => refresh()} disabled={refreshing} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">Refresh</button></div>
      </div>

      {hasErrors && <div className="mt-5 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900" role="status">Some dashboard information is unavailable. Other sections will continue to update.</div>}

      <section aria-label="Today's key metrics" className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        <StatCard label="Total orders" value={metric("totalOrders")} note="Today" color="bg-blue-500"/>
        <StatCard label="Completed" value={metric("completedOrders")} note="Today" color="bg-emerald-500"/>
        <StatCard label="Active orders" value={metric("activeOrders")} note="Queued, preparing, ready" color="bg-orange-500"/>
        <StatCard label="Cancelled" value={metric("cancelledOrders")} note="Today" color="bg-red-400"/>
        <StatCard label="Revenue" value={metric("totalRevenue", formatCurrency)} note="Completed orders today" color="bg-blue-500"/>
        <StatCard label="Average order" value={metric("averageOrderValue", formatCurrency)} note="Completed orders today" color="bg-slate-400"/>
        <StatCard label="Average wait" value={metric("averageWaitTime", (value) => `${Number(value).toFixed(1)} min`)} note="Queued to ready" color="bg-orange-500"/>
      </section>

      <div className="mt-8 grid gap-5 xl:grid-cols-2">
        <Panel title="Popular items" subtitle="Best sellers by completed quantity · all time" action={<Link to="/admin/analytics" className="text-sm font-bold text-blue-700 hover:text-blue-800">View analytics →</Link>} loading={loading} error={errors.popularItems} empty={!data.popularItems.length}>
          <ol className="divide-y divide-slate-100">{data.popularItems.map((item, index) => <li key={item.productId || item.name} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-extrabold text-blue-700">{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">{item.name}</span><span className="shrink-0 text-sm font-bold text-navy">{item.quantitySold} sold</span></li>)}</ol>
        </Panel>
        <Panel title="Inventory watch" subtitle="Items at or below their low-stock threshold" action={<Link to="/admin/inventory" className="text-sm font-bold text-blue-700 hover:text-blue-800">Manage inventory →</Link>} loading={loading} error={errors.lowStock} empty={!data.lowStock.length}>
          <ul className="divide-y divide-slate-100">{data.lowStock.slice(0, 5).map((item) => <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.quantity === 0 ? "bg-red-500" : "bg-orange-500"}`}/><span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">{item.name}</span><span className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold ${item.quantity === 0 ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-800"}`}>{item.quantity} {item.unit} left</span></li>)}</ul>
        </Panel>
        <Panel title="Peak-hour insight" subtitle="Order volume by hour · completed orders, all time" action={<Link to="/admin/analytics" className="text-sm font-bold text-blue-700 hover:text-blue-800">Explore analytics →</Link>} loading={loading} error={errors.peakHours} empty={!peakHour}>
          {peakHour && <div className="flex items-center justify-between gap-4 rounded-xl bg-orange-50/80 p-4 sm:p-5"><div><p className="text-xs font-bold uppercase tracking-wide text-orange-800">Busiest recorded hour</p><p className="mt-1 text-2xl font-extrabold text-navy">{formatHour(peakHour.hour)}</p></div><div className="text-right"><p className="text-2xl font-extrabold text-orange-700">{peakHour.orderCount}</p><p className="text-xs text-slate-500">completed orders</p></div></div>}
        </Panel>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6"><p className="text-sm font-semibold text-blue-700">Management modules</p><h2 className="mt-1 text-lg font-bold text-navy">Quick access</h2><p className="mt-1 text-sm text-slate-500">Jump into the areas that keep daily service running.</p><div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">{[["Menu", "Manage products and availability", "/admin/menu", "☷"], ["Inventory", "Review stock and supplies", "/admin/inventory", "▤"], ["Analytics", "Explore operations and demand", "/admin/analytics", "⌁"]].map(([title, description, to, symbol]) => <Link key={to} to={to} className="group rounded-xl border border-slate-200 p-3 transition hover:border-blue-200 hover:bg-blue-50/50"><span className="text-lg text-blue-700" aria-hidden="true">{symbol}</span><p className="mt-2 text-sm font-bold text-navy">{title}<span className="float-right text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-700">→</span></p><p className="mt-0.5 text-xs text-slate-500">{description}</p></Link>)}</div></section>
      </div>
      <p className="mt-5 text-right text-xs text-slate-400">Overview refreshes every {REFRESH_INTERVAL / 1000} seconds. Metrics reflect today; item and peak-hour summaries use completed order history.</p>
    </div>
  </AdminLayout>;
};

export default AdminDashboard;
