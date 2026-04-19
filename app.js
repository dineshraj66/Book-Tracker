// ================================
//  PAGETURN v2 — app.js
// ================================

// ---- Firebase Config ----
// Replace with your own Firebase project config
const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// ---- Firebase Init ----
let db;
let useLocal = false;

try {
  firebase.initializeApp(FIREBASE_CONFIG);
  db = firebase.firestore();
  db.collection('_ping').limit(1).get()
    .then(() => initApp())
    .catch(() => { useLocal = true; initApp(); });
} catch(e) {
  useLocal = true;
}

// Fallback timer — ensure app always starts
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (!window._appInited) { useLocal = true; initApp(); }
  }, 1800);
});

// ---- Local Storage ----
const LS_KEY = 'pageturn_v2';
function lsLoad() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || { books: [], goal: { year: new Date().getFullYear(), target: 20 } }; }
  catch { return { books: [], goal: { year: new Date().getFullYear(), target: 20 } }; }
}
function lsSave(data) { localStorage.setItem(LS_KEY, JSON.stringify(data)); }

// ---- State ----
let books = [];
let goal = { year: new Date().getFullYear(), target: 20 };
let catFilter = 'all';
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let coverDataUrl = null; // temp for new book

// ---- Category → color ----
const CAT_COLORS = {
  'Self Development': '#34d399',
  'Biography':        '#a78bfa',
  'Trading':          '#fbbf24',
  'Relationship':     '#fb7185',
  'Mindset':          '#38bdf8',
  'Finance':          '#34d399',
  'Health':           '#fb7185',
};

// ---- Init ----
function initApp() {
  if (window._appInited) return;
  window._appInited = true;

  setGreeting();
  setupNav();
  setupModals();
  setupGoal();
  setupCoverUpload();
  setupImport();
  loadData();
}

// ---- Greeting ----
function setGreeting() {
  const h = new Date().getHours();
  const el = document.getElementById('greeting-time');
  if (el) el.textContent = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  const gy = document.getElementById('goal-year');
  if (gy) gy.textContent = new Date().getFullYear();
}

// ---- Navigation ----
function setupNav() {
  document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      goTo(el.dataset.page);
    });
  });
}

function goTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('[data-page]').forEach(l => l.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll(`[data-page="${page}"]`).forEach(l => l.classList.add('active'));
  if (page === 'home')    renderHome();
  if (page === 'library') renderLibrary();
  if (page === 'history') renderHistory();
  if (page === 'stats')   renderStats();
  if (page === 'calendar') renderCalendar();
}

// ---- Data ----
async function loadData() {
  if (useLocal) {
    const d = lsLoad();
    books = d.books || [];
    goal  = d.goal  || { year: new Date().getFullYear(), target: 20 };
  } else {
    try {
      const [bs, gs] = await Promise.all([
        db.collection('books').get(),
        db.collection('settings').doc('goal').get()
      ]);
      books = bs.docs.map(d => ({ id: d.id, ...d.data() }));
      if (gs.exists) goal = gs.data();
    } catch(e) {
      useLocal = true;
      const d = lsLoad();
      books = d.books || [];
      goal  = d.goal  || { year: new Date().getFullYear(), target: 20 };
    }
  }
  renderHome();
}

async function saveBook(book) {
  if (useLocal) {
    const d = lsLoad();
    const i = d.books.findIndex(b => b.id === book.id);
    if (i >= 0) d.books[i] = book; else d.books.push(book);
    lsSave(d);
  } else {
    const { id, ...data } = book;
    await db.collection('books').doc(id).set(data);
  }
}

async function deleteBookData(id) {
  if (useLocal) {
    const d = lsLoad();
    d.books = d.books.filter(b => b.id !== id);
    lsSave(d);
  } else {
    await db.collection('books').doc(id).delete();
  }
}

async function saveGoalData() {
  if (useLocal) {
    const d = lsLoad(); d.goal = goal; lsSave(d);
  } else {
    await db.collection('settings').doc('goal').set(goal);
  }
}

