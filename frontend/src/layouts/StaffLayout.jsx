import { Link } from "react-router-dom";

const initials = (name = "Staff") => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "S";

const StaffLayout = ({ user, onLogout, children }) => (
  <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-7 lg:px-10">
        <div className="flex items-center gap-3">
          <Link to="/staff" aria-label="CanteenEats kitchen dashboard" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm shadow-blue-200">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 10h16l-1.4 9H5.4L4 10Z" strokeLinejoin="round"/><path d="M8 10a4 4 0 0 1 8 0M8 14v2m4-2v2m4-2v2" strokeLinecap="round"/></svg>
          </Link>
          <div><p className="text-base font-bold tracking-tight text-navy">CanteenEats</p><p className="text-xs font-medium text-slate-500">Kitchen Dashboard</p></div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-blue-700 sm:inline-flex">{user?.role || "Staff"}</span>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-800" aria-label={`${user?.name || "Staff"} avatar`}>{initials(user?.name)}</span>
          <div className="hidden text-right sm:block"><p className="max-w-40 truncate text-sm font-semibold text-navy">{user?.name || "Kitchen staff"}</p><p className="text-xs text-slate-500">Operations</p></div>
          <button type="button" onClick={onLogout} className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-navy focus:outline-none focus:ring-4 focus:ring-slate-100">Log out</button>
        </div>
      </div>
    </header>
    <main>{children}</main>
  </div>
);

export default StaffLayout;
