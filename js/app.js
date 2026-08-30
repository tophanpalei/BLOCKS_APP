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
const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbyafj8RMVuUJXspfuUEK2ClxVtKYhZRQf45jwZLww8XENu1i1Wwm6csWANpTJCFWFU8/exec'; // Paste your Apps Script deployment URL here

const _LOCAL_ONLY = new Set(['bm_admin_session', 'bm_cart', 'bm_last_order', 'bm_last_seen_orders', 'bm_theme']);

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
        body: JSON.stringify({ key, value })
      }).catch(() => {});
    }
  },
  remove(key) {
    localStorage.removeItem(key);
    if (SHEETS_URL && !_LOCAL_ONLY.has(key)) {
      fetch(SHEETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ key, value: null })
      }).catch(() => {});
    }
  }
};

async function syncFromSheets() {
  if (!SHEETS_URL) return;
  const keys = ['bm_orders', 'bm_products', 'bm_settings', 'bm_admin_creds'];
  try {
    await Promise.all(keys.map(async key => {
      const res  = await fetch(`${SHEETS_URL}?key=${encodeURIComponent(key)}`);
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

  const order = {
    id: generateOrderId(),
    date: new Date().toISOString(),
    customer: customerInfo,
    items,
    subtotal,
    delivery,
    total: subtotal + delivery,
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
  freeDeliveryAbove: 5000
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
