import type { AllocationResult, Branch, BranchLocation, OrderItem } from "./types";

function haversineKm(a: BranchLocation, b: BranchLocation): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

function stockScore(branch: Branch, items: OrderItem[]): number {
  if (items.length === 0) return 0;
  let fulfilled = 0;
  for (const item of items) {
    const stock = branch.stock.find((s) => s.productId === item.productId);
    if (stock && stock.quantity >= item.quantity) fulfilled++;
  }
  return fulfilled / items.length;
}

function proximityScore(branch: Branch, customerLocation: BranchLocation, maxKm = 300): number {
  const dist = haversineKm(branch.location, customerLocation);
  return Math.max(0, 1 - dist / maxKm);
}

function workloadScore(branch: Branch): number {
  if (!branch.isOpen) return 0;
  const usage = branch.activeOrders / branch.maxCapacity;
  return Math.max(0, 1 - usage);
}

function buildReason(
  branch: Branch,
  ss: number,
  ps: number,
  ws: number,
  distKm: number
): string {
  const parts: string[] = [];
  if (ss === 1) parts.push("full stock availability");
  else if (ss > 0) parts.push(`partial stock (${Math.round(ss * 100)}%)`);
  parts.push(`${Math.round(distKm)} km away`);
  const pct = Math.round((branch.activeOrders / branch.maxCapacity) * 100);
  parts.push(`${pct}% capacity used`);
  return parts.join(", ") + ".";
}

export function allocateBranch(
  branches: Branch[],
  items: OrderItem[],
  customerLocation: BranchLocation
): AllocationResult | null {
  const WEIGHT_STOCK = 0.5;
  const WEIGHT_PROXIMITY = 0.3;
  const WEIGHT_WORKLOAD = 0.2;

  const eligible = branches.filter((b) => {
    if (!b.isOpen) return false;
    const ss = stockScore(b, items);
    return ss > 0;
  });

  if (eligible.length === 0) return null;

  const scored = eligible.map((b) => {
    const ss = stockScore(b, items);
    const ps = proximityScore(b, customerLocation);
    const ws = workloadScore(b);
    const total = WEIGHT_STOCK * ss + WEIGHT_PROXIMITY * ps + WEIGHT_WORKLOAD * ws;
    const dist = haversineKm(b.location, customerLocation);
    return {
      branch: b,
      ss,
      ps,
      ws,
      total,
      dist,
    };
  });

  scored.sort((a, b) => b.total - a.total);
  const best = scored[0];

  return {
    branchId: best.branch.id,
    branchName: best.branch.name,
    score: Math.round(best.total * 100),
    reason: buildReason(best.branch, best.ss, best.ps, best.ws, best.dist),
    breakdown: {
      stockScore: Math.round(best.ss * 100),
      proximityScore: Math.round(best.ps * 100),
      workloadScore: Math.round(best.ws * 100),
    },
  };
}
