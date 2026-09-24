import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../services/api.js";
import AdminLayout from "../layouts/AdminLayout.jsx";
import { ConfirmDialog, getManagementError, ManagementField, ManagementModal, ManagementNotice, PageLoading, StatusBadge } from "../components/AdminManagement.jsx";

const EMPTY_SUMMARY = { totalItems: 0, lowStockItems: 0, outOfStockItems: 0 };
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-navy outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50";
const stockStatus = (item) => item.quantity === 0 ? { label: "Out of stock", tone: "danger" } : item.isLowStock ? { label: "Low stock", tone: "warning" } : { label: "Normal", tone: "good" };
const quantityLabel = (quantity, unit) => `${Number(quantity).toLocaleString()} ${unit}`;

function InventoryForm({ item, busy, error, onClose, onSave }) {
  const [form, setForm] = useState(() => item ? { name: item.name, unit: item.unit, quantity: String(item.quantity), lowStockThreshold: String(item.lowStockThreshold) } : { name: "", unit: "", quantity: "0", lowStockThreshold: "0" });
  const [validationError, setValidationError] = useState("");
  const setValue = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return setValidationError("Enter an item name.");
    if (!form.unit.trim()) return setValidationError("Enter a unit, such as kg, L, or packs.");
    const quantity = Number(form.quantity);
    const lowStockThreshold = Number(form.lowStockThreshold);
    if (!Number.isFinite(quantity) || quantity < 0) return setValidationError("Quantity must be zero or greater.");
    if (!Number.isFinite(lowStockThreshold) || lowStockThreshold < 0) return setValidationError("Low-stock threshold must be zero or greater.");
    setValidationError("");
    await onSave({ name: form.name.trim(), unit: form.unit.trim(), quantity, lowStockThreshold });
  };

  return <ManagementModal title={item ? "Edit inventory item" : "Add inventory item"} subtitle="Track a supply and set the level that should trigger a low-stock warning." onClose={onClose}>
    <form onSubmit={submit} className="space-y-4">
      <ManagementField label="Item name"><input autoFocus required maxLength={100} value={form.name} onChange={(event) => setValue("name", event.target.value)} placeholder="e.g. Paneer" className={inputClass}/></ManagementField>
      <ManagementField label="Unit"><input required maxLength={30} value={form.unit} onChange={(event) => setValue("unit", event.target.value)} placeholder="e.g. kg, L, packs" className={inputClass}/></ManagementField>
      <div className="grid gap-4 sm:grid-cols-2"><ManagementField label="Current quantity"><input required type="number" min="0" step="any" value={form.quantity} onChange={(event) => setValue("quantity", event.target.value)} className={inputClass}/></ManagementField><ManagementField label="Low-stock threshold"><input required type="number" min="0" step="any" value={form.lowStockThreshold} onChange={(event) => setValue("lowStockThreshold", event.target.value)} className={inputClass}/></ManagementField></div>
      {(validationError || error) && <ManagementNotice>{validationError || error}</ManagementNotice>}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button><button type="submit" disabled={busy} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">{busy ? "Saving…" : item ? "Save changes" : "Create item"}</button></div>
    </form>
  </ManagementModal>;
}

