// ===========================
//  PAGETURN - Book Tracker
//  app.js
// ===========================

// ---- Firebase Configuration ----
// IMPORTANT: Replace these values with your own Firebase project config
// Get your config from: Firebase Console > Project Settings > Your Apps > SDK setup
const FIREBASE_CONFIG = {
   apiKey: "AIzaSyD-2SCMUJsrkmmWo4IUmWpjPu5TC99C-ho",
  authDomain: "book-tracker-5bc5f.firebaseapp.com",
  projectId: "book-tracker-5bc5f",
  storageBucket: "book-tracker-5bc5f.firebasestorage.app",
  messagingSenderId: "689545850122",
  appId: "1:689545850122:web:f0d244bcf9a4c9e2c51ef3"
};

// ---- Initialize Firebase ----
let db;
let useLocalStorage = false;

try {
  firebase.initializeApp(FIREBASE_CONFIG);
  db = firebase.firestore();
  // Test connection
  db.collection('_ping').limit(1).get().catch(() => {
    console.warn('Firebase not configured – using local storage fallback');
    useLocalStorage = true;
    initApp();
  });
  db.collection('_ping').limit(1).get().then(() => {
    initApp();
  }).catch(() => {});
} catch (e) {
  console.warn('Firebase init failed – using local storage fallback');
  useLocalStorage = true;
  initApp();
}

// ---- Local Storage Fallback ----
const LOCAL_KEY = 'pageturn_data';

function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) || { books: [], goal: { year: new Date().getFullYear(), target: 20 } };
  } catch { return { books: [], goal: { year: new Date().getFullYear(), target: 20 } }; }
}

function saveLocal(data) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
}

// ---- App State ----
let books = [];     // { id, title, author, category, totalPages, currentPage, startDate, endDate, status: 'reading'|'completed', pageLogs: [{date, page}] }
let goal = { year: new Date().getFullYear(), target: 20 };
let currentFilter = 'all';

// ---- DOM Ready ----
function initApp() {
  setGreeting();
  setupNavigation();
  setupModals();
  setupGoalCard();
  loadData();
}

// Fallback if firebase doesn't respond at all
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (!document.getElementById('page-home').classList.contains('_loaded')) {
      useLocalStorage = true;
      initApp();
    }
  }, 2000);
});

// ---- Greeting ----
function setGreeting() {
  const h = new Date().getHours();
  const el = document.getElementById('greeting-time');
  if (el) el.textContent = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  document.getElementById('goal-year').textContent = new Date().getFullYear();
  document.getElementById('page-home').classList.add('_loaded');
}

// ---- Navigation ----
function setupNavigation() {
  const allLinks = document.querySelectorAll('[data-page]');
  allLinks.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(link.dataset.page);
    });
  });
}

function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('[data-page]').forEach(l => l.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('[data-page="' + page + '"]').forEach(l => l.classList.add('active'));

  if (page === 'home') renderHome();
  if (page === 'library') renderLibrary();
  if (page === 'history') renderHistory();
  if (page === 'stats') renderStats();
}

// ---- Data Loading ----
async function loadData() {
  if (useLocalStorage) {
    const local = loadLocal();
    books = local.books || [];
    goal = local.goal || { year: new Date().getFullYear(), target: 20 };
  } else {
    try {
      const [booksSnap, goalSnap] = await Promise.all([
        db.collection('books').get(),
        db.collection('settings').doc('goal').get()
      ]);
      books = booksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (goalSnap.exists) goal = goalSnap.data();
    } catch (e) {
      console.error(e);
      useLocalStorage = true;
      const local = loadLocal();
      books = local.books || [];
      goal = local.goal || { year: new Date().getFullYear(), target: 20 };
    }
  }
  renderHome();
}

async function saveBook(book) {
  if (useLocalStorage) {
    const local = loadLocal();
    const idx = local.books.findIndex(b => b.id === book.id);
    if (idx >= 0) local.books[idx] = book;
    else local.books.push(book);
    saveLocal(local);
  } else {
    const { id, ...data } = book;
    await db.collection('books').doc(id).set(data);
  }
}

