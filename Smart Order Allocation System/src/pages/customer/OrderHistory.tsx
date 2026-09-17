import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import StatusBadge from "../../components/StatusBadge";
import type { Order } from "../../lib/types";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  function loadOrders() {
    setLoading(true);
    api.orders.list({ search, status: statusFilter !== "all" ? statusFilter : undefined })
      .then((res) => {
        if (res.success && res.orders) {
          setOrders(res.orders);
        }
      })
      .catch((err) => console.error("Error loading orders:", err))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

  async function handleCancel(orderId: string) {
    if (!confirm("Are you sure you want to cancel this order? Reserved stock will be returned to the branch.")) {
      return;
    }

    setCancellingId(orderId);
    try {
      const res = await api.orders.cancel(orderId);
      if (res.success) {
        loadOrders();
      }
    } catch (err: any) {
      alert(err.message || "Failed to cancel order.");
    } finally {
      setCancellingId(null);
    }
  }

  const filtered = orders.filter((o) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      o.id.toLowerCase().includes(term) ||
      o.items.some((i) => i.productName.toLowerCase().includes(term))
    );
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>My Orders</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          Real-time order tracking, branch allocation reasoning, and cancellation management.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2.5 mb-5">
        <input
          type="search"
          placeholder="Search by order ID or product name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 text-sm rounded-md border outline-none flex-1 min-w-0"
          style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
        />
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 sm:flex-initial px-3 py-2 text-sm rounded-md border outline-none cursor-pointer"
            style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            <option value="all">All Statuses</option>
            <option value="allocated">Allocated</option>
            <option value="preparing">Preparing</option>
            <option value="out_for_delivery">Out for Delivery</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button
            onClick={loadOrders}
            className="px-3 py-2 text-xs rounded-md border font-medium cursor-pointer shrink-0"
            style={{ borderColor: "var(--border)", color: "var(--foreground)", background: "var(--card)" }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="p-12 text-center text-sm text-muted-foreground">Loading orders from backend...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border p-8 text-center" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No orders found matching your criteria.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const isExp = expanded === order.id;
            const canCancel = ["pending", "allocated", "preparing"].includes(order.status);

            return (
              <div
                key={order.id}
                className="rounded-lg border transition-colors"
                style={{ background: "var(--card)", borderColor: "var(--border)" }}
              >
                {/* Header */}
                <div
                  onClick={() => setExpanded(isExp ? null : order.id)}
                  className="p-4 flex items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                      {order.id}
                    </span>
                    <StatusBadge status={order.status} />
                    {order.allocationScore !== null && (
                      <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/50 text-emerald-400 border border-emerald-800">
                        Score: {order.allocationScore}/100
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="font-mono text-sm font-semibold" style={{ color: "var(--primary)" }}>
                      LKR {order.total.toFixed(2)}
                    </span>
                    <span className="text-xs hidden sm:inline" style={{ color: "var(--muted-foreground)" }}>
                      {timeAgo(order.createdAt)}
                    </span>
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {isExp ? "▲" : "▼"}
                    </span>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExp && (
                  <div className="px-4 pb-4 pt-1 border-t text-xs space-y-3" style={{ borderColor: "var(--border)" }}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div>
                        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                          Delivery Destination
                        </div>
                        <div style={{ color: "var(--foreground)" }}>{order.customerLocation?.city}</div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                          Allocated Fulfillment Branch
                        </div>
                        <div style={{ color: "var(--foreground)" }}>
                          {order.allocatedBranchName || (order.allocatedBranchId ? order.allocatedBranchId : "None (Unallocated)")}
                        </div>
                      </div>
                    </div>

                    {/* Rationale & Breakdown */}
                    {order.allocationReason && (
                      <div className="p-3 rounded-md bg-black/10 dark:bg-white/5 space-y-1">
                        <div className="font-semibold text-muted-foreground">Allocation Engine Rationale:</div>
                        <div style={{ color: "var(--foreground)" }}>{order.allocationReason}</div>
                      </div>
                    )}

                    {/* Customer Note & AI Category */}
                    {order.customerNote && (
                      <div className="p-2.5 rounded-md border flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
                        <div>
                          <span className="text-muted-foreground">Note: </span>
                          <span style={{ color: "var(--foreground)" }}>"{order.customerNote}"</span>
                        </div>
                        {order.aiCategory && (
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-purple-950/60 text-purple-300">
                            🤖 AI Tag: {order.aiCategory} ({Math.round((order.aiConfidence || 0) * 100)}%)
                          </span>
                        )}
                      </div>
                    )}

                    {/* Items List */}
                    <div>
                      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        Items Ordered
                      </div>
                      <div className="space-y-1">
                        {order.items.map((i, idx) => (
                          <div key={idx} className="flex justify-between py-1 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                            <span style={{ color: "var(--foreground)" }}>{i.quantity}x {i.productName}</span>
                            <span className="font-mono" style={{ color: "var(--muted-foreground)" }}>
                              LKR {(i.quantity * i.unitPrice).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Cancellation Action */}
                    {canCancel && (
                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={() => handleCancel(order.id)}
                          disabled={cancellingId === order.id}
                          className="px-3 py-1.5 rounded text-xs font-medium text-red-400 border border-red-800 hover:bg-red-950/30 cursor-pointer disabled:opacity-40"
                        >
                          {cancellingId === order.id ? "Cancelling..." : "Cancel Order (Restores Stock)"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
