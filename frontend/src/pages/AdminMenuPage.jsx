import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../services/api.js";
import AdminLayout from "../layouts/AdminLayout.jsx";
import FoodImage from "../components/FoodImage.jsx";
import { ConfirmDialog, getManagementError, ManagementField, ManagementModal, ManagementNotice, PageLoading, StatusBadge } from "../components/AdminManagement.jsx";

const blankProduct = { name: "", description: "", price: "", category: "", image: "", isAvailable: true };
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-navy outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50";
const currency = (value) => `₹${Number(value || 0).toFixed(2)}`;

function ProductForm({ product, busy, error, onClose, onSave }) {
  const [form, setForm] = useState(() => product ? { ...blankProduct, ...product, price: String(product.price), image: product.image || "" } : blankProduct);
  const [validationError, setValidationError] = useState("");
  const setValue = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return setValidationError("Enter a product name.");
    if (!form.category.trim()) return setValidationError("Enter a category.");
    if (!Number.isFinite(Number(form.price)) || Number(form.price) <= 0) return setValidationError("Price must be greater than zero.");
    if ((form.description || "").length > 500) return setValidationError("Description must be 500 characters or fewer.");
    if (form.image.trim()) {
      try { const url = new URL(form.image); if (!["http:", "https:"].includes(url.protocol)) throw new Error(); }
      catch { return setValidationError("Enter a valid image URL, or leave it blank."); }
    }
    setValidationError("");
    await onSave({ name: form.name.trim(), description: (form.description || "").trim(), price: Number(form.price), category: form.category.trim(), image: (form.image || "").trim(), isAvailable: Boolean(form.isAvailable) });
  };

  return <ManagementModal title={product ? "Edit menu item" : "Add menu item"} subtitle="Keep menu details accurate for students and kitchen staff." onClose={onClose} wide>
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <ManagementField label="Product name"><input autoFocus maxLength={100} required value={form.name} onChange={(event) => setValue("name", event.target.value)} placeholder="e.g. Masala dosa" className={inputClass}/></ManagementField>
        <ManagementField label="Category"><input required maxLength={60} value={form.category} onChange={(event) => setValue("category", event.target.value)} placeholder="e.g. Breakfast" className={inputClass}/></ManagementField>
        <ManagementField label="Price (₹)"><input required type="number" min="0.01" step="0.01" value={form.price} onChange={(event) => setValue("price", event.target.value)} placeholder="0.00" className={inputClass}/></ManagementField>
        <ManagementField label="Image URL (optional)"><input type="url" value={form.image} onChange={(event) => setValue("image", event.target.value)} placeholder="https://…" className={inputClass}/></ManagementField>
      </div>
      <ManagementField label="Description"><textarea rows="3" maxLength={500} value={form.description || ""} onChange={(event) => setValue("description", event.target.value)} placeholder="Short description of the dish" className={`${inputClass} resize-y`}/></ManagementField>
      <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-4 py-3"><span><span className="block text-sm font-semibold text-slate-700">Available to order</span><span className="mt-0.5 block text-xs text-slate-500">Unavailable items stay in your admin list.</span></span><input type="checkbox" checked={Boolean(form.isAvailable)} onChange={(event) => setValue("isAvailable", event.target.checked)} className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"/></label>
      {(validationError || error) && <ManagementNotice>{validationError || error}</ManagementNotice>}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button><button type="submit" disabled={busy} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">{busy ? "Saving…" : product ? "Save changes" : "Create item"}</button></div>
    </form>
  </ManagementModal>;
}

