/* ============================================
   বাকি খাতা — Full Production App (A+B+C+D)
   ============================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  reload
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  getDoc,
  setDoc,
  getDocs,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ============================================
   🔥 আপনার Firebase কনফিগ এখানে বসান
   ============================================ */
const firebaseConfig = {
   apiKey: "AIzaSyATvjyLBowmyyak2nzBUxXL8271bEqt44c",
  authDomain: "bakihisab-4fe8a.firebaseapp.com",
  projectId: "bakihisab-4fe8a",
  storageBucket: "bakihisab-4fe8a.firebasestorage.app",
  messagingSenderId: "814241968042",
  appId: "1:814241968042:web:464f2ed31dfe9ce85d05d3",
  measurementId: "G-7CRWC58DVX"

};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ============================================
   গ্লোবাল স্টেট
   ============================================ */
let currentUser = null;
let currentShopName = '';
let currentUserRole = 'user'; // 'admin' | 'user'
let customers = [];
let products = [];
let allUsers = [];
let reportData = [];
let unsubscribeCustomers = null;
let unsubscribeProducts = null;
let unsubscribeAllUsers = null;
let currentCustomerId = null;
let stripePayments = null;
let adminGrowthChart = null;

const ADMIN_SECRET_KEY = 'Cellnetbd@Jamil1977'; // 🔑 এটা বদলান!

/* ============================================
   হেল্পার
   ============================================ */
const taka = n => '৳ ' + Number(n).toLocaleString('bn-BD');

const calcDue = c => (c.transactions || []).reduce(
  (s, t) => s + (t.type === 'due' ? t.amount : -t.amount), 0
);

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])
  );
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.className = 'toast', 2500);
}

function setSyncStatus(text, isError = false) {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  document.getElementById('syncText').textContent = text;
  el.classList.remove('hidden');
  el.classList.toggle('error', isError);
  clearTimeout(el._timer);
  if (!isError) el._timer = setTimeout(() => el.classList.add('hidden'), 2000);
}

function getAuthError(code) {
  const map = {
    'auth/email-already-in-use': 'এই ইমেইল দিয়ে অ্যাকাউন্ট আছে',
    'auth/invalid-email': 'ইমেইল সঠিক নয়',
    'auth/weak-password': 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষর দিন',
    'auth/user-not-found': 'এই ইমেইলে কোনো অ্যাকাউন্ট নেই',
    'auth/wrong-password': 'পাসওয়ার্ড ভুল',
    'auth/invalid-credential': 'ইমেইল বা পাসওয়ার্ড ভুল',
    'auth/too-many-requests': 'অনেকবার চেষ্টা হয়েছে, একটু পরে করুন',
    'auth/email-not-verified': 'ইমেইল ভেরিফাই করুন'
  };
  return map[code] || 'সমস্যা হয়েছে, আবার চেষ্টা করুন';
}

/* ============================================
   লগইন / সাইনআপ / পাসওয়ার্ড রিসেট
   ============================================ */
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.add('hidden'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.authtab + 'Form').classList.remove('hidden');
  });
});

document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const msg = document.getElementById('loginMsg');
  const btn = document.getElementById('loginBtn');

  btn.disabled = true;
  btn.textContent = 'অপেক্ষা করুন...';
  msg.textContent = '';

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    msg.textContent = getAuthError(err.code);
    msg.className = 'auth-msg error';
  } finally {
    btn.disabled = false;
    btn.textContent = 'লগইন করুন';
  }
});

document.getElementById('signupForm').addEventListener('submit', async e => {
  e.preventDefault();
  const shop = document.getElementById('signupShop').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const adminKey = document.getElementById('signupAdminKey')?.value.trim() || '';
  const msg = document.getElementById('signupMsg');
  const btn = document.getElementById('signupBtn');

  btn.disabled = true;
  btn.textContent = 'অপেক্ষা করুন...';
  msg.textContent = '';

  const role = adminKey === ADMIN_SECRET_KEY ? 'admin' : 'user';
  if (adminKey && role !== 'admin') {
    msg.textContent = '❌ অ্যাডমিন কী ভুল';
    msg.className = 'auth-msg error';
    btn.disabled = false;
    btn.textContent = 'অ্যাকাউন্ট তৈরি করুন';
    return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: shop });

    // 🔥 A: ইমেইল ভেরিফিকেশন পাঠান
    try {
      await sendEmailVerification(cred.user, {
        url: window.location.origin + '/index.html',
        handleCodeInApp: false
      });
    } catch (evErr) {
      console.warn('Email verification error:', evErr);
    }

    await setDoc(doc(db, 'users', cred.user.uid), {
      shopName: shop,
      email: email,
      role: role,
      blocked: false,
      createdAt: new Date().toISOString()
    });

    msg.textContent = '✅ অ্যাকাউন্ট তৈরি হয়েছে! ভেরিফিকেশন ইমেইল পাঠানো হয়েছে।';
    msg.className = 'auth-msg success';
  } catch (err) {
    msg.textContent = getAuthError(err.code);
    msg.className = 'auth-msg error';
  } finally {
    btn.disabled = false;
    btn.textContent = 'অ্যাকাউন্ট তৈরি করুন';
  }
});

// 🔥 B: পাসওয়ার্ড রিসেট
document.getElementById('forgotPasswordLink').addEventListener('click', async e => {
  e.preventDefault();
  const email = prompt('📧 আপনার অ্যাকাউন্টের ইমেইল দিন:');
  if (!email) return;

  try {
    await sendPasswordResetEmail(auth, email.trim(), {
      url: window.location.origin + '/index.html'
    });
    alert('✅ পাসওয়ার্ড রিসেট লিংক ইমেইলে পাঠানো হয়েছে।\nইমেইল চেক করুন।');
  } catch (err) {
    alert('❌ সমস্যা: ' + getAuthError(err.code));
  }
});

// লগআউট
document.getElementById('logoutBtn').addEventListener('click', async () => {
  if (!confirm('লগআউট করবেন?')) return;
  if (unsubscribeCustomers) unsubscribeCustomers();
  if (unsubscribeProducts) unsubscribeProducts();
  if (unsubscribeAllUsers) unsubscribeAllUsers();
  await signOut(auth);
});

/* ============================================
   Auth স্টেট
   ============================================ */
