const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

// ── Theme toggle ──────────────────────────────────────────────
const themeBtn = document.getElementById('themeToggle');
const currentTheme = () =>
  document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
if (themeBtn) {
  const sync = () => themeBtn.setAttribute('aria-pressed', String(currentTheme() === 'dark'));
  sync();
  themeBtn.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    if (next === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem('theme', next); } catch (e) {}
    sync();
    // Safari keeps stale paint behind blurred/negative-z layers — nudge a repaint
    const shade = document.querySelector('.hero__shade');
    if (shade) { shade.style.opacity = '0.999'; requestAnimationFrame(() => { shade.style.opacity = ''; }); }
    window.dispatchEvent(new CustomEvent('themechange', { detail: next }));
  });
}

// ── Hero intro ────────────────────────────────────────────────
const hero = document.querySelector('.hero');
const heroReady = () => hero?.classList.add('is-ready');
requestAnimationFrame(() => requestAnimationFrame(heroReady));
setTimeout(heroReady, 300); // in case rAF is paused (e.g. page opened in a background tab)
// Once the headline has slid in, let the rotating word move outside the line box
setTimeout(() => hero?.classList.add('is-settled'), 1700);

// ── Rotating word in the headline ─────────────────────────────
(() => {
  const rotator = document.getElementById('rotator');
  if (!rotator) return;
  const words = [...rotator.querySelectorAll('em')];
  if (words.length < 2 || reduceMotion.matches) return;
  let i = 0;
  setInterval(() => {
    const current = words[i];
    i = (i + 1) % words.length;
    const next = words[i];
    current.classList.remove('is-in');
    current.classList.add('is-out');
    next.classList.remove('is-out');
    next.classList.add('is-in');
    setTimeout(() => current.classList.remove('is-out'), 700);
  }, 2600);
})();

// ── Local time (Bengaluru) ────────────────────────────────────
const clock = document.getElementById('clock');
if (clock) {
  const fmtTime = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  const tickClock = () => { clock.textContent = fmtTime.format(new Date()); };
  tickClock();
  setInterval(tickClock, 15000);
}

