import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { CURRENT_ORDER_EVENT, getCurrentOrderId } from "../services/currentOrder.js";

const getInitials = (name = "Student") =>
  name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "S";

const StudentLayout = ({ user, onLogout, cartCount = 0, children }) => {
  const userId = user?.id || user?._id;
  const [currentOrderId, setCurrentOrderId] = useState(() => getCurrentOrderId(userId));

  useEffect(() => {
    const syncCurrentOrder = () => setCurrentOrderId(getCurrentOrderId(userId));
    syncCurrentOrder();
    window.addEventListener(CURRENT_ORDER_EVENT, syncCurrentOrder);
    return () => window.removeEventListener(CURRENT_ORDER_EVENT, syncCurrentOrder);
  }, [userId]);

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-900">
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 sm:px-8">
        <Link to="/student" className="flex items-center gap-3" aria-label="Canteen home">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm shadow-blue-200">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 10h16l-1.4 9H5.4L4 10Z" strokeLinejoin="round" />
              <path d="M8 10a4 4 0 0 1 8 0M8 14v2m4-2v2m4-2v2" strokeLinecap="round" />
            </svg>
          </span>
          <span>
            <span className="block text-base font-bold tracking-tight text-navy">Campus Pantry</span>
            <span className="block text-xs font-medium text-slate-500">Student Portal</span>
          </span>
        </Link>

        <nav className="order-3 flex w-full items-center gap-2 border-t border-slate-100 pt-3 sm:order-none sm:w-auto sm:border-0 sm:pt-0">
          <Link to="/student#menu" className="rounded-xl bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700">Menu</Link>
          {currentOrderId && <Link to={`/orders/${currentOrderId}`} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-navy">Current order</Link>}
          <Link to="/cart" className="relative inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-navy" aria-label={`Cart, ${cartCount} items`}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 4h2l2.2 10.1a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 1.9-1.4L21 8H6" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" />
            </svg>
            Cart
            {cartCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold leading-none text-white">{cartCount}</span>}
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="max-w-32 truncate text-sm font-semibold text-navy">{user?.name || "Student"}</p>
            <p className="text-xs text-slate-500">Student</p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-800" aria-label={`${user?.name || "Student"} avatar`}>
            {getInitials(user?.name)}
          </span>
          <button type="button" onClick={onLogout} className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-navy focus:outline-none focus:ring-4 focus:ring-slate-100">
            <span className="sm:hidden">Exit</span><span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </div>
    </header>
    <main>{children}</main>
    </div>
  );
};

export default StudentLayout;
