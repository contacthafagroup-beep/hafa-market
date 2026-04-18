'use strict';

// ===== PRODUCT DATA =====
const PRODUCTS = [
  // Vegetables
  { id:1,  name:'Fresh Tomatoes',      emoji:'🍅', price:1.99, oldPrice:2.49, rating:4.6, reviews:89,  category:'vegetables', badge:'Fresh',    badgeType:'new',     bg:'#fce4ec', seller:'Kwame Farms' },
  { id:2,  name:'Organic Kale',        emoji:'🥬', price:2.49, oldPrice:2.99, rating:4.8, reviews:124, category:'vegetables', badge:'Organic',  badgeType:'organic', bg:'#e8f5e9', seller:'Amina Harvest' },
  { id:3,  name:'Carrots 1kg',         emoji:'🥕', price:1.49, oldPrice:1.99, rating:4.7, reviews:134, category:'vegetables', badge:'Organic',  badgeType:'organic', bg:'#fff3e0', seller:'Kwame Farms' },
  { id:4,  name:'Potatoes 2kg',        emoji:'🥔', price:2.99, oldPrice:null, rating:4.5, reviews:76,  category:'vegetables', badge:null,       badgeType:'',        bg:'#f5f5f5', seller:'Ibrahim AgriCo' },
  // Fruits
  { id:5,  name:'Sweet Mangoes',       emoji:'🥭', price:4.49, oldPrice:5.99, rating:4.9, reviews:210, category:'fruits',     badge:'Hot Deal', badgeType:'hot',     bg:'#fff3e0', seller:'Fatima Fresh' },
  { id:6,  name:'Ripe Avocado',        emoji:'🥑', price:3.99, oldPrice:null, rating:4.8, reviews:167, category:'fruits',     badge:'Organic',  badgeType:'organic', bg:'#e8f5e9', seller:'Kwame Farms' },
  { id:7,  name:'Watermelon',          emoji:'🍉', price:6.99, oldPrice:null, rating:4.8, reviews:201, category:'fruits',     badge:'Hot Deal', badgeType:'hot',     bg:'#e8f5e9', seller:'Fatima Fresh' },
  { id:8,  name:'Banana Bunch',        emoji:'🍌', price:2.29, oldPrice:2.99, rating:4.6, reviews:98,  category:'fruits',     badge:'Fresh',    badgeType:'new',     bg:'#fff9c4', seller:'Amina Harvest' },
  // Grains
  { id:9,  name:'Teff 2kg',            emoji:'🌾', price:5.99, oldPrice:7.49, rating:4.7, reviews:88,  category:'grains',     badge:'Organic',  badgeType:'organic', bg:'#f5f5f5', seller:'Ibrahim AgriCo' },
  { id:10, name:'Wheat Grain 5kg',     emoji:'🌾', price:7.99, oldPrice:9.99, rating:4.5, reviews:67,  category:'grains',     badge:'Bulk',     badgeType:'sale',    bg:'#fafafa', seller:'Ibrahim AgriCo' },
  { id:11, name:'Maize 5kg',           emoji:'🌽', price:4.99, oldPrice:null, rating:4.4, reviews:55,  category:'grains',     badge:null,       badgeType:'',        bg:'#fff9c4', seller:'Kwame Farms' },
  // Legumes
  { id:12, name:'Red Lentils 1kg',     emoji:'🫘', price:3.49, oldPrice:3.99, rating:4.6, reviews:72,  category:'legumes',    badge:'New',      badgeType:'new',     bg:'#fbe9e7', seller:'Amina Harvest' },
  { id:13, name:'Chickpeas 1kg',       emoji:'🫘', price:3.99, oldPrice:null, rating:4.5, reviews:61,  category:'legumes',    badge:null,       badgeType:'',        bg:'#fff3e0', seller:'Ibrahim AgriCo' },
  // Spices
  { id:14, name:'Turmeric Powder',     emoji:'🌿', price:2.99, oldPrice:3.49, rating:4.8, reviews:143, category:'spices',     badge:'Organic',  badgeType:'organic', bg:'#fff8e1', seller:'Fatima Fresh' },
  { id:15, name:'Fresh Ginger 500g',   emoji:'🫚', price:1.99, oldPrice:null, rating:4.7, reviews:109, category:'spices',     badge:'Fresh',    badgeType:'new',     bg:'#f1f8e9', seller:'Kwame Farms' },
  { id:16, name:'Cardamom 100g',       emoji:'🌿', price:4.49, oldPrice:5.49, rating:4.9, reviews:87,  category:'spices',     badge:'Premium',  badgeType:'hot',     bg:'#e8f5e9', seller:'Fatima Fresh' },
  // Poultry & Dairy
  { id:17, name:'Farm Fresh Eggs x12', emoji:'🥚', price:3.99, oldPrice:4.49, rating:4.8, reviews:198, category:'poultry',    badge:'Fresh',    badgeType:'new',     bg:'#fff9c4', seller:'Amina Harvest' },
  { id:18, name:'Fresh Milk 1L',       emoji:'🥛', price:1.49, oldPrice:null, rating:4.6, reviews:134, category:'poultry',    badge:'Daily',    badgeType:'new',     bg:'#f3f4f6', seller:'Kwame Farms' },
  { id:19, name:'Free-Range Chicken',  emoji:'🍗', price:8.99, oldPrice:10.99,rating:4.7, reviews:76,  category:'poultry',    badge:'Hot Deal', badgeType:'hot',     bg:'#fce4ec', seller:'Ibrahim AgriCo' },
  // Meat
  { id:20, name:'Beef 1kg',            emoji:'🥩', price:12.99,oldPrice:14.99,rating:4.5, reviews:54,  category:'meat',       badge:'Fresh',    badgeType:'new',     bg:'#fbe9e7', seller:'Amina Harvest' },
  { id:21, name:'Goat Meat 1kg',       emoji:'🥩', price:11.49,oldPrice:null, rating:4.4, reviews:43,  category:'meat',       badge:null,       badgeType:'',        bg:'#fce4ec', seller:'Ibrahim AgriCo' },
  // Coffee
  { id:22, name:'Ethiopian Roasted Coffee 500g', emoji:'☕', price:9.99, oldPrice:12.99, rating:4.9, reviews:312, category:'coffee', badge:'Premium', badgeType:'hot', bg:'#efebe9', seller:'Fatima Fresh' },
  { id:23, name:'Raw Green Coffee 1kg',emoji:'🫘', price:7.49, oldPrice:null, rating:4.7, reviews:88,  category:'coffee',     badge:'Organic',  badgeType:'organic', bg:'#d7ccc8', seller:'Kwame Farms' },
  // Specialty
  { id:24, name:'Pure Honey 500g',     emoji:'🍯', price:8.99, oldPrice:10.99,rating:4.9, reviews:267, category:'specialty',  badge:'Natural',  badgeType:'organic', bg:'#fff8e1', seller:'Fatima Fresh' },
  { id:25, name:'Moringa Powder 200g', emoji:'🌿', price:5.99, oldPrice:null, rating:4.8, reviews:134, category:'specialty',  badge:'Organic',  badgeType:'organic', bg:'#e8f5e9', seller:'Amina Harvest' },
  // Processed
  { id:26, name:'ዶሮ ወጥ (Doro Wot) Ready', emoji:'🍲', price:6.99, oldPrice:7.99, rating:4.8, reviews:189, category:'processed', badge:'Ready',  badgeType:'new',  bg:'#fce4ec', seller:'Amina Harvest' },
  { id:27, name:'Injera Pack x10',     emoji:'🫓', price:4.49, oldPrice:null, rating:4.7, reviews:145, category:'processed',  badge:'Fresh',    badgeType:'new',     bg:'#fff9c4', seller:'Kwame Farms' },
  // Household
  { id:28, name:'Eco Detergent 1kg',   emoji:'🧴', price:3.49, oldPrice:3.99, rating:4.3, reviews:67,  category:'household',  badge:'Sale',     badgeType:'sale',    bg:'#e3f2fd', seller:'Ibrahim AgriCo' },
  // Services
  { id:29, name:'Express Delivery',    emoji:'🚚', price:2.99, oldPrice:null, rating:4.9, reviews:445, category:'services',   badge:'Fast',     badgeType:'hot',     bg:'#e8f5e9', seller:'Hafa Logistics' },
];