// ---- Cover Upload ----
function setupCoverUpload() {
  const area = document.getElementById('cover-upload');
  const fileInput = document.getElementById('cover-file');
  const preview = document.getElementById('cover-preview');
  const placeholder = document.getElementById('cover-placeholder');

  area.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      coverDataUrl = e.target.result;
      preview.src = coverDataUrl;
      preview.style.display = 'block';
      placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
  });
}

// ---- Modals ----
function setupModals() {
  // Add book modal
  const overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-close').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.getElementById('add-book-form').addEventListener('submit', async e => {
    e.preventDefault();
    await addBook();
    closeModal();
  });

  // FAB buttons
  document.getElementById('fab-main').addEventListener('click', openModal);
  document.getElementById('fab-desktop').addEventListener('click', openModal);

  // Goal modal
  const gOverlay = document.getElementById('goal-modal-overlay');
  document.getElementById('goal-modal-close').addEventListener('click', closeGoalModal);
  gOverlay.addEventListener('click', e => { if (e.target === gOverlay) closeGoalModal(); });
  document.getElementById('goal-form').addEventListener('submit', async e => {
    e.preventDefault();
    const yr  = parseInt(document.getElementById('goal-year-input').value);
    const tgt = parseInt(document.getElementById('goal-target-input').value);
    if (yr && tgt) {
      goal = { year: yr, target: tgt };
      await saveGoalData();
      updateGoalCard();
      closeGoalModal();
    }
  });

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
  // Reset cover
  coverDataUrl = null;
  const preview = document.getElementById('cover-preview');
  const placeholder = document.getElementById('cover-placeholder');
  preview.style.display = 'none';
  preview.src = '';
  placeholder.style.display = 'flex';
  document.getElementById('cover-file').value = '';
}

// ---- Goal ----
function setupGoal() {
  document.getElementById('goal-edit-btn').addEventListener('click', openGoalModal);
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
  const done = books.filter(b => b.status === 'completed' && new Date(b.endDate || '').getFullYear() === goal.year).length;
  const pct  = goal.target > 0 ? Math.min(100, (done / goal.target) * 100) : 0;
  document.getElementById('goal-year').textContent      = goal.year;
  document.getElementById('goal-completed').textContent = String(done).padStart(2, '0');
  document.getElementById('goal-total').textContent     = goal.target;
  document.getElementById('goal-progress-fill').style.width = pct + '%';
}

// ---- Add Book ----
async function addBook() {
  const title     = document.getElementById('book-title').value.trim();
  const author    = document.getElementById('book-author').value.trim();
  const category  = document.getElementById('book-category').value;
  const totalPages= parseInt(document.getElementById('book-pages').value);
  const startDate = document.getElementById('book-start-date').value || todayStr();

  const book = {
    id: 'bk_' + Date.now(),
    title, author, category, totalPages,
    currentPage: 0,
    startDate, endDate: null,
    status: 'reading',
    pageLogs: [],
    cover: coverDataUrl || null
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
  const today = todayStr();
  const log = book.pageLogs.find(l => l.date === today);
  if (log) log.page = newPage; else book.pageLogs.push({ date: today, page: newPage });

  // Auto-complete when last page reached
  if (newPage >= book.totalPages) {
    book.status = 'completed';
    book.endDate = today;
    await saveBook(book);
    updateGoalCard();
    renderHome();
    showCompletionToast(book.title);
  } else {
    await saveBook(book);
    renderHome();
    showToast('✅ Progress saved');
  }
}

// Auto-save on blur
window.handlePageBlur = function(id) {
  const inp = document.getElementById('pi-' + id);
  if (!inp) return;
  const v = parseInt(inp.value);
  if (!isNaN(v)) updatePage(id, v);
};

// ---- Delete ----
window.deleteBook = async function(id) {
  if (!confirm('Remove this book from your library?')) return;
  books = books.filter(b => b.id !== id);
  await deleteBookData(id);
  renderLibrary();
  showToast('Book removed.');
};

// ---- Circular Progress SVG ----
function circleProgressSVG(pct, color) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const dash = circ - (pct / 100) * circ;
  return `
  <svg width="64" height="64" viewBox="0 0 64 64">
    <circle class="circle-bg" cx="32" cy="32" r="${r}" />
    <circle class="circle-fill"
      cx="32" cy="32" r="${r}"
      stroke="${color}"
      stroke-dasharray="${circ}"
      stroke-dashoffset="${dash}"
    />
  </svg>`;
}

