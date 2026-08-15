// =========================================================
// API CONFIGURATION
// =========================================================

const API_BASE_URL = "https://taskflowwebpage-2.onrender.com";

// =========================================================
// STATE
// =========================================================

let currentUser = localStorage.getItem("username") || "";
let authToken = localStorage.getItem("access_token") || "";
let currentAuthMode = "login";
let tasks = [];
let editingTaskId = null; // null = creating a new task, otherwise editing this id


// =========================================================
// DOM CACHE (grabbed once, reused everywhere)
// =========================================================

const dom = {};

function cacheDom() {
    dom.dateInput = document.getElementById("manualDueDate");
    dom.userDisp = document.getElementById("userNameDisplay");
    dom.userStatus = document.getElementById("userStatusLabel");
    dom.userHeading = document.getElementById("welcomeHeading");
    dom.avatar = document.getElementById("userAvatar");
    dom.authBtnText = document.getElementById("authBtnText");
    dom.authBtn = document.getElementById("authBtn");
    dom.themeSelect = document.getElementById("themeSelect");
    dom.closeBannerBtn = document.getElementById("closeBannerBtn");
    dom.welcomeBanner = document.getElementById("welcomeBanner");
    dom.newTaskBtn = document.getElementById("newTaskBtn");
    dom.saveTaskBtn = document.getElementById("saveTaskBtn");
    dom.taskModalTitle = document.getElementById("taskModalTitle");
    dom.editingTaskIdInput = document.getElementById("editingTaskId");
    dom.manualTitle = document.getElementById("manualTitle");
    dom.manualCategory = document.getElementById("manualCategory");
    dom.manualPriority = document.getElementById("manualPriority");
    dom.manualDueDate = document.getElementById("manualDueDate");
    dom.categoryFilter = document.getElementById("categoryFilter");
    dom.statusFilter = document.getElementById("statusFilter");
    dom.taskList = document.getElementById("taskList");
    dom.toastContainer = document.getElementById("toastContainer");

    dom.authModalTitle = document.getElementById("authModalTitle");
    dom.authUsername = document.getElementById("authUsername");
    dom.authPassword = document.getElementById("authPassword");
    dom.authErrorMsg = document.getElementById("authErrorMsg");
    dom.authSubmitBtn = document.getElementById("authSubmitBtn");
    dom.tabLogin = document.getElementById("tabLogin");
    dom.tabRegister = document.getElementById("tabRegister");

    dom.scheduleContainer = document.getElementById("scheduleContainer");

    dom.totalTasksCount = document.getElementById("totalTasksCount");
    dom.pendingTasksCount = document.getElementById("pendingTasksCount");
    dom.inProgressTasksCount = document.getElementById("inProgressTasksCount");
    dom.completedTasksCount = document.getElementById("completedTasksCount");

    dom.welcomeOverlay = document.getElementById("welcomeOverlay");
    dom.overlayTitle = document.getElementById("overlayTitle");
    dom.overlaySubtext = document.getElementById("overlaySubtext");
}


// =========================================================
// PAGE LOAD — all event wiring happens here (no inline
// onclick/onchange left in the HTML; everything goes
// through addEventListener + event delegation)
// =========================================================

document.addEventListener("DOMContentLoaded", async () => {
    cacheDom();

    const today = new Date().toISOString().split("T")[0];
    if (dom.dateInput) dom.dateInput.value = today;

    bindStaticEvents();
    bindDelegatedEvents();
    setupAIAssistant();

    updateUIForUser();

    if (authToken) {
        await loadTasks();
    } else {
        tasks = [];
        renderTasks();
    }
});

