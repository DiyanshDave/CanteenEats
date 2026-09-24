import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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

const Login = () => {
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await api.post("/auth/login", {
        email: email.trim().toLowerCase(),
        password,
      });
      const { token, user } = response.data;

      if (!token || !user) {
        setError("We couldn't complete sign in. Please try again.");
        return;
      }

      login(token, user);
      navigate(ROLE_HOME[user.role] || "/login", { replace: true });
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError, "login"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      description="Sign in to see what's fresh at your campus canteen."
      footer={<>Don&apos;t have an account? <Link to="/register" className="font-semibold text-blue-700 hover:text-blue-800">Sign up</Link></>}
    >
      {location.state?.notice && (
        <div role="status" className="mb-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {location.state.notice}
        </div>
      )}
      {error && (
        <div role="alert" className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="text-sm font-semibold text-slate-700">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@campus.edu"
            required
            className={fieldClassName}
          />
        </div>
        <div>
          <label htmlFor="password" className="text-sm font-semibold text-slate-700">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            required
            className={fieldClassName}
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-wait disabled:opacity-60"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthLayout>
  );
};

export default Login;