async function deleteBookDB(id) {
  if (useLocalStorage) {
    const local = loadLocal();
    local.books = local.books.filter(b => b.id !== id);
    saveLocal(local);
  } else {
    await db.collection('books').doc(id).delete();
  }
}

async function saveGoal() {
  if (useLocalStorage) {
    const local = loadLocal();
    local.goal = goal;
    saveLocal(local);
  } else {
    await db.collection('settings').doc('goal').set(goal);
  }
}

// ---- Modals ----
function setupModals() {
  const overlay = document.getElementById('modal-overlay');
  const closeBtn = document.getElementById('modal-close');
  const form = document.getElementById('add-book-form');

  document.getElementById('fab-add').addEventListener('click', () => openModal());
  document.getElementById('fab-add-lib').addEventListener('click', () => openModal());
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    await addBook();
    closeModal();
  });

  // Set today as default start date
  document.getElementById('book-start-date').value = todayStr();
}

function openModal() {
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById('book-title').focus();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.getElementById('add-book-form').reset();
  document.getElementById('book-start-date').value = todayStr();
}

// ---- Goal Card ----
function setupGoalCard() {
  document.getElementById('goal-edit-btn').addEventListener('click', openGoalModal);
  document.getElementById('goal-modal-close').addEventListener('click', closeGoalModal);
  document.getElementById('goal-modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('goal-modal-overlay')) closeGoalModal();
  });
  document.getElementById('goal-form').addEventListener('submit', async e => {
    e.preventDefault();
    const yr = parseInt(document.getElementById('goal-year-input').value);
    const tgt = parseInt(document.getElementById('goal-target-input').value);
    if (yr && tgt) {
      goal = { year: yr, target: tgt };
      await saveGoal();
      updateGoalCard();
      closeGoalModal();
    }
  });
}

function openGoalModal() {
  document.getElementById('goal-year-input').value = goal.year;
  document.getElementById('goal-target-input').value = goal.target;
  document.getElementById('goal-modal-overlay').classList.add('open');
}

function closeGoalModal() {
  document.getElementById('goal-modal-overlay').classList.remove('open');
}

function updateGoalCard() {
  const completed = books.filter(b => b.status === 'completed' && new Date(b.endDate).getFullYear() === goal.year).length;
  const pct = goal.target > 0 ? Math.min(100, (completed / goal.target) * 100) : 0;

  document.getElementById('goal-year').textContent = goal.year;
  document.getElementById('goal-completed').textContent = String(completed).padStart(2, '0');
  document.getElementById('goal-total').textContent = goal.target;
  document.getElementById('goal-progress-fill').style.width = pct + '%';
}

// ---- Add Book ----
async function addBook() {
  const title = document.getElementById('book-title').value.trim();
  const author = document.getElementById('book-author').value.trim();
  const category = document.getElementById('book-category').value;
  const totalPages = parseInt(document.getElementById('book-pages').value);
  const startDate = document.getElementById('book-start-date').value || todayStr();

  const book = {
    id: 'book_' + Date.now(),
    title, author, category, totalPages,
    currentPage: 0,
    startDate,
    endDate: null,
    status: 'reading',
    pageLogs: []
  };

  books.push(book);
  await saveBook(book);
  renderHome();
  showToast('📖 "' + title + '" added!');
}

// ---- Update Page ----
async function updatePage(bookId, newPage) {
  const book = books.find(b => b.id === bookId);
  if (!book) return;

  newPage = Math.max(0, Math.min(newPage, book.totalPages));
  book.currentPage = newPage;

  // Log today's reading
  const today = todayStr();
  const existing = book.pageLogs.find(l => l.date === today);
  if (existing) existing.page = newPage;
  else book.pageLogs.push({ date: today, page: newPage });

  await saveBook(book);
  renderHome();
}

// ---- Complete Book ----
async function completeBook(bookId) {
  const book = books.find(b => b.id === bookId);
  if (!book) return;

  book.status = 'completed';
  book.currentPage = book.totalPages;
  book.endDate = todayStr();

  await saveBook(book);
  updateGoalCard();
  renderHome();
  showToast('🏆 Book completed! Great job!');
}