onAuthStateChanged(auth, async user => {
  if (user) {
    currentUser = user;

    // 🔥 A: ইমেইল ভেরিফিকেশন চেক
    try {
      await reload(user);
      if (!user.emailVerified) {
        const shouldCheck = confirm(
          '📧 আপনার ইমেইল এখনো ভেরিফাই হয়নি।\n\n' +
          'ভেরিফিকেশন লিংক ইমেইলে পাঠানো হয়েছে।\n\n' +
          'OK চাপলে আবার চেক করব।'
        );
        if (shouldCheck) {
          await reload(user);
          if (!user.emailVerified) {
            alert('❌ এখনো ভেরিফাই হয়নি। ইমেইল চেক করুন।');
            await signOut(auth);
            return;
          } else {
            alert('✅ ইমেইল ভেরিফাই হয়েছে!');
          }
        }
      }
    } catch (err) {
      console.warn('Email check failed:', err);
    }

    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();

        if (data.blocked) {
          await signOut(auth);
          alert('⛔ আপনার অ্যাকাউন্ট ব্লক করা হয়েছে। অ্যাডমিনের সাথে যোগাযোগ করুন।');
          return;
        }

        currentShopName = data.shopName || 'আমার দোকান';
        currentUserRole = data.role || 'user';
      } else {
        currentShopName = user.displayName || 'আমার দোকান';
        currentUserRole = 'user';
        await setDoc(doc(db, 'users', user.uid), {
          shopName: currentShopName,
          email: user.email,
          role: 'user',
          blocked: false,
          createdAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error(err);
      currentShopName = user.displayName || 'আমার দোকান';
      currentUserRole = 'user';
    }

    document.getElementById('shopName').textContent = currentShopName;
    applyRoleUI();

    loadCustomersRealtime();
    loadProductsRealtime();
    checkBackupReminder();

    if (currentUserRole === 'admin') {
      loadAllUsersRealtime();
    }
  } else {
    currentUser = null;
    currentUserRole = 'user';
    customers = [];
    products = [];
    allUsers = [];
    if (unsubscribeCustomers) unsubscribeCustomers();
    if (unsubscribeProducts) unsubscribeProducts();
    if (unsubscribeAllUsers) unsubscribeAllUsers();
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('authScreen').classList.remove('hidden');
  }
});

function applyRoleUI() {
  const roleBadge = document.getElementById('roleBadge');
  const adminTab = document.querySelector('.tab[data-tab="admin"]');

  if (currentUserRole === 'admin') {
    roleBadge.classList.remove('hidden');
    adminTab?.classList.remove('hidden');
  } else {
    roleBadge.classList.add('hidden');
    adminTab?.classList.add('hidden');
    if (document.getElementById('tab-admin').classList.contains('active')) {
      document.querySelector('.tab[data-tab="customers"]').click();
    }
  }
}

/* ============================================
   Firestore রিয়েল-টাইম লোড
   ============================================ */
function loadCustomersRealtime() {
  if (unsubscribeCustomers) unsubscribeCustomers();
  const q = query(collection(db, 'users', currentUser.uid, 'customers'));
  setSyncStatus('সিঙ্ক হচ্ছে...');

  unsubscribeCustomers = onSnapshot(q,
    snapshot => {
      customers = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        transactions: d.data().transactions || []
      }));
      render();
      setSyncStatus('✅ সিঙ্ক সম্পন্ন');
    },
    err => setSyncStatus('❌ সিঙ্ক ব্যর্থ: ' + err.message, true)
  );
}

function loadProductsRealtime() {
  if (unsubscribeProducts) unsubscribeProducts();
  const q = query(collection(db, 'users', currentUser.uid, 'products'));

  unsubscribeProducts = onSnapshot(q,
    snapshot => {
      products = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      renderProducts();
    },
    err => console.error(err)
  );
}

function loadAllUsersRealtime() {
  if (unsubscribeAllUsers) unsubscribeAllUsers();
  const q = query(collection(db, 'users'));

  unsubscribeAllUsers = onSnapshot(q,
    snapshot => {
      allUsers = snapshot.docs.map(d => ({ uid: d.id, ...d.data() }));
      renderAdminPanel();
    },
    err => {
      console.error('Admin load error:', err);
      showToast('❌ ইউজার লোড ব্যর্থ: ' + err.message, 'error');
    }
  );
}

/* ============================================
   গ্রাহক রেন্ডার
   ============================================ */
function render() {
  const search = (document.getElementById('searchBox')?.value || '').toLowerCase().trim();
  const container = document.getElementById('customers');
  const empty = document.getElementById('emptyState');
  if (!container) return;

  container.innerHTML = '';

  let totalDue = 0, todayCollected = 0;
  const today = new Date().toDateString();

  customers.forEach(c => {
    const due = calcDue(c);
    totalDue += due;
    (c.transactions || []).forEach(t => {
      if (t.type === 'payment' && new Date(t.date).toDateString() === today)
        todayCollected += t.amount;
    });

    if (search && !c.name.toLowerCase().includes(search)) return;

    const div = document.createElement('div');
    div.className = 'customer-card';
    div.innerHTML = `
      <div class="customer-info">
        <div class="customer-name">${escapeHtml(c.name)}</div>
        <div class="customer-phone">${c.phone ? '📞 ' + escapeHtml(c.phone) : ''}</div>
      </div>
      <div class="customer-actions">
        <span class="customer-due ${due > 0 ? 'has-due' : 'no-due'}">${taka(due)}</span>
        <button class="icon-btn edit-btn" title="সম্পাদন">✏️</button>
        <button class="icon-btn del-btn" title="মুছুন">🗑️</button>
      </div>
    `;
    div.addEventListener('click', e => {
      if (e.target.classList.contains('edit-btn')) return editCustomer(c.id);
      if (e.target.classList.contains('del-btn')) return deleteCustomer(c.id);
      openModal(c.id);
    });
    container.appendChild(div);
  });

  empty.classList.toggle('show', customers.length === 0);
  document.getElementById('totalDue').textContent = taka(totalDue);
  document.getElementById('todayCollected').textContent = taka(todayCollected);
  document.getElementById('totalCustomers').textContent = Number(customers.length).toLocaleString('bn-BD');

  if (document.getElementById('backupCustomerCount')) updateBackupStats();
  if (document.getElementById('tab-reports').classList.contains('active')) renderChart();
}

/* ============================================
   গ্রাহক CRUD
   ============================================ */
document.getElementById('customerForm').addEventListener('submit', async e => {
  e.preventDefault();
  const name = document.getElementById('customerName').value.trim();
  const phone = document.getElementById('customerPhone').value.trim();
  if (!name) return showToast('নাম লিখুন', 'error');

  try {
    await addDoc(collection(db, 'users', currentUser.uid, 'customers'), {
      name, phone,
      transactions: [],
      createdAt: new Date().toISOString()
    });
    e.target.reset();
    showToast('✅ গ্রাহক যোগ হয়েছে', 'success');
  } catch (err) {
    showToast('সমস্যা: ' + err.message, 'error');
  }
});

async function editCustomer(id) {
  const c = customers.find(x => x.id === id);
  if (!c) return;
  const name = prompt('নতুন নাম:', c.name);
  if (name === null) return;
  const phone = prompt('নতুন মোবাইল:', c.phone || '');

  try {
    await updateDoc(doc(db, 'users', currentUser.uid, 'customers', id), {
      name: name.trim() || c.name,
      phone: (phone || '').trim()
    });
    showToast('✏️ আপডেট হয়েছে', 'success');
  } catch (err) {
    showToast('সমস্যা: ' + err.message, 'error');
  }
}

async function deleteCustomer(id) {
  const c = customers.find(x => x.id === id);
  if (!c) return;
  const due = calcDue(c);
  const msg = due > 0 ? `${c.name}-এর ${taka(due)} বাকি আছে। তবুও মুছবেন?` : `${c.name}-কে মুছবেন?`;
  if (!confirm(msg)) return;

  try {
    await deleteDoc(doc(db, 'users', currentUser.uid, 'customers', id));
    showToast('🗑️ মুছে ফেলা হয়েছে');
  } catch (err) {
    showToast('সমস্যা: ' + err.message, 'error');
  }
}

