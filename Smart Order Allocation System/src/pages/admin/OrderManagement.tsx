import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import StatusBadge from "../../components/StatusBadge";
import type { Branch, Order, OrderStatus, Product } from "../../lib/types";

const STATUS_FLOW: OrderStatus[] = ["pending", "allocated", "preparing", "out_for_delivery", "delivered"];
const ALL_STATUSES: OrderStatus[] = ["pending", "allocated", "preparing", "out_for_delivery", "delivered", "cancelled"];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function OrderManagement() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Modals
  const [reassigningOrder, setReassigningOrder] = useState<Order | null>(null);
  const [targetBranchId, setTargetBranchId] = useState("");
  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null);
  const [editingStatusOrder, setEditingStatusOrder] = useState<Order | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>("allocated");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create Order Form State
  const [createCustomerName, setCreateCustomerName] = useState("Amal Perera");
  const [createCity, setCreateCity] = useState("Colombo 3");
  const [createLat, setCreateLat] = useState(6.898);
  const [createLng, setCreateLng] = useState(79.856);
  const [createProductId, setCreateProductId] = useState("");
  const [createQuantity, setCreateQuantity] = useState(1);
  const [createNote, setCreateNote] = useState("");
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null);

  function showToast(text: string, type: "success" | "error" = "success") {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  }

  function refresh() {
    setLoading(true);
    Promise.all([
      api.orders.list({
        status: statusFilter !== "all" ? statusFilter : undefined,
        branchId: branchFilter !== "all" ? branchFilter : undefined,
        search: search.trim() || undefined,
      }),
      api.branches.list(),
      api.products.list(),
    ])
      .then(([orderRes, branchRes, prodRes]) => {
        if (orderRes.success && orderRes.orders) setOrders(orderRes.orders);
        if (branchRes.success && branchRes.branches) setBranches(branchRes.branches);
        if (prodRes.success && prodRes.products) {
          setProducts(prodRes.products);
          if (prodRes.products.length > 0 && !createProductId) {
            setCreateProductId(prodRes.products[0].id);
          }
        }
      })
      .catch((err) => console.error("Error refreshing orders:", err))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
  }, [statusFilter, branchFilter]);

  async function handleAdvanceStatus(order: Order) {
    const idx = STATUS_FLOW.indexOf(order.status as OrderStatus);
    if (idx === -1 || idx === STATUS_FLOW.length - 1) return;

    const nextStatus = STATUS_FLOW[idx + 1];
    setActionInProgress(order.id);
    try {
      const res = await api.orders.updateStatus(order.id, nextStatus);
      if (res.success) {
        showToast(`Order ${order.id} moved to ${nextStatus}`);
        refresh();
      }
    } catch (err: any) {
      showToast(err.message || "Failed to update status.", "error");
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleUpdateStatusDirect() {
    if (!editingStatusOrder) return;
    setActionInProgress(editingStatusOrder.id);
    try {
      const res = await api.orders.updateStatus(editingStatusOrder.id, selectedStatus);
      if (res.success) {
        showToast(`Order ${editingStatusOrder.id} status updated to ${selectedStatus}`);
        setEditingStatusOrder(null);
        refresh();
      }
    } catch (err: any) {
      showToast(err.message || "Failed to update status.", "error");
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleCancelOrder(order: Order) {
    if (!confirm(`Cancel order ${order.id}? Reserved inventory will be returned to branch.`)) {
      return;
    }

    setActionInProgress(order.id);
    try {
      const res = await api.orders.cancel(order.id);
      if (res.success) {
        showToast(`Order ${order.id} cancelled.`);
        refresh();
      }
    } catch (err: any) {
      showToast(err.message || "Failed to cancel order.", "error");
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleDeleteOrder() {
    if (!deletingOrder) return;
    setActionInProgress(deletingOrder.id);
    try {
      const res = await api.orders.delete(deletingOrder.id);
      if (res.success) {
        showToast(`Order ${deletingOrder.id} deleted successfully.`);
        setDeletingOrder(null);
        refresh();
      }
    } catch (err: any) {
      showToast(err.message || "Failed to delete order.", "error");
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleDoReassign() {
    if (!reassigningOrder || !targetBranchId) return;

    setActionInProgress(reassigningOrder.id);
    try {
      const res = await api.orders.reassign(reassigningOrder.id, targetBranchId);
      if (res.success) {
        showToast(`Order reassigned to branch.`);
        setReassigningOrder(null);
        refresh();
      }
    } catch (err: any) {
      showToast(err.message || "Failed to reassign branch.", "error");
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleAdminCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!createProductId || createQuantity < 1) {
      showToast("Please select a product and valid quantity.", "error");
      return;
    }

    setSubmittingCreate(true);
    try {
      const res = await api.orders.create({
        items: [{ productId: createProductId, quantity: Number(createQuantity) }],
        customerLocation: {
          city: createCity.trim(),
          lat: Number(createLat),
          lng: Number(createLng),
        },
        note: createNote.trim(),
      });

      if (res.success) {
        showToast("New order placed & allocated successfully!");
        setShowCreateModal(false);
        refresh();
      }
    } catch (err: any) {
      showToast(err.message || "Failed to create order.", "error");
    } finally {
      setSubmittingCreate(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-lg shadow-lg border text-sm flex items-center gap-2 transition-all ${
            toast.type === "success"
              ? "bg-emerald-950/90 text-emerald-300 border-emerald-800"
              : "bg-rose-950/90 text-rose-300 border-rose-800"
          }`}
        >
          <span>{toast.type === "success" ? "✓" : "⚠️"}</span>
          <span>{toast.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
            Order Management & Supervisory Controls
          </h1>
          <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
            Monitor automated allocations, create orders, advance statuses, or delete orders.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="px-3 py-1.5 text-xs rounded-md border font-medium cursor-pointer transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--foreground)", background: "var(--card)" }}
          >
            ↻ Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-1.5 text-xs rounded-md font-semibold cursor-pointer transition-colors shadow-sm"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            + Create New Order
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <input
          type="search"
          placeholder="Search order ID, customer name, note…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && refresh()}
          className="px-3 py-2 text-xs rounded-md border outline-none flex-1 min-w-0"
          style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
        />
        <div className="flex gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 sm:flex-initial px-3 py-2 text-xs rounded-md border outline-none cursor-pointer"
            style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="allocated">Allocated</option>
            <option value="preparing">Preparing</option>
            <option value="out_for_delivery">Out for Delivery</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="flex-1 sm:flex-initial px-3 py-2 text-xs rounded-md border outline-none cursor-pointer"
            style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            <option value="all">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-8 text-center text-xs text-muted-foreground">Loading orders…</div>
      ) : orders.length === 0 ? (
        <div className="p-8 text-center text-xs text-muted-foreground border rounded-lg" style={{ borderColor: "var(--border)" }}>
          No orders match the selected filters.
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden shadow-xs" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b text-[11px] font-semibold uppercase tracking-wider" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
                  <th className="p-3.5">Order</th>
                  <th className="p-3.5">Customer</th>
                  <th className="p-3.5">Allocated Branch</th>
                  <th className="p-3.5">Routing Score</th>
                  <th className="p-3.5">Total</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                {orders.map((o) => {
                  const canAdvance = STATUS_FLOW.includes(o.status as OrderStatus) && o.status !== "delivered";
                  const canCancel = o.status !== "delivered" && o.status !== "cancelled";

                  return (
                    <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3.5 font-mono font-medium" style={{ color: "var(--foreground)" }}>
                        {o.id}
                        <div className="text-[10px] text-muted-foreground font-sans">{timeAgo(o.createdAt)}</div>
                      </td>

                      <td className="p-3.5">
                        <div className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{o.customerName}</div>
                        <div className="text-[11px] text-muted-foreground">{o.customerLocation?.city}</div>
                        {o.customerNote && (
                          <div className="text-[10px] text-purple-400 mt-0.5 truncate max-w-44 font-mono">
                            "{o.customerNote}"
                          </div>
                        )}
                      </td>

                      <td className="p-3.5">
                        <span className="font-medium" style={{ color: "var(--foreground)" }}>
                          {o.allocatedBranchName || (o.allocatedBranchId ? o.allocatedBranchId : "Unallocated")}
                        </span>
                      </td>

                      <td className="p-3.5 max-w-xs">
                        {o.allocationScore !== null && o.allocationScore !== undefined ? (
                          <>
                            <span className="font-mono px-1.5 py-0.5 rounded bg-emerald-950/50 text-emerald-400 font-semibold border border-emerald-800 text-[11px]">
                              {o.allocationScore}/100
                            </span>
                            <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                              {o.allocationReason}
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground italic text-[11px]">None</span>
                        )}
                      </td>

                      <td className="p-3.5 font-mono font-semibold" style={{ color: "var(--primary)" }}>
                        LKR {Number(o.total || 0).toFixed(2)}
                      </td>

                      <td className="p-3.5">
                        <StatusBadge status={o.status} />
                      </td>

                      <td className="p-3.5 text-right space-x-1.5 shrink-0">
                        {canAdvance && (
                          <button
                            onClick={() => handleAdvanceStatus(o)}
                            disabled={actionInProgress === o.id}
                            className="px-2 py-1 text-[11px] rounded font-medium text-white cursor-pointer disabled:opacity-40"
                            style={{ background: "var(--primary)" }}
                          >
                            Next Step →
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEditingStatusOrder(o);
                            setSelectedStatus(o.status as OrderStatus);
                          }}
                          className="px-2 py-1 text-[11px] rounded border font-medium cursor-pointer hover:bg-muted"
                          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                        >
                          Status
                        </button>
                        {o.status !== "delivered" && o.status !== "cancelled" && (
                          <button
                            onClick={() => {
                              setReassigningOrder(o);
                              setTargetBranchId(o.allocatedBranchId || branches[0]?.id || "");
                            }}
                            className="px-2 py-1 text-[11px] rounded border font-medium cursor-pointer hover:bg-muted"
                            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                          >
                            Reassign
                          </button>
                        )}
                        {canCancel && (
                          <button
                            onClick={() => handleCancelOrder(o)}
                            disabled={actionInProgress === o.id}
                            className="px-2 py-1 text-[11px] rounded border border-amber-800 text-amber-400 hover:bg-amber-950/30 cursor-pointer disabled:opacity-40"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          onClick={() => setDeletingOrder(o)}
                          disabled={actionInProgress === o.id}
                          className="px-2 py-1 text-[11px] rounded border border-rose-800/60 text-rose-400 hover:bg-rose-950/40 cursor-pointer disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE ORDER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div
            className="w-full max-w-md rounded-xl border p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: "var(--border)" }}>
              <h3 className="font-semibold text-base" style={{ color: "var(--foreground)" }}>Place New Order (Admin)</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground cursor-pointer text-sm">✕</button>
            </div>

            <form onSubmit={handleAdminCreateOrder} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Customer Name</label>
                <input
                  type="text"
                  required
                  value={createCustomerName}
                  onChange={(e) => setCreateCustomerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border outline-none"
                  style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>City</label>
                  <input
                    type="text"
                    required
                    value={createCity}
                    onChange={(e) => setCreateCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border outline-none"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Lat</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={createLat}
                    onChange={(e) => setCreateLat(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-md border outline-none"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Lng</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={createLng}
                    onChange={(e) => setCreateLng(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-md border outline-none"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Select Product</label>
                  <select
                    value={createProductId}
                    onChange={(e) => setCreateProductId(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border outline-none cursor-pointer"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} - LKR {p.price}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={createQuantity}
                    onChange={(e) => setCreateQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-md border outline-none"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Customer Note (AI Triaged)</label>
                <input
                  type="text"
                  placeholder="e.g., Please deliver before 5 PM"
                  value={createNote}
                  onChange={(e) => setCreateNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border outline-none"
                  style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded-md border text-muted-foreground hover:text-foreground cursor-pointer"
                  style={{ borderColor: "var(--border)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCreate}
                  className="px-4 py-1.5 rounded-md font-semibold cursor-pointer transition-opacity"
                  style={{ background: "var(--primary)", color: "var(--primary-foreground)", opacity: submittingCreate ? 0.6 : 1 }}
                >
                  {submittingCreate ? "Allocating..." : "Place & Allocate Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STATUS DIRECT MODAL */}
      {editingStatusOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div
            className="w-full max-w-sm rounded-xl border p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex justify-between items-center border-b pb-2" style={{ borderColor: "var(--border)" }}>
              <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>Change Order Status</h3>
              <button onClick={() => setEditingStatusOrder(null)} className="text-muted-foreground hover:text-foreground cursor-pointer text-xs">✕</button>
            </div>

            <p className="text-xs text-muted-foreground">
              Order ID: <strong className="font-mono text-foreground">{editingStatusOrder.id}</strong>
            </p>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--foreground)" }}>Status:</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as OrderStatus)}
                className="w-full px-3 py-2 text-xs rounded-md border outline-none"
                style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
              <button
                onClick={() => setEditingStatusOrder(null)}
                className="px-3 py-1.5 text-xs rounded border cursor-pointer"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateStatusDirect}
                className="px-4 py-1.5 text-xs rounded font-medium text-white cursor-pointer"
                style={{ background: "var(--primary)" }}
              >
                Save Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div
            className="w-full max-w-sm rounded-xl border p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-rose-950/80 border border-rose-800 text-rose-400 flex items-center justify-center font-bold">
                ⚠️
              </div>
              <div>
                <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>Delete Order</h3>
                <div className="text-[10px] font-mono text-muted-foreground">{deletingOrder.id}</div>
              </div>
            </div>

            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              Are you sure you want to permanently delete order <strong className="font-mono text-foreground">{deletingOrder.id}</strong> for <strong className="text-foreground">{deletingOrder.customerName}</strong>?
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
              <button
                onClick={() => setDeletingOrder(null)}
                className="px-3 py-1.5 rounded-md border text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                style={{ borderColor: "var(--border)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteOrder}
                className="px-4 py-1.5 rounded-md text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Reassign Modal */}
      {reassigningOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div
            className="w-full max-w-md rounded-xl border p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
              Manual Branch Reassignment Override
            </h2>
            <p className="text-xs text-muted-foreground">
              Override the smart routing engine for Order <strong className="font-mono">{reassigningOrder.id}</strong>.
              Stock will be returned to the current branch and deducted from the newly selected branch.
            </p>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                Select Target Branch:
              </label>
              <select
                value={targetBranchId}
                onChange={(e) => setTargetBranchId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md border outline-none cursor-pointer"
                style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.city}) • Queue: {b.activeOrders}/{b.maxCapacity} {b.isOpen ? "• OPEN" : "• CLOSED"}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
              <button
                onClick={() => setReassigningOrder(null)}
                className="px-3 py-1.5 text-xs rounded border cursor-pointer"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                Dismiss
              </button>
              <button
                onClick={handleDoReassign}
                className="px-4 py-1.5 text-xs rounded font-medium text-white cursor-pointer"
                style={{ background: "var(--primary)" }}
              >
                Confirm Reassignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
