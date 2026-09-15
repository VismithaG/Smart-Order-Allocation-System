import { useState } from "react";
import { classifyMessage } from "../../lib/classifier";
import type { ClassificationResult, MessageCategory } from "../../lib/types";

const CATEGORY_ICONS: Record<MessageCategory, string> = {
  "Order Status Inquiry": "📦",
  "Delivery Issue": "🚚",
  "Payment Issue": "💳",
  "Account/Login Issue": "🔑",
  "Refund/Cancellation": "↩️",
  "Promotion/Discount Inquiry": "🏷️",
  "Product/Stock Inquiry": "🧋",
  "General Inquiry": "💬",
};

const SAMPLE_MESSAGES = [
  "Where is my order? It has been over an hour.",
  "My payment was deducted twice from my account.",
  "I cannot log in to my account, the OTP is not arriving.",
  "Can I cancel my order and get a refund?",
  "Is the brown sugar milk tea available at the Kandy branch?",
  "What are your opening hours on weekends?",
  "My promo code says it has expired but it should be valid.",
  "The delivery rider called me but I missed the call, now the order is missing.",
];

export default function MessageClassifier() {
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [history, setHistory] = useState<{ message: string; result: ClassificationResult }[]>([]);

  function classify() {
    if (!message.trim()) return;
    const r = classifyMessage(message);
    setResult(r);
    setHistory((prev) => [{ message, result: r }, ...prev.slice(0, 9)]);
  }

  function useSample(msg: string) {
    setMessage(msg);
    const r = classifyMessage(msg);
    setResult(r);
    setHistory((prev) => [{ message: msg, result: r }, ...prev.slice(0, 9)]);
  }

  const sorted = result
    ? (Object.entries(result.scores) as [MessageCategory, number][]).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>AI Message Classifier</h1>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wide" style={{ background: "#1a2d3d", color: "#4db8ff" }}>
            ML Bonus Feature
          </span>
        </div>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Automatically categorise incoming customer messages using a TF-IDF keyword classifier trained on 450 labelled messages.
        </p>
      </div>

      {/* Input */}
      <div className="rounded-lg border p-4 mb-5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-foreground)" }}>
          Customer Message
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) classify(); }}
          rows={3}
          placeholder="Type a customer message here…"
          className="w-full px-3 py-2 text-sm rounded-md border outline-none resize-none mb-3"
          style={{ background: "var(--muted)", borderColor: "var(--border)", color: "var(--foreground)" }}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Ctrl+Enter to classify</span>
          <button
            onClick={classify}
            disabled={!message.trim()}
            className="px-4 py-1.5 text-sm font-semibold rounded-md transition-opacity"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)", opacity: message.trim() ? 1 : 0.5 }}
          >
            Classify →
          </button>
        </div>
      </div>

      {/* Sample messages */}
      <div className="mb-5">
        <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-foreground)" }}>Sample Messages</div>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_MESSAGES.map((msg) => (
            <button
              key={msg}
              onClick={() => useSample(msg)}
              className="text-xs px-2.5 py-1 rounded-full border transition-colors"
              style={{ borderColor: "var(--border)", color: "var(--muted-foreground)", background: "transparent" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.color = "var(--foreground)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted-foreground)"; }}
            >
              {msg.length > 45 ? msg.slice(0, 45) + "…" : msg}
            </button>
          ))}
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="rounded-lg border p-4 mb-5" style={{ background: "var(--card)", borderColor: result.lowConfidence ? "#d4a017" : "var(--primary)" }}>
          {/* Primary result */}
          <div className="flex items-start gap-3 mb-4">
            <div className="text-3xl">{CATEGORY_ICONS[result.category]}</div>
            <div className="flex-1">
              <div className="font-semibold" style={{ color: "var(--foreground)" }}>{result.category}</div>
              <div className="text-xs mt-0.5 flex items-center gap-2">
                <span style={{ color: "var(--muted-foreground)" }}>Confidence:</span>
                <span className="font-mono font-semibold" style={{ color: result.lowConfidence ? "#d4a017" : "var(--primary)" }}>
                  {Math.round(result.confidence * 100)}%
                </span>
              </div>
              {/* Confidence bar */}
              <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.round(result.confidence * 100)}%`,
                    background: result.lowConfidence ? "#d4a017" : "var(--primary)",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Low confidence warning */}
          {result.lowConfidence && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-md mb-4 text-xs" style={{ background: "#2d2d1a", color: "#d4a017" }}>
              <span>⚠</span>
              <div>
                <strong>Low confidence prediction.</strong> The classifier is not certain about this classification.
                Consider routing this message to a human agent for review.
              </div>
            </div>
          )}

          {/* All scores */}
          <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-foreground)" }}>Score Breakdown</div>
          <div className="space-y-1.5">
            {sorted.map(([cat, score]) => {
              const pct = Math.round(score * 100);
              const isTop = cat === result.category;
              return (
                <div key={cat} className="flex items-center gap-2">
                  <span className="w-4 text-center">{CATEGORY_ICONS[cat]}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-[11px] mb-0.5">
                      <span style={{ color: isTop ? "var(--foreground)" : "var(--muted-foreground)", fontWeight: isTop ? 600 : 400 }}>{cat}</span>
                      <span className="font-mono" style={{ color: isTop ? "var(--primary)" : "var(--muted-foreground)" }}>{pct}%</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: isTop ? "var(--primary)" : "var(--secondary-foreground)", opacity: isTop ? 1 : 0.4 }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-foreground)" }}>Recent Classifications</div>
          <div className="space-y-1.5">
            {history.map((h, i) => (
              <button
                key={i}
                onClick={() => { setMessage(h.message); setResult(h.result); }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md border text-left transition-colors"
                style={{ background: "var(--card)", borderColor: "var(--border)" }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--border)"}
              >
                <span>{CATEGORY_ICONS[h.result.category]}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs truncate" style={{ color: "var(--foreground)" }}>{h.message}</div>
                  <div className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{h.result.category} · {Math.round(h.result.confidence * 100)}%{h.result.lowConfidence ? " · low confidence" : ""}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
