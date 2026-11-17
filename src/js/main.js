import {
  getCategories,
  searchMeals,
  getMealById,
  filterByCategory,
  filterByArea,
} from "./api/mealdb.js";

import {
  searchProducts,
  getProductByBarcode,
  getProductsByCategory,
} from "./api/products.js";

import {
  state,
  setCurrentPage,
  addFoodLogItem,
  removeFoodLogItem,
  clearTodayFoodLog,
} from "./state/appState.js";

import {
  renderCategories,
  renderRecipes,
  renderProducts,
  renderProductDetails,
  renderMealDetails,
  renderFoodLog,
  hideLoading,
  showGridLoading,
  showError,
  showToast,
  estimateMealNutrition,
} from "./ui/components.js";

const mealsSections = [
  "search-filters-section",
  "meal-categories-section",
  "all-recipes-section",
];

const pages = ["meals", "products", "foodlog"];

const pageTitles = {
  meals: ["Meals & Recipes", "Discover delicious and nutritious recipes tailored for you"],
  products: ["Product Scanner", "Search packaged foods and check their nutrition"],
  foodlog: ["Food Log", "Track and monitor your daily nutrition intake"],
};

const NAV_ACTIVE = "nav-link flex items-center gap-3 px-3 py-2.5 bg-emerald-50 text-emerald-700 rounded-lg transition-all";
const NAV_INACTIVE = "nav-link flex items-center gap-3 px-3 py-2.5 text-gray-600 hover:bg-gray-50 rounded-lg transition-all";

let currentViewMode = "grid";
let currentProduct = null;
let productLogNoticeTimer = null;
let foodLogRemoveNoticeTimer = null;

function hideSection(id) {
  document.getElementById(id).classList.add("hidden");
}

function showSection(id) {
  document.getElementById(id).classList.remove("hidden");
}

function renderCurrentRecipes() {
  renderRecipes(state.recipes, state.selectedCategory, state.selectedArea, currentViewMode);
}

async function loadCategories() {
  try {
    state.categories = await getCategories();
    renderCategories(state.categories);
  } catch (error) {
    showError("categories-grid", "Could not load categories.");
    console.error(error);
  }
}

async function loadRecipes() {
  state.selectedCategory = "";
  state.selectedArea = "";
  showGridLoading("recipes-grid");
  try {
    state.recipes = await searchMeals("");
    renderCurrentRecipes();
  } catch (error) {
    showError("recipes-grid", "Could not load recipes.");
    console.error(error);
  }
}

let searchTimer = null;

async function runSearch(query) {
  state.selectedCategory = "";
  state.selectedArea = "";
  setActiveFilter(null);
  showGridLoading("recipes-grid");
  try {
    state.recipes = await searchMeals(query);
    renderCurrentRecipes();
  } catch (error) {
    showError("recipes-grid", "Search failed. Try again.");
    console.error(error);
  }
}

function handleSearch(event) {
  const query = event.target.value.trim();
  clearTimeout(searchTimer);
  searchTimer = setTimeout(function () {
    runSearch(query);
  }, 400);
}

function setActiveFilter(activeButton) {
  const buttons = document.querySelectorAll(".meal-area-filter");
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].classList.toggle("is-active", buttons[i] === activeButton);
  }
}

async function handleFilterClick(button) {
  setActiveFilter(button);
  document.getElementById("search-input").value = "";
  const area = button.dataset.area;

  if (!area) {
    loadRecipes();
    return;
  }

  state.selectedCategory = "";
  state.selectedArea = area;
  showGridLoading("recipes-grid");
  try {
    state.recipes = await filterByArea(area);
    renderCurrentRecipes();
  } catch (error) {
    showError("recipes-grid", "Could not filter recipes.");
    console.error(error);
  }
}

