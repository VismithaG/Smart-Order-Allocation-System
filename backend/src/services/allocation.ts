import type { AllocationBreakdown, AllocationResult, Branch, BranchLocation, OrderItem } from "../types.js";

/**
 * Calculates Great-Circle Distance between two coordinates using the Haversine formula.
 * @returns Distance in kilometers
 */
export function haversineDistanceKm(a: BranchLocation, b: BranchLocation): number {
  const R = 6371; // Earth's mean radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

export interface BranchEvaluation {
  branchId: string;
  branchName: string;
  isOpen: boolean;
  isEligible: boolean;
  distanceKm: number;
  stockFulfillmentRatio: number;
  missingProducts: string[];
  capacityUtilization: number;
  totalScore: number;
  reason: string;
  breakdown: AllocationBreakdown;
}

/**
 * Multi-Factor Smart Branch Allocation Engine
 * 
 * Weights:
 * - Stock Availability: 45% (Hard constraint: 100% required for auto-dispatch)
 * - Proximity (Distance): 35% (Faster delivery, lower courier cost)
 * - Workload/Capacity: 20% (Kitchen load balancing, preventing order delays)
 */
export function evaluateBranches(
  branches: Branch[],
  items: OrderItem[],
  customerLocation: BranchLocation,
  maxProximityKm = 250
): {
  bestAllocation: AllocationResult | null;
  evaluations: BranchEvaluation[];
} {
  const WEIGHT_STOCK = 0.45;
  const WEIGHT_PROXIMITY = 0.35;
  const WEIGHT_WORKLOAD = 0.20;

  const evaluations: BranchEvaluation[] = branches.map((b) => {
    // 1. Stock Evaluation
    let fullyStockedItems = 0;
    const missing: string[] = [];

    for (const item of items) {
      const stockItem = b.stock?.find((s) => s.productId === item.productId);
      const available = stockItem ? stockItem.quantity : 0;
      if (available >= item.quantity) {
        fullyStockedItems++;
      } else {
        missing.push(
          `${item.productName} (Req: ${item.quantity}, Avail: ${available})`
        );
      }
    }

    const stockRatio = items.length > 0 ? fullyStockedItems / items.length : 0;
    const hasFullStock = stockRatio === 1;

    // 2. Distance & Proximity
    const dist = haversineDistanceKm({ city: b.city, lat: b.lat, lng: b.lng }, customerLocation);
    const proximityScore = Math.max(0, 1 - dist / maxProximityKm);

    // 3. Workload & Capacity
    const capacityRatio = b.maxCapacity > 0 ? b.activeOrders / b.maxCapacity : 1;
    const workloadScore = Math.max(0, 1 - capacityRatio);

    // Eligibility check: Open + Full Stock + Not saturated (activeOrders < maxCapacity)
    const isEligible = b.isOpen && hasFullStock && b.activeOrders < b.maxCapacity;

    // Composite Score
    const rawScore =
      WEIGHT_STOCK * stockRatio +
      WEIGHT_PROXIMITY * proximityScore +
      WEIGHT_WORKLOAD * workloadScore;
    const totalScore = Math.round(rawScore * 100);

    // Human-readable rationale
    const parts: string[] = [];
    if (!b.isOpen) {
      parts.push("Branch is currently closed");
    } else if (!hasFullStock) {
      parts.push(`Insufficient stock for: ${missing.join(", ")}`);
    } else {
      parts.push("Full stock availability");
    }

    parts.push(`${dist.toFixed(1)} km away`);
    const utilPct = Math.round(capacityRatio * 100);
    parts.push(`${utilPct}% capacity used (${b.activeOrders}/${b.maxCapacity})`);

    const reason = parts.join(", ") + ".";

    return {
      branchId: b.id,
      branchName: b.name,
      isOpen: b.isOpen,
      isEligible,
      distanceKm: Math.round(dist * 10) / 10,
      stockFulfillmentRatio: stockRatio,
      missingProducts: missing,
      capacityUtilization: utilPct,
      totalScore,
      reason,
      breakdown: {
        stockScore: Math.round(stockRatio * 100),
        proximityScore: Math.round(proximityScore * 100),
        workloadScore: Math.round(workloadScore * 100),
        distanceKm: Math.round(dist * 10) / 10,
        capacityUtilization: utilPct,
      },
    };
  });

  // Sort eligible branches by totalScore descending
  // Tie-breaker 1: Lower distance
  // Tie-breaker 2: Lower active orders
  const eligibleBranches = evaluations.filter((e) => e.isEligible);
  eligibleBranches.sort((a, b) => {
    if (Math.abs(b.totalScore - a.totalScore) > 1) {
      return b.totalScore - a.totalScore;
    }
    if (Math.abs(a.distanceKm - b.distanceKm) > 1) {
      return a.distanceKm - b.distanceKm; // closer branch wins
    }
    return a.capacityUtilization - b.capacityUtilization; // less loaded branch wins
  });

  let bestAllocation: AllocationResult | null = null;
  if (eligibleBranches.length > 0) {
    const best = eligibleBranches[0];
    bestAllocation = {
      branchId: best.branchId,
      branchName: best.branchName,
      score: best.totalScore,
      reason: best.reason,
      breakdown: best.breakdown,
      eligible: true,
    };
  }

  return { bestAllocation, evaluations };
}
