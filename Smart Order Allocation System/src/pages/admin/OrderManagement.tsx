import { useEffect, useState } from "react";
import { getBranches, getOrders, updateOrder, updateBranch } from "../../lib/store";
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
  const [reassigning, setReassigning] = useState<string | null>(null);
  const [reassignBranch, setReassignBranch] = useState("");

  function refresh() {
    setOrders(getOrders());
    setBranches(getBranches());
  }

  useEffect(() => { refresh(); }, []);

  const filtered = orders.filter((o) => {
    const matchSearch =
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      o.customerName.toLowerCase().includes(search.toLowerCase()) ||
      o.items.some((i) => i.productName.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    const matchBranch = branchFilter === "all" || o.allocatedBranchId === branchFilter;
    return matchSearch && matchStatus && matchBranch;
  });

  function advanceStatus(order: Order) {
    const idx = STATUS_FLOW.indexOf(order.status as OrderStatus);
    if (idx === -1 || idx === STATUS_FLOW.length - 1) return;
    updateOrder(order.id, { status: STATUS_FLOW[idx + 1] });
    if (STATUS_FLOW[idx + 1] === "delivered" && order.allocatedBranchId) {
      const branch = branches.find((b) => b.id === order.allocatedBranchId);
      if (branch) updateBranch(branch.id, { activeOrders: Math.max(0, branch.activeOrders - 1) });
    }
    refresh();
  }

  function cancelOrder(order: Order) {
    updateOrder(order.id, { status: "cancelled" });
    if (order.allocatedBranchId) {
      const branch = branches.find((b) => b.id === order.allocatedBranchId);
      if (branch) updateBranch(branch.id, { activeOrders: Math.max(0, branch.activeOrders - 1) });
    }
    refresh();
  }

  function doReassign(order: Order) {
    if (!reassignBranch) return;
    const oldBranch = branches.find((b) => b.id === order.allocatedBranchId);
    const newBranch = branches.find((b) => b.id === reassignBranch);
    if (oldBranch) updateBranch(oldBranch.id, { activeOrders: Math.max(0, oldBranch.activeOrders - 1) });
    if (newBranch) updateBranch(newBranch.id, { activeOrders: newBranch.activeOrders + 1 });
    updateOrder(order.id, {
      allocatedBranchId: reassignBranch,
      allocationReason: `Manually reassigned to ${newBranch?.name ?? reassignBranch} by admin.`,
    });
    setReassigning(null);
    refresh();
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>Order Management</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>Search, filter, and manage all customer orders.</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <input
          type="search"
          placeholder="Search orders, customers, items…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-md border outline-none flex-1 min-w-48"
          style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-md border outline-none"
          style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <option value="all">All statuses</option>
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
          className="px-3 py-1.5 text-sm rounded-md border outline-none"
          style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <option value="all">All branches</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--muted)" }}>
              {["Order ID", "Customer", "Items", "Branch", "Total", "Status", "Created", "Actions"].map((h) => (
                <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((order, i) => {
              const branch = branches.find((b) => b.id === order.allocatedBranchId);
              const canAdvance = STATUS_FLOW.includes(order.status as OrderStatus) && order.status !== "delivered" && order.status !== "cancelled";
              const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(order.status as OrderStatus) + 1];

              return (
                <tr
                  key={order.id}
                  style={{ background: i % 2 === 0 ? "var(--card)" : "var(--muted)", borderTop: "1px solid var(--border)" }}
                >
                  <td className="px-3 py-2.5 font-mono text-xs" style={{ color: "var(--muted-foreground)" }}>{order.id}</td>
                  <td className="px-3 py-2.5" style={{ color: "var(--foreground)" }}>
                    <div>{order.customerName}</div>
                    <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{order.customerLocation.city}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs max-w-36" style={{ color: "var(--muted-foreground)" }}>
                    {order.items.map((it) => `${it.productName} ×${it.quantity}`).join(", ")}
                  </td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: "var(--foreground)" }}>
                    {branch ? branch.name : <span style={{ color: "var(--muted-foreground)" }}>—</span>}
                    {order.allocationScore && (
                      <div className="font-mono text-[10px]" style={{ color: "var(--primary)" }}>Score {order.allocationScore}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs font-semibold" style={{ color: "var(--primary)" }}>
                    LKR {order.total.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5"><StatusBadge status={order.status} /></td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{timeAgo(order.createdAt)}</td>
                  <td className="px-3 py-2.5">
                    {reassigning === order.id ? (
                      <div className="flex items-center gap-1.5">
                        <select
                          value={reassignBranch}
                          onChange={(e) => setReassignBranch(e.target.value)}
                          className="text-xs px-1.5 py-1 rounded border outline-none"
                          style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
                        >
                          <option value="">Select…</option>
                          {branches.filter((b) => b.isOpen && b.id !== order.allocatedBranchId).map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                        <button onClick={() => doReassign(order)} disabled={!reassignBranch} className="text-[10px] px-2 py-1 rounded font-semibold" style={{ background: "var(--primary)", color: "var(--primary-foreground)", opacity: reassignBranch ? 1 : 0.5 }}>Go</button>
                        <button onClick={() => setReassigning(null)} className="text-[10px] px-2 py-1 rounded border" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>✕</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {canAdvance && (
                          <button
                            onClick={() => advanceStatus(order)}
                            className="text-[10px] px-2 py-1 rounded border whitespace-nowrap"
                            style={{ borderColor: "var(--primary)", color: "var(--primary)" }}
                          >
                            → {nextStatus?.replace(/_/g, " ")}
                          </button>
                        )}
                        {order.status !== "cancelled" && order.status !== "delivered" && order.allocatedBranchId && (
                          <button
                            onClick={() => { setReassigning(order.id); setReassignBranch(""); }}
                            className="text-[10px] px-2 py-1 rounded border"
                            style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                          >
                            Reassign
                          </button>
                        )}
                        {order.status !== "cancelled" && order.status !== "delivered" && (
                          <button
                            onClick={() => cancelOrder(order)}
                            className="text-[10px] px-2 py-1 rounded border"
                            style={{ borderColor: "#f87171", color: "#f87171" }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-sm" style={{ color: "var(--muted-foreground)" }}>No orders match your filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
        Showing {filtered.length} of {orders.length} orders
      </div>
    </div>
  );
}