async function handleCategoryClick(categoryName) {
  setActiveFilter(null);
  state.selectedCategory = categoryName;
  state.selectedArea = "";
  showGridLoading("recipes-grid");
  try {
    state.recipes = await filterByCategory(categoryName);
    renderCurrentRecipes();
  } catch (error) {
    showError("recipes-grid", "Could not filter recipes.");
    console.error(error);
  }
}

async function handleRecipeClick(id) {
  try {
    const meal = await getMealById(id);
    if (meal) {
      state.currentMeal = meal;
      renderMealDetails(meal);

      for (let i = 0; i < mealsSections.length; i++) {
        hideSection(mealsSections[i]);
      }
      showSection("meal-details");
      window.scrollTo(0, 0);
    }
  } catch (error) {
    showToast("Could not load meal details.", "error");
    console.error(error);
  }
}

async function handleProductSearch() {
  const text = document.getElementById("product-search-input").value.trim();
  if (text === "") {
    showToast("Type a product name first.", "warning");
    return;
  }

  setActiveProductCategory(null);
  showGridLoading("products-grid");
  try {
    state.products = (await searchProducts(text)) || [];
    renderProducts(state.products, state.nutriFilter);
  } catch (error) {
    showError("products-grid", "Product search failed. Try again.");
    console.error(error);
  }
}

async function handleBarcodeLookup() {
  const barcode = document.getElementById("barcode-input").value.trim();
  if (barcode === "") {
    showToast("Type a barcode first.", "warning");
    return;
  }

  setActiveProductCategory(null);
  try {
    state.products = (await getProductByBarcode(barcode)) || [];
    if (state.products.length === 0) {
      showToast("No product found for this barcode.", "warning");
      return;
    }

    renderProducts(state.products, "");
    showProductDetails(state.products[0]);
  } catch (error) {
    showError("products-grid", "Barcode lookup failed. Try again.");
    showToast("Barcode lookup failed. Try again.", "error");
    console.error(error);
  }
}

function showProductDetails(product) {
  currentProduct = product;
  renderProductDetails(product);
}

function closeProductDetails() {
  const modal = document.getElementById("product-details-modal");
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("product-modal-open");
  currentProduct = null;
}

function setActiveProductCategory(activeButton) {
  const buttons = document.querySelectorAll(".product-category-btn");
  for (let i = 0; i < buttons.length; i++) {
    const isActive = buttons[i] === activeButton;
    buttons[i].classList.toggle("is-selected", isActive);
    buttons[i].setAttribute("aria-pressed", String(isActive));
  }
}

async function handleProductCategory(button) {
  setActiveProductCategory(button);
  showGridLoading("products-grid");
  try {
    state.products = (await getProductsByCategory(button.dataset.category)) || [];
    renderProducts(state.products, state.nutriFilter);
  } catch (error) {
    showError("products-grid", "Could not load products.");
    console.error(error);
  }
}

function handleNutriFilter(button) {
  state.nutriFilter = button.dataset.grade;

  const buttons = document.querySelectorAll(".nutri-score-filter");
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].classList.remove("is-active");
    buttons[i].setAttribute("aria-pressed", "false");
  }
  button.classList.add("is-active");
  button.setAttribute("aria-pressed", "true");

  renderProducts(state.products, state.nutriFilter);
}

function logProduct(barcode) {
  for (let i = 0; i < state.products.length; i++) {
    const product = state.products[i];
    if (product.code === barcode) {
      let name = product.product_name || "Unknown product";
      const nutriments = product.nutriments || {};

      addFoodLogItem(
        name,
        nutriments["energy-kcal_100g"],
        nutriments["proteins_100g"],
        nutriments["carbohydrates_100g"],
        nutriments["fat_100g"],
        {
          type: "product",
          barcode: product.code,
          brand: product.brands || null,
          image: product.image_front_small_url || null,
        }
      );
      renderFoodLog();
      showProductLoggedNotice(name);
      return;
    }
  }
}

