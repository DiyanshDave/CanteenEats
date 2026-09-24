import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import AdminLayout from "../layouts/AdminLayout.jsx";

const MODULES = {
  "/admin/menu": { title: "Menu Management", description: "Manage the canteen menu, product details, and availability." },
  "/admin/inventory": { title: "Inventory Management", description: "Review supplies, stock levels, and low-stock items." },
  "/admin/analytics": { title: "Analytics & Demand", description: "Explore operating performance, sales patterns, and demand insights." },
};

const AdminModulePage = () => {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const module = MODULES[pathname] || MODULES["/admin/menu"];

  return <AdminLayout user={user} onLogout={logout}>
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-7 lg:px-10 lg:py-12">
      <p className="text-sm font-semibold text-blue-700">Admin workspace</p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">{module.title}</h1>
      <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-9">
        <span className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-orange-800">Coming in a later phase</span>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">{module.description} This section is not available yet.</p>
        <Link to="/admin" className="mt-6 inline-flex rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100">Back to dashboard</Link>
      </section>
    </div>
  </AdminLayout>;
};

export default AdminModulePage;
