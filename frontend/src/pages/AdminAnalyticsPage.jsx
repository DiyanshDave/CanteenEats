import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import AdminLayout from "../layouts/AdminLayout.jsx";
import api from "../services/api.js";
import { getManagementError, ManagementNotice } from "../components/AdminManagement.jsx";

const REFRESH_INTERVAL = 45000;
const KEYS = ["overview", "dailyTrend", "popularItems", "peakHours", "categories", "forecast", "lowStock"];
const INITIAL_DATA = { overview: null, dailyTrend: null, popularItems: null, peakHours: null, categories: null, forecast: null, lowStock: null };
const INITIAL_ERRORS = Object.fromEntries(KEYS.map((key) => [key, ""]));
const INITIAL_LOADING = Object.fromEntries(KEYS.map((key) => [key, false]));
const REQUESTS = {
  overview: (signal) => api.get("/analytics/overview", { signal }),
  dailyTrend: (signal) => api.get("/analytics/daily-trend", { signal }),
  popularItems: (signal) => api.get("/analytics/popular-items?limit=8", { signal }),
  peakHours: (signal) => api.get("/analytics/peak-hours", { signal }),
  categories: (signal) => api.get("/analytics/category-performance", { signal }),
  forecast: (signal) => api.get("/analytics/demand-forecast", { signal }),
  lowStock: (signal) => api.get("/inventory/low-stock", { signal }),
};
const RESPONSE_VALUE = {
  overview: (body) => body.overview || {},
  dailyTrend: (body) => Array.isArray(body.dailyTrend) ? body.dailyTrend : [],
  popularItems: (body) => Array.isArray(body.items) ? body.items : [],
  peakHours: (body) => Array.isArray(body.peakHours) ? body.peakHours : [],
  categories: (body) => Array.isArray(body.categoryPerformance) ? body.categoryPerformance : [],
  forecast: (body) => Array.isArray(body.forecast) ? body.forecast : [],
  lowStock: (body) => Array.isArray(body.items) ? body.items : [],
};
const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const formatHour = (hour) => `${String(Number(hour)).padStart(2, "0")}:00`;
const formatDate = (date) => new Date(`${date}T00:00:00`).toLocaleDateString([], { month: "short", day: "numeric" });
const errorText = (error) => getManagementError(error, "This analytics section could not be loaded.");

function AnalyticsPanel({ title, subtitle, action, loading, error, empty, onRetry, children }) {
  return <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-navy">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div>{action}</div>
    {loading ? <div className="space-y-3" aria-label={`Loading ${title}`}><div className="h-5 w-1/3 animate-pulse rounded bg-slate-100"/><div className="h-48 animate-pulse rounded-xl bg-slate-100"/></div> : error ? <div className="rounded-xl border border-red-100 bg-red-50 p-4" role="alert"><p className="text-sm text-red-800">{error}</p><button type="button" onClick={onRetry} className="mt-2 text-sm font-bold text-red-800 underline underline-offset-2">Retry section</button></div> : empty ? <div className="rounded-xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">No historical data available yet.</div> : children}
  </section>;
}

function KpiCard({ label, value, note, tone }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-600">{label}</p><span className={`h-2.5 w-2.5 rounded-full ${tone}`}/></div><p className="mt-3 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">{value}</p><p className="mt-1 text-xs text-slate-500">{note}</p></article>;
}

function BarSeries({ data, valueKey, labelKey, color = "#2563eb", currency = false }) {
  const max = Math.max(1, ...data.map((point) => Number(point[valueKey]) || 0));
  const chartHeight = 150;
  const topPadding = 8;
  const barSlot = 660 / Math.max(data.length, 1);
  const barWidth = Math.max(8, Math.min(32, barSlot * 0.58));
  return <svg role="img" aria-label={currency ? "Daily revenue bar chart" : "Daily orders bar chart"} viewBox="0 0 700 205" className="h-52 w-full overflow-visible">
    <line x1="24" y1={chartHeight + topPadding} x2="690" y2={chartHeight + topPadding} stroke="#e2e8f0"/>
    {data.map((point, index) => {
      const value = Number(point[valueKey]) || 0;
      const height = value ? Math.max(2, value / max * chartHeight) : 0;
      const x = 30 + index * barSlot + (barSlot - barWidth) / 2;
      const y = topPadding + chartHeight - height;
      return <g key={`${point[labelKey]}-${index}`}><title>{`${formatDate(point[labelKey])}: ${currency ? formatCurrency(value) : `${value} orders`}`}</title><rect x={x} y={y} width={barWidth} height={height} rx="5" fill={color} opacity={index === data.length - 1 ? 1 : 0.72}/><text x={x + barWidth / 2} y="181" textAnchor="middle" fontSize="11" fill="#64748b">{formatDate(point[labelKey])}</text></g>;
    })}
    <text x="25" y="12" fontSize="10" fill="#94a3b8">{currency ? formatCurrency(max) : max}</text>
  </svg>;
}

