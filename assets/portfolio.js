// Vanta Stock Scores · fictional portfolio builder.
// Everything stays in the visitor's browser (localStorage) or in a share link; nothing is sent anywhere.
(function () {
  const root = document.getElementById('pf'); if (!root) return;
  const IDX = window.VANTA_INDEX || [], P = window.VANTA_P || [];
  // IDX row: [name, slug, score, industry, country, penny, upside, zone]
  // P row (same order): [t1, t2, t3, plus, pegPts, upPts, revPts, fpe, chg52, currency, logo, darkTile]
  const S = new Map();
  IDX.forEach((r, i) => {
    const p = P[i] || [];
    S.set(r[1], { name: r[0], slug: r[1], score: r[2], ind: r[3], ctry: r[4], penny: !!r[5], up: r[6], zone: !!r[7],
      t1: p[0] || 0, t2: p[1] || 0, t3: p[2] || 0, plus: p[3] || 0, adj: (p[4] || 0) + (p[5] || 0) + (p[6] || 0),
      fpe: p[7], chg: p[8], cur: p[9] || '', logo: p[10] || '', dark: !!p[11] });
  });
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const band = v => v >= 70 ? 'hi' : v >= 50 ? 'mid' : 'lo';
  const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const pct = (v, d = 1) => (v * 100).toFixed(d) + '%';
  const spct = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v * 100).toFixed(d) + '%';
  const dkk = v => Math.round(v).toLocaleString('en-GB') + ' DKK';
  const MAX = 40, KEY = 'vanta-portfolio', NORDIC = ['Denmark', 'Sweden', 'Norway', 'Finland'];
  const allAvg = IDX.reduce((a, r) => a + r[2], 0) / (IDX.length || 1);

  // ---------- state ----------
  let st = { cap: 100000, h: [] }, fromLink = false;
  const valid = h => h.filter(x => S.has(x.slug)).slice(0, MAX).map(x => ({ slug: x.slug, w: Math.max(0, Math.min(100, Math.round(+x.w || 0))) }));
  function readHash() {
    const m = location.hash.match(/p=([^&]+)/); if (!m) return null;
    const h = m[1].split('.').map(t => { const [slug, w] = t.split('~'); return { slug, w: w === undefined ? 50 : +w }; });
    const c = location.hash.match(/c=(\d+)/);
    return { cap: c ? Math.min(1e9, +c[1]) : 100000, h: valid(h) };
  }
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && Array.isArray(s.h)) st = { cap: +s.cap || 100000, h: valid(s.h) }; } catch (e) { /* storage off: start empty */ }
  const linked = readHash();
  let prev = null;
  if (linked && linked.h.length) {
    if (st.h.length && JSON.stringify(st.h) !== JSON.stringify(linked.h)) { prev = st; try { localStorage.setItem(KEY + '-prev', JSON.stringify(st)); } catch (e) { /* ignore */ } }
    st = linked; fromLink = true; history.replaceState(null, '', location.pathname);
  }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* private mode */ } };

  // ---------- starting points ----------
  const pick = rows => rows.map(r => ({ slug: r[1], w: 50 }));
  const templates = {
    top10: () => pick(IDX.slice(0, 10)),
    zone: () => pick(IDX.filter(r => r[7]).slice(0, 15)),
    nordic: () => pick(IDX.filter(r => NORDIC.includes(r[4])).slice(0, 10)),
    spread: () => { const seen = new Set(); return pick(IDX.filter(r => !seen.has(r[3]) && seen.add(r[3]))); },
    clear: () => []
  };
  document.querySelectorAll('[data-tpl]').forEach(b => b.addEventListener('click', () => {
    const t = b.dataset.tpl;
    if (st.h.length && t !== 'clear' && !confirm('Replace the current holdings with this starting point?')) return;
    if (t === 'clear' && st.h.length && !confirm('Remove all holdings?')) return;
    st.h = templates[t](); fromLink = false; renderRows(); update();
  }));

  // ---------- add a stock ----------
  const q = $('pf-q'), res = $('pf-res');
  let hits = [], cur = -1;
  function find(s) {
    s = fold(s.trim()); if (!s) return [];
    const have = new Set(st.h.map(x => x.slug)), out = [];
    for (const r of IDX) { const n = fold(r[0]); if (have.has(r[1])) continue; const k = n.startsWith(s) ? 2 : n.includes(s) ? 1 : fold(r[3] + ' ' + r[4]).includes(s) ? 0 : -1; if (k >= 0) out.push([k, r]); }
    return out.sort((a, b) => b[0] - a[0] || b[1][2] - a[1][2]).slice(0, 8).map(x => x[1]);
  }
  function showRes() {
    hits = find(q.value); cur = hits.length ? 0 : -1;
    if (!q.value.trim()) { res.hidden = true; q.setAttribute('aria-expanded', 'false'); return; }
    res.innerHTML = hits.length ? hits.map((r, i) => `<li role="option" id="pf-o${i}" aria-selected="${i === cur}"><button type="button" data-slug="${r[1]}"><span class="gs-n">${esc(r[0])}<small>${esc(r[3])} · ${esc(r[4])}</small></span><span class="sb ${band(r[2])} num">${r[2]}</span></button></li>`).join('')
      : `<li class="gs-none">No match, or it is already in the portfolio.</li>`;
    res.hidden = false; q.setAttribute('aria-expanded', 'true');
  }
  function add(slug) {
    if (!S.has(slug) || st.h.some(x => x.slug === slug)) return;
    if (st.h.length >= MAX) { say(`The builder holds up to ${MAX} stocks.`); return; }
    st.h.push({ slug, w: 50 }); q.value = ''; res.hidden = true; renderRows(); update(); say(`${S.get(slug).name} added.`);
  }
  q.addEventListener('input', showRes);
  q.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' && hits.length) { cur = (cur + 1) % hits.length; e.preventDefault(); }
    else if (e.key === 'ArrowUp' && hits.length) { cur = (cur - 1 + hits.length) % hits.length; e.preventDefault(); }
    else if (e.key === 'Enter') { if (hits[cur]) add(hits[cur][1]); e.preventDefault(); return; }
    else if (e.key === 'Escape') { res.hidden = true; return; } else return;
    [...res.querySelectorAll('li[role=option]')].forEach((li, i) => li.setAttribute('aria-selected', String(i === cur)));
  });
  res.addEventListener('click', e => { const b = e.target.closest('button[data-slug]'); if (b) add(b.dataset.slug); });
  document.addEventListener('click', e => { if (!e.target.closest('.pf-add')) res.hidden = true; });

  // ---------- holdings ----------
  const list = $('pf-list'), cap = $('pf-cap'), live = $('pf-live');
  const say = t => { live.textContent = ''; setTimeout(() => { live.textContent = t; }, 30); };
  cap.value = st.cap;
  cap.addEventListener('input', () => { st.cap = Math.max(0, Math.min(1e9, Math.round(+cap.value || 0))); update(); });
  function weights() {
    const sum = st.h.reduce((a, x) => a + x.w, 0);
    return st.h.map(x => sum > 0 ? x.w / sum : 1 / st.h.length);
  }
  function logo(s) {
    if (!s.logo) return `<span class="lg ini" aria-hidden="true">${esc(s.name[0])}</span>`;
    return `<span class="lg${s.dark ? ' dk' : ''}"><img src="logos/${esc(s.logo)}" alt="" loading="lazy" decoding="async"></span>`;
  }
  function renderRows() {
    $('pf-empty').hidden = st.h.length > 0;
    list.innerHTML = st.h.map(x => {
      const s = S.get(x.slug);
      return `<li class="pf-row" data-slug="${s.slug}">${logo(s)}<span class="pf-who"><a href="stocks/${s.slug}.html">${esc(s.name)}</a><small>${esc(s.ind)} · ${esc(s.ctry)}${s.penny ? ' · <span class="tag">Penny</span>' : ''}</small></span><span class="sb ${band(s.score)} num">${s.score}</span>`
        + `<input type="range" min="0" max="100" step="1" value="${x.w}" aria-label="Weight of ${esc(s.name)}"><span class="pf-val"><span class="pf-pct num"></span><span class="pf-amt num"></span></span>`
        + `<button type="button" class="pf-del" aria-label="Remove ${esc(s.name)}"></button></li>`;
    }).join('');
  }
  list.addEventListener('input', e => {
    if (e.target.type !== 'range') return;
    const slug = e.target.closest('.pf-row').dataset.slug, h = st.h.find(x => x.slug === slug);
    if (h) { h.w = +e.target.value; update(); }
  });
  list.addEventListener('click', e => {
    const b = e.target.closest('.pf-del'); if (!b) return;
    const row = b.closest('.pf-row'), slug = row.dataset.slug, next = row.nextElementSibling || row.previousElementSibling;
    st.h = st.h.filter(x => x.slug !== slug); renderRows(); update(); say(`${S.get(slug).name} removed.`);
    const f = next && list.querySelector(`.pf-row[data-slug="${next.dataset.slug}"] .pf-del`); (f || q).focus();
  });
  $('pf-equal').addEventListener('click', () => { st.h.forEach(x => { x.w = 50; }); renderRows(); update(); say('All holdings set to equal weight.'); });
  $('pf-byscore').addEventListener('click', () => { st.h.forEach(x => { x.w = Math.max(1, Math.round(S.get(x.slug).score)); }); renderRows(); update(); say('Weights set in proportion to the Vanta score.'); });

  // ---------- report ----------
  const bars = (el, rows, total) => {
    el.innerHTML = rows.map(([k, v]) => `<li><span class="k">${esc(k)}</span><span class="track"><i style="width:${(v / total * 100).toFixed(1)}%"></i></span><span class="v num">${pct(v, 0)}</span></li>`).join('');
  };
  function groupBy(fn, w) {
    const m = new Map(); st.h.forEach((x, i) => { const k = fn(S.get(x.slug)); m.set(k, (m.get(k) || 0) + w[i]); });
    let rows = [...m.entries()].sort((a, b) => b[1] - a[1]);
    if (rows.length > 7) { const rest = rows.slice(6).reduce((a, r) => a + r[1], 0); rows = rows.slice(0, 6).concat([[`${m.size - 6} others`, rest]]); }
    return { rows, top: rows[0], size: m.size };
  }
  function update() {
    save();
    const n = st.h.length, w = weights(), has = n > 0;
    root.classList.toggle('is-empty', !has);
    // rows: percentage and fictional amount
    [...list.children].forEach((li, i) => { li.querySelector('.pf-pct').textContent = pct(w[i]); li.querySelector('.pf-amt').textContent = dkk(w[i] * st.cap); });
    $('pf-count').textContent = n ? `${n} holding${n === 1 ? '' : 's'} · ${dkk(st.cap)} fictional` : 'No holdings yet';
    const H = st.h.map((x, i) => ({ s: S.get(x.slug), w: w[i] }));
    const sum = f => H.reduce((a, x) => a + x.w * f(x.s), 0);
    const cover = f => { const sub = H.filter(x => f(x.s)); const ws = sub.reduce((a, x) => a + x.w, 0); return { sub, ws }; };
    // weighted score
    const score = has ? sum(s => s.score) : 0, sc = $('pf-score');
    sc.textContent = has ? score.toFixed(1) : '–'; sc.className = 'num ' + (has ? band(score) : '');
    $('pf-vs').textContent = has ? `${score >= allAvg ? 'Above' : 'Below'} the average of all ${IDX.length} stocks (${allAvg.toFixed(1)}).` : `Add stocks to see the weighted score. All ${IDX.length} stocks average ${allAvg.toFixed(1)}.`;
    $('pf-bar-score').textContent = has ? score.toFixed(0) : '–'; $('pf-bar-n').textContent = n ? `${n} holding${n === 1 ? '' : 's'}` : '';
    $('pf-bar').hidden = !has;
    // holdings on the 1–100 scale, dot size by weight
    $('pf-dots').innerHTML = H.map(x => `<i class="${band(x.s.score)}" style="left:${Math.max(1, Math.min(100, x.s.score))}%;width:${(8 + x.w * 40).toFixed(1)}px;height:${(8 + x.w * 40).toFixed(1)}px" title="${esc(x.s.name)}: ${x.s.score}, ${pct(x.w)}"></i>`).join('') + (has ? `<b style="left:${score}%"></b>` : '');
    // key numbers
    const up = cover(s => s.up !== null && s.up !== undefined), fp = cover(s => s.fpe > 0), ch = cover(s => s.chg !== null && s.chg !== undefined);
    const wUp = up.ws ? up.sub.reduce((a, x) => a + x.w * x.s.up, 0) / up.ws : null;
    const hPe = fp.ws ? fp.ws / fp.sub.reduce((a, x) => a + x.w / x.s.fpe, 0) : null;
    const wCh = ch.ws ? ch.sub.reduce((a, x) => a + x.w * x.s.chg, 0) / ch.ws : null;
    const eff = has ? 1 / w.reduce((a, v) => a + v * v, 0) : 0, maxW = has ? Math.max(...w) : 0, maxH = has ? H[w.indexOf(maxW)].s.name : '';
    const facts = [
      ['Holdings', has ? `${n}` : '–', has ? `acts like ${eff.toFixed(1)} equal positions` : ''],
      ['Largest position', has ? pct(maxW) : '–', maxH],
      ['Upside to analyst targets', wUp === null ? '–' : spct(wUp), up.ws && up.ws < 0.999 ? `covers ${pct(up.ws, 0)} of the money` : 'weighted median targets'],
      ['In the 70+ zone', has ? pct(sum(s => s.zone ? 1 : 0), 0) : '–', 'score above 70, upside above 20%'],
      ['Scoring below 50', has ? pct(sum(s => s.score < 50 ? 1 : 0), 0) : '–', 'share of the money'],
      ['Penny stocks', has ? pct(sum(s => s.penny ? 1 : 0), 0) : '–', 'under DKK 3 a share'],
      ['Forward P/E', hPe === null ? '–' : hPe.toFixed(1), 'weighted harmonic mean'],
      ['Last 52 weeks', wCh === null ? '–' : spct(wCh), 'price change, own currencies']
    ];
    $('pf-facts').innerHTML = facts.map(f => `<div><dt>${f[0]}</dt><dd class="num">${f[1]}</dd>${f[2] ? `<small>${esc(f[2])}</small>` : ''}</div>`).join('');
    // where the points go (weighted)
    const steps = [['Business', -sum(s => s.t1), 30], ['Price', -sum(s => s.t2), 35], ['Cracks', -sum(s => s.t3), 35], ['Plus', sum(s => s.plus), 15], ['Data adjustments', sum(s => s.adj), 30]];
    $('pf-steps').innerHTML = has ? steps.map(([k, v, mx]) => `<li><span class="k">${k}</span><span class="track ${v < 0 ? 'neg' : 'pos'}"><i style="width:${Math.min(100, Math.abs(v) / mx * 100).toFixed(1)}%"></i></span><span class="v num ${v < 0 ? 'neg' : v > 0 ? 'pos' : ''}">${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(1)}</span></li>`).join('') : '';
    // breakdowns
    const gi = groupBy(s => s.ind, w), gc = groupBy(s => s.ctry, w), gu = groupBy(s => s.cur.toUpperCase() === 'GBX' || s.cur === 'GBp' ? 'GBP' : s.cur, w);
    bars($('pf-ind'), has ? gi.rows : [], 1); bars($('pf-ctry'), has ? gc.rows : [], 1); bars($('pf-cur'), has ? gu.rows : [], 1);
    // checks: observations, not advice
    const C = [];
    if (has) {
      if (n < 5) C.push(['warn', `Only ${n} holding${n === 1 ? '' : 's'}: news from one company moves the whole portfolio.`]);
      if (maxW > 0.2) C.push(['warn', `${maxH} is ${pct(maxW, 1)} of the portfolio, above 20%.`]); else if (n >= 5) C.push(['ok', 'No single holding is above 20%.']);
      if (gi.top[1] > 0.35) C.push(['warn', `${pct(gi.top[1], 0)} sits in one industry: ${gi.top[0]}.`]); else if (gi.size >= 4) C.push(['ok', `Spread over ${gi.size} industries; none above 35%.`]);
      if (gc.top[1] > 0.6 && gc.size > 0) C.push(['info', `${pct(gc.top[1], 0)} is in one country: ${gc.top[0]}.`]);
      const nonDkk = H.filter(x => x.s.cur !== 'DKK').reduce((a, x) => a + x.w, 0);
      if (nonDkk > 0.5) C.push(['info', `${pct(nonDkk, 0)} is priced in other currencies than DKK, so exchange rates move the value too.`]);
      const pn = sum(s => s.penny ? 1 : 0); if (pn > 0.1) C.push(['warn', `${pct(pn, 0)} is in penny stocks, which often lose money and dilute shareholders.`]);
      const low = H.filter(x => x.s.score < 50); if (low.length) C.push(['warn', `${low.length} holding${low.length === 1 ? '' : 's'} score below 50: ${low.slice(0, 3).map(x => x.s.name).join(', ')}${low.length > 3 ? '…' : ''}.`]);
      if (score >= 70) C.push(['ok', 'The weighted Vanta score is 70 or above.']);
      if (up.ws && up.ws < 0.999) C.push(['info', `${pct(1 - up.ws, 0)} of the money is in stocks without an analyst target.`]);
    }
    $('pf-checks').innerHTML = C.map(c => `<li class="${c[0]}">${esc(c[1])}</li>`).join('');
    $('pf-share').disabled = $('pf-csv').disabled = !has;
  }

  // ---------- share and export ----------
  $('pf-share').addEventListener('click', async () => {
    const url = location.origin + location.pathname + '#p=' + st.h.map(x => x.slug + '~' + x.w).join('.') + '&c=' + st.cap;
    try { await navigator.clipboard.writeText(url); say('Share link copied.'); $('pf-share-out').textContent = 'Link copied. Anyone who opens it sees this portfolio.'; }
    catch (e) { $('pf-share-out').innerHTML = `Copy this link: <input type="text" readonly value="${esc(url)}" aria-label="Share link">`; $('pf-share-out').querySelector('input').select(); }
  });
  $('pf-csv').addEventListener('click', () => {
    const w = weights(), cell = v => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [['Company', 'Industry', 'Country', 'Currency', 'Vanta score', 'Weight %', 'Amount DKK (fictional)', 'Upside to median target %']]
      .concat(st.h.map((x, i) => { const s = S.get(x.slug); return [s.name, s.ind, s.ctry, s.cur, s.score, (w[i] * 100).toFixed(2), Math.round(w[i] * st.cap), s.up === null || s.up === undefined ? '' : (s.up * 100).toFixed(1)]; }));
    const blob = new Blob(['﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'vanta-fictional-portfolio.csv' });
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  });

  renderRows(); update();
  if (fromLink) {
    say('Loaded a shared portfolio. Changes are saved in this browser only.');
    const out = $('pf-share-out'); out.textContent = 'You opened a shared portfolio. Your changes stay in this browser. ';
    if (prev) { const b = Object.assign(document.createElement('button'), { type: 'button', className: 'linkbtn', textContent: 'Bring back my previous portfolio' }); b.addEventListener('click', () => { st = prev; cap.value = st.cap; renderRows(); update(); out.textContent = 'Your previous portfolio is back.'; }); out.append(b); }
  }
  root.classList.add('ready');
})();
