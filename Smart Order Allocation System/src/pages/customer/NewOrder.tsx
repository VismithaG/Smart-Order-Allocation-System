import { useState } from "react";
import { PRODUCTS, getBranches, addOrder, updateBranch, generateOrderId } from "../../lib/store";
import { allocateBranch } from "../../lib/allocation";
import { getSession } from "../../lib/auth";
import { navigate } from "../../lib/router";
import type { OrderItem, BranchLocation } from "../../lib/types";

const LOCATIONS: { label: string; location: BranchLocation }[] = [
  { label: "Colombo 3", location: { city: "Colombo 3", lat: 6.898, lng: 79.856 } },
  { label: "Colombo Fort", location: { city: "Colombo Fort", lat: 6.9344, lng: 79.8428 } },
  { label: "Kandy City", location: { city: "Kandy City", lat: 7.2906, lng: 80.6337 } },
  { label: "Galle Town", location: { city: "Galle Town", lat: 6.0535, lng: 80.221 } },
  { label: "Negombo", location: { city: "Negombo", lat: 7.2088, lng: 79.8358 } },
  { label: "Matara", location: { city: "Matara", lat: 5.9549, lng: 80.555 } },
];

export default function NewOrder() {
  const session = getSession();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [locationKey, setLocationKey] = useState(LOCATIONS[0].label);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; orderId?: string; branchName?: string; reason?: string; score?: number } | null>(null);

  const items: OrderItem[] = Object.entries(quantities)
    .filter(([, qty]) => qty > 0)
    .map(([pid, qty]) => {
      const p = PRODUCTS.find((p) => p.id === pid)!;
      return { productId: p.id, productName: p.name, quantity: qty, unitPrice: p.price };
    });

  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  function setQty(pid: string, val: number) {
    setQuantities((prev) => ({ ...prev, [pid]: Math.max(0, val) }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) return;
    setSubmitting(true);

    setTimeout(() => {
      const loc = LOCATIONS.find((l) => l.label === locationKey)!.location;
      const branches = getBranches();
      const allocation = allocateBranch(branches, items, loc);

      const orderId = generateOrderId();
      const now = new Date().toISOString();

      if (!allocation) {
        addOrder({
          id: orderId,
          customerId: session?.user.id ?? "guest",
          customerName: session?.user.name ?? "Guest",
          customerLocation: loc,
          items,
          total,
          status: "cancelled",
          allocatedBranchId: null,
          allocationScore: null,
          allocationReason: "No branch had sufficient stock to fulfil this order.",
          createdAt: now,
          updatedAt: now,
          note,
        });
        setResult({ success: false, reason: "No branch could fulfil your order — all nearby branches are out of stock or closed." });
      } else {
        addOrder({
          id: orderId,
          customerId: session?.user.id ?? "guest",
          customerName: session?.user.name ?? "Guest",
          customerLocation: loc,
          items,
          total,
          status: "allocated",
          allocatedBranchId: allocation.branchId,
          allocationScore: allocation.score,
          allocationReason: allocation.reason,
          createdAt: now,
          updatedAt: now,
          note,
        });
        updateBranch(allocation.branchId, {
          activeOrders: (branches.find((b) => b.id === allocation.branchId)?.activeOrders ?? 0) + 1,
        });
        setResult({ success: true, orderId, branchName: allocation.branchName, reason: allocation.reason, score: allocation.score });
      }
      setSubmitting(false);
    }, 600);
  }

  if (result) {
    return (
      <div className="p-8 max-w-lg mx-auto">
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--card)", borderColor: result.success ? "var(--primary)" : "#ef4444" }}>
          <div className="text-4xl mb-3">{result.success ? "✓" : "✗"}</div>
          <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--foreground)" }}>
            {result.success ? "Order Placed!" : "Order Failed"}
          </h2>
          {result.success ? (
            <>
              <p className="text-sm mb-4" style={{ color: "var(--muted-foreground)" }}>
                Allocated to <strong style={{ color: "var(--foreground)" }}>{result.branchName}</strong>
              </p>
              <div className="text-left rounded-md p-3 mb-4 text-xs space-y-1" style={{ background: "var(--muted)" }}>
                <div className="flex justify-between">
                  <span style={{ color: "var(--muted-foreground)" }}>Order ID</span>
                  <span className="font-mono" style={{ color: "var(--foreground)" }}>{result.orderId}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--muted-foreground)" }}>Allocation Score</span>
                  <span className="font-mono" style={{ color: "var(--primary)" }}>{result.score}/100</span>
                </div>
                <div className="pt-1" style={{ color: "var(--muted-foreground)" }}>
                  <span className="font-medium" style={{ color: "var(--foreground)" }}>Reason: </span>
                  {result.reason}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm mb-4" style={{ color: "#f87171" }}>{result.reason}</p>
          )}
          <div className="flex gap-2 justify-center">
            <button onClick={() => navigate("/orders")} className="px-4 py-2 text-sm rounded-md border transition-colors" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
              View Orders
            </button>
            <button onClick={() => { setResult(null); setQuantities({}); setNote(""); }} className="px-4 py-2 text-sm rounded-md font-semibold" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
              New Order
            </button>
          </div>
        </div>
      </div>
    );
  }

  const categories = [...new Set(PRODUCTS.map((p) => p.category))];

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>Place an Order</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          Select items and your delivery location. We will automatically assign the best branch.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Products */}
        {categories.map((cat) => (
          <div key={cat}>
            <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-foreground)" }}>{cat}</div>
            <div className="rounded-lg border divide-y overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              {PRODUCTS.filter((p) => p.category === cat).map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{p.name}</div>
                    <div className="text-xs font-mono" style={{ color: "var(--muted-foreground)" }}>LKR {p.price.toFixed(2)}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => setQty(p.id, (quantities[p.id] ?? 0) - 1)} className="w-6 h-6 rounded flex items-center justify-center text-sm border transition-colors" style={{ borderColor: "var(--border)", color: "var(--foreground)", background: "var(--muted)" }}>−</button>
                    <span className="w-6 text-center text-sm font-mono" style={{ color: "var(--foreground)" }}>{quantities[p.id] ?? 0}</span>
                    <button type="button" onClick={() => setQty(p.id, (quantities[p.id] ?? 0) + 1)} className="w-6 h-6 rounded flex items-center justify-center text-sm border transition-colors" style={{ borderColor: "var(--border)", color: "var(--foreground)", background: "var(--muted)" }}>+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Location */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-foreground)" }}>Delivery Location</label>
          <select
            value={locationKey}
            onChange={(e) => setLocationKey(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-md border outline-none"
            style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            {LOCATIONS.map((l) => (
              <option key={l.label} value={l.label}>{l.label}</option>
            ))}
          </select>
        </div>

        {/* Note */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-foreground)" }}>Order Note (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="e.g. Less sugar, extra pearls..."
            className="w-full px-3 py-2 text-sm rounded-md border outline-none resize-none"
            style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
          />
        </div>

        {/* Summary + Submit */}
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              {items.length === 0 ? "No items selected" : `${items.reduce((s, i) => s + i.quantity, 0)} item(s)`}
            </span>
            <span className="font-mono font-semibold" style={{ color: "var(--primary)" }}>LKR {total.toFixed(2)}</span>
          </div>
          <button
            type="submit"
            disabled={items.length === 0 || submitting}
            className="w-full py-2.5 text-sm font-semibold rounded-md transition-opacity"
            style={{
              background: "var(--primary)",
              color: "var(--primary-foreground)",
              opacity: items.length === 0 || submitting ? 0.5 : 1,
            }}
          >
            {submitting ? "Allocating branch…" : "Place Order"}
          </button>
        </div>
      </form>
    </div>
  );
}