/* ============================================
   মডাল
   ============================================ */
function openModal(id) {
  currentCustomerId = id;
  const c = customers.find(x => x.id === id);
  if (!c) return;

  document.getElementById('modalTitle').textContent = c.name;
  document.getElementById('modalDue').textContent = taka(calcDue(c));
  document.getElementById('txCustomerId').value = id;
  document.getElementById('txType').value = 'due';
  document.getElementById('txAmount').value = '';
  document.getElementById('txNote').value = '';
  document.getElementById('saleQty').value = '1';

  const saleSelect = document.getElementById('saleProduct');
  saleSelect.innerHTML = '<option value="">পণ্য নির্বাচন করুন...</option>' +
    products.filter(p => p.stock > 0).map(p =>
      `<option value="${p.id}">${escapeHtml(p.name)} — ৳${p.price} (স্টক: ${p.stock})</option>`
    ).join('');

  renderHistory(c);
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  currentCustomerId = null;
}

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modal').addEventListener('click', e => {
  if (e.target.id === 'modal') closeModal();
});

function renderHistory(c) {
  const hist = document.getElementById('history');
  hist.innerHTML = '';
  if (!c.transactions || !c.transactions.length) {
    hist.innerHTML = '<p style="color:#94a3b8;font-size:14px;text-align:center;padding:10px;">কোনো লেনদেন নেই</p>';
    return;
  }
  [...c.transactions].reverse().forEach(t => {
    const div = document.createElement('div');
    div.className = 'tx-item';
    div.innerHTML = `
      <div class="tx-item-info">
        <div class="tx-item-date">${new Date(t.date).toLocaleDateString('bn-BD')}</div>
        <div class="tx-item-note">${escapeHtml(t.note || '—')}</div>
      </div>
      <div class="tx-item-amount ${t.type === 'due' ? 'tx-due' : 'tx-pay'}">
        ${t.type === 'due' ? '+' : '−'}${taka(t.amount)}
      </div>
    `;
    hist.appendChild(div);
  });
}

/* ============================================
   লেনদেন সংরক্ষণ
   ============================================ */
document.getElementById('transactionForm').addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('txCustomerId').value;
  const type = document.getElementById('txType').value;
  const amount = Number(document.getElementById('txAmount').value);
  const note = document.getElementById('txNote').value.trim();

  if (!amount || amount <= 0) return showToast('সঠিক পরিমাণ দিন', 'error');

  const c = customers.find(x => x.id === id);
  if (!c) return;

  const newTx = {
    id: Date.now().toString(),
    type, amount, note,
    date: new Date().toISOString()
  };

  try {
    await updateDoc(doc(db, 'users', currentUser.uid, 'customers', id), {
      transactions: [...(c.transactions || []), newTx]
    });
    document.getElementById('txAmount').value = '';
    document.getElementById('txNote').value = '';
    showToast(type === 'due' ? '🔴 বাকি যোগ হয়েছে' : '🟢 আদায় রেকর্ড হয়েছে', 'success');
  } catch (err) {
    showToast('সমস্যা: ' + err.message, 'error');
  }
});

/* ============================================
   WhatsApp / SMS
   ============================================ */
document.getElementById('reminderBtn').addEventListener('click', () => {
  const c = customers.find(x => x.id === currentCustomerId);
  if (!c) return;
  const due = calcDue(c);
  if (due <= 0) return showToast('কোনো বাকি নেই', 'error');
  if (!c.phone) return showToast('ফোন নম্বর নেই', 'error');

  const msg = `প্রিয় ${c.name}, আপনার কাছে আমাদের ${taka(due)} বাকি আছে। অনুগ্রহ করে পরিশোধ করুন। ধন্যবাদ।\n— ${currentShopName}`;
  let phone = c.phone.replace(/\D/g, '');
  if (phone.startsWith('0')) phone = '880' + phone.slice(1);
  else if (!phone.startsWith('880') && phone.length === 10) phone = '880' + phone;

  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
});

document.getElementById('smsBtn').addEventListener('click', () => {
  const c = customers.find(x => x.id === currentCustomerId);
  if (!c) return;
  const due = calcDue(c);
  if (due <= 0) return showToast('কোনো বাকি নেই', 'error');
  if (!c.phone) return showToast('ফোন নম্বর নেই', 'error');

  const msg = `প্রিয় ${c.name}, আপনার কাছে ${taka(due)} বাকি আছে। — ${currentShopName}`;
  if (!confirm(`SMS পাঠানো হবে:\n\n${msg}\n\nনম্বর: ${c.phone}\n\nচালিয়ে যাবেন?`)) return;

  window.location.href = `sms:${c.phone}?body=${encodeURIComponent(msg)}`;
  showToast('📞 SMS অ্যাপ খোলা হয়েছে');
});

/* ============================================
   PDF ইনভয়েস
   ============================================ */
document.getElementById('invoiceBtn').addEventListener('click', () => {
  const c = customers.find(x => x.id === currentCustomerId);
  if (!c) return;

  const due = calcDue(c);
  const rows = [...(c.transactions || [])].reverse().map(t => `
    <tr>
      <td>${new Date(t.date).toLocaleDateString('bn-BD')}</td>
      <td>${t.type === 'due' ? 'বাকি' : 'আদায়'}</td>
      <td>${t.note ? escapeHtml(t.note) : '—'}</td>
      <td style="text-align:right; color:${t.type === 'due' ? '#c00' : '#060'};">
        ${t.type === 'due' ? '+' : '−'}${taka(t.amount)}
      </td>
    </tr>
  `).join('');

  const html = `
    <div class="invoice-print" id="invoicePrint">
      <div class="inv-header">
        <h1>${escapeHtml(currentShopName)}</h1>
        <p>বাকি হিসাব ও আদায় — গ্রাহক বিবরণী</p>
        <p>তারিখ: ${new Date().toLocaleDateString('bn-BD')}</p>
      </div>
      <div style="margin-bottom:16px;">
        <p><strong>গ্রাহকের নাম:</strong> ${escapeHtml(c.name)}</p>
        ${c.phone ? `<p><strong>মোবাইল:</strong> ${escapeHtml(c.phone)}</p>` : ''}
      </div>
      <table>
        <thead>
          <tr>
            <th>তারিখ</th><th>ধরন</th><th>বিবরণ</th>
            <th style="text-align:right;">পরিমাণ</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="4" style="text-align:center;">কোনো লেনদেন নেই</td></tr>'}</tbody>
      </table>
      <p class="inv-total">মোট বাকি: ${taka(due)}</p>
      <p style="margin-top:40px; text-align:center; font-size:12px;">
        এই বিবরণীটি ${escapeHtml(currentShopName)} থেকে স্বয়ংক্রিয়ভাবে তৈরি হয়েছে
      </p>
    </div>
  `;

  document.querySelectorAll('.invoice-print').forEach(el => el.remove());
  document.body.insertAdjacentHTML('beforeend', html);
  window.print();
});

/* ============================================
   থার্মাল প্রিন্টার
   ============================================ */
