// Vanta Stock Scores · shared: quick search (topbar + home hero) and "open all" for findings.
(function () {
  const IDX = window.VANTA_INDEX || [];   // [name, slug, score, industry, country, penny]
  const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const rows = IDX.map(r => ({ r, n: fold(r[0]), meta: fold(r[3] + ' ' + r[4]) }));
  const band = v => v >= 70 ? 'hi' : v >= 50 ? 'mid' : 'lo';
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function find(q) {
    q = fold(q.trim()); if (!q) return [];
    const words = q.split(/\s+/);
    const scored = [];
    for (const x of rows) {
      let s = -1;
      if (x.n.startsWith(q)) s = 3;
      else if (x.n.split(/[\s\-.&]+/).some(w => w.startsWith(q))) s = 2;
      else if (x.n.includes(q)) s = 1;
      else if (words.every(w => x.n.includes(w) || x.meta.includes(w))) s = 0;
      if (s >= 0) scored.push([s, x.r]);
    }
    scored.sort((a, b) => b[0] - a[0] || b[1][2] - a[1][2]);
    return scored.slice(0, 8).map(p => p[1]);
  }

  document.querySelectorAll('.gs').forEach(box => {
    const input = box.querySelector('input'), list = box.querySelector('.gs-res'), rel = box.dataset.rel || '';
    const btn = box.querySelector('.gs-btn');
    let hits = [], cur = -1;
    const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); cur = -1; };
    const go = r => { location.href = rel + 'stocks/' + r[1] + '.html'; };
    const paint = () => [...list.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === cur)));
    function show() {
      hits = find(input.value); cur = hits.length ? 0 : -1;
      if (!input.value.trim()) { close(); return; }
      list.innerHTML = hits.length
        ? hits.map((r, i) => `<li role="option" id="${box.id || 'gs'}-o${i}"><a href="${rel}stocks/${r[1]}.html"><span class="gs-n">${esc(r[0])}${r[5] ? ' <span class="tag">Penny</span>' : ''}<small>${esc(r[3])} · ${esc(r[4])}</small></span><span class="sb ${band(r[2])} num">${r[2]}</span></a></li>`).join('')
        : `<li class="gs-none">No company called “${esc(input.value.trim())}”. <a href="${rel}rankings.html?q=${encodeURIComponent(input.value.trim())}">Search all rankings</a></li>`;
      list.hidden = false; input.setAttribute('aria-expanded', 'true'); paint();
    }
    input.addEventListener('input', show);
    input.addEventListener('focus', () => { if (input.value.trim()) show(); });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' && hits.length) { cur = (cur + 1) % hits.length; paint(); e.preventDefault(); }
      else if (e.key === 'ArrowUp' && hits.length) { cur = (cur - 1 + hits.length) % hits.length; paint(); e.preventDefault(); }
      else if (e.key === 'Enter') { if (cur >= 0 && hits[cur]) go(hits[cur]); else if (input.value.trim()) location.href = rel + 'rankings.html?q=' + encodeURIComponent(input.value.trim()); e.preventDefault(); }
      else if (e.key === 'Escape') { close(); if (box.classList.contains('open')) { box.classList.remove('open'); btn && btn.focus(); } }
    });
    document.addEventListener('click', e => { if (!box.contains(e.target)) { close(); box.classList.remove('open'); } });
    if (btn) btn.addEventListener('click', () => { box.classList.toggle('open'); if (box.classList.contains('open')) input.focus(); });
  });

  // "/" focuses the search, like most sites
  document.addEventListener('keydown', e => {
    if (e.key !== '/' || /input|select|textarea/i.test(document.activeElement.tagName)) return;
    const hero = document.querySelector('.gs.hero input'), top = document.querySelector('.topbar .gs');
    e.preventDefault();
    if (hero && hero.getBoundingClientRect().bottom > 0) { hero.focus(); return; }
    if (top) { top.classList.add('open'); top.querySelector('input').focus(); }
  });

  // sortable tables: click a header; numbers sort high→low first, text A→Z
  document.querySelectorAll('table.sortable').forEach(t => {
    if (!t.tHead || !t.tBodies[0]) return;
    const ths = [...t.tHead.rows[0].cells], body = t.tBodies[0];
    ths.forEach((th, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'th-btn';
      b.innerHTML = th.innerHTML; th.textContent = ''; th.append(b);
      b.addEventListener('click', () => {
        const text = th.dataset.t === 's';
        const cur = th.getAttribute('aria-sort');
        const first = th.dataset.asc || text ? 'ascending' : 'descending';
        const dir = cur ? (cur === 'ascending' ? 'descending' : 'ascending') : first;
        ths.forEach(x => x.removeAttribute('aria-sort')); th.setAttribute('aria-sort', dir);
        const val = r => { const v = r.cells[i].dataset.v; return text ? (v || '') : (v === '' || v == null ? NaN : parseFloat(v)); };
        const rowsArr = [...body.rows].sort((a, b) => {
          const x = val(a), y = val(b);
          if (!text) { if (isNaN(x)) return 1; if (isNaN(y)) return -1; return dir === 'ascending' ? x - y : y - x; }
          return dir === 'ascending' ? x.localeCompare(y) : y.localeCompare(x);
        });
        rowsArr.forEach(r => body.append(r));
      });
    });
  });

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastPointer = 'mouse';
  addEventListener('pointerdown', e => { lastPointer = e.pointerType; }, { capture: true, passive: true });

  // the map (home): every stock by score and upside; hover to see, click to open, filter by industry
  const map = document.getElementById('map');
  if (map && IDX.length) {
    const rel = map.dataset.rel || '', NS = 'http://www.w3.org/2000/svg';
    const X0 = -0.3, X1 = 1.0, Y0 = 10, Y1 = 100;
    let W = 960, H = 470, m = { l: 48, r: 18, t: 18, b: 46 }, svg = null;
    const sx = u => m.l + (Math.max(X0, Math.min(X1, u)) - X0) / (X1 - X0) * (W - m.l - m.r);
    const sy = s => m.t + (Y1 - Math.max(Y0, Math.min(Y1, s))) / (Y1 - Y0) * (H - m.t - m.b);
    const el = (n, a, p) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); if (p) p.append(e); return e; };
    const pct = u => (u > 0 ? '+' : u < 0 ? '−' : '') + Math.abs(u * 100).toFixed(1) + '%';
    const pts = IDX.map((r, i) => ({ r, i })).filter(p => p.r[6] !== null && p.r[6] !== undefined).sort((a, b) => a.r[2] - b.r[2]);
    // drawn at the real pixel width, so text and dots keep their size on every screen
    function draw() {
      W = Math.max(300, Math.round(map.clientWidth)); const narrow = W < 600;
      H = Math.round(narrow ? W * 0.95 : Math.min(500, W * 0.49));
      m = narrow ? { l: 34, r: 8, t: 12, b: 42 } : { l: 48, r: 18, t: 18, b: 46 };
      const step = narrow ? 4 : 2, rad = narrow ? 4 : 4.6;
      const s2 = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true', focusable: 'false' });
      const grid = el('g', { class: 'grid' }, s2), axis = el('g', { class: 'axis' }, s2);
      for (let k = -2; k <= 10; k += step) {
        const x = sx(k / 10);
        el('line', { x1: x, x2: x, y1: m.t, y2: H - m.b, style: k === 0 ? 'stroke:var(--line2)' : '' }, grid);
        el('text', { x, y: H - m.b + 18, 'text-anchor': 'middle' }, axis).textContent = (k > 0 ? '+' : '') + k * 10 + '%';
      }
      for (let s = 20; s <= 100; s += 20) {
        const y = sy(s); el('line', { x1: m.l, x2: W - m.r, y1: y, y2: y }, grid);
        el('text', { x: m.l - 8, y: y + 4, 'text-anchor': 'end' }, axis).textContent = s;
      }
      el('text', { class: 'title', x: (m.l + W - m.r) / 2, y: H - 6, 'text-anchor': 'middle' }, axis).textContent = narrow ? 'Upside to analyst target' : 'Upside to the median analyst target';
      if (!narrow) el('text', { class: 'title', x: 14, y: (m.t + H - m.b) / 2, 'text-anchor': 'middle', transform: `rotate(-90 14 ${(m.t + H - m.b) / 2})` }, axis).textContent = 'Vanta score';
      el('rect', { class: 'zone', x: sx(0.2), y: sy(100), width: W - m.r - sx(0.2), height: sy(70) - sy(100), rx: 6 }, s2);
      el('text', { class: 'zone-l', x: W - m.r - 10, y: sy(100) + 18, 'text-anchor': 'end' }, s2).textContent = '70+ ZONE';
      const dots = el('g', {}, s2), v = sel ? sel.value : '';
      pts.forEach(p => { p.c = el('circle', { class: 'dot ' + band(p.r[2]) + (v && p.r[3] !== v ? ' dim' : ''), cx: sx(p.r[6]).toFixed(1), cy: sy(p.r[2]).toFixed(1), r: rad, 'data-i': p.i }, dots); });
      if (svg) svg.replaceWith(s2); else { map.querySelector('.map-fallback')?.remove(); map.prepend(s2); }
      svg = s2;
    }
    const sel = document.getElementById('map-ind');
    draw();
    let lastW = map.clientWidth, rt = 0;
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (Math.abs(map.clientWidth - lastW) > 4) { lastW = map.clientWidth; hide(); draw(); } }, 150); });    const tip = document.createElement('div'); tip.className = 'map-tip'; tip.hidden = true; map.append(tip);
    let on = null;
    const hide = () => { if (on) on.classList.remove('on'); on = null; tip.hidden = true; };
    const show = c => {
      if (on) on.classList.remove('on'); on = c; c.classList.add('on'); c.parentNode.append(c);
      const r = IDX[+c.dataset.i], sr = svg.getBoundingClientRect(), fr = map.getBoundingClientRect(), k = sr.width / W;
      const x = sr.left - fr.left + c.cx.baseVal.value * k, y = sr.top - fr.top + c.cy.baseVal.value * k;
      tip.innerHTML = `<b>${esc(r[0])}</b><span class="row2"><span>Score <span class="num">${r[2]}</span></span><span class="num">${pct(r[6])} upside</span></span><span class="mut">${esc(r[3])} · ${esc(r[4])}</span>${lastPointer === 'touch' ? `<br><a href="${rel}stocks/${r[1]}.html">Open ${esc(r[0])}</a>` : ''}`;
      tip.hidden = false;
      tip.style.left = Math.max(100, Math.min(fr.width - 100, x)) + 'px'; tip.style.top = y + 'px';
      tip.classList.toggle('below', y < 110);
    };
    map.addEventListener('pointerover', e => { if (e.target.classList?.contains('dot') && e.pointerType !== 'touch') show(e.target); });
    map.addEventListener('pointerleave', () => { if (lastPointer !== 'touch') hide(); });
    map.addEventListener('click', e => {
      const c = e.target.classList?.contains('dot') ? e.target : null;
      if (!c) { if (!tip.contains(e.target)) hide(); return; }
      if (lastPointer === 'touch' && on !== c) { show(c); return; }
      location.href = rel + 'stocks/' + IDX[+c.dataset.i][1] + '.html';
    });
    document.addEventListener('click', e => { if (!map.contains(e.target)) hide(); });
    const note = document.getElementById('map-note'), noteDef = note ? note.textContent : '';
    if (sel) sel.addEventListener('change', () => {
      hide(); const v = sel.value; let n = 0;
      pts.forEach(p => { const dim = v && p.r[3] !== v; p.c.classList.toggle('dim', !!dim); if (!dim) n++; });
      if (note) note.textContent = v ? `${v}: ${n} stocks with an analyst target, ${pts.filter(p => p.r[3] === v && p.r[7]).length} of them in the 70+ zone.` : noteDef;
    });
  }

  // stock page: the score counts down from 100, the way every stock starts
  const big = document.querySelector('.bigscore b[data-score]');
  if (big && !reduce) {
    const target = +big.dataset.score, mk = document.querySelector('.sscale .mk');
    const run = () => {
      const D = 950, t0 = performance.now();
      if (mk) {
        const tw = mk.parentElement.getBoundingClientRect().width;
        mk.style.transition = 'none'; mk.style.transform = `translateX(calc(-50% + ${(100 - target) / 100 * tw}px))`;
        mk.getBoundingClientRect();
        mk.style.transition = `transform ${D}ms cubic-bezier(.23,1,.32,1)`; mk.style.transform = 'translateX(-50%)';
      }
      const step = now => { const p = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - p, 3); big.textContent = Math.round(100 - (100 - target) * e); if (p < 1) requestAnimationFrame(step); };
      big.textContent = '100'; requestAnimationFrame(step);
    };
    if (document.documentElement.classList.contains('intro')) setTimeout(run, 2600); else run();
  }

  // waterfall: hover or focus explains a step; clicking a step opens its findings
  document.querySelectorAll('.wf').forEach(wf => {
    const cap = document.getElementById('wf-cap'), def = cap ? cap.textContent : '';
    const cols = [...wf.querySelectorAll('button.wf-col')];
    const pick = c => { cols.forEach(x => x.classList.toggle('is-on', x === c)); if (cap) cap.textContent = c ? c.dataset.desc : def; };
    cols.forEach(c => {
      c.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') pick(c); });
      c.addEventListener('focus', () => pick(c));
      c.addEventListener('click', () => {
        if (lastPointer === 'touch' && !c.classList.contains('is-on')) { pick(c); return; }
        pick(c);
        const t = c.dataset.target && document.getElementById(c.dataset.target);
        if (t) { t.open = true; t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); }
      });
    });
    wf.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') pick(null); });
    if (!reduce && 'IntersectionObserver' in window) {
      const bars = [...wf.querySelectorAll('.wf-bar')];
      bars.forEach((b, i) => { b.style.transitionDelay = i * 70 + 'ms'; });
      wf.classList.add('pre');
      const io = new IntersectionObserver(es => {
        if (!es.some(x => x.isIntersecting)) return;
        io.disconnect(); requestAnimationFrame(() => wf.classList.remove('pre'));
        setTimeout(() => bars.forEach(b => { b.style.transitionDelay = ''; }), 1400);
      }, { threshold: 0.3 });
      io.observe(wf);
    }
  });

  // page tabs follow the section in view
  const sub = document.querySelector('.subnav');
  if (sub && 'IntersectionObserver' in window) {
    const pairs = [...sub.querySelectorAll('a[href^="#"]')].map(a => {
      const t = document.getElementById(a.getAttribute('href').slice(1));
      return t ? { a, s: t.closest('section') || t } : null;
    }).filter(Boolean);
    const vis = new Map();
    const mark = () => {
      let best = null;
      pairs.forEach(p => { if (vis.get(p.s) && (!best || p.s.getBoundingClientRect().top < best.s.getBoundingClientRect().top)) best = p; });
      if (!best) return;
      pairs.forEach(p => p.a.setAttribute('aria-current', String(p === best)));
      const a = best.a, l = a.offsetLeft - sub.offsetLeft;
      if (l < sub.scrollLeft || l + a.offsetWidth > sub.scrollLeft + sub.clientWidth) sub.scrollLeft = l - 16;
    };
    const io = new IntersectionObserver(es => { es.forEach(e => vis.set(e.target, e.isIntersecting)); mark(); }, { rootMargin: '-130px 0px -55% 0px' });
    pairs.forEach(p => io.observe(p.s));
  }

  // stock page: add to / remove from the fictional portfolio (same storage as portfolio.js)
  const addb = document.querySelector('.addp');
  if (addb) {
    const KEY = 'vanta-portfolio', msg = document.querySelector('.addp-msg'), slug = addb.dataset.slug;
    const read = () => { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s && Array.isArray(s.h) ? s : { cap: 100000, h: [] }; } catch (e) { return null; } };
    if (read()) {
      const paint = () => {
        const s = read(), yes = s.h.some(x => x.slug === slug);
        addb.textContent = yes ? 'Remove from portfolio' : 'Add to portfolio';
        addb.classList.toggle('primary', !yes);
        msg.innerHTML = s.h.length ? `<a href="../portfolio.html">Portfolio builder · ${s.h.length} holding${s.h.length === 1 ? '' : 's'}</a>` : '';
      };
      addb.hidden = false; paint();
      addb.addEventListener('click', () => {
        const s = read(), i = s.h.findIndex(x => x.slug === slug);
        if (i >= 0) s.h.splice(i, 1); else if (s.h.length < 40) s.h.push({ slug, w: 50 });
        try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage blocked */ }
        paint();
      });
      addEventListener('storage', e => { if (e.key === KEY) paint(); });
    }
  }

  // findings: open / close all groups
  document.querySelectorAll('[data-toggle-all]').forEach(b => {
    const groups = [...document.querySelectorAll(b.dataset.toggleAll)];
    const sync = () => { const all = groups.every(g => g.open); b.textContent = all ? 'Close all' : 'Open all'; b.setAttribute('aria-expanded', String(all)); };
    b.addEventListener('click', () => { const open = !groups.every(g => g.open); groups.forEach(g => g.open = open); sync(); });
    groups.forEach(g => g.addEventListener('toggle', sync)); sync();
  });
})();
