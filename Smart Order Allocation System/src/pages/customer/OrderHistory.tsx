import { useState, useEffect } from "react";
import { getOrders } from "../../lib/store";
import { getSession } from "../../lib/auth";
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
  const session = getSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const all = getOrders();
    const mine = session?.user.role === "admin" ? all : all.filter((o) => o.customerId === session?.user.id);
    setOrders(mine);
  }, []);

  const filtered = orders.filter((o) => {
    const matchSearch =
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      o.items.some((i) => i.productName.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>My Orders</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>Your order history and real-time status.</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <input
          type="search"
          placeholder="Search by order ID or item…"
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
      </div>

      {/* Orders */}
      {filtered.length === 0 ? (
        <div className="text-center py-16" style={{ color: "var(--muted-foreground)" }}>
          <div className="text-3xl mb-2">📦</div>
          <div className="text-sm">No orders found</div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((order) => {
            const isExpanded = expanded === order.id;
            return (
              <div key={order.id} className="rounded-lg border overflow-hidden transition-all" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                <button
                  className="w-full flex items-center gap-4 px-4 py-3 text-left"
                  onClick={() => setExpanded(isExpanded ? null : order.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-mono" style={{ color: "var(--muted-foreground)" }}>{order.id}</span>
                      <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>·</span>
                      <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{timeAgo(order.createdAt)}</span>
                    </div>
                    <div className="text-sm truncate" style={{ color: "var(--foreground)" }}>
                      {order.items.map((i) => `${i.productName} ×${i.quantity}`).join(", ")}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-sm font-semibold" style={{ color: "var(--primary)" }}>
                      LKR {order.total.toFixed(2)}
                    </span>
                    <StatusBadge status={order.status} />
                    <svg
                      width="12" height="12" viewBox="0 0 12 12" fill="none"
                      style={{ color: "var(--muted-foreground)", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
                    >
                      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t" style={{ borderColor: "var(--border)" }}>
                    <div className="grid grid-cols-2 gap-4 mt-3 text-xs">
                      <div>
                        <div className="font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>Items</div>
                        {order.items.map((item) => (
                          <div key={item.productId} className="flex justify-between py-0.5">
                            <span style={{ color: "var(--foreground)" }}>{item.productName} ×{item.quantity}</span>
                            <span className="font-mono" style={{ color: "var(--muted-foreground)" }}>LKR {(item.quantity * item.unitPrice).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div className="font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>Allocation</div>
                        {order.allocatedBranchId ? (
                          <>
                            <div className="mb-0.5" style={{ color: "var(--foreground)" }}>
                              Branch assigned
                            </div>
                            <div style={{ color: "var(--muted-foreground)" }}>Score: <span className="font-mono" style={{ color: "var(--primary)" }}>{order.allocationScore}/100</span></div>
                            <div className="mt-1" style={{ color: "var(--muted-foreground)" }}>{order.allocationReason}</div>
                          </>
                        ) : (
                          <div style={{ color: "#f87171" }}>Unallocated — {order.allocationReason}</div>
                        )}
                      </div>
                    </div>
                    {order.note && (
                      <div className="mt-3 text-xs p-2 rounded" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                        <span className="font-medium" style={{ color: "var(--foreground)" }}>Note: </span>{order.note}
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
