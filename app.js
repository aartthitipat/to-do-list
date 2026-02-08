/**
 * Daily Checklist App with Firebase Authentication
 * เว็บแอปเช็กลิสต์รายวัน พร้อมระบบล็อกอินด้วย Google
 * 
 * Features:
 * - ล็อกอินด้วย Google Account
 * - เพิ่ม/แก้ไข/ลบงาน
 * - ติ๊กเสร็จงาน
 * - แยกตามวัน (Today/Yesterday/Other)
 * - Progress bar
 * - Dark/Light mode
 * - สถิติย้อนหลัง 7 วัน
 * - บันทึกข้อมูลแยกตาม user
 */

// ================================================
// Firebase Configuration
// ================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Firebase configuration
// ⚠️ ต้องใส่ config จาก Firebase Console ของคุณเอง
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Current user
let currentUser = null;

// ================================================
// Data Management
// ================================================

// สร้าง key สำหรับ LocalStorage ที่ unique ต่อ user
function getUserStorageKey() {
    if (!currentUser) return 'dailyChecklist_tasks';
    return `dailyChecklist_tasks_${currentUser.uid}`;
}

// โหลดข้อมูลจาก LocalStorage
function loadTasks() {
    const saved = localStorage.getItem(getUserStorageKey());
    return saved ? JSON.parse(saved) : [];
}

// บันทึกข้อมูลลง LocalStorage
function saveTasks(tasks) {
    localStorage.setItem(getUserStorageKey(), JSON.stringify(tasks));
}

// โหลด Theme
function loadTheme() {
    return localStorage.getItem('dailyChecklist_theme') || 'light';
}

// บันทึก Theme
function saveTheme(theme) {
    localStorage.setItem('dailyChecklist_theme', theme);
}

// ตัวแปร Global
let tasks = [];
let currentEditId = null;

// ================================================
// Authentication Functions
// ================================================

// ล็อกอินด้วย Google
async function loginWithGoogle() {
    try {
        showLoading();
        const result = await signInWithPopup(auth, provider);
        currentUser = result.user;
        console.log('Logged in:', currentUser.displayName);
    } catch (error) {
        console.error('Login error:', error);
        hideLoading();
        alert('ไม่สามารถล็อกอินได้: ' + error.message);
    }
}

// ออกจากระบบ
async function logout() {
    if (confirm('ต้องการออกจากระบบหรือไม่?')) {
        try {
            await signOut(auth);
            currentUser = null;
            tasks = [];
            showLoginScreen();
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
}

// ตรวจสอบสถานะการล็อกอิน
function checkAuthState() {
    showLoading();

    onAuthStateChanged(auth, (user) => {
        hideLoading();

        if (user) {
            currentUser = user;
            tasks = loadTasks();
            showMainApp();
            updateUserInfo();
            renderAll();
        } else {
            currentUser = null;
            showLoginScreen();
        }
    });
}

// แสดง/ซ่อน UI
function showLoginScreen() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('mainHeader').classList.add('hidden');
    document.getElementById('mainContent').classList.add('hidden');
}

function showMainApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainHeader').classList.remove('hidden');
    document.getElementById('mainContent').classList.remove('hidden');
}

function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

function updateUserInfo() {
    if (currentUser) {
        const userAvatar = document.getElementById('userAvatar');
        const userName = document.getElementById('userName');

        userAvatar.src = currentUser.photoURL || 'https://via.placeholder.com/32';
        userName.textContent = currentUser.displayName || currentUser.email;
    }
}

// ================================================
// Date Utilities
// ================================================

// รับวันที่ปัจจุบัน (เฉพาะวัน ไม่มีเวลา)
function getToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// รับวันเมื่อวาน
function getYesterday() {
    const today = getToday();
    return new Date(today.getTime() - 24 * 60 * 60 * 1000);
}

// ตรวจสอบว่าเป็นวันเดียวกันหรือไม่
function isSameDay(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
}

// ตรวจสอบว่าเป็นวันนี้หรือไม่
function isToday(date) {
    return isSameDay(date, getToday());
}

// ตรวจสอบว่าเป็นเมื่อวานหรือไม่
function isYesterday(date) {
    return isSameDay(date, getYesterday());
}

// แปลงวันที่เป็นข้อความ
function formatDate(date) {
    const d = new Date(date);
    const options = { day: 'numeric', month: 'short' };
    return d.toLocaleDateString('th-TH', options);
}

// รับชื่อวันในสัปดาห์
function getDayName(date) {
    const d = new Date(date);
    const days = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
    return days[d.getDay()];
}

// ================================================
// Task Operations
// ================================================