function PeakHoursChart({ values }) {
  const hourData = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  values.forEach((row) => { if (Number.isInteger(Number(row.hour)) && Number(row.hour) >= 0 && Number(row.hour) < 24) hourData[Number(row.hour)].count = Number(row.orderCount) || 0; });
  const max = Math.max(1, ...hourData.map((entry) => entry.count));
  const peak = values.reduce((result, row) => !result || row.orderCount > result.orderCount ? row : result, null);
  return <div>
    {peak && <div className="mb-4 flex items-center justify-between rounded-xl bg-orange-50 px-4 py-3"><span className="text-sm font-semibold text-orange-900">Busiest recorded hour</span><span className="text-sm font-extrabold text-orange-800">{formatHour(peak.hour)} · {peak.orderCount} orders</span></div>}
    <svg role="img" aria-label="Completed orders by hour of day" viewBox="0 0 720 190" className="h-52 w-full">
      <line x1="20" y1="154" x2="710" y2="154" stroke="#e2e8f0"/>
      {hourData.map(({ hour, count }) => { const width = 17; const gap = 11.5; const x = 25 + hour * (width + gap); const height = count ? Math.max(3, count / max * 130) : 0; return <g key={hour}><title>{`${formatHour(hour)}: ${count} completed orders`}</title><rect x={x} y={154 - height} width={width} height={height} rx="4" fill={peak && Number(peak.hour) === hour ? "#f97316" : "#3b82f6"} opacity={count ? 0.82 : 0}/>{hour % 3 === 0 && <text x={x + width / 2} y="176" textAnchor="middle" fontSize="10" fill="#64748b">{String(hour).padStart(2, "0")}</text>}</g>; })}
    </svg><div className="mt-1 text-right text-[11px] text-slate-400">Hour of day · 24-hour format</div>
  </div>;
}

