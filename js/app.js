/* ===== APP.JS — Shared utilities, product catalog, cart, theme ===== */

// ── Product Catalog ────────────────────────────────────────────────────────
const DEFAULT_PRODUCTS = [
  {
    id: 1,
    name: "Cement Block 6 inch",
    category: "blocks",
    price: 45,
    unit: "Piece",
    stock: 5000,
    description: "Standard 6-inch hollow cement block ideal for load-bearing walls, boundary walls, and general construction. Excellent compressive strength and thermal insulation.",
    dimensions: "400 × 200 × 150 mm",
    weight: "12 kg",
    image: null,
    emoji: "🧱",
    featured: true
  },
  {
    id: 2,
    name: "Cement Block 8 inch",
    category: "blocks",
    price: 60,
    unit: "Piece",
    stock: 3500,
    description: "Heavy-duty 8-inch hollow cement block for thick walls, retaining walls, and high-rise construction. Superior strength and durability.",
    dimensions: "400 × 200 × 200 mm",
    weight: "16 kg",
    image: null,
    emoji: "🧱",
    featured: false
  },
  {
    id: 3,
    name: "Fly Ash Brick",
    category: "bricks",
    price: 10,
    unit: "Piece",
    stock: 20000,
    description: "Eco-friendly fly ash bricks made from industrial waste. Lightweight, high strength, and excellent thermal insulation. Perfect for green construction.",
    dimensions: "230 × 110 × 75 mm",
    weight: "2.8 kg",
    image: null,
    emoji: "🟫",
    featured: true
  },
  {
    id: 4,
    name: "Red Brick",
    category: "bricks",
    price: 12,
    unit: "Piece",
    stock: 15000,
    description: "Traditional fired clay red bricks known for strength and aesthetic appeal. Widely used for walls, facades, and decorative purposes.",
    dimensions: "230 × 110 × 70 mm",
    weight: "3.2 kg",
    image: null,
    emoji: "🟥",
    featured: true
  },
  {
    id: 5,
    name: "Paver Block",
    category: "pavers",
    price: 35,
    unit: "Piece",
    stock: 8000,
    description: "High-strength interlocking paver blocks for driveways, walkways, parking areas, and landscaping. Available in various shapes and colors.",
    dimensions: "200 × 100 × 60 mm",
    weight: "2.5 kg",
    image: null,
    emoji: "⬛",
    featured: false
  },
  {
    id: 6,
    name: "Kerb Stone",
    category: "pavers",
    price: 180,
    unit: "Piece",
    stock: 2000,
    description: "Precast concrete kerb stones for road edging, garden borders, and drainage channels. Precisely manufactured for consistent dimensions.",
    dimensions: "500 × 150 × 250 mm",
    weight: "24 kg",
    image: null,
    emoji: "🔲",
    featured: false
  },
  {
    id: 7,
    name: "AAC Block",
    category: "blocks",
    price: 55,
    unit: "Piece",
    stock: 4000,
    description: "Autoclaved Aerated Concrete blocks — ultra-lightweight, excellent insulation, and easy to cut. Ideal for modern energy-efficient construction.",
    dimensions: "600 × 200 × 100 mm",
    weight: "6 kg",
    image: null,
    emoji: "🟦",
    featured: true
  },
  {
    id: 8,
    name: "Sand Lime Brick",
    category: "bricks",
    price: 14,
    unit: "Piece",
    stock: 10000,
    description: "High-quality calcium silicate bricks with uniform shape and size. Low water absorption and good fire resistance. Suitable for residential and commercial buildings.",
    dimensions: "230 × 110 × 75 mm",
    weight: "3.5 kg",
    image: null,
    emoji: "🟨",
    featured: false
  }
];

// ── Google Sheets Integration ───────────────────────────────────────────────
// Credentials come from js/config.js (gitignored). Fallback to '' if missing.
const SHEETS_URL    = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.SHEETS_URL)    ? APP_CONFIG.SHEETS_URL    : '';
const SHEETS_SECRET = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.SHEETS_SECRET) ? APP_CONFIG.SHEETS_SECRET : '';

const _LOCAL_ONLY = new Set(['bm_admin_session', 'bm_cart', 'bm_last_order', 'bm_last_seen_orders', 'bm_theme', 'bm_employee_session']);

