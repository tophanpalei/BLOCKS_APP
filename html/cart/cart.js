/* ===== CART.JS — Shopping cart page ===== */

(function () {
  function renderCart() {
    const cart = getCart();
    const container = document.getElementById('cart-container');
    if (!container) return;

    if (cart.length === 0) {
      container.innerHTML = `
        <div class="empty-cart">
          <div class="empty-icon">🛒</div>
          <h3>Your cart is empty</h3>
          <p>Browse our products and add items to your cart.</p>
          <a href="../products/products.html" class="btn-primary">Browse Products</a>
        </div>`;
      renderSummary(0, 0);
      return;
    }

    const products = getProducts();
    let html = `
      <div class="cart-table-wrap">
        <table class="cart-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Price</th>
              <th>Quantity</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>`;

    cart.forEach(item => {
      const product = products.find(p => p.id === item.id);
      if (!product) return;

      const itemTotal = product.price * item.qty;
      const thumbContent = product.image
        ? `<img src="${product.image}" alt="${product.name}">`
        : product.emoji || '🧱';

      html += `
        <tr data-id="${product.id}">
          <td data-label="Product">
            <div class="cart-item-info">
              <div class="cart-item-thumb">${thumbContent}</div>
              <div>
                <div class="cart-item-name">${product.name}</div>
                <div class="cart-item-unit">₹${product.price} / ${product.unit}</div>
              </div>
            </div>
          </td>
          <td class="cart-price" data-label="Price">${formatRupees(product.price)}</td>
          <td data-label="Quantity">
            <div class="cart-qty-controls">
              <button class="cart-qty-btn" onclick="changeQty(${product.id}, ${item.qty - 1})">−</button>
              <input class="cart-qty-val" type="number" value="${item.qty}" min="1" max="${product.stock}"
                onchange="changeQtyDirect(${product.id}, this.value)">
              <button class="cart-qty-btn" onclick="changeQty(${product.id}, ${item.qty + 1})">+</button>
            </div>
          </td>
          <td class="cart-price" data-label="Total">${formatRupees(itemTotal)}</td>
          <td data-label="">
            <button class="btn-remove" onclick="removeItem(${product.id})">🗑</button>
          </td>
        </tr>`;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;

    const subtotal = getCartTotal();
    renderSummary(subtotal, cart.length);
  }

  function renderSummary(subtotal, itemCount) {
    const summaryEl = document.getElementById('cart-summary');
    if (!summaryEl) return;

    const delivery = subtotal > 5000 ? 0 : 299;
    const total = subtotal + delivery;

    if (itemCount === 0) {
      summaryEl.innerHTML = `
        <div class="cart-summary">
          <h3>Order Summary</h3>
          <p style="color:var(--text-muted);text-align:center;padding:1rem 0">Cart is empty</p>
          <a href="../products/products.html" class="btn-continue-shopping">← Browse Products</a>
        </div>`;
      return;
    }

    summaryEl.innerHTML = `
      <div class="cart-summary">
        <h3>Order Summary</h3>
        <div class="summary-row"><span>Subtotal (${getCartCount()} items)</span><span>${formatRupees(subtotal)}</span></div>
        <div class="summary-row"><span>Delivery Charges</span><span>${delivery === 0 ? '<span style="color:var(--success)">Free</span>' : formatRupees(delivery)}</span></div>
        ${delivery === 0 ? '<div style="font-size:0.78rem;color:var(--success);text-align:right;margin-top:-0.5rem;margin-bottom:0.5rem">Free delivery on orders above ₹5,000!</div>' : '<div style="font-size:0.78rem;color:var(--text-muted);text-align:right;margin-top:-0.5rem;margin-bottom:0.5rem">Free delivery above ₹5,000</div>'}
        <div class="summary-row total"><span>Total</span><span>${formatRupees(total)}</span></div>
        <a href="../checkout/checkout.html" class="btn-checkout">🛍 Proceed to Checkout</a>
        <a href="../products/products.html" class="btn-continue-shopping">← Continue Shopping</a>
        <button onclick="clearCartAction()" style="width:100%;background:none;border:none;color:var(--danger);font-size:0.85rem;margin-top:0.8rem;cursor:pointer;padding:0.3rem;font-family:var(--font)">🗑 Clear Cart</button>
      </div>`;
  }

  window.changeQty = function (productId, newQty) {
    const product = getProductById(productId);
    if (!product) return;
    if (newQty <= 0) {
      if (confirmAction('Remove this item from cart?')) {
        removeFromCart(productId);
        renderCart();
      }
      return;
    }
    if (newQty > product.stock) {
      showToast(`Maximum available stock is ${product.stock} units`, 'warning');
      newQty = product.stock;
    }
    updateCartQty(productId, newQty);
    renderCart();
  };

  window.changeQtyDirect = function (productId, value) {
    const product = getProductById(productId);
    if (!product) { renderCart(); return; }

    let qty = parseInt(value);
    if (isNaN(qty) || qty < 1) {
      showToast('Please enter a valid quantity (minimum 1)', 'warning');
      renderCart();
      return;
    }
    if (qty > product.stock) {
      showToast(`Only ${product.stock} units available for ${product.name}`, 'warning');
      qty = product.stock;
    }
    updateCartQty(productId, qty);
    renderCart();
  };

  window.removeItem = function (productId) {
    if (confirmAction('Remove this item from cart?')) {
      removeFromCart(productId);
      showToast('Item removed from cart', 'info');
      renderCart();
    }
  };

  window.clearCartAction = function () {
    if (confirmAction('Clear all items from cart?')) {
      clearCart();
      showToast('Cart cleared', 'info');
      renderCart();
    }
  };

  document.addEventListener('DOMContentLoaded', renderCart);
})();
