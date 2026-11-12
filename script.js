const gridContainer = document.getElementById("recipe-grid-container");
const navDropdown = document.getElementById("recipe-selector");
const overlay = document.getElementById("fullscreen-overlay");
const closeOverlayBtn = document.getElementById("close-overlay");
const searchInput = document.getElementById("recipe-search");
const toggleFavoritesBtn = document.getElementById("toggle-favorites");
const loadMoreBtn = document.getElementById("load-more-btn");
const loadMoreContainer = document.getElementById("load-more-container");

// Track active filters and visibility limits globally
let showFavoritesOnly = false;
let activeCategory = "all"; // Tracks "all", "breakfast", "appetizer", "lunch", "dinner", or "dessert"
let combineGroceryItems = false; // Toggles Master Grocery List between "By Recipe" and "Combined"
let myRecipes = []; 
let visibleCount = 12; // 🧠 Change this number to control how many cards show up first!
let healthyModalMaxCalories = 500; // Tracks the interactive slider inside the healthy modal

// --- NAVIGATION & HISTORY STATE TRACKING ---
let returnToView = null;        // Tracks "random-menu" or "healthy-menu" when clicking a meal card
let lastRandomMenuPicks = null; // Saves the rolled dishes so going "Back" keeps your exact menu
let lastHealthyMenuPicks = null;
let isHandlingPopState = false; // Prevents duplicate history entries when pressing browser Back

// --- LOCAL STORAGE HELPERS FOR FAVORITES ---
function getFavorites() {
    const favs = localStorage.getItem("vault_favorites");
    return favs ? JSON.parse(favs) : [];
}

function toggleFavorite(recipeId) {
    let favs = getFavorites();
    if (favs.includes(recipeId)) {
        favs = favs.filter(id => id !== recipeId);
    } else {
        favs.push(recipeId);
    }
    localStorage.setItem("vault_favorites", JSON.stringify(favs));
}
// Helper to convert decimals back to readable kitchen fractions
    function formatKitchenFraction(num) {
        const whole = Math.floor(num);
        const remainder = num - whole;
        const fractions = [
            { val: 0.25, str: "1/4" },
            { val: 0.33, str: "1/3" },
            { val: 0.5,  str: "1/2" },
            { val: 0.67, str: "2/3" },
            { val: 0.75, str: "3/4" }
        ];

        for (let f of fractions) {
            if (Math.abs(remainder - f.val) < 0.04) {
                return whole > 0 ? `${whole} ${f.str}` : f.str;
            }
        }
        return parseFloat(num.toFixed(2));
    }

    function multiplyIngredientQuantity(ingredientString, factor) {
        return ingredientString.replace(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(\.\d+)?)/, match => {
            let parts = match.trim().split(/\s+/);
            let num = 0;
            parts.forEach(p => {
                if (p.includes('/')) {
                    let frags = p.split('/');
                    num += parseFloat(frags[0]) / parseFloat(frags[1]);
                } else {
                    num += parseFloat(p);
                }
            });
            return formatKitchenFraction(num * factor);
        });
    }

    // --- INGREDIENT PARSER & COMBINER FOR MASTER GROCERY LIST ---
function parseIngredientLine(ingredientString, factor = 1) {
    // 1. Extract leading quantity (handles "1 1/2", "1/2", "2", "1.5")
    const qtyMatch = ingredientString.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(\.\d+)?)\s*(.*)$/);
    if (!qtyMatch) {
        return { quantity: null, unit: "", item: ingredientString.trim(), raw: ingredientString.trim() };
    }

    // Convert fraction string to decimal and multiply by recipe scale
    let parts = qtyMatch[1].trim().split(/\s+/);
    let num = 0;
    parts.forEach(p => {
        if (p.includes('/')) {
            let frags = p.split('/');
            num += parseFloat(frags[0]) / parseFloat(frags[1]);
        } else {
            num += parseFloat(p);
        }
    });
    const scaledQty = num * factor;
    let remainderText = qtyMatch[3].trim();

    // 2. Normalize common measurement units so singular/plural match
    const unitMap = {
        "cup": "cup", "cups": "cup",
        "tablespoon": "tablespoon", "tablespoons": "tablespoon", "tbsp": "tablespoon",
        "teaspoon": "teaspoon", "teaspoons": "teaspoon", "tsp": "teaspoon",
        "oz": "oz", "ounce": "oz", "ounces": "oz",
        "lb": "lb", "lbs": "lb", "pound": "lb", "pounds": "lb",
        "clove": "clove", "cloves": "clove",
        "can": "can", "cans": "can",
        "slice": "slice", "slices": "slice",
        "sprig": "sprig", "sprigs": "sprig",
        "stalk": "stalk", "stalks": "stalk",
        "pinch": "pinch", "pinches": "pinch",
        "stick": "stick", "sticks": "stick",
        "head": "head", "heads": "head",
        "package": "package", "packages": "package", "pkg": "package"
    };

    const words = remainderText.split(/\s+/);
    const firstWordClean = words[0].toLowerCase().replace(/[.,()]/g, "");
    let unit = "";
    let itemText = remainderText;

    if (unitMap[firstWordClean] && words.length > 1) {
        unit = unitMap[firstWordClean];
        itemText = words.slice(1).join(" ");
    }

    // 3. Strip prep instructions after commas or parentheses so matching ingredients merge cleanly
    const cleanName = itemText
        .split(",")[0]
        .replace(/\(.*?\)/g, "")
        .trim()
        .toLowerCase();

    return {
        quantity: scaledQty,
        unit: unit,
        item: cleanName,
        displayName: itemText.split(",")[0].replace(/\(.*?\)/g, "").trim()
    };
}

function buildCombinedIngredients(favoriteIds, savedMultipliers) {
    const combinedMap = new Map();

    favoriteIds.forEach(favId => {
        const recipe = myRecipes.find(r => r.id === favId);
        if (!recipe) return;

        const factor = savedMultipliers[recipe.id] || 1;

        recipe.ingredients.forEach(ing => {
            const parsed = parseIngredientLine(ing, factor);

            if (parsed.quantity === null) {
                // Non-numeric items like "Salt and pepper to taste"
                const key = `nonum_${parsed.item.toLowerCase()}`;
                if (!combinedMap.has(key)) {
                    combinedMap.set(key, { text: parsed.raw, count: 1 });
                }
                return;
            }

            // Group by normalized item name + unit
            const key = `${parsed.item}|${parsed.unit}`;
            if (combinedMap.has(key)) {
                combinedMap.get(key).quantity += parsed.quantity;
            } else {
                combinedMap.set(key, {
                    quantity: parsed.quantity,
                    unit: parsed.unit,
                    displayName: parsed.displayName
                });
            }
        });
    });

    // Format combined entries back into readable strings
    return Array.from(combinedMap.values()).map(entry => {
        if (entry.text) return entry.text;

        const formattedQty = formatKitchenFraction(entry.quantity);
        let unitLabel = entry.unit;

        // Pluralize unit when quantity > 1 (except "oz" and "lb")
        if (unitLabel && entry.quantity > 1 && unitLabel !== "oz" && unitLabel !== "lb") {
            unitLabel = unitLabel === "pinch" ? "pinches" : `${unitLabel}s`;
        }

        return unitLabel
            ? `${formattedQty} ${unitLabel} ${entry.displayName}`
            : `${formattedQty} ${entry.displayName}`;
    });
}