// ===== STATE =====
let cart = [];
let wishlist = [];
let activeFilter = 'all';
let maxPrice = 100;
let sortMode = 'default';
let visibleCount = 8;

// ===== RENDER PRODUCTS =====
function getFilteredProducts() {
  let list = PRODUCTS.filter(p => {
    const catOk = activeFilter === 'all' || p.category === activeFilter;
    const priceOk = p.price <= maxPrice;
    return catOk && priceOk;
  });
  if (sortMode === 'price-asc') list.sort((a,b) => a.price - b.price);
  else if (sortMode === 'price-desc') list.sort((a,b) => b.price - a.price);
  else if (sortMode === 'rating') list.sort((a,b) => b.rating - a.rating);
  else if (sortMode === 'newest') list.sort((a,b) => b.id - a.id);
  return list;
}

function renderProducts() {
  const grid = document.getElementById('productsGrid');
  const list = getFilteredProducts().slice(0, visibleCount);
  if (!list.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:#6b7280"><span style="font-size:3rem;display:block;margin-bottom:12px">🔍</span><p style="font-weight:600;font-size:1rem">No products found</p><small>Try adjusting your filters</small></div>';
    return;
  }
  grid.innerHTML = list.map(p => {
    const inWish = wishlist.includes(p.id);
    const stars = '★'.repeat(Math.floor(p.rating)) + '☆'.repeat(5 - Math.floor(p.rating));
    return `
    <div class="product-card reveal" onclick="openProductModal(${p.id})">
      <div class="prod-img" style="background:${p.bg}">
        ${p.badge ? `<span class="prod-badge badge-${p.badgeType}">${p.badge}</span>` : ''}
        <button class="prod-wish ${inWish?'active':''}" onclick="event.stopPropagation();toggleWishlist(${p.id})" aria-label="Wishlist">
          <i class="fa${inWish?'s':'r'} fa-heart"></i>
        </button>
        <span>${p.emoji}</span>
      </div>
      <div class="prod-info">
        <div class="prod-seller">by ${p.seller}</div>
        <div class="prod-name">${p.name}</div>
        <div class="prod-rating">${stars} <span>(${p.reviews})</span></div>
        <div class="prod-price-row">
          <div>
            <div class="prod-price">$${p.price.toFixed(2)}</div>
            ${p.oldPrice ? `<div class="prod-old">$${p.oldPrice.toFixed(2)}</div>` : ''}
          </div>
          <button class="btn-add-cart" onclick="event.stopPropagation();addToCart(${p.id})">+ Cart</button>
        </div>
      </div>
    </div>`;
  }).join('');
  observeReveal();
}

