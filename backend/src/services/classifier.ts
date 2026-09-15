import fs from "node:fs";
import path from "node:path";
import type { ClassificationResult, MessageCategory } from "../types.js";

interface ModelWeights {
  classes: MessageCategory[];
  vocabulary: Record<string, number>;
  idf: number[];
  coefficients: number[][];
  intercept: number[];
  ngram_range: [number, number];
  sublinear_tf: boolean;
}

let weights: ModelWeights | null = null;

function loadWeights(): ModelWeights | null {
  if (weights) return weights;

  // Try multiple resolution paths
  const possiblePaths = [
    path.resolve(process.cwd(), "src/services/model_weights.json"),
    path.resolve(process.cwd(), "../ml/model_weights.json"),
    path.resolve(process.cwd(), "ml/model_weights.json"),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const data = fs.readFileSync(p, "utf-8");
        weights = JSON.parse(data) as ModelWeights;
        return weights;
      } catch (e) {
        console.error("Error reading model weights from:", p, e);
      }
    }
  }

  console.warn("Model weights JSON not found in standard paths. Fallback will be used.");
  return null;
}

function cleanText(text: string): string {
  if (!text) return "";
  return text.trim().replace(/\s+/g, " ");
}

function tokenize(text: string, ngramRange: [number, number] = [1, 2]): string[] {
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  const tokens: string[] = [];
  const [minN, maxN] = ngramRange;
  const nWords = words.length;

  for (let n = minN; n <= maxN; n++) {
    for (let i = 0; i <= nWords - n; i++) {
      tokens.push(words.slice(i, i + n).join(" "));
    }
  }
  return tokens;
}

const DEFAULT_CATEGORIES: MessageCategory[] = [
  "Order Status Inquiry",
  "Delivery Issue",
  "Payment Issue",
  "Account/Login Issue",
  "Refund/Cancellation",
  "Promotion/Discount Inquiry",
  "Product/Stock Inquiry",
  "General Inquiry",
];

/**
 * Classifies customer inquiry or order note using trained scikit-learn Logistic Regression weights.
 * Applies TF-IDF vectorization with sublinear scaling and L2 normalization followed by softmax.
 */
export function classifyMessage(message: string, threshold = 0.60): ClassificationResult {
  const model = loadWeights();
  const cleaned = cleanText(message);

  if (!cleaned) {
    const zeroScores: Record<MessageCategory, number> = {} as any;
    const cats = model ? model.classes : DEFAULT_CATEGORIES;
    cats.forEach((c) => (zeroScores[c] = 0));
    return {
      category: "General Inquiry",
      confidence: 0,
      scores: zeroScores,
      lowConfidence: true,
      status: "Escalate to Human Review (Empty Message)",
    };
  }

  // If trained model weights are available
  if (model) {
    const { classes, vocabulary, idf, coefficients, intercept, ngram_range, sublinear_tf } = model;
    const tokens = tokenize(cleaned, ngram_range);

    // Count term frequencies for known vocab terms
    const termCounts: Record<number, number> = {};
    for (const t of tokens) {
      if (t in vocabulary) {
        const idx = vocabulary[t];
        termCounts[idx] = (termCounts[idx] || 0) + 1;
      }
    }

    const nVocab = Object.keys(vocabulary).length;
    const featureVec = new Float64Array(nVocab);
    let sumSquares = 0;

    for (const [idxStr, count] of Object.entries(termCounts)) {
      const idx = Number(idxStr);
      const tf = sublinear_tf && count > 0 ? 1.0 + Math.log(count) : count;
      const val = tf * idf[idx];
      featureVec[idx] = val;
      sumSquares += val * val;
    }

    // L2 normalize vector
    const norm = Math.sqrt(sumSquares);
    if (norm > 0) {
      for (let i = 0; i < nVocab; i++) {
        if (featureVec[i] !== 0) featureVec[i] /= norm;
      }
    }

    // Compute dot product for each class: z_c = coef_c . v + b_c
    const logits: number[] = new Array(classes.length);
    let maxLogit = -Infinity;
    for (let c = 0; c < classes.length; c++) {
      let z = intercept[c];
      const coefC = coefficients[c];
      for (const [idxStr] of Object.entries(termCounts)) {
        const idx = Number(idxStr);
        z += coefC[idx] * featureVec[idx];
      }
      logits[c] = z;
      if (z > maxLogit) maxLogit = z;
    }

    // Softmax
    let sumExp = 0;
    const expLogits: number[] = new Array(classes.length);
    for (let c = 0; c < classes.length; c++) {
      const e = Math.exp(logits[c] - maxLogit);
      expLogits[c] = e;
      sumExp += e;
    }

    let bestIdx = 0;
    let maxProb = -1;
    const scores: Record<MessageCategory, number> = {} as any;

    for (let c = 0; c < classes.length; c++) {
      const prob = sumExp > 0 ? expLogits[c] / sumExp : 0;
      scores[classes[c]] = Math.round(prob * 1000) / 1000;
      if (prob > maxProb) {
        maxProb = prob;
        bestIdx = c;
      }
    }

    const bestCat = classes[bestIdx];
    const confidence = Math.round(maxProb * 1000) / 1000;
    const lowConfidence = confidence < threshold;

    return {
      category: bestCat,
      confidence,
      scores,
      lowConfidence,
      status: lowConfidence
        ? `Escalate to Human Review (Confidence ${Math.round(confidence * 100)}% < ${threshold * 100}%)`
        : "Auto-Triage Confirmed",
    };
  }

  // Fallback heuristic if weights missing
  const fallbackScores: Record<MessageCategory, number> = {} as any;
  DEFAULT_CATEGORIES.forEach((c) => (fallbackScores[c] = 1 / DEFAULT_CATEGORIES.length));
  return {
    category: "General Inquiry",
    confidence: 0.5,
    scores: fallbackScores,
    lowConfidence: true,
    status: "Model weights unavailable - Manual Review Required",
  };
}