// ---- Delete Book ----
async function deleteBook(bookId) {
  if (!confirm('Remove this book?')) return;
  books = books.filter(b => b.id !== bookId);
  await deleteBookDB(bookId);
  renderLibrary();
  showToast('Book removed.');
}

// ---- Render Home ----
function renderHome() {
  updateGoalCard();

  const container = document.getElementById('current-books-container');
  const reading = books.filter(b => b.status === 'reading');

  if (reading.length === 0) {
    container.innerHTML = `<div class="empty-state" id="no-current-books">
      <div class="empty-icon">📭</div>
      <p>No books in progress.<br/>Add your first book!</p>
    </div>`;
    return;
  }

  container.innerHTML = reading.map(book => {
    const pct = book.totalPages > 0 ? Math.round((book.currentPage / book.totalPages) * 100) : 0;
    return `
    <div class="current-book-card">
      <div class="book-category-badge">${esc(book.category)}</div>
      <div class="book-title">${esc(book.title)}</div>
      <div class="book-author">by ${esc(book.author)}</div>
      <div class="progress-section">
        <div class="progress-row">
          <span class="progress-label">Progress</span>
          <span class="progress-pct">${pct}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${pct}%"></div>
        </div>
        <div class="page-update-row">
          <input type="number" class="page-input" id="page-input-${book.id}"
            value="${book.currentPage}" min="0" max="${book.totalPages}"
            placeholder="Page #"
          />
          <span class="page-total">/ ${book.totalPages}</span>
          <button class="update-btn" onclick="handlePageUpdate('${book.id}')">Update</button>
        </div>
      </div>
      <button class="complete-btn" onclick="completeBook('${book.id}')">✓ Mark as Completed</button>
    </div>`;
  }).join('');
}

function handlePageUpdate(bookId) {
  const input = document.getElementById('page-input-' + bookId);
  if (!input) return;
  const val = parseInt(input.value);
  if (!isNaN(val)) updatePage(bookId, val);
}

// ---- Render Library ----
function renderLibrary() {
  const container = document.getElementById('library-books-container');
  let filtered = books.filter(b => b.status === 'reading');
  if (currentFilter !== 'all') filtered = filtered.filter(b => b.category === currentFilter);

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.cat;
      renderLibrary();
    });
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📚</div><p>No books here yet.</p></div>`;
    return;
  }

  container.innerHTML = filtered.map(book => {
    const pct = book.totalPages > 0 ? Math.round((book.currentPage / book.totalPages) * 100) : 0;
    return `<div class="library-card">
      <div class="lib-book-info">
        <div class="lib-book-title">${esc(book.title)}</div>
        <div class="lib-book-author">${esc(book.author)}</div>
        <div class="book-category-badge" style="margin-top:0.3rem">${esc(book.category)}</div>
      </div>
      <div class="lib-progress-mini">
        <div class="lib-pct">${pct}%</div>
        <div class="lib-track"><div class="lib-fill" style="width:${pct}%"></div></div>
      </div>
      <button class="lib-delete-btn" onclick="deleteBook('${book.id}')" title="Remove">🗑</button>
    </div>`;
  }).join('');
}

// ---- Render History ----
function renderHistory() {
  const container = document.getElementById('history-books-container');
  const completed = books.filter(b => b.status === 'completed')
    .sort((a, b) => (b.endDate || '').localeCompare(a.endDate || ''));

  if (completed.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🏆</div><p>No completed books yet.<br/>Keep reading!</p></div>`;
    return;
  }

  const medals = ['🥇','🥈','🥉'];
  container.innerHTML = completed.map((book, i) => {
    const days = daysBetween(book.startDate, book.endDate);
    const endFmt = book.endDate ? new Date(book.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
    return `<div class="history-card">
      <div class="history-medal">${medals[i] || '📗'}</div>
      <div class="history-info">
        <div class="history-title">${esc(book.title)}</div>
        <div class="history-author">by ${esc(book.author)}</div>
        <div class="history-meta">${esc(book.category)} · Finished ${endFmt}</div>
      </div>
      <div class="history-days">
        <div class="history-days-num">${days}</div>
        <div class="history-days-label">days</div>
      </div>
    </div>`;
  }).join('');
}

