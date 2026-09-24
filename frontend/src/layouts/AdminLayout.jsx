import { Link, NavLink } from "react-router-dom";

const NAV_ITEMS = [
  { label: "Dashboard", to: "/admin", end: true, symbol: "▦" },
  { label: "Menu", to: "/admin/menu", symbol: "☷" },
  { label: "Inventory", to: "/admin/inventory", symbol: "▤" },
  { label: "Analytics", to: "/admin/analytics", symbol: "⌁" },
  { label: "Staff Accounts", to: "/admin/staff", symbol: "♙" },
];
const initials = (name = "Admin") => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "A";

const AdminLayout = ({ user, onLogout, children }) => (
  <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 sm:px-7 lg:px-10">
        <div className="flex items-center gap-3">
          <Link to="/admin" aria-label="Campus Pantry admin dashboard" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm shadow-blue-200">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 10h16l-1.4 9H5.4L4 10Z" strokeLinejoin="round"/><path d="M8 10a4 4 0 0 1 8 0M8 14v2m4-2v2m4-2v2" strokeLinecap="round"/></svg>
          </Link>
          <div><p className="text-base font-bold tracking-tight text-navy">Campus Pantry</p><p className="text-xs font-medium text-slate-500">Management Portal</p></div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-blue-700 sm:inline-flex">Administrator</span>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-800" aria-label={`${user?.name || "Admin"} avatar`}>{initials(user?.name)}</span>
          <div className="hidden text-right sm:block"><p className="max-w-40 truncate text-sm font-semibold text-navy">{user?.name || "Administrator"}</p><p className="text-xs text-slate-500">Admin account</p></div>
          <button type="button" onClick={onLogout} className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-navy focus:outline-none focus:ring-4 focus:ring-slate-100">Log out</button>
        </div>
        <nav aria-label="Admin navigation" className="order-3 flex w-full items-center gap-1 overflow-x-auto border-t border-slate-100 pt-2 sm:order-none sm:w-auto sm:border-0 sm:pt-0">
          {NAV_ITEMS.map(({ label, to, end, symbol }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition sm:px-3.5 ${isActive ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50 hover:text-navy"}`}><span aria-hidden="true" className="text-base leading-none">{symbol}</span>{label}</NavLink>)}
        </nav>
      </div>
    </header>
    <main>{children}</main>
  </div>
);

export default AdminLayout;