function loadMore() {
  visibleCount += 4;
  renderProducts();
}

// ===== FILTERS =====
function setFilter(btn, cat) {
  document.querySelectorAll('.ftab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeFilter = cat;
  visibleCount = 8;
  renderProducts();
}

function filterCategory(cat) {
  activeFilter = cat;
  visibleCount = 8;
  document.querySelectorAll('.ftab').forEach(b => {
    const txt = b.textContent.trim().toLowerCase();
    b.classList.toggle('active', cat === 'all' ? txt === 'all' : txt.includes(cat));
  });
  renderProducts();
  document.getElementById('featured').scrollIntoView({ behavior: 'smooth' });
}

function filterPrice(val) {
  maxPrice = parseFloat(val);
  document.getElementById('priceVal').textContent = val;
  renderProducts();
}

function sortProducts(val) {
  sortMode = val;
  renderProducts();
}

// ===== CART =====
function addToCart(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  const existing = cart.find(i => i.id === id);
  if (existing) existing.qty++;
  else cart.push({ ...p, qty: 1 });
  updateCartUI();
  showToast(`${p.emoji} ${p.name} added to cart!`, 'success');
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  updateCartUI();
}

function changeQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) removeFromCart(id);
  else updateCartUI();
}

function updateCartUI() {
  const count = cart.reduce((s,i) => s + i.qty, 0);
  const subtotal = cart.reduce((s,i) => s + i.price * i.qty, 0);
  document.getElementById('cartCount').textContent = count;
  document.getElementById('cartCountSidebar').textContent = `(${count})`;

  const itemsEl = document.getElementById('cartItems');
  const footerEl = document.getElementById('cartFooter');

  if (!cart.length) {
    itemsEl.innerHTML = '<div class="empty-state"><span>🛒</span><p>Your cart is empty</p><small>Add some fresh products!</small></div>';
    footerEl.style.display = 'none';
  } else {
    itemsEl.innerHTML = cart.map(item => `
      <div class="cart-item">
        <span class="ci-icon">${item.emoji}</span>
        <div class="ci-info">
          <div class="ci-name">${item.name}</div>
          <div class="ci-price">$${(item.price * item.qty).toFixed(2)}</div>
          <div class="ci-qty">
            <button onclick="changeQty(${item.id},-1)">−</button>
            <span>${item.qty}</span>
            <button onclick="changeQty(${item.id},1)">+</button>
          </div>
        </div>
        <button class="ci-remove" onclick="removeFromCart(${item.id})"><i class="fas fa-trash"></i></button>
      </div>`).join('');
    footerEl.style.display = 'block';
    document.getElementById('cartSubtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('cartTotal').textContent = `$${subtotal.toFixed(2)}`;
  }
}

function toggleCart() {
  document.getElementById('cartSidebar').classList.toggle('active');
  document.getElementById('cartOverlay').classList.toggle('active');
  document.getElementById('wishSidebar').classList.remove('active');
  document.getElementById('wishOverlay').classList.remove('active');
}

// ===== WISHLIST =====
function toggleWishlist(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  if (wishlist.includes(id)) {
    wishlist = wishlist.filter(x => x !== id);
    showToast(`${p.emoji} Removed from wishlist`, 'info');
  } else {
    wishlist.push(id);
    showToast(`💚 ${p.name} saved to wishlist!`, 'success');
  }
  document.getElementById('wishCount').textContent = wishlist.length;
  document.getElementById('wishCountSidebar').textContent = `(${wishlist.length})`;
  updateWishlistUI();
  renderProducts();
}

function updateWishlistUI() {
  const el = document.getElementById('wishItems');
  if (!wishlist.length) {
    el.innerHTML = '<div class="empty-state"><span>💚</span><p>Your wishlist is empty</p><small>Save products you love!</small></div>';
    return;
  }
  el.innerHTML = wishlist.map(id => {
    const p = PRODUCTS.find(x => x.id === id);
    return `<div class="cart-item">
      <span class="ci-icon">${p.emoji}</span>
      <div class="ci-info">
        <div class="ci-name">${p.name}</div>
        <div class="ci-price">$${p.price.toFixed(2)}</div>
      </div>
      <button class="btn-add-cart" onclick="addToCart(${p.id});toggleWishlist(${p.id})">Add to Cart</button>
    </div>`;
  }).join('');
}

function toggleWishlistPanel() {
  document.getElementById('wishSidebar').classList.toggle('active');
  document.getElementById('wishOverlay').classList.toggle('active');
  document.getElementById('cartSidebar').classList.remove('active');
  document.getElementById('cartOverlay').classList.remove('active');
}

// ===== PRODUCT MODAL =====
function openProductModal(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  const stars = '★'.repeat(Math.floor(p.rating)) + '☆'.repeat(5 - Math.floor(p.rating));
  document.getElementById('productModalContent').innerHTML = `
    <div class="prod-modal-grid">
      <div class="prod-modal-img" style="background:${p.bg}">${p.emoji}</div>
      <div class="prod-modal-info">
        <div class="prod-seller" style="margin-bottom:6px">by ${p.seller}</div>
        <h2>${p.name}</h2>
        <div class="prod-rating" style="margin:8px 0 12px">${stars} <span style="color:#6b7280">(${p.reviews} reviews)</span></div>
        <div class="prod-modal-price">$${p.price.toFixed(2)} ${p.oldPrice ? `<span style="font-size:1rem;color:#9ca3af;text-decoration:line-through;font-weight:400">$${p.oldPrice.toFixed(2)}</span>` : ''}</div>
        <div class="prod-modal-desc">Fresh, high-quality ${p.name.toLowerCase()} sourced directly from ${p.seller}. Delivered within 24–48 hours to your doorstep. All products are quality-checked and certified.</div>
        <div class="prod-modal-actions">
          <button class="btn-primary" onclick="addToCart(${p.id});closeModal('productModal')"><i class="fas fa-cart-plus"></i> Add to Cart</button>
          <button class="btn-visit-seller" onclick="toggleWishlist(${p.id})"><i class="fas fa-heart"></i> Wishlist</button>
        </div>
      </div>
    </div>`;
  openModal('productModal');
}

// ===== SEARCH =====
function liveSearch(val) {
  const drop = document.getElementById('searchDropdown');
  if (!val.trim()) { drop.classList.remove('open'); return; }
  const results = PRODUCTS.filter(p => p.name.toLowerCase().includes(val.toLowerCase())).slice(0, 5);
  if (!results.length) { drop.classList.remove('open'); return; }
  drop.innerHTML = results.map(p => `
    <div class="sd-item" onclick="openProductModal(${p.id});document.getElementById('searchDropdown').classList.remove('open')">
      <span>${p.emoji}</span>
      <div>
        <div style="font-weight:600;color:#374151">${p.name}</div>
        <div style="font-size:.75rem;color:#2E7D32;font-weight:700">$${p.price.toFixed(2)}</div>
      </div>
    </div>`).join('');
  drop.classList.add('open');
}

function showSearchDrop() {
  const val = document.getElementById('searchInput').value;
  if (val.trim()) liveSearch(val);
}

function doSearch() {
  const val = document.getElementById('searchInput').value.trim();
  if (!val) return;
  const cat = document.getElementById('searchCat').value;
  activeFilter = cat || 'all';
  visibleCount = 12;
  renderProducts();
  document.getElementById('featured').scrollIntoView({ behavior: 'smooth' });
  document.getElementById('searchDropdown').classList.remove('open');
}

document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) {
    document.getElementById('searchDropdown').classList.remove('open');
  }
});