const Store = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
    if (SHEETS_URL && !_LOCAL_ONLY.has(key)) {
      fetch(SHEETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ key, value, secret: SHEETS_SECRET })
      }).catch(() => {});
    }
  },
  remove(key) {
    localStorage.removeItem(key);
    if (SHEETS_URL && !_LOCAL_ONLY.has(key)) {
      fetch(SHEETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ key, value: null, secret: SHEETS_SECRET })
      }).catch(() => {});
    }
  }
};

async function syncFromSheets() {
  if (!SHEETS_URL) return;
  const keys = ['bm_orders', 'bm_products', 'bm_settings', 'bm_admin_creds', 'bm_employees', 'bm_attendance', 'bm_expenses', 'bm_departments', 'bm_shifts', 'bm_shift_history', 'bm_leaves', 'bm_holidays', 'bm_weekly_off', 'bm_overtime', 'bm_advances', 'bm_payroll_runs'];
  try {
    await Promise.all(keys.map(async key => {
      const res  = await fetch(`${SHEETS_URL}?key=${encodeURIComponent(key)}&secret=${encodeURIComponent(SHEETS_SECRET)}`);
      const json = await res.json();
      if (json.data !== null && json.data !== undefined) {
        localStorage.setItem(key, JSON.stringify(json.data));
      }
    }));
  } catch (_) {
    console.warn('Sheets sync unavailable — using cached local data');
  }
}

// ── Products ───────────────────────────────────────────────────────────────
function getProducts() {
  return Store.get('bm_products', DEFAULT_PRODUCTS);
}

function saveProducts(products) {
  Store.set('bm_products', products);
}

function getProductById(id) {
  return getProducts().find(p => p.id === Number(id));
}

// ── Cart ───────────────────────────────────────────────────────────────────
function getCart() {
  return Store.get('bm_cart', []);
}

function saveCart(cart) {
  Store.set('bm_cart', cart);
  updateCartBadge();
}

function addToCart(productId, qty = 1) {
  const product = getProductById(productId);
  if (!product || product.stock === 0) return false;

  const cart = getCart();
  const existing = cart.find(i => i.id === product.id);

  if (existing) {
    const newQty = existing.qty + qty;
    if (newQty > product.stock) {
      showToast(`Only ${product.stock} units available`, 'warning');
      return false;
    }
    existing.qty = newQty;
  } else {
    if (qty > product.stock) {
      showToast(`Only ${product.stock} units available`, 'warning');
      return false;
    }
    cart.push({ id: product.id, qty });
  }

  saveCart(cart);
  showToast(`${product.name} added to cart!`, 'success');
  return true;
}

function removeFromCart(productId) {
  const cart = getCart().filter(i => i.id !== productId);
  saveCart(cart);
}

function updateCartQty(productId, qty) {
  const product = getProductById(productId);
  if (!product) return;

  if (qty <= 0) {
    removeFromCart(productId);
    return;
  }
  if (qty > product.stock) qty = product.stock;

  const cart = getCart();
  const item = cart.find(i => i.id === productId);
  if (item) item.qty = qty;
  saveCart(cart);
}

function getCartTotal() {
  return getCart().reduce((total, item) => {
    const product = getProductById(item.id);
    return total + (product ? product.price * item.qty : 0);
  }, 0);
}

function getCartCount() {
  return getCart().reduce((count, item) => count + item.qty, 0);
}

function clearCart() {
  saveCart([]);
}

function updateCartBadge() {
  const badges = document.querySelectorAll('.cart-badge');
  const count = getCartCount();
  badges.forEach(b => {
    b.textContent = count;
    b.style.display = count > 0 ? 'flex' : 'none';
  });
}

// ── Orders ─────────────────────────────────────────────────────────────────
function getOrders() {
  return Store.get('bm_orders', []);
}

function saveOrders(orders) {
  Store.set('bm_orders', orders);
}

function generateOrderId() {
  const orders = getOrders();
  const lastNum = orders.length > 0
    ? Math.max(...orders.map(o => parseInt(o.id.replace('BM', '')))) : 10000;
  return 'BM' + (lastNum + 1);
}

