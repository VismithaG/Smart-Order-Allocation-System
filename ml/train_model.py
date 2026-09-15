import json
import os
import re
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_score, cross_val_predict
from sklearn.metrics import classification_report, confusion_matrix

def clean_text(text):
    if pd.isna(text):
        return ""
    text = str(text).strip()
    # Normalize extra whitespace
    text = re.sub(r'\s+', ' ', text)
    return text

def main():
    csv_path = os.path.join(os.path.dirname(__file__), "..", "dataset", "customer_inquiries.csv")
    print(f"Loading dataset from: {csv_path}")
    df = pd.read_csv(csv_path)

    print(f"Total rows in dataset: {len(df)}")
    df['clean_message'] = df['message'].apply(clean_text)
    df['clean_category'] = df['category'].apply(lambda x: str(x).strip() if pd.notna(x) and str(x).strip() != "" else np.nan)

    # Separate unlabelled test queries (IDs 441-450)
    unlabelled_df = df[df['clean_category'].isna()].copy()
    print(f"Unlabelled evaluation samples: {len(unlabelled_df)}")

    # Clean training dataset
    train_df = df[df['clean_category'].notna() & (df['clean_message'] != "")].copy()
    print(f"Clean labelled training samples: {len(train_df)}")

    X_train = train_df['clean_message']
    y_train = train_df['clean_category']

    # TF-IDF Vectorizer
    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        sublinear_tf=True,
        min_df=1,
        lowercase=True,
        token_pattern=r'(?u)\b\w+\b'
    )
    
    # Logistic Regression with balanced class weights
    classifier = LogisticRegression(
        C=5.0,
        class_weight='balanced',
        max_iter=1000,
        random_state=42
    )

    # 5-fold Cross-Validation
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    X_tfidf = vectorizer.fit_transform(X_train)
    cv_scores = cross_val_score(classifier, X_tfidf, y_train, cv=cv, scoring='accuracy')
    y_pred_cv = cross_val_predict(classifier, X_tfidf, y_train, cv=cv)

    print("\n" + "="*50)
    print("5-FOLD CROSS-VALIDATION RESULTS")
    print("="*50)
    print(f"Mean Accuracy: {cv_scores.mean() * 100:.2f}% (+/- {cv_scores.std() * 2 * 100:.2f}%)")
    
    report = classification_report(y_train, y_pred_cv, digits=4)
    print("\nClassification Report:\n", report)

    # Fit on all training data
    classifier.fit(X_tfidf, y_train)

    # Predict on unlabelled evaluation samples
    print("\n" + "="*50)
    print("PREDICTIONS ON UNLABELLED EVALUATION SAMPLES (IDs 441-450)")
    print("="*50)
    unlabelled_results = []
    for idx, row in unlabelled_df.iterrows():
        msg = row['clean_message']
        if not msg:
            pred_cat = "General Inquiry"
            conf = 0.0
            low_conf = True
        else:
            vec = vectorizer.transform([msg])
            probs = classifier.predict_proba(vec)[0]
            best_idx = np.argmax(probs)
            pred_cat = classifier.classes_[best_idx]
            conf = float(probs[best_idx])
            low_conf = conf < 0.60
        
        print(f"ID {row['id']}: \"{msg}\" -> {pred_cat} (Confidence: {conf*100:.1f}%, Low Confidence: {low_conf})")
        unlabelled_results.append({
            "id": row['id'],
            "message": msg,
            "predicted_category": pred_cat,
            "confidence": round(conf, 4),
            "low_confidence_flag": low_conf
        })

    # Save unlabelled predictions
    pred_path = os.path.join(os.path.dirname(__file__), "unlabelled_predictions.json")
    with open(pred_path, "w") as f:
        json.dump(unlabelled_results, f, indent=2)

    # Save evaluation report
    report_path = os.path.join(os.path.dirname(__file__), "evaluation_report.txt")
    with open(report_path, "w") as f:
        f.write("Smart Order Allocation System - AI Customer Inquiry Classifier Report\n")
        f.write("="*70 + "\n\n")
        f.write(f"Dataset: customer_inquiries.csv\n")
        f.write(f"Total training samples: {len(train_df)}\n")
        f.write(f"Number of classes: {len(classifier.classes_)}\n")
        f.write(f"5-Fold CV Accuracy: {cv_scores.mean() * 100:.2f}% (+/- {cv_scores.std() * 2 * 100:.2f}%)\n\n")
        f.write("Classification Report:\n" + report + "\n")

    # Export model weights for lightweight high-performance inference in Node.js backend
    model_weights = {
        "classes": classifier.classes_.tolist(),
        "vocabulary": {k: int(v) for k, v in vectorizer.vocabulary_.items()},
        "idf": vectorizer.idf_.tolist(),
        "coefficients": classifier.coef_.tolist(),
        "intercept": classifier.intercept_.tolist(),
        "ngram_range": list(vectorizer.ngram_range),
        "sublinear_tf": True
    }

    weights_path = os.path.join(os.path.dirname(__file__), "model_weights.json")
    with open(weights_path, "w") as f:
        json.dump(model_weights, f)
    print(f"\nModel weights successfully saved to: {weights_path}")
    print(f"Vocabulary size: {len(vectorizer.vocabulary_)} features")
    print("Training and export complete!")

if __name__ == "__main__":
    main()
