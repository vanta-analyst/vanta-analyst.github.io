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

  // findings: open / close all groups
  document.querySelectorAll('[data-toggle-all]').forEach(b => {
    const groups = [...document.querySelectorAll(b.dataset.toggleAll)];
    const sync = () => { const all = groups.every(g => g.open); b.textContent = all ? 'Close all' : 'Open all'; b.setAttribute('aria-expanded', String(all)); };
    b.addEventListener('click', () => { const open = !groups.every(g => g.open); groups.forEach(g => g.open = open); sync(); });
    groups.forEach(g => g.addEventListener('toggle', sync)); sync();
  });
})();
