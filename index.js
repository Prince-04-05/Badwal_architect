
/* ═══════════════════════════════════════
   LOADER COUNTER
═══════════════════════════════════════ */
let count = 0;
const countEl = document.getElementById('loaderCount');
const countInterval = setInterval(() => {
  count += Math.floor(Math.random() * 8) + 3;
  if (count >= 100) { count = 100; clearInterval(countInterval); }
  countEl.textContent = count + '%';
}, 60);

/* ═══════════════════════════════════════
   CURSOR
═══════════════════════════════════════ */
const cursor = document.getElementById('cursor');
const ring = document.getElementById('cursorRing');
let mx = 0, my = 0, rx = 0, ry = 0;
document.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  cursor.style.left = mx + 'px'; cursor.style.top = my + 'px';
});
function animateRing() {
  rx += (mx - rx) * 0.12; ry += (my - ry) * 0.12;
  ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
  requestAnimationFrame(animateRing);
}
animateRing();
// Hide on mobile
if ('ontouchstart' in window) { cursor.style.display = 'none'; ring.style.display = 'none'; document.body.style.cursor = 'auto'; }

/* ═══════════════════════════════════════
   NAVBAR SCROLL
═══════════════════════════════════════ */
const navbar = document.getElementById('navbar');
const backTop = document.getElementById('backTop');
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  if (y > 80) navbar.classList.add('scrolled'); else navbar.classList.remove('scrolled');
  if (y > 500) backTop.classList.add('visible'); else backTop.classList.remove('visible');
});

/* ═══════════════════════════════════════
   MOBILE MENU
═══════════════════════════════════════ */
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
hamburger.addEventListener('click', () => mobileMenu.classList.toggle('open'));
function closeMobile() { mobileMenu.classList.remove('open'); }

/* ═══════════════════════════════════════
   THEME TOGGLE
═══════════════════════════════════════ */
const themeBtn = document.getElementById('themeToggle');
let theme = 'dark';
themeBtn.addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
});

/* ═══════════════════════════════════════
   SCROLL REVEAL
═══════════════════════════════════════ */
const revealEls = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
const observer = new IntersectionObserver(entries => {
  entries.forEach((e, i) => {
    if (e.isIntersecting) {
      setTimeout(() => e.target.classList.add('visible'), 100);
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });
revealEls.forEach(el => observer.observe(el));

/* ═══════════════════════════════════════
   BEFORE/AFTER SLIDER
═══════════════════════════════════════ */
const container = document.getElementById('compareContainer');
const handle = document.getElementById('compareHandle');
const afterEl = document.getElementById('compareAfter');
let isDragging = false;

function setCompare(x) {
  const rect = container.getBoundingClientRect();
  let pct = Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100));
  handle.style.left = pct + '%';
  afterEl.style.clipPath = `inset(0 0 0 ${pct}%)`;
}
container.addEventListener('mousedown', e => { isDragging = true; setCompare(e.clientX); });
container.addEventListener('touchstart', e => { isDragging = true; setCompare(e.touches[0].clientX); }, {passive:true});
document.addEventListener('mousemove', e => { if (isDragging) setCompare(e.clientX); });
document.addEventListener('touchmove', e => { if (isDragging) setCompare(e.touches[0].clientX); }, {passive:true});
document.addEventListener('mouseup', () => isDragging = false);
document.addEventListener('touchend', () => isDragging = false);

/* ═══════════════════════════════════════
   PROJECT FILTER
═══════════════════════════════════════ */
const filterBtns = document.querySelectorAll('.filter-btn');
const projectCards = document.querySelectorAll('.project-card');
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const f = btn.dataset.filter;
    projectCards.forEach(card => {
      const match = f === 'all' || card.dataset.cat === f;
      card.style.display = match ? 'block' : 'none';
      if (match) { card.style.animation = 'none'; card.offsetHeight; card.style.animation = 'fadeIn 0.4s ease'; }
    });
  });
});

/* ═══════════════════════════════════════
   TESTIMONIALS SLIDER
═══════════════════════════════════════ */
const tTrack = document.getElementById('testimonialTrack');
const tCards = tTrack.querySelectorAll('.testimonial-card');
const tDotsEl = document.getElementById('tDots');
let tIdx = 0;
const tTotal = tCards.length;

