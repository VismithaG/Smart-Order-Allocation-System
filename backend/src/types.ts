export type Role = "customer" | "admin";

export interface BranchLocation {
  city: string;
  lat: number;
  lng: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  city: string;
  lat: number;
  lng: number;
  created_at?: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  image_url?: string;
}

export interface BranchStock {
  productId: string;
  productName?: string;
  quantity: number;
}

export interface Branch {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  activeOrders: number;
  maxCapacity: number;
  isOpen: boolean;
  stock?: BranchStock[];
}

export type OrderStatus =
  | "pending"
  | "allocated"
  | "preparing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal?: number;
}

export interface AllocationBreakdown {
  stockScore: number;
  proximityScore: number;
  workloadScore: number;
  distanceKm: number;
  capacityUtilization: number;
}

export interface AllocationResult {
  branchId: string;
  branchName: string;
  score: number;
  reason: string;
  breakdown: AllocationBreakdown;
  eligible: boolean;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerLocation: BranchLocation;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  allocatedBranchId: string | null;
  allocatedBranchName?: string | null;
  allocationScore: number | null;
  allocationReason: string | null;
  allocationBreakdown?: AllocationBreakdown | null;
  customerNote?: string;
  aiCategory?: string;
  aiConfidence?: number;
  createdAt: string;
  updatedAt: string;
}

export type MessageCategory =
  | "Order Status Inquiry"
  | "Delivery Issue"
  | "Payment Issue"
  | "Account/Login Issue"
  | "Refund/Cancellation"
  | "Promotion/Discount Inquiry"
  | "Product/Stock Inquiry"
  | "General Inquiry";

export interface ClassificationResult {
  category: MessageCategory;
  confidence: number;
  scores: Record<MessageCategory, number>;
  lowConfidence: boolean;
  status: string;
}
