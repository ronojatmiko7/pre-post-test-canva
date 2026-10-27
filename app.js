import { CONFIG } from './config.js';

const app = document.getElementById('app');

/* ------------------------------------------------------------------ helpers */

// Tiny DOM builder. It never uses innerHTML, so names and comments typed by
// participants can never inject markup.
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

function mount(node, title) {
  app.replaceChildren(node);
  if (title) document.title = `${title} · Performa`;
  window.scrollTo(0, 0);
}

function wrapStore(getStore) {
  return {
    get(k) { try { return getStore().getItem(k); } catch { return null; } },
    set(k, v) { try { getStore().setItem(k, v); } catch { /* storage blocked: the app still works */ } },
    del(k) { try { getStore().removeItem(k); } catch { /* ignore */ } },
  };
}
const local = wrapStore(() => window.localStorage);
const sess = wrapStore(() => window.sessionStorage);

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const fmt1 = (n) => (n == null ? '—' : n.toLocaleString('id-ID', { maximumFractionDigits: 1 }));
const fmtWhen = (iso) =>
  new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const signed = (n) => (n > 0 ? `+${fmt1(n)}` : fmt1(n));

class AppError extends Error {
  constructor(code) { super(code); this.code = code; }
}

const ERR = {
  notfound: 'Sesi pelatihan tidak ditemukan. Periksa kembali tautan dari fasilitator.',
  closed: 'Formulir ini belum dibuka atau sudah ditutup. Tanyakan kepada fasilitator.',
  duplicate: 'Nama ini sudah mengisi formulir yang sama. Jika ada salah ketik, minta fasilitator menghapus isian lama.',
  incomplete: 'Masih ada isian yang belum lengkap. Periksa kembali.',
  invalid: 'Isian tidak valid. Periksa nama dan jawaban Anda.',
  full: 'Kuota formulir penuh. Hubungi fasilitator.',
  auth: 'Kode fasilitator salah.',
  network: 'Tidak bisa terhubung ke server. Periksa koneksi internet lalu coba lagi.',
  server: 'Terjadi gangguan di server. Coba lagi beberapa saat.',
};