// --- LOCAL STORAGE HELPERS FOR PORTION MULTIPLIERS ---
function getSavedMultipliers() {
    const saved = localStorage.getItem("vault_multipliers");
    return saved ? JSON.parse(saved) : {};
}

function saveRecipeMultiplier(recipeId, factor) {
    const multipliers = getSavedMultipliers();
    if (factor === 1) {
        delete multipliers[recipeId]; // Keep storage clean when reset to 1x
    } else {
        multipliers[recipeId] = factor;
    }
    localStorage.setItem("vault_multipliers", JSON.stringify(multipliers));
}

function getRecipeCategory(recipe) {
    // 1. Explicit category override in recipes.json
    if (recipe.category) {
        return recipe.category.toLowerCase();
    }

    const titleText = `${recipe.id} ${recipe.title}`.toLowerCase();

    // 2. Breakfast
    if (
        (titleText.includes("egg") && !titleText.includes("eggplant") && !titleText.includes("deviled")) ||
        titleText.includes("omelette") ||
        titleText.includes("pancake") ||
        titleText.includes("biscuit") ||
        titleText.includes("scramble") ||
        titleText.includes("avocado-egg-toast") ||
        titleText.includes("benedict") ||
        titleText.includes("french-toast") ||
        titleText.includes("tamagoyaki") ||
        titleText.includes("shakshuka") ||
        titleText.includes("huevos") ||
        titleText.includes("cilbir")
    ) {
        return "breakfast";
    }

    // 3. Appetizer (Checked BEFORE dessert so savory tarts & hor d'oeuvres are caught first)
    if (
        titleText.includes("canape") ||
        titleText.includes("date") ||
        titleText.includes("spread") ||
        titleText.includes("appetizer") ||
        titleText.includes("fries") ||
        titleText.includes("dip") ||
        titleText.includes("crostini") ||
        titleText.includes("wings") ||
        titleText.includes("skins") ||
        titleText.includes("mushroom") ||
        titleText.includes("bruschetta") ||
        titleText.includes("gougeres") ||
        titleText.includes("baba-ganoush") ||
        titleText.includes("ceviche") ||
        titleText.includes("spanakopita") ||
        titleText.includes("hor d'oeuvres") ||
        titleText.includes("deviled") ||
        titleText.includes("onion-tart") ||
        titleText.includes("mushroom-tart") ||
        titleText.includes("goat-cheese-tart")
    ) {
        return "appetizer";
    }

    // 4. Dessert
    if (
        titleText.includes("muffin") ||
        titleText.includes("cookie") ||
        titleText.includes("brownie") ||
        titleText.includes("sorbet") ||
        titleText.includes("cake") ||
        (titleText.includes("pie") && !titleText.includes("chili") && !titleText.includes("pot-pie") && !titleText.includes("shepherd")) ||
        (titleText.includes("tart") && !titleText.includes("tart cherry") && !titleText.includes("tart-cherry")) ||
        titleText.includes("cobbler") ||
        (titleText.includes("crisp") && !titleText.includes("crispy") && !titleText.includes("salad")) ||
        titleText.includes("mousse") ||
        titleText.includes("tiramisu") ||
        titleText.includes("galette") ||
        titleText.includes("blondie") ||
        titleText.includes("clafoutis") ||
        titleText.includes("churro") ||
        titleText.includes("baklava") ||
        titleText.includes("panna-cotta") ||
        titleText.includes("affogato") ||
        titleText.includes("semifreddo") ||
        titleText.includes("crumble") ||
        (titleText.includes("bread") && !titleText.includes("flatbread") && !titleText.includes("cornbread")) ||
        (titleText.includes("loaf") && !titleText.includes("meatloaf"))
    ) {
        return "dessert";
    }

    // 5. Lunch
    if (
        titleText.includes("salad") ||
        titleText.includes("soup") ||
        titleText.includes("chili") ||
        titleText.includes("taco") ||
        titleText.includes("flatbread") ||
        titleText.includes("bowl") ||
        titleText.includes("sandwich") ||
        titleText.includes("wrap") ||
        titleText.includes("ribollita") ||
        titleText.includes("gambas")
    ) {
        return "lunch";
    }

    // 6. Dinner
    return "dinner";
}

// --- DYNAMIC DATA LOADER (REPLACES THE OLD DATA.JS FILE) ---
async function loadRecipeVaultData() {
    try {
        const response = await fetch('recipes.json');
        if (!response.ok) throw new Error("Could not find or read recipes.json");
        
        // 1. Download the raw data array
        const rawData = await response.json();
        
        // 2. 🚀 ALPHABETIZE ENTIRE VAULT AUTOMATICALLY BEFORE BUILDING CARDS
        myRecipes = rawData.sort((a, b) => a.title.localeCompare(b.title));
        
        // 3. Launch your vault layout engine with sorted records
        initApp();
    } catch (error) {
        console.error("Vault critical error loading data array:", error);
        gridContainer.innerHTML = `<p style="text-align:center; color:#ff4d4d; font-weight:bold;">
            🔒 Vault Error: Could not read recipes.json.
        </p>`;
    }
}

function handleImageFallback(imgElement, fileName, folderNum = 1) {
    const maxFolders = 12; // Increase this number as you add more folders (images13, images14, etc.)
    if (folderNum > maxFolders) {
        imgElement.onerror = null; // Stop searching if file doesn't exist anywhere
        return;
    }
    const folderName = folderNum === 1 ? "images" : `images${folderNum}`;
    imgElement.onerror = () => handleImageFallback(imgElement, fileName, folderNum + 1);
    imgElement.src = `${folderName}/${fileName}`;
}
function setupCategoryFilterBar() {
    // Only build the bar once
    if (document.getElementById("category-filter-bar")) return;

    const dashboardWrapper = document.querySelector(".dashboard-wrapper") || document.querySelector(".vault-control-panel")?.parentNode;
    if (!dashboardWrapper) return;

    const categories = [
        { id: "all",       label: "📋 All Recipes" },
        { id: "breakfast", label: "🍳 Breakfast" },
        { id: "appetizer", label: "🧅 Appetizers" },
        { id: "lunch",     label: "🥗 Lunch" },
        { id: "dinner",    label: "🍽️ Dinner" },
        { id: "dessert",   label: "🍪 Desserts" }
    ];

    const filterBar = document.createElement("div");
    filterBar.id = "category-filter-bar";
    filterBar.className = "category-filter-bar";

    filterBar.innerHTML = categories.map(cat => `
        <button class="category-btn ${cat.id === activeCategory ? "active-category" : ""}" data-category="${cat.id}">
            ${cat.label}
        </button>
    `).join("");

    filterBar.addEventListener("click", (e) => {
        const btn = e.target.closest(".category-btn");
        if (!btn) return;

        activeCategory = btn.getAttribute("data-category");
        visibleCount = 12; // Reset pagination limit when switching categories

        // Update active button highlight
        filterBar.querySelectorAll(".category-btn").forEach(b => b.classList.remove("active-category"));
        btn.classList.add("active-category");

        filterRecipes();
    });

    dashboardWrapper.appendChild(filterBar);
}

