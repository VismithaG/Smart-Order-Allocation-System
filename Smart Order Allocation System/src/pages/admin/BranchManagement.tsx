import { useEffect, useState } from "react";
import { getBranches, saveBranches, PRODUCTS } from "../../lib/store";
import type { Branch } from "../../lib/types";

export default function BranchManagement() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [stockEdits, setStockEdits] = useState<Record<string, number>>({});

  useEffect(() => {
    setBranches(getBranches());
  }, []);

  function startEdit(branch: Branch) {
    const edits: Record<string, number> = {};
    branch.stock.forEach((s) => { edits[s.productId] = s.quantity; });
    setStockEdits(edits);
    setEditing(branch.id);
  }

  function saveEdit(branchId: string) {
    const updated = branches.map((b) => {
      if (b.id !== branchId) return b;
      return {
        ...b,
        stock: b.stock.map((s) => ({ ...s, quantity: stockEdits[s.productId] ?? s.quantity })),
      };
    });
    setBranches(updated);
    saveBranches(updated);
    setEditing(null);
  }

  function toggleOpen(branchId: string) {
    const updated = branches.map((b) => b.id === branchId ? { ...b, isOpen: !b.isOpen } : b);
    setBranches(updated);
    saveBranches(updated);
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>Branch Management</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>Manage branch stock levels and availability.</p>
      </div>

      <div className="space-y-4">
        {branches.map((branch) => {
          const isEditing = editing === branch.id;
          const capPct = Math.round((branch.activeOrders / branch.maxCapacity) * 100);

          return (
            <div key={branch.id} className="rounded-lg border overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              {/* Header */}
              <div className="flex items-center gap-4 px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium" style={{ color: "var(--foreground)" }}>{branch.name}</span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                      style={{ background: branch.isOpen ? "#1a2d1a" : "#2d1a1a", color: branch.isOpen ? "#4ade80" : "#f87171" }}
                    >
                      {branch.isOpen ? "OPEN" : "CLOSED"}
                    </span>
                  </div>
                  <div className="text-xs mt-0.5 flex items-center gap-3" style={{ color: "var(--muted-foreground)" }}>
                    <span>{branch.location.city}</span>
                    <span>·</span>
                    <span>{branch.activeOrders}/{branch.maxCapacity} active orders ({capPct}%)</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleOpen(branch.id)}
                    className="text-xs px-2.5 py-1 rounded border transition-colors"
                    style={{ borderColor: "var(--border)", color: branch.isOpen ? "#f87171" : "#4ade80", background: "transparent" }}
                  >
                    {branch.isOpen ? "Close" : "Open"} Branch
                  </button>
                  {isEditing ? (
                    <>
                      <button onClick={() => setEditing(null)} className="text-xs px-2.5 py-1 rounded border" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>Cancel</button>
                      <button onClick={() => saveEdit(branch.id)} className="text-xs px-2.5 py-1 rounded font-semibold" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>Save</button>
                    </>
                  ) : (
                    <button onClick={() => startEdit(branch)} className="text-xs px-2.5 py-1 rounded border" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>Edit Stock</button>
                  )}
                </div>
              </div>

              {/* Stock table */}
              <div className="px-4 py-3">
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  {PRODUCTS.map((p) => {
                    const stock = branch.stock.find((s) => s.productId === p.id);
                    const qty = stock?.quantity ?? 0;
                    const editing_qty = stockEdits[p.id] ?? qty;
                    const low = qty < 10;
                    return (
                      <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded" style={{ background: "var(--muted)" }}>
                        <div className="min-w-0 mr-2">
                          <div className="text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>{p.name}</div>
                          {!isEditing && (
                            <div className="text-[10px] font-mono" style={{ color: low ? "#f87171" : "var(--muted-foreground)" }}>
                              {qty} units{low && qty > 0 ? " · low" : qty === 0 ? " · out" : ""}
                            </div>
                          )}
                        </div>
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            value={editing_qty}
                            onChange={(e) => setStockEdits((prev) => ({ ...prev, [p.id]: parseInt(e.target.value) || 0 }))}
                            className="w-14 px-1.5 py-0.5 text-xs font-mono rounded border text-right outline-none"
                            style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
                          />
                        ) : (
                          <span
                            className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded"
                            style={{
                              background: qty === 0 ? "#2d1a1a" : low ? "#2d2d1a" : "#1a2d1a",
                              color: qty === 0 ? "#f87171" : low ? "#d4a017" : "#4ade80",
                            }}
                          >
                            {qty}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
