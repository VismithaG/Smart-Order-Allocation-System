import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { navigate } from "../../lib/router";
import type { BranchLocation, Product } from "../../lib/types";

const LOCATIONS: { label: string; location: BranchLocation }[] = [
  { label: "Colombo 3 (Kollupitiya)", location: { city: "Colombo 3", lat: 6.898, lng: 79.856 } },
  { label: "Colombo Fort (Downtown)", location: { city: "Colombo Fort", lat: 6.9344, lng: 79.8428 } },
  { label: "Kandy City Center", location: { city: "Kandy City", lat: 7.2906, lng: 80.6337 } },
  { label: "Galle Town & Fort", location: { city: "Galle Town", lat: 6.0535, lng: 80.221 } },
  { label: "Negombo Beach Road", location: { city: "Negombo", lat: 7.2088, lng: 79.8358 } },
  { label: "Matara Town", location: { city: "Matara", lat: 5.9549, lng: 80.555 } },
];

export default function NewOrder() {
  const [products, setProducts] = useState<Product[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [locationKey, setLocationKey] = useState(LOCATIONS[0].label);
  const [note, setNote] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState<{ category: string; confidence: number; lowConfidence: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    success: boolean;
    orderId?: string;
    branchName?: string;
    reason?: string;
    score?: number;
    breakdown?: any;
    aiCategory?: string;
    aiConfidence?: number;
    evaluations?: any[];
  } | null>(null);

  useEffect(() => {
    api.products.list()
      .then((res) => {
        if (res.success && res.products) {
          setProducts(res.products);
        }
      })
      .catch((err) => console.error("Error loading products:", err));
  }, []);

  // Real-time AI classification on order note
  useEffect(() => {
    const trimmed = note.trim();
    if (trimmed.length < 5) {
      setAiAnalysis(null);
      return;
    }

    const timer = setTimeout(() => {
      api.ai.classify(trimmed)
        .then((res) => {
          if (res.success) {
            setAiAnalysis({
              category: res.category,
              confidence: res.confidence,
              lowConfidence: res.lowConfidence,
            });
          }
        })
        .catch(() => {});
    }, 300);

    return () => clearTimeout(timer);
  }, [note]);

  const items = Object.entries(quantities)
    .filter(([, qty]) => qty > 0)
    .map(([pid, qty]) => {
      const p = products.find((prod) => prod.id === pid);
      return {
        productId: pid,
        productName: p?.name || pid,
        quantity: qty,
        unitPrice: p?.price || 0,
      };
    });

  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  function setQty(pid: string, val: number) {
    setQuantities((prev) => ({ ...prev, [pid]: Math.max(0, val) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) return;
    setSubmitting(true);
    setError("");

    try {
      const loc = LOCATIONS.find((l) => l.label === locationKey)!.location;
      const response = await api.orders.create({
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        customerLocation: loc,
        note: note.trim() || undefined,
      });

      if (response.success && response.allocation) {
        setResult({
          success: true,
          orderId: response.order?.id,
          branchName: response.allocation.branchName,
          reason: response.allocation.reason,
          score: response.allocation.score,
          breakdown: response.allocation.breakdown,
          aiCategory: response.order?.aiCategory,
          aiConfidence: response.order?.aiConfidence,
          evaluations: response.evaluations,
        });
      } else {
        setResult({
          success: false,
          orderId: response.order?.id,
          reason: response.message || "All branches are out of stock or at maximum capacity.",
          evaluations: response.evaluations,
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to submit order.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="p-8 max-w-xl mx-auto">
        <div
          className="rounded-lg border p-6 text-center shadow-lg"
          style={{
            background: "var(--card)",
            borderColor: result.success ? "var(--primary)" : "#ef4444",
          }}
        >
          <div className="text-5xl mb-3">{result.success ? "✓" : "✗"}</div>
          <h2 className="text-xl font-semibold mb-1" style={{ color: "var(--foreground)" }}>
            {result.success ? "Order Successfully Routed & Placed!" : "Order Allocation Failed"}
          </h2>
          {result.success ? (
            <>
              <p className="text-sm mb-4" style={{ color: "var(--muted-foreground)" }}>
                Automatically allocated to <strong style={{ color: "var(--foreground)" }}>{result.branchName}</strong>
              </p>
              <div className="text-left rounded-md p-4 mb-4 text-xs space-y-2" style={{ background: "var(--muted)" }}>
                <div className="flex justify-between border-b pb-1.5" style={{ borderColor: "var(--border)" }}>
                  <span style={{ color: "var(--muted-foreground)" }}>Order Reference</span>
                  <span className="font-mono font-bold" style={{ color: "var(--foreground)" }}>{result.orderId}</span>
                </div>
                <div className="flex justify-between border-b pb-1.5" style={{ borderColor: "var(--border)" }}>
                  <span style={{ color: "var(--muted-foreground)" }}>Composite Allocation Score</span>
                  <span className="font-mono font-bold text-sm" style={{ color: "var(--primary)" }}>{result.score}/100</span>
                </div>
                {result.breakdown && (
                  <div className="grid grid-cols-3 gap-2 py-1 text-center font-mono">
                    <div className="p-1.5 rounded bg-black/10 dark:bg-white/5">
                      <div className="text-[10px] text-muted-foreground">Stock Match</div>
                      <div className="font-bold text-emerald-500">{result.breakdown.stockScore}%</div>
                    </div>
                    <div className="p-1.5 rounded bg-black/10 dark:bg-white/5">
                      <div className="text-[10px] text-muted-foreground">Proximity</div>
                      <div className="font-bold text-blue-500">{result.breakdown.proximityScore}% ({result.breakdown.distanceKm} km)</div>
                    </div>
                    <div className="p-1.5 rounded bg-black/10 dark:bg-white/5">
                      <div className="text-[10px] text-muted-foreground">Capacity Load</div>
                      <div className="font-bold text-amber-500">{result.breakdown.capacityUtilization}%</div>
                    </div>
                  </div>
                )}
                <div className="pt-1" style={{ color: "var(--muted-foreground)" }}>
                  <span className="font-medium" style={{ color: "var(--foreground)" }}>Algorithm Rationale: </span>
                  {result.reason}
                </div>
                {result.aiCategory && (
                  <div className="pt-1.5 border-t flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
                    <span style={{ color: "var(--muted-foreground)" }}>AI Triage Classification:</span>
                    <span className="font-medium text-purple-400">
                      {result.aiCategory} ({Math.round((result.aiConfidence || 0) * 100)}% conf)
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-left rounded-md p-3 mb-4 text-xs space-y-1" style={{ background: "var(--muted)" }}>
              <p style={{ color: "#ef4444" }}>{result.reason}</p>
              <p className="text-[11px] text-muted-foreground mt-2">
                The smart allocation engine evaluated all branches and determined that no open branch has enough inventory to fulfill this entire order.
              </p>
            </div>
          )}

          <div className="flex gap-3 justify-center mt-6">
            <button
              onClick={() => {
                setResult(null);
                setQuantities({});
                setNote("");
              }}
              className="px-4 py-2 text-xs rounded-md border font-medium cursor-pointer"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              Place Another Order
            </button>
            <button
              onClick={() => navigate("/orders")}
              className="px-4 py-2 text-xs rounded-md font-medium text-white cursor-pointer"
              style={{ background: "var(--primary)" }}
            >
              Track in Order History →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>Create New Order</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          Select items and delivery location. Our Smart DOM engine will automatically determine the best branch.
        </p>
      </div>

      {error && (
        <div className="p-3 mb-4 rounded-md text-xs text-red-400 bg-red-950/40 border border-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 cols: Products */}
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-lg border p-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>Beverages & Add-ons</h2>
            <div className="space-y-3">
              {products.map((p) => {
                const qty = quantities[p.id] || 0;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div>
                      <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{p.name}</div>
                      <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {p.category} • <span className="font-mono" style={{ color: "var(--primary)" }}>LKR {p.price.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQty(p.id, qty - 1)}
                        disabled={qty === 0}
                        className="w-7 h-7 rounded border flex items-center justify-center text-sm disabled:opacity-30 cursor-pointer"
                        style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                      >
                        -
                      </button>
                      <span className="w-6 text-center text-sm font-mono" style={{ color: "var(--foreground)" }}>
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQty(p.id, qty + 1)}
                        className="w-7 h-7 rounded border flex items-center justify-center text-sm cursor-pointer"
                        style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right col: Delivery Location, AI Note, & Checkout Summary */}
        <div className="space-y-4">
          {/* Location picker */}
          <div className="rounded-lg border p-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <label className="block text-xs font-semibold mb-2" style={{ color: "var(--foreground)" }}>
              Delivery Destination
            </label>
            <select
              value={locationKey}
              onChange={(e) => setLocationKey(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-md border outline-none"
              style={{ background: "var(--muted)", borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              {LOCATIONS.map((loc) => (
                <option key={loc.label} value={loc.label}>{loc.label}</option>
              ))}
            </select>
            <p className="text-[11px] mt-2" style={{ color: "var(--muted-foreground)" }}>
              The engine calculates spherical great-circle distance (Haversine) from this point to each branch.
            </p>
          </div>

          {/* Customer Note & AI Classifier */}
          <div className="rounded-lg border p-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--foreground)" }}>
              Order Note / Special Request
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Please deliver before 5 PM, or I was charged twice earlier."
              rows={2}
              className="w-full px-3 py-2 text-xs rounded-md border outline-none resize-none"
              style={{ background: "var(--muted)", borderColor: "var(--border)", color: "var(--foreground)" }}
            />
            {aiAnalysis && (
              <div className="mt-2 p-2 rounded text-[11px] flex items-center justify-between border" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
                <div>
                  <span className="text-muted-foreground">🤖 AI Triage: </span>
                  <span className="font-semibold text-purple-400">{aiAnalysis.category}</span>
                </div>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-purple-950/60 text-purple-300">
                  {Math.round(aiAnalysis.confidence * 100)}% conf
                </span>
              </div>
            )}
          </div>

          {/* Cart summary */}
          <div className="rounded-lg border p-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <h2 className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--muted-foreground)" }}>
              Order Summary
            </h2>
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No items selected yet.</p>
            ) : (
              <div className="space-y-1.5 mb-3 text-xs">
                {items.map((i) => (
                  <div key={i.productId} className="flex justify-between">
                    <span style={{ color: "var(--muted-foreground)" }}>{i.quantity}x {i.productName}</span>
                    <span className="font-mono" style={{ color: "var(--foreground)" }}>LKR {(i.quantity * i.unitPrice).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t pt-3 flex justify-between items-center mb-4" style={{ borderColor: "var(--border)" }}>
              <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Total Amount</span>
              <span className="text-lg font-bold font-mono" style={{ color: "var(--primary)" }}>LKR {total.toFixed(2)}</span>
            </div>

            <button
              type="submit"
              disabled={items.length === 0 || submitting}
              className="w-full py-2.5 px-4 rounded-md text-sm font-medium text-white disabled:opacity-40 cursor-pointer transition-opacity"
              style={{ background: "var(--primary)" }}
            >
              {submitting ? "Evaluating Branches & Allocating..." : "Auto-Allocate & Place Order"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