async function rpc(fn, args) {
  const headers = { 'Content-Type': 'application/json', apikey: CONFIG.key };
  if (!CONFIG.key.startsWith('sb_')) headers.Authorization = `Bearer ${CONFIG.key}`;
  let res;
  try {
    res = await fetch(`${CONFIG.url}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args) });
  } catch {
    throw new AppError('network');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (body && body.message) || '';
    throw new AppError(msg.startsWith('tt:') ? msg.slice(3) : 'server');
  }
  return body;
}

/* ------------------------------------------------------------------ shared views */

function shell(title, sub, ...content) {
  return h('div', { class: 'wrap' },
    h('header', { class: 'top' },
      h('span', { class: 'brand' }, 'PERFORMA'),
      h('span', { class: 'tag' }, 'Improving Performance')),
    h('main', {},
      h('h1', {}, title),
      sub ? h('p', { class: 'sub' }, sub) : null,
      ...content),
    h('footer', {}, 'PT Performa International Indonesia'));
}

function errorView(e, backHref) {
  return shell('Tidak dapat dibuka', null,
    h('div', { class: 'notice err', role: 'alert' }, ERR[e.code] || ERR.server),
    backHref ? h('a', { class: 'btn ghost', href: backHref }, 'Kembali') : null);
}

const loadingView = () => h('div', { class: 'wrap' }, h('p', { class: 'loading' }, 'Memuat…'));

/* ------------------------------------------------------------------ home + hub */

function home() {
  mount(shell('Pre-test, Post-test dan Evaluasi', 'Pelatihan oleh PT Performa International Indonesia',
    h('div', { class: 'notice' }, 'Buka tautan yang dibagikan fasilitator Anda. Tautan ini tidak lengkap.')),
  'Pre-test dan Evaluasi');
}

async function hub(slug) {
  mount(loadingView());
  let s;
  try { s = await rpc('tt_get_session', { p_slug: slug }); } catch (e) { return mount(errorView(e), 'Pelatihan'); }
  const base = `/s/${encodeURIComponent(s.slug)}`;
  const items = [
    { title: 'Pre-test', desc: '10 soal pilihan ganda, sekitar 5 menit. Isi sebelum pelatihan dimulai.', open: s.pre_open, href: `${base}/pre` },
    { title: 'Post-test', desc: '10 soal pilihan ganda, sekitar 5 menit. Isi setelah pelatihan selesai.', open: s.post_open, href: `${base}/post` },
    { title: 'Evaluasi pelatihan', desc: 'Penilaian materi, instruktur, dan penyelenggaraan. Sekitar 3 menit, boleh tanpa nama.', open: s.eval_open, href: `${base}/evaluasi` },
  ];
  const cards = items.map((it) => {
    const inner = [
      h('div', { class: 'row' }, h('h3', {}, it.title), h('span', { class: `pill${it.open ? ' open' : ''}` }, it.open ? 'Terbuka' : 'Belum dibuka')),
      h('p', {}, it.desc),
    ];
    return it.open
      ? h('a', { class: 'card link', href: it.href }, ...inner)
      : h('div', { class: 'card off', 'aria-disabled': 'true' }, ...inner);
  });
  mount(shell(s.title, s.client,
    h('div', { class: 'cards' }, ...cards),
    h('p', { class: 'muted' }, 'Gunakan nama yang sama di pre-test dan post-test agar kemajuan Anda bisa dibandingkan.')),
  s.title);
}

/* ------------------------------------------------------------------ pre-test / post-test */

async function testPage(slug, form) {
  mount(loadingView());
  let f;
  try { f = await rpc('tt_get_form', { p_slug: slug, p_form: form }); } catch (e) { return mount(errorView(e, `/s/${encodeURIComponent(slug)}`)); }

  const label = form === 'pre' ? 'Pre-test' : 'Post-test';
  const hubHref = `/s/${encodeURIComponent(slug)}`;
  if (!f.open) {
    return mount(shell(label, f.title, h('div', { class: 'notice' }, ERR.closed), h('a', { class: 'btn ghost', href: hubHref }, 'Kembali')), label);
  }

  const answers = {};
  const total = f.items.length;
  const startedAt = Date.now();
  let who = {};
  try { who = JSON.parse(local.get(`tt:${slug}:who`) || '{}') || {}; } catch { who = {}; }

  const nameIn = h('input', { type: 'text', id: 'f-name', autocomplete: 'name', maxlength: '100', placeholder: 'Nama lengkap', value: who.name || '' });
  const unitIn = h('input', { type: 'text', id: 'f-unit', autocomplete: 'organization-title', maxlength: '100', placeholder: 'Unit kerja', value: who.unit || '' });

  const barFill = h('div', { class: 'bar-fill' });
  const barText = h('span', { class: 'bar-text' }, `0/${total} terjawab`);
  const progress = h('div', { class: 'progress', role: 'status' }, barText, h('div', { class: 'bar' }, barFill));
  const update = () => {
    const n = Object.keys(answers).length;
    barText.textContent = `${n}/${total} terjawab`;
    barFill.style.width = `${(n / total) * 100}%`;
  };

  const qEls = f.items.map((q) => {
    const group = h('fieldset', { class: 'q', id: `q${q.no}` });
    group.append(h('legend', {}, h('span', { class: 'qno' }, q.no), h('span', {}, q.body)));
    for (const o of q.options) {
      const input = h('input', { type: 'radio', name: `q${q.no}`, value: o.key });
      const lab = h('label', { class: 'opt' }, input, h('span', { class: 'key' }, o.key), h('span', { class: 'txt' }, o.text));
      input.addEventListener('change', () => {
        answers[q.no] = o.key;
        group.classList.remove('missing');
        group.querySelectorAll('.opt').forEach((x) => x.classList.remove('sel'));
        lab.classList.add('sel');
        update();
      });
      group.append(lab);
    }
    return group;
  });

  const msg = h('div', { role: 'alert' });
  const btn = h('button', { class: 'btn', type: 'button' }, 'Kirim jawaban');
  btn.addEventListener('click', async () => {
    msg.className = ''; msg.replaceChildren();
    const fail = (text, el) => {
      msg.className = 'notice err'; msg.textContent = text;
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); if (el.focus) el.focus(); }
    };
    const name = nameIn.value.trim();
    if (name.length < 2) return fail('Isi nama lengkap Anda terlebih dahulu.', nameIn);
    const missing = f.items.filter((q) => !answers[q.no]);
    if (missing.length) {
      missing.forEach((q) => document.getElementById(`q${q.no}`).classList.add('missing'));
      return fail(`Masih ada ${missing.length} soal yang belum dijawab (ditandai merah).`, document.getElementById(`q${missing[0].no}`));
    }
    btn.disabled = true; btn.textContent = 'Mengirim…';
    try {
      const res = await rpc('tt_submit_test', {
        p_slug: slug, p_form: form, p_name: name, p_unit: unitIn.value.trim(), p_answers: answers,
        p_duration: Math.round((Date.now() - startedAt) / 1000),
      });
      local.set(`tt:${slug}:who`, JSON.stringify({ name, unit: unitIn.value.trim() }));
      mount(resultView(slug, form, label, res), `${label} selesai`);
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Kirim jawaban';
      fail(ERR[e.code] || ERR.server);
    }
  });

  const intro = form === 'pre'
    ? 'Pre-test ini memetakan pemahaman awal Anda. Ini bukan penilaian kelulusan, jadi jawab sejujurnya tanpa membuka materi.'
    : 'Gunakan nama yang sama seperti pada pre-test agar kemajuan Anda bisa dibandingkan.';

  mount(shell(label, `${f.title} · ${total} soal · sekitar 5 menit`,
    h('div', { class: 'notice' }, intro),
    h('div', { class: 'two' },
      h('div', { class: 'field' }, h('label', { for: 'f-name' }, 'Nama lengkap'), nameIn),
      h('div', { class: 'field' }, h('label', { for: 'f-unit' }, 'Unit kerja'), unitIn)),
    progress,
    ...qEls,
    msg,
    h('div', { class: 'submit-row' }, btn)),
  label);
}

function resultView(slug, form, label, res) {
  const hubHref = `/s/${encodeURIComponent(slug)}`;
  const ring = h('div', { class: 'ring' }, h('div', { class: 'ring-in' }, h('strong', {}, res.score), h('span', {}, `dari ${res.total}`)));
  ring.style.setProperty('--p', String((res.score / res.total) * 100));

  const parts = [ring];
  if (form === 'pre') {
    parts.push(h('p', {}, 'Terima kasih. Hasil ini membantu fasilitator menyesuaikan pelatihan dengan kebutuhan Anda. Silakan kembali mengikuti sesi pelatihan.'));
  } else if (res.pre_score != null) {
    const gain = res.score - res.pre_score;
    const text = gain > 0 ? `Naik ${gain} poin dari pre-test (${res.pre_score} → ${res.score})`
      : gain === 0 ? `Sama seperti pre-test (${res.pre_score} → ${res.score})`
        : `Pre-test Anda ${res.pre_score}, post-test ${res.score}`;
    parts.push(h('p', { class: `delta${gain > 0 ? ' up' : ''}` }, text));
    parts.push(h('p', {}, 'Terima kasih sudah mengikuti pelatihan. Satu langkah terakhir: isi evaluasi singkat.'));
  } else {
    parts.push(h('div', { class: 'notice' }, 'Pre-test dengan nama ini tidak ditemukan, jadi kenaikan skor belum bisa dihitung. Hasil Anda tetap tersimpan. Sampaikan ke fasilitator jika nama Anda berbeda.'));
    parts.push(h('p', {}, 'Terima kasih sudah mengikuti pelatihan. Satu langkah terakhir: isi evaluasi singkat.'));
  }
  const actions = h('div', { class: 'actions' });
  if (form === 'post') actions.append(h('a', { class: 'btn', href: `${hubHref}/evaluasi` }, 'Isi evaluasi'));
  actions.append(h('a', { class: 'btn ghost', href: hubHref }, 'Kembali ke menu'));
  return shell(`${label} terkirim`, null, h('div', { class: 'result' }, ...parts, actions));
}

/* ------------------------------------------------------------------ evaluation form */

async function evalPage(slug) {
  mount(loadingView());
  let f;
  try { f = await rpc('tt_get_form', { p_slug: slug, p_form: 'eval' }); } catch (e) { return mount(errorView(e, `/s/${encodeURIComponent(slug)}`)); }
  const hubHref = `/s/${encodeURIComponent(slug)}`;
  if (!f.open) {
    return mount(shell('Evaluasi pelatihan', f.title, h('div', { class: 'notice' }, ERR.closed), h('a', { class: 'btn ghost', href: hubHref }, 'Kembali')), 'Evaluasi');
  }

  const responses = {};
  const textInputs = {};
  const needed = f.items.filter((i) => i.required);
  const barFill = h('div', { class: 'bar-fill' });
  const barText = h('span', { class: 'bar-text' }, `0/${needed.length} terisi`);
  const progress = h('div', { class: 'progress', role: 'status' }, barText, h('div', { class: 'bar' }, barFill));
  const isFilled = (i) => (i.kind === 'text' ? (textInputs[i.no]?.value.trim() || '') !== '' : responses[i.no] != null);
  const update = () => {
    const n = needed.filter(isFilled).length;
    barText.textContent = `${n}/${needed.length} terisi`;
    barFill.style.width = `${needed.length ? (n / needed.length) * 100 : 100}%`;
  };

  const scaleItem = (it) => {
    const group = h('fieldset', { class: 'q', id: `e${it.no}` });
    group.append(h('legend', {}, h('span', { class: 'qno' }, it.no), h('span', {}, it.body)));
    const isNps = it.kind === 'nps';
    const values = isNps ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : [1, 2, 3, 4, 5];
    const row = h('div', { class: isNps ? 'nps-row' : 'seg-row' });
    for (const v of values) {
      const input = h('input', { type: 'radio', name: `e${it.no}`, value: String(v) });
      input.addEventListener('change', () => { responses[it.no] = v; group.classList.remove('missing'); update(); });
      row.append(h('label', { class: 'seg' }, input, h('span', {}, v)));
    }
    group.append(row, h('div', { class: 'ends' }, h('span', {}, isNps ? 'Tidak mungkin' : 'Sangat tidak setuju'), h('span', {}, isNps ? 'Sangat mungkin' : 'Sangat setuju')));
    return group;
  };

  const textItem = (it) => {
    const ta = h('textarea', { id: `t${it.no}`, maxlength: '1000', 'aria-label': it.body });
    ta.addEventListener('input', update);
    textInputs[it.no] = ta;
    const group = h('fieldset', { class: 'q plain', id: `e${it.no}` });
    group.append(h('legend', {}, h('span', { class: 'qno' }, it.no), h('span', {}, it.body, it.required ? '' : ' ', it.required ? null : h('span', { class: 'muted' }, '(opsional)'))), ta);
    return group;
  };

  const sections = [];
  for (const it of f.items) {
    let sec = sections.find((s) => s.name === it.section);
    if (!sec) { sec = { name: it.section, items: [] }; sections.push(sec); }
    sec.items.push(it);
  }
  const blocks = sections.flatMap((sec) => [
    h('h2', {}, sec.name),
    sec.items.some((i) => i.kind === 'scale') ? h('p', { class: 'scale-legend' }, '1 = Sangat tidak setuju · 5 = Sangat setuju') : null,
    ...sec.items.map((it) => (it.kind === 'text' ? textItem(it) : scaleItem(it))),
  ]);

  const nameIn = h('input', { type: 'text', id: 'e-name', maxlength: '100', autocomplete: 'off' });
  const unitIn = h('input', { type: 'text', id: 'e-unit', maxlength: '100', autocomplete: 'off' });
  const msg = h('div', { role: 'alert' });
  const btn = h('button', { class: 'btn', type: 'button' }, 'Kirim evaluasi');
  btn.addEventListener('click', async () => {
    msg.className = ''; msg.replaceChildren();
    const missing = needed.filter((i) => !isFilled(i));
    if (missing.length) {
      missing.forEach((i) => document.getElementById(`e${i.no}`).classList.add('missing'));
      const first = document.getElementById(`e${missing[0].no}`);
      msg.className = 'notice err'; msg.textContent = `Masih ada ${missing.length} pertanyaan wajib yang belum diisi (ditandai merah).`;
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const payload = { ...responses };
    for (const [no, ta] of Object.entries(textInputs)) if (ta.value.trim()) payload[no] = ta.value.trim();
    btn.disabled = true; btn.textContent = 'Mengirim…';
    try {
      await rpc('tt_submit_eval', { p_slug: slug, p_name: nameIn.value.trim(), p_unit: unitIn.value.trim(), p_responses: payload });
      mount(shell('Terima kasih', null,
        h('div', { class: 'notice ok' }, 'Evaluasi Anda sudah terkirim. Masukan Anda dipakai untuk memperbaiki pelatihan berikutnya.'),
        h('div', { class: 'actions' }, h('a', { class: 'btn ghost', href: hubHref }, 'Kembali ke menu'))), 'Evaluasi terkirim');
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Kirim evaluasi';
      msg.className = 'notice err'; msg.textContent = ERR[e.code] || ERR.server;
    }
  });

  mount(shell('Evaluasi pelatihan', `${f.title} · sekitar 3 menit`,
    progress,
    ...blocks,
    h('h2', {}, 'Identitas (opsional)'),
    h('p', { class: 'muted' }, 'Boleh dikosongkan. Evaluasi bisa dikirim tanpa nama.'),
    h('div', { class: 'two' },
      h('div', { class: 'field' }, h('label', { for: 'e-name' }, 'Nama'), nameIn),
      h('div', { class: 'field' }, h('label', { for: 'e-unit' }, 'Unit kerja'), unitIn)),
    msg,
    h('div', { class: 'submit-row' }, btn)),
  'Evaluasi');
}

/* ------------------------------------------------------------------ facilitator dashboard */

function adminLogin(slug, key, errorText) {
  const input = h('input', { type: 'password', id: 'pass', autocomplete: 'current-password', placeholder: 'Kode fasilitator' });
  const form = h('form', {
    onsubmit: (e) => {
      e.preventDefault();
      if (!input.value.trim()) return;
      sess.set(key, input.value.trim());
      adminPage(slug);
    },
  },
  errorText ? h('div', { class: 'notice err', role: 'alert' }, errorText) : null,
  h('div', { class: 'field' }, h('label', { for: 'pass' }, 'Kode fasilitator'), input),
  h('button', { class: 'btn', type: 'submit' }, 'Masuk'));
  return shell('Hasil pelatihan', 'Halaman khusus fasilitator', form);
}

async function adminPage(slug) {
  const key = `tt:admin:${slug}`;
  const pass = sess.get(key);
  if (!pass) return mount(adminLogin(slug, key), 'Fasilitator');
  mount(loadingView());
  try {
    const data = await rpc('tt_admin_overview', { p_slug: slug, p_pass: pass });
    renderAdmin(slug, key, pass, data);
  } catch (e) {
    if (e.code === 'auth') { sess.del(key); return mount(adminLogin(slug, key, ERR.auth), 'Fasilitator'); }
    mount(errorView(e), 'Fasilitator');
  }
}

function csvText(rows) {
  const cell = (c) => {
    let v = c == null ? '' : String(c);
    if (typeof c === 'string' && /^[=+\-@\t\r]/.test(v)) v = `'${v}`; // stop spreadsheet formula injection
    return /[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  return `﻿sep=;\r\n${rows.map((r) => r.map(cell).join(';')).join('\r\n')}`;
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = h('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function renderAdmin(slug, key, pass, data) {
  const s = data.session;
  const base = `/s/${encodeURIComponent(s.slug)}`;
  const reload = () => adminPage(slug);
  const qOf = (form) => data.questions.filter((q) => q.form === form);
  const pre = data.tests.filter((t) => t.form === 'pre');
  const post = data.tests.filter((t) => t.form === 'post');
  const maxScore = (qOf('pre').length || qOf('post').length || 10);

  // pre/post matched on the normalised name
  const preMap = new Map(pre.map((t) => [t.name_norm, t]));
  const postMap = new Map(post.map((t) => [t.name_norm, t]));
  const rows = [...new Set([...preMap.keys(), ...postMap.keys()])]
    .map((k) => ({ pre: preMap.get(k), post: postMap.get(k) }))
    .sort((a, b) => (a.pre || a.post).name.localeCompare((b.pre || b.post).name, 'id'));
  const pairs = rows.filter((r) => r.pre && r.post);
  const avgPre = mean(pre.map((t) => t.score));
  const avgPost = mean(post.map((t) => t.score));
  const avgGain = mean(pairs.map((r) => r.post.score - r.pre.score));

  // evaluation numbers
  const evalVals = (no) => data.evals.map((e) => e.responses[String(no)]).filter((v) => typeof v === 'number');
  const scaleItems = data.eval_items.filter((i) => i.kind === 'scale');
  const npsItem = data.eval_items.find((i) => i.kind === 'nps');
  const allScale = scaleItems.flatMap((i) => evalVals(i.no));
  const avgEval = mean(allScale);
  const npsVals = npsItem ? evalVals(npsItem.no) : [];
  const nps = npsVals.length
    ? Math.round(((npsVals.filter((v) => v >= 9).length - npsVals.filter((v) => v <= 6).length) / npsVals.length) * 100)
    : null;

  const msg = h('div', { role: 'status' });

  /* access switches + links */
  const flags = { pre: s.pre_open, post: s.post_open, eval: s.eval_open };
  const flagSwitch = (label, which) => {
    const input = h('input', { type: 'checkbox', checked: flags[which] });
    input.addEventListener('change', async () => {
      const want = input.checked;
      input.disabled = true; msg.className = ''; msg.replaceChildren();
      try {
        const r = await rpc('tt_admin_set_flags', {
          p_slug: slug, p_pass: pass,
          p_pre: which === 'pre' ? want : null, p_post: which === 'post' ? want : null, p_eval: which === 'eval' ? want : null,
        });
        input.checked = r[`${which}_open`];
      } catch (e) {
        input.checked = !want; msg.className = 'notice err'; msg.textContent = ERR[e.code] || ERR.server;
      }
      input.disabled = false;
    });
    return h('label', { class: 'switch' }, input, h('span', { class: 'slider' }), label);
  };
  const linkRow = (label, path) => {
    const url = `${location.origin}${path}`;
    const field = h('input', { type: 'text', readonly: true, value: url, 'aria-label': `Tautan ${label}` });
    const btn = h('button', { class: 'btn small', type: 'button' }, 'Salin');
    btn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(url); btn.textContent = 'Tersalin ✓'; } catch { field.select(); btn.textContent = 'Tekan Ctrl+C'; }
      setTimeout(() => { btn.textContent = 'Salin'; }, 1800);
    });
    return h('div', { class: 'linkrow' }, h('span', {}, label), field, btn);
  };

  /* pre vs post table */
  const gainCell = (r) => {
    if (!(r.pre && r.post)) return h('td', { class: 'n' }, '—');
    const g = r.post.score - r.pre.score;
    return h('td', { class: `n ${g > 0 ? 'up' : g < 0 ? 'down' : ''}` }, signed(g));
  };
  const compareTable = h('div', { class: 'tablewrap' }, h('table', {},
    h('thead', {}, h('tr', {}, h('th', {}, 'Nama'), h('th', {}, 'Unit kerja'), h('th', { class: 'n' }, 'Pre'), h('th', { class: 'n' }, 'Post'), h('th', { class: 'n' }, 'Selisih'))),
    h('tbody', {}, ...(rows.length ? rows.map((r) => h('tr', {},
      h('td', {}, (r.pre || r.post).name), h('td', {}, (r.pre || r.post).unit || ''),
      h('td', { class: 'n' }, r.pre ? r.pre.score : '—'), h('td', { class: 'n' }, r.post ? r.post.score : '—'), gainCell(r))) : [h('tr', {}, h('td', { colspan: '5', class: 'muted' }, 'Belum ada isian.'))]))));

  /* per-question bars */
  const pctCorrect = (form, no) => {
    const tests = form === 'pre' ? pre : post;
    const q = qOf(form).find((x) => x.no === no);
    if (!tests.length || !q) return null;
    return (tests.filter((t) => t.answers[String(no)] === q.correct).length / tests.length) * 100;
  };
  const barline = (label, pct, cls) => h('div', { class: 'barline' },
    h('span', {}, label),
    (() => { const fill = h('div', { class: `fill ${cls}` }); fill.style.width = `${pct || 0}%`; return h('div', { class: 'track' }, fill); })(),
    h('span', {}, pct == null ? '—' : `${Math.round(pct)}%`));
  const perQuestion = qOf('pre').map((q) => {
    const a = pctCorrect('pre', q.no);
    const b = pctCorrect('post', q.no);
    return h('div', { class: 'qitem' },
      h('div', { class: 'qt' }, `${q.no}. ${q.topic}`),
      h('div', { class: 'qm' }, q.slide_ref || ''),
      barline('Pre', a, a != null && a < 50 ? 'low' : ''),
      barline('Post', b, b != null && b < 60 ? 'low' : 'post'));
  });

  /* evaluation block */
  const secNames = [...new Set(scaleItems.map((i) => i.section))];
  const evalBlocks = secNames.map((name) => {
    const items = scaleItems.filter((i) => i.section === name);
    const secAvg = mean(items.flatMap((i) => evalVals(i.no)));
    return h('div', { class: 'panel' },
      h('div', { class: 'toolbar' }, h('h3', { style: null }, name), h('strong', {}, `${fmt1(secAvg)} / 5`)),
      ...items.map((i) => {
        const m = mean(evalVals(i.no));
        const fill = h('div', { class: 'fill post' }); fill.style.width = `${m ? (m / 5) * 100 : 0}%`;
        return h('div', { class: 'qitem' }, h('div', {}, `${i.no}. ${i.body}`),
          h('div', { class: 'barline' }, h('span', {}, fmt1(m)), h('div', { class: 'track' }, fill), h('span', { class: 'muted' }, `n=${evalVals(i.no).length}`)));
      }));
  });
  const textBlocks = data.eval_items.filter((i) => i.kind === 'text').map((it) => {
    const list = data.evals.filter((e) => typeof e.responses[String(it.no)] === 'string')
      .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
    return h('div', { class: 'panel' }, h('h3', {}, it.body),
      ...(list.length ? list.map((e) => h('div', { class: 'cmt' }, e.responses[String(it.no)], h('div', { class: 'who' }, e.name || 'Anonim'))) : [h('p', { class: 'muted' }, 'Belum ada jawaban.')]));
  });

  /* deletion */
  const delBtn = (kind, id) => {
    const b = h('button', { class: 'btn row-del', type: 'button' }, 'Hapus');
    let armed = false;
    b.addEventListener('click', async () => {
      if (!armed) { armed = true; b.textContent = 'Yakin?'; setTimeout(() => { armed = false; b.textContent = 'Hapus'; }, 3000); return; }
      b.disabled = true;
      try { await rpc('tt_admin_delete', { p_slug: slug, p_pass: pass, p_kind: kind, p_id: id }); reload(); } catch { b.disabled = false; b.textContent = 'Gagal'; }
    });
    return b;
  };
  const rawTests = h('div', { class: 'tablewrap' }, h('table', {},
    h('thead', {}, h('tr', {}, h('th', {}, 'Form'), h('th', {}, 'Nama'), h('th', {}, 'Unit'), h('th', { class: 'n' }, 'Skor'), h('th', {}, 'Dikirim'), h('th', {}, ''))),
    h('tbody', {}, ...data.tests.map((t) => h('tr', {}, h('td', {}, t.form === 'pre' ? 'Pre' : 'Post'), h('td', {}, t.name), h('td', {}, t.unit || ''),
      h('td', { class: 'n' }, `${t.score}/${t.total}`), h('td', {}, fmtWhen(t.submitted_at)), h('td', {}, delBtn('test', t.id)))))));
  const rawEvals = h('div', { class: 'tablewrap' }, h('table', {},
    h('thead', {}, h('tr', {}, h('th', {}, 'Nama'), h('th', {}, 'Unit'), h('th', {}, 'Dikirim'), h('th', {}, ''))),
    h('tbody', {}, ...data.evals.map((e) => h('tr', {}, h('td', {}, e.name || 'Anonim'), h('td', {}, e.unit || ''), h('td', {}, fmtWhen(e.submitted_at)), h('td', {}, delBtn('eval', e.id)))))));

  /* CSV exports */
  const qNos = qOf('pre').map((q) => q.no);
  const exportSummary = () => download(`ringkasan-pre-post-${s.slug}.csv`, csvText([
    ['Nama', 'Unit kerja', 'Pre-test', 'Post-test', 'Selisih', 'Waktu pre (detik)', 'Waktu post (detik)'],
    ...rows.map((r) => [(r.pre || r.post).name, (r.pre || r.post).unit || '', r.pre ? r.pre.score : '', r.post ? r.post.score : '',
      r.pre && r.post ? r.post.score - r.pre.score : '', r.pre?.duration_s ?? '', r.post?.duration_s ?? '']),
  ]));
  const exportAnswers = () => download(`jawaban-tes-${s.slug}.csv`, csvText([
    ['Form', 'Nama', 'Unit kerja', 'Skor', 'Total', 'Waktu (detik)', 'Dikirim', ...qNos.map((n) => `Soal ${n}`)],
    ...data.tests.map((t) => [t.form === 'pre' ? 'Pre-test' : 'Post-test', t.name, t.unit || '', t.score, t.total, t.duration_s ?? '', fmtWhen(t.submitted_at), ...qNos.map((n) => t.answers[String(n)] || '')]),
  ]));
  const exportEval = () => download(`evaluasi-${s.slug}.csv`, csvText([
    ['Dikirim', 'Nama', 'Unit kerja', ...data.eval_items.map((i) => `${i.no}. ${i.body}`)],
    ...data.evals.map((e) => [fmtWhen(e.submitted_at), e.name || '', e.unit || '', ...data.eval_items.map((i) => e.responses[String(i.no)] ?? '')]),
  ]));

  const tile = (k, v, sub) => h('div', { class: 'tile' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v), h('div', { class: 's' }, sub));

  const page = shell(s.title, `${s.client} · Dasbor fasilitator`,
    h('div', { class: 'toolbar' },
      h('a', { class: 'btn ghost small', href: base }, 'Lihat sebagai peserta'),
      h('span', {},
        h('button', { class: 'btn ghost small', type: 'button', onclick: reload }, 'Muat ulang'), ' ',
        h('button', { class: 'btn ghost small', type: 'button', onclick: () => { sess.del(key); adminPage(slug); } }, 'Keluar'))),
    msg,
    h('h2', {}, 'Akses formulir'),
    h('div', { class: 'panel' },
      h('div', { class: 'flagrow' }, flagSwitch('Pre-test dibuka', 'pre'), flagSwitch('Post-test dibuka', 'post'), flagSwitch('Evaluasi dibuka', 'eval')),
      linkRow('Menu peserta', base), linkRow('Pre-test', `${base}/pre`), linkRow('Post-test', `${base}/post`), linkRow('Evaluasi', `${base}/evaluasi`)),
    h('h2', {}, 'Ringkasan'),
    h('div', { class: 'tiles' },
      tile('Pre-test', fmt1(avgPre), `rata-rata dari ${maxScore} · ${pre.length} peserta`),
      tile('Post-test', fmt1(avgPost), `rata-rata dari ${maxScore} · ${post.length} peserta`),
      tile('Kenaikan', avgGain == null ? '—' : signed(avgGain), `rata-rata poin · ${pairs.length} peserta terpasang`),
      tile('Evaluasi', fmt1(avgEval), `rata-rata dari 5 · ${data.evals.length} responden${nps == null ? '' : ` · NPS ${nps}`}`)),
    h('h2', {}, 'Pre-test dan post-test per peserta'),
    h('p', { class: 'muted' }, 'Dipasangkan lewat nama yang sama (huruf besar-kecil dan spasi ganda diabaikan). Tanda “—” berarti belum ada pasangannya.'),
    compareTable,
    h('h2', {}, 'Penguasaan per soal'),
    h('div', { class: 'panel' }, ...perQuestion),
    h('h2', {}, 'Evaluasi pelatihan'),
    ...(data.evals.length ? [...evalBlocks,
      npsItem ? h('div', { class: 'panel' }, h('h3', {}, npsItem.body), h('p', {}, `Rata-rata ${fmt1(mean(npsVals))} dari 10 · NPS ${nps} dari ${npsVals.length} responden`)) : null,
      ...textBlocks] : [h('p', { class: 'muted' }, 'Belum ada evaluasi masuk.')]),
    h('h2', {}, 'Unduh data'),
    h('div', { class: 'actions', style: null },
      h('button', { class: 'btn small', type: 'button', onclick: exportSummary }, 'Ringkasan pre-post (CSV)'),
      h('button', { class: 'btn small', type: 'button', onclick: exportAnswers }, 'Jawaban tes (CSV)'),
      h('button', { class: 'btn small', type: 'button', onclick: exportEval }, 'Evaluasi (CSV)')),
    h('h2', {}, 'Kelola isian'),
    h('details', {}, h('summary', {}, `Isian tes (${data.tests.length})`), rawTests),
    h('details', {}, h('summary', {}, `Isian evaluasi (${data.evals.length})`), rawEvals));
  page.classList.add('wide');
  mount(page, 'Hasil pelatihan');
}

/* ------------------------------------------------------------------ router */

function route() {
  const p = location.pathname.replace(/\/+$/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (p[0] === 's' && p[1] && !p[2]) return hub(p[1]);
  if (p[0] === 's' && p[1] && (p[2] === 'pre' || p[2] === 'post')) return testPage(p[1], p[2]);
  if (p[0] === 's' && p[1] && p[2] === 'evaluasi') return evalPage(p[1]);
  if (p[0] === 'admin' && p[1]) return adminPage(p[1]);
  return home();
}

route();
