import { Router, Response } from "express";
import { classifyMessage } from "../services/classifier.js";
import { AuthRequest, optionalAuthenticate } from "../middleware/auth.js";

const router = Router();

// 10 Challenge sample questions from DartCodes assessment dataset
const CHALLENGE_SAMPLES = [
  { id: 441, message: "My payment is still pending", expectedHint: "Payment Issue" },
  { id: 442, message: "Where is my delivery?", expectedHint: "Delivery Issue" },
  { id: 443, message: "I want a refund for this order", expectedHint: "Refund/Cancellation" },
  { id: 444, message: "Is this product available today?", expectedHint: "Product/Stock Inquiry" },
  { id: 445, message: "Can you check my order status?", expectedHint: "Order Status Inquiry" },
  { id: 446, message: "I cannot log into my account", expectedHint: "Account/Login Issue" },
  { id: 447, message: "Why is my promo code not working?", expectedHint: "Promotion/Discount Inquiry" },
  { id: 449, message: "I was charged twice", expectedHint: "Payment Issue" },
  { id: 450, message: "Can I change my delivery address?", expectedHint: "Delivery Issue" },
  { id: 999, message: "My payment was deducted, but my order is not showing.", expectedHint: "PDF Example (Payment Issue)" },
];

// POST /api/ai/classify - Classify customer message or note
router.post("/classify", optionalAuthenticate, (req: AuthRequest, res: Response): void => {
  const { message, threshold } = req.body;

  if (typeof message !== "string") {
    res.status(400).json({ success: false, error: "String 'message' parameter is required." });
    return;
  }

  const th = typeof threshold === "number" ? threshold : 0.60;
  const result = classifyMessage(message, th);

  res.json({
    success: true,
    message,
    category: result.category,
    confidence: result.confidence,
    confidencePercentage: Math.round(result.confidence * 100),
    lowConfidence: result.lowConfidence,
    status: result.status,
    allScores: result.scores,
  });
});

// GET /api/ai/challenge-samples - Challenge evaluation samples
router.get("/challenge-samples", (_req, res: Response): void => {
  res.json({
    success: true,
    samples: CHALLENGE_SAMPLES,
  });
});

// GET /api/ai/metrics - Model accuracy & metadata
router.get("/metrics", (_req, res: Response): void => {
  res.json({
    success: true,
    modelName: "TF-IDF (1-2 ngrams) + Multinomial Logistic Regression (Balanced)",
    dataset: "customer_inquiries.csv (450 samples)",
    crossValidation: "5-Fold Stratified CV",
    accuracy: "88.03% (+/- 3.77%)",
    categoriesCount: 8,
    classes: [
      "Account/Login Issue",
      "Delivery Issue",
      "General Inquiry",
      "Order Status Inquiry",
      "Payment Issue",
      "Product/Stock Inquiry",
      "Promotion/Discount Inquiry",
      "Refund/Cancellation"
    ],
    confidenceThreshold: 0.60,
  });
});

export default router;
