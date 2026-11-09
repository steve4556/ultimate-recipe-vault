
# 🏛️ The Ultimate Recipe Vault

**A high-performance, interactive digital cookbook and meal-planning dashboard built with vanilla HTML, CSS, and JavaScript.**

🔗 **[Explore the Live Vault](https://github.io)**

---

## ✨ Key Features

* **🔍 Instant Search & Quick Jump.** Filter recipes in real time by title or description, or jump straight to any dish using the alphabetized dropdown selector.
* **❤️ Persistent Favorites.** Save your go-to meals with a single click—powered by `localStorage` so your favorites stay saved across browser sessions.
* **⚖️ Dynamic Portion Scaling.** Scale ingredient quantities between **1x**, **2x**, and **4x** inside any recipe view, complete with interactive click-to-check ingredient lists.
* **🎲 Automated Daily Menu Generator.** Generate a randomized 5-course daily menu (Breakfast, Appetizer, Lunch, Dinner, and Dessert) with one-click re-rolling.
* **🥗 Calorie-Controlled Meal Planner.** Use an interactive calorie slider (`150 kcal` – `800 kcal`) to dynamically build custom daily menus tailored to your macro goals.
* **⚡ Infinite Scroll & Lazy Rendering.** Built to scale smoothly to 1,000+ recipes by rendering cards in batches of 12 as you scroll.
* **📁 Multi-Folder Image Architecture.** Automatically resolves recipe photos across sequential image directories (`images/`, `images2/`, `images3/`, etc.) without requiring manual path updates in the JSON database.

---

## 🛠️ Tech Stack

* **Frontend:** HTML5, CSS3 (Custom Grid & Responsive Vault Theme), Vanilla JavaScript (ES6+)
* **Data Layer:** Structured `recipes.json` flat-file database
* **Storage & APIs:** Browser `localStorage` API, `IntersectionObserver` API (for infinite scrolling), `Fetch` API
* **Hosting:** GitHub Pages

---

## 📂 Project Structure

```text
ultimate-recipe-vault/
├── index.html          # Main dashboard layout and fullscreen recipe overlay
├── style.css           # Fort Knox Gold & Slate responsive styling
├── script.js           # Search, filtering, portion scaling, meal generators & image fallback logic
├── recipes.json        # Master recipe database (titles, macros, ingredients, instructions)
├── images/             # Primary image batch (Recipes 1–100)
├── images2/            # Secondary image batch (Recipes 101–200)
└── README.md           # Project documentation
```

---

## 🚀 Adding New Recipes

1. **Add the Image.** Drop a compressed `.jpg` or `.webp` photo into the current active image folder (`images/`, `images2/`, etc.) using a lowercase, hyphenated filename (e.g., `garlic-butter-salmon.jpg`).
2. **Update `recipes.json`.** Append a new recipe object to the JSON array:
   ```json
   {
     "id": "unique-recipe-id",
     "emoji": "🍽️",
     "title": "Recipe Title",
     "image": "garlic-butter-salmon.jpg",
     "subtitle": "Short appetizing summary.",
     "times": { "prep": "10 mins", "cook": "15 mins", "servings": "4 people" },
     "nutrition": { "calories": 400, "protein": 30, "carbs": 15, "fats": 22 },
     "highlights": [
       { "category": "Highlight Title", "text": "Key nutritional or flavor takeaway." }
     ],
     "ingredients": [
       "1 lb main ingredient"
     ],
     "instructions": [
       "Step-by-step cooking instruction."
     ]
   }
   ```
3. **Push to GitHub.** Commit and push your changes—the vault will automatically alphabetize the new dish and resolve its image folder.

---

## 📄 License

This project is open-source and available for personal use and culinary inspiration.
