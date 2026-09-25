import { Link } from "react-router-dom";

const AuthLayout = ({ title, description, footer, children }) => (
  <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f5f7fb] px-4 py-10 sm:px-6">
    <div aria-hidden="true" className="pointer-events-none absolute -left-32 -top-36 h-96 w-96 rounded-full bg-blue-100/70 blur-3xl" />
    <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -right-28 h-[30rem] w-[30rem] rounded-full bg-orange-100/70 blur-3xl" />

    <div className="relative w-full max-w-md">
      <Link to="/login" className="mb-7 flex items-center justify-center gap-3" aria-label="CanteenEats sign in">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200/70">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 10h16l-1.4 9H5.4L4 10Z" strokeLinejoin="round" />
            <path d="M8 10a4 4 0 0 1 8 0M8 14v2m4-2v2m4-2v2" strokeLinecap="round" />
          </svg>
        </span>
        <span>
          <span className="block text-lg font-bold tracking-tight text-navy">CanteenEats</span>
          <span className="block text-xs font-medium tracking-wide text-slate-500">CAMPUS DINING, MADE EASY</span>
        </span>
      </Link>

      <section className="rounded-[1.75rem] border border-slate-200/80 bg-white p-7 shadow-[0_24px_70px_-36px_rgba(15,35,65,0.35)] sm:p-9">
        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Student portal</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-navy sm:text-[1.75rem]">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        </div>
        {children}
        <div className="mt-7 border-t border-slate-100 pt-6 text-center text-sm text-slate-500">
          {footer}
        </div>
      </section>

      <p className="mt-6 text-center text-xs text-slate-400">A better break starts here.</p>
    </div>
  </main>
);

export default AuthLayout;