// ===== MODALS =====
function openModal(id) {
  document.getElementById(id).classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id).classList.remove('active');
  document.body.style.overflow = '';
}
function closeModalOutside(e, id) {
  if (e.target.id === id) closeModal(id);
}
function switchModal(from, to) {
  closeModal(from);
  setTimeout(() => openModal(to), 200);
}
function togglePw(id) {
  const inp = document.getElementById(id);
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

// ===== MEGA MENU =====
function toggleMegaMenu() {
  document.getElementById('megaMenu').classList.toggle('open');
}
document.addEventListener('click', e => {
  if (!e.target.closest('.nav-all-cats') && !e.target.closest('.mega-menu')) {
    document.getElementById('megaMenu').classList.remove('open');
  }
});

// ===== MOBILE MENU =====
function toggleMenu() {
  document.getElementById('navBar').classList.toggle('open');
}

// ===== HOW IT WORKS TABS =====
function switchHow(btn, tab) {
  document.querySelectorAll('.how-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('howBuyers').classList.toggle('hidden', tab !== 'buyers');
  document.getElementById('howSellers').classList.toggle('hidden', tab !== 'sellers');
}

// ===== NEWSLETTER =====
function subscribeNewsletter(e) {
  e.preventDefault();
  showToast('🎉 You\'re subscribed! Welcome to Hafa Market.', 'success');
  e.target.reset();
}

// ===== TOAST =====
function showToast(msg, type = '') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast t-${type}`;
  toast.innerHTML = `<span>${msg}</span><button class="toast-close" onclick="this.parentElement.remove()">×</button>`;
  container.appendChild(toast);
  requestAnimationFrame(() => { requestAnimationFrame(() => toast.classList.add('show')); });
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 3500);
}

// ===== STICKY HEADER =====
window.addEventListener('scroll', () => {
  const btt = document.getElementById('backToTop');
  btt.classList.toggle('visible', window.scrollY > 400);
});

// ===== SCROLL REVEAL =====
function observeReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add('visible'), i * 80);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal:not(.visible)').forEach(el => obs.observe(el));
}

// ===== SECTION REVEAL =====
const sectionObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('visible'); sectionObs.unobserve(e.target); }
  });
}, { threshold: 0.08 });

document.querySelectorAll('.why-card,.cat-card,.seller-card,.blog-card,.testi-card,.how-step,.stat-item,.deal-card').forEach(el => {
  el.classList.add('reveal');
  sectionObs.observe(el);
});

// ===== COUNTER ANIMATION =====
function animateCounter(el) {
  const target = parseInt(el.dataset.target);
  const duration = 2000;
  const step = target / (duration / 16);
  let current = 0;
  const timer = setInterval(() => {
    current += step;
    if (current >= target) { el.textContent = target.toLocaleString() + (target >= 100 && target < 1000 ? '' : target >= 1000 ? '' : ''); clearInterval(timer); }
    else el.textContent = Math.floor(current).toLocaleString();
  }, 16);
}

const counterObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) { animateCounter(e.target); counterObs.unobserve(e.target); }
  });
}, { threshold: 0.5 });
document.querySelectorAll('.stat-num').forEach(el => counterObs.observe(el));

// ===== PARTICLES =====
function createParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.cssText = `left:${Math.random()*100}%;animation-duration:${8+Math.random()*12}s;animation-delay:${Math.random()*10}s;width:${2+Math.random()*4}px;height:${2+Math.random()*4}px;opacity:${.1+Math.random()*.3}`;
    container.appendChild(p);
  }
}

// ===== TESTIMONIAL DOTS =====
function initTestiDots() {
  const cards = document.querySelectorAll('.testi-card');
  const dotsEl = document.getElementById('testiDots');
  if (!dotsEl || !cards.length) return;
  cards.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.className = 'testi-dot' + (i === 0 ? ' active' : '');
    dot.onclick = () => {
      document.querySelectorAll('.testi-dot').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
    };
    dotsEl.appendChild(dot);
  });
}

// ===== INIT =====
renderProducts();
createParticles();
initTestiDots();
observeReveal();
