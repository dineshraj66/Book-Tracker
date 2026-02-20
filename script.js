import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD-2SCMUJsrkmmWo4IUmWpjPu5TC99C-ho",
  authDomain: "book-tracker-5bc5f.firebaseapp.com",
  projectId: "book-tracker-5bc5f",
  storageBucket: "book-tracker-5bc5f.firebasestorage.app",
  messagingSenderId: "689545850122",
  appId: "1:689545850122:web:f0d244bcf9a4c9e2c51ef3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const booksRef = collection(db, 'books');

let myBooks = [];
let myGoal = localStorage.getItem('readingGoal') || 10;

// Listen for Data
onSnapshot(query(booksRef, orderBy('startDate', 'desc')), (snapshot) => {
    myBooks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderLibrary();
    updateStats();
});

// Add Book
window.addBook = async function() {
    const title = document.getElementById('bookTitle').value;
    const author = document.getElementById('bookAuthor').value;
    const total = parseInt(document.getElementById('totalPages').value);
    if (title && total) {
        await addDoc(booksRef, {
            title, author, totalPages: total, pagesRead: 0,
            category: document.getElementById('bookCategory').value || 'General',
            startDate: new Date().toISOString(),
            completionDate: null
        });
        document.querySelectorAll('.input-section input').forEach(i => i.value = '');
    }
};

// Update Progress
window.updatePages = async function(id, val) {
    const pages = parseInt(val);
    const book = myBooks.find(b => b.id === id);
    if (pages >= 0 && pages <= book.totalPages) {
        const data = { pagesRead: pages };
        if (pages === book.totalPages) data.completionDate = new Date().toISOString();
        await updateDoc(doc(db, 'books', id), data);
        logActivity();
    }
};

// Render Logic
function renderLibrary() {
    const activeList = document.getElementById('activeList');
    const historyList = document.getElementById('historyList');
    activeList.innerHTML = ''; historyList.innerHTML = '';
    
    let completedCount = 0;
    myBooks.forEach(book => {
        const percent = Math.round((book.pagesRead / book.totalPages) * 100) || 0;
        if (percent >= 100) {
            completedCount++;
            historyList.innerHTML += `
                <div class="history-card">
                    <div><strong>${book.title}</strong></div>
                    <span class="days-tag">${calculateDays(book.startDate, book.completionDate)} days</span>
                </div>`;
        } else {
            activeList.innerHTML += `
                <div class="book-card">
                    <div class="card-header">
                        <strong>${book.title}</strong>
                        <span onclick="deleteBook('${book.id}')" style="color:#ccc;cursor:pointer">✕</span>
                    </div>
                    <div class="book-progress-bg"><div class="book-progress-fill" style="width:${percent}%"></div></div>
                    <div class="update-row">
                        <span>${percent}% done</span>
                        <input type="number" onchange="updatePages('${book.id}', this.value)" placeholder="Pg">
                    </div>
                </div>`;
        }
    });
    document.getElementById('yearCountHeader').innerText = completedCount;
    document.getElementById('progressBar').style.width = (completedCount / myGoal * 100) + "%";
}

// Global Helpers
window.deleteBook = async (id) => { if(confirm("Delete?")) await deleteDoc(doc(db, 'books', id)); };
window.showView = (v) => { 
    document.getElementById('libraryView').style.display = v === 'library' ? 'block' : 'none';
    document.getElementById('statsView').style.display = v === 'stats' ? 'block' : 'none';
};
window.setGoal = () => { let g = prompt("Goal?", myGoal); if(g) { myGoal = g; localStorage.setItem('readingGoal', g); renderLibrary(); } };

function calculateDays(s, e) { return Math.ceil((new Date(e) - new Date(s)) / (1000*60*60*24)) || 1; }

function logActivity() {
    let logs = JSON.parse(localStorage.getItem('activityLog')) || [];
    const today = new Date().toLocaleDateString();
    if (!logs.includes(today)) { logs.push(today); localStorage.setItem('activityLog', JSON.stringify(logs)); }
}

function updateStats() {
    // Basic streak calculation
    let logs = JSON.parse(localStorage.getItem('activityLog')) || [];
    document.getElementById('currentStreak').innerText = logs.length + " Days";
    
    // Monthly & Fastest logic would go here
    const completed = myBooks.filter(b => b.completionDate);
    if(completed.length > 0) {
        let fastest = completed.sort((a,b) => calculateDays(a.startDate, a.completionDate) - calculateDays(b.startDate, b.completionDate))[0];
        document.getElementById('fastestBook').innerText = fastest.title;
        document.getElementById('fastestDays').innerText = calculateDays(fastest.startDate, fastest.completionDate) + " days";
    }
}