// Build dots
tCards.forEach((_, i) => {
  const dot = document.createElement('div');
  dot.className = 't-dot' + (i === 0 ? ' active' : '');
  dot.addEventListener('click', () => goTo(i));
  tDotsEl.appendChild(dot);
});

function goTo(i) {
  tIdx = (i + tTotal) % tTotal;
  tTrack.style.transform = `translateX(-${tIdx * 100}%)`;
  document.querySelectorAll('.t-dot').forEach((d, j) => d.classList.toggle('active', j === tIdx));
}
document.getElementById('tPrev').addEventListener('click', () => goTo(tIdx - 1));
document.getElementById('tNext').addEventListener('click', () => goTo(tIdx + 1));

// Auto-advance
setInterval(() => goTo(tIdx + 1), 5000);

/* ═══════════════════════════════════════
   GALLERY SLIDER
═══════════════════════════════════════ */
const gTrack = document.getElementById('galleryTrack');
const gItems = gTrack.querySelectorAll('.gallery-item');
const gFill = document.getElementById('galleryFill');
const ITEM_W = 396; // 380 + 16 gap
let gIdx = 0;
const gMax = gItems.length - 1;

function galleryGo(dir) {
  gIdx = Math.max(0, Math.min(gMax - 2, gIdx + dir));
  gTrack.style.transform = `translateX(-${gIdx * ITEM_W}px)`;
  gFill.style.width = ((gIdx + 1) / gItems.length * 100) + '%';
}
document.getElementById('gPrev').addEventListener('click', () => galleryGo(-1));
document.getElementById('gNext').addEventListener('click', () => galleryGo(1));

// Auto-play gallery
let gAutoPlay = setInterval(() => galleryGo(1), 3000);
gTrack.addEventListener('mouseenter', () => clearInterval(gAutoPlay));
gTrack.addEventListener('mouseleave', () => { gAutoPlay = setInterval(() => galleryGo(1), 3000); });

// Touch swipe for gallery
let gTouchX = 0;
gTrack.addEventListener('touchstart', e => { gTouchX = e.touches[0].clientX; }, {passive:true});
gTrack.addEventListener('touchend', e => {
  const dx = gTouchX - e.changedTouches[0].clientX;
  if (Math.abs(dx) > 50) galleryGo(dx > 0 ? 1 : -1);
});

/* ═══════════════════════════════════════
   CONTACT FORM
═══════════════════════════════════════ */
function submitForm() {
  const name = document.getElementById('fname').value.trim();
  const phone = document.getElementById('fphone').value.trim();
  const email = document.getElementById('femail').value.trim();
  const type = document.getElementById('ftype').value;
  const budget = document.getElementById('fbudget').value;
  const msg = document.getElementById('fmessage').value.trim();

  if (!name || !phone || !email) { 
    alert('Please fill in your name, phone, and email.'); return; 
  }

  const btn = document.getElementById('submitBtn');
  btn.textContent = 'Sending...'; btn.classList.add('sending');

  // Simulate API call (replace with actual backend/EmailJS/Firebase)
  setTimeout(() => {
    console.log('Form data:', { name, phone, email, type, budget, msg });
    document.getElementById('contactForm').style.display = 'none';
    document.getElementById('formSuccess').classList.add('show');
  }, 1800);
}

/* ═══════════════════════════════════════
   NUMBER COUNTER ANIMATION
═══════════════════════════════════════ */
function animateNum(el, target, suffix) {
  let start = 0; const dur = 2000; const step = 16;
  const inc = target / (dur / step);
  const timer = setInterval(() => {
    start = Math.min(start + inc, target);
    el.textContent = Math.round(start) + suffix;
    if (start >= target) clearInterval(timer);
  }, step);
}

const statObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.querySelectorAll('.about-stat-num, .stat-num').forEach(el => {
        const t = parseInt(el.textContent); const s = el.textContent.includes('+') ? '+' : (el.textContent.includes('%') ? '%' : '');
        animateNum(el, t, s);
      });
      statObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.3 });
document.querySelectorAll('.about-stats, .hero-stat-bar').forEach(el => statObserver.observe(el));

/* ═══════════════════════════════════════
   SMOOTH ANCHOR SCROLL
═══════════════════════════════════════ */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id === '#') return;
    const el = document.querySelector(id);
    if (el) {
      e.preventDefault();
      el.scrollIntoView({ behavior: 'smooth' });
    }
  });
});