function initApp() {
    setupCategoryFilterBar();
    gridContainer.innerHTML = "";
    
    // Clear old options out of the dropdown to prevent duplicates on refresh
    navDropdown.innerHTML = '<option value="">-- Select a Dish --</option>';
    
    const currentFavorites = getFavorites();
    
    // 🚀 SCALING FIX: Populate the dropdown with ALL titles so users can search everything...
    myRecipes.forEach(recipe => {
        const option = document.createElement("option");
        option.value = recipe.id;
        option.textContent = `${recipe.emoji} ${recipe.title}`;
        navDropdown.appendChild(option);
    });

    const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
    // Filter the array based on text search, favorites, AND active category
    const filteredRecipes = myRecipes.filter(recipe => {
        const matchesTitle = recipe.title.toLowerCase().includes(query);
        const matchesSubtitle = recipe.subtitle.toLowerCase().includes(query);
        const matchesIngredients = recipe.ingredients.some(ing => ing.toLowerCase().includes(query));
        
        const matchesSearch = matchesTitle || matchesSubtitle || matchesIngredients;
        const matchesFavorites = !showFavoritesOnly || currentFavorites.includes(recipe.id);
        const matchesCategory = activeCategory === "all" || getRecipeCategory(recipe) === activeCategory;
        
        return matchesSearch && matchesFavorites && matchesCategory;
    });

    // Slice the filtered list down to your exact visible count limit
    const recipesToRender = filteredRecipes.slice(0, visibleCount);
    
    recipesToRender.forEach(recipe => {
        const cardWrapper = document.createElement("div");
        cardWrapper.className = "card-link";
        cardWrapper.setAttribute("data-id", recipe.id);
        
        const isFavorited = currentFavorites.includes(recipe.id);
        const heartEmoji = isFavorited ? "❤️" : "🖤";
        const heartLabel = isFavorited ? "Remove from favorites" : "Add to favorites";
        
        cardWrapper.innerHTML = `
            <section class="recipe-card">
                <button class="heart-btn" aria-label="${heartLabel}" data-recipe-id="${recipe.id}">${heartEmoji}</button>
                <h2>${recipe.emoji} ${recipe.title}</h2>
                <p>${recipe.subtitle}</p>
                <div>
                    <img src="images/${recipe.image}" 
                         onerror="handleImageFallback(this, '${recipe.image}', 2)" 
                         alt="${recipe.title}" 
                         class="recipe-photo">
                </div>
                <table>
                    <thead>
                        <tr><th>Prep Time</th><th>Cook Time</th><th>Servings</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>${recipe.times.prep}</td><td>${recipe.times.cook}</td><td>${recipe.times.servings}</td></tr>
                    </tbody>
                </table>
                <table>
                    <thead>
                        <tr><th>Calories</th><th>Protein</th><th>Carbs</th><th>Fats</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>${recipe.nutrition.calories} kcal</td><td>${recipe.nutrition.protein}g</td><td>${recipe.nutrition.carbs}g</td><td>${recipe.nutrition.fats}g</td></tr>
                    </tbody>
                </table>
                <p style="text-align:center; font-size:0.85rem; color:#d4af37; margin-top:15px; font-weight:bold;">
                    Click card to view details
                </p>
            </section>
        `;
        
        cardWrapper.addEventListener("click", (e) => {
            if (e.target.classList.contains("heart-btn") || e.target.closest(".heart-btn")) {
                e.stopPropagation();
                const targetBtn = e.target.classList.contains("heart-btn") ? e.target : e.target.closest(".heart-btn");
                const id = targetBtn.getAttribute("data-recipe-id");
                
                toggleFavorite(id);
                
                // Refresh the layout instantly when favorited/unfavorited
                initApp();
            } else {
                openDetailedView(recipe.id);
            }
        });
        
        gridContainer.appendChild(cardWrapper);
    });

    // Smart UI Manager: Hide the "Load More" button if there are no more recipes left to show
    if (loadMoreContainer) {
        if (filteredRecipes.length <= visibleCount) {
            loadMoreContainer.style.display = "none";
        } else {
            loadMoreContainer.style.display = "block";
        }
    }
}

function hideModalOnly() {
    overlay.classList.remove("is-active");
    document.body.classList.remove("modal-open");
    navDropdown.value = "";
    returnToView = null;
    if (closeOverlayBtn) closeOverlayBtn.textContent = "← Back to Main Menu";
}

function closeDetailedView() {
    // If we came from a meal planner, return directly to that saved menu!
    if (returnToView === "random-menu") {
        generateRandomMealPlan(true);
        return;
    }
    if (returnToView === "healthy-menu") {
        generateHealthyMealPlan(true);
        return;
    }

    // Otherwise, close the modal and clean up the URL hash
    hideModalOnly();
    if (!isHandlingPopState && window.location.hash) {
        history.pushState({ view: "vault" }, "", window.location.pathname + window.location.search);
    }
}

// --- BROWSER BACK / FORWARD BUTTON HANDLER ---
window.addEventListener("popstate", (e) => {
    isHandlingPopState = true;
    const state = e.state;

    if (!state || state.view === "vault") {
        hideModalOnly();
    } else if (state.view === "random-menu") {
        generateRandomMealPlan(true);
    } else if (state.view === "healthy-menu") {
        generateHealthyMealPlan(true);
    } else if (state.view === "grocery-list") {
        generateMasterShoppingList();
    } else if (state.view === "recipe" && state.recipeId) {
        openDetailedView(state.recipeId, state.returnTo || null);
    }

    isHandlingPopState = false;
});

