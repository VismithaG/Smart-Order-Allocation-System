import type { OrderStatus } from "../lib/types";

const STATUS_CONFIG: Record<OrderStatus, { label: string; bg: string; color: string }> = {
  pending: { label: "Pending", bg: "#2d2d1a", color: "#d4a017" },
  allocated: { label: "Allocated", bg: "#1a2d3d", color: "#4db8ff" },
  preparing: { label: "Preparing", bg: "#1a2d2d", color: "#34d399" },
  out_for_delivery: { label: "Out for Delivery", bg: "#2d1a2d", color: "#c084fc" },
  delivered: { label: "Delivered", bg: "#1a2d1a", color: "#4ade80" },
  cancelled: { label: "Cancelled", bg: "#2d1a1a", color: "#f87171" },
};

export default function StatusBadge({ status }: { status: OrderStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-medium"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  );
}