// ---- Render Stats ----
function renderStats() {
  const completed = books.filter(b => b.status === 'completed');
  const reading = books.filter(b => b.status === 'reading');

  document.getElementById('stat-total').textContent = completed.length;
  document.getElementById('stat-pending').textContent = reading.length;

  if (completed.length > 0) {
    const daysList = completed.map(b => daysBetween(b.startDate, b.endDate));
    const avg = Math.round(daysList.reduce((a, b) => a + b, 0) / daysList.length);
    document.getElementById('stat-avg-days').textContent = avg;
    document.getElementById('stat-longest').textContent = Math.max(...daysList);
    document.getElementById('stat-shortest').textContent = Math.min(...daysList);

    // Avg pages per day
    const totalPages = completed.reduce((s, b) => s + (b.totalPages || 0), 0);
    const totalDays = daysList.reduce((a, b) => a + b, 0) || 1;
    document.getElementById('stat-avg-pages').textContent = Math.round(totalPages / totalDays);
  } else {
    ['stat-avg-days','stat-longest','stat-shortest','stat-avg-pages'].forEach(id => {
      document.getElementById(id).textContent = '—';
    });
  }

  // Streaks from pageLogs
  const streaks = calcStreaks();
  document.getElementById('stat-longest-streak').textContent = streaks.longest > 0 ? streaks.longest + 'd' : '—';
  document.getElementById('stat-shortest-streak').textContent = streaks.current > 0 ? streaks.current + 'd' : '—';

  // Monthly chart
  renderMonthlyChart(completed);
}

function calcStreaks() {
  const allDates = new Set();
  books.forEach(b => (b.pageLogs || []).forEach(l => allDates.add(l.date)));
  const sorted = [...allDates].sort();
  if (sorted.length === 0) return { longest: 0, current: 0 };

  let longest = 1, current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diff = (new Date(sorted[i]) - new Date(sorted[i-1])) / 86400000;
    if (diff === 1) { current++; longest = Math.max(longest, current); }
    else current = 1;
  }

  // Check if streak is ongoing (last log was today or yesterday)
  const lastDate = new Date(sorted[sorted.length - 1]);
  const today = new Date(todayStr());
  const diffFromToday = (today - lastDate) / 86400000;
  const currentStreak = diffFromToday <= 1 ? current : 0;

  return { longest, current: currentStreak };
}

function renderMonthlyChart(completed) {
  const container = document.getElementById('monthly-chart');
  const months = {};

  completed.forEach(b => {
    if (!b.endDate) return;
    const d = new Date(b.endDate);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    months[key] = (months[key] || 0) + 1;
  });

  const keys = Object.keys(months).sort().slice(-12);
  if (keys.length === 0) {
    container.innerHTML = '<div style="color:var(--text3);text-align:center;padding:2rem 0;font-size:0.85rem;">No completed books yet</div>';
    return;
  }

  const maxVal = Math.max(...keys.map(k => months[k]), 1);
  const CHART_H = 120;

  const bars = keys.map(key => {
    const val = months[key];
    const h = Math.round((val / maxVal) * CHART_H);
    const [yr, mo] = key.split('-');
    const label = new Date(parseInt(yr), parseInt(mo) - 1).toLocaleString('en', { month: 'short' });
    return `<div class="chart-bar-col">
      <div class="chart-val-label">${val}</div>
      <div class="chart-bar" style="height:${h}px" data-val="${val}"></div>
      <div class="chart-month-label">${label}</div>
    </div>`;
  }).join('');

  container.innerHTML = `<div class="chart-bars">${bars}</div>`;
}

// ---- Utilities ----
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function daysBetween(start, end) {
  if (!start || !end) return 0;
  const diff = new Date(end) - new Date(start);
  return Math.max(1, Math.round(diff / 86400000));
}

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let toastTimer;
function showToast(msg) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

// Also handle Enter key on page inputs
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.classList.contains('page-input')) {
    const id = e.target.id.replace('page-input-', '');
    handlePageUpdate(id);
  }
});