function openDetailedView(recipeId, sourceView = null) {
    const targetRecipe = myRecipes.find(r => r.id === recipeId);
    if (!targetRecipe) return;

    // Remember if we came from a meal planner so "Back" returns there
    returnToView = sourceView;

    // Push browser history state unless triggered by the browser's Back button
    if (!isHandlingPopState) {
        history.pushState({ view: "recipe", recipeId: recipeId, returnTo: sourceView }, "", `#recipe-${recipeId}`);
    }

    // Update the Back button label based on where the user came from
    if (closeOverlayBtn) {
        if (returnToView === "random-menu") {
            closeOverlayBtn.textContent = "← Back to Daily Menu";
        } else if (returnToView === "healthy-menu") {
            closeOverlayBtn.textContent = "← Back to Custom Menu";
        } else {
            closeOverlayBtn.textContent = "← Back to Main Menu";
        }
    }

    // Reset layout view content slots cleanly before rendering text parameters
    clearOverlayLayout();

    // Injects raw text parameters safely
    document.getElementById("overlay-title").textContent = `${targetRecipe.emoji} ${targetRecipe.title}`;
    document.getElementById("overlay-subtitle").textContent = targetRecipe.subtitle;
    
     const subtitleEl = document.getElementById("overlay-subtitle");
    const multiplierContainer = document.createElement("div");
    multiplierContainer.className = "multiplier-controls";
    multiplierContainer.innerHTML = `
        <span class="multiplier-label">Scale Portions:</span>
        <button class="scale-btn active-scale" data-factor="1">1x</button>
        <button class="scale-btn" data-factor="2">2x</button>
        <button class="scale-btn" data-factor="4">4x</button>
        <button class="scale-btn" data-factor="6">6x</button>
        <button class="scale-btn" data-factor="8">8x</button>
        <button id="copy-recipe-list-btn" class="modal-action-btn" style="margin-left: 10px;">📋 Copy List</button>
    `;
    subtitleEl.parentNode.insertBefore(multiplierContainer, subtitleEl.nextSibling);

    // Dynamically sets the large photo inside your full-screen overlay view panel layout
    let overlayImg = document.getElementById("overlay-photo");
    if (!overlayImg) {
        const imgDiv = document.createElement("div");
        imgDiv.style.textAlign = "center";
        imgDiv.style.marginBottom = "30px";
        imgDiv.innerHTML = `<img id="overlay-photo" class="recipe-photo">`;
        subtitleEl.parentNode.insertBefore(imgDiv, subtitleEl.nextSibling);
        overlayImg = document.getElementById("overlay-photo");
    }
    overlayImg.alt = targetRecipe.title;
    overlayImg.onerror = () => handleImageFallback(overlayImg, targetRecipe.image, 2);
    overlayImg.src = `images/${targetRecipe.image}`;

    // Bring back tables, list text nodes, and layout headers safely for normal card viewing
    const overlayTables = overlay.querySelectorAll("table");
    overlayTables.forEach(t => t.style.display = "");

    const allHeaders = overlay.querySelectorAll("h2");
    allHeaders.forEach(h => h.style.display = "");

    const ingredientsElement = document.getElementById("overlay-ingredients");
    ingredientsElement.style.display = "";
    document.getElementById("overlay-instructions").style.display = "";

    // Injects core structural metrics into table cells
    document.getElementById("table-prep").textContent = targetRecipe.times.prep;
    document.getElementById("table-cook").textContent = targetRecipe.times.cook;
    document.getElementById("table-servings").textContent = targetRecipe.times.servings;

    document.getElementById("table-calories").textContent = `${targetRecipe.nutrition.calories} kcal`;
    document.getElementById("table-protein").textContent = `${targetRecipe.nutrition.protein}g`;
    document.getElementById("table-carbs").textContent = `${targetRecipe.nutrition.carbs}g`;
    document.getElementById("table-fats").textContent = `${targetRecipe.nutrition.fats}g`;

    // Loops over Array elements to cleanly render bullet lists via String formatting
    const highlightsElement = document.getElementById("overlay-highlights");
    highlightsElement.innerHTML = targetRecipe.highlights.map(h => `
        <dt>*${h.category}</dt>
        <dd>${h.text}</dd>
    `).join("");

    

    // Scale servings text cleanly alongside ingredients
    function updateScaledServings(factor) {
        const baseServings = targetRecipe.times.servings;
        document.getElementById("table-servings").textContent = baseServings.replace(/^(\d+)/, match => {
            return parseInt(match) * factor;
        });
    }

    // Helper engine to draw your ingredient checkmarks with the multiplied fractions
     function renderIngredients(factor) {
        ingredientsElement.innerHTML = targetRecipe.ingredients.map(ing => {
            const scaledText = multiplyIngredientQuantity(ing, factor);
            return `
                <li class="checklist-item">
                    <span class="ing-text">${scaledText}</span>
                </li>
            `;
        }).join("");
    }

    const savedFactor = getSavedMultipliers()[targetRecipe.id] || 1;
    const scaleButtons = multiplierContainer.querySelectorAll(".scale-btn");
    scaleButtons.forEach(b => {
        const btnFactor = parseInt(b.getAttribute("data-factor"));
        b.classList.toggle("active-scale", btnFactor === savedFactor);
    });

    
    // Draw portions using the saved multiplier immediately
    renderIngredients(savedFactor);
    updateScaledServings(savedFactor);

    // Maintain your crisp green checkmark toggles seamlessly via structural event delegation
    ingredientsElement.onclick = (e) => {
        const listItem = e.target.closest(".checklist-item");
        if (!listItem) return;
        listItem.classList.toggle("checked");
        listItem.style.listStyleType = listItem.classList.contains("checked") ? "'✅ '" : "'⬜ '";
        listItem.style.textDecoration = listItem.classList.contains("checked") ? "line-through" : "none";
        listItem.style.opacity = listItem.classList.contains("checked") ? "0.45" : "1";
        listItem.style.color = listItem.classList.contains("checked") ? "#848d9e" : "#eeeeee";
    };

    // Listen to your portion multiplier button row interactions seamlessly
    scaleButtons.forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            
            // Re-map active button classes and switch visual styles seamlessly
            scaleButtons.forEach(b => {
                b.style.background = "#2d3238";
                b.style.color = "#fff";
                b.style.borderColor = "#848d9e";
            });
            btn.style.background = "#d4af37";
            btn.style.color = "#1c212a";
            btn.style.borderColor = "#d4af37";
            
            // Fetch multiplier factor, save to localStorage, and recalculate immediately
            const currentFactor = parseInt(btn.getAttribute("data-factor"));
            saveRecipeMultiplier(targetRecipe.id, currentFactor);
            renderIngredients(currentFactor);
            updateScaledServings(currentFactor);
        };
    });

    // Copy un-checked, scaled ingredients to clipboard
    const copyListBtn = document.getElementById("copy-recipe-list-btn");
    if (copyListBtn) {
        copyListBtn.onclick = (e) => {
            e.stopPropagation();
            const uncheckedItems = Array.from(ingredientsElement.querySelectorAll(".checklist-item:not(.checked) .ing-text"))
                .map(span => `• ${span.textContent.trim()}`);

            const exportText = `🛒 Shopping List: ${targetRecipe.title}\n\n` + 
                (uncheckedItems.length > 0 ? uncheckedItems.join("\n") : "All items checked off!");

            navigator.clipboard.writeText(exportText).then(() => {
                copyListBtn.textContent = "✅ Copied!";
                setTimeout(() => { copyListBtn.textContent = "📋 Copy List"; }, 2000);
            });
        };
    }

    const instructionsElement = document.getElementById("overlay-instructions");
    instructionsElement.innerHTML = targetRecipe.instructions.map(step => `<li>${step}</li>`).join("");

    // Triggers your overlay layout transitions via CSS class switches
    overlay.classList.add("is-active");
    document.body.classList.add("modal-open");
}

function filterRecipes() {
    // Re-run the main app initialization engine to cleanly build the matching subset
    initApp();
}

