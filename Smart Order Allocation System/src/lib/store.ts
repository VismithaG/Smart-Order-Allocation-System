import type { Branch, Order, Product, User } from "./types";

export const PRODUCTS: Product[] = [
  { id: "p1", name: "Classic Milk Tea", category: "Drinks", price: 4.5 },
  { id: "p2", name: "Brown Sugar Milk Tea", category: "Drinks", price: 5.5 },
  { id: "p3", name: "Chocolate Milk Tea", category: "Drinks", price: 5.0 },
  { id: "p4", name: "Mango Fruit Tea", category: "Drinks", price: 5.0 },
  { id: "p5", name: "Taro Milk Tea", category: "Drinks", price: 5.5 },
  { id: "p6", name: "Matcha Latte", category: "Drinks", price: 6.0 },
  { id: "p7", name: "Pearl Add-on", category: "Add-ons", price: 0.75 },
  { id: "p8", name: "Extra Shot", category: "Add-ons", price: 1.0 },
];

export const INITIAL_BRANCHES: Branch[] = [
  {
    id: "b1",
    name: "Colombo Fort Branch",
    location: { city: "Colombo Fort", lat: 6.9344, lng: 79.8428 },
    stock: [
      { productId: "p1", quantity: 42 },
      { productId: "p2", quantity: 28 },
      { productId: "p3", quantity: 35 },
      { productId: "p4", quantity: 20 },
      { productId: "p5", quantity: 18 },
      { productId: "p6", quantity: 15 },
      { productId: "p7", quantity: 60 },
      { productId: "p8", quantity: 50 },
    ],
    activeOrders: 4,
    maxCapacity: 15,
    isOpen: true,
  },
  {
    id: "b2",
    name: "Kandy City Branch",
    location: { city: "Kandy", lat: 7.2906, lng: 80.6337 },
    stock: [
      { productId: "p1", quantity: 30 },
      { productId: "p2", quantity: 5 },
      { productId: "p3", quantity: 22 },
      { productId: "p4", quantity: 14 },
      { productId: "p5", quantity: 0 },
      { productId: "p6", quantity: 8 },
      { productId: "p7", quantity: 40 },
      { productId: "p8", quantity: 30 },
    ],
    activeOrders: 11,
    maxCapacity: 15,
    isOpen: true,
  },
  {
    id: "b3",
    name: "Galle Harbour Branch",
    location: { city: "Galle", lat: 6.0535, lng: 80.221 },
    stock: [
      { productId: "p1", quantity: 55 },
      { productId: "p2", quantity: 40 },
      { productId: "p3", quantity: 38 },
      { productId: "p4", quantity: 32 },
      { productId: "p5", quantity: 25 },
      { productId: "p6", quantity: 20 },
      { productId: "p7", quantity: 70 },
      { productId: "p8", quantity: 60 },
    ],
    activeOrders: 2,
    maxCapacity: 15,
    isOpen: true,
  },
  {
    id: "b4",
    name: "Negombo Beach Branch",
    location: { city: "Negombo", lat: 7.2088, lng: 79.8358 },
    stock: [
      { productId: "p1", quantity: 18 },
      { productId: "p2", quantity: 12 },
      { productId: "p3", quantity: 0 },
      { productId: "p4", quantity: 0 },
      { productId: "p5", quantity: 10 },
      { productId: "p6", quantity: 6 },
      { productId: "p7", quantity: 25 },
      { productId: "p8", quantity: 20 },
    ],
    activeOrders: 8,
    maxCapacity: 12,
    isOpen: false,
  },
];

export const DEMO_USERS: User[] = [
  {
    id: "u1",
    name: "Amal Perera",
    email: "customer@demo.com",
    role: "customer",
    location: { city: "Colombo 3", lat: 6.898, lng: 79.856 },
  },
  {
    id: "u2",
    name: "Admin User",
    email: "admin@demo.com",
    role: "admin",
    location: { city: "Colombo Fort", lat: 6.9344, lng: 79.8428 },
  },
];

