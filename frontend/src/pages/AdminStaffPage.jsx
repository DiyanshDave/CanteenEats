import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import AdminLayout from "../layouts/AdminLayout.jsx";
import api from "../services/api.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPTY_FORM = { name: "", email: "", password: "", confirmPassword: "" };
const fieldClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100";

function getCreateError(error) {
  const status = error.response?.status;
  if (status === 409) return "That email is already registered. Try a different email address.";
  if (status === 401) return "Your admin session has expired. Please sign in again.";
  if (status === 403) return "Only an administrator can create staff accounts.";
  if (status === 404) return "Staff account provisioning is only available when the backend is running in development mode.";
  if (status === 400) return error.response.data?.message || "Check the account details and try again.";
  if (!error.response) return "The server is unavailable. Check your connection and try again.";
  return error.response.data?.message || "The staff account could not be created. Please try again.";
}

const AdminStaffPage = () => {
  const { user, logout } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [requestError, setRequestError] = useState("");
  const [createdStaff, setCreatedStaff] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: "" }));
    setRequestError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setRequestError("");
    const errors = {};
    if (!form.name.trim()) errors.name = "Enter the staff member’s full name.";
    if (!form.email.trim()) errors.email = "Enter an email address.";
    else if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = "Enter a valid email address.";
    if (!form.password) errors.password = "Enter a password.";
    else if (form.password.length < 8) errors.password = "Use at least 8 characters.";
    if (!form.confirmPassword) errors.confirmPassword = "Confirm the password.";
    else if (form.password !== form.confirmPassword) errors.confirmPassword = "The passwords do not match.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    setSubmitting(true);
    try {
      const response = await api.post("/auth/dev/create-user", {
        name,
        email,
        password: form.password,
        role: "STAFF",
      });
      const createdUser = response.data?.user;
      setForm({ ...EMPTY_FORM });
      setFieldErrors({});
      setCreatedStaff({ name: createdUser?.name || name, email: createdUser?.email || email });
    } catch (error) {
      setRequestError(getCreateError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const startAnother = () => {
    setCreatedStaff(null);
    setRequestError("");
    setForm({ ...EMPTY_FORM });
  };

  return <AdminLayout user={user} onLogout={logout}>
    <div className="mx-auto max-w-[1100px] px-4 pb-12 pt-7 sm:px-7 lg:px-10 lg:pt-9">
      <div><p className="text-sm font-semibold text-blue-700">Team access</p><h1 className="mt-1 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">Staff Accounts</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Create accounts for canteen and kitchen personnel.</p></div>

      <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-7">
          {createdStaff ? <div className="py-5 text-center sm:py-9" role="status">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-2xl font-bold text-emerald-700"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
            <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.15em] text-emerald-700">Account created</p>
            <h2 className="mt-2 text-2xl font-extrabold text-navy">{createdStaff.name}</h2>
            <p className="mt-1 text-sm text-slate-500">{createdStaff.email}</p>
            <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-slate-600">This staff member can now sign in from the normal login page and access the Kitchen Dashboard.</p>
            <button type="button" onClick={startAnother} className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100">Create another staff account</button>
          </div> : <>
            <div className="mb-6"><div className="flex items-center gap-2"><h2 className="text-xl font-bold text-navy">Create staff account</h2><span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-blue-700">Staff role</span></div><p className="mt-1 text-sm text-slate-500">The account will have kitchen staff access.</p></div>
            {requestError && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-800">{requestError}</div>}
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div><label htmlFor="staff-name" className="text-sm font-semibold text-slate-700">Full name</label><input id="staff-name" name="name" type="text" autoComplete="name" maxLength={120} value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Staff member’s full name" aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "staff-name-error" : undefined} className={`${fieldClass} ${fieldErrors.name ? "border-red-300 focus:border-red-400 focus:ring-red-50" : ""}`}/>{fieldErrors.name && <p id="staff-name-error" className="mt-1.5 text-xs font-medium text-red-700">{fieldErrors.name}</p>}</div>
              <div><label htmlFor="staff-email" className="text-sm font-semibold text-slate-700">Email address</label><input id="staff-email" name="email" type="email" autoComplete="email" maxLength={254} value={form.email} onChange={(event) => updateField("email", event.target.value)} placeholder="staff@canteen.edu" aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "staff-email-error" : undefined} className={`${fieldClass} ${fieldErrors.email ? "border-red-300 focus:border-red-400 focus:ring-red-50" : ""}`}/>{fieldErrors.email && <p id="staff-email-error" className="mt-1.5 text-xs font-medium text-red-700">{fieldErrors.email}</p>}</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label htmlFor="staff-password" className="text-sm font-semibold text-slate-700">Password</label><input id="staff-password" name="password" type="password" autoComplete="new-password" value={form.password} onChange={(event) => updateField("password", event.target.value)} placeholder="At least 8 characters" aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? "staff-password-error" : "staff-password-help"} className={`${fieldClass} ${fieldErrors.password ? "border-red-300 focus:border-red-400 focus:ring-red-50" : ""}`}/>{fieldErrors.password ? <p id="staff-password-error" className="mt-1.5 text-xs font-medium text-red-700">{fieldErrors.password}</p> : <p id="staff-password-help" className="mt-1.5 text-xs text-slate-400">Use at least 8 characters.</p>}</div>
                <div><label htmlFor="staff-confirm-password" className="text-sm font-semibold text-slate-700">Confirm password</label><input id="staff-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={(event) => updateField("confirmPassword", event.target.value)} placeholder="Enter password again" aria-invalid={Boolean(fieldErrors.confirmPassword)} aria-describedby={fieldErrors.confirmPassword ? "staff-confirm-error" : undefined} className={`${fieldClass} ${fieldErrors.confirmPassword ? "border-red-300 focus:border-red-400 focus:ring-red-50" : ""}`}/>{fieldErrors.confirmPassword && <p id="staff-confirm-error" className="mt-1.5 text-xs font-medium text-red-700">{fieldErrors.confirmPassword}</p>}</div>
              </div>
              <button type="submit" disabled={submitting} className="mt-2 flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-wait disabled:opacity-60">{submitting ? "Creating staff account…" : "Create staff account"}</button>
              <p className="text-center text-xs leading-5 text-slate-400">This form creates STAFF accounts only. Admin access is provisioned separately.</p>
            </form>
          </>}
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5 sm:p-6"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 11a3 3 0 1 0 0-6m1 9a5 5 0 0 1 3.5 4.8" strokeLinecap="round"/></svg></div><h2 className="mt-4 font-bold text-navy">Kitchen team access</h2><p className="mt-2 text-sm leading-6 text-slate-600">Create staff accounts for canteen and kitchen personnel. Staff members can then sign in through the normal login page and access the Kitchen Dashboard.</p></section>
          <section className="rounded-2xl border border-orange-200 bg-orange-50/70 p-5"><p className="text-xs font-extrabold uppercase tracking-wide text-orange-800">Development provisioning</p><p className="mt-2 text-sm leading-6 text-slate-600">This account-creation tool is available only when the backend runs in development mode.</p></section>
        </aside>
      </div>
    </div>
  </AdminLayout>;
};

export default AdminStaffPage;