// --- HELPER METRIC CLEANER FOR ALTERNATING LAYOUT VIEWS ---
function clearOverlayLayout() {
    document.getElementById("overlay-title").textContent = "";
    document.getElementById("overlay-subtitle").textContent = "";
    document.getElementById("overlay-highlights").innerHTML = "";
    document.getElementById("overlay-ingredients").innerHTML = "";
    document.getElementById("overlay-instructions").innerHTML = "";
    
    document.getElementById("table-prep").textContent = "";
    document.getElementById("table-cook").textContent = "";
    document.getElementById("table-servings").textContent = "";
    document.getElementById("table-calories").textContent = "";
    document.getElementById("table-protein").textContent = "";
    document.getElementById("table-carbs").textContent = "";
    document.getElementById("table-fats").textContent = "";

    // 🚀 FIXED: Find and remove any existing multiplier control panels to stop stacking copies!
    const existingMultiplier = overlay.querySelector(".multiplier-controls");
    if (existingMultiplier) {
        existingMultiplier.remove();
    }

    const overlayImg = document.getElementById("overlay-photo");
    if (overlayImg) overlayImg.style.display = "";
}

// --- SYSTEM EVENT ATTACHMENT BINDINGS ---
closeOverlayBtn.addEventListener("click", closeDetailedView);

navDropdown.addEventListener("change", (e) => {
    if (e.target.value) {
        openDetailedView(e.target.value);
    }
});

if (searchInput) {
    searchInput.addEventListener("input", () => {
        visibleCount = 12; // Reset view threshold window when a user types a new search query!
        filterRecipes();
    });
}

if (toggleFavoritesBtn) {
    toggleFavoritesBtn.addEventListener("click", () => {
        showFavoritesOnly = !showFavoritesOnly;
        visibleCount = 12; // Reset layout view limits
        
        if (showFavoritesOnly) {
            toggleFavoritesBtn.textContent = "Show All Recipes 📋";
            toggleFavoritesBtn.classList.add("active-filter");
        } else {
            toggleFavoritesBtn.textContent = "Show Favorites ❤️";
            toggleFavoritesBtn.classList.remove("active-filter");
        }
        filterRecipes();
    });
}

// Dynamic Click Event Handler for Load More actions
if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
        visibleCount += 12; // 🚀 Append 12 more recipes to the screen cleanly!
        filterRecipes();
    });
}

// --- LAUNCH INITIALIZATION FROM NEW DATA PIPELINE ---
loadRecipeVaultData();

const randomMenuBtn = document.getElementById("random-menu-btn");

