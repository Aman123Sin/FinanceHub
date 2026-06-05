const API = "http://localhost:8080";
const CORE_CATEGORIES = ["Food", "Transport", "Shopping", "Bills", "Health", "Entertainment", "Education", "Other"];
const STUDENT_CATEGORIES = ["Canteen", "Books", "Hostel", "Stationery", "Transport Pass", "Exam Fees"];
const ALL_CATEGORIES = [
  ...CORE_CATEGORIES.filter((category) => category !== "Other"),
  ...STUDENT_CATEGORIES,
  "Other"
];

let session = null;
let dashboardExpenses = [];
let adminUsers = [];
let adminRequests = [];
let adminSelectedUser = null;

function saveSession(data) {
  session = data;
  sessionStorage.setItem("fh_session", JSON.stringify(data));
}

function loadSession() {
  const raw = sessionStorage.getItem("fh_session");
  if (!raw) return false;

  try {
    session = JSON.parse(raw);
    return Boolean(session && session.userId);
  } catch (error) {
    clearSession();
    return false;
  }
}

function clearSession() {
  session = null;
  sessionStorage.removeItem("fh_session");
}

function requireSession() {
  if (!loadSession()) {
    window.location.href = "login.html";
    return false;
  }
  return true;
}

async function refreshSession() {
  if (!session?.userId) return;
  try {
    const response = await fetch(`${API}/auth/profile/${session.userId}`);
    const data = await readJson(response);
    if (response.ok) saveSession({ ...session, ...data });
  } catch (error) {
    // Keep the current browser session if the backend is unavailable.
  }
}

function currencyCode() {
  return session?.currency || "INR";
}

function money(value) {
  return `${currencyCode()} ${Number(value || 0).toFixed(2)}`;
}

function initials(name) {
  return String(name || "?")
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showAlert(id, message) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
}

function hideAlert(id) {
  const el = document.getElementById(id);
  if (el) el.hidden = true;
}

function toast(message, ok = true) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.className = ok ? "toast" : "toast err";
  el.hidden = false;
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => {
    el.hidden = true;
  }, 3000);
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

async function checkBackend() {
  const badge = document.getElementById("status-badge");
  if (!badge) return;

  try {
    const response = await fetch(`${API}/`);
    badge.className = response.ok ? "status-badge ok" : "status-badge err";
    badge.innerHTML = `<span></span> ${response.ok ? "Online" : "Server error"}`;
  } catch (error) {
    badge.className = "status-badge err";
    badge.innerHTML = "<span></span> Offline";
  }
}

function setupShell() {
  const avatar = document.getElementById("avatar-btn");
  if (avatar) {
    renderAvatar(avatar, initials(session.name));
    avatar.setAttribute("aria-label", "Open profile menu");
    avatar.setAttribute("aria-expanded", "false");
    if (!avatar.dataset.menuReady) {
      avatar.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleProfileMenu();
      });
      avatar.dataset.menuReady = "true";
    }
  }

  const signout = document.getElementById("signout-btn");
  if (signout) {
    signout.addEventListener("click", () => {
      clearSession();
      window.location.href = "index.html";
    });
  }

  document.querySelectorAll(".admin-link").forEach((link) => {
    link.hidden = session?.role !== "ADMIN";
  });

  checkBackend();
  setupProfileMenu();
}

function setupProfileMenu() {
  const actions = document.querySelector(".topbar-actions");
  const avatar = document.getElementById("avatar-btn");
  if (!actions || !avatar || document.getElementById("profile-menu")) return;

  const menu = document.createElement("div");
  menu.className = "profile-menu";
  menu.id = "profile-menu";
  menu.innerHTML = `
    <a href="dashboard.html">Dashboard</a>
    <a href="features.html">Features</a>
    <a href="subscription.html">Subscription</a>
    ${session?.role === "ADMIN" ? `<a href="admin.html">Admin</a>` : ""}
    <a href="profile.html">Profile</a>
    <button type="button" id="profile-menu-signout">Logout</button>
  `;
  actions.appendChild(menu);

  document.getElementById("profile-menu-signout")?.addEventListener("click", () => {
    clearSession();
    window.location.href = "index.html";
  });

  document.addEventListener("click", (event) => {
    if (!actions.contains(event.target)) closeProfileMenu();
  });
}

function toggleProfileMenu() {
  const menu = document.getElementById("profile-menu");
  const avatar = document.getElementById("avatar-btn");
  if (!menu || !avatar) return;
  const isOpen = menu.classList.toggle("open");
  avatar.setAttribute("aria-expanded", String(isOpen));
}

function closeProfileMenu() {
  document.getElementById("profile-menu")?.classList.remove("open");
  document.getElementById("avatar-btn")?.setAttribute("aria-expanded", "false");
}

function hasPremiumAccess() {
  return Boolean(session?.userId);
}

function requirePremium() {
  const lock = document.getElementById("premium-lock");
  const content = document.querySelector(".premium-content");
  if (hasPremiumAccess()) {
    if (lock) lock.hidden = true;
    if (content) content.hidden = false;
    return true;
  }
  if (lock) lock.hidden = false;
  if (content) content.hidden = true;
  return false;
}

function setupLogin() {
  if (loadSession()) {
    window.location.href = session?.role === "ADMIN" ? "admin.html" : "dashboard.html";
    return;
  }

  document.getElementById("login-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideAlert("login-alert");

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-pass").value;
    const button = document.getElementById("login-btn");

    if (!email || !password) {
      showAlert("login-alert", "Please enter email and password.");
      return;
    }

    button.disabled = true;
    button.textContent = "Signing in...";

    try {
      const response = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await readJson(response);
      if (!response.ok) {
        showAlert("login-alert", data.error || "Login failed.");
        return;
      }
      saveSession(data);
      window.location.href = data.role === "ADMIN" ? "admin.html" : "dashboard.html";
    } catch (error) {
      showAlert("login-alert", "Cannot reach backend. Start the Spring Boot server first.");
    } finally {
      button.disabled = false;
      button.textContent = "Sign in";
    }
  });
}

function setupRegister() {
  if (loadSession()) {
    window.location.href = session?.role === "ADMIN" ? "admin.html" : "dashboard.html";
    return;
  }

  document.getElementById("register-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideAlert("reg-alert");

    const name = document.getElementById("reg-name").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const password = document.getElementById("reg-pass").value;
    const phone = document.getElementById("reg-phone").value.trim();
    const currency = document.getElementById("reg-currency").value;
    const button = document.getElementById("reg-btn");

    if (!name || !email || !password) {
      showAlert("reg-alert", "Name, email, and password are required.");
      return;
    }

    if (password.length < 6) {
      showAlert("reg-alert", "Password must be at least 6 characters.");
      return;
    }

    button.disabled = true;
    button.textContent = "Creating...";

    try {
      const response = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, phone, currency })
      });
      const data = await readJson(response);
      if (!response.ok) {
        showAlert("reg-alert", data.error || "Registration failed.");
        return;
      }
      saveSession(data);
      window.location.href = "dashboard.html";
    } catch (error) {
      showAlert("reg-alert", "Cannot reach backend. Start the Spring Boot server first.");
    } finally {
      button.disabled = false;
      button.textContent = "Create account";
    }
  });
}

async function loadExpenses() {
  const list = document.getElementById("expense-list");
  if (!list) return;

  try {
    dashboardExpenses = await getExpenses();
    renderDashboardData();
  } catch (error) {
    list.innerHTML = `<p class="empty">Could not load expenses. ${escapeHtml(error.message)}</p>`;
  }
}