// ---- Cover HTML ----
function coverThumb(book, cls, placeholderClass) {
  if (book.cover) {
    return `<img src="${book.cover}" class="${cls}" alt="Cover" />`;
  }
  const emoji = { 'Self Development':'🌱','Biography':'👤','Trading':'📈','Relationship':'❤️','Mindset':'🧠','Finance':'💰','Health':'💪' };
  return `<div class="${placeholderClass}">${emoji[book.category] || '📗'}</div>`;
}

// ---- Render Home ----
function renderHome() {
  updateGoalCard();
  const reading = books.filter(b => b.status === 'reading');
  const container = document.getElementById('current-books-container');

  if (!reading.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>No books in progress.<br/>Tap + to add one!</p></div>`;
    return;
  }

  container.innerHTML = reading.map(book => {
    const pct   = book.totalPages > 0 ? Math.round((book.currentPage / book.totalPages) * 100) : 0;
    const color = CAT_COLORS[book.category] || '#38bdf8';
    const catClass = 'cat-' + (book.category || '').replace(/ /g, '\\ ');

    return `
    <div class="book-card">
      ${coverThumb(book, 'book-cover-thumb', 'book-cover-placeholder')}
      <div class="book-card-body">
        <div class="cat-badge ${catClass}">${esc(book.category)}</div>
        <div class="book-title-text">${esc(book.title)}</div>
        <div class="book-author-text">by ${esc(book.author)}</div>
        <div class="progress-row">
          <div class="circle-progress-wrap">
            ${circleProgressSVG(pct, color)}
            <div class="circle-pct-label">${pct}%</div>
          </div>
          <div class="page-update-col">
            <div class="page-update-row">
              <input type="number" class="page-input" id="pi-${book.id}"
                value="${book.currentPage}" min="0" max="${book.totalPages}"
                onblur="handlePageBlur('${book.id}')"
                onkeydown="if(event.key==='Enter')this.blur()" />
              <span class="page-of">/ ${book.totalPages}</span>
            </div>
            <div class="page-hint">Tap outside to save · Last page auto-completes</div>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

}

// ---- Render Library ----
function renderLibrary() {
  const container = document.getElementById('library-books-container');
  let list = books.filter(b => b.status === 'reading');
  if (catFilter !== 'all') list = list.filter(b => b.category === catFilter);

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      catFilter = btn.dataset.cat;
      renderLibrary();
    };
  });

  if (!list.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📚</div><p>No books here yet.</p></div>`;
    return;
  }

  container.innerHTML = list.map(book => {
    const pct = book.totalPages > 0 ? Math.round((book.currentPage / book.totalPages) * 100) : 0;
    const color = CAT_COLORS[book.category] || '#38bdf8';
    return `
    <div class="lib-card">
      ${coverThumb(book, 'lib-cover', 'lib-cover-placeholder')}
      <div class="lib-info">
        <div class="lib-title">${esc(book.title)}</div>
        <div class="lib-author">${esc(book.author)}</div>
        <div class="lib-mini-progress">
          <div class="lib-mini-track"><div class="lib-mini-fill" style="width:${pct}%;background:${color}"></div></div>
          <span class="lib-mini-pct" style="color:${color}">${pct}%</span>
        </div>
      </div>
      <button class="lib-del-btn" onclick="deleteBook('${book.id}')" title="Remove">🗑</button>
    </div>`;
  }).join('');
}

// ---- Render History ----
function renderHistory() {
  const container = document.getElementById('history-books-container');
  const done = books.filter(b => b.status === 'completed')
    .sort((a, b) => (b.endDate || '').localeCompare(a.endDate || ''));

  if (!done.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🏆</div><p>No completed books yet.<br/>Keep reading!</p></div>`;
    return;
  }

  const medals = ['🥇','🥈','🥉'];
  container.innerHTML = done.map((book, i) => {
    const days = daysBetween(book.startDate, book.endDate);
    const dateFmt = book.endDate ? new Date(book.endDate).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '—';
    return `
    <div class="history-card">
      ${coverThumb(book, 'hist-cover', 'hist-cover-placeholder')}
      <div class="hist-info">
        <div class="hist-title">${medals[i] || '📗'} ${esc(book.title)}</div>
        <div class="hist-author">by ${esc(book.author)}</div>
        <div class="hist-meta">${esc(book.category)} · Finished ${dateFmt}</div>
      </div>
      <div class="hist-days">
        <div class="hist-days-num">${days}</div>
        <div class="hist-days-lbl">days</div>
      </div>
    </div>`;
  }).join('');
}

