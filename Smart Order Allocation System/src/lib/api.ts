const API_BASE = "/api";

function getToken(): string | null {
  return localStorage.getItem("soas_jwt");
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");

  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data?.error || data?.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ success: boolean; token: string; user: any }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    register: (payload: { name: string; email: string; password: string; city?: string; lat?: number; lng?: number }) =>
      request<{ success: boolean; token: string; user: any }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    me: () => request<{ success: boolean; user: any }>("/auth/me"),
  },

  products: {
    list: () => request<{ success: boolean; products: any[] }>("/products"),
  },

  branches: {
    list: () => request<{ success: boolean; branches: any[] }>("/branches"),
    getStock: (branchId: string) => request<{ success: boolean; branch: any; stock: any[] }>(`/branches/${branchId}/stock`),
    updateStock: (branchId: string, productId: string, quantity: number) =>
      request<{ success: boolean; message: string }>(`/branches/${branchId}/stock`, {
        method: "PUT",
        body: JSON.stringify({ productId, quantity }),
      }),
    toggleStatus: (branchId: string) =>
      request<{ success: boolean; isOpen: boolean; message: string }>(`/branches/${branchId}/toggle`, {
        method: "PATCH",
      }),
  },

  orders: {
    create: (payload: { items: { productId: string; quantity: number }[]; customerLocation: { city: string; lat: number; lng: number }; note?: string }) =>
      request<{ success: boolean; message: string; order?: any; allocation?: any; evaluations?: any[]; status?: string }>("/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    list: (params?: { status?: string; branchId?: string; search?: string }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set("status", params.status);
      if (params?.branchId) q.set("branchId", params.branchId);
      if (params?.search) q.set("search", params.search);
      const queryStr = q.toString();
      return request<{ success: boolean; orders: any[] }>(`/orders${queryStr ? `?${queryStr}` : ""}`);
    },
    get: (orderId: string) => request<{ success: boolean; order: any }>(`/orders/${orderId}`),
    updateStatus: (orderId: string, status: string) =>
      request<{ success: boolean; message: string; status: string }>(`/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    cancel: (orderId: string) =>
      request<{ success: boolean; message: string; status: string }>(`/orders/${orderId}/cancel`, {
        method: "POST",
      }),
    reassign: (orderId: string, newBranchId: string) =>
      request<{ success: boolean; message: string; allocatedBranchId: string; allocatedBranchName: string }>(`/orders/${orderId}/reassign`, {
        method: "POST",
        body: JSON.stringify({ newBranchId }),
      }),
  },

  dashboard: {
    stats: () => request<{ success: boolean; stats: any }>("/dashboard/stats"),
  },

  ai: {
    classify: (message: string, threshold?: number) =>
      request<{
        success: boolean;
        category: string;
        confidence: number;
        confidencePercentage: number;
        lowConfidence: boolean;
        status: string;
        allScores: Record<string, number>;
      }>("/ai/classify", {
        method: "POST",
        body: JSON.stringify({ message, threshold }),
      }),
    challengeSamples: () => request<{ success: boolean; samples: { id: number; message: string; expectedHint: string }[] }>("/ai/challenge-samples"),
    metrics: () => request<{ success: boolean; [key: string]: any }>("/ai/metrics"),
  },
};