async function getExpenses() {
  const response = await fetch(`${API}/expenses?userId=${session.userId}`);
  const data = await readJson(response);
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function renderDashboardData() {
  const filtered = filterExpenses(dashboardExpenses);
  renderExpenses(filtered);
  updateStats(filtered);
  renderCategoryChart(filtered);
  renderPaymentChart(filtered);
  renderBudgetAlerts(dashboardExpenses);
  renderDashboardRecurring();
}

function filterExpenses(expenses) {
  const search = document.getElementById("expense-search")?.value.trim().toLowerCase() || "";
  const category = document.getElementById("filter-category")?.value || "All";
  const start = document.getElementById("filter-start")?.value;
  const end = document.getElementById("filter-end")?.value;

  return expenses.filter((expense) => {
    const haystack = `${expense.title || ""} ${expense.description || ""} ${expense.category || ""}`.toLowerCase();
    const matchesSearch = !search || haystack.includes(search);
    const matchesCategory = category === "All" || expense.category === category;
    const expenseDate = expense.date || "";
    const afterStart = !start || expenseDate >= start;
    const beforeEnd = !end || expenseDate <= end;
    return matchesSearch && matchesCategory && afterStart && beforeEnd;
  });
}

function renderExpenses(expenses) {
  const list = document.getElementById("expense-list");
  if (!expenses.length) {
    list.innerHTML = `<p class="empty">No matching expenses found.</p>`;
    return;
  }

  list.innerHTML = [...expenses].reverse().map((expense) => {
    const description = expense.description ? ` - ${escapeHtml(expense.description)}` : "";
    return `
      <div class="expense-item" id="expense-${expense.id}">
        <div>
          <span class="expense-title">${escapeHtml(expense.title)}</span>
          <span class="expense-meta">${escapeHtml(expense.date || "")}${description}</span>
        </div>
        <div class="expense-side">
          <span class="category-badge">${escapeHtml(expense.category || "Other")}</span>
          <span class="amount">${money(expense.amount)}</span>
          <button class="btn btn-soft btn-mini" type="button" data-edit-id="${expense.id}">Edit</button>
          <button class="delete-btn" type="button" data-delete-id="${expense.id}" aria-label="Delete expense">x</button>
        </div>
      </div>
    `;
  }).join("");

  list.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", () => deleteExpense(button.dataset.deleteId));
  });
  list.querySelectorAll("[data-edit-id]").forEach((button) => {
    button.addEventListener("click", () => startEditExpense(button.dataset.editId));
  });
}

function updateStats(expenses) {
  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const now = new Date();
  const month = expenses
    .filter((expense) => {
      const date = new Date(expense.date);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    })
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  document.getElementById("stat-total").textContent = money(total);
  document.getElementById("stat-month").textContent = money(month);
  document.getElementById("stat-count").textContent = expenses.length;
}

function setupDashboard() {
  if (!requireSession()) return;
  setupShell();

  const date = document.getElementById("date");
  if (date) date.value = new Date().toISOString().split("T")[0];
  setupDashboardMode();
  fillCategorySelect(document.getElementById("filter-category"), ["All", ...getActiveCategories()]);
  applyReceiptDraft();

  document.getElementById("expense-search")?.addEventListener("input", renderDashboardData);
  document.getElementById("filter-category")?.addEventListener("change", renderDashboardData);
  document.getElementById("filter-start")?.addEventListener("change", renderDashboardData);
  document.getElementById("filter-end")?.addEventListener("change", renderDashboardData);
  document.getElementById("clear-filters")?.addEventListener("click", () => {
    document.getElementById("expense-search").value = "";
    document.getElementById("filter-category").value = "All";
    document.getElementById("filter-start").value = "";
    document.getElementById("filter-end").value = "";
    renderDashboardData();
  });
  document.getElementById("category")?.addEventListener("change", (event) => {
    applyStudentTemplate(event.target.value);
  });
  document.getElementById("cancel-edit")?.addEventListener("click", resetExpenseForm);

  document.getElementById("expense-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const editingId = document.getElementById("editing-id").value;
    const title = document.getElementById("title").value.trim();
    const amount = parseFloat(document.getElementById("amount").value);
    const category = document.getElementById("category").value;
    const paymentMethod = document.getElementById("payment-method").value;
    const description = document.getElementById("description").value.trim();
    const dateValue = document.getElementById("date").value;

    if (!title) {
      toast("Title is required.", false);
      return;
    }

    if (Number.isNaN(amount) || amount <= 0) {
      toast("Enter a valid amount.", false);
      return;
    }

    try {
      const response = await fetch(editingId ? `${API}/expenses/${editingId}?userId=${session.userId}` : `${API}/expenses`, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          amount,
          category,
          description: addPaymentToDescription(description, paymentMethod),
          date: dateValue,
          userId: session.userId
        })
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

      resetExpenseForm();
      toast(editingId ? "Expense updated." : "Expense added.");
      loadExpenses();
    } catch (error) {
      toast(`Could not save expense: ${error.message}`, false);
    }
  });

  loadExpenses();
}

function applyReceiptDraft() {
  const draft = readStore("receiptDraft", null);
  if (!draft) return;
  document.getElementById("title").value = draft.title || "";
  document.getElementById("amount").value = draft.amount || "";
  document.getElementById("category").value = draft.category || "Other";
  document.getElementById("date").value = draft.date || new Date().toISOString().split("T")[0];
  localStorage.removeItem(storageKey("receiptDraft"));
  toast("Receipt draft loaded. Review and save the expense.");
}

