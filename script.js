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
let myRecipes = []; 
let visibleCount = 12; // 🧠 Change this number to control how many cards show up first!

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

function initApp() {
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

    // 🚀 SCALING FIX: ...but ONLY build HTML elements for the cards currently on screen!
    const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
    
    // Filter the array based on text search and favorites BEFORE building anything
    const filteredRecipes = myRecipes.filter(recipe => {
        const matchesSearch = recipe.title.toLowerCase().includes(query) || 
                              recipe.subtitle.toLowerCase().includes(query);
        const matchesFavorites = !showFavoritesOnly || currentFavorites.includes(recipe.id);
        return matchesSearch && matchesFavorites;
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
                    <img src="images/${recipe.image}" alt="${recipe.title}" class="recipe-photo">
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
function openDetailedView(recipeId) {
    const targetRecipe = myRecipes.find(r => r.id === recipeId);
    if (!targetRecipe) return;

    // Reset layout view content slots cleanly before rendering text parameters
    clearOverlayLayout();

    // Injects raw text parameters safely
    document.getElementById("overlay-title").textContent = `${targetRecipe.emoji} ${targetRecipe.title}`;
    document.getElementById("overlay-subtitle").textContent = targetRecipe.subtitle;

    // Dynamically sets the large photo inside your full-screen overlay view panel layout
    const oldOverlayImg = document.getElementById("overlay-photo");
    if (oldOverlayImg) {
        oldOverlayImg.src = `images/${targetRecipe.image}`;
        oldOverlayImg.alt = targetRecipe.title;
    } else {
        const imgDiv = document.createElement("div");
        imgDiv.style.textAlign = "center";
        imgDiv.style.marginBottom = "30px";
        imgDiv.innerHTML = `<img id="overlay-photo" src="images/${targetRecipe.image}" alt="${targetRecipe.title}" class="recipe-photo">`;
        
        // Sticks the photo framework right beneath your subtitle text element frame
        const subtitleEl = document.getElementById("overlay-subtitle");
        subtitleEl.parentNode.insertBefore(imgDiv, subtitleEl.nextSibling);
    }

    // Bring back tables, list text nodes, and layout headers safely for normal card viewing
    const overlayTables = overlay.querySelectorAll("table");
    overlayTables.forEach(t => t.style.display = "");

    const allHeaders = overlay.querySelectorAll("h2");
    allHeaders.forEach(h => h.style.display = "");

    document.getElementById("overlay-ingredients").style.display = "";
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

    const ingredientsElement = document.getElementById("overlay-ingredients");
    ingredientsElement.innerHTML = targetRecipe.ingredients.map(ing => `<li>${ing}</li>`).join("");

    const instructionsElement = document.getElementById("overlay-instructions");
    instructionsElement.innerHTML = targetRecipe.instructions.map(step => `<li>${step}</li>`).join("");

    // Triggers your overlay layout transitions via CSS class switches
    overlay.classList.add("is-active");
    document.body.classList.add("modal-open");
}

function closeDetailedView() {
    overlay.classList.remove("is-active");
    document.body.classList.remove("modal-open");
    navDropdown.value = "";
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

function generateRandomMealPlan() {
    if (myRecipes.length === 0) return;

    // Reset layout view completely to strip out residual text data elements
    clearOverlayLayout();

    // 1. Classify recipes dynamically into structural menus based on text keywords
    const breakfasts = myRecipes.filter(r => r.id.includes("egg") || r.id.includes("pancake") || r.id.includes("biscuit") || r.id.includes("scramble"));
    const desserts = myRecipes.filter(r => r.id.includes("muffin") || r.id.includes("cookie") || r.id.includes("brownie") || r.id.includes("bread") || r.id.includes("sorbet") || r.id.includes("cake") || r.id.includes("toast"));
    const appetizers = myRecipes.filter(r => r.id.includes("canape") || r.id.includes("date") || r.id.includes("spread") || r.id.includes("appetizer") || r.id.includes("fries") || r.id.includes("dip") || r.id.includes("cheese"));
    const mains = myRecipes.filter(r => !breakfasts.includes(r) && !desserts.includes(r) && !appetizers.includes(r));

    const pickRandom = (array) => array[Math.floor(Math.random() * array.length)];

    const bfastChoice = pickRandom(breakfasts) || { title: "Roll a new dish!", emoji: "🍳" };
    const lunchChoice = pickRandom(mains) || { title: "Roll a new dish!", emoji: "🥢" };
    const dinnerChoice = pickRandom(mains) || { title: "Roll a new dish!", emoji: "🥢" };
    const appChoice = pickRandom(appetizers) || { title: "Roll a new dish!", emoji: "🧅" };
    const dessertChoice = pickRandom(desserts) || { title: "Roll a new dish!", emoji: "🍪" };

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

    // 3. Inject a Gorgeous Custom Menu Grid with an Interactive Inside Re-Roll Button
    const highlightsElement = document.getElementById("overlay-highlights");
    highlightsElement.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 20px; background: rgba(45, 50, 56, 0.95); padding: 25px; border-radius: 12px; border: 2px solid #848d9e; margin: 20px 0; box-shadow: 0 8px 16px rgba(0,0,0,0.4);">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #d4af37; padding-bottom: 12px; margin-bottom: 10px;">
                <span style="font-size: 1.2rem; color: #d4af37; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Today's Specials</span>
                <button id="reroll-menu-btn" style="background: #d4af37; color: #1c212a; border: none; padding: 6px 14px; font-weight: bold; border-radius: 6px; cursor: pointer; transition: all 0.2s ease;">🔄 Re-Roll Menu</button>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 15px;">
                <div style="background: rgba(28, 33, 42, 0.6); padding: 12px; border-radius: 8px; border-left: 4px solid #d4af37;">
                    <span style="color: #848d9e; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 4px;">🌅 Breakfast</span>
                    <span style="font-size: 1.1rem; font-weight: 500; color: #ffffff;">${bfastChoice.emoji} ${bfastChoice.title}</span>
                </div>
                <div style="background: rgba(28, 33, 42, 0.6); padding: 12px; border-radius: 8px; border-left: 4px solid #d4af37;">
                    <span style="color: #848d9e; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 4px;">🧅 Appetizer Snack</span>
                    <span style="font-size: 1.1rem; font-weight: 500; color: #ffffff;">${appChoice.emoji} ${appChoice.title}</span>
                </div>
                <div style="background: rgba(28, 33, 42, 0.6); padding: 12px; border-radius: 8px; border-left: 4px solid #d4af37;">
                    <span style="color: #848d9e; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 4px;">☀️ Lunch</span>
                    <span style="font-size: 1.1rem; font-weight: 500; color: #ffffff;">${lunchChoice.emoji} ${lunchChoice.title}</span>
                </div>
                <div style="background: rgba(28, 33, 42, 0.6); padding: 12px; border-radius: 8px; border-left: 4px solid #d4af37;">
                    <span style="color: #848d9e; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 4px;">🌙 Dinner</span>
                    <span style="font-size: 1.1rem; font-weight: 500; color: #ffffff;">${dinnerChoice.emoji} ${dinnerChoice.title}</span>
                </div>
                <div style="background: rgba(28, 33, 42, 0.6); padding: 12px; border-radius: 8px; border-left: 4px solid #d4af37;">
                    <span style="color: #848d9e; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 4px;">🍪 Dessert</span>
                    <span style="font-size: 1.1rem; font-weight: 500; color: #ffffff;">${dessertChoice.emoji} ${dessertChoice.title}</span>
                </div>
            </div>
            <p style="text-align: center; margin: 10px 0 0 0; font-size: 0.85rem; color: #848d9e;">
                Tip: Search any of these dishes on the main page to see full ingredients and instructions!
            </p>
        </div>
    `;

    // Bind event listener to the inner menu re-roll button instantly
    const rerollBtn = document.getElementById("reroll-menu-btn");
    if (rerollBtn) {
        rerollBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            generateRandomMealPlan(); // Recursively re-rolls inside the open menu frame view!
        });
    }

    // 4. Fire the modal screen overlay trigger layout states smoothly
    overlay.classList.add("is-active");
    document.body.classList.add("modal-open");
}

// Bind button click to initialization call
if (randomMenuBtn) {
    randomMenuBtn.addEventListener("click", generateRandomMealPlan);
}

const healthyMenuBtn = document.getElementById("healthy-menu-btn");

function generateHealthyMealPlan() {
    if (myRecipes.length === 0) return;

    // Reset layout view completely using your existing engine cleaner
    clearOverlayLayout();

    // 1. Filter the global master pool into a "Healthy" subset (under 400 calories)
    const healthyPool = myRecipes.filter(r => r.nutrition.calories < 400);

    // 2. Classify the healthy subset exactly like your standard layout
    const breakfasts = healthyPool.filter(r => r.id.includes("egg") || r.id.includes("pancake") || r.id.includes("biscuit") || r.id.includes("scramble"));
    const desserts = healthyPool.filter(r => r.id.includes("muffin") || r.id.includes("cookie") || r.id.includes("brownie") || r.id.includes("bread") || r.id.includes("sorbet") || r.id.includes("cake") || r.id.includes("toast"));
    const appetizers = healthyPool.filter(r => r.id.includes("canape") || r.id.includes("date") || r.id.includes("spread") || r.id.includes("appetizer") || r.id.includes("fries") || r.id.includes("dip") || r.id.includes("cheese"));
    const mains = healthyPool.filter(r => !breakfasts.includes(r) && !desserts.includes(r) && !appetizers.includes(r));

    const pickRandom = (array) => array[Math.floor(Math.random() * array.length)];

    // Fallback safely to a generic text marker if a specific macro branch is empty
    const bfastChoice = pickRandom(breakfasts) || { title: "Roll a new dish!", emoji: "🍳" };
    const lunchChoice = pickRandom(mains) || { title: "Roll a new dish!", emoji: "🥢" };
    const dinnerChoice = pickRandom(mains) || { title: "Roll a new dish!", emoji: "🥢" };
    const appChoice = pickRandom(appetizers) || { title: "Roll a new dish!", emoji: "🧅" };
    const dessertChoice = pickRandom(desserts) || { title: "Roll a new dish!", emoji: "🍪" };

    // 3. Set Up the Header Parameters using your exact naming strings
    document.getElementById("overlay-title").textContent = "🥗 Your Healthy Vault Menu";
    document.getElementById("overlay-subtitle").textContent = "Fort Knox automated light selections (< 400 kcal).";
    
    const overlayImg = document.getElementById("overlay-photo");
    if (overlayImg) overlayImg.style.display = "none";
    
    const overlayTables = overlay.querySelectorAll("table");
    overlayTables.forEach(t => t.style.display = "none");

    const allHeaders = overlay.querySelectorAll("h2");
    allHeaders.forEach(h => h.style.display = "none");

    document.getElementById("overlay-ingredients").style.display = "none";
    document.getElementById("overlay-instructions").style.display = "none";

    // 4. Inject the Custom Grid Template containing an internal Re-Roll binder
    const highlightsElement = document.getElementById("overlay-highlights");
    highlightsElement.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 20px; background: rgba(45, 50, 56, 0.95); padding: 25px; border-radius: 12px; border: 2px solid #848d9e; margin: 20px 0; box-shadow: 0 8px 16px rgba(0,0,0,0.4);">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #d4af37; padding-bottom: 12px; margin-bottom: 10px;">
                <span style="font-size: 1.2rem; color: #d4af37; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Today's Light Specials</span>
                <button id="reroll-healthy-btn" style="background: #d4af37; color: #1c212a; border: none; padding: 6px 14px; font-weight: bold; border-radius: 6px; cursor: pointer; transition: all 0.2s ease;">🔄 Re-Roll Menu</button>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 15px;">
                <div style="background: rgba(28, 33, 42, 0.6); padding: 12px; border-radius: 8px; border-left: 4px solid #d4af37;">
                    <span style="color: #848d9e; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 4px;">🌅 Breakfast</span>
                    <span style="font-size: 1.1rem; font-weight: 500; color: #ffffff;">${bfastChoice.emoji} ${bfastChoice.title} (${bfastChoice.nutrition?.calories || 0} kcal)</span>
                </div>
                <div style="background: rgba(28, 33, 42, 0.6); padding: 12px; border-radius: 8px; border-left: 4px solid #d4af37;">
                    <span style="color: #848d9e; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 4px;">🧅 Appetizer Snack</span>
                    <span style="font-size: 1.1rem; font-weight: 500; color: #ffffff;">${appChoice.emoji} ${appChoice.title} (${appChoice.nutrition?.calories || 0} kcal)</span>
                </div>
                <div style="background: rgba(28, 33, 42, 0.6); padding: 12px; border-radius: 8px; border-left: 4px solid #d4af37;">
                    <span style="color: #848d9e; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 4px;">☀️ Lunch</span>
                    <span style="font-size: 1.1rem; font-weight: 500; color: #ffffff;">${lunchChoice.emoji} ${lunchChoice.title} (${lunchChoice.nutrition?.calories || 0} kcal)</span>
                </div>
                <div style="background: rgba(28, 33, 42, 0.6); padding: 12px; border-radius: 8px; border-left: 4px solid #d4af37;">
                    <span style="color: #848d9e; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 4px;">🌙 Dinner</span>
                    <span style="font-size: 1.1rem; font-weight: 500; color: #ffffff;">${dinnerChoice.emoji} ${dinnerChoice.title} (${dinnerChoice.nutrition?.calories || 0} kcal)</span>
                </div>
                <div style="background: rgba(28, 33, 42, 0.6); padding: 12px; border-radius: 8px; border-left: 4px solid #d4af37;">
                    <span style="color: #848d9e; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 4px;">🍪 Dessert</span>
                    <span style="font-size: 1.1rem; font-weight: 500; color: #ffffff;">${dessertChoice.emoji} ${dessertChoice.title} (${dessertChoice.nutrition?.calories || 0} kcal)</span>
                </div>
            </div>
        </div>
    `;

    // Instantly bind the internal re-roll trigger
    const rerollHealthyBtn = document.getElementById("reroll-healthy-btn");
    if (rerollHealthyBtn) {
        rerollHealthyBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            generateHealthyMealPlan();
        });
    }

    // Toggle Modal Panels exactly like original function lines
    overlay.classList.add("is-active");
    document.body.classList.add("modal-open");
}

if (healthyMenuBtn) {
    healthyMenuBtn.addEventListener("click", generateHealthyMealPlan);
}
if (loadMoreBtn && loadMoreContainer) {
    const infiniteScrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            // Check if the container element enters the viewing boundaries
            if (entry.isIntersecting && loadMoreContainer.style.display !== "none") {
                visibleCount += 12; // Append next batch threshold exactly like original button logic
                filterRecipes();    // Re-run your application's native paint cycles
            }
        });
    }, {
        root: null,       // Track screen viewport directly
        rootMargin: "150px", // Pre-trigger loading 150px before screen bottom for slick rendering
        threshold: 0.1
    });

    // Start watching your existing button framework element
    infiniteScrollObserver.observe(loadMoreContainer);
}