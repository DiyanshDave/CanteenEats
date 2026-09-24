import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import StudentLayout from "../layouts/StudentLayout.jsx";
import MenuCard from "../components/MenuCard.jsx";
import MenuSkeleton from "../components/MenuSkeleton.jsx";
import api from "../services/api.js";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const StudentDashboard = () => {
  const { user, logout } = useAuth();
  const { addItem, itemCount } = useCart();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [retry, setRetry] = useState(0);
  const [cartNotice, setCartNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const loadMenu = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await api.get("/menu", { signal: controller.signal });
        setProducts(Array.isArray(response.data.products) ? response.data.products : []);
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(
            requestError.response?.data?.message ||
              "We couldn't load today's menu. Please try again."
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadMenu();
    return () => controller.abort();
  }, [retry]);

  const categories = useMemo(() => {
    const names = products
      .map((product) => product.category?.trim())
      .filter(Boolean);
    return ["All", ...new Set(names)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        activeCategory === "All" || product.category?.trim() === activeCategory;
      const searchableText = [product.name, product.description, product.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesCategory && (!query || searchableText.includes(query));
    });
  }, [products, search, activeCategory]);

  const handleAddToCart = (product) => {
    if (addItem(product)) {
      setCartNotice(`${product.name} added to your cart.`);
      window.setTimeout(() => setCartNotice(""), 2200);
    }
  };

  return (
    <StudentLayout user={user} onLogout={logout} cartCount={itemCount}>
      <div className="mx-auto max-w-7xl px-5 pb-16 pt-8 sm:px-8 sm:pt-12">
        <section className="relative overflow-hidden rounded-[2rem] bg-navy px-6 py-9 text-white shadow-soft sm:px-10 sm:py-12 lg:px-14">
          <div className="relative z-10 max-w-2xl">
            <p className="mb-3 text-sm font-semibold tracking-wide text-blue-200">
              YOUR CAMPUS, SERVED FRESH
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
              {getGreeting()}, {user?.name?.trim().split(/\s+/)[0] || "there"}
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-slate-300 sm:text-lg">
              Order your food before the rush. Find something good for your next
              campus break.
            </p>
            <a
              href="#menu"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-navy transition hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-white/30"
            >
              Explore today&apos;s menu <span aria-hidden="true">↓</span>
            </a>
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full border border-white/10 sm:right-6 sm:top-[-11rem] sm:h-[28rem] sm:w-[28rem]" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-16 h-64 w-64 rounded-full border border-white/10 sm:right-20 sm:top-[-7rem] sm:h-80 sm:w-80" />
          <div aria-hidden="true" className="absolute -bottom-16 right-12 h-40 w-40 rounded-full bg-orange-400/20 blur-3xl sm:right-40" />
        </section>

        <section id="menu" className="scroll-mt-8 pt-12 sm:pt-16">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-blue-700">
                Made for your day
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
                Today&apos;s menu
              </h2>
              <p className="mt-2 text-slate-500">Fresh picks from your campus canteen.</p>
            </div>
            <label className="relative block w-full lg:max-w-sm">
              <span className="sr-only">Search menu</span>
              <svg aria-hidden="true" className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="10.8" cy="10.8" r="6.8" />
                <path d="m16 16 4.5 4.5" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search dishes or categories"
                className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </label>
          </div>

          {!loading && !error && products.length > 0 && (
            <div className="mt-7 flex gap-2 overflow-x-auto pb-2" aria-label="Filter by category">
              {categories.map((category) => {
                const selected = category === activeCategory;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    aria-pressed={selected}
                    className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-medium transition focus:outline-none focus:ring-4 focus:ring-blue-100 ${selected ? "bg-navy text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-navy"}`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          )}

          {cartNotice && (
            <p role="status" className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              {cartNotice}
            </p>
          )}

          <div className="mt-7">
            {loading ? (
              <MenuSkeleton />
            ) : error ? (
              <div className="rounded-3xl border border-red-100 bg-white px-6 py-12 text-center shadow-sm">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-xl text-red-600">!</div>
                <h3 className="mt-4 text-lg font-semibold text-navy">Menu unavailable right now</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{error}</p>
                <button
                  type="button"
                  onClick={() => setRetry((value) => value + 1)}
                  className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200"
                >
                  Try again
                </button>
              </div>
            ) : filteredProducts.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map((product) => <MenuCard key={product._id} product={product} onAdd={handleAddToCart} />)}
              </div>
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
                <div aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-2xl">☺</div>
                <h3 className="mt-4 text-lg font-semibold text-navy">
                  {products.length === 0 ? "The menu is being refreshed" : "No dishes found"}
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  {products.length === 0
                    ? "There aren't any available items right now. Check back soon for today's menu."
                    : "Try another search or choose a different category to find what you're looking for."}
                </p>
                {products.length > 0 && (search || activeCategory !== "All") && (
                  <button
                    type="button"
                    onClick={() => { setSearch(""); setActiveCategory("All"); }}
                    className="mt-5 text-sm font-semibold text-blue-700 hover:text-blue-800"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </StudentLayout>
  );
};

export default StudentDashboard;