function setupDashboardMode() {
  const isStudentMode = readStore("categoryMode", "standard") === "student";
  fillCategorySelect(document.getElementById("category"), getActiveCategories());
  const summary = document.getElementById("mode-summary");
  if (summary) {
    summary.textContent = isStudentMode
      ? "Student spending mode is active: quick chips and focused categories are available."
      : "Standard category mode is active. Enable Student spending mode from Features for focused categories.";
  }

  const quick = document.getElementById("student-quick-cats");
  if (!quick) return;
  quick.hidden = !isStudentMode;
  quick.innerHTML = STUDENT_CATEGORIES.map((category) => `<button type="button" data-student-cat="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join("");
  quick.querySelectorAll("[data-student-cat]").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById("category").value = button.dataset.studentCat;
      applyStudentTemplate(button.dataset.studentCat);
    });
  });
}

function applyStudentTemplate(category) {
  if (readStore("categoryMode", "standard") !== "student") return;
  const title = document.getElementById("title");
  if (!title || title.value.trim()) return;

  const templates = {
    Canteen: "Canteen meal",
    Books: "Book purchase",
    Hostel: "Hostel expense",
    Stationery: "Stationery purchase",
    "Transport Pass": "Transport pass",
    "Exam Fees": "Exam fee"
  };
  if (templates[category]) title.value = templates[category];
}

function addPaymentToDescription(description, paymentMethod) {
  const clean = description.trim();
  return clean ? `${clean} | Paid by ${paymentMethod}` : `Paid by ${paymentMethod}`;
}

function resetExpenseForm() {
  document.getElementById("expense-form")?.reset();
  document.getElementById("editing-id").value = "";
  document.getElementById("date").value = new Date().toISOString().split("T")[0];
  document.getElementById("expense-submit").textContent = "Add expense";
  document.getElementById("cancel-edit").hidden = true;
  setupDashboardMode();
}

function startEditExpense(id) {
  const expense = dashboardExpenses.find((item) => String(item.id) === String(id));
  if (!expense) return;
  const paymentMethod = String(expense.description || "").match(/Paid by (UPI|Cash|Card)/)?.[1] || "UPI";
  const description = String(expense.description || "").replace(/\s*\|\s*Paid by (UPI|Cash|Card)/, "").replace(/^Paid by (UPI|Cash|Card)$/, "");

  document.getElementById("editing-id").value = expense.id;
  document.getElementById("title").value = expense.title || "";
  document.getElementById("amount").value = expense.amount || "";
  document.getElementById("category").value = expense.category || "Other";
  document.getElementById("payment-method").value = paymentMethod;
  document.getElementById("description").value = description;
  document.getElementById("date").value = expense.date || new Date().toISOString().split("T")[0];
  document.getElementById("expense-submit").textContent = "Update expense";
  document.getElementById("cancel-edit").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderCategoryChart(expenses) {
  const chart = document.getElementById("category-chart");
  if (!chart) return;
  const totals = getActiveCategories()
    .map((category) => ({
      category,
      total: expenses
        .filter((expense) => expense.category === category)
        .reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
    }))
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);
  const max = Math.max(...totals.map((item) => item.total), 1);
  drawBarCanvas("category-canvas", totals.slice(0, 6), max);

  if (!totals.length) {
    chart.innerHTML = `<p class="empty">No chart data for this month.</p>`;
    return;
  }

  chart.innerHTML = totals.map((item) => `
    <div class="chart-row">
      <div>
        <strong>${escapeHtml(item.category)}</strong>
        <span>${money(item.total)}</span>
      </div>
      <div class="chart-track"><i style="width:${Math.max((item.total / max) * 100, 6)}%"></i></div>
    </div>
  `).join("");
}

function extractPaymentMethod(expense) {
  return String(expense.description || "").match(/Paid by (UPI|Cash|Card)/)?.[1] || "UPI";
}

function renderPaymentChart(expenses) {
  const box = document.getElementById("payment-chart");
  if (!box) return;
  const totals = ["UPI", "Cash", "Card"].map((method) => ({
    category: method,
    total: expenses
      .filter((expense) => extractPaymentMethod(expense) === method)
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
  })).filter((item) => item.total > 0);
  const max = Math.max(...totals.map((item) => item.total), 1);
  drawBarCanvas("payment-canvas", totals, max);

  if (!totals.length) {
    box.innerHTML = `<p class="empty">No payment data yet.</p>`;
    return;
  }

  box.innerHTML = totals.map((item) => `
    <div class="chart-row">
      <div>
        <strong>${escapeHtml(item.category)}</strong>
        <span>${money(item.total)}</span>
      </div>
      <div class="chart-track"><i style="width:${Math.max((item.total / max) * 100, 6)}%"></i></div>
    </div>
  `).join("");
}

function drawBarCanvas(canvasId, rows, max) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#f7fafc";
  ctx.fillRect(0, 0, width, height);
  if (!rows.length) {
    ctx.fillStyle = "#6d7a72";
    ctx.font = "16px Segoe UI";
    ctx.fillText("No data available", 24, 42);
    return;
  }
  const barGap = 14;
  const labelWidth = 130;
  const barHeight = Math.min(28, (height - 36) / rows.length - barGap);
  rows.forEach((row, index) => {
    const y = 26 + index * (barHeight + barGap);
    const barWidth = Math.max(((width - labelWidth - 40) * row.total) / max, 8);
    ctx.fillStyle = "#17211c";
    ctx.font = "700 14px Segoe UI";
    ctx.fillText(row.category, 18, y + 18);
    ctx.fillStyle = "#dff3eb";
    ctx.fillRect(labelWidth, y, width - labelWidth - 24, barHeight);
    ctx.fillStyle = "#2f7d63";
    ctx.fillRect(labelWidth, y, barWidth, barHeight);
    ctx.fillStyle = "#1f5d49";
    ctx.font = "700 13px Segoe UI";
    ctx.fillText(money(row.total), labelWidth + 8, y + 18);
  });
}

function renderBudgetAlerts(expenses) {
  const box = document.getElementById("budget-alerts");
  if (!box) return;
  const budgets = Object.entries(readStore("budgets", {}));
  const alerts = budgets.map(([category, limit]) => {
    const spent = sumByCategory(expenses, category);
    const percent = limit ? (spent / limit) * 100 : 0;
    return { category, spent, limit, percent };
  }).filter((item) => item.percent >= 80);

  if (!alerts.length) {
    box.innerHTML = `<p class="empty">No budget warnings right now.</p>`;
    return;
  }

  box.innerHTML = alerts.map((item) => `
    <div class="mini-item">
      <div>
        <strong>${escapeHtml(item.category)} ${item.percent >= 100 ? "limit reached" : "near limit"}</strong>
        <span>${money(item.spent)} of ${money(item.limit)} used</span>
      </div>
    </div>
  `).join("");
}

function renderDashboardRecurring() {
  const box = document.getElementById("dashboard-recurring");
  if (!box) return;
  const recurring = readStore("recurring", []);
  if (!recurring.length) {
    box.innerHTML = `<p class="empty">No recurring expenses saved yet.</p>`;
    return;
  }
  box.innerHTML = recurring.map((item) => `
    <div class="mini-item">
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <span>${money(item.amount)} monthly - ${escapeHtml(item.category)} - ${escapeHtml(item.payment)}</span>
      </div>
    </div>
  `).join("");
}

async function deleteExpense(id, refresh = true) {
  try {
    const response = await fetch(`${API}/expenses/${id}?userId=${session.userId}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await readJson(response);
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    if (refresh) {
      toast("Expense deleted.");
      loadExpenses();
    }
  } catch (error) {
    toast(`Delete failed: ${error.message}`, false);
    throw error;
  }
}

function fillProfile() {
  const userInitials = initials(session.name);
  renderAvatar(document.getElementById("avatar-btn"), userInitials);
  renderAvatar(document.getElementById("profile-avatar"), userInitials);
  document.getElementById("profile-name-display").textContent = session.name || "-";
  document.getElementById("profile-email-display").textContent = session.email || "-";
  document.getElementById("profile-joined").textContent = session.createdAt ? `Member since ${session.createdAt}` : "Member since -";
  document.getElementById("p-name").value = session.name || "";
  document.getElementById("p-email").value = session.email || "";
  document.getElementById("p-phone").value = session.phone || "";
  document.getElementById("p-currency").value = session.currency || "INR";
  document.getElementById("p-cur-pass").value = "";
  document.getElementById("p-new-pass").value = "";
}