// ---- Render Stats ----
function renderStats() {
  const done    = books.filter(b => b.status === 'completed');
  const reading = books.filter(b => b.status === 'reading');

  document.getElementById('stat-total').textContent   = done.length;
  document.getElementById('stat-pending').textContent = reading.length;

  if (done.length) {
    const daysList = done.map(b => daysBetween(b.startDate, b.endDate));
    document.getElementById('stat-avg-days').textContent = Math.round(daysList.reduce((a,b)=>a+b,0)/daysList.length);
    document.getElementById('stat-longest').textContent  = Math.max(...daysList);
    document.getElementById('stat-shortest').textContent = Math.min(...daysList);
    const totalPg = done.reduce((s,b)=>s+(b.totalPages||0),0);
    const totalDy = daysList.reduce((a,b)=>a+b,0)||1;
    document.getElementById('stat-avg-pages').textContent = Math.round(totalPg/totalDy);
  } else {
    ['stat-avg-days','stat-longest','stat-shortest','stat-avg-pages'].forEach(id => {
      document.getElementById(id).textContent = '—';
    });
  }

  const streaks = calcStreaks();
  document.getElementById('stat-longest-streak').textContent  = streaks.longest  > 0 ? streaks.longest  + 'd' : '—';
  document.getElementById('stat-shortest-streak').textContent = streaks.current  > 0 ? streaks.current  + 'd' : '—';

  renderChart(done);
  renderCategoryChart();
  renderPaceChart();
}

function calcStreaks() {
  const dates = new Set();
  books.forEach(b => (b.pageLogs||[]).forEach(l => dates.add(l.date)));
  const sorted = [...dates].sort();
  if (!sorted.length) return { longest:0, current:0 };
  let longest=1, cur=1;
  for (let i=1; i<sorted.length; i++) {
    const diff = (new Date(sorted[i]) - new Date(sorted[i-1])) / 86400000;
    if (diff === 1) { cur++; longest = Math.max(longest, cur); } else cur = 1;
  }
  const last = new Date(sorted[sorted.length-1]);
  const diffToday = (new Date(todayStr()) - last) / 86400000;
  return { longest, current: diffToday <= 1 ? cur : 0 };
}