function createOrder(customerInfo, cartItems) {
  const orders = getOrders();
  const products = getProducts();

  const items = cartItems.map(item => {
    const product = products.find(p => p.id === item.id);
    return {
      productId: item.id,
      name: product ? product.name : 'Unknown',
      price: product ? product.price : 0,
      qty: item.qty,
      total: product ? product.price * item.qty : 0
    };
  });

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const _s = getSettings();
  const delivery = subtotal >= (_s.freeDeliveryAbove || 5000) ? 0 : (_s.deliveryCharge || 299);
  const labour = customerInfo.labour || 0;

  const order = {
    id: generateOrderId(),
    date: new Date().toISOString(),
    customer: customerInfo,
    items,
    subtotal,
    delivery,
    labour,
    total: subtotal + delivery + labour,
    status: 'Pending',
    paymentMethod: customerInfo.paymentMethod
  };

  orders.unshift(order);
  saveOrders(orders);

  // Reduce stock for each ordered item
  const updatedProducts = products.map(p => {
    const ordered = items.find(i => i.productId === p.id);
    if (ordered) return { ...p, stock: Math.max(0, p.stock - ordered.qty) };
    return p;
  });
  saveProducts(updatedProducts);

  return order;
}

// ── Toast Notifications ────────────────────────────────────────────────────
function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-msg">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
  `;

  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// ── Loading Spinner ────────────────────────────────────────────────────────
function showSpinner(text = 'Loading...') {
  let overlay = document.getElementById('spinner-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'spinner-overlay';
    overlay.className = 'spinner-overlay';
    overlay.innerHTML = `<div class="spinner"></div><div class="spinner-text">${text}</div>`;
    document.body.appendChild(overlay);
  }
  overlay.querySelector('.spinner-text').textContent = text;
  overlay.classList.add('active');
}

function hideSpinner() {
  const overlay = document.getElementById('spinner-overlay');
  if (overlay) overlay.classList.remove('active');
}

// ── Dark Mode ──────────────────────────────────────────────────────────────
function initTheme() {
  const saved = Store.get('bm_theme', 'light');
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeBtn(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  Store.set('bm_theme', next);
  updateThemeBtn(next);
}

function updateThemeBtn(theme) {
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    btn.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  });
}

// ── Navbar ─────────────────────────────────────────────────────────────────
function initNavbar() {
  updateCartBadge();

  const hamburger = document.querySelector('.hamburger');
  const navLinks = document.querySelector('.nav-links');

  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
        navLinks.classList.remove('open');
      }
    });
  }

  // Highlight active link
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === path || (path === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
}

// ── Format Currency ────────────────────────────────────────────────────────
function formatRupees(amount) {
  return '₹' + amount.toLocaleString('en-IN');
}

// ── Delivery Date Helper ───────────────────────────────────────────────────
function getEstimatedDelivery(days = 5) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Confirm Dialog ─────────────────────────────────────────────────────────
function confirmAction(message) {
  return window.confirm(message);
}

// ── Contact / Store Settings ───────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  storeName:    'BuildMate',
  tagline:      'Quality Cement Blocks & Bricks',
  logo:         null,
  phone1:       '+91 98765 43210',
  phone2:       '+91 87654 32109',
  email1:       'info@buildmate.in',
  email2:       'orders@buildmate.in',
  address:      '123 Builder\'s Road, Industrial Area',
  city:         'Chennai, Tamil Nadu 600001',
  hoursWeekday: 'Mon–Sat: 8:00 AM – 6:00 PM',
  hoursSunday:  'Sunday: 9:00 AM – 1:00 PM',
  whatsapp:     '917684026529',
  mapEmbed:     'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d248849.84916296526!2d80.09236!3d13.0471!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3a5265ea4f7d3361%3A0x6e61a70b6863d433!2sChennai%2C%20Tamil%20Nadu!5e0!3m2!1sen!2sin!4v1720000000000!5m2!1sen!2sin',
  deliveryCharge:    299,
  freeDeliveryAbove: 5000,
  labourCharge:      0,
  deliveryPerKm:     0,
  labourPerItem:     0,
  companyLat:        0,
  companyLng:        0
};

function getSettings() {
  const saved = Store.get('bm_settings', {});
  return Object.assign({}, DEFAULT_SETTINGS, saved);
}

function saveSettings(settings) {
  Store.set('bm_settings', settings);
}

// Inject contact details into the page from settings
function applyContactSettings() {
  const s = getSettings();

  const set = (id, html) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  };
  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  // Logo
  if (s.logo) {
    document.querySelectorAll('.brand-icon').forEach(el => {
      el.innerHTML = `<img src="${s.logo}" alt="${s.storeName}" style="width:100%;height:100%;object-fit:contain;border-radius:4px">`;
      el.style.fontSize = '0';
    });
  }

  set('contact-address',   `${s.address}<br>${s.city}`);
  set('contact-phones',    `${s.phone1}${s.phone2 ? '<br>' + s.phone2 : ''}`);
  set('contact-emails',    `${s.email1}${s.email2 ? '<br>' + s.email2 : ''}`);
  set('contact-hours',     `${s.hoursWeekday}${s.hoursSunday ? '<br>' + s.hoursSunday : ''}`);
  setText('footer-phone',  s.phone1);
  setText('footer-email',  s.email1);

  // WhatsApp button
  document.querySelectorAll('.whatsapp-btn').forEach(btn => {
    btn.href = `https://wa.me/${s.whatsapp}?text=Hi%20${encodeURIComponent(s.storeName)}!%20I%20need%20more%20info%20about%20your%20products.`;
  });

  // Map iframe
  const mapFrame = document.getElementById('contact-map');
  if (mapFrame && s.mapEmbed) mapFrame.src = s.mapEmbed;
}