function setupProfile() {
  if (!requireSession()) return;
  setupShell();
  fillProfile();
  setupProfilePhoto();

  document.getElementById("profile-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideAlert("profile-alert");

    const name = document.getElementById("p-name").value.trim();
    const phone = document.getElementById("p-phone").value.trim();
    const currency = document.getElementById("p-currency").value;
    const currentPassword = document.getElementById("p-cur-pass").value;
    const newPassword = document.getElementById("p-new-pass").value;

    if (!name) {
      showAlert("profile-alert", "Name cannot be empty.");
      return;
    }

    if (newPassword && newPassword.length < 6) {
      showAlert("profile-alert", "New password must be at least 6 characters.");
      return;
    }

    const payload = { name, phone, currency };
    if (newPassword) {
      payload.currentPassword = currentPassword;
      payload.newPassword = newPassword;
    }

    try {
      const response = await fetch(`${API}/auth/profile/${session.userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await readJson(response);
      if (!response.ok) {
        showAlert("profile-alert", data.error || "Profile update failed.");
        return;
      }
      saveSession({ ...session, ...data });
      fillProfile();
      toast("Profile updated.");
    } catch (error) {
      showAlert("profile-alert", `Could not save profile: ${error.message}`);
    }
  });
}

function renderAvatar(element, fallbackText) {
  if (!element) return;
  const photo = readStore("profilePhoto", null);
  if (photo) {
    element.innerHTML = `<img src="${photo}" alt="Profile photo" />`;
  } else {
    element.textContent = fallbackText;
  }
}

function setupProfilePhoto() {
  document.getElementById("profile-photo")?.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith("image/")) {
      toast("Choose a valid image.", false);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      writeStore("profilePhoto", reader.result);
      fillProfile();
      setupShell();
      toast("Profile photo updated.");
    };
    reader.readAsDataURL(file);
  });
}

function storageKey(name) {
  return `fh_${name}_${session.userId}`;
}

function readStore(name, fallback) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(name))) || fallback;
  } catch (error) {
    return fallback;
  }
}

function writeStore(name, value) {
  localStorage.setItem(storageKey(name), JSON.stringify(value));
}

function getActiveCategories() {
  return readStore("categoryMode", "standard") === "student" ? ALL_CATEGORIES : CORE_CATEGORIES;
}

function fillCategorySelect(select, categories = ALL_CATEGORIES) {
  if (!select) return;
  select.innerHTML = categories
    .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    .join("");
}

function sameMonth(dateText) {
  const date = new Date(dateText);
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function monthKey(dateText) {
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function sumByCategory(expenses, category) {
  return expenses
    .filter((expense) => expense.category === category && sameMonth(expense.date))
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
}

function setupBudgetFeature(expenses) {
  fillCategorySelect(document.getElementById("budget-category"));
  renderBudgets(expenses);

  document.getElementById("budget-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const category = document.getElementById("budget-category").value;
    const limit = Number(document.getElementById("budget-limit").value);

    if (!category || limit <= 0) {
      toast("Enter a valid budget limit.", false);
      return;
    }

    const budgets = readStore("budgets", {});
    budgets[category] = limit;
    writeStore("budgets", budgets);
    document.getElementById("budget-limit").value = "";
    renderBudgets(expenses);
    toast("Budget saved.");
  });
}

function renderBudgets(expenses) {
  const list = document.getElementById("budget-list");
  if (!list) return;
  const entries = Object.entries(readStore("budgets", {}));

  if (!entries.length) {
    list.innerHTML = `<p class="empty">No budget limits saved yet.</p>`;
    return;
  }

  list.innerHTML = entries.map(([category, limit]) => {
    const spent = sumByCategory(expenses, category);
    const percent = Math.min((spent / limit) * 100, 100);
    const state = percent >= 100 ? "danger" : percent >= 80 ? "warn" : "";
    const label = percent >= 100 ? "Limit reached" : percent >= 80 ? "Near limit" : "On track";
    return `
      <div class="mini-item">
        <div>
          <strong>${escapeHtml(category)}</strong>
          <span>${money(spent)} spent of ${money(limit)} - ${label}</span>
          <div class="progress-track"><div class="progress-bar ${state}" style="width:${percent}%"></div></div>
        </div>
        <button class="delete-btn" type="button" data-budget-delete="${escapeHtml(category)}">x</button>
      </div>
    `;
  }).join("");

  list.querySelectorAll("[data-budget-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      const budgets = readStore("budgets", {});
      delete budgets[button.dataset.budgetDelete];
      writeStore("budgets", budgets);
      renderBudgets(expenses);
    });
  });
}

function setupReceiptFeature() {
  renderSavedReceipt();
  fillCategorySelect(document.getElementById("scan-category"), getActiveCategories());
  const scanDate = document.getElementById("scan-date");
  if (scanDate) scanDate.value = new Date().toISOString().split("T")[0];

  document.getElementById("receipt-file")?.addEventListener("change", (event) => {
    const files = [...event.target.files];
    if (!files.length) {
      renderSavedReceipt();
      return;
    }

    Promise.all(files.map(readReceiptFile)).then((newReceipts) => {
      const savedReceipts = readReceipts();
      writeStore("receipts", [...newReceipts, ...savedReceipts].slice(0, 12));
      localStorage.removeItem(storageKey("receipt"));
      document.getElementById("receipt-file").value = "";
      renderSavedReceipt();
      const firstReceipt = newReceipts[0];
      const titleInput = document.getElementById("scan-title");
      const amountInput = document.getElementById("scan-amount");
      if (titleInput && !titleInput.value.trim() && firstReceipt?.name) {
        titleInput.value = firstReceipt.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
      }
      const status = document.getElementById("receipt-auto-status");
      if (status) {
        status.textContent = "Receipt saved. Enter the amount below and add it to Dashboard totals.";
      }
      amountInput?.focus();
      toast(`${newReceipts.length} receipt${newReceipts.length > 1 ? "s" : ""} saved. Add the amount to update Dashboard.`);
    });
  });

  document.getElementById("clear-receipt")?.addEventListener("click", () => {
    localStorage.removeItem(storageKey("receipts"));
    localStorage.removeItem(storageKey("receipt"));
    document.getElementById("receipt-file").value = "";
    renderSavedReceipt();
    toast("Receipts removed.");
  });

  document.getElementById("receipt-preview")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-receipt]");
    if (!button) return;
    deleteReceipt(button.dataset.deleteReceipt);
  });
}

function setupReceiptScannerDraft() {
  document.getElementById("save-scan-draft")?.addEventListener("click", async () => {
    const title = document.getElementById("scan-title").value.trim();
    const amount = Number(document.getElementById("scan-amount").value);
    const category = document.getElementById("scan-category").value;
    const date = document.getElementById("scan-date").value;

    if (!title || amount <= 0) {
      toast("Enter scanned title and amount.", false);
      return;
    }

    try {
      const response = await fetch(`${API}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          amount,
          category,
          description: "Added from confirmed receipt values | Paid by UPI",
          date,
          userId: session.userId
        })
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || "Could not add receipt expense");
      const status = document.getElementById("receipt-auto-status");
      if (status) status.textContent = "Receipt amount added to Dashboard totals.";
      toast("Receipt amount added to Dashboard.");
      ["scan-title", "scan-amount"].forEach((id) => document.getElementById(id).value = "");
      window.setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 700);
    } catch (error) {
      toast(error.message, false);
    }
  });
}

function readReceiptFile(file) {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) {
      resolve({ id: Date.now() + Math.random(), type: "file", name: file.name });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        id: Date.now() + Math.random(),
        type: "image",
        name: file.name,
        dataUrl: reader.result
      });
    };
    reader.readAsDataURL(file);
  });
}

function readReceipts() {
  const receipts = readStore("receipts", []);
  if (receipts.length) return receipts;

  const oldReceipt = readStore("receipt", null);
  return oldReceipt ? [{ ...oldReceipt, id: Date.now() }] : [];
}

function deleteReceipt(id) {
  const receipts = readStore("receipts", []);
  if (!receipts.length) {
    localStorage.removeItem(storageKey("receipt"));
    renderSavedReceipt();
    toast("Receipt deleted.");
    return;
  }

  const nextReceipts = receipts.filter((receipt) => String(receipt.id) !== String(id));
  if (nextReceipts.length) {
    writeStore("receipts", nextReceipts);
  } else {
    localStorage.removeItem(storageKey("receipts"));
  }
  renderSavedReceipt();
  toast("Receipt deleted.");
}

function renderSavedReceipt() {
  const preview = document.getElementById("receipt-preview");
  if (!preview) return;

  const receipts = readReceipts();
  if (!receipts.length) {
    preview.textContent = "No receipts selected.";
    return;
  }

  preview.innerHTML = receipts.map((receipt) => {
    if (receipt.type === "image" && receipt.dataUrl) {
      return `
        <div class="receipt-thumb">
          <img src="${receipt.dataUrl}" alt="Uploaded receipt preview" />
          <span>${escapeHtml(receipt.name || "Saved receipt")}</span>
          <button class="receipt-delete" type="button" data-delete-receipt="${escapeHtml(receipt.id)}">Delete</button>
        </div>
      `;
    }

    return `
      <div class="receipt-thumb">
        <div class="receipt-file">PDF</div>
        <span>${escapeHtml(receipt.name || "Receipt file")}</span>
        <button class="receipt-delete" type="button" data-delete-receipt="${escapeHtml(receipt.id)}">Delete</button>
      </div>
    `;
  }).join("");
}

function setupPredictionFeature(expenses) {
  const totalEl = document.getElementById("prediction-total");
  const noteEl = document.getElementById("prediction-note");
  if (!totalEl || !noteEl) return;

  const monthExpenses = expenses.filter((expense) => sameMonth(expense.date));
  const spent = monthExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const predicted = now.getDate() ? (spent / now.getDate()) * daysInMonth : spent;

  totalEl.textContent = money(predicted);
  noteEl.textContent = `${money(spent)} spent so far this month.`;
}

function setupStudentModeFeature() {
  const cloud = document.getElementById("student-categories");
  if (!cloud) return;
  cloud.innerHTML = STUDENT_CATEGORIES.map((category) => `<span>${escapeHtml(category)}</span>`).join("");
  renderStudentMode();

  document.getElementById("student-mode-toggle")?.addEventListener("click", () => {
    const nextMode = readStore("categoryMode", "standard") === "student" ? "standard" : "student";
    writeStore("categoryMode", nextMode);
    renderStudentMode();
    toast(nextMode === "student" ? "Student spending mode activated." : "Standard categories activated.");
  });
}

