/* ===== PRODUCTS.JS — Products listing page ===== */

(function () {
  let currentCategory = 'all';
  let currentSort = 'default';
  let searchQuery = '';

  function renderProductCard(product) {
    const stockBadge = product.stock > 0
      ? `<span class="product-badge">In Stock</span>`
      : `<span class="product-badge out">Out of Stock</span>`;

    const catLabels = { blocks: 'Block', bricks: 'Brick', pavers: 'Paver', cement: 'Cement' };
    const catLabel = catLabels[product.category] || product.category;

    const imgContent = product.image
      ? `<img src="${product.image}" alt="${product.name}" loading="lazy">`
      : `<div class="product-img-placeholder">${product.emoji || '🧱'}<span>${catLabel}</span></div>`;

    return `
      <div class="product-card" data-id="${product.id}">
        <div class="product-img-wrap" onclick="openProductModal(${product.id})">
          ${imgContent}
          ${stockBadge}
          <span class="product-category-badge">${catLabel}</span>
        </div>
        <div class="product-info">
          <div class="product-name" onclick="openProductModal(${product.id})">${product.name}</div>
          <div class="product-desc">${product.description.substring(0, 80)}...</div>
          <div class="product-meta">
            <div class="product-price">${formatRupees(product.price)} <small>/ ${product.unit}</small></div>
            <span class="product-stock ${product.stock > 0 ? 'stock-yes' : 'stock-no'}">
              ${product.stock > 0 ? '✓ Available' : '✗ Out of Stock'}
            </span>
          </div>
          ${product.stock === 0 && product.outOfStockReason ? `
            <div style="font-size:0.8rem;color:var(--warning);background:rgba(243,156,18,0.1);border:1px solid rgba(243,156,18,0.3);border-radius:6px;padding:0.4rem 0.7rem;margin-bottom:0.6rem">
              ⚠️ ${product.outOfStockReason}
            </div>` : ''}
          <div class="product-actions">
            <button class="btn-add-cart" onclick="handleAddToCart(${product.id})" ${product.stock === 0 ? 'disabled' : ''}>
              🛒 Add to Cart
            </button>
            <button class="btn-view" onclick="openProductModal(${product.id})" title="View details">👁</button>
          </div>
        </div>
      </div>
    `;
  }

  function getFilteredProducts() {
    let products = getProducts();

    if (currentCategory !== 'all') {
      products = products.filter(p => p.category === currentCategory);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      products = products.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }

    if (currentSort === 'price-asc') products.sort((a, b) => a.price - b.price);
    else if (currentSort === 'price-desc') products.sort((a, b) => b.price - a.price);
    else if (currentSort === 'name') products.sort((a, b) => a.name.localeCompare(b.name));

    return products;
  }

  function renderProducts() {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    const products = getFilteredProducts();

    if (products.length === 0) {
      grid.innerHTML = `
        <div class="no-results" style="grid-column: 1/-1">
          <div class="no-results-icon">🔍</div>
          <p>No products found. Try a different search or filter.</p>
        </div>`;
      return;
    }

    grid.innerHTML = products.map(renderProductCard).join('');

    const count = document.getElementById('products-count');
    if (count) count.textContent = `${products.length} product${products.length !== 1 ? 's' : ''} found`;
  }

  // ── Category Pills ────────────────────────────────────────────────────────
  function initCategoryPills() {
    document.querySelectorAll('.category-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentCategory = pill.dataset.category;
        renderProducts();
      });
    });
  }

  // ── Search ─────────────────────────────────────────────────────────────────
  function initSearch() {
    const input = document.getElementById('product-search');
    if (!input) return;
    input.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      renderProducts();
    });
  }

  // ── Sort ───────────────────────────────────────────────────────────────────
  function initSort() {
    const select = document.getElementById('product-sort');
    if (!select) return;
    select.addEventListener('change', (e) => {
      currentSort = e.target.value;
      renderProducts();
    });
  }

  // ── Add to Cart ─────────────────────────────────────────────────────────────
  window.handleAddToCart = function (productId) {
    addToCart(productId, 1);
  };

  // ── Product Modal ───────────────────────────────────────────────────────────
  let modalQty = 1;
  let modalProductId = null;

  window.openProductModal = function (productId) {
    const product = getProductById(productId);
    if (!product) return;

    modalProductId = productId;
    modalQty = 1;

    const imgContent = product.image
      ? `<img src="${product.image}" alt="${product.name}">`
      : `<div class="modal-img-placeholder">${product.emoji || '🧱'}</div>`;

    document.getElementById('modal-img').innerHTML = imgContent;
    document.getElementById('modal-name').textContent = product.name;
    document.getElementById('modal-price').textContent = formatRupees(product.price) + ' / ' + product.unit;
    document.getElementById('modal-desc').textContent = product.description;
    document.getElementById('modal-dimensions').textContent = product.dimensions || 'N/A';
    document.getElementById('modal-weight').textContent = product.weight || 'N/A';
    document.getElementById('modal-stock-val').textContent = product.stock > 0 ? product.stock + ' units' : 'Out of Stock';
    document.getElementById('modal-category').textContent = product.category.charAt(0).toUpperCase() + product.category.slice(1);

    // Show/hide out-of-stock reason in modal
    const reasonEl = document.getElementById('modal-oos-reason');
    if (reasonEl) {
      if (product.stock === 0 && product.outOfStockReason) {
        reasonEl.textContent = '⚠️ ' + product.outOfStockReason;
        reasonEl.style.display = 'block';
      } else {
        reasonEl.style.display = 'none';
      }
    }

    updateModalQty();

    const overlay = document.getElementById('product-modal');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  window.closeProductModal = function () {
    document.getElementById('product-modal').classList.remove('active');
    document.body.style.overflow = '';
  };

  window.modalChangeQty = function (delta) {
    const product = getProductById(modalProductId);
    if (!product) return;
    const next = modalQty + delta;
    if (next > product.stock) {
      showToast(`Maximum available stock is ${product.stock} units`, 'warning');
      modalQty = product.stock;
    } else {
      modalQty = Math.max(1, next);
    }
    updateModalQty();
  };

  window.modalSetQtyDirect = function (value) {
    const product = getProductById(modalProductId);
    if (!product) return;
    let qty = parseInt(value);
    if (isNaN(qty) || qty < 1) {
      modalQty = 1;
      updateModalQty();
      return;
    }
    if (qty > product.stock) {
      showToast(`Only ${product.stock} units available`, 'warning');
      qty = product.stock;
    }
    modalQty = qty;
    updateModalQty();
  };

  function updateModalQty() {
    const product = getProductById(modalProductId);
    if (!product) return;
    document.getElementById('modal-qty-display').value = modalQty;
    const total = product.price * modalQty;
    document.getElementById('modal-total').textContent = formatRupees(total);
  }

  window.modalAddToCart = function () {
    if (addToCart(modalProductId, modalQty)) {
      closeProductModal();
    }
  };

  // Close modal on overlay click
  document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('product-modal');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeProductModal();
      });
    }

    initCategoryPills();
    initSearch();
    initSort();
    renderProducts();
  });
})();