// ── Init on DOMContentLoaded ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavbar();
  applyContactSettings();
});

// ── Employees ──────────────────────────────────────────────────────────────
function getEmployees() {
  return Store.get('bm_employees', []);
}

function saveEmployees(employees) {
  Store.set('bm_employees', employees);
}

// ── Departments ────────────────────────────────────────────────────────────
const DEFAULT_DEPARTMENTS = [
  'Production','Quality','Warehouse','Maintenance','Logistics',
  'Sales','Accounts','HR/Admin','Security','Management'
];

function getDepartments() {
  const stored = Store.get('bm_departments', null);
  if (stored) return stored;
  // Seed defaults on first use
  const defaults = DEFAULT_DEPARTMENTS.map((name, i) => ({
    id: 'DEPT' + String(i + 1).padStart(3, '0'),
    name,
    active: true
  }));
  Store.set('bm_departments', defaults);
  return defaults;
}

function saveDepartments(depts) {
  Store.set('bm_departments', depts);
}

function generateDeptId() {
  const depts = getDepartments();
  if (!depts.length) return 'DEPT001';
  const nums = depts.map(d => parseInt((d.id || '').replace(/\D/g, '')) || 0);
  return 'DEPT' + String(Math.max(...nums) + 1).padStart(3, '0');
}

// ── Shifts ─────────────────────────────────────────────────────────────────
const DEFAULT_SHIFTS = [
  { id:'SHIFT001', name:'General Shift',  startTime:'09:00', endTime:'18:00', breakMinutes:60, gracePeriodMinutes:15, overtimeThresholdMinutes:30, weeklyOffType:'fixed', fixedDays:['Sunday'],    rotationalNote:'', active:true },
  { id:'SHIFT002', name:'Morning Shift',  startTime:'06:00', endTime:'14:00', breakMinutes:30, gracePeriodMinutes:10, overtimeThresholdMinutes:30, weeklyOffType:'fixed', fixedDays:['Sunday'],    rotationalNote:'', active:true },
  { id:'SHIFT003', name:'Evening Shift',  startTime:'14:00', endTime:'22:00', breakMinutes:30, gracePeriodMinutes:10, overtimeThresholdMinutes:30, weeklyOffType:'fixed', fixedDays:['Sunday'],    rotationalNote:'', active:true },
  { id:'SHIFT004', name:'Night Shift',    startTime:'22:00', endTime:'06:00', breakMinutes:30, gracePeriodMinutes:10, overtimeThresholdMinutes:30, weeklyOffType:'fixed', fixedDays:['Sunday'],    rotationalNote:'', active:true },
];

function getShifts() {
  const stored = Store.get('bm_shifts', null);
  if (stored) return stored;
  Store.set('bm_shifts', DEFAULT_SHIFTS);
  return DEFAULT_SHIFTS;
}

function saveShifts(shifts) {
  Store.set('bm_shifts', shifts);
}