function renderStudentMode() {
  const isStudentMode = readStore("categoryMode", "standard") === "student";
  const status = document.getElementById("student-mode-status");
  const toggle = document.getElementById("student-mode-toggle");

  if (status) {
    status.textContent = isStudentMode
      ? "Active: dashboard category list now includes canteen, books, hostel, stationery, transport pass, and exam fees."
      : "Standard categories active. Activate this mode to add focused student spending categories to the dashboard.";
  }

  if (toggle) {
    toggle.textContent = isStudentMode ? "Use standard categories" : "Activate student mode";
  }
}

function setupGoalsFeature() {
  renderGoals();

  document.getElementById("goal-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = document.getElementById("goal-name").value.trim();
    const target = Number(document.getElementById("goal-target").value);
    const saved = Number(document.getElementById("goal-saved").value || 0);
    const targetDate = document.getElementById("goal-date").value;

    if (!name || target <= 0) {
      toast("Enter a valid savings goal.", false);
      return;
    }

    const goals = readStore("goals", []);
    goals.push({ id: Date.now(), name, target, saved, targetDate });
    writeStore("goals", goals);
    event.target.reset();
    renderGoals();
    toast("Goal added.");
  });
}

function renderGoals() {
  const list = document.getElementById("goal-list");
  if (!list) return;
  const goals = readStore("goals", []);

  if (!goals.length) {
    list.innerHTML = `<p class="empty">No savings goals yet.</p>`;
    return;
  }

  list.innerHTML = goals.map((goal) => {
    const saved = Number(goal.saved || 0);
    const target = Number(goal.target || 0);
    const percent = target ? Math.min((saved / target) * 100, 100) : 0;
    const remaining = Math.max(target - saved, 0);
    return `
      <div class="mini-item">
        <div>
          <strong>${escapeHtml(goal.name)}</strong>
          <span>${money(saved)} saved of ${money(target)} - ${money(remaining)} remaining${goal.targetDate ? ` by ${escapeHtml(goal.targetDate)}` : ""}</span>
          <div class="progress-track"><div class="progress-bar" style="width:${percent}%"></div></div>
        </div>
        <button class="delete-btn" type="button" data-goal-delete="${goal.id}">x</button>
      </div>
    `;
  }).join("");

  list.querySelectorAll("[data-goal-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      const goals = readStore("goals", []).filter((goal) => String(goal.id) !== button.dataset.goalDelete);
      writeStore("goals", goals);
      renderGoals();
    });
  });
}

function setupRecurringFeature() {
  fillCategorySelect(document.getElementById("recurring-category"), getActiveCategories());
  renderRecurring();

  document.getElementById("recurring-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = document.getElementById("recurring-title").value.trim();
    const amount = Number(document.getElementById("recurring-amount").value);
    const category = document.getElementById("recurring-category").value;
    const payment = document.getElementById("recurring-payment").value;

    if (!title || amount <= 0) {
      toast("Enter a valid recurring expense.", false);
      return;
    }

    const recurring = readStore("recurring", []);
    recurring.push({ id: Date.now(), title, amount, category, payment });
    writeStore("recurring", recurring);
    event.target.reset();
    renderRecurring();
    toast("Recurring expense saved.");
  });
}

function renderRecurring() {
  const list = document.getElementById("recurring-list");
  if (!list) return;
  const recurring = readStore("recurring", []);

  if (!recurring.length) {
    list.innerHTML = `<p class="empty">No recurring expenses saved yet.</p>`;
    return;
  }

  list.innerHTML = recurring.map((item) => `
    <div class="mini-item">
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <span>${money(item.amount)} monthly - ${escapeHtml(item.category)} - ${escapeHtml(item.payment)}</span>
      </div>
      <button class="delete-btn" type="button" data-recurring-delete="${item.id}">x</button>
    </div>
  `).join("");

  list.querySelectorAll("[data-recurring-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      const recurring = readStore("recurring", []).filter((item) => String(item.id) !== button.dataset.recurringDelete);
      writeStore("recurring", recurring);
      renderRecurring();
    });
  });
}

function setupSplitFeature() {
  document.getElementById("split-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const amount = Number(document.getElementById("split-amount").value);
    const people = Number(document.getElementById("split-people").value);

    if (amount <= 0 || people < 2) {
      toast("Enter amount and at least 2 people.", false);
      return;
    }

    document.getElementById("split-result").textContent = money(amount / people);
  });
}

function setupExportFeature(expenses) {
  document.getElementById("export-csv")?.addEventListener("click", () => {
    const header = ["Title", "Amount", "Category", "Description", "Date"];
    const rows = expenses.map((expense) => [expense.title, expense.amount, expense.category, expense.description, expense.date]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "financehub-monthly-report.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  });

  document.getElementById("print-report")?.addEventListener("click", () => {
    printMonthlyReport(expenses);
  });
}

function printMonthlyReport(expenses) {
  const now = new Date();
  const monthName = now.toLocaleString("en", { month: "long", year: "numeric" });
  const monthExpenses = expenses.filter((expense) => sameMonth(expense.date));
  const total = monthExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const rows = monthExpenses.map((expense) => `
    <tr>
      <td>${escapeHtml(expense.date || "")}</td>
      <td>${escapeHtml(expense.title || "")}</td>
      <td>${escapeHtml(expense.category || "Other")}</td>
      <td>${escapeHtml(expense.description || "")}</td>
      <td class="amount">${money(expense.amount)}</td>
    </tr>
  `).join("");

  const report = window.open("", "_blank");
  if (!report) {
    toast("Allow popups to create the printable report.", false);
    return;
  }

  report.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>FinanceHub Monthly Report</title>
      <style>
        body {
          margin: 36px;
          color: #26231d;
          font-family: Georgia, "Times New Roman", serif;
          background: #fffdf7;
        }
        h1 { margin: 0 0 6px; font-size: 32px; }
        p { margin: 0 0 22px; color: #776f61; }
        .summary {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          padding: 16px;
          margin-bottom: 22px;
          border: 1px solid #ddd2be;
          background: #f8f4ea;
        }
        .summary strong { display: block; font-size: 24px; color: #3f6047; }
        table { width: 100%; border-collapse: collapse; }
        th, td {
          padding: 10px;
          border-bottom: 1px solid #ddd2be;
          text-align: left;
          vertical-align: top;
        }
        th { background: #efe6d3; }
        .amount { text-align: right; font-weight: 700; }
        .empty {
          padding: 20px;
          border: 1px dashed #c8b997;
          text-align: center;
          color: #776f61;
        }
      </style>
    </head>
    <body>
      <h1>FinanceHub Monthly Report</h1>
      <p>${escapeHtml(monthName)}</p>
      <section class="summary">
        <div>
          <span>Total spent</span>
          <strong>${money(total)}</strong>
        </div>
        <div>
          <span>Transactions</span>
          <strong>${monthExpenses.length}</strong>
        </div>
      </section>
      ${monthExpenses.length ? `
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Title</th>
              <th>Category</th>
              <th>Description</th>
              <th class="amount">Amount</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      ` : `<div class="empty">No expenses found for this month.</div>`}
      <script>
        window.onload = () => {
          window.print();
        };
      </script>
    </body>
    </html>
  `);
  report.document.close();
}

function setupUnusualAlertFeature(expenses) {
  const box = document.getElementById("unusual-alert");
  if (!box) return;

  const categoryTotals = ALL_CATEGORIES
    .map((category) => ({ category, total: sumByCategory(expenses, category) }))
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);

  if (categoryTotals.length < 2) {
    box.innerHTML = `<span>Alert status</span><strong>No unusual pattern yet</strong><small>Add more expenses to compare categories.</small>`;
    return;
  }

  const [highest, second] = categoryTotals;
  if (highest.total >= second.total * 2) {
    box.innerHTML = `<span>Alert status</span><strong>${escapeHtml(highest.category)} is unusually high</strong><small>${money(highest.total)} this month, more than double another category.</small>`;
  } else {
    box.innerHTML = `<span>Alert status</span><strong>Spending looks balanced</strong><small>No category is unusually higher right now.</small>`;
  }
}

async function setupFeatures() {
  if (!requireSession()) return;
  await refreshSession();
  setupShell();
  if (!requirePremium()) return;

  let expenses = [];
  try {
    expenses = await getExpenses();
  } catch (error) {
    toast("Some features need backend expense data.", false);
  }

  setupBudgetFeature(expenses);
  setupReceiptFeature();
  setupReceiptScannerDraft();
  setupPredictionFeature(expenses);
  setupStudentModeFeature();
  setupGoalsFeature();
  setupRecurringFeature();
  setupSplitFeature();
  setupExportFeature(expenses);
  setupUnusualAlertFeature(expenses);
}

async function setupSubscription() {
  if (!requireSession()) return;
  await refreshSession();
  setupShell();
  const status = document.getElementById("subscription-status");
  const note = document.getElementById("subscription-note");
  if (status) status.textContent = hasPremiumAccess() ? "Premium active" : "Standard";
  if (note) {
    note.textContent = hasPremiumAccess()
      ? "Premium tools are active without admin approval."
      : "Sign in to use premium tools.";
  }
  await loadLatestPremiumRequest();
  setupPremiumProofUpload();
}

async function loadLatestPremiumRequest() {
  const status = document.getElementById("premium-request-status");
  if (!status) return;
  try {
    const response = await fetch(`${API}/premium/requests/latest?userId=${session.userId}`);
    const data = await readJson(response);
    if (data?.status) {
      status.textContent = `Latest payment request: ${data.status}. Premium access is already active.`;
    } else {
      status.textContent = "Premium access is already active. Payment approval is not required.";
    }
  } catch (error) {
    status.textContent = "Premium access is already active.";
  }
}

function setupPremiumProofUpload() {
  const input = document.getElementById("premium-proof");
  const preview = document.getElementById("premium-proof-preview");
  let proofImage = "";

  input?.addEventListener("change", () => {
    const file = input.files[0];
    if (!file || !file.type.startsWith("image/")) {
      preview.textContent = "Choose a valid payment screenshot.";
      proofImage = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      proofImage = reader.result;
      preview.innerHTML = `<div class="receipt-thumb"><img src="${proofImage}" alt="Payment proof preview" /><span>${escapeHtml(file.name)}</span></div>`;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById("premium-proof-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!proofImage) {
      toast("Upload payment screenshot first.", false);
      return;
    }
    try {
      const response = await fetch(`${API}/premium/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.userId, amount: 49, proofImage })
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || "Could not submit request");
      document.getElementById("premium-request-status").textContent = "Payment proof submitted for records. Premium access is already active.";
      toast("Payment proof sent to admin.");
    } catch (error) {
      document.getElementById("premium-request-status").textContent = error.message;
      toast(error.message, false);
    }
  });
}