function renderChart(done) {
  const container = document.getElementById('monthly-chart');
  const months = {};
  done.forEach(b => {
    if (!b.endDate) return;
    const d = new Date(b.endDate);
    const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    months[key] = (months[key]||0) + 1;
  });
  const keys = Object.keys(months).sort().slice(-12);
  if (!keys.length) {
    container.innerHTML = '<div style="color:var(--text3);text-align:center;padding:2rem;font-size:0.85rem;">No data yet</div>';
    return;
  }
  const maxV = Math.max(...keys.map(k=>months[k]), 1);
  const H = 110;
  container.innerHTML = `<div class="chart-bars">${keys.map(key => {
    const v = months[key];
    const h = Math.round((v/maxV)*H);
    const [yr,mo] = key.split('-');
    const lbl = new Date(+yr, +mo-1).toLocaleString('en',{month:'short'}) + (keys.filter(k=>k.startsWith(yr)).length < keys.length ? "'" + String(yr).slice(2) : '');
    return `<div class="chart-col">
      <div class="chart-val">${v}</div>
      <div class="chart-bar" style="height:${h}px" data-val="${v}"></div>
      <div class="chart-month">${lbl}</div>
    </div>`;
  }).join('')}</div>`;
}

// ---- Utils ----
function todayStr() { return new Date().toISOString().split('T')[0]; }
function daysBetween(a,b) {
  if (!a||!b) return 0;
  return Math.max(1, Math.round((new Date(b)-new Date(a))/86400000));
}
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let _toastTimer;
function showToast(msg) {
  let t = document.getElementById('_toast');
  if (!t) { t = document.createElement('div'); t.id='_toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(()=>t.classList.remove('show'), 2800);
}

function showCompletionToast(title) {
  let t = document.getElementById('_completion_toast');
  if (!t) {
    t = document.createElement('div');
    t.id = '_completion_toast';
    t.className = 'toast toast-completion';
    document.body.appendChild(t);
  }
  t.innerHTML = `🏆 "${esc(title)}" moved to History! <span class="toast-undo-btn">Undo</span>`;
  t.classList.add('show');

  t.querySelector('.toast-undo-btn').onclick = async () => {
    const book = books.find(b => b.title === title && b.status === 'completed');
    if (book) {
      book.status = 'reading';
      book.endDate = null;
      book.currentPage = book.totalPages - 1;
      await saveBook(book);
      updateGoalCard();
      renderHome();
    }
    t.classList.remove('show');
  };

  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 5000);
}

// ================================
//  IMPORT FEATURE
// ================================

// Global function so onclick= in HTML always works
window.openImportModal = function() {
  const overlay = document.getElementById('import-modal-overlay');
  if (!overlay) return;
  overlay.classList.add('open');
  // Reset state
  document.getElementById('import-preview').style.display  = 'none';
  document.getElementById('import-result').style.display   = 'none';
  document.getElementById('import-drop').style.display     = 'flex';
  document.getElementById('import-file').value = '';
};