// ── Interactive dot grid ──────────────────────────────────────
// Dots are pushed away from the cursor on a spring, brighten and grow near it,
// and a click sends a ripple through the grid.
(() => {
  const canvas = document.getElementById('dots');
  if (!canvas || !hero) return;
  const ctx = canvas.getContext('2d');

  const GAP = 24;       // distance between dots
  const RADIUS = 180;   // cursor influence radius
  const PUSH = 28;      // max displacement near the cursor
  const DOT = 1.15;     // resting dot radius
  const RIPPLE_LIFE = 1600;
  const RIPPLE_SPEED = 0.7; // px per ms
  const TAU = Math.PI * 2;

  let dots = [];
  let W = 0, H = 0;
  let dotColor = 'rgba(10,10,10,0.17)';
  let dotRGB = '10, 10, 10';
  function readTheme() {
    const s = getComputedStyle(document.documentElement);
    dotColor = (s.getPropertyValue('--dot') || dotColor).trim();
    dotRGB = (s.getPropertyValue('--dot-rgb') || dotRGB).trim();
  }
  readTheme();
  window.addEventListener('themechange', () => { readTheme(); draw(); });
  let running = false;
  let inView = true;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0, power: 0, target: 0 };
  const ripples = [];

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cols = Math.floor(W / GAP) + 2;
    const rows = Math.floor(H / GAP) + 2;
    const offX = (W - (cols - 1) * GAP) / 2;
    const offY = (H - (rows - 1) * GAP) / 2;
    dots = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = offX + c * GAP, y = offY + r * GAP;
        dots.push({ ox: x, oy: y, x, y, vx: 0, vy: 0, glow: 0 });
      }
    }
    draw();
  }

  function step(now) {
    mouse.power += (mouse.target - mouse.power) * 0.08;
    mouse.x += (mouse.tx - mouse.x) * 0.22;
    mouse.y += (mouse.ty - mouse.y) * 0.22;

    for (let k = ripples.length - 1; k >= 0; k--) {
      if (now - ripples[k].t > RIPPLE_LIFE) ripples.splice(k, 1);
    }

    const hasMouse = mouse.power > 0.003;
    let moving = hasMouse || ripples.length > 0;
    const r2 = RADIUS * RADIUS;

    for (const d of dots) {
      let tx = d.ox, ty = d.oy, glow = 0;

      if (hasMouse) {
        const dx = d.ox - mouse.x, dy = d.oy - mouse.y;
        const dist2 = dx * dx + dy * dy;
        if (dist2 < r2) {
          const dist = Math.sqrt(dist2) || 1;
          const f = 1 - dist / RADIUS;
          const e = f * f * (3 - 2 * f) * mouse.power; // smoothstep falloff
          tx += (dx / dist) * PUSH * e;
          ty += (dy / dist) * PUSH * e;
          glow = e;
        }
      }

      for (const rp of ripples) {
        const age = now - rp.t;
        const dx = d.ox - rp.x, dy = d.oy - rp.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const band = 1 - Math.abs(dist - age * RIPPLE_SPEED) / 70;
        if (band > 0) {
          const amp = band * band * (1 - age / RIPPLE_LIFE);
          tx += (dx / dist) * 16 * amp;
          ty += (dy / dist) * 16 * amp;
          glow = Math.max(glow, amp * 0.9);
        }
      }

      // Spring toward target
      d.vx = (d.vx + (tx - d.x) * 0.14) * 0.76;
      d.vy = (d.vy + (ty - d.y) * 0.14) * 0.76;
      d.x += d.vx;
      d.y += d.vy;
      d.glow += (glow - d.glow) * 0.2;

      if (!moving && (Math.abs(d.vx) + Math.abs(d.vy) > 0.02 || d.glow > 0.01)) moving = true;
    }
    return moving;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Resting dots in one batch
    ctx.fillStyle = dotColor;
    ctx.beginPath();
    for (const d of dots) {
      if (d.glow < 0.03) {
        ctx.moveTo(d.x + DOT, d.y);
        ctx.arc(d.x, d.y, DOT, 0, TAU);
      }
    }
    ctx.fill();

    // Active dots: stronger and larger the closer the cursor gets
    for (const d of dots) {
      if (d.glow >= 0.03) {
        const g = Math.min(d.glow, 1);
        ctx.fillStyle = `rgba(${dotRGB},${(0.16 + g * 0.84).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, DOT + g * 1.7, 0, TAU);
        ctx.fill();
      }
    }
  }

  function frame(now) {
    const moving = step(now);
    draw();
    if (moving && inView) requestAnimationFrame(frame);
    else running = false;
  }

  function kick() {
    if (running || !inView || reduceMotion.matches) return;
    running = true;
    requestAnimationFrame(frame);
  }

  function local(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  hero.addEventListener('pointermove', e => {
    const p = local(e);
    mouse.tx = p.x;
    mouse.ty = p.y;
    if (mouse.power < 0.05) { mouse.x = p.x; mouse.y = p.y; }
    mouse.target = 1;
    kick();
  });
  const release = () => { mouse.target = 0; kick(); };
  hero.addEventListener('pointerleave', release);
  hero.addEventListener('pointercancel', release);
  hero.addEventListener('pointerdown', e => {
    const p = local(e);
    ripples.push({ x: p.x, y: p.y, t: performance.now() });
    kick();
  });

  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView) kick();
  }).observe(hero);

  let resizeQueued = false;
  new ResizeObserver(() => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => { resizeQueued = false; resize(); });
  }).observe(canvas);

  resize();

  // A gentle intro ripple so the grid feels alive before anyone hovers
  setTimeout(() => {
    ripples.push({ x: W * 0.62, y: H * 0.45, t: performance.now() });
    kick();
  }, 700);
})();

// ── Magnetic buttons ──────────────────────────────────────────
document.querySelectorAll('[data-magnetic]').forEach(el => {
  el.addEventListener('pointermove', e => {
    if (!finePointer.matches || reduceMotion.matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) * 0.18;
    const y = (e.clientY - r.top - r.height / 2) * 0.3;
    el.style.translate = `${x}px ${y}px`;
  });
  el.addEventListener('pointerleave', () => { el.style.translate = ''; });
});

// ── Copy email ────────────────────────────────────────────────
document.querySelectorAll('[data-copy]').forEach(btn => {
  let timer;
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      btn.classList.add('is-copied');
      clearTimeout(timer);
      timer = setTimeout(() => btn.classList.remove('is-copied'), 1800);
    } catch {
      window.location.href = `mailto:${btn.dataset.copy}`;
    }
  });
});

// ── Scroll reveal ─────────────────────────────────────────────
const revealObs = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-in');
    revealObs.unobserve(entry.target);
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal-up').forEach(el => revealObs.observe(el));

// ── Metric counters ───────────────────────────────────────────
function countUp(el) {
  const end = parseFloat(el.dataset.count);
  const pre = el.dataset.prefix || '';
  const suf = el.dataset.suffix || '';
  if (reduceMotion.matches || !end) return;
  // Keep the exact figure: same decimals and thousands separator as the HTML (45.9%, 1,000)
  const decimals = (el.dataset.count.split('.')[1] || '').length;
  const fmt = new Intl.NumberFormat('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const start = performance.now();
  const dur = 1300;
  const tick = now => {
    const p = Math.min((now - start) / dur, 1);
    el.textContent = pre + fmt.format(p < 1 ? end * (1 - Math.pow(1 - p, 3)) : end) + suf;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
const countObs = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.querySelectorAll('[data-count]').forEach(countUp);
    countObs.unobserve(entry.target);
  });
}, { threshold: 0.8 });
document.querySelectorAll('.metrics, .result, .hero__stats').forEach(el => countObs.observe(el));

// ── Project cards: spotlight, parallax, cursor label ─────────
(() => {
  const chip = document.querySelector('.cursor-chip');
  const chipText = chip?.querySelector('.cursor-chip__text');
  const pos = { x: 0, y: 0, tx: 0, ty: 0 };
  let chipRaf = null;

  function moveChip() {
    pos.x += (pos.tx - pos.x) * 0.22;
    pos.y += (pos.ty - pos.y) * 0.22;
    chip.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
    chipRaf = Math.abs(pos.tx - pos.x) + Math.abs(pos.ty - pos.y) > 0.2 ? requestAnimationFrame(moveChip) : null;
  }

  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('pointerenter', e => {
      if (!chip || !finePointer.matches || !card.dataset.cursor) return;
      chip.style.setProperty('--chip-bg', getComputedStyle(card).getPropertyValue('--accent'));
      if (chipText) chipText.textContent = card.dataset.cursor || 'View';
      if (!chip.classList.contains('is-on')) {
        pos.x = pos.tx = e.clientX;
        pos.y = pos.ty = e.clientY;
        chip.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
      }
      chip.classList.add('is-on');
    });

    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      card.style.setProperty('--mx', `${x}px`);
      card.style.setProperty('--my', `${y}px`);
      if (!reduceMotion.matches) {
        card.style.setProperty('--nx', (x / r.width - 0.5).toFixed(3));
        card.style.setProperty('--ny', (y / r.height - 0.5).toFixed(3));
      }
      if (chip && finePointer.matches) {
        pos.tx = e.clientX;
        pos.ty = e.clientY;
        if (!chipRaf) chipRaf = requestAnimationFrame(moveChip);
      }
    });

    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--nx', 0);
      card.style.setProperty('--ny', 0);
      chip?.classList.remove('is-on');
    });
  });
})();
