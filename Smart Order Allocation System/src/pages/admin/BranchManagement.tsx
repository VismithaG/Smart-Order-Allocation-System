import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { Branch } from "../../lib/types";

export default function BranchManagement() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [editingStock, setEditingStock] = useState<{ [productId: string]: number }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);

  // Form states for Branch
  const [formName, setFormName] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formLat, setFormLat] = useState<number | "">(6.9344);
  const [formLng, setFormLng] = useState<number | "">(79.8428);
  const [formCapacity, setFormCapacity] = useState<number | "">(15);
  const [submitting, setSubmitting] = useState(false);

  function showMessage(text: string, type: "success" | "error" = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }

  function refresh() {
    setLoading(true);
    api.branches.list()
      .then((res) => {
        if (res.success && res.branches) {
          setBranches(res.branches);
          if (res.branches.length > 0) {
            // Keep selected if still exists, otherwise default to first
            if (!selectedBranch || !res.branches.find((b) => b.id === selectedBranch)) {
              setSelectedBranch(res.branches[0].id);
            }
          } else {
            setSelectedBranch(null);
          }
        }
      })
      .catch((err) => console.error("Error fetching branches:", err))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
  }, []);

  const activeBranch = branches.find((b) => b.id === selectedBranch);

  async function handleToggleStatus(branchId: string) {
    try {
      const res = await api.branches.toggleStatus(branchId);
      if (res.success) {
        showMessage(res.message);
        refresh();
      }
    } catch (err: any) {
      showMessage(err.message || "Failed to toggle branch status.", "error");
    }
  }

  async function handleSaveStock(productId: string) {
    if (!selectedBranch) return;
    const newQty = editingStock[productId];
    if (typeof newQty !== "number" || newQty < 0) return;

    setSaving(true);
    try {
      const res = await api.branches.updateStock(selectedBranch, productId, newQty);
      if (res.success) {
        showMessage("Stock quantity updated successfully.");
        refresh();
      }
    } catch (err: any) {
      showMessage(err.message || "Failed to update stock", "error");
    } finally {
      setSaving(false);
    }
  }

  function openAddModal() {
    setFormName("");
    setFormCity("");
    setFormLat(6.9271);
    setFormLng(79.8612);
    setFormCapacity(15);
    setShowAddModal(true);
  }

  function openEditModal(b: Branch) {
    setEditingBranch(b);
    setFormName(b.name);
    setFormCity(b.city);
    setFormLat(b.lat);
    setFormLng(b.lng);
    setFormCapacity(b.maxCapacity);
  }

  async function handleCreateBranch(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim() || !formCity.trim() || typeof formLat !== "number" || typeof formLng !== "number") {
      showMessage("Please fill all branch location fields with valid coordinates.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.branches.create({
        name: formName.trim(),
        city: formCity.trim(),
        lat: formLat,
        lng: formLng,
        maxCapacity: typeof formCapacity === "number" && formCapacity > 0 ? formCapacity : 15,
      });
      if (res.success) {
        showMessage(`Branch '${res.branch.name}' created! Stock automatically initialized.`);
        setShowAddModal(false);
        refresh();
      }
    } catch (err: any) {
      showMessage(err.message || "Failed to create branch", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateBranch(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBranch) return;

    setSubmitting(true);
    try {
      const res = await api.branches.update(editingBranch.id, {
        name: formName.trim(),
        city: formCity.trim(),
        lat: typeof formLat === "number" ? formLat : editingBranch.lat,
        lng: typeof formLng === "number" ? formLng : editingBranch.lng,
        maxCapacity: typeof formCapacity === "number" ? formCapacity : editingBranch.maxCapacity,
      });
      if (res.success) {
        showMessage(`Branch '${res.branch.name}' updated successfully.`);
        setEditingBranch(null);
        refresh();
      }
    } catch (err: any) {
      showMessage(err.message || "Failed to update branch", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteBranch() {
    if (!deletingBranch) return;
    setSubmitting(true);
    try {
      const res = await api.branches.delete(deletingBranch.id);
      if (res.success) {
        showMessage(res.message || "Branch location deleted.");
        setDeletingBranch(null);
        refresh();
      }
    } catch (err: any) {
      showMessage(err.message || "Failed to delete branch", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Toast Alert */}
      {message && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-lg shadow-lg border text-sm flex items-center gap-2 transition-all ${
            message.type === "success"
              ? "bg-emerald-950/90 text-emerald-300 border-emerald-800"
              : "bg-rose-950/90 text-rose-300 border-rose-800"
          }`}
        >
          <span>{message.type === "success" ? "✓" : "⚠️"}</span>
          <span>{message.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
            Branch & Location Management
          </h1>
          <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
            Add new locations, update coordinates, toggle store availability, and manage live stock levels.
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
            onClick={openAddModal}
            className="px-4 py-1.5 text-xs rounded-md font-semibold cursor-pointer transition-colors shadow-sm"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            + Add New Location
          </button>
        </div>
      </div>

      {loading && !branches.length ? (
        <div className="p-12 text-center text-xs text-muted-foreground">Loading branches...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left col: Branches list */}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider px-1 text-muted-foreground">
              Branches ({branches.length})
            </div>

            {branches.map((b) => {
              const isSelected = b.id === selectedBranch;
              const pct = Math.round((b.activeOrders / b.maxCapacity) * 100);

              return (
                <div
                  key={b.id}
                  onClick={() => setSelectedBranch(b.id)}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    isSelected ? "ring-2 ring-primary border-transparent" : ""
                  }`}
                  style={{ background: "var(--card)", borderColor: isSelected ? "var(--primary)" : "var(--border)" }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{b.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {b.city} • Lat: {Number(b.lat ?? (b as any).location?.lat ?? 6.9344).toFixed(4)}, Lng: {Number(b.lng ?? (b as any).location?.lng ?? 79.8428).toFixed(4)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleStatus(b.id);
                      }}
                      className="text-[10px] font-mono px-2 py-0.5 rounded cursor-pointer transition-colors"
                      style={{
                        background: b.isOpen ? "#1a2d1a" : "#2d1a1a",
                        color: b.isOpen ? "#4ade80" : "#f87171",
                        border: `1px solid ${b.isOpen ? "#234e23" : "#4e2323"}`,
                      }}
                    >
                      {b.isOpen ? "OPEN" : "CLOSED"}
                    </button>
                  </div>

                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-muted-foreground">Queue Load:</span>
                      <span className="font-mono font-medium" style={{ color: "var(--foreground)" }}>
                        {b.activeOrders} / {b.maxCapacity} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, pct)}%`,
                          background: pct >= 80 ? "#f87171" : pct >= 60 ? "#d4a017" : "#4ade80",
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t flex justify-end gap-2 text-xs" style={{ borderColor: "var(--border)" }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(b);
                      }}
                      className="px-2 py-0.5 rounded text-[11px] border text-muted-foreground hover:text-foreground cursor-pointer"
                      style={{ borderColor: "var(--border)" }}
                    >
                      Edit Details
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingBranch(b);
                      }}
                      className="px-2 py-0.5 rounded text-[11px] border border-rose-800/40 text-rose-400 hover:bg-rose-950/40 cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right 2 cols: Selected Branch Stock Management */}
          <div className="md:col-span-2">
            {activeBranch ? (
              <div className="rounded-lg border p-5 space-y-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b pb-3" style={{ borderColor: "var(--border)" }}>
                  <div>
                    <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
                      Live Inventory: {activeBranch.name}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Coordinates: {Number(activeBranch.lat ?? (activeBranch as any).location?.lat ?? 6.9344).toFixed(4)}, {Number(activeBranch.lng ?? (activeBranch as any).location?.lng ?? 79.8428).toFixed(4)} | Max Capacity: {activeBranch.maxCapacity || 15} orders
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(activeBranch)}
                      className="px-3 py-1 text-xs rounded border text-muted-foreground hover:text-foreground cursor-pointer"
                      style={{ borderColor: "var(--border)" }}
                    >
                      Edit Location Info
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {activeBranch.stock && activeBranch.stock.length > 0 ? (
                    activeBranch.stock.map((item) => {
                      const currentVal = editingStock[item.productId] ?? item.quantity;
                      const hasChanged = currentVal !== item.quantity;

                      return (
                        <div
                          key={item.productId}
                          className="flex items-center justify-between py-2.5 px-3 rounded-md border text-sm"
                          style={{ borderColor: "var(--border)", background: "var(--background)" }}
                        >
                          <div>
                            <div className="font-semibold text-xs" style={{ color: "var(--foreground)" }}>
                              {item.productName}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              ID: {item.productId} {item.price ? `• Rs. ${item.price.toFixed(2)}` : ""}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-muted-foreground">Qty:</span>
                            <input
                              type="number"
                              min="0"
                              value={currentVal}
                              onChange={(e) =>
                                setEditingStock((prev) => ({
                                  ...prev,
                                  [item.productId]: Math.max(0, parseInt(e.target.value) || 0),
                                }))
                              }
                              className="w-20 px-2 py-1 text-xs font-mono rounded border outline-none text-right"
                              style={{ background: "var(--muted)", borderColor: "var(--border)", color: "var(--foreground)" }}
                            />
                            <button
                              onClick={() => handleSaveStock(item.productId)}
                              disabled={saving || !hasChanged}
                              className={`px-3 py-1 text-xs rounded font-medium transition-opacity ${
                                hasChanged
                                  ? "bg-primary text-primary-foreground cursor-pointer shadow-xs"
                                  : "opacity-30 cursor-not-allowed border text-muted-foreground"
                              }`}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-xs text-muted-foreground">
                      No stock records found for this branch. Stock will be automatically seeded when products are added.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground border rounded-lg">
                Select a branch on the left to inspect its live stock.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADD LOCATION MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className="w-full max-w-md p-6 rounded-xl border shadow-2xl space-y-4 animate-in fade-in zoom-in-95"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: "var(--border)" }}>
              <h3 className="font-semibold text-base" style={{ color: "var(--foreground)" }}>Add New Branch Location</h3>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground cursor-pointer text-sm">✕</button>
            </div>

            <form onSubmit={handleCreateBranch} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Branch Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Kurunegala Central Branch"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border outline-none"
                  style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>City</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Kurunegala"
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border outline-none"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Max Capacity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-md border outline-none"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formLat}
                    onChange={(e) => setFormLat(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-md border outline-none"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formLng}
                    onChange={(e) => setFormLng(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-md border outline-none"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
              </div>

              <div className="p-3 rounded-md bg-muted/40 text-[11px] text-muted-foreground">
                ℹ️ Adding this location automatically initializes zero-quantity inventory records for all existing catalog items.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-md border text-muted-foreground hover:text-foreground cursor-pointer"
                  style={{ borderColor: "var(--border)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-md font-semibold cursor-pointer transition-opacity"
                  style={{ background: "var(--primary)", color: "var(--primary-foreground)", opacity: submitting ? 0.6 : 1 }}
                >
                  {submitting ? "Creating..." : "Create Branch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT LOCATION MODAL */}
      {editingBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className="w-full max-w-md p-6 rounded-xl border shadow-2xl space-y-4 animate-in fade-in zoom-in-95"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: "var(--border)" }}>
              <div>
                <h3 className="font-semibold text-base" style={{ color: "var(--foreground)" }}>Edit Branch Details</h3>
                <div className="text-[10px] font-mono text-muted-foreground">{editingBranch.id}</div>
              </div>
              <button onClick={() => setEditingBranch(null)} className="text-muted-foreground hover:text-foreground cursor-pointer text-sm">✕</button>
            </div>

            <form onSubmit={handleUpdateBranch} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Branch Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border outline-none"
                  style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>City</label>
                  <input
                    type="text"
                    required
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border outline-none"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Max Capacity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-md border outline-none"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formLat}
                    onChange={(e) => setFormLat(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-md border outline-none"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formLng}
                    onChange={(e) => setFormLng(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-md border outline-none"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                <button
                  type="button"
                  onClick={() => setEditingBranch(null)}
                  className="px-3 py-1.5 rounded-md border text-muted-foreground hover:text-foreground cursor-pointer"
                  style={{ borderColor: "var(--border)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-md font-semibold cursor-pointer transition-opacity"
                  style={{ background: "var(--primary)", color: "var(--primary-foreground)", opacity: submitting ? 0.6 : 1 }}
                >
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className="w-full max-w-sm p-6 rounded-xl border shadow-2xl space-y-4 animate-in fade-in zoom-in-95"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-rose-950/80 border border-rose-800 text-rose-400 flex items-center justify-center font-bold">
                ⚠️
              </div>
              <div>
                <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>Delete Branch Location</h3>
                <div className="text-[11px] text-muted-foreground">Permanent location removal</div>
              </div>
            </div>

            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              Are you sure you want to delete <strong style={{ color: "var(--foreground)" }}>{deletingBranch.name}</strong>?
              All stock rows associated with this branch will be removed, and historical orders will be unlinked safely.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
              <button
                onClick={() => setDeletingBranch(null)}
                className="px-3 py-1.5 rounded-md border text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                style={{ borderColor: "var(--border)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteBranch}
                disabled={submitting}
                className="px-4 py-1.5 rounded-md text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer transition-opacity"
                style={{ opacity: submitting ? 0.6 : 1 }}
              >
                {submitting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