function setupImport() {
  const importBtn     = document.getElementById('import-btn');
  const overlay       = document.getElementById('import-modal-overlay');
  const closeBtn      = document.getElementById('import-modal-close');
  const dropArea      = document.getElementById('import-drop');
  const fileInput     = document.getElementById('import-file');
  const preview       = document.getElementById('import-preview');
  const previewInfo   = document.getElementById('import-preview-info');
  const confirmBtn    = document.getElementById('import-confirm-btn');
  const resultDiv     = document.getElementById('import-result');

  if (!importBtn) return;

  let parsedBooks = null;

  importBtn.addEventListener('click', () => window.openImportModal());

  closeBtn.addEventListener('click', () => overlay.classList.remove('open'));
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });

  dropArea.addEventListener('click', () => fileInput.click());

  // Drag & drop
  dropArea.addEventListener('dragover', e => { e.preventDefault(); dropArea.classList.add('dragover'); });
  dropArea.addEventListener('dragleave', () => dropArea.classList.remove('dragover'));
  dropArea.addEventListener('drop', e => {
    e.preventDefault();
    dropArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) readImportFile(file);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) readImportFile(fileInput.files[0]);
  });

  function readImportFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        // Accept array directly or { books: [...] }
        parsedBooks = Array.isArray(data) ? data : (data.books || []);

        if (!parsedBooks.length) {
          showResult('❌ No books found in file.', false);
          return;
        }

        // Count new vs duplicate
        const existingIds    = new Set(books.map(b => b.id));
        const existingTitles = new Set(books.map(b => b.title.toLowerCase().trim()));
        const newBooks  = parsedBooks.filter(b => !existingTitles.has((b.title||'').toLowerCase().trim()));
        const dupes     = parsedBooks.length - newBooks.length;
        const completed = parsedBooks.filter(b => b.status === 'completed').length;
        const reading   = parsedBooks.filter(b => b.status === 'reading').length;

        previewInfo.innerHTML = `
          <div class="import-stat-row">
            <div class="import-stat"><span class="import-stat-n">${parsedBooks.length}</span><span>Total</span></div>
            <div class="import-stat"><span class="import-stat-n" style="color:var(--green)">${completed}</span><span>Completed</span></div>
            <div class="import-stat"><span class="import-stat-n" style="color:var(--teal)">${reading}</span><span>Reading</span></div>
            <div class="import-stat"><span class="import-stat-n" style="color:var(--coral)">${dupes}</span><span>Duplicates</span></div>
          </div>
          ${dupes > 0 ? `<div style="font-size:0.75rem;color:var(--text3);margin-top:0.5rem">⚠️ ${dupes} duplicate(s) will be skipped</div>` : ''}
        `;
        dropArea.style.display = 'none';
        preview.style.display  = 'block';
        resultDiv.style.display = 'none';
        confirmBtn.textContent = `⬆ Import ${newBooks.length} Books`;
        confirmBtn._newBooks = newBooks;
      } catch(err) {
        showResult('❌ Invalid JSON file: ' + err.message, false);
      }
    };
    reader.readAsText(file);
  }

  confirmBtn.addEventListener('click', async () => {
    const toImport = confirmBtn._newBooks;
    if (!toImport || !toImport.length) {
      showResult('Nothing new to import.', false);
      return;
    }

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Importing…';

    let saved = 0;
    for (const book of toImport) {
      // Ensure required fields
      const b = {
        id:          book.id || ('import_' + Date.now() + '_' + Math.random().toString(36).slice(2,6)),
        title:       book.title || 'Untitled',
        author:      book.author || 'Unknown',
        category:    normCategory(book.category),
        totalPages:  parseInt(book.totalPages) || 200,
        currentPage: parseInt(book.currentPage) || (book.status === 'completed' ? parseInt(book.totalPages)||200 : 0),
        startDate:   book.startDate || null,
        endDate:     book.endDate   || null,
        status:      book.status === 'reading' ? 'reading' : 'completed',
        pageLogs:    book.pageLogs  || [],
        cover:       book.cover     || null,
      };
      books.push(b);
      await saveBook(b);
      saved++;
    }

    showResult(`✅ Successfully imported ${saved} books!`, true);
    updateGoalCard();
    confirmBtn.disabled = false;
  });

  function showResult(msg, success) {
    preview.style.display   = 'none';
    dropArea.style.display  = 'none';
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `<div style="font-size:1.5rem;margin-bottom:0.5rem">${success ? '🎉' : '⚠️'}</div>
      <div style="font-size:0.95rem;font-weight:700;color:${success ? 'var(--green)' : 'var(--coral)'}">${msg}</div>
      ${success ? '<div style="font-size:0.78rem;color:var(--text3);margin-top:0.5rem">Go to History to see all your books</div>' : ''}`;
    if (success) setTimeout(() => { overlay.classList.remove('open'); renderHistory(); }, 2200);
  }

  function normCategory(cat) {
    if (!cat) return 'Self Development';
    const c = cat.toLowerCase().trim();
    const map = {
      'self help': 'Self Development', 'selfhelp': 'Self Development',
      'self development': 'Self Development', 'finance': 'Finance',
      'trading': 'Trading', 'biography': 'Biography',
      'relationship': 'Relationship', 'mindset': 'Mindset', 'health': 'Health',
    };
    return map[c] || 'Self Development';
  }
}