function generateShiftId() {
  const shifts = getShifts();
  if (!shifts.length) return 'SHIFT001';
  const nums = shifts.map(s => parseInt((s.id || '').replace(/\D/g, '')) || 0);
  return 'SHIFT' + String(Math.max(...nums) + 1).padStart(3, '0');
}

function getShiftHistory() {
  return Store.get('bm_shift_history', []);
}

function saveShiftHistory(history) {
  Store.set('bm_shift_history', history);
}

function logShiftChange(emp, oldShiftName, newShiftName, effectiveFrom, reason) {
  const history = getShiftHistory();
  history.unshift({
    id:           'SCH' + Date.now(),
    employeeId:   emp.id,
    employeeName: emp.name,
    oldShift:     oldShiftName || '—',
    newShift:     newShiftName,
    effectiveFrom,
    reason:       reason || '',
    changedAt:    new Date().toISOString()
  });
  saveShiftHistory(history);
}

function generateEmployeeId() {
  const employees = getEmployees();
  if (!employees.length) return 'EMP1001';
  const nums = employees.map(e => parseInt((e.id || '').replace(/\D/g, '')) || 0);
  return 'EMP' + (Math.max(...nums) + 1);
}

// ── Attendance ──────────────────────────────────────────────────────────────
function getAttendance() {
  return Store.get('bm_attendance', []);
}

function saveAttendance(records) {
  Store.set('bm_attendance', records);
}

function upsertAttendanceRecord(rec) {
  const all = getAttendance();
  const idx = all.findIndex(r => r.employeeId === rec.employeeId && r.date === rec.date);
  if (idx !== -1) { all[idx] = { ...all[idx], ...rec }; }
  else            { all.unshift(rec); }
  saveAttendance(all);
}

function getAttendanceRecord(empId, date) {
  return getAttendance().find(r => r.employeeId === empId && r.date === date) || null;
}

// Compute attendance status from punch record + shift definition
function computeAttendanceStatus(rec, shift) {
  if (!rec) return 'absent';
  if (rec.status) return rec.status;                        // admin-set override
  // Auto-detect holiday / weekly off from date
  if (rec.date) {
    if (isHoliday(rec.date))    return 'holiday';
    if (isWeeklyOff(rec.date))  return 'weekly-off';
  }
  if (!rec.punchIn) return 'absent';
  const grace = shift ? (shift.gracePeriodMinutes || 0) : 15;
  const shiftHours = shift ? shiftDurationHours(shift) : 8;
  const worked = rec.hoursWorked || 0;
  if (worked === 0 && rec.punchIn && !rec.punchOut) return 'present'; // still active
  if (worked >= shiftHours * 0.75) return 'present';
  if (worked >= shiftHours * 0.4)  return 'half-day';
  return 'present';
}

function shiftDurationHours(shift) {
  if (!shift || !shift.startTime || !shift.endTime) return 8;
  const [sh, sm] = shift.startTime.split(':').map(Number);
  const [eh, em] = shift.endTime.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  return (mins - (shift.breakMinutes || 0)) / 60;
}

function lateMinutes(punchIn, shift) {
  if (!punchIn || !shift || !shift.startTime) return 0;
  const grace = shift.gracePeriodMinutes || 0;
  const [sh, sm] = shift.startTime.split(':').map(Number);
  const p = new Date(punchIn);
  const pMins = p.getHours() * 60 + p.getMinutes();
  const shiftMins = sh * 60 + sm;
  const diff = pMins - shiftMins - grace;
  return diff > 0 ? diff : 0;
}

function earlyLeaveMinutes(punchOut, shift) {
  if (!punchOut || !shift || !shift.endTime) return 0;
  const [eh, em] = shift.endTime.split(':').map(Number);
  const p = new Date(punchOut);
  const pMins = p.getHours() * 60 + p.getMinutes();
  const endMins = eh * 60 + em;
  const diff = endMins - pMins;
  return diff > 0 ? diff : 0;
}