function showProductLoggedNotice(name) {
  const notice = document.getElementById("product-log-notice");
  notice.querySelector("span").textContent =
    name + " logged to your daily intake!";
  notice.classList.remove("hidden");

  clearTimeout(productLogNoticeTimer);
  productLogNoticeTimer = setTimeout(function () {
    notice.classList.add("hidden");
  }, 4000);
}

function showFoodLogRemoveNotice() {
  const notice = document.getElementById("foodlog-remove-notice");
  notice.classList.remove("hidden");

  clearTimeout(foodLogRemoveNoticeTimer);
  foodLogRemoveNoticeTimer = setTimeout(function () {
    notice.classList.add("hidden");
  }, 3000);
}

async function handleLogMeal() {
  const meal = state.currentMeal;
  if (!meal) return;

  const nutrition = estimateMealNutrition(meal);
  const n = nutrition.perServing;
  const safeMealName = String(meal.strMeal || "Meal").replace(
    /[&<>"']/g,
    function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[character];
    }
  );
  const mealImage = /^https?:\/\//i.test(meal.strMealThumb || "")
    ? String(meal.strMealThumb).replace(/"/g, "&quot;")
    : "";

  const result = await Swal.fire({
    title: "",
    html:
      '<div class="meal-log-content">' +
      '<div class="meal-log-header">' +
      (mealImage
        ? '<img class="meal-log-image" src="' + mealImage + '" alt="' + safeMealName + '">'
        : '<div class="meal-log-image meal-log-image-placeholder"><i class="fa-solid fa-utensils"></i></div>') +
      '<div><h2>Log This Meal</h2><p>' + safeMealName + "</p></div>" +
      "</div>" +
      '<label class="meal-log-serving-label" for="log-servings">Number of Servings</label>' +
      '<div class="meal-log-stepper">' +
      '<button type="button" data-serving-step="-0.5" aria-label="Decrease servings">−</button>' +
      '<input id="log-servings" type="number" min="0.5" step="0.5" value="1">' +
      '<button type="button" data-serving-step="0.5" aria-label="Increase servings">+</button>' +
      "</div>" +
      '<div class="meal-log-nutrition">' +
      "<p>Estimated nutrition per serving:</p>" +
      '<div class="meal-log-nutrients">' +
      '<div><strong class="calories">' + n.calories + '</strong><span>Calories</span></div>' +
      '<div><strong class="protein">' + n.protein + 'g</strong><span>Protein</span></div>' +
      '<div><strong class="carbs">' + n.carbs + 'g</strong><span>Carbs</span></div>' +
      '<div><strong class="fat">' + n.fat + 'g</strong><span>Fat</span></div>' +
      "</div></div></div>",
    showCancelButton: true,
    confirmButtonText: '<i class="fa-solid fa-clipboard-list"></i> Log Meal',
    cancelButtonText: "Cancel",
    reverseButtons: true,
    buttonsStyling: false,
    customClass: {
      popup: "meal-log-popup",
      htmlContainer: "meal-log-html",
      actions: "meal-log-actions",
      confirmButton: "meal-log-confirm",
      cancelButton: "meal-log-cancel",
    },
    didOpen: function (popup) {
      const input = popup.querySelector("#log-servings");
      const buttons = popup.querySelectorAll("[data-serving-step]");
      for (let i = 0; i < buttons.length; i++) {
        buttons[i].addEventListener("click", function () {
          const servings = Number(input.value) || 1;
          input.value = Math.max(
            0.5,
            servings + Number(this.dataset.servingStep)
          );
        });
      }
    },
    preConfirm: function () {
      const servings = Number(document.getElementById("log-servings").value);
      if (!Number.isFinite(servings) || servings < 0.5) {
        Swal.showValidationMessage("Enter at least 0.5 serving");
        return false;
      }
      return servings;
    },
  });

  if (!result.isConfirmed) return;

  const s = result.value;

  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const ing = meal["strIngredient" + i];
    const measure = meal["strMeasure" + i];
    if (ing && ing.trim() !== "") {
      ingredients.push({
        name: ing.trim(),
        measure: (measure || "").trim(),
      });
    }
  }

  addFoodLogItem(
    meal.strMeal,
    n.calories * s,
    n.protein * s,
    n.carbs * s,
    n.fat * s,
    {
      servings: s,
      type: "meal",
      mealId: meal.idMeal,
      image: meal.strMealThumb,
      category: meal.strCategory,
      area: meal.strArea,
      ingredients: ingredients,
    }
  );

  renderFoodLog();

  const servingLabel = s === 1 ? "1 serving" : s + " servings";
  await Swal.fire({
    icon: "success",
    title: "Meal Logged!",
    html:
      '<p class="meal-log-success-message">' + safeMealName + " (" +
      servingLabel + ") has been added to your daily log.</p>" +
      '<p class="meal-log-success-calories">+' +
      Math.round(n.calories * s) + " calories</p>",
    showConfirmButton: false,
    timer: 3000,
    customClass: { popup: "meal-log-success-popup" },
  });
}