let btDevice = null;
let btCharacteristic = null;
let printerConnected = false;

document.getElementById('connectPrinter').addEventListener('click', async () => {
  if (!navigator.bluetooth) {
    return showToast('❌ এই ব্রাউজারে Bluetooth সাপোর্ট নেই', 'error');
  }
  try {
    showToast('🔍 প্রিন্টার খোঁজা হচ্ছে...');
    btDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
    });
    const server = await btDevice.gatt.connect();
    const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
    const chars = await service.getCharacteristics();
    btCharacteristic = chars.find(c => c.properties.write);
    if (!btCharacteristic) throw new Error('Write characteristic পাওয়া যায়নি');

    printerConnected = true;
    updatePrinterUI();
    showToast('✅ প্রিন্টার সংযুক্ত', 'success');

    btDevice.addEventListener('gattserverdisconnected', () => {
      printerConnected = false;
      updatePrinterUI();
      showToast('🔌 প্রিন্টার বিচ্ছিন্ন');
    });
  } catch (err) {
    showToast('❌ সংযোগ ব্যর্থ: ' + err.message, 'error');
  }
});

document.getElementById('disconnectPrinter').addEventListener('click', () => {
  if (btDevice?.gatt.connected) btDevice.gatt.disconnect();
  printerConnected = false;
  btCharacteristic = null;
  btDevice = null;
  updatePrinterUI();
});

document.getElementById('testPrint').addEventListener('click', () => {
  const lines = [
    '================================',
    '        বাকি খাতা টেস্ট       ',
    '================================',
    `তারিখ: ${new Date().toLocaleString('en-GB')}`,
    'প্রিন্টার ঠিকভাবে কাজ করছে',
    '',
    ''
  ];
  printLines(lines);
});

function updatePrinterUI() {
  const statusEl = document.getElementById('printerStatus');
  const statusText = document.getElementById('printerStatusText');
  const connectBtn = document.getElementById('connectPrinter');
  const disconnectBtn = document.getElementById('disconnectPrinter');
  const testBtn = document.getElementById('testPrint');

  if (printerConnected) {
    statusEl.classList.add('connected');
    statusText.textContent = '✅ ' + (btDevice?.name || 'প্রিন্টার সংযুক্ত');
    connectBtn.classList.add('hidden');
    disconnectBtn.classList.remove('hidden');
    testBtn.classList.remove('hidden');
  } else {
    statusEl.classList.remove('connected');
    statusText.textContent = 'প্রিন্টার সংযুক্ত নেই';
    connectBtn.classList.remove('hidden');
    disconnectBtn.classList.add('hidden');
    testBtn.classList.add('hidden');
  }
}

async function printLines(lines) {
  if (!btCharacteristic) return showToast('প্রিন্টার সংযুক্ত নয়', 'error');
  try {
    const reset = new Uint8Array([0x1b, 0x40]);
    await btCharacteristic.writeValue(reset);
    for (const line of lines) {
      const data = new TextEncoder().encode(line + '\n');
      await btCharacteristic.writeValue(data);
    }
    showToast('🖨️ প্রিন্ট পাঠানো হয়েছে', 'success');
  } catch (err) {
    showToast('❌ প্রিন্ট ব্যর্থ: ' + err.message, 'error');
  }
}

async function printReceipt(customerId) {
  const c = customers.find(x => x.id === customerId);
  if (!c) return;
  const due = calcDue(c);
  const lines = [
    '================================',
    '     ' + currentShopName,
    '================================',
    `Customer: ${c.name}`,
    c.phone ? `Phone: ${c.phone}` : '',
    `Date: ${new Date().toLocaleDateString('en-GB')}`,
    '--------------------------------',
    'Date   Type    Amount',
    '--------------------------------'
  ].filter(l => l);

  [...(c.transactions || [])].slice(-5).forEach(t => {
    const d = new Date(t.date).toLocaleDateString('en-GB').slice(0, 5);
    const type = t.type === 'due' ? 'DUE' : 'PAY';
    const amt = t.amount.toFixed(0).padStart(8);
    lines.push(`${d} ${type} ${amt}`);
  });

  lines.push('--------------------------------');
  lines.push(`TOTAL DUE: Tk ${due.toFixed(2)}`);
  lines.push('================================');
  lines.push('Thank you!');
  lines.push('');
  lines.push('');
  await printLines(lines);
}

document.getElementById('receiptBtn').addEventListener('click', () => {
  if (!printerConnected) return showToast('আগে প্রিন্টার সংযুক্ত করুন', 'error');
  printReceipt(currentCustomerId);
});

/* ============================================
   পণ্য থেকে বিক্রয়
   ============================================ */
document.getElementById('addSale').addEventListener('click', async () => {
  const productId = document.getElementById('saleProduct').value;
  const qty = Number(document.getElementById('saleQty').value);

  if (!productId) return showToast('পণ্য নির্বাচন করুন', 'error');
  if (!qty || qty <= 0) return showToast('সঠিক পরিমাণ দিন', 'error');

  const p = products.find(x => x.id === productId);
  if (!p || qty > p.stock) return showToast('স্টক যথেষ্ট নয়', 'error');

  const c = customers.find(x => x.id === currentCustomerId);
  if (!c) return;

  const total = p.price * qty;
  const newTx = {
    id: Date.now().toString(),
    type: 'due',
    amount: total,
    note: `${p.name} × ${qty}`,
    date: new Date().toISOString()
  };

  try {
    await updateDoc(doc(db, 'users', currentUser.uid, 'customers', currentCustomerId), {
      transactions: [...(c.transactions || []), newTx]
    });
    await updateDoc(doc(db, 'users', currentUser.uid, 'products', productId), {
      stock: p.stock - qty
    });
    showToast(`✅ ${p.name} × ${qty} বাকিতে যোগ হয়েছে`, 'success');
    document.getElementById('saleQty').value = '1';
    document.getElementById('saleProduct').value = '';
  } catch (err) {
    showToast('সমস্যা: ' + err.message, 'error');
  }
});

/* ============================================
   পণ্য / স্টক
   ============================================ */
