export type Role = "customer" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  location: BranchLocation;
}

export interface BranchLocation {
  city: string;
  lat: number;
  lng: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
}

export interface BranchStock {
  productId: string;
  quantity: number;
}

export interface Branch {
  id: string;
  name: string;
  location: BranchLocation;
  stock: BranchStock[];
  activeOrders: number;
  maxCapacity: number;
  isOpen: boolean;
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
  allocationScore: number | null;
  allocationReason: string | null;
  createdAt: string;
  updatedAt: string;
  note?: string;
}

export interface AllocationResult {
  branchId: string;
  branchName: string;
  score: number;
  reason: string;
  breakdown: {
    stockScore: number;
    proximityScore: number;
    workloadScore: number;
  };
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
}