// setupImport is called directly inside initApp

// ================================
//  CALENDAR
// ================================
function renderCalendar() {
  const todayStr_ = todayStr();
  const grid    = document.getElementById('cal-grid');
  const label   = document.getElementById('cal-month-label');
  const summary = document.getElementById('cal-summary');
  if (!grid || !label) return;

  const readDates = new Set();
  books.forEach(b => (b.pageLogs||[]).forEach(l => { if (l.page > 0) readDates.add(l.date); }));

  const sortedDates = [...readDates].sort();
  let maxStreak = 0, curRun = 0;
  for (let i = 0; i < sortedDates.length; i++) {
    const diff = i === 0 ? 1 : (new Date(sortedDates[i]) - new Date(sortedDates[i-1])) / 86400000;
    curRun = diff === 1 ? curRun + 1 : 1;
    maxStreak = Math.max(maxStreak, curRun);
  }
  const streakSet = new Set();
  const lastDate = sortedDates[sortedDates.length-1];
  if (lastDate && (new Date(todayStr_) - new Date(lastDate)) / 86400000 <= 1) {
    let i = sortedDates.length - 1;
    streakSet.add(sortedDates[i]);
    while (i > 0 && (new Date(sortedDates[i]) - new Date(sortedDates[i-1])) / 86400000 === 1) {
      i--; streakSet.add(sortedDates[i]);
    }
  }

  function draw() {
    const firstDay = new Date(calYear, calMonth, 1);
    const lastDay  = new Date(calYear, calMonth + 1, 0);
    label.textContent = firstDay.toLocaleString('en', { month: 'long', year: 'numeric' });

    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    let html = '<div class="cal-weekdays">' + dayNames.map(d => `<div class="cal-wd">${d}</div>`).join('') + '</div>';
    html += '<div class="cal-days">';
    for (let i = 0; i < firstDay.getDay(); i++) html += '<div class="cal-day cal-empty"></div>';

    let monthReadCount = 0;
    const monthPrefix = calYear + '-' + String(calMonth+1).padStart(2,'0');

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = monthPrefix + '-' + String(d).padStart(2,'0');
      const isToday  = dateStr === todayStr_;
      const isRead   = readDates.has(dateStr);
      const isStreak = streakSet.has(dateStr);
      if (isRead) monthReadCount++;

      let pagesRead = 0;
      books.forEach(b => {
        const log = (b.pageLogs||[]).find(l => l.date === dateStr);
        if (!log) return;
        const prev = (b.pageLogs||[]).filter(l => l.date < dateStr).sort((a,z) => a.date.localeCompare(z.date));
        const prevPage = prev.length ? prev[prev.length-1].page : 0;
        pagesRead += Math.max(0, log.page - prevPage);
      });

      let cls = 'cal-day';
      if (isRead)   cls += ' cal-read';
      if (isStreak) cls += ' cal-streak';
      if (isToday)  cls += ' cal-today';

      const tick  = isRead   ? '<div class="cal-tick">&#10003;</div>' : '';
      const pages = pagesRead > 0 ? `<div class="cal-pages">${pagesRead}p</div>` : '';
      html += `<div class="${cls}" title="${pagesRead > 0 ? pagesRead+' pages' : ''}">
        <div class="cal-day-num">${d}</div>${tick}${pages}
      </div>`;
    }
    html += '</div>';
    grid.innerHTML = html;

    const monthDone = books.filter(b => b.status === 'completed' && (b.endDate||'').startsWith(monthPrefix)).length;
    let totalPages = 0;
    books.forEach(b => {
      const logs = (b.pageLogs||[]).filter(l => l.date.startsWith(monthPrefix)).sort((a,z)=>a.date.localeCompare(z.date));
      if (!logs.length) return;
      const before = (b.pageLogs||[]).filter(l => l.date < monthPrefix+'-01').sort((a,z)=>a.date.localeCompare(z.date));
      const startPage = before.length ? before[before.length-1].page : 0;
      totalPages += Math.max(0, logs[logs.length-1].page - startPage);
    });
    if (summary) summary.innerHTML = `
      <div class="cal-stat"><span class="cal-stat-n">${monthReadCount}</span><span>Days Read</span></div>
      <div class="cal-stat"><span class="cal-stat-n">${totalPages}</span><span>Pages</span></div>
      <div class="cal-stat"><span class="cal-stat-n">${monthDone}</span><span>Books Done</span></div>
      <div class="cal-stat"><span class="cal-stat-n">${maxStreak}d</span><span>Best Streak</span></div>`;
  }

  draw();
  const prev = document.getElementById('cal-prev');
  const next = document.getElementById('cal-next');
  prev.onclick = () => { calMonth--; if (calMonth < 0) { calMonth=11; calYear--; } draw(); };
  next.onclick = () => { calMonth++; if (calMonth > 11) { calMonth=0; calYear++; } draw(); };
}

