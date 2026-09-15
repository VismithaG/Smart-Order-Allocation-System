import argparse
import json
import os
import re
import numpy as np

def clean_text(text):
    if not text:
        return ""
    text = str(text).strip()
    text = re.sub(r'\s+', ' ', text)
    return text

def tokenize(text, ngram_range=(1, 2)):
    # Standard scikit-learn pattern: r'(?u)\b\w+\b'
    words = re.findall(r'\b\w+\b', text.lower())
    tokens = []
    min_n, max_n = ngram_range
    n_words = len(words)
    for n in range(min_n, max_n + 1):
        for i in range(n_words - n + 1):
            tokens.append(" ".join(words[i:i + n]))
    return tokens

def predict(message, weights_path=None, threshold=0.60):
    if weights_path is None:
        weights_path = os.path.join(os.path.dirname(__file__), "model_weights.json")

    with open(weights_path, "r") as f:
        weights = json.load(f)

    classes = weights["classes"]
    vocab = weights["vocabulary"]
    idf = np.array(weights["idf"])
    coef = np.array(weights["coefficients"])
    intercept = np.array(weights["intercept"])
    ngram_range = tuple(weights["ngram_range"])
    sublinear_tf = weights.get("sublinear_tf", True)

    cleaned = clean_text(message)
    if not cleaned:
        return {
            "message": message,
            "predicted_category": "General Inquiry",
            "confidence": 0.0,
            "low_confidence_flag": True,
            "status": "Escalate to Human Agent (Empty message)",
            "all_scores": {c: 0.0 for c in classes}
        }

    tokens = tokenize(cleaned, ngram_range)
    term_counts = {}
    for t in tokens:
        if t in vocab:
            idx = vocab[t]
            term_counts[idx] = term_counts.get(idx, 0) + 1

    feature_vec = np.zeros(len(vocab))
    for idx, count in term_counts.items():
        tf = (1.0 + np.log(count)) if (sublinear_tf and count > 0) else float(count)
        feature_vec[idx] = tf * idf[idx]

    norm = np.linalg.norm(feature_vec)
    if norm > 0:
        feature_vec = feature_vec / norm

    logits = np.dot(coef, feature_vec) + intercept
    exp_logits = np.exp(logits - np.max(logits))
    probs = exp_logits / np.sum(exp_logits)

    best_idx = int(np.argmax(probs))
    best_cat = classes[best_idx]
    confidence = float(probs[best_idx])
    low_confidence = confidence < threshold

    scores = {classes[i]: round(float(probs[i]), 4) for i in range(len(classes))}

    return {
        "message": message,
        "predicted_category": best_cat,
        "confidence": round(confidence, 4),
        "low_confidence_flag": low_confidence,
        "status": "Escalate to Human Agent (Low Confidence)" if low_confidence else "Auto-Triage Confirmed",
        "all_scores": scores
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Predict category for customer inquiry")
    parser.add_argument("--message", type=str, required=True, help="Customer inquiry message")
    parser.add_argument("--threshold", type=float, default=0.60, help="Confidence threshold (default: 0.60)")
    args = parser.parse_args()

    result = predict(args.message, threshold=args.threshold)
    print(json.dumps(result, indent=2))
