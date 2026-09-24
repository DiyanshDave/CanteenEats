import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../layouts/AuthLayout.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../services/api.js";
import { getAuthErrorMessage } from "../services/authErrors.js";

const ROLE_HOME = {
  STUDENT: "/student",
  STAFF: "/staff",
  ADMIN: "/admin",
};

const fieldClassName = "mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Register = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Enter your full name to continue.");
      return;
    }
    if (!emailPattern.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Choose a password to create your account.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Your passwords don't match yet.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post("/auth/register", {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      const { token, user } = response.data;

      if (token && user) {
        login(token, user);
        navigate(ROLE_HOME[user.role] || "/student", { replace: true });
        return;
      }

      navigate("/login", {
        replace: true,
        state: {
          email: email.trim().toLowerCase(),
          notice: "Your account is ready. Log in to continue.",
        },
      });
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError, "register"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your student account"
      description="Join your campus canteen and find something good for your next break."
      footer={<>Already have an account? <Link to="/login" className="font-semibold text-blue-700 hover:text-blue-800">Log in</Link></>}
    >
      {error && (
        <div role="alert" className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="text-sm font-semibold text-slate-700">Full name</label>
          <input id="name" name="name" type="text" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your full name" required className={fieldClassName} />
        </div>
        <div>
          <label htmlFor="email" className="text-sm font-semibold text-slate-700">Email address</label>
          <input id="email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@campus.edu" required className={fieldClassName} />
        </div>
        <div>
          <label htmlFor="password" className="text-sm font-semibold text-slate-700">Password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Create a password" required className={fieldClassName} />
        </div>
        <div>
          <label htmlFor="confirmPassword" className="text-sm font-semibold text-slate-700">Confirm password</label>
          <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter your password again" required className={fieldClassName} />
        </div>
        <button type="submit" disabled={submitting} className="flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-wait disabled:opacity-60">
          {submitting ? "Creating account…" : "Create account"}
        </button>
        <p className="text-center text-xs leading-5 text-slate-400">Student accounts only. Staff and admin access is provisioned separately.</p>
      </form>
    </AuthLayout>
  );
};

export default Register;