function StockAdjustment({ item, busy, error, onClose, onAdjust }) {
  const [direction, setDirection] = useState("add");
  const [amount, setAmount] = useState("");
  const [validationError, setValidationError] = useState("");
  const submit = (event) => {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return setValidationError("Enter an amount greater than zero.");
    if (direction === "remove" && value > item.quantity) return setValidationError(`Only ${quantityLabel(item.quantity, item.unit)} is currently in stock.`);
    setValidationError("");
    onAdjust(direction === "add" ? value : -value);
  };

  return <ManagementModal title="Adjust stock" subtitle={`${item.name} · current stock ${quantityLabel(item.quantity, item.unit)}`} onClose={onClose}>
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1"><button type="button" aria-pressed={direction === "add"} onClick={() => setDirection("add")} className={`rounded-lg px-3 py-2.5 text-sm font-bold ${direction === "add" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500"}`}>Add stock</button><button type="button" aria-pressed={direction === "remove"} onClick={() => setDirection("remove")} className={`rounded-lg px-3 py-2.5 text-sm font-bold ${direction === "remove" ? "bg-white text-orange-800 shadow-sm" : "text-slate-500"}`}>Remove stock</button></div>
      <ManagementField label={`Amount (${item.unit})`}><input autoFocus type="number" min="0.01" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Enter amount" className={inputClass}/></ManagementField>
      {direction === "remove" && <p className="text-xs text-slate-500">Available to remove: {quantityLabel(item.quantity, item.unit)}</p>}
      {(validationError || error) && <ManagementNotice>{validationError || error}</ManagementNotice>}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button><button type="submit" disabled={busy} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">{busy ? "Updating…" : "Update stock"}</button></div>
    </form>
  </ManagementModal>;
}

function InventoryStat({ label, value, note, color }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-600">{label}</p><span className={`h-2.5 w-2.5 rounded-full ${color}`}/></div><p className="mt-3 text-3xl font-extrabold tracking-tight text-navy">{value}</p><p className="mt-1 text-xs text-slate-500">{note}</p></article>;
}

const AdminInventoryPage = () => {
  const { user, logout } = useAuth();
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [summaryError, setSummaryError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [listError, setListError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All stock");
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [adjusting, setAdjusting] = useState(null);
  const [adjustBusy, setAdjustBusy] = useState(false);
  const [adjustError, setAdjustError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const loadVersion = useRef(0);

  const loadInventory = useCallback(async (initial = false) => {
    const version = ++loadVersion.current;
    if (initial) setLoading(true); else setRefreshing(true);
    const [listResult, summaryResult] = await Promise.allSettled([api.get("/inventory"), api.get("/inventory/summary")]);
    if (version !== loadVersion.current) return;
    if (listResult.status === "fulfilled") {
      setItems(Array.isArray(listResult.value.data?.items) ? listResult.value.data.items : []);
      setListError("");
    } else setListError(getManagementError(listResult.reason, "Inventory items could not be loaded."));
    if (summaryResult.status === "fulfilled") {
      setSummary({ ...EMPTY_SUMMARY, ...(summaryResult.value.data?.summary || {}) });
      setSummaryError("");
    } else setSummaryError(getManagementError(summaryResult.reason, "Inventory summary could not be loaded."));
    setLoading(false); setRefreshing(false);
  }, []);

  useEffect(() => { loadInventory(true); return () => { loadVersion.current += 1; }; }, [loadInventory]);

  const sortedItems = useMemo(() => [...items].sort((a, b) => {
    const priority = (item) => item.quantity === 0 ? 0 : item.isLowStock ? 1 : 2;
    return priority(a) - priority(b) || a.name.localeCompare(b.name);
  }), [items]);
  const visibleItems = sortedItems.filter((item) => {
    const matchesText = `${item.name} ${item.unit}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesStatus = statusFilter === "All stock" || (statusFilter === "Low stock" ? item.isLowStock && item.quantity > 0 : statusFilter === "Out of stock" ? item.quantity === 0 : !item.isLowStock);
    return matchesText && matchesStatus;
  });
  const lowStockItems = sortedItems.filter((item) => item.isLowStock && item.quantity > 0);
  const outOfStockItems = sortedItems.filter((item) => item.quantity === 0);

  const saveItem = async (payload) => {
    setFormBusy(true); setFormError(""); setNotice("");
    try {
      if (editing) await api.patch(`/inventory/${editing.id}`, payload);
      else await api.post("/inventory", payload);
      setFormOpen(false); setNotice(editing ? "Inventory item updated." : "Inventory item created.");
      await loadInventory();
    } catch (error) { setFormError(getManagementError(error, "The inventory item could not be saved.")); }
    finally { setFormBusy(false); }
  };

  const adjustStock = async (change) => {
    setAdjustBusy(true); setAdjustError(""); setNotice("");
    try {
      const response = await api.patch(`/inventory/${adjusting.id}/adjust`, { change });
      const result = response.data?.item;
      setAdjusting(null);
      setNotice(result ? `Stock updated. ${result.name}: ${quantityLabel(result.quantity, result.unit)}.` : "Stock updated.");
      await loadInventory();
    } catch (error) { setAdjustError(getManagementError(error, "Stock could not be adjusted.")); }
    finally { setAdjustBusy(false); }
  };

  const deleteItem = async () => {
    setDeleteBusy(true); setDeleteError(""); setNotice("");
    try {
      await api.delete(`/inventory/${deleteTarget.id}`);
      const name = deleteTarget.name;
      setDeleteTarget(null); setNotice(`${name} was deleted from inventory.`);
      await loadInventory();
    } catch (error) { setDeleteError(getManagementError(error, "The inventory item could not be deleted.")); }
    finally { setDeleteBusy(false); }
  };

  return <AdminLayout user={user} onLogout={logout}>
    <div className="mx-auto max-w-[1600px] px-4 pb-12 pt-7 sm:px-7 lg:px-10 lg:pt-9">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-blue-700">Supplies</p><h1 className="mt-1 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">Inventory Management</h1><p className="mt-2 text-sm text-slate-500">Keep ingredient quantities and reorder thresholds up to date.</p></div><button type="button" onClick={() => { setEditing(null); setFormError(""); setFormOpen(true); }} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"><span className="text-lg leading-none">+</span> Add inventory item</button></div>
      {notice && <div className="mt-5"><ManagementNotice tone="success">{notice}</ManagementNotice></div>}
      {listError && <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><ManagementNotice>{listError}</ManagementNotice><button type="button" onClick={() => loadInventory()} className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700">Retry</button></div>}
      {summaryError && <div className="mt-5"><ManagementNotice>{summaryError}</ManagementNotice></div>}

      <section aria-label="Inventory summary" className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3"><InventoryStat label="Total inventory items" value={loading || summaryError ? "—" : summary.totalItems} note="Tracked records" color="bg-blue-500"/><InventoryStat label="Low stock" value={loading || summaryError ? "—" : summary.lowStockItems} note="At or below threshold, with stock remaining" color="bg-orange-500"/><InventoryStat label="Out of stock" value={loading || summaryError ? "—" : summary.outOfStockItems} note="Requires replenishment" color="bg-red-500"/></section>

      <section className="mt-7 rounded-2xl border border-orange-200 bg-orange-50/70 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-orange-800">Stock watch</p><h2 className="mt-1 text-lg font-bold text-navy">Needs attention</h2></div><div className="flex gap-2 text-xs font-bold"><span className="rounded-full bg-orange-100 px-2.5 py-1 text-orange-900">{lowStockItems.length} low</span><span className="rounded-full bg-red-100 px-2.5 py-1 text-red-800">{outOfStockItems.length} out</span></div></div>
        {loading ? <div className="mt-4"><PageLoading rows={2}/></div> : listError ? <p className="mt-3 text-sm text-orange-900">Stock alerts are unavailable until inventory loads.</p> : lowStockItems.length + outOfStockItems.length === 0 ? <p className="mt-3 text-sm text-slate-600">All tracked items are above their low-stock thresholds.</p> : <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{[...outOfStockItems, ...lowStockItems].slice(0, 6).map((item) => <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/80 bg-white px-3.5 py-3"><span className="min-w-0"><span className="block truncate text-sm font-bold text-navy">{item.name}</span><span className="block text-xs text-slate-500">Threshold {quantityLabel(item.lowStockThreshold, item.unit)}</span></span><span className={`shrink-0 text-sm font-extrabold ${item.quantity === 0 ? "text-red-700" : "text-orange-800"}`}>{quantityLabel(item.quantity, item.unit)}</span></li>)}</ul>}
      </section>

      <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
        <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_220px_auto] md:items-end"><ManagementField label="Search inventory"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search item or unit" className={inputClass}/></ManagementField><ManagementField label="Stock status"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass}><option>All stock</option><option>Low stock</option><option>Out of stock</option><option>Normal</option></select></ManagementField><button type="button" onClick={() => loadInventory()} disabled={refreshing} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">{refreshing ? "Refreshing…" : "Refresh list"}</button></div>
        <p className="mt-3 text-xs text-slate-500">Showing {visibleItems.length} of {items.length} inventory items · low and out-of-stock items appear first</p>
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        {loading ? <div className="p-5"><PageLoading/></div> : visibleItems.length === 0 ? <div className="px-5 py-14 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-xl text-blue-700">▤</div><h2 className="mt-3 font-bold text-navy">{items.length ? "No matching inventory items" : "No inventory records yet"}</h2><p className="mt-1 text-sm text-slate-500">{items.length ? "Try another search or stock filter." : "Add ingredients and supplies to start tracking stock."}</p>{!items.length && <button type="button" onClick={() => { setEditing(null); setFormError(""); setFormOpen(true); }} className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">Add inventory item</button>}</div> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] border-collapse text-left"><thead className="bg-slate-50"><tr>{["Item", "Quantity", "Low-stock threshold", "Status", "Actions"].map((heading) => <th key={heading} className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-slate-500">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{visibleItems.map((item) => { const status = stockStatus(item); return <tr key={item.id} className="hover:bg-slate-50/60"><td className="px-5 py-4"><p className="font-bold text-navy">{item.name}</p><p className="mt-0.5 text-xs text-slate-500">Unit: {item.unit}</p></td><td className={`px-5 py-4 text-sm font-extrabold ${item.quantity === 0 ? "text-red-700" : item.isLowStock ? "text-orange-800" : "text-slate-700"}`}>{quantityLabel(item.quantity, item.unit)}</td><td className="px-5 py-4 text-sm text-slate-600">{quantityLabel(item.lowStockThreshold, item.unit)}</td><td className="px-5 py-4"><StatusBadge tone={status.tone}>{status.label}</StatusBadge></td><td className="px-5 py-4"><div className="flex items-center gap-2"><button type="button" onClick={() => { setEditing(item); setFormError(""); setFormOpen(true); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-white">Edit</button><button type="button" onClick={() => { setAdjusting(item); setAdjustError(""); }} className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">Adjust</button><button type="button" onClick={() => { setDeleteTarget(item); setDeleteError(""); }} className="rounded-lg px-2.5 py-2 text-xs font-bold text-red-700 hover:bg-red-50">Delete</button></div></td></tr>; })}</tbody></table></div>}
      </section>
      {formOpen && <InventoryForm item={editing} busy={formBusy} error={formError} onClose={() => setFormOpen(false)} onSave={saveItem}/>}
      {adjusting && <StockAdjustment item={adjusting} busy={adjustBusy} error={adjustError} onClose={() => { if (!adjustBusy) setAdjusting(null); }} onAdjust={adjustStock}/>}
      {deleteTarget && <ConfirmDialog title="Delete inventory item?" message={<>{deleteTarget.name} will be removed from inventory records. This action cannot be undone.</>} busy={deleteBusy} error={deleteError} onConfirm={deleteItem} onCancel={() => { if (!deleteBusy) setDeleteTarget(null); }}/>}
    </div>
  </AdminLayout>;
};

export default AdminInventoryPage;