function bindStaticEvents() {
    dom.themeSelect?.addEventListener("change", (e) => changeTheme(e.target.value));
    dom.authBtn?.addEventListener("click", handleAuthAction);
    dom.closeBannerBtn?.addEventListener("click", closeBanner);
    dom.newTaskBtn?.addEventListener("click", () => openTaskModal());
    dom.saveTaskBtn?.addEventListener("click", submitManualTask);
    dom.authSubmitBtn?.addEventListener("click", performAuth);
    dom.categoryFilter?.addEventListener("change", renderTasks);
    dom.statusFilter?.addEventListener("change", renderTasks);

    dom.tabLogin?.addEventListener("click", () => switchAuthTab("login"));
    dom.tabRegister?.addEventListener("click", () => switchAuthTab("register"));

    // Enter-to-submit in the auth form
    [dom.authUsername, dom.authPassword].forEach((el) => {
        el?.addEventListener("keypress", (e) => {
            if (e.key === "Enter") performAuth();
        });
    });
    dom.manualTitle?.addEventListener("keypress", (e) => {
        if (e.key === "Enter") submitManualTask();
    });

    // Generic close/open-modal buttons via data attributes
    document.querySelectorAll("[data-close-modal]").forEach((btn) => {
        btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
    });
    document.querySelectorAll("[data-open-modal]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            openModal(btn.dataset.openModal);
        });
    });

    // Click on the dark overlay (outside the card) closes the modal
    document.querySelectorAll(".modal-overlay").forEach((overlay) => {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) closeModal(overlay.id);
        });
    });

    // Escape key closes any open modal
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            document.querySelectorAll(".modal-overlay").forEach((overlay) => {
                if (overlay.style.display === "flex") closeModal(overlay.id);
            });
        }
    });
}

// Event delegation for the dynamically-rendered task list
// (checkbox, status select, edit button, delete button)
function bindDelegatedEvents() {
    dom.taskList?.addEventListener("click", (e) => {
        const editBtn = e.target.closest("[data-edit-task]");
        if (editBtn) {
            openTaskModal(Number(editBtn.dataset.editTask));
            return;
        }
        const deleteBtn = e.target.closest("[data-delete-task]");
        if (deleteBtn) {
            deleteTask(Number(deleteBtn.dataset.deleteTask));
        }
    });

    dom.taskList?.addEventListener("change", (e) => {
        if (e.target.matches("[data-toggle-task]")) {
            toggleTaskCheck(Number(e.target.dataset.toggleTask));
        }
        if (e.target.matches("[data-status-select]")) {
            updateTaskStatus(Number(e.target.dataset.statusSelect), e.target.value);
        }
    });
}


// =========================================================
// THEME
// =========================================================

function changeTheme(themeClass) {
    document.body.className = themeClass;
    localStorage.setItem("theme", themeClass);
}


// =========================================================
// TOASTS (replaces alert() with a non-blocking UI notice)
// =========================================================

function showToast(message, type = "info") {
    if (!dom.toastContainer) { window.alert(message); return; }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    dom.toastContainer.appendChild(toast);

    setTimeout(() => toast.classList.add("toast-visible"), 10);
    setTimeout(() => {
        toast.classList.remove("toast-visible");
        setTimeout(() => toast.remove(), 250);
    }, 3200);
}


// =========================================================
// WELCOME OVERLAY
// =========================================================

function triggerWelcomeOverlay(titleHTML, subtext) {
    if (!dom.welcomeOverlay || !dom.overlayTitle || !dom.overlaySubtext) return;

    dom.overlayTitle.innerHTML = titleHTML;
    dom.overlaySubtext.innerText = subtext;
    dom.welcomeOverlay.style.display = "flex";

    setTimeout(() => { dom.welcomeOverlay.style.display = "none"; }, 3000);
}


// =========================================================
// UPDATE USER UI
// =========================================================

function updateUIForUser() {
    if (currentUser) {
        if (dom.userDisp) dom.userDisp.innerText = currentUser;
        if (dom.userStatus) dom.userStatus.innerText = "Logged in User";
        if (dom.userHeading) dom.userHeading.innerText = `GRAND WELCOME, ${currentUser.toUpperCase()}!`;
        if (dom.avatar) dom.avatar.innerText = currentUser.charAt(0).toUpperCase();
        if (dom.authBtnText) dom.authBtnText.innerText = "Logout";
    } else {
        if (dom.userDisp) dom.userDisp.innerText = "Guest User";
        if (dom.userStatus) dom.userStatus.innerText = "Logged Out";
        if (dom.userHeading) dom.userHeading.innerText = "GRAND WELCOME, GUEST!";
        if (dom.avatar) dom.avatar.innerText = "?";
        if (dom.authBtnText) dom.authBtnText.innerText = "Login / Register";
    }
}


