import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import OrderStatusTimeline from "../components/OrderStatusTimeline.jsx";
import StudentLayout from "../layouts/StudentLayout.jsx";
import api from "../services/api.js";
import { clearCurrentOrderId } from "../services/currentOrder.js";

const ACTIVE_STATUSES = ["QUEUED", "PREPARING", "READY"];

const formatPrice = (value) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
}).format(value);

const formatStatus = (status = "") =>
  status.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

const OrderTracking = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const userId = user?.id || user?._id;
  const requestSequence = useRef(0);
  const inFlight = useRef(0);
  const hasLoaded = useRef(false);
  const [order, setOrder] = useState(null);
  const [queue, setQueue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState(null);
  const [refreshError, setRefreshError] = useState("");
  const [retry, setRetry] = useState(0);

  const refreshTracking = useCallback(async (signal) => {
    if (inFlight.current) return;
    const requestId = ++requestSequence.current;
    inFlight.current = requestId;

    try {
      const [orderResponse, queueResponse] = await Promise.all([
        api.get(`/orders/${id}`, { signal }),
        api.get(`/orders/${id}/queue`, { signal }),
      ]);
      if (signal?.aborted || requestSequence.current !== requestId) return;
      const freshOrder = orderResponse.data?.order;
      const freshQueue = queueResponse.data;

      if (!freshOrder || !freshQueue) {
        setPageError({ kind: "not-found", message: "We couldn't find this order." });
        setOrder(null);
        setQueue(null);
        clearCurrentOrderId(userId, id);
        return;
      }

      setOrder({ ...freshOrder, status: freshQueue.status || freshOrder.status });
      setQueue(freshQueue);
      setPageError(null);
      setRefreshError("");
      hasLoaded.current = true;

      if (["COMPLETED", "CANCELLED"].includes(freshQueue.status)) {
        clearCurrentOrderId(userId, id);
      }
    } catch (requestError) {
      if (signal?.aborted || requestSequence.current !== requestId) return;
      const status = requestError.response?.status;

      if (status === 401) {
        logout();
        navigate("/login", {
          replace: true,
          state: { notice: "Your session expired. Please sign in again." },
        });
        return;
      }
      if (status === 403) {
        setPageError({ kind: "forbidden", message: "You don't have access to this order." });
        setOrder(null);
        setQueue(null);
        clearCurrentOrderId(userId, id);
      } else if (status === 404) {
        setPageError({ kind: "not-found", message: "We couldn't find this order." });
        setOrder(null);
        setQueue(null);
        clearCurrentOrderId(userId, id);
      } else if (hasLoaded.current) {
        setRefreshError("Live updates are temporarily unavailable. We'll keep trying.");
      } else {
        setPageError({
          kind: "network",
          message: "We couldn't load your order. Check your connection and try again.",
        });
      }
    } finally {
      if (requestSequence.current === requestId) {
        inFlight.current = 0;
        if (!signal?.aborted) setLoading(false);
      }
    }
  }, [id, logout, navigate, userId]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setPageError(null);
    refreshTracking(controller.signal);
    return () => {
      controller.abort();
      requestSequence.current += 1;
      inFlight.current = 0;
    };
  }, [id, retry, refreshTracking]);

  const status = queue?.status || order?.status;
  const isActive = ACTIVE_STATUSES.includes(status) || status === "PENDING_PAYMENT";

  useEffect(() => {
    if (!isActive) return undefined;
    const controller = new AbortController();
    const intervalId = window.setInterval(() => {
      refreshTracking(controller.signal);
    }, 7000);

    return () => {
      window.clearInterval(intervalId);
      controller.abort();
      requestSequence.current += 1;
      inFlight.current = 0;
    };
  }, [isActive, refreshTracking]);

  const retryLoad = () => {
    hasLoaded.current = false;
    setRetry((value) => value + 1);
  };

  return (
    <StudentLayout user={user} cartCount={itemCount} onLogout={logout}>
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <Link to="/student#menu" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-800">
          <span aria-hidden="true">←</span> Back to menu
        </Link>

        {loading && !order ? (
          <div className="mt-6 space-y-5" aria-busy="true">
            <div className="h-56 animate-pulse rounded-[2rem] bg-navy/10" />
            <div className="h-72 animate-pulse rounded-3xl bg-white shadow-sm" />
          </div>
        ) : pageError ? (
          <section className="mt-7 rounded-3xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
            <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-bold ${pageError.kind === "forbidden" ? "bg-orange-50 text-orange-700" : "bg-red-50 text-red-600"}`}>
              {pageError.kind === "forbidden" ? "🔒" : "!"}
            </div>
            <h1 className="mt-4 text-xl font-semibold text-navy">
              {pageError.kind === "forbidden" ? "Order access restricted" : pageError.kind === "not-found" ? "Order not found" : "Tracking unavailable"}
            </h1>
            <p role="alert" className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{pageError.message}</p>
            {pageError.kind === "network" && (
              <button type="button" onClick={retryLoad} className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">Try again</button>
            )}
            <div><Link to="/student#menu" className="mt-4 inline-flex text-sm font-semibold text-blue-700 hover:text-blue-800">Return to menu</Link></div>
          </section>
        ) : order && queue ? (
          <>
            <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
              <section className="relative overflow-hidden rounded-[2rem] bg-navy p-6 text-white shadow-soft sm:p-9">
                <div aria-hidden="true" className="absolute -right-16 -top-24 h-64 w-64 rounded-full border border-white/10" />
                <div className="relative">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-200">Order tracking</p>
                      <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{status === "PENDING_PAYMENT" ? "Payment pending" : `Your order is ${formatStatus(status).toLowerCase()}`}</h1>
                    </div>
                    <span className={`rounded-full px-3.5 py-2 text-xs font-bold ${status === "COMPLETED" ? "bg-emerald-400/15 text-emerald-200" : status === "CANCELLED" ? "bg-red-400/15 text-red-200" : "bg-blue-400/15 text-blue-100"}`}>
                      {formatStatus(status)}
                    </span>
                  </div>

                  <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-300">Your queue token</p>
                      <p className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{status === "PENDING_PAYMENT" ? "After payment" : queue.token || order.token || "—"}</p>
                    </div>
                    <p className="max-w-xs text-sm leading-6 text-slate-300">
                      {status === "PENDING_PAYMENT"
                        ? "Complete payment from your cart to receive a queue token. This order has not entered the kitchen queue."
                        : status === "COMPLETED"
                        ? "Thanks for picking up your order. Enjoy!"
                        : status === "CANCELLED"
                          ? "This order has been cancelled."
                          : "We’ll keep this page up to date while the canteen prepares your order."}
                    </p>
                  </div>
                </div>
              </section>

              <section className="grid grid-cols-2 gap-3 lg:grid-cols-1">
                <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5 sm:p-6">
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Queue position</p>
                  <p className="mt-2 text-3xl font-bold text-navy">{status === "PENDING_PAYMENT" ? "Not queued" : queue.position != null ? `#${queue.position}` : "—"}</p>
                  {queue.numberOfOrdersAhead != null && <p className="mt-1 text-sm text-slate-600">{queue.numberOfOrdersAhead} {queue.numberOfOrdersAhead === 1 ? "order" : "orders"} ahead</p>}
                </div>
                <div className="rounded-3xl border border-orange-100 bg-orange-50 p-5 sm:p-6">
                  <p className="text-xs font-bold uppercase tracking-wide text-orange-700">Estimated wait</p>
                  <p className="mt-2 text-3xl font-bold text-navy">{status === "PENDING_PAYMENT" ? "After payment" : typeof queue.estimatedWaitMinutes === "number" ? `${queue.estimatedWaitMinutes}` : "—"}<span className="ml-1 text-base font-semibold">{status === "PENDING_PAYMENT" ? "" : typeof queue.estimatedWaitMinutes === "number" ? "min" : ""}</span></p>
                  {queue.totalActiveOrders != null && <p className="mt-1 text-sm text-slate-600">{queue.totalActiveOrders} active {queue.totalActiveOrders === 1 ? "order" : "orders"}</p>}
                </div>
              </section>
            </div>

            {refreshError && (
              <p role="status" className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">{refreshError}</p>
            )}

            {isActive && <p className="mt-4 text-right text-xs text-slate-400">Updates automatically every 7 seconds</p>}
            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <OrderStatusTimeline status={status} order={order} />
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Your order</p>
                    <h2 className="mt-1 text-xl font-semibold text-navy">Order details</h2>
                  </div>
                  <button type="button" onClick={() => refreshTracking()} disabled={loading} className="rounded-lg px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-50">Refresh</button>
                </div>
                <ul className="divide-y divide-slate-100">
                  {(order.items || []).map((item, index) => (
                    <li key={`${item.product?._id || item.product || index}`} className="flex justify-between gap-4 py-4 text-sm">
                      <div>
                        <p className="font-semibold text-slate-800">{item.nameSnapshot || item.product?.name || "Menu item"}</p>
                        <p className="mt-1 text-xs text-slate-500">Quantity {item.quantity}</p>
                      </div>
                      {typeof item.priceSnapshot === "number" && <p className="shrink-0 font-medium text-slate-700">{formatPrice(item.priceSnapshot * item.quantity)}</p>}
                    </li>
                  ))}
                </ul>
                {typeof order.totalAmount === "number" && <div className="flex justify-between border-t border-slate-200 pt-4 font-bold text-navy"><span>Total</span><span>{formatPrice(order.totalAmount)}</span></div>}
                <p className="mt-4 break-all text-xs text-slate-400">Order ID: {order._id}</p>
              </section>
            </div>
          </>
        ) : null}
      </div>
    </StudentLayout>
  );
};

export default OrderTracking;