function renderProducts() {
  const search = (document.getElementById('productSearch')?.value || '').toLowerCase().trim();
  const container = document.getElementById('products');
  const empty = document.getElementById('productEmpty');
  if (!container) return;

  container.innerHTML = '';
  let totalValue = 0, lowStock = 0;
  products.forEach(p => {
    totalValue += (p.price || 0) * (p.stock || 0);
    if ((p.stock || 0) < 5) lowStock++;
  });

  const filtered = products.filter(p =>
    !search || p.name.toLowerCase().includes(search) ||
    (p.barcode && p.barcode.includes(search))
  );

  filtered.forEach(p => {
    const stockClass = p.stock === 0 ? 'out' : p.stock < 5 ? 'low' : '';
    const div = document.createElement('div');
    div.className = 'product-card';
    div.innerHTML = `
      <div class="product-info">
        <div class="product-name">${escapeHtml(p.name)}</div>
        <div class="product-meta">
          ${p.barcode ? '🏷️ ' + escapeHtml(p.barcode) + ' · ' : ''}
          ৳ ${Number(p.price).toLocaleString('bn-BD')}
        </div>
      </div>
      <span class="product-stock ${stockClass}">স্টক: ${Number(p.stock).toLocaleString('bn-BD')}</span>
      <div class="product-actions">
        <button class="icon-btn sell-btn" title="বিক্রয়">💰</button>
        <button class="icon-btn restock-btn" title="রিস্টক">📥</button>
        <button class="icon-btn edit-p-btn" title="সম্পাদন">✏️</button>
        <button class="icon-btn del-p-btn" title="মুছুন">🗑️</button>
      </div>
    `;
    div.addEventListener('click', e => {
      if (e.target.classList.contains('sell-btn')) return sellProduct(p.id);
      if (e.target.classList.contains('restock-btn')) return restockProduct(p.id);
      if (e.target.classList.contains('edit-p-btn')) return editProduct(p.id);
      if (e.target.classList.contains('del-p-btn')) return deleteProduct(p.id);
    });
    container.appendChild(div);
  });

  empty.classList.toggle('show', products.length === 0);
  document.getElementById('totalProducts').textContent = Number(products.length).toLocaleString('bn-BD');
  document.getElementById('totalStockValue').textContent = taka(totalValue);
  document.getElementById('lowStockCount').textContent = Number(lowStock).toLocaleString('bn-BD');
}

document.getElementById('productForm').addEventListener('submit', async e => {
  e.preventDefault();
  const name = document.getElementById('prodName').value.trim();
  const barcode = document.getElementById('prodBarcode').value.trim();
  const price = Number(document.getElementById('prodPrice').value);
  const stock = Number(document.getElementById('prodStock').value);

  if (!name) return showToast('নাম লিখুন', 'error');

  try {
    await addDoc(collection(db, 'users', currentUser.uid, 'products'), {
      name, barcode, price, stock,
      createdAt: new Date().toISOString()
    });
    e.target.reset();
    showToast('✅ পণ্য যোগ হয়েছে', 'success');
  } catch (err) {
    showToast('সমস্যা: ' + err.message, 'error');
  }
});

async function sellProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  if (p.stock <= 0) return showToast('স্টক নেই', 'error');
  const qty = Number(prompt(`কত ${p.name} বিক্রি হয়েছে?`, '1'));
  if (!qty || qty <= 0) return;
  if (qty > p.stock) return showToast('স্টকের বেশি নয়', 'error');

  try {
    await updateDoc(doc(db, 'users', currentUser.uid, 'products', id), {
      stock: p.stock - qty
    });
    showToast(`💰 ${qty} ${p.name} বিক্রি হয়েছে`, 'success');
  } catch (err) {
    showToast('সমস্যা: ' + err.message, 'error');
  }
}

async function restockProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const qty = Number(prompt(`কত ${p.name} স্টকে যোগ করবেন?`, '10'));
  if (!qty || qty <= 0) return;

  try {
    await updateDoc(doc(db, 'users', currentUser.uid, 'products', id), {
      stock: (p.stock || 0) + qty
    });
    showToast(`📥 ${qty} যোগ হয়েছে`, 'success');
  } catch (err) {
    showToast('সমস্যা: ' + err.message, 'error');
  }
}

async function editProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const name = prompt('পণ্যের নাম:', p.name);
  if (name === null) return;
  const price = Number(prompt('বিক্রয় মূল্য:', p.price));
  const barcode = prompt('বারকোড:', p.barcode || '');

  try {
    await updateDoc(doc(db, 'users', currentUser.uid, 'products', id), {
      name: name.trim() || p.name,
      price: isNaN(price) ? p.price : price,
      barcode: (barcode || '').trim()
    });
    showToast('✏️ আপডেট হয়েছে', 'success');
  } catch (err) {
    showToast('সমস্যা: ' + err.message, 'error');
  }
}

async function deleteProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  if (!confirm(`${p.name} মুছবেন?`)) return;
  try {
    await deleteDoc(doc(db, 'users', currentUser.uid, 'products', id));
    showToast('🗑️ মুছে ফেলা হয়েছে');
  } catch (err) {
    showToast('সমস্যা: ' + err.message, 'error');
  }
}

document.getElementById('productSearch').addEventListener('input', renderProducts);

/* ============================================
   স্ক্যানার
   ============================================ */
let html5QrCode = null;

document.getElementById('startScan').addEventListener('click', async () => {
  const container = document.getElementById('scannerContainer');
  container.classList.remove('hidden');
  document.getElementById('startScan').classList.add('hidden');
  document.getElementById('stopScan').classList.remove('hidden');

  if (!html5QrCode) html5QrCode = new Html5Qrcode("scannerContainer");

  try {
    await html5QrCode.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (text, result) => handleScanSuccess(text, result),
      () => {}
    );
  } catch (err) {
    showToast('❌ ক্যামেরা চালু হয়নি: ' + err.message, 'error');
    container.classList.add('hidden');
    document.getElementById('startScan').classList.remove('hidden');
    document.getElementById('stopScan').classList.add('hidden');
  }
});

document.getElementById('stopScan').addEventListener('click', async () => {
  if (html5QrCode) {
    await html5QrCode.stop();
    html5QrCode.clear();
  }
  document.getElementById('scannerContainer').classList.add('hidden');
  document.getElementById('startScan').classList.remove('hidden');
  document.getElementById('stopScan').classList.add('hidden');
});

function handleScanSuccess(text, result) {
  document.getElementById('scanResult').classList.remove('hidden');
  document.getElementById('scanCode').textContent = text;
  document.getElementById('scanType').textContent = result.result.format.formatName;
  if (navigator.vibrate) navigator.vibrate(200);

  const p = products.find(x => x.barcode === text);
  if (p) showToast(`✅ ${p.name} পাওয়া গেছে`, 'success');
  else showToast('📦 এই কোডে কোনো পণ্য নেই');
}

/* ============================================
   ট্যাব সুইচ
   ============================================ */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');

    if (tab.dataset.tab === 'reports') renderChart();
    if (tab.dataset.tab === 'admin' && currentUserRole === 'admin') {
      renderAdminPanel();
    }
    if (tab.dataset.tab === 'subscription') {
      renderSubscriptionTab();
    }
  });
});

/* ============================================
   চার্ট (রিপোর্ট)
   ============================================ */
