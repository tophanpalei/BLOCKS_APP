  // ── Hero Slider ────────────────────────────────────────────────────────────
  let currentSlide = 0;
  const slides = document.querySelectorAll('.slide');
  const totalSlides = slides.length;
  let autoSlideInterval;

  function initSlider() {
    const dotsContainer = document.getElementById('slider-dots');
    dotsContainer.innerHTML = '';
    for (let i = 0; i < totalSlides; i++) {
      const dot = document.createElement('button');
      dot.className = 'slider-dot' + (i === 0 ? ' active' : '');
      dot.onclick = () => goToSlide(i);
      dotsContainer.appendChild(dot);
    }
    startAutoSlide();
  }

  function goToSlide(index) {
    currentSlide = (index + totalSlides) % totalSlides;
    document.getElementById('main-slider').style.transform = `translateX(-${currentSlide * 100}%)`;
    document.querySelectorAll('.slider-dot').forEach((d, i) => {
      d.classList.toggle('active', i === currentSlide);
    });
  }

  function slideMove(direction) {
    goToSlide(currentSlide + direction);
    resetAutoSlide();
  }

  function startAutoSlide() {
    autoSlideInterval = setInterval(() => goToSlide(currentSlide + 1), 5000);
  }

  function resetAutoSlide() {
    clearInterval(autoSlideInterval);
    startAutoSlide();
  }

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') slideMove(-1);
    if (e.key === 'ArrowRight') slideMove(1);
  });

  // Touch swipe support
  let touchStartX = 0;
  const hero = document.querySelector('.hero');
  hero.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; });
  hero.addEventListener('touchend', e => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) slideMove(diff > 0 ? 1 : -1);
  });

  // ── Featured Products ───────────────────────────────────────────────────────
  function renderFeaturedProducts() {
    const featured = getProducts().filter(p => p.featured);
    const grid = document.getElementById('featured-products-grid');
    if (!grid) return;

    grid.innerHTML = featured.map(product => {
      const imgContent = product.image
        ? `<img src="${product.image}" alt="${product.name}" loading="lazy">`
        : `<div class="product-img-placeholder">${product.emoji || '🧱'}<span>${product.category}</span></div>`;

      return `
        <div class="product-card">
          <div class="product-img-wrap" onclick="window.location='../products/products.html'">
            ${imgContent}
            <span class="product-badge">In Stock</span>
            <span class="product-category-badge" style="text-transform:capitalize">${product.category}</span>
          </div>
          <div class="product-info">
            <div class="product-name">${product.name}</div>
            <div class="product-desc">${product.description.substring(0, 75)}...</div>
            <div class="product-meta">
              <div class="product-price">${formatRupees(product.price)} <small>/ ${product.unit}</small></div>
              <span class="product-stock stock-yes">✓ Available</span>
            </div>
            <div class="product-actions">
              <button class="btn-add-cart" onclick="addToCart(${product.id}, 1)">🛒 Add to Cart</button>
              <button class="btn-view" onclick="window.location='../products/products.html'" title="View all">→</button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  function submitContactForm(e) {
    e.preventDefault();
    showToast('Message sent! We will get back to you soon.', 'success');
    e.target.reset();
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  document.addEventListener('DOMContentLoaded', () => {
    initSlider();
    renderFeaturedProducts();
    applyContactSettings();
  });
