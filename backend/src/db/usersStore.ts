import bcrypt from "bcryptjs";

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash?: string;
  role: "admin" | "customer";
  city: string;
  lat: number;
  lng: number;
  orderCount: number;
  totalSpent: number;
  createdAt: string;
}

// Pre-hashed passwords for demo accounts (cost factor 10)
const defaultAdminHash = bcrypt.hashSync("admin123", 10);
const defaultCustomerHash = bcrypt.hashSync("customer123", 10);

export let memoryUsers: StoredUser[] = [
  {
    id: "u-admin",
    name: "System Administrator",
    email: "admin@demo.com",
    passwordHash: defaultAdminHash,
    role: "admin",
    city: "Colombo Fort",
    lat: 6.9344,
    lng: 79.8428,
    orderCount: 14,
    totalSpent: 12500.0,
    createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: "u-customer1",
    name: "Amal Perera",
    email: "customer@demo.com",
    passwordHash: defaultCustomerHash,
    role: "customer",
    city: "Colombo 3",
    lat: 6.8980,
    lng: 79.8560,
    orderCount: 4,
    totalSpent: 4200.0,
    createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: "u-customer2",
    name: "Nimal Silva",
    email: "nimal@demo.com",
    passwordHash: defaultCustomerHash,
    role: "customer",
    city: "Kandy City",
    lat: 7.2906,
    lng: 80.6337,
    orderCount: 2,
    totalSpent: 1800.0,
    createdAt: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: "u-customer3",
    name: "Kamala Fernando",
    email: "kamala@demo.com",
    passwordHash: defaultCustomerHash,
    role: "customer",
    city: "Galle",
    lat: 6.0535,
    lng: 80.2210,
    orderCount: 1,
    totalSpent: 950.0,
    createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
  },
];

export function getMemoryUsers(): StoredUser[] {
  return memoryUsers;
}

export function findMemoryUserByEmail(email: string): StoredUser | undefined {
  const clean = email.trim().toLowerCase();
  return memoryUsers.find((u) => u.email.toLowerCase() === clean);
}

export function findMemoryUserById(id: string): StoredUser | undefined {
  return memoryUsers.find((u) => u.id === id);
}

export function addMemoryUser(user: StoredUser): void {
  const idx = memoryUsers.findIndex((u) => u.email.toLowerCase() === user.email.toLowerCase());
  if (idx !== -1) {
    memoryUsers[idx] = { ...memoryUsers[idx], ...user };
  } else {
    memoryUsers.unshift(user);
  }
}

export function updateMemoryUser(id: string, patch: Partial<StoredUser>): StoredUser | undefined {
  const idx = memoryUsers.findIndex((u) => u.id === id);
  if (idx !== -1) {
    memoryUsers[idx] = { ...memoryUsers[idx], ...patch };
    return memoryUsers[idx];
  }
  return undefined;
}

export function deleteMemoryUser(id: string): boolean {
  const initialLen = memoryUsers.length;
  memoryUsers = memoryUsers.filter((u) => u.id !== id);
  return memoryUsers.length < initialLen;
}
