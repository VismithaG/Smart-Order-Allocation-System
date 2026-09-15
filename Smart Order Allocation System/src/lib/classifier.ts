import type { ClassificationResult, MessageCategory } from "./types";

const CATEGORIES: MessageCategory[] = [
  "Order Status Inquiry",
  "Delivery Issue",
  "Payment Issue",
  "Account/Login Issue",
  "Refund/Cancellation",
  "Promotion/Discount Inquiry",
  "Product/Stock Inquiry",
  "General Inquiry",
];

// Keyword weights derived from CSV dataset analysis
const KEYWORD_MAP: Record<MessageCategory, string[]> = {
  "Order Status Inquiry": [
    "order", "status", "happening", "prepared", "preparing", "ready", "confirm",
    "confirmation", "placed", "progress", "when", "update", "track my order",
    "check my order", "still processing", "accepted",
  ],
  "Delivery Issue": [
    "delivery", "deliver", "delivered", "courier", "rider", "driver", "address",
    "location", "delayed", "delay", "late", "arrived", "tracking", "shipping",
    "route", "sent out", "on the way", "not arrived",
  ],
  "Payment Issue": [
    "payment", "pay", "paid", "charge", "charged", "double charge", "deducted",
    "transaction", "bank", "failed", "fail", "gateway", "card", "amount",
    "refund payment", "wallet", "balance",
  ],
  "Account/Login Issue": [
    "account", "login", "log in", "password", "reset", "otp", "verification",
    "verify", "access", "locked", "sign in", "username", "email", "register",
    "cannot access", "not working", "link expired",
  ],
  "Refund/Cancellation": [
    "refund", "cancel", "cancellation", "cancelled", "return", "money back",
    "reimburse", "reimbursement", "credit", "void", "undo", "reverse",
  ],
  "Promotion/Discount Inquiry": [
    "promo", "promotion", "discount", "offer", "voucher", "coupon", "code",
    "deal", "sale", "loyalty", "reward", "points", "redeem", "cashback",
    "combine", "special offer", "not working", "expired code",
  ],
  "Product/Stock Inquiry": [
    "available", "availability", "stock", "menu", "product", "item", "flavour",
    "flavor", "size", "topping", "pearls", "milk", "dairy", "ingredient",
    "customize", "customise", "add-on", "sugar level", "chocolate", "taro",
    "matcha", "mango", "brown sugar",
  ],
  "General Inquiry": [
    "hours", "opening", "closing", "branch", "location", "address", "contact",
    "phone", "email", "app", "website", "social", "instagram", "facebook",
    "currency", "accept", "near me", "parking", "wifi", "dine in",
  ],
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function scoreCategoryForMessage(message: string, keywords: string[]): number {
  const lower = message.toLowerCase();
  const tokens = tokenize(message);
  let score = 0;

  for (const kw of keywords) {
    const kwTokens = kw.split(" ");
    if (kwTokens.length > 1) {
      if (lower.includes(kw)) score += 2.5;
    } else {
      if (tokens.includes(kw)) score += 1.5;
      else if (lower.includes(kw)) score += 0.8;
    }
  }
  return score;
}

export function classifyMessage(message: string): ClassificationResult {
  if (!message.trim()) {
    const empty: Record<MessageCategory, number> = {} as Record<MessageCategory, number>;
    CATEGORIES.forEach((c) => (empty[c] = 0));
    return {
      category: "General Inquiry",
      confidence: 0,
      scores: empty,
      lowConfidence: true,
    };
  }

  const rawScores: Record<MessageCategory, number> = {} as Record<MessageCategory, number>;
  let total = 0;

  for (const cat of CATEGORIES) {
    const s = scoreCategoryForMessage(message, KEYWORD_MAP[cat]);
    rawScores[cat] = s;
    total += s;
  }

  if (total === 0) {
    CATEGORIES.forEach((c) => (rawScores[c] = 1 / CATEGORIES.length));
    total = 1;
  }

  const normalised: Record<MessageCategory, number> = {} as Record<MessageCategory, number>;
  for (const cat of CATEGORIES) {
    normalised[cat] = rawScores[cat] / total;
  }

  const sorted = [...CATEGORIES].sort((a, b) => normalised[b] - normalised[a]);
  const best = sorted[0];
  const confidence = normalised[best];

  return {
    category: best,
    confidence,
    scores: normalised,
    lowConfidence: confidence < 0.4,
  };
}