// ── Holidays & Weekly Off ──────────────────────────────────────────────────
function getHolidays() {
  return Store.get('bm_holidays', []);
}
function saveHolidays(h) {
  Store.set('bm_holidays', h);
}
function generateHolidayId() {
  const all = getHolidays();
  if (!all.length) return 'HOL001';
  const nums = all.map(h => parseInt((h.id || '').replace(/\D/g, '')) || 0);
  return 'HOL' + String(Math.max(...nums) + 1).padStart(3, '0');
}
function getWeeklyOffDays() {
  return Store.get('bm_weekly_off', [0]); // default: Sunday
}
function saveWeeklyOffDays(days) {
  Store.set('bm_weekly_off', days);
}
function isHoliday(dateStr) {
  return getHolidays().some(h => h.date === dateStr);
}
function getHolidayName(dateStr) {
  const h = getHolidays().find(h => h.date === dateStr);
  return h ? h.name : null;
}
function isWeeklyOff(dateStr) {
  const dow = new Date(dateStr + 'T00:00:00').getDay();
  return getWeeklyOffDays().includes(dow);
}

// ── Leaves ─────────────────────────────────────────────────────────────────
function getLeaves() {
  return Store.get('bm_leaves', []);
}

function saveLeaves(leaves) {
  Store.set('bm_leaves', leaves);
}

function generateLeaveId() {
  const leaves = getLeaves();
  if (!leaves.length) return 'LV0001';
  const nums = leaves.map(l => parseInt((l.id || '').replace(/\D/g, '')) || 0);
  return 'LV' + String(Math.max(...nums) + 1).padStart(4, '0');
}

function countLeaveDays(fromDate, toDate) {
  const f = new Date(fromDate + 'T00:00:00');
  const t = new Date(toDate   + 'T00:00:00');
  return Math.max(1, Math.round((t - f) / 86400000) + 1);
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getTodayRecord(employeeId) {
  return getAttendance().find(r => r.employeeId === employeeId && r.date === todayStr()) || null;
}

function getMonthAttendance(employeeId, year, month) {
  const prefix = year + '-' + String(month).padStart(2, '0');
  return getAttendance().filter(r => r.employeeId === employeeId && r.date.startsWith(prefix));
}

// ── Overtime ───────────────────────────────────────────────────────────────
function getOvertime() { return Store.get('bm_overtime', []); }
function saveOvertime(ot) { Store.set('bm_overtime', ot); }
function generateOTId() {
  const all = getOvertime();
  if (!all.length) return 'OT0001';
  const nums = all.map(o => parseInt((o.id||'').replace(/\D/g,''))||0);
  return 'OT' + String(Math.max(...nums)+1).padStart(4,'0');
}
function getMonthOT(empId, year, month) {
  const prefix = year + '-' + String(month).padStart(2,'0');
  return getOvertime().filter(o => o.employeeId === empId && (o.date||'').startsWith(prefix));
}

// ── Salary Calculation ─────────────────────────────────────────────────────
function calculateSalary(empId, year, month) {
  const emp = getEmployees().find(e => e.id === empId);
  if (!emp) return null;

  const daysInMonth = new Date(year, month, 0).getDate(); // month is 1-indexed
  const monthStr = year + '-' + String(month).padStart(2, '0');

  const attRecords = getAttendance().filter(r => r.employeeId === empId && r.date.startsWith(monthStr));
  const empLeaves  = getLeaves().filter(l =>
    l.employeeId === empId && l.status === 'approved' &&
    l.fromDate <= monthStr + '-31' && l.toDate >= monthStr + '-01'
  );

  let present = 0, halfDay = 0, absent = 0, holiday = 0, weeklyOff = 0;
  let paidLeave = 0, sickLeave = 0, unpaidLeave = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = monthStr + '-' + String(d).padStart(2, '0');
    const rec = attRecords.find(r => r.date === dateStr);
    let status;

    if (rec && rec.status) {
      status = rec.status;
    } else if (rec && rec.punchIn) {
      const worked = rec.hoursWorked || 0;
      status = worked >= 4 ? (worked >= 6 ? 'present' : 'half-day') : 'present';
    } else if (isHoliday(dateStr)) {
      status = 'holiday';
    } else if (isWeeklyOff(dateStr)) {
      status = 'weekly-off';
    } else {
      const onLeave = empLeaves.find(l => l.fromDate <= dateStr && l.toDate >= dateStr);
      if (onLeave) {
        status = onLeave.leaveType === 'unpaid-leave' ? 'unpaid-leave' :
                 onLeave.leaveType === 'sick-leave'   ? 'sick-leave'   : 'paid-leave';
      } else {
        status = 'absent';
      }
    }

    switch (status) {
      case 'present':      present++;      break;
      case 'on-duty':      present++;      break;
      case 'half-day':     halfDay++;      break;
      case 'absent':       absent++;       break;
      case 'holiday':      holiday++;      break;
      case 'weekly-off':   weeklyOff++;    break;
      case 'paid-leave':   paidLeave++;    break;
      case 'sick-leave':   sickLeave++;    break;
      case 'unpaid-leave': unpaidLeave++;  break;
    }
  }

  const totalWorkingDays = daysInMonth - weeklyOff - holiday;
  // Paid days = days actually eligible for pay
  const paidDays = present + (halfDay * 0.5) + paidLeave + sickLeave;

  let grossSalary = 0;
  let perDayRate  = 0;

  if (emp.salaryType === 'daily') {
    perDayRate   = parseFloat(emp.dailyWage) || 0;
    grossSalary  = Math.round(paidDays * perDayRate);
  } else {
    const rate   = parseFloat(emp.monthlySalary) || 0;
    perDayRate   = totalWorkingDays > 0 ? rate / totalWorkingDays : 0;
    const deduct = (absent + unpaidLeave) * perDayRate;
    grossSalary  = Math.max(0, Math.round(rate - deduct));
  }

  const otAmt       = getMonthOT(empId, year, month).reduce((s,o) => s + (o.amount||0), 0);
  const deductAmt   = getMonthAdvanceTotal(empId, year, month);
  return {
    empId, name: emp.name, department: emp.department || '',
    salaryType: emp.salaryType || 'monthly',
    dailyWage: parseFloat(emp.dailyWage) || 0,
    monthlySalary: parseFloat(emp.monthlySalary) || 0,
    perDayRate: Math.round(perDayRate * 100) / 100,
    daysInMonth, totalWorkingDays,
    present, halfDay, absent, holiday, weeklyOff,
    paidLeave, sickLeave, unpaidLeave,
    paidDays, grossSalary,
    otRecords: getMonthOT(empId, year, month),
    otAmount: otAmt,
    advanceDetails: getMonthAdvanceDetails(empId, year, month),
    advanceDeductAmount: deductAmt,
    netSalary: grossSalary + otAmt - deductAmt
  };
}