async function handleCustomEntry() {
  const result = await Swal.fire({
    title: "Custom Entry",
    html:
      '<input id="custom-name" class="swal2-input" placeholder="Food name">' +
      '<input id="custom-calories" type="number" class="swal2-input" placeholder="Calories (kcal)">',
    showCancelButton: true,
    confirmButtonText: "Add",
    preConfirm: function () {
      const name = document.getElementById("custom-name").value.trim();
      const calories = document.getElementById("custom-calories").value;
      if (name === "") {
        Swal.showValidationMessage("Please enter a food name");
        return false;
      }
      return { name: name, calories: calories };
    },
  });

  if (result.isConfirmed) {
    addFoodLogItem(result.value.name, result.value.calories, 0, 0, 0);
    renderFoodLog();
    showToast("Added to Food Log");
  }
}

async function handleClearFoodLog() {
  const result = await Swal.fire({
    title: "Clear Today's Log?",
    text: "This will remove all logged food items for today.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Yes, clear it!",
    confirmButtonColor: "#f94144",
    cancelButtonColor: "#6b7280",
  });

  if (result.isConfirmed) {
    clearTodayFoodLog();
    renderFoodLog();
    await Swal.fire({
      icon: "success",
      title: "Cleared!",
      text: "Your food log has been cleared.",
      showConfirmButton: false,
      timer: 2500,
    });
  }
}

function updateNav(page) {
  const links = document.querySelectorAll(".nav-link");
  for (let i = 0; i < links.length; i++) {
    const text = links[i].querySelector("span");
    if (pages[i] === page) {
      links[i].className = NAV_ACTIVE;
      text.className = "font-semibold";
    } else {
      links[i].className = NAV_INACTIVE;
      text.className = "font-medium";
    }
  }
}

function updateTheme(theme) {
  const isDark = theme === "dark";
  const toggle = document.getElementById("theme-toggle");
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  toggle.setAttribute("aria-pressed", String(isDark));
  toggle.setAttribute(
    "aria-label",
    isDark ? "Switch to light mode" : "Switch to dark mode"
  );
  toggle.querySelector(".theme-toggle-icon i").className = isDark
    ? "fa-solid fa-sun"
    : "fa-solid fa-moon";
  toggle.querySelector(".theme-toggle-label").textContent = isDark
    ? "Light mode"
    : "Dark mode";
}

function setupThemeToggle() {
  const toggle = document.getElementById("theme-toggle");
  let savedTheme = "light";

  try {
    savedTheme = localStorage.getItem("nourishly-theme") || "light";
  } catch (error) {
    console.error("Could not read the saved theme preference.", error);
  }

  updateTheme(savedTheme === "dark" ? "dark" : "light");

  toggle.addEventListener("click", function () {
    const theme =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    updateTheme(theme);

    try {
      localStorage.setItem("nourishly-theme", theme);
    } catch (error) {
      console.error("Could not save the theme preference.", error);
    }

    if (state.currentPage === "foodlog") renderFoodLog();
  });
}