// =========================================================
// MODAL FUNCTIONS
// =========================================================

function openModal(modalId) {
    if (modalId === "scheduleModal") populateSchedule();

    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = "flex";
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = "none";

    if (modalId === "authModalOverlay" && dom.authErrorMsg) {
        dom.authErrorMsg.style.display = "none";
    }
}

// Opens the task modal in "create" mode (no id) or "edit" mode (id passed)
function openTaskModal(taskId = null) {
    editingTaskId = taskId;

    if (taskId) {
        const task = tasks.find((t) => t.id === taskId);
        if (!task) return;

        if (dom.taskModalTitle) dom.taskModalTitle.innerHTML = '<i class="fa-solid fa-pen"></i> Edit Task';
        if (dom.saveTaskBtn) dom.saveTaskBtn.innerText = "Update Task";
        if (dom.manualTitle) dom.manualTitle.value = task.title;
        if (dom.manualCategory) dom.manualCategory.value = task.category;
        if (dom.manualPriority) dom.manualPriority.value = task.priority;
        if (dom.manualDueDate) dom.manualDueDate.value = task.due_date || "";
    } else {
        if (dom.taskModalTitle) dom.taskModalTitle.innerHTML = '<i class="fa-solid fa-calendar-plus"></i> Create &amp; Schedule Task';
        if (dom.saveTaskBtn) dom.saveTaskBtn.innerText = "Save Task";
        if (dom.manualTitle) dom.manualTitle.value = "";
        if (dom.manualCategory) dom.manualCategory.value = "WORK";
        if (dom.manualPriority) dom.manualPriority.value = "MEDIUM";
        if (dom.manualDueDate) dom.manualDueDate.value = new Date().toISOString().split("T")[0];
    }

    openModal("taskModalOverlay");
}


// =========================================================
// LOGIN / LOGOUT BUTTON
// =========================================================

function handleAuthAction() {
    if (currentUser) {
        logoutUser();
    } else {
        openModal("authModalOverlay");
    }
}


// =========================================================
// SWITCH LOGIN / REGISTER
// =========================================================

function switchAuthTab(mode) {
    currentAuthMode = mode;

    if (mode === "login") {
        dom.tabLogin?.classList.add("active");
        dom.tabRegister?.classList.remove("active");
        if (dom.authSubmitBtn) dom.authSubmitBtn.innerText = "Login";
    } else {
        dom.tabRegister?.classList.add("active");
        dom.tabLogin?.classList.remove("active");
        if (dom.authSubmitBtn) dom.authSubmitBtn.innerText = "Register & Login";
    }
}

function showAuthError(message) {
    if (!dom.authErrorMsg) { showToast(message, "error"); return; }
    dom.authErrorMsg.innerText = message;
    dom.authErrorMsg.style.display = "block";
}


// =========================================================
// REGISTER + LOGIN
// =========================================================

async function performAuth() {
    const name = dom.authUsername?.value.trim();
    const pass = dom.authPassword?.value.trim();

    if (!name || !pass) {
        showAuthError("Please enter both a username and password.");
        return;
    }

    if (dom.authSubmitBtn) dom.authSubmitBtn.disabled = true;

    try {
        if (currentAuthMode === "register") {
            const registerResponse = await fetch(`${API_URL}/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: name, password: pass })
            });
            const registerData = await registerResponse.json();

            if (!registerResponse.ok) {
                showAuthError(registerData.detail || "Registration failed.");
                return;
            }
        }

        const formData = new URLSearchParams();
        formData.append("username", name);
        formData.append("password", pass);

        const loginResponse = await fetch(`${API_URL}/token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formData
        });
        const loginData = await loginResponse.json();

        if (!loginResponse.ok) {
            showAuthError(loginData.detail || "Login failed.");
            return;
        }

        authToken = loginData.access_token;
        currentUser = name;

        localStorage.setItem("access_token", authToken);
        localStorage.setItem("username", currentUser);

        updateUIForUser();
        closeModal("authModalOverlay");

        if (dom.authUsername) dom.authUsername.value = "";
        if (dom.authPassword) dom.authPassword.value = "";

        await loadTasks();

        triggerWelcomeOverlay(
            `WELCOME BACK,<br><span id="overlayName">${escapeHTML(currentUser.toUpperCase())}</span>`,
            "Ready to conquer your tasks?"
        );

    } catch (error) {
        console.error("Authentication error:", error);
        showAuthError("Couldn't reach the backend. Is the server running?");
    } finally {
        if (dom.authSubmitBtn) dom.authSubmitBtn.disabled = false;
    }
}


