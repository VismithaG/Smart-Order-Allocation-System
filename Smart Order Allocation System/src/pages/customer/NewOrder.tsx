import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { navigate } from "../../lib/router";
import { getSession } from "../../lib/auth";
import type { BranchLocation, Product } from "../../lib/types";

const LOCATIONS: { label: string; location: BranchLocation }[] = [
  { label: "Colombo 3 (Kollupitiya)", location: { city: "Colombo 3", lat: 6.898, lng: 79.856 } },
  { label: "Colombo Fort (Downtown)", location: { city: "Colombo Fort", lat: 6.9344, lng: 79.8428 } },
  { label: "Kandy City Center", location: { city: "Kandy City", lat: 7.2906, lng: 80.6337 } },
  { label: "Galle Town & Fort", location: { city: "Galle Town", lat: 6.0535, lng: 80.221 } },
  { label: "Negombo Beach Road", location: { city: "Negombo", lat: 7.2088, lng: 79.8358 } },
  { label: "Matara Town", location: { city: "Matara", lat: 5.9549, lng: 80.555 } },
];

type CheckoutStep = "products" | "summary" | "payment";
type PaymentMethod = "card" | "cod" | "wallet";

export default function NewOrder() {
  const session = getSession();
  const [step, setStep] = useState<CheckoutStep>("products");

  // Catalog & Cart state
  const [products, setProducts] = useState<Product[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // Delivery & Note state
  const [locationKey, setLocationKey] = useState(LOCATIONS[0].label);
  const [note, setNote] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState<{ category: string; confidence: number; lowConfidence: boolean } | null>(null);

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [cardHolder, setCardHolder] = useState(session?.user.name || "Vismitha Gunasekara");
  const [cardNumber, setCardNumber] = useState("xxxx xxxx xxxx xxxx");
  const [cardExpiry, setCardExpiry] = useState("MM/YY");
  const [cardCvv, setCardCvv] = useState("xxx");

  // Execution & Results state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    success: boolean;
    orderId?: string;
    branchName?: string;
    reason?: string;
    score?: number;
    breakdown?: any;
    aiCategory?: string;
    aiConfidence?: number;
    paymentMethodUsed?: string;
  } | null>(null);

  // Fetch product catalog
  useEffect(() => {
    api.products.list()
      .then((res) => {
        if (res.success && res.products) {
          setProducts(res.products);
        }
      })
      .catch((err) => console.error("Error loading products:", err));
  }, []);

  // Real-time AI classification on order note
  useEffect(() => {
    const trimmed = note.trim();
    if (trimmed.length < 5) {
      setAiAnalysis(null);
      return;
    }

    const timer = setTimeout(() => {
      api.ai.classify(trimmed)
        .then((res) => {
          if (res.success) {
            setAiAnalysis({
              category: res.category,
              confidence: res.confidence,
              lowConfidence: res.lowConfidence,
            });
          }
        })
        .catch(() => {});
    }, 300);

    return () => clearTimeout(timer);
  }, [note]);

  // Derived cart items
  const items = Object.entries(quantities)
    .filter(([, qty]) => qty > 0)
    .map(([pid, qty]) => {
      const p = products.find((prod) => prod.id === pid);
      return {
        productId: pid,
        productName: p?.name || pid,
        category: p?.category || "Drinks",
        quantity: qty,
        unitPrice: p?.price || 0,
      };
    });

  const totalItemsCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const itemsSubtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const deliveryFee = itemsSubtotal >= 15 ? 0 : 1.50; // Free delivery over LKR 15
  const grandTotal = itemsSubtotal + (items.length > 0 ? deliveryFee : 0);

  function setQty(pid: string, val: number) {
    setQuantities((prev) => ({ ...prev, [pid]: Math.max(0, val) }));
  }

  function autofillDemoCard() {
    setCardHolder(session?.user.name || "Vismitha Gunasekara");
    setCardNumber("0001 0001 0001 0001");
    setCardExpiry("10/26");
    setCardCvv("001");
  }

  async function handleCompleteOrder() {
    if (items.length === 0) return;
    setSubmitting(true);
    setError("");

    try {
      const loc = LOCATIONS.find((l) => l.label === locationKey)!.location;
      const paymentSummaryNote = `[Paid via ${
        paymentMethod === "card"
          ? `Credit Card (ending in ${cardNumber.slice(-4)})`
          : paymentMethod === "cod"
          ? "Cash on Delivery"
          : "Digital Wallet"
      }] ${note.trim()}`;

      const response = await api.orders.create({
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        customerLocation: loc,
        note: paymentSummaryNote,
      });

      if (response.success && response.allocation) {
        setResult({
          success: true,
          orderId: response.order?.id,
          branchName: response.allocation.branchName,
          reason: response.allocation.reason,
          score: response.allocation.score,
          breakdown: response.allocation.breakdown,
          aiCategory: response.order?.aiCategory,
          aiConfidence: response.order?.aiConfidence,
          paymentMethodUsed: paymentMethod === "card" ? "Credit/Debit Card" : paymentMethod === "cod" ? "Cash on Delivery" : "Mobile Wallet",
        });
      } else {
        setResult({
          success: false,
          orderId: response.order?.id,
          reason: response.message || "All branches are out of stock or at maximum capacity.",
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to process order.");
    } finally {
      setSubmitting(false);
    }
  }

  // Categories list
  const categories = ["All", ...Array.from(new Set(products.map((p) => p.category)))];
  const displayedProducts = selectedCategory === "All"
    ? products
    : products.filter((p) => p.category === selectedCategory);

  // --------------------------------------------------------------------------
  // RENDER: SUCCESS / ALLOCATION RESULT MODAL VIEW
  // --------------------------------------------------------------------------
  if (result) {
    return (
      <div className="p-8 max-w-xl mx-auto">
        <div
          className="rounded-xl border p-7 text-center shadow-2xl"
          style={{
            background: "var(--card)",
            borderColor: result.success ? "var(--primary)" : "#ef4444",
          }}
        >
          <div className="text-5xl mb-3">{result.success ? "🎉" : "✗"}</div>
          <h2 className="text-xl font-bold mb-1" style={{ color: "var(--foreground)" }}>
            {result.success ? "Order Successfully Placed & Routed!" : "Order Allocation Unsuccessful"}
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            {result.success
              ? `Payment confirmed via ${result.paymentMethodUsed}. Your order has been dispatched to kitchen preparation.`
              : "The smart routing engine could not find an eligible branch with full stock."}
          </p>

          {result.success ? (
            <div className="text-left rounded-lg p-4 mb-5 text-xs space-y-2.5" style={{ background: "var(--muted)" }}>
              <div className="flex justify-between border-b pb-2" style={{ borderColor: "var(--border)" }}>
                <span className="text-muted-foreground">Order Reference:</span>
                <span className="font-mono font-bold" style={{ color: "var(--foreground)" }}>{result.orderId}</span>
              </div>

              <div className="flex justify-between border-b pb-2" style={{ borderColor: "var(--border)" }}>
                <span className="text-muted-foreground">Allocated Branch:</span>
                <span className="font-semibold text-emerald-400">{result.branchName}</span>
              </div>

              <div className="flex justify-between border-b pb-2" style={{ borderColor: "var(--border)" }}>
                <span className="text-muted-foreground">Composite Routing Score:</span>
                <span className="font-mono font-bold text-sm" style={{ color: "var(--primary)" }}>{result.score}/100</span>
              </div>

              {result.breakdown && (
                <div className="grid grid-cols-3 gap-2 py-1 text-center font-mono">
                  <div className="p-2 rounded bg-black/20 dark:bg-white/5">
                    <div className="text-[10px] text-muted-foreground">Stock Match</div>
                    <div className="font-bold text-emerald-400">{result.breakdown.stockScore}%</div>
                  </div>
                  <div className="p-2 rounded bg-black/20 dark:bg-white/5">
                    <div className="text-[10px] text-muted-foreground">Proximity</div>
                    <div className="font-bold text-blue-400">{result.breakdown.proximityScore}% ({result.breakdown.distanceKm} km)</div>
                  </div>
                  <div className="p-2 rounded bg-black/20 dark:bg-white/5">
                    <div className="text-[10px] text-muted-foreground">Capacity Load</div>
                    <div className="font-bold text-amber-400">{result.breakdown.capacityUtilization}%</div>
                  </div>
                </div>
              )}

              <div className="pt-1 text-muted-foreground">
                <span className="font-semibold text-foreground">DOM Algorithm Rationale: </span>
                {result.reason}
              </div>

              {result.aiCategory && (
                <div className="pt-2 border-t flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
                  <span className="text-muted-foreground">🤖 AI Note Triage:</span>
                  <span className="font-medium text-purple-400">
                    {result.aiCategory} ({Math.round((result.aiConfidence || 0) * 100)}% conf)
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-left rounded-lg p-4 mb-5 text-xs space-y-2" style={{ background: "var(--muted)" }}>
              <p className="text-red-400 font-semibold">{result.reason}</p>
              <p className="text-muted-foreground">
                No active branch currently has sufficient stock for all requested items or capacity limits are exceeded. Please try adjusting your quantities.
              </p>
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                setResult(null);
                setQuantities({});
                setNote("");
                setStep("products");
              }}
              className="px-4 py-2 text-xs rounded-md border font-medium cursor-pointer"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              Order Again
            </button>
            <button
              onClick={() => navigate("/orders")}
              className="px-4 py-2 text-xs rounded-md font-medium text-white cursor-pointer"
              style={{ background: "var(--primary)" }}
            >
              Track in Order History →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // STEPPER HEADER
  // --------------------------------------------------------------------------
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Checkout Steps Indicator */}
      <div className="flex items-center justify-center gap-3 sm:gap-6 py-2 border-b" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={() => setStep("products")}
          className="flex items-center gap-2 text-xs font-semibold cursor-pointer transition-colors"
          style={{ color: step === "products" ? "var(--primary)" : "var(--muted-foreground)" }}
        >
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
              step === "products"
                ? "bg-primary text-black font-bold"
                : "bg-muted text-muted-foreground border border-border"
            }`}
          >
            1
          </span>
          <span>Select Products</span>
          {totalItemsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/20 text-primary font-mono">
              {totalItemsCount}
            </span>
          )}
        </button>

        <span className="text-muted-foreground text-xs">───</span>

        <button
          onClick={() => {
            if (totalItemsCount > 0) setStep("summary");
          }}
          disabled={totalItemsCount === 0}
          className="flex items-center gap-2 text-xs font-semibold disabled:opacity-40 cursor-pointer transition-colors"
          style={{ color: step === "summary" ? "var(--primary)" : "var(--muted-foreground)" }}
        >
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
              step === "summary"
                ? "bg-primary text-black font-bold"
                : "bg-muted text-muted-foreground border border-border"
            }`}
          >
            2
          </span>
          <span>Order Summary</span>
        </button>

        <span className="text-muted-foreground text-xs">───</span>

        <button
          onClick={() => {
            if (totalItemsCount > 0) setStep("payment");
          }}
          disabled={totalItemsCount === 0}
          className="flex items-center gap-2 text-xs font-semibold disabled:opacity-40 cursor-pointer transition-colors"
          style={{ color: step === "payment" ? "var(--primary)" : "var(--muted-foreground)" }}
        >
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
              step === "payment"
                ? "bg-primary text-black font-bold"
                : "bg-muted text-muted-foreground border border-border"
            }`}
          >
            3
          </span>
          <span>Payment</span>
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-md text-xs text-red-400 bg-red-950/40 border border-red-800">
          {error}
        </div>
      )}

      {/* ----------------------------------------------------------------------
          STEP 1: PRODUCT SELECTION
      ---------------------------------------------------------------------- */}
      {step === "products" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>Choose Your Beverages</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Browse our fresh artisanal bubble teas, fruit infusions, and premium add-ons.
              </p>
            </div>

            {/* Category Filter Pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedCategory(c)}
                  className="px-3 py-1 text-xs rounded-full border transition-all cursor-pointer whitespace-nowrap"
                  style={{
                    background: selectedCategory === c ? "var(--primary)" : "var(--card)",
                    color: selectedCategory === c ? "#000" : "var(--muted-foreground)",
                    borderColor: selectedCategory === c ? "var(--primary)" : "var(--border)",
                    fontWeight: selectedCategory === c ? 600 : 400,
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedProducts.map((p) => {
              const qty = quantities[p.id] || 0;
              return (
                <div
                  key={p.id}
                  className={`rounded-xl border p-4 flex flex-col justify-between transition-all ${
                    qty > 0 ? "border-primary/70 bg-card/80 shadow-md" : "hover:border-border/80"
                  }`}
                  style={{ background: "var(--card)", borderColor: qty > 0 ? "var(--primary)" : "var(--border)" }}
                >
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{p.name}</h3>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {p.category}
                      </span>
                    </div>
                    <div className="text-sm font-bold font-mono" style={{ color: "var(--primary)" }}>
                      LKR {p.price.toFixed(2)}
                    </div>
                  </div>

                  {/* Quantity selector */}
                  <div className="mt-4 pt-3 border-t flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
                    <span className="text-xs text-muted-foreground">
                      {qty > 0 ? `Subtotal: LKR ${(qty * p.price).toFixed(2)}` : "Select quantity"}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQty(p.id, qty - 1)}
                        disabled={qty === 0}
                        className="w-7 h-7 rounded border flex items-center justify-center text-sm font-bold disabled:opacity-20 cursor-pointer transition-colors"
                        style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                      >
                        -
                      </button>
                      <span className="w-6 text-center text-xs font-mono font-bold" style={{ color: "var(--foreground)" }}>
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQty(p.id, qty + 1)}
                        className="w-7 h-7 rounded border flex items-center justify-center text-sm font-bold cursor-pointer transition-colors text-white"
                        style={{ background: "var(--primary)", borderColor: "var(--primary)" }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sticky Bottom Cart Bar */}
          <div
            className="sticky bottom-4 rounded-xl border p-4 flex items-center justify-between shadow-2xl backdrop-blur-md"
            style={{ background: "rgba(22, 27, 34, 0.95)", borderColor: "var(--border)" }}
          >
            <div>
              <div className="text-xs text-muted-foreground">
                {totalItemsCount === 0 ? "Your basket is empty" : `${totalItemsCount} item${totalItemsCount > 1 ? "s" : ""} selected`}
              </div>
              <div className="text-lg font-bold font-mono" style={{ color: "var(--foreground)" }}>
                Total: <span style={{ color: "var(--primary)" }}>LKR {itemsSubtotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={() => setStep("summary")}
              disabled={totalItemsCount === 0}
              className="px-5 py-2.5 rounded-lg text-xs font-bold text-black disabled:opacity-30 cursor-pointer transition-all shadow-md"
              style={{ background: "var(--primary)" }}
            >
              Proceed to Order Summary →
            </button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------
          STEP 2: ORDER SUMMARY PAGE
      ---------------------------------------------------------------------- */}
      {step === "summary" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>Order Review & Destination</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Verify items, select your delivery location, and provide special instructions.
              </p>
            </div>
            <button
              onClick={() => setStep("products")}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1"
            >
              ← Back to Products
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Cart Table & Delivery Location */}
            <div className="lg:col-span-2 space-y-5">
              {/* Itemized Cart Card */}
              <div className="rounded-xl border p-5 space-y-3" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Selected Beverages</h2>
                <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {items.map((i) => (
                    <div key={i.productId} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                      <div className="flex-1">
                        <div className="font-semibold" style={{ color: "var(--foreground)" }}>{i.productName}</div>
                        <div className="text-muted-foreground">
                          LKR {i.unitPrice.toFixed(2)} each • {i.category}
                        </div>
                      </div>

                      {/* Quantity changer */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setQty(i.productId, i.quantity - 1)}
                          className="w-6 h-6 rounded border flex items-center justify-center text-xs cursor-pointer"
                          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                        >
                          -
                        </button>
                        <span className="w-5 text-center font-mono font-bold" style={{ color: "var(--foreground)" }}>
                          {i.quantity}
                        </span>
                        <button
                          onClick={() => setQty(i.productId, i.quantity + 1)}
                          className="w-6 h-6 rounded border flex items-center justify-center text-xs cursor-pointer"
                          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                        >
                          +
                        </button>
                      </div>

                      <div className="w-20 text-right font-mono font-bold" style={{ color: "var(--primary)" }}>
                        LKR {(i.quantity * i.unitPrice).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery Destination */}
              <div className="rounded-xl border p-5 space-y-3" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                <div className="flex justify-between items-center">
                  <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Delivery Destination</h2>
                  <span className="text-[10px] text-muted-foreground">Smart Geo-Routing</span>
                </div>
                <select
                  value={locationKey}
                  onChange={(e) => setLocationKey(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-md border outline-none cursor-pointer"
                  style={{ background: "var(--muted)", borderColor: "var(--border)", color: "var(--foreground)" }}
                >
                  {LOCATIONS.map((loc) => (
                    <option key={loc.label} value={loc.label}>{loc.label}</option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  The DOM engine applies the Haversine spherical formula between your coordinates and all branch kitchens.
                </p>
              </div>

              {/* Customer Note with Live AI Triage */}
              <div className="rounded-xl border p-5 space-y-2.5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                <div className="flex justify-between items-center">
                  <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Special Delivery Note / Request</h2>
                  <span className="text-[10px] text-purple-400 font-mono">🤖 Real-time AI Triage</span>
                </div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Please deliver before 5 PM, or rider call when arriving at gate."
                  rows={2}
                  className="w-full p-2.5 text-xs rounded-md border outline-none resize-none font-sans"
                  style={{ background: "var(--muted)", borderColor: "var(--border)", color: "var(--foreground)" }}
                />
                {aiAnalysis && (
                  <div className="p-2 rounded text-[11px] flex items-center justify-between border" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
                    <div>
                      <span className="text-muted-foreground">Detected Intent: </span>
                      <span className="font-semibold text-purple-400">{aiAnalysis.category}</span>
                    </div>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-purple-950/60 text-purple-300">
                      {Math.round(aiAnalysis.confidence * 100)}% confidence
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Col: Price Breakdown & Action */}
            <div className="space-y-4">
              <div className="rounded-xl border p-5 space-y-3" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                <h3 className="text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--muted-foreground)" }}>
                  Payment Breakdown
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Items Subtotal ({totalItemsCount} items)</span>
                    <span className="font-mono text-foreground">LKR {itemsSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Delivery Estimate</span>
                    <span className="font-mono text-foreground">
                      {deliveryFee === 0 ? <span className="text-emerald-400">FREE</span> : `LKR ${deliveryFee.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Estimated Taxes</span>
                    <span className="font-mono text-foreground">Included</span>
                  </div>
                </div>

                <div className="border-t pt-3 flex justify-between items-center" style={{ borderColor: "var(--border)" }}>
                  <span className="text-sm font-bold" style={{ color: "var(--foreground)" }}>Total Payable</span>
                  <span className="text-lg font-bold font-mono" style={{ color: "var(--primary)" }}>
                    LKR {grandTotal.toFixed(2)}
                  </span>
                </div>

                <button
                  onClick={() => setStep("payment")}
                  className="w-full py-3 px-4 rounded-lg text-xs font-bold text-black cursor-pointer shadow-md transition-transform active:scale-98"
                  style={{ background: "var(--primary)" }}
                >
                  Proceed to Payment Screen →
                </button>
              </div>

              <div className="p-3.5 rounded-lg border text-[11px] space-y-1 text-muted-foreground" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
                <div className="font-semibold text-foreground">⚡ Instant Fulfillment Guarantee</div>
                <div>The Smart Allocation System automatically detects available branches and routes to the nearest kitchen.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------
          STEP 3: PAYMENT SCREEN
      ---------------------------------------------------------------------- */}
      {step === "payment" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>Select Payment Method</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Choose your preferred payment method. (Simulation mode: No actual charge is processed).
              </p>
            </div>
            <button
              onClick={() => setStep("summary")}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1"
            >
              ← Back to Order Summary
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Payment Methods */}
            <div className="lg:col-span-2 space-y-4">
              {/* Payment Method Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div
                  onClick={() => setPaymentMethod("card")}
                  className={`p-3.5 rounded-xl border cursor-pointer text-center transition-all ${
                    paymentMethod === "card" ? "border-primary bg-primary/10 ring-1 ring-primary" : "hover:border-border/80"
                  }`}
                  style={{ background: "var(--card)", borderColor: paymentMethod === "card" ? "var(--primary)" : "var(--border)" }}
                >
                  <div className="text-xl mb-1">💳</div>
                  <div className="text-xs font-bold" style={{ color: "var(--foreground)" }}>Credit/Debit Card</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Visa, Mastercard</div>
                </div>

                <div
                  onClick={() => setPaymentMethod("cod")}
                  className={`p-3.5 rounded-xl border cursor-pointer text-center transition-all ${
                    paymentMethod === "cod" ? "border-primary bg-primary/10 ring-1 ring-primary" : "hover:border-border/80"
                  }`}
                  style={{ background: "var(--card)", borderColor: paymentMethod === "cod" ? "var(--primary)" : "var(--border)" }}
                >
                  <div className="text-xl mb-1">💵</div>
                  <div className="text-xs font-bold" style={{ color: "var(--foreground)" }}>Cash on Delivery</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Pay at Doorstep</div>
                </div>

                <div
                  onClick={() => setPaymentMethod("wallet")}
                  className={`p-3.5 rounded-xl border cursor-pointer text-center transition-all ${
                    paymentMethod === "wallet" ? "border-primary bg-primary/10 ring-1 ring-primary" : "hover:border-border/80"
                  }`}
                  style={{ background: "var(--card)", borderColor: paymentMethod === "wallet" ? "var(--primary)" : "var(--border)" }}
                >
                  <div className="text-xl mb-1">📱</div>
                  <div className="text-xs font-bold" style={{ color: "var(--foreground)" }}>Digital Wallet</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Google Pay / Apple Pay</div>
                </div>
              </div>

              {/* CARD FORM */}
              {paymentMethod === "card" && (
                <div className="rounded-xl border p-5 space-y-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                  <div className="flex justify-between items-center border-b pb-2.5" style={{ borderColor: "var(--border)" }}>
                    <h3 className="text-xs uppercase font-bold tracking-wider" style={{ color: "var(--foreground)" }}>
                      Cardholder Details
                    </h3>
                    <button
                      type="button"
                      onClick={autofillDemoCard}
                      className="text-[11px] font-mono text-primary hover:underline cursor-pointer"
                    >
                      ✨ Autofill Demo Card
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                        Cardholder Name
                      </label>
                      <input
                        type="text"
                        value={cardHolder}
                        onChange={(e) => setCardHolder(e.target.value)}
                        placeholder="e.g. Amal Perera"
                        className="w-full px-3 py-2 text-xs rounded-md border outline-none font-sans"
                        style={{ background: "var(--muted)", borderColor: "var(--border)", color: "var(--foreground)" }}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                        Card Number
                      </label>
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        placeholder="4532 8921 4452 7819"
                        className="w-full px-3 py-2 text-xs rounded-md border outline-none font-mono"
                        style={{ background: "var(--muted)", borderColor: "var(--border)", color: "var(--foreground)" }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                          Expiry Date (MM/YY)
                        </label>
                        <input
                          type="text"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          placeholder="MM/YY"
                          className="w-full px-3 py-2 text-xs rounded-md border outline-none font-mono text-center"
                          style={{ background: "var(--muted)", borderColor: "var(--border)", color: "var(--foreground)" }}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                          CVV / CVC
                        </label>
                        <input
                          type="password"
                          maxLength={4}
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value)}
                          placeholder="•••"
                          className="w-full px-3 py-2 text-xs rounded-md border outline-none font-mono text-center"
                          style={{ background: "var(--muted)", borderColor: "var(--border)", color: "var(--foreground)" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CASH ON DELIVERY INFO */}
              {paymentMethod === "cod" && (
                <div className="rounded-xl border p-5 text-xs space-y-2" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                  <h3 className="font-semibold text-foreground">Cash On Delivery Selected</h3>
                  <p className="text-muted-foreground">
                    Please prepare exact cash of <strong className="font-mono text-primary">LKR {grandTotal.toFixed(2)}</strong> for the courier rider upon delivery to <span className="text-foreground">{locationKey}</span>.
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Your order will be routed through the allocation algorithm immediately upon confirmation.
                  </p>
                </div>
              )}

              {/* DIGITAL WALLET INFO */}
              {paymentMethod === "wallet" && (
                <div className="rounded-xl border p-5 text-xs space-y-3" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                  <h3 className="font-semibold text-foreground">Digital Wallet Express</h3>
                  <div className="p-3 rounded bg-muted flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-foreground">Google Pay/ Apple Pay</div>
                      <div className="text-[11px] text-muted-foreground">Instant simulated one-tap checkout</div>
                    </div>
                    <span className="text-emerald-400 font-mono text-[11px] font-bold">READY</span>
                  </div>
                </div>
              )}

              {/* Security reassurance badge */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                <span>🔒</span>
                <span>Simulated Secure Checkout • Encrypted Session Token Attached</span>
              </div>
            </div>

            {/* Right Col: Final Review & Pay Action */}
            <div className="space-y-4">
              <div className="rounded-xl border p-5 space-y-3" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                <h3 className="text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--muted-foreground)" }}>
                  Order Review
                </h3>

                <div className="text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Items:</span>
                    <span className="font-mono text-foreground">{totalItemsCount} drinks</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivery to:</span>
                    <span className="text-foreground truncate max-w-36 text-right">{locationKey.split(" ")[0]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Method:</span>
                    <span className="font-semibold text-foreground capitalize">{paymentMethod}</span>
                  </div>
                </div>

                <div className="border-t pt-3 flex justify-between items-center" style={{ borderColor: "var(--border)" }}>
                  <span className="text-sm font-bold" style={{ color: "var(--foreground)" }}>Total Amount</span>
                  <span className="text-lg font-bold font-mono" style={{ color: "var(--primary)" }}>
                    LKR {grandTotal.toFixed(2)}
                  </span>
                </div>

                <button
                  onClick={handleCompleteOrder}
                  disabled={submitting}
                  className="w-full py-3 px-4 rounded-lg text-xs font-bold text-black cursor-pointer shadow-lg disabled:opacity-40 transition-all active:scale-98"
                  style={{ background: "var(--primary)" }}
                >
                  {submitting ? "Authorizing & Routing Order..." : `Confirm & Pay LKR ${grandTotal.toFixed(2)} →`}
                </button>
              </div>

              <div className="p-3.5 rounded-lg border text-[11px] text-muted-foreground" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
                When you click "Confirm & Pay", our backend Smart Allocation Engine will query real-time branch stock, distance, and workload to assign the order.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