async function setupAdmin() {
  if (!requireSession()) return;
  await refreshSession();
  setupShell();
  const box = document.getElementById("admin-users");
  if (session.role !== "ADMIN") {
    box.innerHTML = `<p class="empty">Admin access required.</p>`;
    return;
  }
  document.getElementById("admin-user-search")?.addEventListener("input", renderAdminUsers);
  document.getElementById("admin-plan-filter")?.addEventListener("change", renderAdminUsers);
  document.getElementById("admin-request-filter")?.addEventListener("change", renderPremiumRequests);
  document.getElementById("admin-request-search")?.addEventListener("input", renderPremiumRequests);
  document.getElementById("export-users")?.addEventListener("click", exportAdminUsers);
  document.getElementById("export-requests")?.addEventListener("click", exportAdminRequests);
  setupAdminDetailForms();
  document.getElementById("admin-refresh")?.addEventListener("click", async () => {
    await loadAdminUsers();
    await loadPremiumRequests();
    toast("Admin data refreshed.");
  });
  await loadAdminUsers();
  await loadPremiumRequests();
}

async function loadAdminUsers() {
  const box = document.getElementById("admin-users");
  try {
    const response = await fetch(`${API}/auth/admin/users?adminId=${session.userId}`);
    const users = await readJson(response);
    if (!response.ok) throw new Error(users.error || "Could not load users");
    adminUsers = users;
    renderAdminUsers();
  } catch (error) {
    box.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
  }
}

function renderAdminUsers() {
  const box = document.getElementById("admin-users");
  if (!box) return;
  const search = document.getElementById("admin-user-search")?.value.trim().toLowerCase() || "";
  const plan = document.getElementById("admin-plan-filter")?.value || "All";
  const filtered = adminUsers.filter((user) => {
    const matchesSearch = !search || `${user.name} ${user.email}`.toLowerCase().includes(search);
    const active = user.active !== false;
    const matchesPlan = plan === "All"
      || (plan === "Premium" ? user.premium && active : false)
      || (plan === "Standard" ? !user.premium && active : false)
      || (plan === "Blocked" ? !active : false);
    return matchesSearch && matchesPlan;
  });
  const total = adminUsers.length;
  const premium = adminUsers.filter((user) => user.premium).length;
  const standard = total - premium;
  document.getElementById("admin-total-users").textContent = total;
  document.getElementById("admin-premium-users").textContent = premium;
  document.getElementById("admin-standard-users").textContent = standard;

  if (!filtered.length) {
    box.innerHTML = `<p class="empty">No users found.</p>`;
    return;
  }

  box.innerHTML = filtered.map((user) => `
      <div class="mini-item">
        <div>
          <strong>${escapeHtml(user.name)} ${user.role === "ADMIN" ? "(Admin)" : ""}</strong>
          <span>${escapeHtml(user.email)} - ${user.active === false ? "Blocked" : user.premium ? "Premium active" : "Standard"} - Joined ${escapeHtml(user.createdAt || "-")}</span>
        </div>
        <div class="button-row admin-row-actions">
          <button class="btn btn-outline btn-mini" type="button" data-manage-user="${user.userId}">Manage</button>
          <button class="btn ${user.premium ? "btn-outline" : "btn-primary"} btn-mini" type="button" data-premium-user="${user.userId}" data-premium-next="true" ${user.premium || user.role === "ADMIN" ? "disabled" : ""}>
            ${user.premium ? "Premium active" : "Activate premium"}
          </button>
          <button class="btn btn-outline btn-mini" type="button" data-toggle-user="${user.userId}" ${user.role === "ADMIN" ? "disabled" : ""}>${user.active === false ? "Unblock" : "Block"}</button>
          <button class="btn btn-outline btn-mini danger-action" type="button" data-delete-user="${user.userId}" ${user.role === "ADMIN" ? "disabled" : ""}>Delete user</button>
        </div>
      </div>
    `).join("");
  box.querySelectorAll("[data-manage-user]").forEach((button) => {
    button.addEventListener("click", () => selectAdminUser(button.dataset.manageUser));
  });
  box.querySelectorAll("[data-premium-user]").forEach((button) => {
    button.addEventListener("click", () => updateUserPremium(button.dataset.premiumUser, button.dataset.premiumNext === "true"));
  });
  box.querySelectorAll("[data-toggle-user]").forEach((button) => {
    button.addEventListener("click", () => toggleAdminUserStatus(button.dataset.toggleUser));
  });
  box.querySelectorAll("[data-delete-user]").forEach((button) => {
    button.addEventListener("click", () => deleteAdminUser(button.dataset.deleteUser));
  });
}

async function updateUserPremium(userId, premium) {
  try {
    const response = await fetch(`${API}/auth/admin/users/${userId}/premium?adminId=${session.userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ premium })
    });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.error || "Update failed");
    toast("Premium active.");
    await loadAdminUsers();
  } catch (error) {
    toast(error.message, false);
  }
}

async function deleteAdminUser(userId) {
  const user = adminUsers.find((item) => String(item.userId) === String(userId));
  const label = user ? `${user.name} (${user.email})` : "this user";
  if (!window.confirm(`Delete ${label}? This will remove their expenses and payment requests.`)) return;

  try {
    const response = await fetch(`${API}/auth/admin/users/${userId}?adminId=${session.userId}`, {
      method: "DELETE"
    });
    if (!response.ok) {
      const data = await readJson(response);
      throw new Error(data.error || "Delete failed");
    }
    toast("User deleted.");
    await loadAdminUsers();
    await loadPremiumRequests();
    if (adminSelectedUser?.userId === Number(userId)) {
      adminSelectedUser = null;
      document.getElementById("admin-user-detail-panel").hidden = true;
    }
  } catch (error) {
    toast(error.message, false);
  }
}

async function toggleAdminUserStatus(userId) {
  const user = adminUsers.find((item) => String(item.userId) === String(userId));
  if (!user) return;
  const active = user.active === false;
  try {
    const response = await fetch(`${API}/auth/admin/users/${userId}/status?adminId=${session.userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active })
    });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.error || "Status update failed");
    toast(active ? "User unblocked." : "User blocked.");
    await loadAdminUsers();
    if (adminSelectedUser?.userId === Number(userId)) {
      adminSelectedUser = { ...adminSelectedUser, ...data };
      fillAdminUserDetail(adminSelectedUser);
    }
  } catch (error) {
    toast(error.message, false);
  }
}

