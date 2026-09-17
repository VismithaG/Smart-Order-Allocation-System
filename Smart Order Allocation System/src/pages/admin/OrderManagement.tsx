import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import StatusBadge from "../../components/StatusBadge";
import type { Branch, Order, OrderStatus } from "../../lib/types";

const STATUS_FLOW: OrderStatus[] = ["pending", "allocated", "preparing", "out_for_delivery", "delivered"];

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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [reassigningOrder, setReassigningOrder] = useState<Order | null>(null);
  const [targetBranchId, setTargetBranchId] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    Promise.all([
      api.orders.list({
        status: statusFilter !== "all" ? statusFilter : undefined,
        branchId: branchFilter !== "all" ? branchFilter : undefined,
        search: search.trim() || undefined,
      }),
      api.branches.list(),
    ])
      .then(([orderRes, branchRes]) => {
        if (orderRes.success && orderRes.orders) setOrders(orderRes.orders);
        if (branchRes.success && branchRes.branches) setBranches(branchRes.branches);
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
        refresh();
      }
    } catch (err: any) {
      alert(err.message || "Failed to update status.");
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
        refresh();
      }
    } catch (err: any) {
      alert(err.message || "Failed to cancel order.");
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
        setReassigningOrder(null);
        refresh();
      }
    } catch (err: any) {
      alert(err.message || "Failed to reassign branch.");
    } finally {
      setActionInProgress(null);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>Order Management & Overrides</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
            Monitor automated allocations, advance order statuses, or manually reassign fulfillment branches.
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

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <input
          type="search"
          placeholder="Search order ID, customer name, note…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && refresh()}
          className="px-3 py-1.5 text-sm rounded-md border outline-none flex-1 min-w-48"
          style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-md border outline-none cursor-pointer"
          style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <option value="all">All Statuses</option>
          <option value="allocated">Allocated</option>
          <option value="preparing">Preparing</option>
          <option value="out_for_delivery">Out for Delivery</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-md border outline-none cursor-pointer"
          style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <option value="all">All Branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <button
          onClick={refresh}
          className="px-3 py-1.5 text-xs rounded-md font-medium text-white cursor-pointer"
          style={{ background: "var(--primary)" }}
        >
          Search
        </button>
      </div>

      {/* Orders Table */}
      {loading && !orders.length ? (
        <div className="p-12 text-center text-sm text-muted-foreground">Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border p-8 text-center" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <p className="text-sm text-muted-foreground">No orders matching the selected filters.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
                  <th className="p-3 font-semibold text-muted-foreground">Order ID</th>
                  <th className="p-3 font-semibold text-muted-foreground">Customer & Dest</th>
                  <th className="p-3 font-semibold text-muted-foreground">Allocated Branch</th>
                  <th className="p-3 font-semibold text-muted-foreground">Score & Rationale</th>
                  <th className="p-3 font-semibold text-muted-foreground">Total</th>
                  <th className="p-3 font-semibold text-muted-foreground">Status</th>
                  <th className="p-3 font-semibold text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                {orders.map((o) => {
                  const canAdvance = STATUS_FLOW.includes(o.status as OrderStatus) && o.status !== "delivered";
                  const canCancel = o.status !== "delivered" && o.status !== "cancelled";

                  return (
                    <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-mono font-medium" style={{ color: "var(--foreground)" }}>
                        {o.id}
                        <div className="text-[10px] text-muted-foreground">{timeAgo(o.createdAt)}</div>
                      </td>

                      <td className="p-3">
                        <div className="font-medium" style={{ color: "var(--foreground)" }}>{o.customerName}</div>
                        <div className="text-muted-foreground">{o.customerLocation?.city}</div>
                        {o.customerNote && (
                          <div className="text-[11px] text-purple-400 mt-0.5 truncate max-w-44">
                            "{o.customerNote}"
                          </div>
                        )}
                      </td>

                      <td className="p-3">
                        <span className="font-medium" style={{ color: "var(--foreground)" }}>
                          {o.allocatedBranchName || (o.allocatedBranchId ? o.allocatedBranchId : "Unallocated")}
                        </span>
                      </td>

                      <td className="p-3 max-w-xs">
                        {o.allocationScore !== null ? (
                          <>
                            <span className="font-mono px-1.5 py-0.5 rounded bg-emerald-950/50 text-emerald-400 font-semibold border border-emerald-800">
                              {o.allocationScore}/100
                            </span>
                            <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                              {o.allocationReason}
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground italic">None</span>
                        )}
                      </td>

                      <td className="p-3 font-mono font-medium" style={{ color: "var(--primary)" }}>
                        LKR {Number(o.total || 0).toFixed(2)}
                      </td>

                      <td className="p-3">
                        <StatusBadge status={o.status} />
                      </td>

                      <td className="p-3 text-right space-x-1.5 shrink-0">
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
                        {o.status !== "delivered" && o.status !== "cancelled" && (
                          <button
                            onClick={() => {
                              setReassigningOrder(o);
                              setTargetBranchId(o.allocatedBranchId || branches[0]?.id || "");
                            }}
                            className="px-2 py-1 text-[11px] rounded border font-medium cursor-pointer"
                            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                          >
                            Reassign
                          </button>
                        )}
                        {canCancel && (
                          <button
                            onClick={() => handleCancelOrder(o)}
                            disabled={actionInProgress === o.id}
                            className="px-2 py-1 text-[11px] rounded border border-red-800 text-red-400 hover:bg-red-950/30 cursor-pointer disabled:opacity-40"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Reassign Modal */}
      {reassigningOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div
            className="w-full max-w-md rounded-lg border p-6 space-y-4"
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
                className="w-full px-3 py-2 text-xs rounded-md border outline-none"
                style={{ background: "var(--muted)", borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.city}) • Queue: {b.activeOrders}/{b.maxCapacity} {b.isOpen ? "• OPEN" : "• CLOSED"}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
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
