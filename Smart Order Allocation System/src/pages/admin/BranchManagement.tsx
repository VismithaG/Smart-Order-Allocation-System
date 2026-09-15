import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { Branch } from "../../lib/types";

export default function BranchManagement() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [editingStock, setEditingStock] = useState<{ [productId: string]: number }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function refresh() {
    setLoading(true);
    api.branches.list()
      .then((res) => {
        if (res.success && res.branches) {
          setBranches(res.branches);
          if (!selectedBranch && res.branches.length > 0) {
            setSelectedBranch(res.branches[0].id);
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
        refresh();
      }
    } catch (err: any) {
      alert(err.message || "Failed to toggle branch status.");
    }
  }

  async function handleSaveStock(productId: string) {
    if (!selectedBranch) return;
    const newQty = editingStock[productId];
    if (typeof newQty !== "number" || newQty < 0) return;

    setSaving(true);
    setMessage("");
    try {
      const res = await api.branches.updateStock(selectedBranch, productId, newQty);
      if (res.success) {
        setMessage("Stock updated successfully.");
        refresh();
      }
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>Branch & Inventory Management</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
            Control physical store availability, live stock inventories, and maximum order queues.
          </p>
        </div>
        <button
          onClick={refresh}
          className="px-3 py-1.5 text-xs rounded-md border font-medium cursor-pointer"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          ↻ Refresh
        </button>
      </div>

      {loading && !branches.length ? (
        <div className="p-12 text-center text-sm text-muted-foreground">Loading branches...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left col: Branches list */}
          <div className="space-y-3">
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
                      <div className="text-xs text-muted-foreground">{b.city} • Lat: {b.lat.toFixed(2)}, Lng: {b.lng.toFixed(2)}</div>
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
                </div>
              );
            })}
          </div>

          {/* Right 2 cols: Selected Branch Stock Management */}
          <div className="md:col-span-2">
            {activeBranch ? (
              <div className="rounded-lg border p-5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                <div className="flex justify-between items-center mb-4 border-b pb-3" style={{ borderColor: "var(--border)" }}>
                  <div>
                    <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
                      Inventory: {activeBranch.name}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Edit quantities available at this branch. The smart allocation engine checks these values in real time.
                    </p>
                  </div>
                  {message && (
                    <span className={`text-xs ${message.startsWith("Error") ? "text-red-400" : "text-emerald-400"}`}>
                      {message}
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  {activeBranch.stock?.map((item) => {
                    const currentVal = editingStock[item.productId] ?? item.quantity;

                    return (
                      <div
                        key={item.productId}
                        className="flex items-center justify-between py-2 border-b last:border-0 text-sm"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <div>
                          <div className="font-medium" style={{ color: "var(--foreground)" }}>{item.productName}</div>
                          <div className="text-xs text-muted-foreground">ID: {item.productId}</div>
                        </div>

                        <div className="flex items-center gap-2">
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
                            disabled={saving || currentVal === item.quantity}
                            className="px-3 py-1 text-xs rounded font-medium disabled:opacity-30 cursor-pointer text-white"
                            style={{ background: "var(--primary)" }}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    );
                  })}
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
    </div>
  );
}
