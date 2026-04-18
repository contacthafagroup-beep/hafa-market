'use strict';

// ===== NAV SCROLL =====
window.addEventListener('scroll', () => {
  document.getElementById('appNav').classList.toggle('scrolled', window.scrollY > 20);
  document.getElementById('appBackTop').classList.toggle('visible', window.scrollY > 400);
});

// ===== MOBILE NAV =====
function toggleAppNav() {
  document.getElementById('appNavLinks').classList.toggle('open');
  document.getElementById('appHamburger').classList.toggle('open');
}

// ===== SCREENSHOT TABS =====
const SS_INFO = {
  home:    { title: 'Smart Home Feed', desc: 'Personalized product recommendations, flash deals, and your favorite categories — all on one beautiful home screen.', features: ['Personalized recommendations', 'Flash sale countdown timers', 'Quick reorder from history', 'Live delivery tracking widget'] },
  browse:  { title: 'Powerful Search & Browse', desc: 'Find any product instantly with smart search, filters, and category browsing. Sort by price, rating, or distance.', features: ['Smart search with autocomplete', 'Filter by category, price, rating', 'Grid and list view toggle', 'Voice search support'] },
  product: { title: 'Rich Product Pages', desc: 'Full product details with photos, reviews, seller info, and nutritional data. Everything you need to make the right choice.', features: ['High-quality product images', 'Verified buyer reviews', 'Seller profile & ratings', 'Nutritional information'] },
  cart:    { title: 'Seamless Checkout', desc: 'Add items, apply promo codes, choose delivery time, and pay in seconds with your preferred payment method.', features: ['One-tap reorder', 'Promo code support', 'Multiple payment methods', 'Delivery time selection'] },
  track:   { title: 'Real-Time Order Tracking', desc: 'Watch your order move from farm to your door on a live map. Get push notifications at every step.', features: ['Live GPS map tracking', 'Push & SMS notifications', 'Full order history', 'One-tap reorder'] },
  seller:  { title: 'Seller Dashboard', desc: 'Farmers get a full business dashboard — manage products, track sales, view analytics, and receive payouts.', features: ['Product management', 'Sales analytics & charts', 'Order management', 'Direct payout requests'] },
};

function switchSS(btn, screen) {
  document.querySelectorAll('.ss-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.ss-phone').forEach(p => {
    p.classList.toggle('ss-active', p.dataset.screen === screen);
  });
  const info = SS_INFO[screen];
  document.getElementById('ssInfo').innerHTML = `
    <h3>${info.title}</h3>
    <p>${info.desc}</p>
    <ul class="ss-features-list">
      ${info.features.map(f => `<li><i class="fas fa-check"></i> ${f}</li>`).join('')}
    </ul>`;
}

// ===== FAQ =====
function toggleFaq(el) {
  const isOpen = el.classList.contains('open');
  document.querySelectorAll('.faq-item').forEach(f => f.classList.remove('open'));
  if (!isOpen) el.classList.add('open');
}

// ===== SCROLL REVEAL =====
const revealObs = new IntersectionObserver(entries => {
  entries.forEach((e, i) => {
    if (e.isIntersecting) {
      setTimeout(() => {
        e.target.style.opacity = '1';
        e.target.style.transform = 'translateY(0)';
      }, i * 80);
      revealObs.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.feature-card, .hiw-step, .review-card, .faq-item, .ss-phone-inner, .compare-table').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(24px)';
  el.style.transition = 'opacity .55s ease, transform .55s ease';
  revealObs.observe(el);
});

// ===== COUNTER ANIMATION =====
const counterObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const target = parseInt(e.target.dataset.target);
      let current = 0;
      const step = target / 60;
      const timer = setInterval(() => {
        current += step;
        if (current >= target) { e.target.textContent = target.toLocaleString(); clearInterval(timer); }
        else e.target.textContent = Math.floor(current).toLocaleString();
      }, 16);
      counterObs.unobserve(e.target);
    }
  });
}, { threshold: 0.5 });
document.querySelectorAll('[data-target]').forEach(el => counterObs.observe(el));

// ===== PHONE BACK/FRONT FLOAT FIX =====
// Override CSS animation for back/front phones since they have rotation
const phoneBack = document.querySelector('.phone-back');
const phoneFront = document.querySelector('.phone-front');
if (phoneBack) {
  phoneBack.style.animation = 'none';
  let y = 0, dir = 1;
  setInterval(() => {
    y += dir * 0.15;
    if (y > 10 || y < 0) dir *= -1;
    phoneBack.style.transform = `rotate(-8deg) translateY(${y}px)`;
  }, 16);
}
if (phoneFront) {
  phoneFront.style.animation = 'none';
  let y = 5, dir = -1;
  setInterval(() => {
    y += dir * 0.12;
    if (y > 10 || y < 0) dir *= -1;
    phoneFront.style.transform = `rotate(8deg) translateY(${y}px)`;
  }, 16);
}