// =========================================================
// LOAD TASKS FROM BACKEND
// =========================================================

async function loadTasks() {
    if (!authToken) {
        tasks = [];
        renderTasks();
        return;
    }

    try {
        const response = await fetch(`${API_URL}/tasks`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${authToken}` }
        });

        if (response.status === 401) {
            showToast("Your session expired. Please log in again.", "error");
            logoutUser();
            return;
        }

        const data = await response.json();
        if (!response.ok) {
            console.error("Load tasks error:", data);
            showToast("Couldn't load your tasks.", "error");
            return;
        }

        tasks = data.map((task) => ({ ...task, checked: task.status === "Completed" }));
        renderTasks();

    } catch (error) {
        console.error("Error loading tasks:", error);
        showToast("Couldn't reach the backend. Is the server running?", "error");
    }
}


// =========================================================
// CREATE + UPDATE TASK (shared "Save" button — behaves
// differently depending on whether editingTaskId is set)
// =========================================================

async function submitManualTask() {
    const title = dom.manualTitle?.value.trim();
    const category = dom.manualCategory?.value;
    const priority = dom.manualPriority?.value;
    const dueDate = dom.manualDueDate?.value;

    if (!title) {
        showToast("A task title is required.", "error");
        return;
    }

    if (!authToken) {
        showToast("Please log in first.", "error");
        openModal("authModalOverlay");
        return;
    }

    const taskData = { title, category, priority, due_date: dueDate };
    if (dom.saveTaskBtn) dom.saveTaskBtn.disabled = true;

    try {
        const isEditing = Boolean(editingTaskId);
        const url = isEditing ? `${API_URL}/tasks/${editingTaskId}` : `${API_URL}/tasks`;
        const method = isEditing ? "PATCH" : "POST";

        const response = await fetch(url, {
            method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify(taskData)
        });

        const data = await response.json();

        if (response.status === 401) {
            showToast("Your session expired. Please log in again.", "error");
            logoutUser();
            return;
        }

        if (!response.ok) {
            showToast(data.detail || "Couldn't save the task.", "error");
            return;
        }

        if (isEditing) {
            const idx = tasks.findIndex((t) => t.id === editingTaskId);
            if (idx !== -1) tasks[idx] = { ...data, checked: data.status === "Completed" };
            showToast("Task updated.", "success");
        } else {
            tasks.unshift({ ...data, checked: data.status === "Completed" });
            triggerWelcomeOverlay(
                `TASK ADDED<br><span id="overlayName">SUCCESSFULLY!</span>`,
                "New task has been added to your schedule."
            );
        }

        renderTasks();
        closeModal("taskModalOverlay");
        editingTaskId = null;

    } catch (error) {
        console.error("Error saving task:", error);
        showToast("Couldn't reach the backend. Is the server running?", "error");
    } finally {
        if (dom.saveTaskBtn) dom.saveTaskBtn.disabled = false;
    }
}


// =========================================================
// CHECKBOX & UPDATE TASK STATUS
// =========================================================

async function toggleTaskCheck(taskId) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const newStatus = task.checked ? "Pending" : "Completed";
    await updateTaskStatus(taskId, newStatus);
}

async function updateTaskStatus(taskId, newStatus) {
    if (!authToken) {
        showToast("Please log in first.", "error");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/tasks/${taskId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify({ status: newStatus })
        });

        const data = await response.json();

        if (response.status === 401) { logoutUser(); return; }
        if (!response.ok) {
            showToast(data.detail || "Couldn't update the task.", "error");
            return;
        }

        const task = tasks.find((t) => t.id === taskId);
        if (task) {
            task.status = data.status;
            task.checked = data.status === "Completed";
        }
        renderTasks();

    } catch (error) {
        console.error("Update task error:", error);
        showToast("Couldn't reach the backend.", "error");
    }
}


// =========================================================
// DELETE TASK
// =========================================================

async function deleteTask(taskId) {
    if (!authToken) {
        showToast("Please log in first.", "error");
        return;
    }
    if (!confirm("Delete this task?")) return;

    try {
        const response = await fetch(`${API_URL}/tasks/${taskId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (response.status === 401) { logoutUser(); return; }
        if (!response.ok) {
            showToast(data.detail || "Couldn't delete the task.", "error");
            return;
        }

        tasks = tasks.filter((task) => task.id !== taskId);
        renderTasks();
        showToast("Task deleted.", "success");

    } catch (error) {
        console.error("Delete task error:", error);
        showToast("Couldn't reach the backend.", "error");
    }
}


// =========================================================
// RENDER TASKS
// =========================================================

function renderTasks() {
    if (!dom.taskList) return;

    const statusFilterVal = dom.statusFilter?.value || "all";
    const categoryFilterVal = dom.categoryFilter?.value || "all";

    dom.taskList.innerHTML = "";

    const filteredTasks = tasks.filter((task) => {
        const matchesStatus = statusFilterVal === "all" || task.status === statusFilterVal;
        const matchesCategory = categoryFilterVal === "all" || task.category === categoryFilterVal;
        return matchesStatus && matchesCategory;
    });

    if (filteredTasks.length === 0) {
        const hasAnyTasks = tasks.length > 0;
        dom.taskList.innerHTML = `
            <div class="empty-state">
                <i class="fa-regular fa-${hasAnyTasks ? "folder-open" : "clipboard"}"></i>
                <p>${currentUser
                    ? (hasAnyTasks ? "No tasks match these filters." : "No tasks yet.")
                    : "Log in to see your tasks."}</p>
                <span>${currentUser
                    ? (hasAnyTasks ? "Try a different category or status." : "Click \u201c+ New Task\u201d to add your first one.")
                    : ""}</span>
            </div>
        `;
        updateStats();
        return;
    }

    const fragment = document.createDocumentFragment();

    filteredTasks.forEach((task) => {
        let progressPercent = 25;
        if (task.status === "In Progress") progressPercent = 60;
        else if (task.status === "Completed") progressPercent = 100;

        const priorityClass = `priority-${String(task.priority || "medium").toLowerCase()}`;

        const row = document.createElement("div");
        row.className = "task-item animated-box";
        row.innerHTML = `
            <div class="task-checkbox-container">
                <input type="checkbox" class="mini-checkbox" data-toggle-task="${task.id}" ${task.status === "Completed" ? "checked" : ""} />
                <div class="task-title-area">
                    <div class="task-title ${task.status === "Completed" ? "completed" : ""}">
                        ${escapeHTML(task.title)}
                    </div>
                    <div class="task-meta">
                        <span class="mono">#${task.id}</span>
                        <span class="cat-chip">${escapeHTML(task.category)}</span>
                    </div>
                </div>
            </div>
            <div style="flex: 1;">
                <span class="priority-badge ${priorityClass}"><span class="priority-dot"></span>${escapeHTML(task.priority)}</span>
            </div>
            <div class="task-due-date">${formatDateDisplay(task.due_date)}</div>
            <div class="progress-container">
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${progressPercent}%;"></div>
                </div>
                <div class="progress-text">${escapeHTML(task.status)} (${progressPercent}%)</div>
            </div>
            <div class="task-actions">
                <select data-status-select="${task.id}">
                    <option value="Pending" ${task.status === "Pending" ? "selected" : ""}>Pending</option>
                    <option value="In Progress" ${task.status === "In Progress" ? "selected" : ""}>In Progress</option>
                    <option value="Completed" ${task.status === "Completed" ? "selected" : ""}>Completed</option>
                </select>
                <button class="edit-btn" data-edit-task="${task.id}" title="Edit task"><i class="fa-solid fa-pen"></i></button>
                <button class="delete-btn" data-delete-task="${task.id}" title="Delete task"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        fragment.appendChild(row);
    });

    dom.taskList.appendChild(fragment);
    updateStats();
}


// =========================================================
// ESCAPE HTML & DATE FORMAT
// =========================================================

function escapeHTML(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatDateDisplay(dateStr) {
    if (!dateStr) return "No date";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}


// =========================================================
// SCHEDULE & BANNER
// =========================================================

function populateSchedule() {
    if (!dom.scheduleContainer) return;

    if (tasks.length === 0) {
        dom.scheduleContainer.innerHTML = "<p>No tasks scheduled yet.</p>";
        return;
    }

    dom.scheduleContainer.innerHTML = tasks.map((task) => `
        <div style="padding: 8px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between;">
            <span><strong>${escapeHTML(task.title)}</strong> (${escapeHTML(task.category)})</span>
            <span style="color: var(--text-secondary);">📅 ${formatDateDisplay(task.due_date)}</span>
        </div>
    `).join("");
}

function closeBanner() {
    if (dom.welcomeBanner) dom.welcomeBanner.style.display = "none";
}


// =========================================================
// STATISTICS & LOGOUT
// =========================================================

function updateStats() {
    if (dom.totalTasksCount) dom.totalTasksCount.innerText = tasks.length;
    if (dom.pendingTasksCount) dom.pendingTasksCount.innerText = tasks.filter((t) => t.status === "Pending").length;
    if (dom.inProgressTasksCount) dom.inProgressTasksCount.innerText = tasks.filter((t) => t.status === "In Progress").length;
    if (dom.completedTasksCount) dom.completedTasksCount.innerText = tasks.filter((t) => t.status === "Completed").length;
}

function logoutUser() {
    currentUser = "";
    authToken = "";
    tasks = [];

    localStorage.removeItem("username");
    localStorage.removeItem("access_token");

    updateUIForUser();
    renderTasks();
}


// =========================================================
// AI ASSISTANT
// =========================================================

function setupAIAssistant() {
    const aiMenuBtn = document.getElementById("ai-menu-btn");
    const aiModal = document.getElementById("ai-modal");
    const closeAiBtn = document.getElementById("close-ai-btn");
    const sendAiBtn = document.getElementById("send-ai-btn");
    const aiInput = document.getElementById("ai-input");

    if (aiMenuBtn && aiModal) {
        aiMenuBtn.addEventListener("click", (e) => {
            e.preventDefault();
            aiModal.style.display = aiModal.style.display === "block" ? "none" : "block";
        });
    }

    if (closeAiBtn && aiModal) {
        closeAiBtn.addEventListener("click", () => { aiModal.style.display = "none"; });
    }

    if (sendAiBtn) sendAiBtn.addEventListener("click", sendToAI);

    if (aiInput) {
        aiInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") sendToAI();
        });
    }
}

async function sendToAI() {
    const aiInput = document.getElementById("ai-input");
    const aiChatBox = document.getElementById("ai-chat-box");
    if (!aiInput || !aiChatBox) return;

    const promptText = aiInput.value.trim();
    if (!promptText) return;

    aiChatBox.insertAdjacentHTML(
        "beforeend",
        `<div class="ai-bubble-user"><span>${escapeHTML(promptText)}</span></div>`
    );
    aiInput.value = "";
    aiChatBox.scrollTop = aiChatBox.scrollHeight;

    if (!authToken) {
        aiChatBox.insertAdjacentHTML("beforeend", `<div class="ai-bubble-error">Please log in first.</div>`);
        aiChatBox.scrollTop = aiChatBox.scrollHeight;
        return;
    }

    try {
        const response = await fetch(`${API_URL}/ai`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify({ prompt: promptText })
        });

        const data = await response.json();

        if (response.ok) {
            aiChatBox.insertAdjacentHTML(
                "beforeend",
                `<div class="ai-bubble-bot"><span>${escapeHTML(data.response)}</span></div>`
            );
        } else {
            aiChatBox.insertAdjacentHTML(
                "beforeend",
                `<div class="ai-bubble-error">Error: ${escapeHTML(data.detail || "Failed to fetch AI response")}</div>`
            );
        }
    } catch (err) {
        aiChatBox.insertAdjacentHTML("beforeend", `<div class="ai-bubble-error">Backend server is not responding.</div>`);
    }

    aiChatBox.scrollTop = aiChatBox.scrollHeight;
}