let myChart = null;
let currentChartType = 'monthly';
const bnMonths = ['জানু', 'ফেব', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্ট', 'অক্টো', 'নভে', 'ডিসে'];

function renderChart() {
  const ctx = document.getElementById('myChart');
  if (!ctx || !window.Chart) return;

  let labels = [], dueData = [], payData = [];

  if (currentChartType === 'monthly') {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() });
    }
    labels = months.map(m => bnMonths[m.month] + ' ' + String(m.year).slice(2));

    months.forEach(m => {
      let due = 0, pay = 0;
      customers.forEach(c => {
        (c.transactions || []).forEach(t => {
          const d = new Date(t.date);
          if (d.getFullYear() === m.year && d.getMonth() === m.month) {
            if (t.type === 'due') due += t.amount;
            else pay += t.amount;
          }
        });
      });
      dueData.push(due);
      payData.push(pay);
    });
  } else if (currentChartType === 'daily') {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d);
    }
    labels = days.map(d => d.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' }));

    days.forEach(day => {
      const dayStr = day.toDateString();
      let due = 0, pay = 0;
      customers.forEach(c => {
        (c.transactions || []).forEach(t => {
          if (new Date(t.date).toDateString() === dayStr) {
            if (t.type === 'due') due += t.amount;
            else pay += t.amount;
          }
        });
      });
      dueData.push(due);
      payData.push(pay);
    });
  } else {
    const sorted = [...customers]
      .map(c => ({ name: c.name, due: calcDue(c) }))
      .filter(x => x.due > 0)
      .sort((a, b) => b.due - a.due)
      .slice(0, 7);
    labels = sorted.map(x => x.name.length > 12 ? x.name.slice(0, 12) + '…' : x.name);
    dueData = sorted.map(x => x.due);
    payData = [];
  }

  if (myChart) myChart.destroy();

  const datasets = [{
    label: 'বাকি', data: dueData,
    backgroundColor: 'rgba(239, 68, 68, 0.7)',
    borderColor: '#ef4444', borderWidth: 2, borderRadius: 6
  }];

  if (currentChartType !== 'top') {
    datasets.push({
      label: 'আদায়', data: payData,
      backgroundColor: 'rgba(16, 185, 129, 0.7)',
      borderColor: '#10b981', borderWidth: 2, borderRadius: 6
    });
  }

  const type = currentChartType === 'monthly' ? 'line' : 'bar';

  myChart = new Chart(ctx, {
    type,
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: c => `${c.dataset.label}: ৳ ${c.parsed.y.toLocaleString('bn-BD')}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: v => '৳ ' + v.toLocaleString('bn-BD') }
        }
      }
    }
  });
}

document.querySelectorAll('.chart-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentChartType = tab.dataset.chart;
    renderChart();
  });
});

/* ============================================
   রিপোর্ট
   ============================================ */
document.getElementById('filterReport').addEventListener('click', () => {
  const fromVal = document.getElementById('fromDate').value;
  const toVal = document.getElementById('toDate').value;
  const from = fromVal ? new Date(fromVal) : new Date(0);
  const to = toVal ? new Date(toVal + 'T23:59:59') : new Date();

  reportData = [];
  let totalDue = 0, totalPaid = 0;

  customers.forEach(c => {
    (c.transactions || []).forEach(t => {
      const d = new Date(t.date);
      if (d >= from && d <= to) {
        reportData.push({ customer: c.name, phone: c.phone, ...t });
        if (t.type === 'due') totalDue += t.amount;
        else totalPaid += t.amount;
      }
    });
  });

  reportData.sort((a, b) => new Date(b.date) - new Date(a.date));

  document.getElementById('reportSummary').innerHTML = `
    <div class="summary-item">মোট বাকি <strong class="tx-due">${taka(totalDue)}</strong></div>
    <div class="summary-item">মোট আদায় <strong class="tx-pay">${taka(totalPaid)}</strong></div>
    <div class="summary-item">লেনদেন <strong>${Number(reportData.length).toLocaleString('bn-BD')}</strong></div>
  `;

  const tbody = document.getElementById('reportBody');
  if (!reportData.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">কোনো লেনদেন নেই</td></tr>';
    return;
  }
  tbody.innerHTML = reportData.map(t => `
    <tr>
      <td>${new Date(t.date).toLocaleDateString('bn-BD')}</td>
      <td>${escapeHtml(t.customer)}</td>
      <td>${t.type === 'due' ? 'বাকি' : 'আদায়'}</td>
      <td class="${t.type === 'due' ? 'tx-due' : 'tx-pay'}">${taka(t.amount)}</td>
      <td>${escapeHtml(t.note || '—')}</td>
    </tr>
  `).join('');
});

document.getElementById('exportCSV').addEventListener('click', () => {
  if (!reportData.length) return showToast('আগে ফিল্টার করুন', 'error');
  const header = ['তারিখ', 'গ্রাহক', 'ফোন', 'ধরন', 'পরিমাণ', 'বিবরণ'];
  const rows = reportData.map(t => [
    new Date(t.date).toLocaleDateString('en-GB'),
    t.customer, t.phone || '',
    t.type === 'due' ? 'Due' : 'Payment',
    t.amount, t.note || ''
  ]);
  const csv = [header, ...rows]
    .map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `report_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  showToast('⬇️ ডাউনলোড হয়েছে', 'success');
});

/* ============================================
   ব্যাকআপ
   ============================================ */
function updateBackupStats() {
  const totalTx = customers.reduce((s, c) => s + (c.transactions?.length || 0), 0);
  document.getElementById('backupCustomerCount').textContent = Number(customers.length).toLocaleString('bn-BD');
  document.getElementById('backupTxCount').textContent = Number(totalTx).toLocaleString('bn-BD');
  const last = localStorage.getItem('lastBackup');
  document.getElementById('lastBackup').textContent = last
    ? new Date(last).toLocaleString('bn-BD')
    : 'কখনো হয়নি';
}

document.getElementById('downloadBackup').addEventListener('click', () => {
  if (!customers.length) return showToast('ব্যাকআপ করার মতো ডেটা নেই', 'error');
  const backup = {
    version: 2,
    exportedAt: new Date().toISOString(),
    shopName: currentShopName,
    customers,
    products
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `bakikhata_backup_${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  localStorage.setItem('lastBackup', new Date().toISOString());
  updateBackupStats();
  showToast('⬇️ ব্যাকআপ ডাউনলোড হয়েছে', 'success');
});

document.getElementById('downloadCSV').addEventListener('click', () => {
  if (!customers.length) return showToast('ডেটা নেই', 'error');
  const rows = [['গ্রাহক', 'ফোন', 'তারিখ', 'ধরন', 'পরিমাণ', 'বিবরণ']];
  customers.forEach(c => {
    (c.transactions || []).forEach(t => {
      rows.push([
        c.name, c.phone || '',
        new Date(t.date).toLocaleDateString('en-GB'),
        t.type === 'due' ? 'Due' : 'Payment',
        t.amount, t.note || ''
      ]);
    });
  });
  const csv = rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `bakikhata_all_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  showToast('📊 CSV ডাউনলোড হয়েছে', 'success');
});

document.getElementById('importFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  if (!confirm('⚠️ পুনরুদ্ধার করলে বর্তমান সব ডেটা মুছে যাবে। চালিয়ে যাবেন?')) {
    e.target.value = '';
    return;
  }
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.customers || !Array.isArray(data.customers)) throw new Error('সঠিক ব্যাকআপ ফাইল নয়');

    showToast('⏳ পুনরুদ্ধার চলছে...');

    const batch = writeBatch(db);

    const oldC = await getDocs(collection(db, 'users', currentUser.uid, 'customers'));
    oldC.forEach(d => batch.delete(d.ref));
    const oldP = await getDocs(collection(db, 'users', currentUser.uid, 'products'));
    oldP.forEach(d => batch.delete(d.ref));

    data.customers.forEach(c => {
      const ref = doc(collection(db, 'users', currentUser.uid, 'customers'));
      batch.set(ref, {
        name: c.name,
        phone: c.phone || '',
        transactions: c.transactions || [],
        createdAt: c.createdAt || new Date().toISOString()
      });
    });

    (data.products || []).forEach(p => {
      const ref = doc(collection(db, 'users', currentUser.uid, 'products'));
      batch.set(ref, {
        name: p.name,
        barcode: p.barcode || '',
        price: p.price || 0,
        stock: p.stock || 0,
        createdAt: p.createdAt || new Date().toISOString()
      });
    });

    await batch.commit();
    showToast('✅ পুনরুদ্ধার সম্পন্ন!', 'success');
  } catch (err) {
    showToast('❌ সমস্যা: ' + err.message, 'error');
  } finally {
    e.target.value = '';
  }
});

