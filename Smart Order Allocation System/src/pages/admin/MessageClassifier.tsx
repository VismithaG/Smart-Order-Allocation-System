import { useEffect, useState } from "react";
import { api } from "../../lib/api";

const CATEGORY_COLORS: Record<string, string> = {
  "Order Status Inquiry": "#38bdf8",
  "Delivery Issue": "#fb923c",
  "Payment Issue": "#f87171",
  "Account/Login Issue": "#c084fc",
  "Refund/Cancellation": "#e879f9",
  "Promotion/Discount Inquiry": "#facc15",
  "Product/Stock Inquiry": "#4ade80",
  "General Inquiry": "#94a3b8",
};

export default function MessageClassifier() {
  const [message, setMessage] = useState("My payment was deducted, but my order is not showing.");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [challengeSamples, setChallengeSamples] = useState<{ id: number; message: string; expectedHint: string }[]>([]);
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    // Load challenge samples & metrics from backend
    api.ai.challengeSamples()
      .then((res) => {
        if (res.success && res.samples) setChallengeSamples(res.samples);
      })
      .catch(() => {});

    api.ai.metrics()
      .then((res) => {
        if (res.success) setMetrics(res);
      })
      .catch(() => {});

    // Initial classification
    handleClassify("My payment was deducted, but my order is not showing.");
  }, []);

  async function handleClassify(textToClassify?: string) {
    const text = textToClassify !== undefined ? textToClassify : message;
    if (!text.trim()) return;

    setLoading(true);
    try {
      const res = await api.ai.classify(text);
      if (res.success) {
        setResult(res);
      }
    } catch (err: any) {
      console.error("Classification error:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectSample(sample: { id: number; message: string; expectedHint: string }) {
    setMessage(sample.message);
    handleClassify(sample.message);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
            AI Customer Inquiry Classification & Triage Workbench
          </h1>
        </div>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          Machine learning pipeline trained on the 450-record dataset. Automatically categorizes customer messages and order notes with confidence calibration.
        </p>
      </div>

      {/* Model Specs Banner */}
      <div className="rounded-lg border p-4 text-xs grid grid-cols-2 sm:grid-cols-4 gap-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div>
          <span className="text-muted-foreground block text-[10px] uppercase">Model Algorithm</span>
          <span className="font-semibold text-primary">TF-IDF + Logistic Regression</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[10px] uppercase">Validation Accuracy</span>
          <span className="font-semibold text-emerald-400 font-mono">88.03% (5-Fold CV)</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[10px] uppercase">Classes Trained</span>
          <span className="font-semibold text-foreground font-mono">8 Categories</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[10px] uppercase">Confidence Threshold</span>
          <span className="font-semibold text-amber-400 font-mono">&lt; 60% Escalate</span>
        </div>
      </div>

      {/* Challenge Dataset Samples (One-Click Testing) */}
      <div className="rounded-lg border p-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>
          DartCodes Assessment Challenge Queries (Click any to test):
        </div>
        <div className="flex flex-wrap gap-2">
          {challengeSamples.map((s) => (
            <button
              key={s.id}
              onClick={() => handleSelectSample(s)}
              className="px-2.5 py-1 text-xs rounded-md border text-left cursor-pointer transition-colors hover:border-primary"
              style={{
                borderColor: message === s.message ? "var(--primary)" : "var(--border)",
                background: message === s.message ? "var(--muted)" : "transparent",
                color: "var(--foreground)",
              }}
            >
              <span className="font-mono text-[10px] text-muted-foreground mr-1">#{s.id}</span>
              "{s.message}"
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Box */}
        <div className="rounded-lg border p-5 space-y-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <label className="block text-xs font-semibold" style={{ color: "var(--foreground)" }}>
            Customer Message or Order Note:
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="Type any customer message, order inquiry, or complaint here…"
            className="w-full p-3 text-sm rounded-md border outline-none resize-none font-sans"
            style={{ background: "var(--muted)", borderColor: "var(--border)", color: "var(--foreground)" }}
          />

          <button
            onClick={() => handleClassify()}
            disabled={loading || !message.trim()}
            className="w-full py-2.5 px-4 rounded-md text-sm font-medium text-white cursor-pointer disabled:opacity-40 transition-opacity"
            style={{ background: "var(--primary)" }}
          >
            {loading ? "Classifying with ML Engine..." : "Analyze & Classify Message →"}
          </button>

          <p className="text-[11px] text-muted-foreground">
            The model applies sublinear TF-IDF vectorization across unigrams and bigrams, computing calibrated class probabilities via softmax.
          </p>
        </div>

        {/* Prediction Results & Confidence Breakdown */}
        <div className="rounded-lg border p-5 space-y-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--muted-foreground)" }}>
            Inference Output & Class Probability Distribution
          </div>

          {result ? (
            <div className="space-y-4">
              {/* Top Prediction Card */}
              <div
                className="p-4 rounded-lg border"
                style={{
                  background: "var(--muted)",
                  borderColor: result.lowConfidence ? "#f59e0b" : "var(--primary)",
                }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                      Predicted Category
                    </span>
                    <div
                      className="text-lg font-bold mt-0.5"
                      style={{ color: CATEGORY_COLORS[result.category] || "var(--foreground)" }}
                    >
                      {result.category}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                      Confidence
                    </span>
                    <div className="text-xl font-mono font-bold" style={{ color: "var(--foreground)" }}>
                      {result.confidencePercentage}%
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="mt-3 pt-2 border-t flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
                  <span className="text-xs text-muted-foreground">Triage Decision:</span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      result.lowConfidence
                        ? "bg-amber-950/60 text-amber-300 border border-amber-800"
                        : "bg-emerald-950/60 text-emerald-300 border border-emerald-800"
                    }`}
                  >
                    {result.status}
                  </span>
                </div>
              </div>

              {/* Low confidence warning if applicable */}
              {result.lowConfidence && (
                <div className="p-3 rounded-md bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200">
                  ⚠️ <strong>Low Confidence Alert:</strong> The classification score ({result.confidencePercentage}%) is below the safety threshold (60%). In production, this inquiry is routed to a human support agent for manual triage rather than automated resolution.
                </div>
              )}

              {/* Probabilities across all 8 classes */}
              <div className="space-y-2 pt-1">
                <div className="text-[11px] font-semibold text-muted-foreground">Class Probability Spectrum:</div>
                {result.allScores &&
                  Object.entries(result.allScores)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([cat, score]: [string, any]) => {
                      const pct = Math.round(score * 100);
                      const isTop = cat === result.category;

                      return (
                        <div key={cat} className="space-y-0.5">
                          <div className="flex justify-between text-xs">
                            <span style={{ color: isTop ? "var(--foreground)" : "var(--muted-foreground)", fontWeight: isTop ? 600 : 400 }}>
                              {cat}
                            </span>
                            <span className="font-mono text-[11px]" style={{ color: isTop ? "var(--primary)" : "var(--muted-foreground)" }}>
                              {pct}%
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden bg-muted">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${pct}%`,
                                background: CATEGORY_COLORS[cat] || "var(--primary)",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Enter a message and click analyze to see predictions.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