function showPage(page) {
  setCurrentPage(page);

  if (window.location.hash !== "#" + page) {
    window.location.hash = page;
  }

  for (let i = 0; i < mealsSections.length; i++) {
    hideSection(mealsSections[i]);
  }
  hideSection("meal-details");
  hideSection("products-section");
  hideSection("foodlog-section");

  if (page === "meals") {
    for (let i = 0; i < mealsSections.length; i++) {
      showSection(mealsSections[i]);
    }
  } else if (page === "products") {
    showSection("products-section");
  } else if (page === "foodlog") {
    showSection("foodlog-section");
    renderFoodLog();
  }

  document.querySelector("#header h1").textContent = pageTitles[page][0];
  document.querySelector("#header p").textContent = pageTitles[page][1];
  updateNav(page);
  window.scrollTo(0, 0);
}

function setupEvents() {
  setupThemeToggle();
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebar-overlay");
  const menuButton = document.getElementById("header-menu-btn");

  function closeSidebar() {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("active");
    menuButton.setAttribute("aria-expanded", "false");
  }

  menuButton.addEventListener("click", function () {
    const isOpen = sidebar.classList.toggle("open");
    sidebarOverlay.classList.toggle("active", isOpen);
    menuButton.setAttribute("aria-expanded", String(isOpen));
  });
  sidebarOverlay.addEventListener("click", closeSidebar);

  document.getElementById("search-input").addEventListener("input", handleSearch);

  const filterButtons = document.querySelectorAll(".meal-area-filter");
  for (let i = 0; i < filterButtons.length; i++) {
    filterButtons[i].addEventListener("click", function () {
      handleFilterClick(this);
    });
  }

  document.getElementById("categories-grid").addEventListener("click", function (event) {
    const card = event.target.closest(".category-card");
    if (card) {
      handleCategoryClick(card.dataset.category);
    }
  });

  document.getElementById("recipes-grid").addEventListener("click", function (event) {
    const card = event.target.closest(".recipe-card");
    if (card) {
      handleRecipeClick(card.dataset.mealId);
    }
  });

  document.getElementById("meal-details").addEventListener("click", function (event) {
    if (event.target.closest("#back-to-meals-btn")) {
      showPage("meals");
      return;
    }

    if (event.target.closest("#log-meal-btn")) {
      handleLogMeal();
    }
  });

  const navLinks = document.querySelectorAll(".nav-link");
  for (let i = 0; i < navLinks.length; i++) {
    navLinks[i].addEventListener("click", function (event) {
      event.preventDefault();
      showPage(pages[i]);
      closeSidebar();
    });
  }

  document.getElementById("search-product-btn").addEventListener("click", handleProductSearch);
  document.getElementById("lookup-barcode-btn").addEventListener("click", handleBarcodeLookup);
  document.getElementById("product-details-modal").addEventListener("click", function (event) {
    if (
      event.target === this ||
      event.target.closest("#product-details-close") ||
      event.target.closest("#product-details-close-button")
    ) {
      closeProductDetails();
      return;
    }

    if (event.target.closest("#product-details-log")) {
      if (currentProduct) {
        logProduct(currentProduct.code);
        closeProductDetails();
      }
    }
  });
  document.addEventListener("keydown", function (event) {
    if (
      event.key === "Escape" &&
      !document.getElementById("product-details-modal").classList.contains("hidden")
    ) {
      closeProductDetails();
    }
  });

  document.getElementById("product-search-input").addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      handleProductSearch();
    }
  });

  document.getElementById("barcode-input").addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      handleBarcodeLookup();
    }
  });

  const nutriButtons = document.querySelectorAll(".nutri-score-filter");
  for (let i = 0; i < nutriButtons.length; i++) {
    nutriButtons[i].setAttribute(
      "aria-pressed",
      String(nutriButtons[i].classList.contains("is-active"))
    );
    nutriButtons[i].addEventListener("click", function () {
      handleNutriFilter(this);
    });
  }

  const categoryButtons = document.querySelectorAll(".product-category-btn");
  for (let i = 0; i < categoryButtons.length; i++) {
    categoryButtons[i].addEventListener("click", function () {
      handleProductCategory(this);
    });
  }

  document.getElementById("products-grid").addEventListener("click", function (event) {
    const card = event.target.closest(".product-card");
    if (!card) return;

    for (let i = 0; i < state.products.length; i++) {
      if (state.products[i].code === card.dataset.barcode) {
        showProductDetails(state.products[i]);
        return;
      }
    }
  });

  document.getElementById("products-grid").addEventListener("keydown", function (event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest(".product-card");
    if (!card) return;

    event.preventDefault();
    for (let i = 0; i < state.products.length; i++) {
      if (state.products[i].code === card.dataset.barcode) {
        showProductDetails(state.products[i]);
        return;
      }
    }
  });

  document.getElementById("clear-foodlog").addEventListener("click", handleClearFoodLog);

  document.getElementById("logged-items-list").addEventListener("click", function (event) {
    const btn = event.target.closest(".remove-log-btn");
    if (btn) {
      removeFoodLogItem(btn.dataset.id);
      renderFoodLog();
      showFoodLogRemoveNotice();
      return;
    }

    const emptyAction = event.target.closest(".foodlog-empty-action");
    if (emptyAction) {
      showPage(emptyAction.dataset.page);
    }
  });

  const viewToggleContainer = document.getElementById("view-toggle");
  if (viewToggleContainer) {
    const buttons = viewToggleContainer.querySelectorAll("button");
    const gridBtn = buttons[0];
    const listBtn = buttons[1];

    gridBtn.addEventListener("click", function () {
      currentViewMode = "grid";
      gridBtn.className = "px-3 py-1.5 bg-white rounded-md shadow-sm";
      gridBtn.querySelector("i").className = "fa-solid fa-table-cells text-gray-700";
      listBtn.className = "px-3 py-1.5";
      listBtn.querySelector("i").className = "fa-solid fa-list text-gray-500";
      renderCurrentRecipes();
    });

    listBtn.addEventListener("click", function () {
      currentViewMode = "list";
      listBtn.className = "px-3 py-1.5 bg-white rounded-md shadow-sm";
      listBtn.querySelector("i").className = "fa-solid fa-list text-gray-700";
      gridBtn.className = "px-3 py-1.5";
      gridBtn.querySelector("i").className = "fa-solid fa-table-cells text-gray-500";
      renderCurrentRecipes();
    });
  }
}