// สร้าง ID ใหม่
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// เพิ่มงานใหม่
function addTask(text) {
    const task = {
        id: generateId(),
        text: text.trim(),
        completed: false,
        createdAt: new Date().toISOString()
    };
    tasks.unshift(task);
    saveTasks(tasks);
    renderAll();
}

// สลับสถานะเสร็จ/ไม่เสร็จ
function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.completed = !task.completed;
        saveTasks(tasks);
        renderAll();
    }
}

// แก้ไขงาน
function editTask(id, newText) {
    const task = tasks.find(t => t.id === id);
    if (task && newText.trim()) {
        task.text = newText.trim();
        saveTasks(tasks);
        renderAll();
    }
}

// ลบงาน
function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks(tasks);
    renderAll();
}

// รีเซ็ตงานวันนี้ (ลบทั้งหมด)
function resetToday() {
    if (confirm('คุณแน่ใจหรือไม่ที่จะลบงานวันนี้ทั้งหมด?')) {
        tasks = tasks.filter(t => !isToday(t.createdAt));
        saveTasks(tasks);
        renderAll();
    }
}

// ลบงานเก่า (ไม่ใช่วันนี้หรือเมื่อวาน)
function clearOldTasks() {
    if (confirm('คุณแน่ใจหรือไม่ที่จะลบงานเก่าทั้งหมด?')) {
        tasks = tasks.filter(t => isToday(t.createdAt) || isYesterday(t.createdAt));
        saveTasks(tasks);
        renderAll();
    }
}

// ================================================
// Filter Tasks by Date
// ================================================

function getTodayTasks() {
    return tasks.filter(t => isToday(t.createdAt));
}

function getYesterdayTasks() {
    return tasks.filter(t => isYesterday(t.createdAt));
}

function getOtherTasks() {
    return tasks.filter(t => !isToday(t.createdAt) && !isYesterday(t.createdAt));
}

// ================================================
// Render Functions
// ================================================

// สร้าง HTML สำหรับ Task Item
function createTaskHTML(task) {
    const li = document.createElement('li');
    li.className = `task-item${task.completed ? ' completed' : ''}`;
    li.dataset.id = task.id;

    li.innerHTML = `
        <label class="task-checkbox">
            <input type="checkbox" ${task.completed ? 'checked' : ''}>
            <span class="checkbox-custom"></span>
        </label>
        <span class="task-text">${escapeHTML(task.text)}</span>
        <span class="task-date">${formatDate(task.createdAt)}</span>
        <div class="task-actions">
            <button class="edit-btn" title="แก้ไข">✏️</button>
            <button class="delete-btn" title="ลบ">🗑️</button>
        </div>
    `;

    // Event Listeners
    const checkbox = li.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', () => toggleTask(task.id));

    const editBtn = li.querySelector('.edit-btn');
    editBtn.addEventListener('click', () => openEditModal(task.id, task.text));

    const deleteBtn = li.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', () => {
        if (confirm('ลบงานนี้หรือไม่?')) {
            deleteTask(task.id);
        }
    });

    return li;
}

// แสดงรายการงาน
function renderTasks() {
    const todayList = document.getElementById('todayTasks');
    const yesterdayList = document.getElementById('yesterdayTasks');
    const otherList = document.getElementById('otherTasks');

    const todayGroup = document.getElementById('todayGroup');
    const yesterdayGroup = document.getElementById('yesterdayGroup');
    const otherGroup = document.getElementById('otherGroup');

    // Clear lists
    todayList.innerHTML = '';
    yesterdayList.innerHTML = '';
    otherList.innerHTML = '';

    // Render Today's tasks
    const todayTasks = getTodayTasks();
    todayTasks.forEach(task => {
        todayList.appendChild(createTaskHTML(task));
    });
    todayGroup.classList.toggle('empty', todayTasks.length === 0);

    // Render Yesterday's tasks
    const yesterdayTasks = getYesterdayTasks();
    yesterdayTasks.forEach(task => {
        yesterdayList.appendChild(createTaskHTML(task));
    });
    yesterdayGroup.classList.toggle('empty', yesterdayTasks.length === 0);

    // Render Other tasks
    const otherTasks = getOtherTasks();
    otherTasks.forEach(task => {
        otherList.appendChild(createTaskHTML(task));
    });
    otherGroup.classList.toggle('empty', otherTasks.length === 0);
}

// อัพเดท Progress Bar
function updateProgress() {
    const todayTasks = getTodayTasks();
    const completedCount = todayTasks.filter(t => t.completed).length;
    const totalCount = todayTasks.length;

    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const progressText = document.getElementById('progressText');
    const progressFill = document.getElementById('progressFill');
    const progressDetail = document.getElementById('progressDetail');

    progressText.textContent = `${percentage}%`;
    progressFill.style.width = `${percentage}%`;

    if (totalCount === 0) {
        progressDetail.textContent = 'ยังไม่มีงานสำหรับวันนี้';
    } else if (completedCount === totalCount) {
        progressDetail.textContent = `🎉 ยอดเยี่ยม! ทำครบ ${totalCount} งานแล้ว!`;
    } else {
        progressDetail.textContent = `เสร็จแล้ว ${completedCount} จาก ${totalCount} งาน`;
    }
}

