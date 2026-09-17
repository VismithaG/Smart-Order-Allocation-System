import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { getSession } from "../../lib/auth";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: "customer" | "admin";
  city: string;
  lat: number;
  lng: number;
  orderCount: number;
  totalSpent: number;
  createdAt?: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "customer" | "admin">("all");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserRecord | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<"customer" | "admin">("customer");
  const [formCity, setFormCity] = useState("Colombo");
  const [formLat, setFormLat] = useState(6.9271);
  const [formLng, setFormLng] = useState(79.8612);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const currentSession = getSession();

  function showToast(text: string, type: "success" | "error" = "success") {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  }

  function fetchUsers() {
    setLoading(true);
    api.users.list()
      .then((res) => {
        if (res.success && res.users) {
          setUsers(res.users);
        }
      })
      .catch((err) => console.warn("Could not sync with remote users API, local store active:", err?.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = (users || []).filter((u) => {
    if (!u) return false;
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const name = u.name || "";
    const email = u.email || "";
    const city = u.city || (u as any).location?.city || "";
    const matchesSearch =
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      city.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesRole && matchesSearch;
  });

  const totalSpent = (users || []).reduce((acc, u) => acc + (Number(u?.totalSpent) || 0), 0);
  const customerCount = (users || []).filter((u) => u?.role === "customer").length;
  const adminCount = (users || []).filter((u) => u?.role === "admin").length;

  function openAddModal() {
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormRole("customer");
    setFormCity("Colombo");
    setFormLat(6.9271);
    setFormLng(79.8612);
    setShowAddModal(true);
  }

  function openEditModal(u: UserRecord) {
    setEditingUser(u);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormPassword(""); // blank unless admin explicitly changes it
    setFormRole(u.role);
    setFormCity(u.city);
    setFormLat(u.lat);
    setFormLng(u.lng);
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim() || formPassword.length < 6) {
      showToast("Name, valid email, and password of at least 6 chars are required.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.users.create({
        name: formName.trim(),
        email: formEmail.trim(),
        password: formPassword,
        role: formRole,
        city: formCity.trim(),
        lat: formLat,
        lng: formLng,
      });
      if (res.success) {
        showToast(`User '${res.user.name}' created successfully!`);
        setShowAddModal(false);
        fetchUsers();
      }
    } catch (err: any) {
      showToast(err.message || "Failed to create user", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;

    setSubmitting(true);
    try {
      const payload: any = {
        name: formName.trim(),
        email: formEmail.trim(),
        role: formRole,
        city: formCity.trim(),
        lat: formLat,
        lng: formLng,
      };
      if (formPassword && formPassword.trim().length >= 6) {
        payload.password = formPassword.trim();
      }

      const res = await api.users.update(editingUser.id, payload);
      if (res.success) {
        showToast(`User '${res.user.name}' updated successfully!`);
        setEditingUser(null);
        fetchUsers();
      }
    } catch (err: any) {
      showToast(err.message || "Failed to update user", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteUser() {
    if (!deletingUser) return;
    setSubmitting(true);
    try {
      const res = await api.users.delete(deletingUser.id);
      if (res.success) {
        showToast(res.message || "User account deleted.");
        setDeletingUser(null);
        fetchUsers();
      }
    } catch (err: any) {
      showToast(err.message || "Failed to delete user", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-lg shadow-lg border text-sm flex items-center gap-2 transition-all ${
            toast.type === "success"
              ? "bg-emerald-950/90 text-emerald-300 border-emerald-800"
              : "bg-rose-950/90 text-rose-300 border-rose-800"
          }`}
        >
          <span>{toast.type === "success" ? "✓" : "⚠️"}</span>
          <span>{toast.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
            Customer & User Management
          </h1>
          <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
            Directory of customer accounts, roles, delivery addresses, and transaction volumes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchUsers}
            className="px-3 py-1.5 text-xs rounded-md border font-medium cursor-pointer transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--foreground)", background: "var(--card)" }}
          >
            ↻ Refresh
          </button>
          <button
            onClick={openAddModal}
            className="px-4 py-1.5 text-xs rounded-md font-semibold cursor-pointer transition-colors shadow-sm"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            + Add New User
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-lg border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>Total Accounts</div>
          <div className="text-xl font-bold mt-1" style={{ color: "var(--foreground)" }}>{users.length}</div>
        </div>
        <div className="p-3.5 rounded-lg border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>Customers</div>
          <div className="text-xl font-bold mt-1 text-blue-400">{customerCount}</div>
        </div>
        <div className="p-3.5 rounded-lg border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>Administrators</div>
          <div className="text-xl font-bold mt-1 text-amber-400">{adminCount}</div>
        </div>
        <div className="p-3.5 rounded-lg border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>Lifetime Spend</div>
          <div className="text-xl font-bold mt-1 text-emerald-400">Rs. {Number(totalSpent || 0).toFixed(2)}</div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-lg border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto py-0.5 scrollbar-none touch-pan-x">
          {(["all", "customer", "admin"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer capitalize transition-colors whitespace-nowrap shrink-0 ${
                roleFilter === r
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "hover:bg-muted text-muted-foreground"
              }`}
              style={{
                background: roleFilter === r ? "var(--primary)" : "transparent",
                color: roleFilter === r ? "var(--primary-foreground)" : "var(--muted-foreground)",
              }}
            >
              {r === "all" ? "All Users" : r === "customer" ? "Customers" : "Admins"}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64 shrink-0">
          <input
            type="text"
            placeholder="Search by name, email, or city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-1.5 text-xs rounded-md border outline-none transition-all"
            style={{
              background: "var(--background)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-lg border overflow-hidden shadow-xs" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        {loading ? (
          <div className="p-12 text-center text-xs text-muted-foreground">Loading user directory...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground">No users match the search filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b text-[11px] font-semibold uppercase tracking-wider" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
                  <th className="p-3.5">User</th>
                  <th className="p-3.5">Role</th>
                  <th className="p-3.5">Location</th>
                  <th className="p-3.5 text-center">Orders</th>
                  <th className="p-3.5 text-right">Total Spent</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                {filteredUsers.map((u) => {
                  const isSelf = currentSession?.user.id === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-muted/40 transition-colors">
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0"
                            style={{
                              background: u.role === "admin" ? "rgba(245, 158, 11, 0.2)" : "rgba(59, 130, 246, 0.2)",
                              color: u.role === "admin" ? "#f59e0b" : "#60a5fa",
                              border: `1px solid ${u.role === "admin" ? "rgba(245, 158, 11, 0.4)" : "rgba(59, 130, 246, 0.4)"}`,
                            }}
                          >
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-sm flex items-center gap-1.5" style={{ color: "var(--foreground)" }}>
                              {u.name}
                              {isSelf && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-mono">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span
                          className="px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize"
                          style={{
                            background: u.role === "admin" ? "rgba(245, 158, 11, 0.1)" : "rgba(59, 130, 246, 0.1)",
                            borderColor: u.role === "admin" ? "rgba(245, 158, 11, 0.3)" : "rgba(59, 130, 246, 0.3)",
                            color: u.role === "admin" ? "#f59e0b" : "#60a5fa",
                          }}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="font-medium" style={{ color: "var(--foreground)" }}>
                          {u.city || (u as any).location?.city || "Colombo"}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground">
                          {Number(u.lat ?? (u as any).location?.lat ?? 6.9271).toFixed(4)},{" "}
                          {Number(u.lng ?? (u as any).location?.lng ?? 79.8612).toFixed(4)}
                        </div>
                      </td>
                      <td className="p-3.5 text-center font-mono font-medium">
                        <span className="px-2 py-0.5 rounded bg-muted text-foreground">
                          {u.orderCount || 0}
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-mono font-semibold" style={{ color: "var(--foreground)" }}>
                        Rs. {Number(u.totalSpent || 0).toFixed(2)}
                      </td>
                      <td className="p-3.5 text-right space-x-2">
                        <button
                          onClick={() => openEditModal(u)}
                          className="px-2.5 py-1 rounded text-xs border font-medium cursor-pointer hover:bg-muted transition-colors"
                          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeletingUser(u)}
                          disabled={isSelf}
                          className={`px-2.5 py-1 rounded text-xs border font-medium transition-colors ${
                            isSelf
                              ? "opacity-40 cursor-not-allowed border-muted text-muted-foreground"
                              : "cursor-pointer border-rose-800/40 text-rose-400 hover:bg-rose-950/40"
                          }`}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD USER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className="w-full max-w-md p-6 rounded-xl border shadow-2xl space-y-4 animate-in fade-in zoom-in-95"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: "var(--border)" }}>
              <h3 className="font-semibold text-base" style={{ color: "var(--foreground)" }}>Add New User / Customer</h3>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground cursor-pointer text-sm">✕</button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Dilshan Madushanka"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border outline-none"
                  style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="user@example.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border outline-none"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Role</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-md border outline-none cursor-pointer"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  >
                    <option value="customer">Customer</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Password (Min 6 chars)</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border outline-none"
                  style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                />
              </div>

              <div>
                <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Registered City</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Colombo 7"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border outline-none"
                  style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formLat}
                    onChange={(e) => setFormLat(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-md border outline-none"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formLng}
                    onChange={(e) => setFormLng(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-md border outline-none"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-md border text-muted-foreground hover:text-foreground cursor-pointer"
                  style={{ borderColor: "var(--border)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-md font-semibold cursor-pointer transition-opacity"
                  style={{ background: "var(--primary)", color: "var(--primary-foreground)", opacity: submitting ? 0.6 : 1 }}
                >
                  {submitting ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className="w-full max-w-md p-6 rounded-xl border shadow-2xl space-y-4 animate-in fade-in zoom-in-95"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: "var(--border)" }}>
              <div>
                <h3 className="font-semibold text-base" style={{ color: "var(--foreground)" }}>Edit User Profile</h3>
                <div className="text-[10px] font-mono text-muted-foreground">{editingUser.id}</div>
              </div>
              <button onClick={() => setEditingUser(null)} className="text-muted-foreground hover:text-foreground cursor-pointer text-sm">✕</button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Full Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border outline-none"
                  style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Email Address</label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border outline-none"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Role</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-md border outline-none cursor-pointer"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  >
                    <option value="customer">Customer</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>
                  Reset Password (Leave blank to keep current)
                </label>
                <input
                  type="password"
                  placeholder="New password (optional)"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border outline-none"
                  style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                />
              </div>

              <div>
                <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>City</label>
                <input
                  type="text"
                  required
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border outline-none"
                  style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formLat}
                    onChange={(e) => setFormLat(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-md border outline-none"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formLng}
                    onChange={(e) => setFormLng(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-md border outline-none"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-3 py-1.5 rounded-md border text-muted-foreground hover:text-foreground cursor-pointer"
                  style={{ borderColor: "var(--border)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-md font-semibold cursor-pointer transition-opacity"
                  style={{ background: "var(--primary)", color: "var(--primary-foreground)", opacity: submitting ? 0.6 : 1 }}
                >
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className="w-full max-w-sm p-6 rounded-xl border shadow-2xl space-y-4 animate-in fade-in zoom-in-95"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-rose-950/80 border border-rose-800 text-rose-400 flex items-center justify-center font-bold">
                ⚠️
              </div>
              <div>
                <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>Delete Account</h3>
                <div className="text-[11px] text-muted-foreground">Permanent user removal</div>
              </div>
            </div>

            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              Are you sure you want to delete user <strong style={{ color: "var(--foreground)" }}>{deletingUser.name}</strong> ({deletingUser.email})?
              Existing order records will have their customer reference safely preserved.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
              <button
                onClick={() => setDeletingUser(null)}
                className="px-3 py-1.5 rounded-md border text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                style={{ borderColor: "var(--border)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={submitting}
                className="px-4 py-1.5 rounded-md text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer transition-opacity"
                style={{ opacity: submitting ? 0.6 : 1 }}
              >
                {submitting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