// ================================
//  CATEGORY CHART
// ================================
function renderCategoryChart() {
  const container = document.getElementById('category-chart');
  if (!container) return;
  const cats = {};
  books.filter(b => b.status === 'completed').forEach(b => {
    cats[b.category || 'Other'] = (cats[b.category || 'Other'] || 0) + 1;
  });
  const entries = Object.entries(cats).sort((a,b) => b[1]-a[1]);
  if (!entries.length) {
    container.innerHTML = '<div style="color:var(--text3);text-align:center;padding:1.5rem;font-size:0.85rem;">No completed books yet</div>';
    return;
  }
  const total = entries.reduce((s,[,v]) => s+v, 0);
  const catColors = { 'Self Development':'#34d399','Biography':'#a78bfa','Trading':'#fbbf24','Relationship':'#fb7185','Mindset':'#38bdf8','Finance':'#34d399','Health':'#fb7185' };
  container.innerHTML = entries.map(([cat, count]) => {
    const pct = Math.round((count/total)*100);
    const color = catColors[cat] || '#38bdf8';
    return `<div class="cat-chart-row">
      <div class="cat-chart-label">${esc(cat)}</div>
      <div class="cat-chart-track"><div class="cat-chart-fill" style="width:${pct}%;background:${color}"></div></div>
      <div class="cat-chart-val" style="color:${color}">${count}</div>
    </div>`;
  }).join('');
}

// ================================
//  READING PACE CHART
// ================================
function renderPaceChart() {
  const container = document.getElementById('pace-chart');
  if (!container) return;
  const done = books.filter(b => b.status==='completed' && b.totalPages>0 && b.startDate && b.endDate)
    .sort((a,b) => (a.endDate||'').localeCompare(b.endDate||'')).slice(-10);
  if (!done.length) {
    container.innerHTML = '<div style="color:var(--text3);text-align:center;padding:1.5rem;font-size:0.85rem;">No data yet</div>';
    return;
  }
  const paces = done.map(b => ({ title: b.title, pace: Math.round(b.totalPages / Math.max(1, daysBetween(b.startDate, b.endDate))) }));
  const maxPace = Math.max(...paces.map(p => p.pace), 1);
  container.innerHTML = `<div class="chart-bars" style="height:130px">${paces.map(p => {
    const h = Math.round((p.pace/maxPace)*110);
    const short = p.title.length > 10 ? p.title.slice(0,9)+'…' : p.title;
    return `<div class="chart-col" style="min-width:52px">
      <div class="chart-val">${p.pace}</div>
      <div class="chart-bar" style="height:${h}px;background:linear-gradient(180deg,var(--purple),var(--teal-dim))" title="${esc(p.title)}: ${p.pace} pg/day"></div>
      <div class="chart-month" style="max-width:52px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(p.title)}">${esc(short)}</div>
    </div>`;
  }).join('')}</div>`;
}