const SEED_ORDERS: Order[] = [
  {
    id: "ord-001",
    customerId: "u1",
    customerName: "Amal Perera",
    customerLocation: { city: "Colombo 3", lat: 6.898, lng: 79.856 },
    items: [
      { productId: "p1", productName: "Classic Milk Tea", quantity: 2, unitPrice: 4.5 },
      { productId: "p7", productName: "Pearl Add-on", quantity: 2, unitPrice: 0.75 },
    ],
    total: 10.5,
    status: "delivered",
    allocatedBranchId: "b1",
    allocationScore: 87,
    allocationReason: "Nearest branch with sufficient stock and low workload",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 45 * 60000).toISOString(),
  },
  {
    id: "ord-002",
    customerId: "u1",
    customerName: "Amal Perera",
    customerLocation: { city: "Colombo 3", lat: 6.898, lng: 79.856 },
    items: [
      { productId: "p2", productName: "Brown Sugar Milk Tea", quantity: 1, unitPrice: 5.5 },
      { productId: "p6", productName: "Matcha Latte", quantity: 1, unitPrice: 6.0 },
    ],
    total: 11.5,
    status: "preparing",
    allocatedBranchId: "b1",
    allocationScore: 91,
    allocationReason: "Best stock availability and proximity score",
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    id: "ord-003",
    customerId: "ext-1",
    customerName: "Nimal Silva",
    customerLocation: { city: "Kandy", lat: 7.2906, lng: 80.6337 },
    items: [
      { productId: "p3", productName: "Chocolate Milk Tea", quantity: 3, unitPrice: 5.0 },
    ],
    total: 15.0,
    status: "out_for_delivery",
    allocatedBranchId: "b2",
    allocationScore: 78,
    allocationReason: "Only branch with stock in proximity",
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
  },
  {
    id: "ord-004",
    customerId: "ext-2",
    customerName: "Kamala Fernando",
    customerLocation: { city: "Galle", lat: 6.0535, lng: 80.221 },
    items: [
      { productId: "p4", productName: "Mango Fruit Tea", quantity: 2, unitPrice: 5.0 },
      { productId: "p5", productName: "Taro Milk Tea", quantity: 1, unitPrice: 5.5 },
    ],
    total: 15.5,
    status: "allocated",
    allocatedBranchId: "b3",
    allocationScore: 95,
    allocationReason: "Ideal match — high stock, low workload, closest branch",
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
  {
    id: "ord-005",
    customerId: "ext-3",
    customerName: "Rohan Jayawardena",
    customerLocation: { city: "Negombo", lat: 7.2088, lng: 79.8358 },
    items: [
      { productId: "p1", productName: "Classic Milk Tea", quantity: 4, unitPrice: 4.5 },
    ],
    total: 18.0,
    status: "cancelled",
    allocatedBranchId: null,
    allocationScore: null,
    allocationReason: "All nearby branches out of stock",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const BRANCHES_KEY = "soas_branches";
const ORDERS_KEY = "soas_orders";

function initStore<T>(key: string, defaults: T[]): T[] {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored) as T[];
  } catch {}
  localStorage.setItem(key, JSON.stringify(defaults));
  return defaults;
}

export function getBranches(): Branch[] {
  return initStore<Branch>(BRANCHES_KEY, INITIAL_BRANCHES);
}

export function saveBranches(branches: Branch[]): void {
  localStorage.setItem(BRANCHES_KEY, JSON.stringify(branches));
}

export function getOrders(): Order[] {
  return initStore<Order>(ORDERS_KEY, SEED_ORDERS);
}

export function saveOrders(orders: Order[]): void {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

export function addOrder(order: Order): void {
  const orders = getOrders();
  orders.unshift(order);
  saveOrders(orders);
}

export function updateOrder(orderId: string, patch: Partial<Order>): void {
  const orders = getOrders();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx !== -1) {
    orders[idx] = { ...orders[idx], ...patch, updatedAt: new Date().toISOString() };
    saveOrders(orders);
  }
}

export function updateBranch(branchId: string, patch: Partial<Branch>): void {
  const branches = getBranches();
  const idx = branches.findIndex((b) => b.id === branchId);
  if (idx !== -1) {
    branches[idx] = { ...branches[idx], ...patch };
    saveBranches(branches);
  }
}

export function generateOrderId(): string {
  return `ord-${Date.now().toString(36).toUpperCase()}`;
}