function setupAdminDetailForms() {
  document.getElementById("admin-edit-user-form")?.addEventListener("submit", saveAdminUserProfile);
  document.getElementById("admin-reset-password-form")?.addEventListener("submit", resetAdminUserPassword);
  document.getElementById("admin-toggle-active")?.addEventListener("click", () => {
    if (adminSelectedUser) toggleAdminUserStatus(adminSelectedUser.userId);
  });
}

async function selectAdminUser(userId) {
  const user = adminUsers.find((item) => String(item.userId) === String(userId));
  if (!user) return;
  adminSelectedUser = user;
  fillAdminUserDetail(user);
  document.getElementById("admin-user-detail-panel").hidden = false;
  document.getElementById("admin-user-detail-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function fillAdminUserDetail(user) {
  document.getElementById("admin-detail-title").textContent = `${user.name} account`;
  document.getElementById("admin-detail-subtitle").textContent = `${user.email} - ${user.active === false ? "Blocked" : "Active"} - ${user.premium ? "Premium" : "Standard"}`;
  document.getElementById("admin-edit-user-id").value = user.userId;
  document.getElementById("admin-edit-name").value = user.name || "";
  document.getElementById("admin-edit-phone").value = user.phone || "";
  document.getElementById("admin-edit-currency").value = user.currency || "INR";
  document.getElementById("admin-toggle-active").textContent = user.active === false ? "Unblock user" : "Block user";
}

async function saveAdminUserProfile(event) {
  event.preventDefault();
  if (!adminSelectedUser) return;
  const payload = {
    name: document.getElementById("admin-edit-name").value.trim(),
    phone: document.getElementById("admin-edit-phone").value.trim(),
    currency: document.getElementById("admin-edit-currency").value
  };
  if (!payload.name) {
    toast("User name is required.", false);
    return;
  }
  try {
    const response = await fetch(`${API}/auth/admin/users/${adminSelectedUser.userId}?adminId=${session.userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.error || "User update failed");
    adminSelectedUser = { ...adminSelectedUser, ...data };
    toast("User profile updated.");
    await loadAdminUsers();
    fillAdminUserDetail(adminSelectedUser);
  } catch (error) {
    toast(error.message, false);
  }
}

async function resetAdminUserPassword(event) {
  event.preventDefault();
  if (!adminSelectedUser) return;
  const newPassword = document.getElementById("admin-reset-password").value;
  if (newPassword.length < 6) {
    toast("Password must be at least 6 characters.", false);
    return;
  }
  try {
    const response = await fetch(`${API}/auth/admin/users/${adminSelectedUser.userId}/password?adminId=${session.userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword })
    });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.error || "Password reset failed");
    document.getElementById("admin-reset-password").value = "";
    toast("User password reset.");
  } catch (error) {
    toast(error.message, false);
  }
}

async function loadAdminUserExpenses(userId) {
  const box = document.getElementById("admin-user-expenses");
  try {
    const response = await fetch(`${API}/auth/admin/users/${userId}/expenses?adminId=${session.userId}`);
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.error || "Could not load expenses");
    adminUserExpenses = data;
    renderAdminUserExpenses();
  } catch (error) {
    box.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
  }
}

function renderAdminUserExpenses() {
  const box = document.getElementById("admin-user-expenses");
  if (!box) return;
  const total = adminUserExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  document.getElementById("admin-expense-summary").textContent = `${adminUserExpenses.length} expenses - ${money(total)} total`;
  if (!adminUserExpenses.length) {
    box.innerHTML = `<p class="empty">No expenses found for this user.</p>`;
    return;
  }
  box.innerHTML = [...adminUserExpenses].reverse().map((expense) => `
    <div class="mini-item">
      <div>
        <strong>${escapeHtml(expense.title || "-")}</strong>
        <span>${escapeHtml(expense.date || "")} - ${escapeHtml(expense.category || "Other")} - ${escapeHtml(expense.description || "")}</span>
      </div>
      <div class="button-row admin-row-actions">
        <strong>${money(expense.amount)}</strong>
        <button class="btn btn-outline btn-mini" type="button" data-edit-admin-expense="${expense.id}">Edit</button>
        <button class="btn btn-outline btn-mini danger-action" type="button" data-delete-admin-expense="${expense.id}">Delete</button>
      </div>
    </div>
  `).join("");
  box.querySelectorAll("[data-edit-admin-expense]").forEach((button) => {
    button.addEventListener("click", () => editAdminExpense(button.dataset.editAdminExpense));
  });
  box.querySelectorAll("[data-delete-admin-expense]").forEach((button) => {
    button.addEventListener("click", () => deleteAdminExpense(button.dataset.deleteAdminExpense));
  });
}

function editAdminExpense(id) {
  const expense = adminUserExpenses.find((item) => String(item.id) === String(id));
  if (!expense) return;
  document.getElementById("admin-expense-id").value = expense.id;
  document.getElementById("admin-expense-title").value = expense.title || "";
  document.getElementById("admin-expense-amount").value = expense.amount || "";
  document.getElementById("admin-expense-category").value = expense.category || "Other";
  document.getElementById("admin-expense-date").value = expense.date || new Date().toISOString().split("T")[0];
  document.getElementById("admin-expense-description").value = expense.description || "";
  document.getElementById("admin-expense-submit").textContent = "Save expense";
  document.getElementById("admin-expense-cancel").hidden = false;
}

function resetAdminExpenseForm() {
  document.getElementById("admin-expense-id").value = "";
  document.getElementById("admin-expense-title").value = "";
  document.getElementById("admin-expense-amount").value = "";
  document.getElementById("admin-expense-category").value = "Food";
  document.getElementById("admin-expense-date").value = new Date().toISOString().split("T")[0];
  document.getElementById("admin-expense-description").value = "";
  document.getElementById("admin-expense-submit").textContent = "Add expense";
  document.getElementById("admin-expense-cancel").hidden = true;
}

