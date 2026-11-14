// ── Reading progress ──────────────────────────────────────────
(() => {
  const bar = document.getElementById('progressBar');
  if (!bar) return;
  let ticking = false;
  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
    bar.style.width = `${(pct * 100).toFixed(2)}%`;
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();
})();

// ── Section nav: highlight the section you're reading ─────────
(() => {
  const toc = document.getElementById('toc');
  if (!toc) return;
  const links = [...toc.querySelectorAll('a:not([hidden])')];
  const sections = links
    .map(link => ({ link, el: document.querySelector(link.getAttribute('href')) }))
    .filter(item => item.el && !item.el.hidden);
  if (!sections.length) return;

  const setActive = link => {
    links.forEach(l => {
      const on = l === link;
      l.classList.toggle('is-active', on);
      if (on) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current');
    });
    // keep the active chip in view on the mobile strip
    if (toc.scrollWidth > toc.clientWidth) {
      const r = link.getBoundingClientRect(), t = toc.getBoundingClientRect();
      if (r.left < t.left + 8 || r.right > t.right - 8) {
        toc.scrollTo({ left: link.offsetLeft - 16, behavior: 'smooth' });
      }
    }
  };

  let ticking = false;
  const pick = () => {
    const line = window.scrollY + window.innerHeight * 0.3;
    let current = sections[0];
    for (const item of sections) {
      if (item.el.offsetTop <= line) current = item;
    }
    // at the very bottom, the last section wins
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      current = sections[sections.length - 1];
    }
    setActive(current.link);
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(pick); }
  }, { passive: true });
  pick();
})();