// แสดงสถิติ
function renderStatistics() {
    const statsGrid = document.getElementById('statsGrid');
    const statsSummary = document.getElementById('statsSummary');

    statsGrid.innerHTML = '';

    const today = getToday();
    let totalCompleted = 0;
    let totalTasks = 0;

    // สร้างข้อมูลสำหรับ 7 วัน
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
        const dayTasks = tasks.filter(t => isSameDay(t.createdAt, date));
        const completed = dayTasks.filter(t => t.completed).length;
        const total = dayTasks.length;

        totalCompleted += completed;
        totalTasks += total;

        const statDay = document.createElement('div');
        statDay.className = `stat-day${i === 0 ? ' today' : ''}`;
        statDay.innerHTML = `
            <div class="stat-day-name">${getDayName(date)}</div>
            <div class="stat-day-date">${date.getDate()}</div>
            <div class="stat-day-count">${completed}</div>
            <div class="stat-day-total">/${total}</div>
        `;
        statsGrid.appendChild(statDay);
    }

    // Summary
    const avgPerDay = totalTasks > 0 ? (totalCompleted / 7).toFixed(1) : 0;
    const completionRate = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

    statsSummary.innerHTML = `
        <div class="summary-item">
            <div class="summary-value">${totalCompleted}</div>
            <div class="summary-label">งานเสร็จ</div>
        </div>
        <div class="summary-item">
            <div class="summary-value">${totalTasks}</div>
            <div class="summary-label">งานทั้งหมด</div>
        </div>
        <div class="summary-item">
            <div class="summary-value">${completionRate}%</div>
            <div class="summary-label">อัตราสำเร็จ</div>
        </div>
    `;
}

// Render ทั้งหมด
function renderAll() {
    renderTasks();
    updateProgress();
    renderStatistics();
}

// ================================================
// Theme Management
// ================================================

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    saveTheme(theme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
}

// ================================================
// Modal Functions
// ================================================

function openEditModal(id, text) {
    currentEditId = id;
    const modal = document.getElementById('editModal');
    const input = document.getElementById('editInput');

    input.value = text;
    modal.classList.add('active');
    input.focus();
    input.select();
}

function closeEditModal() {
    currentEditId = null;
    const modal = document.getElementById('editModal');
    modal.classList.remove('active');
}

function handleEditSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('editInput');
    if (currentEditId && input.value.trim()) {
        editTask(currentEditId, input.value);
        closeEditModal();
    }
}

// ================================================
// Utility Functions
// ================================================

// Escape HTML เพื่อป้องกัน XSS
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ================================================
// Event Listeners & Initialization
// ================================================

document.addEventListener('DOMContentLoaded', () => {
    // ตั้งค่า Theme
    const savedTheme = loadTheme();
    setTheme(savedTheme);

    // ตรวจสอบสถานะการล็อกอิน
    checkAuthState();

    // Google Login Button
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    googleLoginBtn.addEventListener('click', loginWithGoogle);

    // Logout Button
    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn.addEventListener('click', logout);

    // Theme Toggle
    const themeToggle = document.getElementById('themeToggle');
    themeToggle.addEventListener('click', toggleTheme);

    // Add Task Form
    const addTaskForm = document.getElementById('addTaskForm');
    const taskInput = document.getElementById('taskInput');

    addTaskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = taskInput.value.trim();
        if (text) {
            addTask(text);
            taskInput.value = '';
            taskInput.focus();
        }
    });

    // Reset Today Button
    const resetTodayBtn = document.getElementById('resetTodayBtn');
    resetTodayBtn.addEventListener('click', resetToday);

    // Clear Old Tasks Button
    const clearOldBtn = document.getElementById('clearOldBtn');
    clearOldBtn.addEventListener('click', clearOldTasks);

    // Edit Modal
    const editForm = document.getElementById('editForm');
    const modalClose = document.getElementById('modalClose');
    const modalCancel = document.getElementById('modalCancel');
    const editModal = document.getElementById('editModal');

    editForm.addEventListener('submit', handleEditSubmit);
    modalClose.addEventListener('click', closeEditModal);
    modalCancel.addEventListener('click', closeEditModal);

    // Close modal on outside click
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) {
            closeEditModal();
        }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && editModal.classList.contains('active')) {
            closeEditModal();
        }
    });
});