const AdminMenuPage = () => {
  const { user, logout } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [availability, setAvailability] = useState("All items");
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [busyProduct, setBusyProduct] = useState(null);
  const loadVersion = useRef(0);

  const loadProducts = useCallback(async (initial = false) => {
    const version = ++loadVersion.current;
    if (initial) setLoading(true); else setRefreshing(true);
    try {
      const response = await api.get("/menu", { params: { includeUnavailable: "true" } });
      if (version !== loadVersion.current) return;
      setProducts(Array.isArray(response.data?.products) ? response.data.products : []);
      setLoadError("");
    } catch (error) { if (version === loadVersion.current) setLoadError(getManagementError(error, "Menu items could not be loaded.")); }
    finally { if (version === loadVersion.current) { setLoading(false); setRefreshing(false); } }
  }, []);

  useEffect(() => { loadProducts(true); return () => { loadVersion.current += 1; }; }, [loadProducts]);

  const categories = useMemo(() => [...new Set(products.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [products]);
  const visibleProducts = useMemo(() => products.filter((item) => {
    const matchesQuery = `${item.name} ${item.description || ""} ${item.category || ""}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesCategory = category === "All categories" || item.category === category;
    const matchesAvailability = availability === "All items" || (availability === "Available" ? item.isAvailable : !item.isAvailable);
    return matchesQuery && matchesCategory && matchesAvailability;
  }), [products, query, category, availability]);

  const openCreate = () => { setEditing(null); setFormError(""); setFormOpen(true); };
  const openEdit = (product) => { setEditing(product); setFormError(""); setFormOpen(true); };
  const saveProduct = async (payload) => {
    setFormBusy(true); setFormError(""); setNotice("");
    try {
      if (editing) await api.patch(`/menu/${editing._id}`, payload);
      else await api.post("/menu", payload);
      setFormOpen(false); setNotice(editing ? "Menu item updated." : "Menu item created.");
      await loadProducts();
    } catch (error) { setFormError(getManagementError(error, "The menu item could not be saved.")); }
    finally { setFormBusy(false); }
  };

  const toggleAvailability = async (product) => {
    setBusyProduct(product._id); setNotice("");
    try {
      await api.patch(`/menu/${product._id}`, { isAvailable: !product.isAvailable });
      setNotice(`${product.name} is now ${product.isAvailable ? "unavailable" : "available"}.`);
      await loadProducts();
    } catch (error) { setLoadError(getManagementError(error, "Availability could not be updated.")); }
    finally { setBusyProduct(null); }
  };

  const deleteProduct = async () => {
    setDeleteBusy(true); setDeleteError(""); setNotice("");
    try {
      await api.delete(`/menu/${deleteTarget._id}`);
      const name = deleteTarget.name;
      setDeleteTarget(null); setNotice(`${name} was deleted.`);
      await loadProducts();
    } catch (error) { setDeleteError(getManagementError(error, "The menu item could not be deleted.")); }
    finally { setDeleteBusy(false); }
  };

  return <AdminLayout user={user} onLogout={logout}>
    <div className="mx-auto max-w-[1600px] px-4 pb-12 pt-7 sm:px-7 lg:px-10 lg:pt-9">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-blue-700">Catalog</p><h1 className="mt-1 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">Menu Management</h1><p className="mt-2 text-sm text-slate-500">Create and update the items students can order.</p></div><button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"><span className="text-lg leading-none">+</span> Add menu item</button></div>
      {notice && <div className="mt-5"><ManagementNotice tone="success">{notice}</ManagementNotice></div>}
      {loadError && <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><ManagementNotice>{loadError}</ManagementNotice><button type="button" onClick={() => loadProducts()} className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700">Retry</button></div>}
      <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
        <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_220px_190px_auto] md:items-end">
          <ManagementField label="Search menu"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, category, description" className={inputClass}/></ManagementField>
          <ManagementField label="Category"><select value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass}><option>All categories</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></ManagementField>
          <ManagementField label="Availability"><select value={availability} onChange={(event) => setAvailability(event.target.value)} className={inputClass}><option>All items</option><option>Available</option><option>Unavailable</option></select></ManagementField>
          <button type="button" onClick={() => loadProducts()} disabled={refreshing} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">{refreshing ? "Refreshing…" : "Refresh list"}</button>
        </div>
        <p className="mt-3 text-xs text-slate-500">Showing {visibleProducts.length} of {products.length} menu items</p>
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        {loading ? <div className="p-5"><PageLoading/></div> : visibleProducts.length === 0 ? <div className="px-5 py-14 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-xl text-blue-700">☷</div><h2 className="mt-3 font-bold text-navy">{products.length ? "No matching menu items" : "Your menu is empty"}</h2><p className="mt-1 text-sm text-slate-500">{products.length ? "Adjust the search or filters to see more items." : "Add your first product to start building the canteen menu."}</p>{!products.length && <button type="button" onClick={openCreate} className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">Add menu item</button>}</div> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] border-collapse text-left"><thead className="bg-slate-50"><tr>{["Product", "Category", "Price", "Availability", "Actions"].map((heading) => <th key={heading} className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-slate-500">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{visibleProducts.map((product) => <tr key={product._id} className="align-middle hover:bg-slate-50/60"><td className="px-5 py-4"><div className="flex items-center gap-3"><FoodImage src={product.image} alt="" className="h-12 w-12 shrink-0 rounded-xl" /><div className="max-w-sm"><p className="font-bold text-navy">{product.name}</p><p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{product.description || "No description"}</p></div></div></td><td className="px-5 py-4 text-sm font-medium text-slate-600">{product.category || "—"}</td><td className="px-5 py-4 text-sm font-bold text-navy">{currency(product.price)}</td><td className="px-5 py-4"><StatusBadge tone={product.isAvailable ? "good" : "neutral"}>{product.isAvailable ? "Available" : "Unavailable"}</StatusBadge></td><td className="px-5 py-4"><div className="flex items-center gap-2"><button type="button" onClick={() => openEdit(product)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-white">Edit</button><button type="button" disabled={busyProduct === product._id} onClick={() => toggleAvailability(product)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-white disabled:opacity-50">{busyProduct === product._id ? "Saving…" : product.isAvailable ? "Disable" : "Enable"}</button><button type="button" onClick={() => { setDeleteTarget(product); setDeleteError(""); }} className="rounded-lg px-2.5 py-2 text-xs font-bold text-red-700 hover:bg-red-50">Delete</button></div></td></tr>)}</tbody></table></div>}
      </section>
      {formOpen && <ProductForm product={editing} busy={formBusy} error={formError} onClose={() => setFormOpen(false)} onSave={saveProduct}/>}
      {deleteTarget && <ConfirmDialog title="Delete menu item?" message={<>{deleteTarget.name} will be removed from the menu. Students will no longer be able to order it. This action cannot be undone.</>} busy={deleteBusy} error={deleteError} onConfirm={deleteProduct} onCancel={() => { if (!deleteBusy) setDeleteTarget(null); }}/>}
    </div>
  </AdminLayout>;
};

export default AdminMenuPage;