function checkBackupReminder() {
  const last = localStorage.getItem('lastBackup');
  const days = last ? (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24) : 999;
  if (days > 7) {
    setTimeout(() => showToast('💾 ৭ দিনের বেশি ব্যাকআপ নেননি!'), 3000);
  }
}

/* ============================================
   সার্চ
   ============================================ */
document.getElementById('searchBox').addEventListener('input', render);

/* ============================================
   অ্যাডমিন প্যানেল (C: চার্ট সহ)
   ============================================ */
async function renderAdminPanel() {
  if (currentUserRole !== 'admin') return;

  document.getElementById('adminTotalUsers').textContent =
    Number(allUsers.length).toLocaleString('bn-BD');

  let totalCustomers = 0, totalDue = 0, totalProducts = 0;
  const allCustomersList = [];

  for (const u of allUsers) {
    try {
      const [cSnap, pSnap] = await Promise.all([
        getDocs(collection(db, 'users', u.uid, 'customers')),
        getDocs(collection(db, 'users', u.uid, 'products'))
      ]);

      totalProducts += pSnap.size;

      cSnap.forEach(d => {
        const c = d.data();
        const due = (c.transactions || []).reduce(
          (s, t) => s + (t.type === 'due' ? t.amount : -t.amount), 0
        );
        totalCustomers++;
        totalDue += due;
        allCustomersList.push({
          shopName: u.shopName || u.email,
          customerName: c.name,
          phone: c.phone,
          due
        });
      });
    } catch (err) {
      console.warn('User data load error:', u.uid, err.message);
    }
  }

  document.getElementById('adminTotalCustomers').textContent =
    Number(totalCustomers).toLocaleString('bn-BD');
  document.getElementById('adminTotalDue').textContent = taka(totalDue);
  document.getElementById('adminTotalProducts').textContent =
    Number(totalProducts).toLocaleString('bn-BD');

  renderAdminUsers();

  const customersEl = document.getElementById('adminAllCustomers');
  if (!allCustomersList.length) {
    customersEl.innerHTML = '<p style="color:#94a3b8;font-size:14px;text-align:center;padding:20px;">কোনো গ্রাহক নেই</p>';
  } else {
    customersEl.innerHTML = allCustomersList
      .sort((a, b) => b.due - a.due)
      .map(c => `
        <div class="admin-customer-row">
          <div>
            <div class="admin-customer-shop">🏪 ${escapeHtml(c.shopName)}</div>
            <div class="admin-customer-name">${escapeHtml(c.customerName)}</div>
            ${c.phone ? `<small style="color:#94a3b8;">📞 ${escapeHtml(c.phone)}</small>` : ''}
          </div>
          <span class="admin-customer-due ${c.due > 0 ? 'has-due' : 'no-due'}">
            ${taka(c.due)}
          </span>
        </div>
      `).join('');
  }

  // 🔥 C: ইউজার গ্রোথ চার্ট
  renderAdminGrowthChart();
}

function renderAdminUsers() {
  const search = (document.getElementById('adminUserSearch')?.value || '').toLowerCase().trim();
  const container = document.getElementById('adminUsersList');
  const empty = document.getElementById('adminUsersEmpty');
  if (!container) return;

  container.innerHTML = '';

  const filtered = allUsers.filter(u =>
    !search ||
    (u.shopName || '').toLowerCase().includes(search) ||
    (u.email || '').toLowerCase().includes(search)
  );

  filtered.forEach(u => {
    const isAdmin = u.role === 'admin';
    const isBlocked = u.blocked;
    const isSelf = u.uid === currentUser.uid;

    const div = document.createElement('div');
    div.className = 'admin-user-card';
    div.innerHTML = `
      <div class="admin-user-info">
        <div class="admin-user-shop">
          🏪 ${escapeHtml(u.shopName || 'নাম নেই')}
          ${isAdmin ? '<span class="admin-user-badge badge-admin">👑 Admin</span>' : '<span class="admin-user-badge badge-user">User</span>'}
          ${isBlocked ? '<span class="admin-user-badge badge-blocked">⛔ Blocked</span>' : ''}
          ${isSelf ? '<span class="admin-user-badge" style="background:#e0e7ff;color:#4338ca;">আপনি</span>' : ''}
        </div>
        <div class="admin-user-email">📧 ${escapeHtml(u.email || '')}</div>
        <div class="admin-user-meta">
          যোগদান: ${u.createdAt ? new Date(u.createdAt).toLocaleDateString('bn-BD') : '—'}
        </div>
      </div>
      <div class="admin-user-actions">
        ${!isSelf ? `
          <button class="btn btn-sm ${isBlocked ? 'btn-success' : 'btn-danger'}" data-action="block" data-uid="${u.uid}">
            ${isBlocked ? '✅ আনব্লক' : '⛔ ব্লক'}
          </button>
          <button class="btn btn-sm ${isAdmin ? 'btn-primary' : 'btn-success'}" data-action="toggle-role" data-uid="${u.uid}">
            ${isAdmin ? '👤 User করুন' : '👑 Admin করুন'}
          </button>
          <button class="btn btn-sm btn-danger" data-action="delete" data-uid="${u.uid}">🗑️</button>
        ` : '<span style="font-size:12px;color:#94a3b8;">—</span>'}
      </div>
    `;

    div.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const uid = btn.dataset.uid;

      if (action === 'block') toggleBlockUser(uid);
      if (action === 'toggle-role') toggleUserRole(uid);
      if (action === 'delete') deleteUser(uid);
    });

    container.appendChild(div);
  });

  empty.classList.toggle('show', filtered.length === 0);
}

async function toggleBlockUser(uid) {
  const u = allUsers.find(x => x.uid === uid);
  if (!u) return;
  const newBlocked = !u.blocked;
  if (!confirm(`${u.shopName}-কে ${newBlocked ? 'ব্লক' : 'আনব্লক'} করবেন?`)) return;

  try {
    await updateDoc(doc(db, 'users', uid), { blocked: newBlocked });
    showToast(newBlocked ? '⛔ ব্লক করা হয়েছে' : '✅ আনব্লক করা হয়েছে', 'success');
  } catch (err) {
    showToast('সমস্যা: ' + err.message, 'error');
  }
}

