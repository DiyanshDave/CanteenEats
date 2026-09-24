import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import StudentLayout from "../layouts/StudentLayout.jsx";
import api from "../services/api.js";

const formatPrice = (value) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
}).format(value);

const formatStatus = (status = "") =>
  status.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

const OrderConfirmation = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const routeOrder = location.state?.order;
  const initialOrder = routeOrder && String(routeOrder._id) === id ? routeOrder : null;
  const [order, setOrder] = useState(initialOrder);
  const [loading, setLoading] = useState(!initialOrder);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialOrder) return undefined;
    const controller = new AbortController();

    const loadOrder = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/orders/${id}`, { signal: controller.signal });
        setOrder(response.data.order || null);
        if (!response.data.order) setError("We couldn't find this order.");
      } catch (requestError) {
        if (controller.signal.aborted) return;
        if (requestError.response?.status === 401) {
          logout();
          navigate("/login", {
            replace: true,
            state: { notice: "Your session expired. Please sign in again." },
          });
          return;
        }
        setError(requestError.response?.status === 404
          ? "We couldn't find this order."
          : "We couldn't load your order details. Please try again.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadOrder();
    return () => controller.abort();
  }, [id, initialOrder, logout, navigate]);

  return (
    <StudentLayout user={user} cartCount={itemCount} onLogout={logout}>
      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm" aria-busy="true">
            <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-blue-100" />
            <p className="mt-4 text-sm font-medium text-slate-500">Loading your order details…</p>
          </div>
        ) : error || !order ? (
          <div className="rounded-3xl border border-red-100 bg-white p-8 text-center shadow-sm">
            <p role="alert" className="text-sm text-red-700">{error || "Order details are unavailable."}</p>
            <Link to="/student#menu" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">Back to menu</Link>
          </div>
        ) : (
          <>
            <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white text-center shadow-sm">
              <div className="bg-navy px-6 py-10 text-white sm:px-10 sm:py-12">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-300/25">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m5 12.5 4.5 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-blue-200">{order.paymentStatus === "PAID" ? "Payment successful" : "Payment pending"}</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{order.paymentStatus === "PAID" ? "You're all set" : "Complete your payment"}</h1>
                <p className="mt-3 text-sm text-slate-300">{order.paymentStatus === "PAID" ? "Your order has been sent to the canteen." : "This order has not entered the kitchen queue."}</p>
              </div>

              <div className="px-6 py-8 sm:px-10">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-blue-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Queue token</p>
                    <p className="mt-1 text-2xl font-bold text-navy">{order.token || (order.status === "PENDING_PAYMENT" ? "After payment" : "—")}</p>
                  </div>
                  <div className="rounded-2xl bg-orange-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Status</p>
                    <p className="mt-2 text-lg font-bold text-navy">{formatStatus(order.status) || "—"}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estimated wait</p>
                    <p className="mt-2 text-lg font-bold text-navy">
                      {typeof order.estimatedWaitMinutes === "number" ? `${order.estimatedWaitMinutes} min` : "—"}
                    </p>
                  </div>
                </div>

                <div className="mt-7 text-left">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <h2 className="font-semibold text-navy">Order details</h2>
                    <p className="text-xs text-slate-400">Order ID: {order._id}</p>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {(order.items || []).map((item, index) => {
                      const name = item.nameSnapshot || item.product?.name || "Menu item";
                      const price = item.priceSnapshot ?? item.product?.price;
                      return (
                        <li key={`${item.product?._id || item.product || name}-${index}`} className="flex items-center justify-between gap-4 py-4 text-sm">
                          <div>
                            <p className="font-medium text-slate-800">{name}</p>
                            <p className="mt-1 text-xs text-slate-500">Quantity {item.quantity}</p>
                          </div>
                          {typeof price === "number" && <p className="font-semibold text-navy">{formatPrice(price * item.quantity)}</p>}
                        </li>
                      );
                    })}
                  </ul>
                  {typeof order.totalAmount === "number" && (
                    <div className="flex justify-between border-t border-slate-200 pt-4 font-bold text-navy">
                      <span>{order.paymentStatus === "PAID" ? "Total paid" : "Order total"}</span><span>{formatPrice(order.totalAmount)}</span>
                    </div>
                  )}
                </div>

                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  <Link to="/student#menu" className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200">Back to menu</Link>
                  <Link to={`/orders/${order._id}`} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-navy transition hover:border-blue-200 hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-100">{order.paymentStatus === "PAID" ? "Track order" : "View order status"}</Link>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </StudentLayout>
  );
};

export default OrderConfirmation;
