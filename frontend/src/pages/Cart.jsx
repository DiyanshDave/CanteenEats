import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import FoodImage from "../components/FoodImage.jsx";
import StudentLayout from "../layouts/StudentLayout.jsx";
import api from "../services/api.js";
import { setCurrentOrderId } from "../services/currentOrder.js";

const formatPrice = (value) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
}).format(value);

const getOrderError = (error) => {
  if (!error.response) return "We couldn't reach the canteen service. Check your connection and try again.";
  if (error.response.status === 404 || error.response.status === 400) {
    const detail = error.response.data?.message?.toLowerCase() || "";
    if (detail.includes("unavailable") || detail.includes("product not found")) {
      return "One or more items are no longer available. Review your cart and try again.";
    }
    return error.response.data?.message || "We couldn't start checkout. Check your cart and try again.";
  }
  return "We couldn't start checkout right now. Please try again.";
};

const loadRazorpay = () => new Promise((resolve) => {
  if (window.Razorpay) return resolve(true);
  const script = document.createElement("script");
  script.src = "https://checkout.razorpay.com/v1/checkout.js";
  script.onload = () => resolve(true);
  script.onerror = () => resolve(false);
  document.body.appendChild(script);
});

const Cart = () => {
  const { user, logout } = useAuth();
  const { items, itemCount, total, setQuantity, removeItem, clearCart } = useCart();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [error, setError] = useState("");
  const [verificationPayload, setVerificationPayload] = useState(null);

  const verifyCheckout = async (payload) => {
    setSubmitting(true);
    setError("");
    try {
      const response = await api.post("/payments/verify", payload);
      const order = response.data?.order;
      if (!order?._id || !order.token || order.paymentStatus !== "PAID") {
        throw new Error("Order confirmation is still processing");
      }
      setCurrentOrderId(user?.id || user?._id, order._id);
      sessionStorage.removeItem(`canteen-payment:${user?.id || user?._id}:${JSON.stringify(items.map(({ productId, quantity }) => [productId, quantity]).sort())}`);
      clearCart();
      navigate(`/order-confirmation/${order._id}`, { state: { order } });
      return true;
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        logout();
        navigate("/login", {
          replace: true,
          state: { notice: "Your session expired. Please sign in again to confirm payment." },
        });
      } else {
        setVerificationPayload(payload);
        setError("Payment may have completed, but confirmation is pending. Retry verification; your cart is still saved.");
      }
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const startPayment = async () => {
    setSubmitting(true);
    setError("");

    try {
      const userId = user?.id || user?._id;
      const cartKey = `canteen-payment:${userId}:${JSON.stringify(items.map(({ productId, quantity }) => [productId, quantity]).sort())}`;
      const internalOrderId = sessionStorage.getItem(cartKey) || undefined;
      const response = await api.post("/payments/create-order", {
        internalOrderId,
        items: items.map(({ productId, quantity }) => ({ productId, quantity })),
      });
      if (response.data?.order?.token && response.data.order.paymentStatus === "PAID") {
        const order = response.data.order;
        setCurrentOrderId(userId, order._id);
        sessionStorage.removeItem(cartKey);
        clearCart();
        navigate(`/order-confirmation/${order._id}`, { state: { order } });
        return;
      }
      const checkout = response.data?.checkout;
      if (!checkout?.internalOrderId || !checkout?.razorpayOrderId || !checkout?.keyId) {
        throw new Error("Checkout details were incomplete");
      }
      sessionStorage.setItem(cartKey, checkout.internalOrderId);

      const loaded = await loadRazorpay();
      if (!loaded) throw new Error("Secure checkout could not be loaded. Please check your connection and retry.");

      const checkoutWindow = new window.Razorpay({
        key: checkout.keyId,
        amount: checkout.amount,
        currency: checkout.currency,
        name: "Canteen Queue",
        description: "Canteen order payment",
        order_id: checkout.razorpayOrderId,
        prefill: { name: user?.name || "", email: user?.email || "" },
        theme: { color: "#2563eb" },
        handler: async (result) => {
          setCheckoutOpen(false);
          const payload = {
            internalOrderId: checkout.internalOrderId,
            razorpay_payment_id: result.razorpay_payment_id,
            razorpay_order_id: result.razorpay_order_id,
            razorpay_signature: result.razorpay_signature,
          };
          setVerificationPayload(payload);
          await verifyCheckout(payload);
        },
        modal: {
          ondismiss: () => {
            setCheckoutOpen(false);
            setSubmitting(false);
            setError("Payment was not completed. Your cart is saved so you can retry when ready.");
          },
        },
      });
      checkoutWindow.on("payment.failed", () => {
        setCheckoutOpen(false);
        setSubmitting(false);
        setError("Payment was not completed. Your cart is saved; please retry.");
      });
      checkoutWindow.open();
      setCheckoutOpen(true);
      setSubmitting(false);
    } catch (requestError) {
      setCheckoutOpen(false);
      const createdOrderId = requestError.response?.data?.internalOrderId;
      if (createdOrderId) {
        const userId = user?.id || user?._id;
        const cartKey = `canteen-payment:${userId}:${JSON.stringify(items.map(({ productId, quantity }) => [productId, quantity]).sort())}`;
        sessionStorage.setItem(cartKey, createdOrderId);
      }
      if (requestError.response?.status === 401) {
        logout();
        navigate("/login", {
          replace: true,
          state: { notice: "Your session expired. Please sign in again to place your order." },
        });
        return;
      }
      setError(requestError.message === "Secure checkout could not be loaded. Please check your connection and retry."
        ? requestError.message
        : getOrderError(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const retryPayment = () => verificationPayload
    ? verifyCheckout(verificationPayload)
    : startPayment();

  return (
    <StudentLayout user={user} onLogout={logout} cartCount={itemCount}>
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <Link to="/student#menu" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-800">
          <span aria-hidden="true">←</span> Back to menu
        </Link>
        <div className="mt-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-blue-700">Review before checkout</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-navy sm:text-4xl">Your cart</h1>
            <p className="mt-2 text-slate-500">{itemCount} {itemCount === 1 ? "item" : "items"} in your order</p>
          </div>
          {items.length > 0 && (
            <button type="button" onClick={clearCart} className="self-start rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-red-50 hover:text-red-700 sm:self-auto">
              Clear cart
            </button>
          )}
        </div>

        {error && (
          <div role="alert" className="mt-7 flex flex-col gap-3 rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between">
            <p>{error}</p>
            <button type="button" onClick={retryPayment} disabled={submitting || checkoutOpen || items.length === 0} className="shrink-0 font-semibold underline underline-offset-2 disabled:opacity-50">{verificationPayload ? "Retry verification" : "Retry payment"}</button>
          </div>
        )}

        {items.length === 0 ? (
          <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
            <div aria-hidden="true" className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-orange-50 text-orange-500">
              <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M3 4h2l2.2 10.1a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 1.9-1.4L21 8H6" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" />
              </svg>
            </div>
            <h2 className="mt-5 text-xl font-semibold text-navy">Your cart is taking a break</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">Browse today&apos;s menu and add something tasty to get started.</p>
            <Link to="/student#menu" className="mt-7 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200">Explore the menu</Link>
          </section>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
            <section aria-label="Cart items" className="space-y-4">
              {items.map((item) => (
                <article key={item.productId} className="flex gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:gap-5 sm:p-5">
                  <FoodImage src={item.image} alt="" className="h-24 w-24 shrink-0 rounded-2xl sm:h-28 sm:w-28" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="truncate font-semibold text-navy">{item.name}</h2>
                        <p className="mt-1 text-sm text-slate-500">{formatPrice(item.price)} each</p>
                      </div>
                      <button type="button" onClick={() => removeItem(item.productId)} aria-label={`Remove ${item.name} from cart`} className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600">
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
                          <path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="inline-flex items-center rounded-xl border border-slate-200">
                        <button type="button" onClick={() => setQuantity(item.productId, item.quantity - 1)} aria-label={`Decrease ${item.name} quantity`} className="h-9 w-9 rounded-l-xl text-lg text-slate-600 transition hover:bg-slate-50">−</button>
                        <span aria-live="polite" className="min-w-9 px-2 text-center text-sm font-semibold text-navy">{item.quantity}</span>
                        <button type="button" onClick={() => setQuantity(item.productId, item.quantity + 1)} aria-label={`Increase ${item.name} quantity`} className="h-9 w-9 rounded-r-xl text-lg text-slate-600 transition hover:bg-slate-50">+</button>
                      </div>
                      <p className="font-semibold text-navy">{formatPrice(item.price * item.quantity)}</p>
                    </div>
                  </div>
                </article>
              ))}
            </section>

            <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-28">
              <h2 className="text-lg font-semibold text-navy">Order summary</h2>
              <div className="mt-5 flex justify-between text-sm text-slate-500">
                <span>Items ({itemCount})</span><span>{formatPrice(total)}</span>
              </div>
              <div className="mt-4 flex justify-between border-t border-slate-100 pt-4 text-base font-bold text-navy">
                <span>Subtotal</span><span>{formatPrice(total)}</span>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-400">Final prices are confirmed by the canteen before secure payment.</p>
              <button type="button" onClick={startPayment} disabled={submitting || checkoutOpen || items.length === 0} className="mt-6 flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-wait disabled:opacity-60">
                {submitting ? "Opening secure checkout…" : checkoutOpen ? "Checkout open" : `Pay ${formatPrice(total)}`}
              </button>
              <p className="mt-3 text-center text-xs text-slate-400">Payments are processed securely by Razorpay.</p>
            </aside>
          </div>
        )}
      </div>
    </StudentLayout>
  );
};

export default Cart;
