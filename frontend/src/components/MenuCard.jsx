import FoodImage from "./FoodImage.jsx";

const formatPrice = (price) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
}).format(price);

const MenuCard = ({ product, onAdd }) => {
  const available = product.isAvailable !== false;

  return (
    <article className={`group overflow-hidden rounded-3xl border bg-white shadow-card transition duration-200 hover:-translate-y-1 hover:shadow-card-hover ${available ? "border-slate-200" : "border-slate-200 opacity-70"}`}>
      <div className="relative h-48 overflow-hidden bg-slate-100 sm:h-52">
        <FoodImage src={product.image} alt={product.name} className="h-full w-full" imageClassName="transition duration-500 group-hover:scale-[1.03]" />
        {product.category && <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">{product.category}</span>}
        {!available && <span className="absolute right-4 top-4 rounded-full bg-slate-900/85 px-3 py-1.5 text-xs font-semibold text-white">Unavailable</span>}
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex min-h-14 items-start justify-between gap-3">
          <h3 className="text-lg font-semibold leading-6 text-navy">{product.name}</h3>
          <p className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-sm font-extrabold text-blue-700">{formatPrice(product.price)}</p>
        </div>
        <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">{product.description || ""}</p>
        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
          <span className={`inline-flex items-center gap-2 text-xs font-semibold ${available ? "text-emerald-700" : "text-slate-500"}`}>
            <span className={`h-2 w-2 rounded-full ${available ? "bg-emerald-500" : "bg-slate-400"}`} />
            {available ? "Available today" : "Currently unavailable"}
          </span>
          <button
            type="button"
            onClick={() => onAdd(product)}
            disabled={!available}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-4 ${available ? "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-200" : "cursor-not-allowed bg-slate-100 text-slate-400"}`}
          >
            Add to cart
          </button>
        </div>
      </div>
    </article>
  );
};

export default MenuCard;