// ── Payroll Runs ──────────────────────────────────────────────────────────
function getPayrollRuns() { return Store.get('bm_payroll_runs', []); }
function savePayrollRuns(r) { Store.set('bm_payroll_runs', r); }
function generatePayrollId(year, month) { return 'PR' + year + String(month).padStart(2, '0'); }

// ── Advances & Deductions ─────────────────────────────────────────────────
function getAdvances() { return Store.get('bm_advances', []); }
function saveAdvances(a) { Store.set('bm_advances', a); }
function generateAdvanceId() {
  const all = getAdvances();
  if (!all.length) return 'ADV0001';
  const nums = all.map(a => parseInt((a.id||'').replace(/\D/g,''))||0);
  return 'ADV' + String(Math.max(...nums)+1).padStart(4,'0');
}
function getActiveAdvances(empId) {
  return getAdvances().filter(a => a.employeeId === empId && a.status === 'active');
}
function getMonthAdvanceTotal(empId, year, month) {
  const monthStr = year + '-' + String(month).padStart(2,'0');
  return getAdvances()
    .filter(a => a.employeeId === empId)
    .flatMap(a => (a.payments||[]).filter(p => p.month === monthStr))
    .reduce((s,p) => s + (p.amount||0), 0);
}
function getMonthAdvanceDetails(empId, year, month) {
  const monthStr = year + '-' + String(month).padStart(2,'0');
  return getAdvances()
    .filter(a => a.employeeId === empId)
    .flatMap(a => (a.payments||[]).filter(p => p.month === monthStr)
      .map(p => ({ ...p, advanceId: a.id, type: a.type, totalAmount: a.totalAmount })));
}

// ── Expenses ───────────────────────────────────────────────────────────────
function getExpenses() {
  return Store.get('bm_expenses', []);
}

function saveExpenses(expenses) {
  Store.set('bm_expenses', expenses);
}

function generateExpenseId() {
  const expenses = getExpenses();
  if (!expenses.length) return 'EXP1001';
  const nums = expenses.map(e => parseInt((e.id || '').replace(/\D/g, '')) || 0);
  return 'EXP' + (Math.max(...nums) + 1);
}
