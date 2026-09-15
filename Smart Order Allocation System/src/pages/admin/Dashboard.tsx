import { useEffect, useState } from "react";
import { getBranches, getOrders } from "../../lib/store";
import StatusBadge from "../../components/StatusBadge";
import type { Branch, Order } from "../../lib/types";

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border p-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
      <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--muted-foreground)" }}>{label}</div>
      <div className="text-2xl font-semibold font-mono" style={{ color: accent ? "var(--primary)" : "var(--foreground)" }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{sub}</div>}
    </div>
  );
}

function BranchCapBar({ branch }: { branch: Branch }) {
  const pct = Math.round((branch.activeOrders / branch.maxCapacity) * 100);
  const color = pct >= 80 ? "#f87171" : pct >= 60 ? "#d4a017" : "#4ade80";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="flex justify-between text-xs mb-1">
          <span style={{ color: "var(--foreground)" }}>{branch.name}</span>
          <span className="font-mono" style={{ color: "var(--muted-foreground)" }}>{branch.activeOrders}/{branch.maxCapacity}</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>
      <span
        className="text-[10px] px-1.5 py-0.5 rounded font-mono"
        style={{ background: branch.isOpen ? "#1a2d1a" : "#2d1a1a", color: branch.isOpen ? "#4ade80" : "#f87171" }}
      >
        {branch.isOpen ? "OPEN" : "CLOSED"}
      </span>
    </div>
  );
}

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    setOrders(getOrders());
    setBranches(getBranches());
  }, []);

  const active = orders.filter((o) => ["allocated", "preparing", "out_for_delivery"].includes(o.status));
  const today = orders.filter((o) => {
    const d = new Date(o.createdAt);
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth();
  });
  const revenue = orders.filter((o) => o.status === "delivered").reduce((s, o) => s + o.total, 0);
  const avgScore = orders.filter((o) => o.allocationScore !== null);
  const avgAlloc = avgScore.length ? Math.round(avgScore.reduce((s, o) => s + (o.allocationScore ?? 0), 0) / avgScore.length) : 0;

  const recent = [...orders].slice(0, 6);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>Live overview of orders and branch performance.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6 lg:grid-cols-4">
        <StatCard label="Total Orders" value={orders.length} />
        <StatCard label="Active Orders" value={active.length} accent />
        <StatCard label="Today's Orders" value={today.length} sub="since midnight" />
        <StatCard label="Avg Alloc Score" value={`${avgAlloc}/100`} sub="across all orders" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Branch capacity */}
        <div className="rounded-lg border p-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--muted-foreground)" }}>Branch Capacity</div>
          <div className="space-y-3">
            {branches.map((b) => <BranchCapBar key={b.id} branch={b} />)}
          </div>
        </div>

        {/* Recent orders */}
        <div className="rounded-lg border p-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--muted-foreground)" }}>Recent Orders</div>
          <div className="space-y-2">
            {recent.map((o) => (
              <div key={o.id} className="flex items-center gap-3 py-1.5 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono" style={{ color: "var(--muted-foreground)" }}>{o.id}</div>
                  <div className="text-sm truncate" style={{ color: "var(--foreground)" }}>{o.customerName}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-xs" style={{ color: "var(--primary)" }}>LKR {o.total.toFixed(2)}</span>
                  <StatusBadge status={o.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Revenue summary */}
      <div className="mt-5 rounded-lg border p-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--muted-foreground)" }}>Order Status Breakdown</div>
        <div className="flex gap-4 flex-wrap">
          {(["pending", "allocated", "preparing", "out_for_delivery", "delivered", "cancelled"] as const).map((status) => {
            const count = orders.filter((o) => o.status === status).length;
            const pct = orders.length ? Math.round((count / orders.length) * 100) : 0;
            return (
              <div key={status} className="flex items-center gap-2 text-xs">
                <StatusBadge status={status} />
                <span className="font-mono" style={{ color: "var(--muted-foreground)" }}>{count} ({pct}%)</span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex h-2 rounded-full overflow-hidden gap-0.5">
          {(["pending", "allocated", "preparing", "out_for_delivery", "delivered", "cancelled"] as const).map((status) => {
            const count = orders.filter((o) => o.status === status).length;
            const pct = orders.length ? (count / orders.length) * 100 : 0;
            const colors: Record<string, string> = { pending: "#d4a017", allocated: "#4db8ff", preparing: "#34d399", out_for_delivery: "#c084fc", delivered: "#4ade80", cancelled: "#f87171" };
            if (!count) return null;
            return <div key={status} style={{ width: `${pct}%`, background: colors[status] }} />;
          })}
        </div>
        <div className="mt-3 flex justify-between text-xs" style={{ color: "var(--muted-foreground)" }}>
          <span>Total Revenue (Delivered)</span>
          <span className="font-mono font-semibold" style={{ color: "var(--primary)" }}>LKR {revenue.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
