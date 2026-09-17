import { useState, useEffect } from "react";
import { api } from "../../lib/api";

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  imageUrl?: string;
  createdAt?: string;
}

export default function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("Drinks");
  const [formPrice, setFormPrice] = useState<number | "">("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  function showToast(text: string, type: "success" | "error" = "success") {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  }

  function fetchProducts() {
    setLoading(true);
    api.products.list()
      .then((res) => {
        if (res.success && res.products) {
          setProducts(res.products);
        }
      })
      .catch((err) => console.warn("Could not sync with remote products API, local store active:", err?.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchProducts();
  }, []);

  const categories = ["All", ...Array.from(new Set(products.map((p) => p.category)))];

  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === "All" || p.category === selectedCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  function openAddModal() {
    setFormName("");
    setFormCategory("Drinks");
    setFormPrice("");
    setFormImageUrl("");
    setShowAddModal(true);
  }

  function openEditModal(prod: Product) {
    setEditingProduct(prod);
    setFormName(prod.name);
    setFormCategory(prod.category);
    setFormPrice(prod.price);
    setFormImageUrl(prod.imageUrl || "");
  }

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim() || typeof formPrice !== "number" || formPrice < 0) {
      showToast("Please enter a valid product name and non-negative price.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.products.create({
        name: formName.trim(),
        category: formCategory.trim(),
        price: formPrice,
        imageUrl: formImageUrl.trim(),
      });
      if (res.success) {
        showToast(`Product '${res.product.name}' created successfully! Stock initialized across all branches.`);
        setShowAddModal(false);
        fetchProducts();
      }
    } catch (err: any) {
      showToast(err.message || "Failed to create product", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!editingProduct) return;
    if (!formName.trim() || typeof formPrice !== "number" || formPrice < 0) {
      showToast("Please enter a valid product name and non-negative price.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.products.update(editingProduct.id, {
        name: formName.trim(),
        category: formCategory.trim(),
        price: formPrice,
        imageUrl: formImageUrl.trim(),
      });
      if (res.success) {
        showToast(`Product '${res.product.name}' updated successfully!`);
        setEditingProduct(null);
        fetchProducts();
      }
    } catch (err: any) {
      showToast(err.message || "Failed to update product", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteProduct() {
    if (!deletingProduct) return;
    setSubmitting(true);
    try {
      const res = await api.products.delete(deletingProduct.id);
      if (res.success) {
        showToast(res.message || "Product deleted successfully.");
        setDeletingProduct(null);
        fetchProducts();
      }
    } catch (err: any) {
      showToast(err.message || "Failed to delete product", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-lg shadow-lg border text-sm flex items-center gap-2 transition-all ${
            toastMessage.type === "success"
              ? "bg-emerald-950/90 text-emerald-300 border-emerald-800"
              : "bg-rose-950/90 text-rose-300 border-rose-800"
          }`}
        >
          <span>{toastMessage.type === "success" ? "✓" : "⚠️"}</span>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
            Product Catalog Management
          </h1>
          <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
            Manage store catalog, set prices in LKR, and synchronize inventory records across all branches.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchProducts}
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
            + Add New Product
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-lg border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>Total Products</div>
          <div className="text-xl font-bold mt-1" style={{ color: "var(--foreground)" }}>{products.length}</div>
        </div>
        <div className="p-3.5 rounded-lg border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>Categories</div>
          <div className="text-xl font-bold mt-1" style={{ color: "var(--foreground)" }}>
            {categories.filter((c) => c !== "All").length}
          </div>
        </div>
        <div className="p-3.5 rounded-lg border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>Min Item Price</div>
          <div className="text-xl font-bold mt-1 text-emerald-400">
            Rs. {products.length ? Math.min(...products.map((p) => p.price)).toFixed(2) : "0.00"}
          </div>
        </div>
        <div className="p-3.5 rounded-lg border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>Max Item Price</div>
          <div className="text-xl font-bold mt-1 text-indigo-400">
            Rs. {products.length ? Math.max(...products.map((p) => p.price)).toFixed(2) : "0.00"}
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-lg border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto py-0.5 scrollbar-none touch-pan-x">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                selectedCategory === cat
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "hover:bg-muted text-muted-foreground"
              }`}
              style={{
                background: selectedCategory === cat ? "var(--primary)" : "transparent",
                color: selectedCategory === cat ? "var(--primary-foreground)" : "var(--muted-foreground)",
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64 shrink-0">
          <input
            type="text"
            placeholder="Search products..."
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

      {/* Product Table */}
      <div className="rounded-lg border overflow-hidden shadow-xs" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        {loading ? (
          <div className="p-12 text-center text-xs text-muted-foreground">Loading product catalog...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground">
            No products match the selected criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b text-[11px] font-semibold uppercase tracking-wider" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
                  <th className="p-3.5">Product</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5 text-right">Price (LKR)</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/40 transition-colors">
                    <td className="p-3.5">
                      <div className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{p.name}</div>
                      <div className="text-[10px] font-mono mt-0.5" style={{ color: "var(--muted-foreground)" }}>{p.id}</div>
                    </td>
                    <td className="p-3.5">
                      <span
                        className="px-2 py-0.5 rounded-full text-[11px] font-medium border"
                        style={{
                          background: p.category === "Drinks" ? "rgba(59, 130, 246, 0.1)" : "rgba(168, 85, 247, 0.1)",
                          borderColor: p.category === "Drinks" ? "rgba(59, 130, 246, 0.3)" : "rgba(168, 85, 247, 0.3)",
                          color: p.category === "Drinks" ? "#60a5fa" : "#c084fc",
                        }}
                      >
                        {p.category}
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-mono font-semibold text-sm" style={{ color: "var(--foreground)" }}>
                      Rs. {p.price.toFixed(2)}
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(p)}
                        className="px-2.5 py-1 rounded text-xs border font-medium cursor-pointer hover:bg-muted transition-colors"
                        style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeletingProduct(p)}
                        className="px-2.5 py-1 rounded text-xs border font-medium cursor-pointer border-rose-800/40 text-rose-400 hover:bg-rose-950/40 transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD PRODUCT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className="w-full max-w-md p-6 rounded-xl border shadow-2xl space-y-4 animate-in fade-in zoom-in-95"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: "var(--border)" }}>
              <h3 className="font-semibold text-base" style={{ color: "var(--foreground)" }}>Add New Product</h3>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground cursor-pointer text-sm">✕</button>
            </div>

            <form onSubmit={handleAddProduct} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Product Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Peach Oolong Milk Tea"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border outline-none"
                  style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border outline-none cursor-pointer"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  >
                    <option value="Drinks">Drinks</option>
                    <option value="Add-ons">Add-ons</option>
                    <option value="Snacks">Snacks</option>
                    <option value="Desserts">Desserts</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Price (LKR)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    placeholder="450"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-md border outline-none"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Image URL (Optional)</label>
                <input
                  type="text"
                  placeholder="https://images.unsplash.com/..."
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border outline-none"
                  style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                />
              </div>

              <div className="p-3 rounded-md bg-muted/40 text-[11px] text-muted-foreground">
                ℹ️ Adding a product will automatically initialize stock records across all active branches.
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
                  {submitting ? "Creating..." : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PRODUCT MODAL */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className="w-full max-w-md p-6 rounded-xl border shadow-2xl space-y-4 animate-in fade-in zoom-in-95"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: "var(--border)" }}>
              <div>
                <h3 className="font-semibold text-base" style={{ color: "var(--foreground)" }}>Edit Product</h3>
                <div className="text-[10px] font-mono text-muted-foreground">{editingProduct.id}</div>
              </div>
              <button onClick={() => setEditingProduct(null)} className="text-muted-foreground hover:text-foreground cursor-pointer text-sm">✕</button>
            </div>

            <form onSubmit={handleUpdateProduct} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Product Name</label>
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
                  <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border outline-none cursor-pointer"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  >
                    <option value="Drinks">Drinks</option>
                    <option value="Add-ons">Add-ons</option>
                    <option value="Snacks">Snacks</option>
                    <option value="Desserts">Desserts</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Price (LKR)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-md border outline-none"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1" style={{ color: "var(--foreground)" }}>Image URL</label>
                <input
                  type="text"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border outline-none"
                  style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
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
      {deletingProduct && (
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
                <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>Delete Product</h3>
                <div className="text-[11px] text-muted-foreground">This action cannot be undone.</div>
              </div>
            </div>

            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              Are you sure you want to delete <strong style={{ color: "var(--foreground)" }}>{deletingProduct.name}</strong>?
              All stock entries for this item across all branch locations will be permanently removed.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
              <button
                onClick={() => setDeletingProduct(null)}
                className="px-3 py-1.5 rounded-md border text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                style={{ borderColor: "var(--border)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProduct}
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