function KpiSection({ overview, loading, error, onRetry }) {
  const keys = [
    ["Total orders", "totalOrders", "Today", "bg-blue-500", (v) => v],
    ["Completed orders", "completedOrders", "Today", "bg-emerald-500", (v) => v],
    ["Active orders", "activeOrders", "Queued, preparing, ready", "bg-orange-500", (v) => v],
    ["Revenue", "totalRevenue", "Completed orders today", "bg-blue-500", formatCurrency],
    ["Average order value", "averageOrderValue", "Completed orders today", "bg-slate-400", formatCurrency],
    ["Average wait time", "averageWaitTime", "Queued to ready", "bg-orange-500", (v) => `${Number(v).toFixed(0)} min`],
  ];
  return <div>
    {error && <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><ManagementNotice>{error}</ManagementNotice><button type="button" onClick={onRetry} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700">Retry KPIs</button></div>}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{keys.map(([label, key, note, tone, formatter]) => <KpiCard key={key} label={label} value={overview ? formatter(overview[key] ?? 0) : loading || error ? "—" : formatter(0)} note={note} tone={tone}/>)}</div>
  </div>;
}

const AdminAnalyticsPage = () => {
  const { user, logout } = useAuth();
  const [data, setData] = useState(INITIAL_DATA);
  const [errors, setErrors] = useState(INITIAL_ERRORS);
  const [loading, setLoading] = useState(INITIAL_LOADING);
  const [lastUpdated, setLastUpdated] = useState(null);
  const pending = useRef({});
  const mounted = useRef(false);

  const fetchSections = useCallback(async (keys = KEYS, signal) => {
    const requested = keys.filter((key) => !pending.current[key]);
    if (!requested.length) return;
    const tokens = {};
    requested.forEach((key) => { tokens[key] = {}; pending.current[key] = tokens[key]; });
    setLoading((current) => ({ ...current, ...Object.fromEntries(requested.map((key) => [key, true])) }));
    const results = await Promise.all(requested.map(async (key) => {
      try { return { key, response: await REQUESTS[key](signal) }; }
      catch (error) { return { key, error }; }
    }));
    if (!mounted.current) return;
    let hadSuccess = false;
    results.forEach(({ key, response, error }) => {
      if (pending.current[key] !== tokens[key]) return;
      if (error) setErrors((current) => ({ ...current, [key]: errorText(error) }));
      else {
        const value = RESPONSE_VALUE[key](response.data || {});
        setData((current) => ({ ...current, [key]: value }));
        setErrors((current) => ({ ...current, [key]: "" }));
        hadSuccess = true;
      }
      setLoading((current) => ({ ...current, [key]: false }));
      delete pending.current[key];
    });
    if (hadSuccess) setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    fetchSections(KEYS, controller.signal);
    const interval = window.setInterval(() => fetchSections(KEYS, controller.signal), REFRESH_INTERVAL);
    return () => { mounted.current = false; pending.current = {}; controller.abort(); window.clearInterval(interval); };
  }, [fetchSections]);

  const dailyTrend = data.dailyTrend || [];
  const popularItems = data.popularItems || [];
  const peakHours = data.peakHours || [];
  const categories = data.categories || [];
  const forecast = data.forecast || [];
  const lowStock = data.lowStock || [];
  const highestItem = popularItems[0];
  const busiestHour = peakHours.reduce((peak, row) => !peak || row.orderCount > peak.orderCount ? row : peak, null);
  const bestCategory = categories.reduce((best, row) => !best || row.quantitySold > best.quantitySold ? row : best, null);
  const highestForecast = forecast.reduce((best, row) => !best || row.forecastQuantity > best.forecastQuantity ? row : best, null);
  const maxPopularQty = Math.max(1, ...popularItems.map((item) => Number(item.quantitySold) || 0));
  const maxCategoryQty = Math.max(1, ...categories.map((item) => Number(item.quantitySold) || 0));
  const staleErrors = KEYS.some((key) => errors[key]);

  return <AdminLayout user={user} onLogout={logout}>
    <div className="mx-auto max-w-[1600px] px-4 pb-12 pt-7 sm:px-7 lg:px-10 lg:pt-9">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-blue-700">Operations intelligence</p><h1 className="mt-1 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">Analytics &amp; Demand Management</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Understand service volume, sales patterns, and expected demand using recorded canteen orders.</p></div><div className="flex items-center gap-3"><span className="text-xs font-medium text-slate-500">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Loading data"}</span><button type="button" onClick={() => fetchSections()} disabled={KEYS.some((key) => loading[key])} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">Refresh</button></div></div>
      {staleErrors && <div className="mt-5"><ManagementNotice>Some sections could not be refreshed. Their individual panels show the affected data.</ManagementNotice></div>}
      <div className="mt-7"><KpiSection overview={data.overview} loading={loading.overview} error={errors.overview} onRetry={() => fetchSections(["overview"])}/></div>

      <div className="mt-6 grid min-w-0 gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <AnalyticsPanel title="Daily order & revenue trend" subtitle="Recent seven-day activity from the daily trend endpoint" loading={loading.dailyTrend && !data.dailyTrend} error={errors.dailyTrend} empty={dailyTrend.length === 0} onRetry={() => fetchSections(["dailyTrend"])}>
          <div className="grid min-w-0 gap-5 lg:grid-cols-2"><div className="min-w-0"><div className="mb-1 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Orders per day</p><span className="h-2 w-2 rounded-full bg-blue-600"/></div><BarSeries data={dailyTrend} valueKey="orderCount" labelKey="date" color="#2563eb"/></div><div className="min-w-0"><div className="mb-1 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Revenue per day</p><span className="h-2 w-2 rounded-full bg-orange-500"/></div><BarSeries data={dailyTrend} valueKey="revenue" labelKey="date" color="#f97316" currency/></div></div>
        </AnalyticsPanel>
        <AnalyticsPanel title="Peak hours" subtitle="Completed orders grouped by hour of day" loading={loading.peakHours && !data.peakHours} error={errors.peakHours} empty={peakHours.length === 0} onRetry={() => fetchSections(["peakHours"])}>
          <PeakHoursChart values={peakHours}/>
        </AnalyticsPanel>
      </div>

      <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-2">
        <AnalyticsPanel title="Popular items" subtitle="Ranked by quantity in completed orders" loading={loading.popularItems && !data.popularItems} error={errors.popularItems} empty={popularItems.length === 0} onRetry={() => fetchSections(["popularItems"])}>
          <ol className="space-y-4">{popularItems.map((item, index) => <li key={item.productId || item.name} className="flex items-center gap-3"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold ${index === 0 ? "bg-orange-50 text-orange-800" : "bg-slate-100 text-slate-600"}`}>{index + 1}</span><div className="min-w-0 flex-1"><div className="flex items-baseline justify-between gap-2"><p className="truncate text-sm font-bold text-navy">{item.name}</p><p className="shrink-0 text-xs font-semibold text-slate-500">{item.quantitySold} sold</p></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.max(3, Number(item.quantitySold) / maxPopularQty * 100)}%` }}/></div></div><span className="hidden w-24 shrink-0 text-right text-xs font-bold text-slate-600 sm:block">{formatCurrency(item.revenueGenerated)}</span></li>)}</ol>
        </AnalyticsPanel>
        <AnalyticsPanel title="Category performance" subtitle="Quantity and revenue from completed orders" loading={loading.categories && !data.categories} error={errors.categories} empty={categories.length === 0} onRetry={() => fetchSections(["categories"])}>
          <ul className="space-y-4">{categories.map((item) => <li key={item.category}><div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-bold text-navy">{item.category}</p><div className="shrink-0 text-right"><span className="text-sm font-bold text-slate-700">{item.quantitySold} sold</span><span className="ml-2 text-xs text-slate-500">{formatCurrency(item.revenueGenerated)}</span></div></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.max(3, Number(item.quantitySold) / maxCategoryQty * 100)}%` }}/></div></li>)}</ul>
        </AnalyticsPanel>
      </div>

      <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <AnalyticsPanel title="Next-day demand estimate" subtitle="Historical rolling average from recent completed orders · not machine learning" loading={loading.forecast && !data.forecast} error={errors.forecast} empty={forecast.length === 0} onRetry={() => fetchSections(["forecast"])}>
          <div className="overflow-hidden rounded-xl border border-slate-100"><div className="grid grid-cols-[minmax(0,1.3fr)_0.8fr_0.8fr] gap-2 bg-slate-50 px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-500 sm:px-4 sm:text-xs"><span>Menu item</span><span className="text-right">Recent avg.</span><span className="text-right">Forecast</span></div><ul className="divide-y divide-slate-100">{forecast.map((item) => <li key={item.productId || item.name} className="grid grid-cols-[minmax(0,1.3fr)_0.8fr_0.8fr] items-center gap-2 px-3 py-3 sm:px-4"><span className="min-w-0 truncate text-sm font-bold text-navy">{item.name}</span><span className="text-right text-sm text-slate-600">{Number(item.recentAverageDailyQuantity).toLocaleString()} / day</span><span className="text-right text-sm font-extrabold text-blue-700">{item.forecastQuantity}</span></li>)}</ul></div>
          <p className="mt-3 text-xs leading-5 text-slate-400">The estimate reflects recent recorded demand and is intended as a planning signal. It does not account for promotions, closures, or future events.</p>
        </AnalyticsPanel>
        <AnalyticsPanel title="Operational insights" subtitle="Signals calculated from the loaded reports" loading={KEYS.some((key) => loading[key] && !data[key])} error={""} empty={false}>
          <div className="space-y-3">
            <Insight label="Highest-volume product" value={highestItem ? `${highestItem.name} · ${highestItem.quantitySold} sold` : errors.popularItems ? "Popular item data unavailable" : "Not enough completed-order data"}/>
            <Insight label="Busiest hour" value={busiestHour ? `${formatHour(busiestHour.hour)} · ${busiestHour.orderCount} completed orders` : errors.peakHours ? "Peak-hour data unavailable" : "Not enough hourly data"}/>
            <Insight label="Leading category" value={bestCategory ? `${bestCategory.category} · ${bestCategory.quantitySold} sold` : errors.categories ? "Category data unavailable" : "Not enough category data"}/>
            <Insight label="Highest forecast quantity" value={highestForecast ? `${highestForecast.name} · ${highestForecast.forecastQuantity} units` : errors.forecast ? "Forecast data unavailable" : "No forecast data available"}/>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-orange-100 bg-orange-50/70 px-3.5 py-3"><span><span className="block text-xs font-bold uppercase tracking-wide text-orange-800">Inventory attention</span><span className="mt-0.5 block text-xs text-slate-500">Current low-stock records</span></span><span className="text-xl font-extrabold text-orange-800">{data.lowStock ? lowStock.length : errors.lowStock ? "—" : loading.lowStock ? "…" : 0}</span></div>
            <Link to="/admin/inventory" className="inline-flex text-sm font-bold text-blue-700 hover:text-blue-800">Review inventory →</Link>
          </div>
        </AnalyticsPanel>
      </div>
      <p className="mt-5 text-right text-xs text-slate-400">Analytics refresh every {REFRESH_INTERVAL / 1000} seconds. KPIs cover today; trends cover the latest seven days; product, category, and hour rankings use completed-order history.</p>
    </div>
  </AdminLayout>;
};

function Insight({ label, value }) {
  return <div className="rounded-xl border border-slate-100 px-3.5 py-3"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold text-navy">{value}</p></div>;
}

export default AdminAnalyticsPage;