async function init() {
  setupEvents();

  let startPage = window.location.hash.replace("#", "");
  if (pages.indexOf(startPage) === -1) startPage = "meals";
  showPage(startPage);

  showError("products-grid", "Search for a product or pick a category to see results.");

  await loadCategories();
  await loadRecipes();

  hideLoading();
}

window.addEventListener("hashchange", function () {
  let page = window.location.hash.replace("#", "");
  if (pages.indexOf(page) === -1) page = "meals";
  if (state.currentPage !== page) showPage(page);
});

init();




const navLinks = document.querySelectorAll(".nav-link");
const pageNames = ["meals", "products", "foodlog"];

navLinks.forEach(function (link, index) {
  link.addEventListener("click", function () {
  
    window.location.hash = pageNames[index];
  });
});


window.addEventListener("hashchange", function () {
  const currentHash = window.location.hash.replace("#", "");
  

  if (state.currentPage === currentHash) return;


  const targetIndex = pageNames.indexOf(currentHash);
  if (targetIndex !== -1) {

    navLinks[targetIndex].click();
  }
});


window.addEventListener("load", function () {
  const initialHash = window.location.hash.replace("#", "");
  const targetIndex = pageNames.indexOf(initialHash);
  
  if (targetIndex !== -1) {
   
    setTimeout(function () {
      navLinks[targetIndex].click();
    }, 500);
  }
});