async function saveAdminUserExpense(event) {
  event.preventDefault();
  if (!adminSelectedUser) return;
  const expenseId = document.getElementById("admin-expense-id").value;
  const payload = {
    title: document.getElementById("admin-expense-title").value.trim(),
    amount: Number(document.getElementById("admin-expense-amount").value),
    category: document.getElementById("admin-expense-category").value,
    date: document.getElementById("admin-expense-date").value,
    description: document.getElementById("admin-expense-description").value.trim()
  };
  if (!payload.title || payload.amount <= 0) {
    toast("Enter a valid expense title and amount.", false);
    return;
  }
  const url = expenseId
    ? `${API}/auth/admin/users/${adminSelectedUser.userId}/expenses/${expenseId}?adminId=${session.userId}`
    : `${API}/auth/admin/users/${adminSelectedUser.userId}/expenses?adminId=${session.userId}`;
  try {
    const response = await fetch(url, {
      method: expenseId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.error || "Expense save failed");
    toast(expenseId ? "Expense updated." : "Expense added.");
    resetAdminExpenseForm();
    await loadAdminUserExpenses(adminSelectedUser.userId);
  } catch (error) {
    toast(error.message, false);
  }
}

async function deleteAdminExpense(id) {
  if (!adminSelectedUser || !window.confirm("Delete this expense?")) return;
  try {
    const response = await fetch(`${API}/auth/admin/users/${adminSelectedUser.userId}/expenses/${id}?adminId=${session.userId}`, {
      method: "DELETE"
    });
    if (!response.ok) {
      const data = await readJson(response);
      throw new Error(data.error || "Expense delete failed");
    }
    toast("Expense deleted.");
    await loadAdminUserExpenses(adminSelectedUser.userId);
  } catch (error) {
    toast(error.message, false);
  }
}

async function loadPremiumRequests() {
  const box = document.getElementById("premium-requests");
  if (!box) return;
  try {
    const response = await fetch(`${API}/premium/admin/requests?adminId=${session.userId}`);
    const requests = await readJson(response);
    if (!response.ok) throw new Error(requests.error || "Could not load payment requests");
    adminRequests = requests;
    renderPremiumRequests();
    return;
    if (!requests.length) {
      box.innerHTML = `<p class="empty">No payment requests yet.</p>`;
      return;
    }
    box.innerHTML = requests.map((request) => `
      <article class="request-card">
        <div>
          <h3>${escapeHtml(request.name || "User")}</h3>
          <p>${escapeHtml(request.email || "")}</p>
          <p>Amount: ${money(request.amount || 49)} · Status: <strong>${escapeHtml(request.status)}</strong></p>
        </div>
        ${request.proofImage ? `<img src="${request.proofImage}" alt="Payment proof" />` : `<div class="empty">No proof image</div>`}
        <div class="button-row">
          <button class="btn btn-primary btn-mini" type="button" data-request-approve="${request.id}" ${request.status === "APPROVED" ? "disabled" : ""}>Approve</button>
          <button class="btn btn-outline btn-mini" type="button" data-request-reject="${request.id}" ${request.status === "REJECTED" ? "disabled" : ""}>Reject</button>
        </div>
      </article>
    `).join("");
    box.querySelectorAll("[data-request-approve]").forEach((button) => {
      button.addEventListener("click", () => reviewPremiumRequest(button.dataset.requestApprove, true));
    });
    box.querySelectorAll("[data-request-reject]").forEach((button) => {
      button.addEventListener("click", () => reviewPremiumRequest(button.dataset.requestReject, false));
    });
  } catch (error) {
    box.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
  }
}

function renderPremiumRequests() {
  const box = document.getElementById("premium-requests");
  if (!box) return;

  const total = adminRequests.length;
  const approved = adminRequests.filter((request) => request.status === "APPROVED").length;
  const rejected = adminRequests.filter((request) => request.status === "REJECTED").length;
  document.getElementById("admin-request-total").textContent = total;
  document.getElementById("admin-request-approved").textContent = approved;
  document.getElementById("admin-request-rejected").textContent = rejected;

  const filter = document.getElementById("admin-request-filter")?.value || "All";
  const search = document.getElementById("admin-request-search")?.value.trim().toLowerCase() || "";
  const requests = filter === "All"
    ? adminRequests
    : adminRequests.filter((request) => request.status === filter);
  const visibleRequests = requests.filter((request) => {
    const haystack = `${request.name || ""} ${request.email || ""} ${request.status || ""} ${request.amount || ""}`.toLowerCase();
    return !search || haystack.includes(search);
  });

  if (!visibleRequests.length) {
    box.innerHTML = `<p class="empty">No payment requests found.</p>`;
    return;
  }

  box.innerHTML = visibleRequests.map((request) => `
      <article class="request-card">
        <div>
          <h3>${escapeHtml(request.name || "User")}</h3>
          <p>${escapeHtml(request.email || "")}</p>
          <p>Amount: ${money(request.amount || 49)}</p>
          <span class="status-pill ${requestStatusClass(request.status)}">${escapeHtml(request.status || "PENDING")}</span>
        </div>
        ${request.proofImage ? `<img src="${request.proofImage}" alt="Payment proof" />` : `<div class="empty">No proof image</div>`}
        <div class="button-row request-actions">
          <button class="btn btn-outline btn-mini" type="button" data-proof-request="${request.id}" ${request.proofImage ? "" : "disabled"}>View proof</button>
          <button class="btn btn-primary btn-mini" type="button" data-request-approve="${request.id}" ${request.status === "APPROVED" ? "disabled" : ""}>Approve</button>
          <button class="btn btn-outline btn-mini" type="button" data-request-reject="${request.id}" ${request.status === "REJECTED" ? "disabled" : ""}>Reject</button>
          <button class="btn btn-outline btn-mini danger-action" type="button" data-delete-request="${request.id}">Delete</button>
        </div>
      </article>
    `).join("");
  box.querySelectorAll("[data-proof-request]").forEach((button) => {
    button.addEventListener("click", () => openProofImage(button.dataset.proofRequest));
  });
  box.querySelectorAll("[data-request-approve]").forEach((button) => {
    button.addEventListener("click", () => reviewPremiumRequest(button.dataset.requestApprove, true));
  });
  box.querySelectorAll("[data-request-reject]").forEach((button) => {
    button.addEventListener("click", () => reviewPremiumRequest(button.dataset.requestReject, false));
  });
  box.querySelectorAll("[data-delete-request]").forEach((button) => {
    button.addEventListener("click", () => deletePremiumRequest(button.dataset.deleteRequest));
  });
}

function requestStatusClass(status) {
  if (status === "APPROVED") return "ok";
  if (status === "REJECTED") return "bad";
  return "warn";
}

function openProofImage(id) {
  const request = adminRequests.find((item) => String(item.id) === String(id));
  if (!request?.proofImage) return;
  const tab = window.open("", "_blank");
  if (!tab) {
    toast("Allow popups to view proof.", false);
    return;
  }
  tab.document.write(`
    <title>Payment proof</title>
    <body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#111;">
      <img src="${request.proofImage}" alt="Payment proof" style="max-width:96vw;max-height:96vh;" />
    </body>
  `);
}

function downloadCsv(filename, header, rows) {
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportAdminUsers() {
  downloadCsv(
    "financehub-users.csv",
    ["Name", "Email", "Phone", "Currency", "Plan", "Status", "Joined"],
    adminUsers.map((user) => [
      user.name,
      user.email,
      user.phone,
      user.currency,
      user.premium ? "Premium" : "Standard",
      user.active === false ? "Blocked" : "Active",
      user.createdAt
    ])
  );
}

function exportAdminRequests() {
  downloadCsv(
    "financehub-payment-requests.csv",
    ["Name", "Email", "Amount", "Status", "Created"],
    adminRequests.map((request) => [
      request.name,
      request.email,
      request.amount,
      request.status,
      request.createdAt
    ])
  );
}

function exportSelectedUserExpenses() {
  if (!adminSelectedUser) {
    toast("Select a user first.", false);
    return;
  }
  downloadCsv(
    `financehub-${adminSelectedUser.userId}-expenses.csv`,
    ["Title", "Amount", "Category", "Description", "Date"],
    adminUserExpenses.map((expense) => [
      expense.title,
      expense.amount,
      expense.category,
      expense.description,
      expense.date
    ])
  );
}

async function reviewPremiumRequest(id, approved) {
  try {
    const response = await fetch(`${API}/premium/admin/requests/${id}?adminId=${session.userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved })
    });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.error || "Review failed");
    toast(approved ? "Premium request approved." : "Premium request rejected.");
    await loadPremiumRequests();
    await loadAdminUsers();
  } catch (error) {
    toast(error.message, false);
  }
}

async function deletePremiumRequest(id) {
  if (!window.confirm("Delete this payment request?")) return;
  try {
    const response = await fetch(`${API}/premium/admin/requests/${id}?adminId=${session.userId}`, {
      method: "DELETE"
    });
    if (!response.ok) {
      const data = await readJson(response);
      throw new Error(data.error || "Delete failed");
    }
    toast("Payment request deleted.");
    await loadPremiumRequests();
  } catch (error) {
    toast(error.message, false);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  if (page === "home" && loadSession()) window.location.href = session?.role === "ADMIN" ? "admin.html" : "dashboard.html";
  if (page === "login") setupLogin();
  if (page === "register") setupRegister();
  if (page === "dashboard") setupDashboard();
  if (page === "features") setupFeatures();
  if (page === "subscription") setupSubscription();
  if (page === "admin") setupAdmin();
  if (page === "profile") setupProfile();
});
