# 🏛️ The Ultimate Recipe Vault

**A full-stack, offline-capable digital cookbook, automated meal planner, and smart grocery engine engineered from the ground up.**

🔗 **[Launch the Live Vault](https://github.io)**

---

## 📖 About the Project

**The Ultimate Recipe Vault** started as a simple recipe page and evolved through countless hours of iterative engineering into a full-stack Progressive Web App (PWA). Every algorithm—from the kitchen-fraction portion scaler to the duplicate-merging grocery list parser and multi-tier Row Level Security database—was custom-written without heavy frontend frameworks.

---

## ✨ Key Features

### 🧠 Smart Kitchen & Grocery Engine
* **🛒 Master Grocery List & Duplicate Combiner:** Compiles ingredients across all favorited recipes into a single interactive checklist. Includes a custom NLP-style ingredient parser that normalizes measurement units (`cups`, `tbsp`, `oz`, `lbs`, `cloves`), strips prep notes, and mathematically merges duplicate items (e.g., combining `1/2 cup` + `1/4 cup` into `3/4 cup`).
* **⚖️ Fraction-Preserving Portion Scaling (`1x` – `8x`):** Dynamically recalculates ingredient quantities and serving counts in real time, converting raw decimals back into clean kitchen fractions (`1/4`, `1/3`, `1/2`, `2/3`, `3/4`).
* **📋 One-Click Clipboard Export:** Exports only your remaining unchecked items—cleanly formatted by dish or combined—straight to your phone's clipboard for effortless grocery runs.

### 🎲 Automated Meal Planning & Discovery
* **🎲 Vault Daily Menu Generator:** Instantly rolls a balanced 5-course menu (**Breakfast, Appetizer, Lunch, Dinner, and Dessert**) with one-click re-rolling and persistent browser history navigation.
* **🥗 Calorie-Controlled Custom Planner:** Features an interactive calorie slider (`150 kcal` – `800 kcal`) that filters the 90+ recipe database in real time to generate macro-safe daily menus.
* **🔍 Multi-Layer Search & Category Ribbon:** Search simultaneously across recipe titles, descriptions, and individual ingredients while filtering by meal category or saved favorites.

### 🔐 Full-Stack Cloud Sync & Security
* **☁️ Hybrid Cloud & Guest Storage:** Works immediately for guests via `localStorage`, and seamlessly syncs favorites and saved portion multipliers across all devices when logged in via **Supabase Auth**.
* **🛡️ Hardened Row Level Security (RLS):** Protected at the PostgreSQL database layer with strict user-isolation policies, `CHECK` constraints, and email-verified admin write locks.
* **📸 In-Browser Admin CMS & Photo Optimizer:** Authenticated admin interface for adding and deleting cloud recipes on the fly, featuring an HTML5 Canvas image compressor that automatically resizes and optimizes uploads before sending them to Supabase Storage.

### ⚡ Performance & Offline PWA Architecture
* **📱 Installable Progressive Web App (PWA):** Includes a full `manifest.json` and a **network-first Service Worker** (`sw.js`) that delivers instant updates when online while keeping the core vault and recipes accessible offline.
* **♾️ Infinite Scroll & Multi-Directory Image Fallback:** Uses the `IntersectionObserver` API to render cards smoothly in batches of 12 and automatically resolves photos across sequential asset directories (`images/` through `images12/`).

---

## 🛠️ Tech Stack

* **Frontend:** Semantic HTML5, Responsive CSS3 (Custom Fort Knox Gold & Slate Grid System), Vanilla JavaScript (ES6+)
* **Backend & Auth:** Supabase (PostgreSQL, Row Level Security, Auth, Storage Buckets)
* **Offline & Browser APIs:** Service Worker API, Web App Manifest (PWA), HTML5 Canvas API (client-side image compression), IntersectionObserver API, History API, Clipboard API
* **Data Layer:** Hybrid flat-file `recipes.json` (90+ curated dishes) merged dynamically with cloud PostgreSQL records
* **Hosting:** GitHub Pages

---

## 📂 Project Structure

```text
ultimate-recipe-vault/
├── index.html          # Main dashboard layout, PWA meta tags & fullscreen modal overlay
├── styles.css          # Responsive Fort Knox Gold & Slate theme (Desktop, Tablet & Mobile)
├── script.js           # Core engine: search, fraction scaler, grocery combiner, auth & CMS
├── recipes.json        # Master static database (90+ recipes with full macros & instructions)
├── manifest.json       # PWA installation config, icons & standalone display settings
├── sw.js               # Network-first Service Worker for seamless updates & offline fallback
├── images/             # Primary image directory (with automatic fallback up to images12/)
└── README.md           # Project documentation
```

---

## 🔒 Copyright & Usage

**Copyright © 2026 Stephen Stinson. All Rights Reserved.**

This repository and its source code, custom algorithms, design architecture, and curated recipe database are proprietary and created for personal portfolio and demonstration purposes. Unauthorized copying, forking, redistribution, or commercial use of this code or content without explicit written permission is prohibited.