async function toggleUserRole(uid) {
  const u = allUsers.find(x => x.uid === uid);
  if (!u) return;
  const newRole = u.role === 'admin' ? 'user' : 'admin';
  if (!confirm(`${u.shopName}-কে ${newRole === 'admin' ? 'অ্যাডমিন' : 'সাধারণ ইউজার'} বানাবেন?`)) return;

  try {
    await updateDoc(doc(db, 'users', uid), { role: newRole });
    showToast('✅ রোল আপডেট হয়েছে', 'success');
  } catch (err) {
    showToast('সমস্যা: ' + err.message, 'error');
  }
}

async function deleteUser(uid) {
  const u = allUsers.find(x => x.uid === uid);
  if (!u) return;
  if (!confirm(`⚠️ ${u.shopName}-এর সব ডেটা মুছে যাবে। নিশ্চিত?`)) return;

  try {
    const [cSnap, pSnap] = await Promise.all([
      getDocs(collection(db, 'users', uid, 'customers')),
      getDocs(collection(db, 'users', uid, 'products'))
    ]);
    const batch = writeBatch(db);
    cSnap.forEach(d => batch.delete(d.ref));
    pSnap.forEach(d => batch.delete(d.ref));
    batch.delete(doc(db, 'users', uid));
    await batch.commit();
    showToast('🗑️ ইউজার ডিলিট হয়েছে', 'success');
  } catch (err) {
    showToast('সমস্যা: ' + err.message, 'error');
  }
}

document.getElementById('adminUserSearch')?.addEventListener('input', renderAdminUsers);

// 🔥 C: ইউজার গ্রোথ চার্ট রেন্ডার
function renderAdminGrowthChart() {
  if (currentUserRole !== 'admin' || !window.Chart) return;
  const ctx = document.getElementById('adminGrowthChart');
  if (!ctx) return;

  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  }

  const labels = months.map(m => bnMonths[m.month] + ' ' + String(m.year).slice(2));
  const data = months.map(m =>
    allUsers.filter(u => {
      if (!u.createdAt) return false;
      const d = new Date(u.createdAt);
      return d.getFullYear() === m.year && d.getMonth() === m.month;
    }).length
  );

  if (adminGrowthChart) adminGrowthChart.destroy();
  adminGrowthChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'নতুন ইউজার',
        data,
        backgroundColor: 'rgba(79, 70, 229, 0.7)',
        borderColor: '#4f46e5',
        borderWidth: 2,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
    }
  });
}

// নতুন অ্যাডমিন তৈরি
document.getElementById('createAdminForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  if (currentUserRole !== 'admin') return showToast('শুধু অ্যাডমিন এটি করতে পারবে', 'error');

  const email = document.getElementById('newAdminEmail').value.trim();
  if (!email) return;

  const found = allUsers.find(u => (u.email || '').toLowerCase() === email.toLowerCase());
  if (!found) {
    showToast('❌ এই ইমেইলে কোনো অ্যাকাউন্ট নেই। আগে সাইনআপ করতে হবে।', 'error');
    return;
  }

  if (!confirm(`${found.shopName}-কে অ্যাডমিন বানাবেন?`)) return;

  try {
    await updateDoc(doc(db, 'users', found.uid), { role: 'admin' });
    showToast('✅ নতুন অ্যাডমিন তৈরি হয়েছে', 'success');
    e.target.reset();
  } catch (err) {
    showToast('সমস্যা: ' + err.message, 'error');
  }
});

/* ============================================
   D: Stripe সাবস্ক্রিপশন
   ============================================ */
async function initStripePayments() {
  try {
    const { getStripePayments } = await import(
      "https://cdn.jsdelivr.net/npm/@invertase/firestore-stripe-payments@0.0.8/+esm"
    );
    stripePayments = getStripePayments(app, {
      productsCollection: "products",
      customersCollection: "customers"
    });
    return true;
  } catch (err) {
    console.error('Stripe SDK লোড ব্যর্থ:', err);
    return false;
  }
}

async function renderSubscriptionTab() {
  const statusEl = document.getElementById('subscriptionStatus');
  const plansEl = document.getElementById('subscriptionPlans');
  if (!statusEl || !plansEl) return;

  if (!stripePayments) {
    const ok = await initStripePayments();
    if (!ok) {
      statusEl.innerHTML = '<p style="color:#ef4444;">❌ Stripe সেটআপ হয়নি। Firebase Extension ইনস্টল করুন।</p>';
      return;
    }
  }

  try {
    const {
      getProducts,
      createCheckoutSession,
      getCurrentUserSubscriptions
    } = await import("https://cdn.jsdelivr.net/npm/@invertase/firestore-stripe-payments@0.0.8/+esm");

    const subs = await getCurrentUserSubscriptions(stripePayments, {
      status: "active"
    });
    const activeSub = subs && subs.length > 0 ? subs[0] : null;

    if (activeSub) {
      const endDate = activeSub.current_period_end
        ? new Date(activeSub.current_period_end * 1000).toLocaleDateString('bn-BD')
        : '—';
      statusEl.innerHTML = `
        <div class="subscription-active">
          <span style="font-size:32px;">✅</span>
          <div>
            <strong>প্রো সাবস্ক্রিপশন সক্রিয়</strong>
            <p style="font-size:13px;color:#64748b;">পরবর্তী বিল: ${endDate}</p>
          </div>
        </div>`;
    } else {
      statusEl.innerHTML = `
        <div class="subscription-inactive">
          <span style="font-size:32px;">🔒</span>
          <div>
            <strong>ফ্রি প্ল্যান</strong>
            <p style="font-size:13px;color:#64748b;">প্রো ফিচার আনলক করতে সাবস্ক্রাইব করুন</p>
          </div>
        </div>`;
    }

    const products = await getProducts(stripePayments, {
      includePrices: true,
      activeOnly: true
    });

    if (!products.length) {
      plansEl.innerHTML = '<p style="color:#94a3b8;">Stripe-এ কোনো প্রোডাক্ট নেই। Stripe Dashboard-এ তৈরি করুন।</p>';
      return;
    }

    plansEl.innerHTML = products.map(p => `
      <div class="plan-card">
        <h3>${escapeHtml(p.name)}</h3>
        <p class="plan-price">৳ ${(p.prices[0].unit_amount / 100).toLocaleString('bn-BD')} / মাস</p>
        <p style="font-size:13px;color:#64748b;">${escapeHtml(p.description || '')}</p>
        <button class="btn btn-primary btn-block subscribe-btn" data-price="${p.prices[0].id}">
          সাবস্ক্রাইব করুন
        </button>
      </div>
    `).join('');

    document.querySelectorAll('.subscribe-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'অপেক্ষা করুন...';
        try {
          const session = await createCheckoutSession(stripePayments, {
            price: btn.dataset.price,
            success_url: window.location.origin + '/index.html',
            cancel_url: window.location.origin + '/index.html'
          });
          window.location.assign(session.url);
        } catch (err) {
          alert('❌ চেকআউট ব্যর্থ: ' + err.message);
          btn.disabled = false;
          btn.textContent = 'সাবস্ক্রাইব করুন';
        }
      });
    });
  } catch (err) {
    plansEl.innerHTML = `<p style="color:#ef4444;">❌ লোড ব্যর্থ: ${err.message}</p>`;
  }
}

/* ============================================
   PWA
   ============================================ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}