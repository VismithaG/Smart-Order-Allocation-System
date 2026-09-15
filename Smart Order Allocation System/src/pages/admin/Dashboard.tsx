import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import StatusBadge from "../../components/StatusBadge";

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border p-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
      <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--muted-foreground)" }}>
        {label}
      </div>
      <div className="text-2xl font-semibold font-mono" style={{ color: accent ? "var(--primary)" : "var(--foreground)" }}>
        {value}
      </div>
      {sub && <div className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{sub}</div>}
    </div>
  );
}

function BranchCapBar({ branch }: { branch: any }) {
  const pct = branch.utilizationPercent;
  const color = pct >= 80 ? "#f87171" : pct >= 60 ? "#d4a017" : "#4ade80";

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="flex justify-between text-xs mb-1">
          <span style={{ color: "var(--foreground)" }}>{branch.name}</span>
          <span className="font-mono" style={{ color: "var(--muted-foreground)" }}>
            {branch.activeOrders}/{branch.maxCapacity} ({pct}%)
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
        </div>
      </div>
      <span
        className="text-[10px] px-1.5 py-0.5 rounded font-mono"
        style={{
          background: branch.isOpen ? "#1a2d1a" : "#2d1a1a",
          color: branch.isOpen ? "#4ade80" : "#f87171",
        }}
      >
        {branch.isOpen ? "OPEN" : "CLOSED"}
      </span>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function loadStats() {
    setLoading(true);
    api.dashboard.stats()
      .then((res) => {
        if (res.success) {
          setStats(res.stats);
        }
      })
      .catch((err) => setError(err.message || "Failed to load dashboard metrics."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 10000); // Poll live stats every 10s
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading live dashboard metrics...</div>;
  }

  if (error && !stats) {
    return <div className="p-8 text-center text-sm text-red-400">{error}</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>Live Operations Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
            Centralized Distributed Order Management (DOM) telemetry across all physical branches.
          </p>
        </div>
        <button
          onClick={loadStats}
          className="px-3 py-1.5 text-xs rounded-md border font-medium cursor-pointer"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6 lg:grid-cols-4">
        <StatCard label="Total Orders" value={stats?.totalOrders || 0} />
        <StatCard label="Active Workload" value={stats?.activeOrders || 0} accent sub="In preparation or delivery" />
        <StatCard label="Delivered Revenue" value={`LKR ${(stats?.totalRevenue || 0).toFixed(2)}`} sub={`${stats?.deliveredOrders || 0} orders completed`} />
        <StatCard label="Avg Routing Score" value={`${stats?.avgAllocScore || 0}/100`} sub="Algorithm efficiency" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Branch Workload & Saturation */}
        <div className="rounded-lg border p-5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex justify-between items-center mb-4">
            <div className="text-xs uppercase tracking-widest font-semibold" style={{ color: "var(--muted-foreground)" }}>
              Physical Branch Workload & Capacity
            </div>
            <span className="text-[10px] text-muted-foreground">Threshold: 80% High Load</span>
          </div>
          <div className="space-y-4">
            {stats?.branchCapacity?.map((b: any) => (
              <BranchCapBar key={b.id} branch={b} />
            ))}
          </div>
        </div>

        {/* Live Orders Stream */}
        <div className="rounded-lg border p-5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="text-xs uppercase tracking-widest font-semibold mb-4" style={{ color: "var(--muted-foreground)" }}>
            Recent Orders Stream
          </div>
          <div className="space-y-2">
            {stats?.recentOrders?.map((o: any) => (
              <div
                key={o.id}
                className="flex items-center justify-between py-2 border-b last:border-0 text-xs"
                style={{ borderColor: "var(--border)" }}
              >
                <div>
                  <div className="font-mono font-semibold" style={{ color: "var(--foreground)" }}>{o.id}</div>
                  <div className="text-muted-foreground">{o.customerName} • {o.branchName || "Unallocated"}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-medium" style={{ color: "var(--primary)" }}>
                    LKR {Number(o.total).toFixed(2)}
                  </span>
                  <StatusBadge status={o.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