function generateRandomMealPlan(reusePrevious = false) {
    if (myRecipes.length === 0) return;

    returnToView = null;
    if (closeOverlayBtn) closeOverlayBtn.textContent = "← Back to Main Menu";

    if (!isHandlingPopState) {
        history.pushState({ view: "random-menu" }, "", "#daily-menu");
    }

    clearOverlayLayout();

    // Only roll new dishes if we aren't returning via the Back button
    if (!reusePrevious || !lastRandomMenuPicks) {
        const breakfasts = myRecipes.filter(r => getRecipeCategory(r) === "breakfast");
        const appetizers = myRecipes.filter(r => getRecipeCategory(r) === "appetizer");
        const lunches    = myRecipes.filter(r => getRecipeCategory(r) === "lunch");
        const dinners    = myRecipes.filter(r => getRecipeCategory(r) === "dinner");
        const desserts   = myRecipes.filter(r => getRecipeCategory(r) === "dessert");

        const pickRandom = (array) => array[Math.floor(Math.random() * array.length)];

        lastRandomMenuPicks = {
            bfastChoice:   pickRandom(breakfasts) || { title: "Roll a new dish!", emoji: "🍳" },
            appChoice:     pickRandom(appetizers) || { title: "Roll a new dish!", emoji: "🧅" },
            lunchChoice:   pickRandom(lunches)    || { title: "Roll a new dish!", emoji: "🥗" },
            dinnerChoice:  pickRandom(dinners)    || { title: "Roll a new dish!", emoji: "🍽️" },
            dessertChoice: pickRandom(desserts)   || { title: "Roll a new dish!", emoji: "🍪" }
        };
    }

    const { bfastChoice, appChoice, lunchChoice, dinnerChoice, dessertChoice } = lastRandomMenuPicks;

    // 2. Set Up the Header Layout View Panel parameters cleanly
    document.getElementById("overlay-title").textContent = "🎲 Your Vault Daily Menu";
    document.getElementById("overlay-subtitle").textContent = "Fort Knox automated menu selection.";
    
    // Hide standard components that do not belong in a specialized daily layout card view
    const overlayImg = document.getElementById("overlay-photo");
    if (overlayImg) overlayImg.style.display = "none";
    
    const overlayTables = overlay.querySelectorAll("table");
    overlayTables.forEach(t => t.style.display = "none");

    // Safely turn off the specific header tags without touching container blocks
    const allHeaders = overlay.querySelectorAll("h2");
    allHeaders.forEach(h => h.style.display = "none");

    document.getElementById("overlay-ingredients").style.display = "none";
    document.getElementById("overlay-instructions").style.display = "none";

    // 3. Inject a Gorgeous Custom Menu Grid with Clickable Meal Cards
    const highlightsElement = document.getElementById("overlay-highlights");
    highlightsElement.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 20px; background: rgba(45, 50, 56, 0.95); padding: 25px; border-radius: 12px; border: 2px solid #848d9e; margin: 20px 0; box-shadow: 0 8px 16px rgba(0,0,0,0.4);">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #d4af37; padding-bottom: 12px; margin-bottom: 10px;">
                <span style="font-size: 1.2rem; color: #d4af37; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Today's Specials</span>
                <button id="reroll-menu-btn" style="background: #d4af37; color: #1c212a; border: none; padding: 6px 14px; font-weight: bold; border-radius: 6px; cursor: pointer; transition: all 0.2s ease;">🔄 Re-Roll Menu</button>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 15px;">
                <div class="meal-plan-item" data-recipe-id="${bfastChoice.id}" style="cursor: pointer; background: rgba(28, 33, 42, 0.6); padding: 12px; border-radius: 8px; border-left: 4px solid #d4af37;">
                    <span style="color: #848d9e; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 4px;">🌅 Breakfast</span>
                    <span style="font-size: 1.1rem; font-weight: 500; color: #ffffff;">${bfastChoice.emoji} ${bfastChoice.title}</span>
                </div>
                <div class="meal-plan-item" data-recipe-id="${appChoice.id}" style="cursor: pointer; background: rgba(28, 33, 42, 0.6); padding: 12px; border-radius: 8px; border-left: 4px solid #d4af37;">
                    <span style="color: #848d9e; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 4px;">🧅 Appetizer Snack</span>
                    <span style="font-size: 1.1rem; font-weight: 500; color: #ffffff;">${appChoice.emoji} ${appChoice.title}</span>
                </div>
                <div class="meal-plan-item" data-recipe-id="${lunchChoice.id}" style="cursor: pointer; background: rgba(28, 33, 42, 0.6); padding: 12px; border-radius: 8px; border-left: 4px solid #d4af37;">
                    <span style="color: #848d9e; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 4px;">☀️ Lunch</span>
                    <span style="font-size: 1.1rem; font-weight: 500; color: #ffffff;">${lunchChoice.emoji} ${lunchChoice.title}</span>
                </div>
                <div class="meal-plan-item" data-recipe-id="${dinnerChoice.id}" style="cursor: pointer; background: rgba(28, 33, 42, 0.6); padding: 12px; border-radius: 8px; border-left: 4px solid #d4af37;">
                    <span style="color: #848d9e; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 4px;">🌙 Dinner</span>
                    <span style="font-size: 1.1rem; font-weight: 500; color: #ffffff;">${dinnerChoice.emoji} ${dinnerChoice.title}</span>
                </div>
                <div class="meal-plan-item" data-recipe-id="${dessertChoice.id}" style="cursor: pointer; background: rgba(28, 33, 42, 0.6); padding: 12px; border-radius: 8px; border-left: 4px solid #d4af37;">
                    <span style="color: #848d9e; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 4px;">🍪 Dessert</span>
                    <span style="font-size: 1.1rem; font-weight: 500; color: #ffffff;">${dessertChoice.emoji} ${dessertChoice.title}</span>
                </div>
            </div>
            <p style="text-align: center; margin: 10px 0 0 0; font-size: 0.85rem; color: #848d9e;">
                Tip: Click any dish above to open its full ingredients and instructions!
            </p>
        </div>
    `;

    // Bind event listener to the inner menu re-roll button instantly
    const rerollBtn = document.getElementById("reroll-menu-btn");
    if (rerollBtn) {
        rerollBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            generateRandomMealPlan(false); // Forces a fresh roll
        });
    }

    // Make each rolled meal card clickable to open its full recipe
    highlightsElement.querySelectorAll(".meal-plan-item").forEach(card => {
        card.addEventListener("click", () => {
            const recipeId = card.getAttribute("data-recipe-id");
            if (recipeId && recipeId !== "undefined") {
                openDetailedView(recipeId, "random-menu");
            }
        });
    });

    // 4. Fire the modal screen overlay trigger layout states smoothly
    overlay.classList.add("is-active");
    document.body.classList.add("modal-open");
}

// Bind button click to initialization call
if (randomMenuBtn) {
    randomMenuBtn.addEventListener("click", () => generateRandomMealPlan(false));
}

// Close modal when pressing Escape or clicking the dark background
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("is-active")) {
        closeDetailedView();
    }
});

overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
        closeDetailedView();
    }
});

const healthyMenuBtn = document.getElementById("healthy-menu-btn");

function generateHealthyMealPlan(reusePrevious = false) {
    if (myRecipes.length === 0) return;

    returnToView = null;
    if (closeOverlayBtn) closeOverlayBtn.textContent = "← Back to Main Menu";

    if (!isHandlingPopState) {
        history.pushState({ view: "healthy-menu" }, "", "#custom-menu");
    }

    clearOverlayLayout();
    document.getElementById("overlay-title").textContent = "🥗 Your Custom Vault Menu";

    const subtitleElement = document.getElementById("overlay-subtitle");
    subtitleElement.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 10px; margin: 15px auto; max-width: 400px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
            <span style="font-size: 0.95rem; color: #dce0e9;">Fort Knox automated selections (&lt; <strong id="modal-cal-val" style="color: #d4af37;">${healthyModalMaxCalories}</strong> kcal)</span>
            <input type="range" id="modal-calorie-slider" min="150" max="800" step="25" value="${healthyModalMaxCalories}" style="width: 100%; accent-color: #d4af37; cursor: pointer; margin-top: 5px;">
        </div>
    `;

    function renderHealthyMenuRows(maxCals, shouldReuse = false) {
        if (!shouldReuse || !lastHealthyMenuPicks) {
            const healthyPool = myRecipes.filter(r => r.nutrition.calories <= maxCals);

            const breakfasts = healthyPool.filter(r => getRecipeCategory(r) === "breakfast");
            const appetizers = healthyPool.filter(r => getRecipeCategory(r) === "appetizer");
            const lunches    = healthyPool.filter(r => getRecipeCategory(r) === "lunch");
            const dinners    = healthyPool.filter(r => getRecipeCategory(r) === "dinner");
            const desserts   = healthyPool.filter(r => getRecipeCategory(r) === "dessert");

            const pickRandom = (array) => array[Math.floor(Math.random() * array.length)];

            lastHealthyMenuPicks = {
                bfastChoice:   pickRandom(breakfasts) || { title: "No dishes found under limit", emoji: "⚠️", nutrition: { calories: 0 } },
                appChoice:     pickRandom(appetizers) || { title: "No dishes found under limit", emoji: "⚠️", nutrition: { calories: 0 } },
                lunchChoice:   pickRandom(lunches)    || { title: "No dishes found under limit", emoji: "⚠️", nutrition: { calories: 0 } },
                dinnerChoice:  pickRandom(dinners)    || { title: "No dishes found under limit", emoji: "⚠️", nutrition: { calories: 0 } },
                dessertChoice: pickRandom(desserts)   || { title: "No dishes found under limit", emoji: "⚠️", nutrition: { calories: 0 } }
            };
        }

        const { bfastChoice, appChoice, lunchChoice, dinnerChoice, dessertChoice } = lastHealthyMenuPicks;

        const highlightsElement = document.getElementById("overlay-highlights");
        if (highlightsElement) {
            highlightsElement.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 20px; background: rgba(45, 50, 56, 0.95); padding: 25px; border-radius: 12px; border: 2px solid #848d9e; margin: 20px 0; box-shadow: 0 8px 16px rgba(0,0,0,0.4);">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #d4af37; padding-bottom: 12px; margin-bottom: 10px;">
                        <span style="font-size: 1.2rem; color: #d4af37; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Custom Vault Specials</span>
                        <button id="reroll-healthy-btn" style="background: #d4af37; color: #1c212a; border: none; padding: 6px 14px; font-weight: bold; border-radius: 6px; cursor: pointer; transition: all 0.2s ease;">🔄 Re-Roll Menu</button>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 15px;">
                        <div class="meal-plan-item" data-recipe-id="${bfastChoice.id}" style="cursor: ${bfastChoice.id ? 'pointer' : 'default'}; background: rgba(28, 33, 42, 0.6); padding: 12px; border-radius: 8px; border-left: 4px solid #d4af37;">
                            <span style="color: #848d9e; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 4px;">🌅 Breakfast</span>
                            <span style="font-size: 1.1rem; font-weight: 500; color: #ffffff;">${bfastChoice.emoji} ${bfastChoice.title} (${bfastChoice.nutrition?.calories || 0} kcal)</span>
                        </div>
                        <div class="meal-plan-item" data-recipe-id="${appChoice.id}" style="cursor: ${appChoice.id ? 'pointer' : 'default'}; background: rgba(28, 33, 42, 0.6); padding: 12px; border-radius: 8px; border-left: 4px solid #d4af37;">
                            <span style="color: #848d9e; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 4px;">🧅 Appetizer Snack</span>
                            <span style="font-size: 1.1rem; font-weight: 500; color: #ffffff;">${appChoice.emoji} ${appChoice.title} (${appChoice.nutrition?.calories || 0} kcal)</span>
                        </div>
                        <div class="meal-plan-item" data-recipe-id="${lunchChoice.id}" style="cursor: ${lunchChoice.id ? 'pointer' : 'default'}; background: rgba(28, 33, 42, 0.6); padding: 12px; border-radius: 8px; border-left: 4px solid #d4af37;">
                            <span style="color: #848d9e; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 4px;">☀️ Lunch</span>
                            <span style="font-size: 1.1rem; font-weight: 500; color: #ffffff;">${lunchChoice.emoji} ${lunchChoice.title} (${lunchChoice.nutrition?.calories || 0} kcal)</span>
                        </div>
                        <div class="meal-plan-item" data-recipe-id="${dinnerChoice.id}" style="cursor: ${dinnerChoice.id ? 'pointer' : 'default'}; background: rgba(28, 33, 42, 0.6); padding: 12px; border-radius: 8px; border-left: 4px solid #d4af37;">
                            <span style="color: #848d9e; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 4px;">🌙 Dinner</span>
                            <span style="font-size: 1.1rem; font-weight: 500; color: #ffffff;">${dinnerChoice.emoji} ${dinnerChoice.title} (${dinnerChoice.nutrition?.calories || 0} kcal)</span>
                        </div>
                        <div class="meal-plan-item" data-recipe-id="${dessertChoice.id}" style="cursor: ${dessertChoice.id ? 'pointer' : 'default'}; background: rgba(28, 33, 42, 0.6); padding: 12px; border-radius: 8px; border-left: 4px solid #d4af37;">
                            <span style="color: #848d9e; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 4px;">🍪 Dessert</span>
                            <span style="font-size: 1.1rem; font-weight: 500; color: #ffffff;">${dessertChoice.emoji} ${dessertChoice.title} (${dessertChoice.nutrition?.calories || 0} kcal)</span>
                        </div>
                    </div>
                    <p style="text-align: center; margin: 10px 0 0 0; font-size: 0.85rem; color: #848d9e;">
                        Tip: Click any dish above to open its full ingredients and instructions!
                    </p>
                </div>
            `;

            highlightsElement.querySelectorAll(".meal-plan-item").forEach(card => {
                card.addEventListener("click", () => {
                    const recipeId = card.getAttribute("data-recipe-id");
                    if (recipeId && recipeId !== "undefined") {
                        openDetailedView(recipeId, "healthy-menu");
                    }
                });
            });
        }

        const rerollHealthyBtn = document.getElementById("reroll-healthy-btn");
        if (rerollHealthyBtn) {
            rerollHealthyBtn.onclick = (e) => {
                e.stopPropagation();
                renderHealthyMenuRows(healthyModalMaxCalories, false);
            };
        }
    }

    const overlayImg = document.getElementById("overlay-photo");
    if (overlayImg) overlayImg.style.display = "none";
    
    const overlayTables = overlay.querySelectorAll("table");
    overlayTables.forEach(t => t.style.display = "none");

    const allHeaders = overlay.querySelectorAll("h2");
    allHeaders.forEach(h => h.style.display = "none");

    document.getElementById("overlay-ingredients").style.display = "none";
    document.getElementById("overlay-instructions").style.display = "none";

    renderHealthyMenuRows(healthyModalMaxCalories, reusePrevious);

    const modalSlider = document.getElementById("modal-calorie-slider");
    const modalValueDisplay = document.getElementById("modal-cal-val");

    if (modalSlider && modalValueDisplay) {
        modalSlider.oninput = (e) => {
            healthyModalMaxCalories = parseInt(e.target.value);
            modalValueDisplay.textContent = healthyModalMaxCalories;
            renderHealthyMenuRows(healthyModalMaxCalories, false);
        };
    }

    overlay.classList.add("is-active");
    document.body.classList.add("modal-open");
}

if (healthyMenuBtn) {
    healthyMenuBtn.addEventListener("click", () => generateHealthyMealPlan(false));
}

if (loadMoreBtn && loadMoreContainer) {
    const infiniteScrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && loadMoreContainer.style.display !== "none") {
                visibleCount += 12;
                filterRecipes();
            }
        });
    }, {
        root: null,
        rootMargin: "150px",
        threshold: 0.1
    });

    infiniteScrollObserver.observe(loadMoreContainer);
}

function getCheckedIngredients() {
    const checked = localStorage.getItem("vault_checked_ingredients");
    return checked ? JSON.parse(checked) : [];
}

function toggleCheckedIngredient(ingredientText) {
    let checked = getCheckedIngredients();
    if (checked.includes(ingredientText)) {
        checked = checked.filter(text => text !== ingredientText);
    } else {
        checked.push(ingredientText);
    }
    localStorage.setItem("vault_checked_ingredients", JSON.stringify(checked));
}

function clearAllCheckedIngredients() {
    localStorage.removeItem("vault_checked_ingredients");
}

// --- UPDATED MASTER GROCERY LIST LOGIC ENGINE ---
// --- UPDATED MASTER GROCERY LIST LOGIC ENGINE ---
function generateMasterShoppingList() {
    const currentFavorites = getFavorites();

    if (currentFavorites.length === 0) {
        alert("Your vault is empty! Favorite a few recipes first by clicking their hearts. ❤️");
        return;
    }

    returnToView = null;
    if (closeOverlayBtn) closeOverlayBtn.textContent = "← Back to Main Menu";

    if (!isHandlingPopState) {
        history.pushState({ view: "grocery-list" }, "", "#grocery-list");
    }

    clearOverlayLayout();

    document.getElementById("overlay-title").textContent = "🛒 Your Master Grocery List";
    document.getElementById("overlay-subtitle").textContent = `Compiled ingredients for ${currentFavorites.length} favorited dishes.`;

    const storedChecks = getCheckedIngredients();

    // --- INJECT ACTION PANEL BARS ---
    const subtitleEl = document.getElementById("overlay-subtitle");
    const actionPanel = document.createElement("div");
    actionPanel.className = "multiplier-controls";
    actionPanel.style.cssText = "display: flex; flex-wrap: wrap; gap: 10px; margin: 20px 0 10px 0; justify-content: center; align-items: center;";
    actionPanel.innerHTML = `
        <button id="toggle-combine-btn" style="background: ${combineGroceryItems ? '#d4af37' : '#2d3238'}; color: ${combineGroceryItems ? '#1c212a' : '#d4af37'}; border: 2px solid #d4af37; padding: 6px 16px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.85rem; transition: all 0.2s ease;">
            ${combineGroceryItems ? "📋 Group by Recipe" : "🧩 Combine Duplicates"}
        </button>
        <button id="copy-master-list-btn" style="background: #2d3238; color: #d4af37; border: 2px solid #d4af37; padding: 6px 16px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.85rem; transition: all 0.2s ease;">📋 Copy Grocery List</button>
        <button id="clear-checks-btn" style="background: #2d3238; color: #ff4d4d; border: 2px solid #ff4d4d; padding: 6px 16px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.85rem; transition: all 0.2s ease;">🔄 Clear Checks</button>
        <button id="reset-scales-btn" style="background: #2d3238; color: #dce0e9; border: 2px solid #848d9e; padding: 6px 16px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.85rem; transition: all 0.2s ease;">⚖️ Reset Scales (1x)</button>
    `;
    subtitleEl.parentNode.insertBefore(actionPanel, subtitleEl.nextSibling);

    // Hide default interface blocks
    const overlayImg = document.getElementById("overlay-photo");
    if (overlayImg) overlayImg.style.display = "none";
    
    const overlayTables = overlay.querySelectorAll("table");
    overlayTables.forEach(t => t.style.display = "none");

    const allHeaders = overlay.querySelectorAll("h2");
    allHeaders.forEach(h => h.style.display = "none");
    
    document.getElementById("overlay-instructions").style.display = "none";

    const ingredientsElement = document.getElementById("overlay-ingredients");
    ingredientsElement.style.display = ""; 
    ingredientsElement.innerHTML = "";    

    const savedMultipliers = getSavedMultipliers();

    if (combineGroceryItems) {
        const combinedItems = buildCombinedIngredients(currentFavorites, savedMultipliers);
        const combinedSection = document.createElement("div");
        combinedSection.className = "shopping-list-group";
        combinedSection.style.marginBottom = "25px";
        combinedSection.setAttribute("data-title", "Combined Shopping List");
        combinedSection.setAttribute("data-emoji", "🛒");

        const itemsHTML = combinedItems.map(itemText => {
            const isChecked = storedChecks.includes(itemText);
            return `
                <li class="${isChecked ? "checklist-item checked" : "checklist-item"}">
                    <span class="ing-text">${itemText}</span>
                </li>
            `;
        }).join("");

        combinedSection.innerHTML = `
            <h3 style="color: #d4af37; margin-bottom: 10px; font-size: 1.15rem; border-bottom: 1px solid rgba(132, 141, 158, 0.3); padding-bottom: 5px; text-align: left;">
                🛒 Combined Ingredients (${combinedItems.length} items)
            </h3>
            <ul style="list-style: none; padding-left: 0; margin: 0;">${itemsHTML}</ul>
        `;
        ingredientsElement.appendChild(combinedSection);
    } else {
        currentFavorites.forEach(favId => {
            const recipe = myRecipes.find(r => r.id === favId);
            if (recipe) {
                const factor = savedMultipliers[recipe.id] || 1;
                const scaleBadge = factor > 1 ? ` <span style="color: #ffffff; background: rgba(212, 175, 55, 0.25); border: 1px solid #d4af37; padding: 1px 7px; border-radius: 4px; font-size: 0.85rem; margin-left: 6px;">${factor}x</span>` : "";

                const recipeSection = document.createElement("div");
                recipeSection.className = "shopping-list-group";
                recipeSection.style.marginBottom = "25px";

                recipeSection.setAttribute("data-title", factor > 1 ? `${recipe.title} (${factor}x)` : recipe.title);
                recipeSection.setAttribute("data-emoji", recipe.emoji);

                const headerHTML = `
                    <h3 style="color: #d4af37; margin-bottom: 10px; font-size: 1.15rem; border-bottom: 1px solid rgba(132, 141, 158, 0.3); padding-bottom: 5px; text-align: left;">
                        ${recipe.emoji} ${recipe.title}${scaleBadge}
                    </h3>
                `;

                const itemsHTML = recipe.ingredients.map(ing => {
                    const scaledIng = multiplyIngredientQuantity(ing, factor);
                    const isChecked = storedChecks.includes(scaledIng);
                   
                    return `
                       <li class="${isChecked ? "checklist-item checked" : "checklist-item"}"><span class="ing-text">${scaledIng}</span></li>
                    `;
                }).join("");

                recipeSection.innerHTML = headerHTML + `<ul style="list-style: none; padding-left: 0; margin: 0;">${itemsHTML}</ul>`;
                ingredientsElement.appendChild(recipeSection);
            }
        });
    }

    // --- INTERACTIVE EVENT CLICK STATE ROUTER ---
    ingredientsElement.onclick = (e) => {
        const listItem = e.target.closest(".checklist-item");
        if (!listItem) return;

        const textSpan = listItem.querySelector(".ing-text");
        toggleCheckedIngredient(textSpan.textContent.trim());
        listItem.classList.toggle("checked");
    };

    // --- TOGGLE COMBINE DUPLICATES BUTTON ROUTER ---
    const toggleCombineBtn = document.getElementById("toggle-combine-btn");
    if (toggleCombineBtn) {
        toggleCombineBtn.onclick = (e) => {
            e.stopPropagation();
            combineGroceryItems = !combineGroceryItems;
            generateMasterShoppingList();
        };
    }

    // --- REFRESH RESET BUTTON ROUTER ---
    const clearChecksBtn = document.getElementById("clear-checks-btn");
    if (clearChecksBtn) {
        clearChecksBtn.onclick = (e) => {
            e.stopPropagation();
            clearAllCheckedIngredients();
            generateMasterShoppingList();
        };
    }

    // --- RESET PORTION SCALES BUTTON ROUTER ---
    const resetScalesBtn = document.getElementById("reset-scales-btn");
    if (resetScalesBtn) {
        resetScalesBtn.onclick = (e) => {
            e.stopPropagation();
            localStorage.removeItem("vault_multipliers");
            generateMasterShoppingList();
        };
    }

    // --- SMART FILTERED COPY ENGINE ---
    const copyMasterBtn = document.getElementById("copy-master-list-btn");
    if (copyMasterBtn) {
        copyMasterBtn.onclick = (e) => {
            e.stopPropagation();
            let exportString = "🛒 THE ULTIMATE RECIPE VAULT - GROCERY LIST\n\n";

            const groups = ingredientsElement.querySelectorAll(".shopping-list-group");
            groups.forEach(group => {
                const title = group.getAttribute("data-title");
                const emoji = group.getAttribute("data-emoji");
                const uncheckedSpans = Array.from(group.querySelectorAll(".checklist-item:not(.checked) .ing-text"));
                
                if (uncheckedSpans.length > 0) {
                    exportString += `${emoji} ${title.toUpperCase()}\n`;
                    uncheckedSpans.forEach(span => {
                        exportString += `  • ${span.textContent.trim()}\n`;
                    });
                    exportString += "\n";
                }
            });

            if (exportString.trim() === "🛒 THE ULTIMATE RECIPE VAULT - GROCERY LIST") {
                exportString += "All items checked off! Happy cooking! ✨";
            }

            navigator.clipboard.writeText(exportString).then(() => {
                copyMasterBtn.textContent = "✅ Copied to Clipboard!";
                copyMasterBtn.style.borderColor = "#4eae51";
                copyMasterBtn.style.color = "#4eae51";
                setTimeout(() => { 
                    copyMasterBtn.textContent = "📋 Copy Grocery List"; 
                    copyMasterBtn.style.borderColor = "#d4af37";
                    copyMasterBtn.style.color = "#d4af37";
                }, 2000);
            });
        };
    }

    overlay.classList.add("is-active");
    document.body.classList.add("modal-open");
}

const masterGroceryBtn = document.getElementById("master-grocery-btn");
if (masterGroceryBtn) {
    masterGroceryBtn.addEventListener("click", generateMasterShoppingList);
}

