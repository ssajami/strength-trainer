// ─── State ───────────────────────────────────────────────────────────────────
let currentProgram = null;
let currentWeek    = 1;
let maxLoadQueue   = [];
let maxLoadResolve = null;

// ─── DOM helpers ─────────────────────────────────────────────────────────────
const $     = id => document.getElementById(id);
const show  = el => el.classList.remove('hidden');
const hide  = el => el.classList.add('hidden');

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
  window.scrollTo(0, 0);
}

// ─── Toast ───────────────────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  $('toast-container').appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 3800);
}

// ─── Settings ────────────────────────────────────────────────────────────────
function openSettings() {
  const p = Storage.getProfile();
  $('setting-api-key').value    = p.apiKey    || '';
  $('setting-age').value        = p.age       || 55;
  $('setting-bodyweight').value = p.bodyweight || 65;
  renderMaxLoadsList();
  show($('settings-modal'));
}

function closeSettings() {
  hide($('settings-modal'));
}

function saveSettings() {
  Storage.saveProfile({
    apiKey:     $('setting-api-key').value.trim(),
    age:        parseInt($('setting-age').value)        || 55,
    bodyweight: parseFloat($('setting-bodyweight').value) || 65,
  });
  persistMaxLoadsFromForm();
  toast('Settings saved', 'success');
  closeSettings();
}

function renderMaxLoadsList() {
  const container = $('max-loads-list');
  container.innerHTML = '';
  Object.entries(Storage.getMaxLoads()).forEach(([mv, kg]) => {
    container.appendChild(makeMaxLoadRow(mv, kg));
  });
}

function makeMaxLoadRow(movement = '', kg = '') {
  const row = document.createElement('div');
  row.className = 'max-load-row';
  row.innerHTML = `
    <input type="text"   class="ml-name" placeholder="Movement (e.g. deadlift)" value="${movement}">
    <input type="number" class="ml-kg"   placeholder="kg" min="0" step="0.5"      value="${kg}">
    <button class="icon-btn-sm remove-ml" title="Remove">✕</button>
  `;
  row.querySelector('.remove-ml').onclick = () => row.remove();
  return row;
}

function persistMaxLoadsFromForm() {
  const loads = {};
  document.querySelectorAll('.max-load-row').forEach(row => {
    const name = row.querySelector('.ml-name').value.trim().toLowerCase();
    const kg   = parseFloat(row.querySelector('.ml-kg').value);
    if (name && !isNaN(kg) && kg > 0) loads[name] = kg;
  });
  Storage.saveMaxLoads(loads);
}

// ─── Max load prompt flow ────────────────────────────────────────────────────
function collectMissingMaxMovements(program) {
  const saved   = Storage.getMaxLoads();
  const missing = new Set();
  (program.sessions || []).forEach(s =>
    (s.strength || []).forEach(e => {
      if (e.percentOfMax !== null) {
        const key = e.movement.toLowerCase().trim();
        if (!saved[key]) missing.add(e.movement);
      }
    })
  );
  return [...missing];
}

function promptNextMaxLoad() {
  if (!maxLoadQueue.length) {
    maxLoadResolve = null;
    if (currentProgram) renderProgramView();
    return;
  }
  const movement = maxLoadQueue.shift();
  $('ml-modal-title').textContent = `Enter 1RM for: ${movement}`;
  $('ml-modal-desc').textContent  =
    `This program uses "${movement}" at percentage-based loads. ` +
    `Enter your 1-rep max (or recent best × 1.05 as an estimate) so working weights can be calculated.`;
  $('ml-modal-input').value = '';
  show($('max-load-modal'));
  setTimeout(() => $('ml-modal-input').focus(), 50);

  maxLoadResolve = () => {
    const kg = parseFloat($('ml-modal-input').value);
    if (!isNaN(kg) && kg > 0) Storage.setMaxLoad(movement, kg);
    hide($('max-load-modal'));
    promptNextMaxLoad();
  };
}

// ─── Load resolution ─────────────────────────────────────────────────────────
function resolveLoad(movement, pct) {
  if (pct === null || pct === undefined) return null;
  const max = Storage.getMaxLoad(movement);
  if (!max) return `${pct}%  ·  (save your 1RM to see kg)`;
  const actual = Math.round((max * pct / 100) / 2.5) * 2.5;
  return `${actual} kg  (${pct}% of ${max} kg)`;
}

// ─── Program generation ───────────────────────────────────────────────────────
async function handleGenerate() {
  const profile = Storage.getProfile();
  if (!profile.apiKey) {
    toast('Add your Anthropic API key in Settings first', 'error');
    openSettings();
    return;
  }
  const startDate = $('start-date').value;
  if (!startDate) { toast('Please pick a start date', 'error'); return; }

  const params = {
    profile,
    maxLoads:        Storage.getMaxLoads(),
    previousProgram: Storage.getCurrentProgram(),
    comments:        $('previous-comments').value.trim(),
    weeks:           parseInt($('program-weeks').value),
    progressionModel: $('progression-model').value,
    startDate,
  };

  if (params.comments) Storage.saveLastComments(params.comments);

  show($('loading-overlay'));
  $('generate-btn').disabled = true;

  try {
    const program = await ProgramGen.generate(params);
    Storage.saveProgram(program);
    currentProgram = program;
    currentWeek    = 1;
    $('previous-comments').value = '';
    renderHomeSummary();

    const missing = collectMissingMaxMovements(program);
    if (missing.length) {
      maxLoadQueue = missing;
      renderProgramView();  // show program first, then prompt
      setTimeout(promptNextMaxLoad, 300);
    } else {
      renderProgramView();
    }
    toast('Program generated!', 'success');
  } catch (err) {
    console.error(err);
    toast(`Error: ${err.message}`, 'error');
  } finally {
    hide($('loading-overlay'));
    $('generate-btn').disabled = false;
  }
}

// ─── Home screen ──────────────────────────────────────────────────────────────
function renderHomeSummary() {
  const prog = Storage.getCurrentProgram();
  const card = $('current-program-card');
  if (!prog) { hide(card); return; }
  show(card);
  $('home-prog-name').textContent  = prog.programName;
  $('home-prog-model').textContent = `${prog.progressionModel} · ${prog.weeks} weeks · from ${fmtDate(prog.startDate)}`;
}

// ─── Program view ─────────────────────────────────────────────────────────────
function renderProgramView() {
  if (!currentProgram) return;
  $('prog-name').textContent  = currentProgram.programName;
  $('prog-meta').textContent  =
    `${currentProgram.weeks} weeks · starts ${fmtDate(currentProgram.startDate)}`;
  $('prog-model').textContent =
    `${currentProgram.progressionModel}: ${currentProgram.progressionJustification}`;
  if (currentProgram.weeklyVolumeNotes) {
    $('prog-volume').textContent = currentProgram.weeklyVolumeNotes;
    show($('prog-volume'));
  }
  renderWeek(currentWeek);
  showScreen('program-screen');
}

function renderWeek(week) {
  currentWeek = week;
  $('week-label').textContent = `Week ${week} of ${currentProgram.weeks}`;
  $('prev-week-btn').disabled = week <= 1;
  $('next-week-btn').disabled = week >= currentProgram.weeks;

  const container = $('sessions-list');
  container.innerHTML = '';
  const sessions = currentProgram.sessions.filter(s => s.week === week);
  if (!sessions.length) {
    container.innerHTML = '<p class="muted tc">No sessions for this week.</p>';
    return;
  }
  sessions.forEach(s => container.appendChild(makeSessionCard(s)));
}

function makeSessionCard(session) {
  const totalSets = (session.strength || []).reduce((n, e) => n + (e.sets || 0), 0);
  const card = document.createElement('div');
  card.className = 'session-card card';

  const preview = (session.strength || []).slice(0, 3).map(e => {
    const load = e.percentOfMax !== null ? resolveLoad(e.movement, e.percentOfMax) : null;
    return `<div class="preview-row">
      <span class="preview-name">${e.movement}${e.isUnilateral ? ' <em>(unilateral)</em>' : ''}</span>
      <span class="preview-rx">${e.sets}×${e.reps}${load ? ` @ ${load}` : ''}</span>
    </div>`;
  }).join('');

  const more = session.strength.length > 3
    ? `<p class="more-hint">+${session.strength.length - 3} more exercises</p>` : '';

  card.innerHTML = `
    <div class="card-top">
      <div>
        <h3 class="session-label">${session.label}</h3>
        <span class="focus-chip">${session.focus}</span>
      </div>
      <span class="day-badge">${session.suggestedDay}</span>
    </div>
    <div class="session-stats">
      <span>${session.strength.length} exercises · ${totalSets} sets</span>
      <span class="metcon-chip">${session.metcon.format || 'Metcon'} ${session.metcon.timeMinutes} min</span>
    </div>
    <div class="strength-preview">${preview}${more}</div>
    <button class="btn btn-primary btn-sm open-session-btn" data-id="${session.sessionNumber}">
      View full session →
    </button>
  `;
  card.querySelector('.open-session-btn').addEventListener('click', () =>
    renderSessionDetail(session)
  );
  return card;
}

// ─── Session detail ───────────────────────────────────────────────────────────
function renderSessionDetail(session) {
  $('session-title').textContent = session.label;
  const root = $('session-detail');
  root.innerHTML = '';

  root.appendChild(badge(session.focus, 'focus-badge'));

  if (session.warmup?.length)   root.appendChild(mkSection('🔥 Warm-Up',           renderWarmup(session.warmup)));
  if (session.strength?.length) root.appendChild(mkSection('💪 Strength',           renderStrength(session.strength)));
  root.appendChild(mkSection('⚡ Metcon',          renderMetcon(session.metcon)));
  if (session.mobility?.length) root.appendChild(mkSection('🧘 Mobility & Cooldown', renderMobility(session.mobility)));

  showScreen('session-screen');
}

function badge(text, cls) {
  const el = document.createElement('div');
  el.className = cls;
  el.textContent = text;
  return el;
}

function mkSection(title, content) {
  const sec = document.createElement('div');
  sec.className = 'session-section';
  const h = document.createElement('h3');
  h.className = 'section-title';
  h.textContent = title;
  sec.appendChild(h);
  sec.appendChild(content);
  return sec;
}

function renderWarmup(items) {
  const wrap = document.createElement('div');
  wrap.className = 'item-list';
  items.forEach(it => {
    const el = document.createElement('div');
    el.className = 'item-row warmup-row';
    const detail = [it.duration, it.reps != null ? `${it.reps} reps` : null].filter(Boolean).join(' · ');
    el.innerHTML = `
      <div class="item-name">${it.name}</div>
      ${detail ? `<div class="item-meta">${detail}</div>` : ''}
      ${it.notes ? `<div class="item-notes">${it.notes}</div>` : ''}
    `;
    wrap.appendChild(el);
  });
  return wrap;
}

function renderStrength(items) {
  const wrap = document.createElement('div');
  wrap.className = 'item-list';
  items.forEach((ex, i) => {
    const load = ex.percentOfMax !== null ? resolveLoad(ex.movement, ex.percentOfMax) : null;
    const el = document.createElement('div');
    el.className = 'item-row strength-row';
    el.innerHTML = `
      <div class="ex-number">${i + 1}</div>
      <div class="ex-body">
        <div class="ex-name">
          ${ex.movement}
          ${ex.isUnilateral ? '<span class="pill pill-uni">Unilateral</span>' : ''}
          <span class="pill pill-cat">${ex.category}</span>
        </div>
        <div class="ex-rx">
          <strong>${ex.sets} sets × ${ex.reps} reps</strong>
          ${load ? `<span class="load-val">${load}</span>` : ''}
        </div>
        ${ex.coachingNotes ? `<div class="coaching-notes">${ex.coachingNotes}</div>` : ''}
      </div>
    `;
    wrap.appendChild(el);
  });
  return wrap;
}

function renderMetcon(m) {
  const el = document.createElement('div');
  el.className = 'metcon-block';

  const movRows = (m.movements || []).map(mv => {
    const qty = [
      mv.reps     ? `${mv.reps} reps`   : null,
      mv.calories ? `${mv.calories} cal` : null,
      mv.distance || null,
    ].filter(Boolean).join('/');
    const right = [qty, mv.load].filter(Boolean).join(' @ ');
    return `<div class="metcon-row">
      <span class="metcon-mv-name">${mv.name}</span>
      ${right ? `<span class="metcon-mv-rx">${right}</span>` : ''}
      ${mv.notes ? `<span class="metcon-mv-note">${mv.notes}</span>` : ''}
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="metcon-header">
      <span class="metcon-name">${m.name}</span>
      <span class="metcon-format">${m.format} · ${m.timeMinutes} min</span>
    </div>
    <p class="metcon-desc">${m.description}</p>
    <div class="metcon-movements">${movRows}</div>
  `;
  return el;
}

function renderMobility(items) {
  const wrap = document.createElement('div');
  wrap.className = 'item-list';
  items.forEach(it => {
    const el = document.createElement('div');
    el.className = 'item-row mobility-row';
    el.innerHTML = `
      <div class="item-name">${it.name}</div>
      <div class="item-meta">${it.duration}</div>
      ${it.notes ? `<div class="item-notes">${it.notes}</div>` : ''}
    `;
    wrap.appendChild(el);
  });
  return wrap;
}

// ─── HTML Export ─────────────────────────────────────────────────────────────
function exportToHTML() {
  if (!currentProgram) return;
  const loads = Storage.getMaxLoads();

  function rl(movement, pct) {
    if (pct == null) return null;
    const max = loads[movement.toLowerCase().trim()];
    if (!max) return `${pct}%`;
    const kg = Math.round((max * pct / 100) / 2.5) * 2.5;
    return `${kg} kg <span class="pct">(${pct}% of ${max} kg)</span>`;
  }

  const sessionHTML = currentProgram.sessions.map(s => {
    const warmupRows = (s.warmup || []).map(w => {
      const detail = [w.duration, w.reps != null ? `${w.reps} reps` : null].filter(Boolean).join(' · ');
      return `<li><strong>${w.name}</strong>${detail ? ` — ${detail}` : ''}${w.notes ? `<br><span class="note">${w.notes}</span>` : ''}</li>`;
    }).join('');

    const strengthRows = (s.strength || []).map((e, i) => {
      const loadStr = rl(e.movement, e.percentOfMax);
      return `<div class="ex">
        <div class="ex-num">${i + 1}</div>
        <div class="ex-detail">
          <div class="ex-name">${e.movement}${e.isUnilateral ? ' <span class="tag">Unilateral</span>' : ''} <span class="tag cat">${e.category}</span></div>
          <div class="ex-rx">${e.sets} sets × ${e.reps} reps${loadStr ? ` &nbsp;·&nbsp; <strong class="load">${loadStr}</strong>` : ''}</div>
          ${e.coachingNotes ? `<div class="note">${e.coachingNotes}</div>` : ''}
        </div>
      </div>`;
    }).join('');

    const metconMoves = (s.metcon.movements || []).map(m => {
      const qty = [m.reps ? `${m.reps} reps` : null, m.calories ? `${m.calories} cal` : null, m.distance || null].filter(Boolean).join('/');
      const right = [qty, m.load].filter(Boolean).join(' @ ');
      return `<li><strong>${m.name}</strong>${right ? ` — ${right}` : ''}${m.notes ? `<br><span class="note">${m.notes}</span>` : ''}</li>`;
    }).join('');

    const mobilityRows = (s.mobility || []).map(m =>
      `<li><strong>${m.name}</strong> — ${m.duration}${m.notes ? `<br><span class="note">${m.notes}</span>` : ''}</li>`
    ).join('');

    return `<details class="session" open>
      <summary>
        <span class="s-label">${s.label}</span>
        <span class="s-focus">${s.focus}</span>
        <span class="s-day">${s.suggestedDay}</span>
      </summary>
      <div class="s-body">
        ${warmupRows ? `<section class="sec warmup-sec"><h3>🔥 Warm-Up</h3><ul>${warmupRows}</ul></section>` : ''}
        ${strengthRows ? `<section class="sec strength-sec"><h3>💪 Strength</h3><div class="ex-list">${strengthRows}</div></section>` : ''}
        <section class="sec metcon-sec">
          <h3>⚡ Metcon</h3>
          <div class="metcon-header-row"><strong>${s.metcon.name}</strong> <span class="m-format">${s.metcon.format} · ${s.metcon.timeMinutes} min</span></div>
          <p class="metcon-desc">${s.metcon.description}</p>
          ${metconMoves ? `<ul>${metconMoves}</ul>` : ''}
        </section>
        ${mobilityRows ? `<section class="sec mobility-sec"><h3>🧘 Mobility & Cooldown</h3><ul>${mobilityRows}</ul></section>` : ''}
      </div>
    </details>`;
  }).join('');

  // Group sessions by week for the nav/headings
  const weeks = [...new Set(currentProgram.sessions.map(s => s.week))].sort((a, b) => a - b);
  const byWeek = weeks.map(w => {
    const sessions = currentProgram.sessions.filter(s => s.week === w);
    const firstLabel = sessions[0]?.label || '';
    const weekDate = firstLabel.match(/starting (.+)$/)?.[1] || `Week ${w}`;
    const sessionsHTML = sessions.map(s => {
      const warmupRows = (s.warmup || []).map(w => {
        const detail = [w.duration, w.reps != null ? `${w.reps} reps` : null].filter(Boolean).join(' · ');
        return `<li><strong>${w.name}</strong>${detail ? ` — ${detail}` : ''}${w.notes ? `<br><span class="note">${w.notes}</span>` : ''}</li>`;
      }).join('');

      const strengthRows = (s.strength || []).map((e, i) => {
        const loadStr = rl(e.movement, e.percentOfMax);
        return `<div class="ex">
          <div class="ex-num">${i + 1}</div>
          <div class="ex-detail">
            <div class="ex-name">${e.movement}${e.isUnilateral ? ' <span class="tag">Unilateral</span>' : ''} <span class="tag cat">${e.category}</span></div>
            <div class="ex-rx">${e.sets} sets × ${e.reps} reps${loadStr ? ` &nbsp;·&nbsp; <strong class="load">${loadStr}</strong>` : ''}</div>
            ${e.coachingNotes ? `<div class="note">${e.coachingNotes}</div>` : ''}
          </div>
        </div>`;
      }).join('');

      const metconMoves = (s.metcon.movements || []).map(m => {
        const qty = [m.reps ? `${m.reps} reps` : null, m.calories ? `${m.calories} cal` : null, m.distance || null].filter(Boolean).join('/');
        const right = [qty, m.load].filter(Boolean).join(' @ ');
        return `<li><strong>${m.name}</strong>${right ? ` — ${right}` : ''}${m.notes ? `<br><span class="note">${m.notes}</span>` : ''}</li>`;
      }).join('');

      const mobilityRows = (s.mobility || []).map(m =>
        `<li><strong>${m.name}</strong> — ${m.duration}${m.notes ? `<br><span class="note">${m.notes}</span>` : ''}</li>`
      ).join('');

      return `<details class="session">
        <summary>
          <span class="s-label">${s.label}</span>
          <span class="s-focus">${s.focus}</span>
          <span class="s-day">${s.suggestedDay}</span>
        </summary>
        <div class="s-body">
          ${warmupRows ? `<section class="sec warmup-sec"><h3>🔥 Warm-Up</h3><ul>${warmupRows}</ul></section>` : ''}
          ${strengthRows ? `<section class="sec strength-sec"><h3>💪 Strength</h3><div class="ex-list">${strengthRows}</div></section>` : ''}
          <section class="sec metcon-sec">
            <h3>⚡ Metcon</h3>
            <div class="metcon-header-row"><strong>${s.metcon.name}</strong> <span class="m-format">${s.metcon.format} · ${s.metcon.timeMinutes} min</span></div>
            <p class="metcon-desc">${s.metcon.description}</p>
            ${metconMoves ? `<ul>${metconMoves}</ul>` : ''}
          </section>
          ${mobilityRows ? `<section class="sec mobility-sec"><h3>🧘 Mobility & Cooldown</h3><ul>${mobilityRows}</ul></section>` : ''}
        </div>
      </details>`;
    }).join('');

    return `<div class="week-block">
      <h2 class="week-heading">Week ${w} <span class="week-date">— starting ${weekDate}</span></h2>
      ${sessionsHTML}
    </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${currentProgram.programName}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --primary: #e11d48; --bg: #f1f5f9; --surface: #fff;
    --border: #e2e8f0; --text: #0f172a; --muted: #64748b;
    --warmup: #0ea5e9; --strength: #d97706; --metcon: #7c3aed; --mobility: #059669;
  }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: var(--bg); color: var(--text); font-size: 16px; line-height: 1.55;
    padding: 16px; max-width: 680px; margin: 0 auto; }
  h1 { font-size: 1.3rem; margin-bottom: 4px; }
  h2 { font-size: 1.05rem; margin-bottom: 12px; }
  h3 { font-size: .85rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: .06em; margin-bottom: 10px; }
  p  { margin-bottom: 8px; }
  ul { padding-left: 18px; }
  li { margin-bottom: 6px; font-size: .9rem; line-height: 1.45; }
  .meta  { color: var(--muted); font-size: .875rem; margin-bottom: 6px; }
  .just  { color: var(--muted); font-size: .82rem; margin-bottom: 4px; }
  .note  { color: var(--muted); font-size: .8rem; font-style: italic; }
  .pct   { color: var(--muted); font-weight: 400; font-size: .85em; }
  .load  { color: var(--primary); }
  .tag   { background: #f1f5f9; color: var(--muted); font-size: .7rem; font-weight: 700;
    padding: 1px 6px; border-radius: 100px; text-transform: capitalize; }
  .tag.cat { }
  .prog-header { background: #0f172a; color: #f8fafc; border-radius: 14px;
    padding: 20px; margin-bottom: 20px; }
  .prog-header h1 { color: #f8fafc; }
  .prog-header .meta, .prog-header .just { color: #94a3b8; }
  .week-block  { margin-bottom: 28px; }
  .week-heading { font-size: 1rem; font-weight: 800; color: #0f172a;
    border-bottom: 2px solid var(--primary); padding-bottom: 6px; margin-bottom: 14px; }
  .week-date { font-weight: 400; color: var(--muted); font-size: .88rem; }
  details.session { background: var(--surface); border-radius: 12px;
    margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,.08); overflow: hidden; }
  details.session summary {
    padding: 14px 16px; cursor: pointer; list-style: none;
    display: flex; flex-direction: column; gap: 4px;
    border-left: 4px solid var(--primary);
  }
  details.session summary::-webkit-details-marker { display: none; }
  details.session[open] summary { border-bottom: 1px solid var(--border); }
  .s-label { font-weight: 700; font-size: .95rem; }
  .s-focus { display: inline-block; background: #fef9c3; color: #854d0e;
    font-size: .72rem; font-weight: 700; padding: 2px 8px; border-radius: 100px; }
  .s-day   { color: var(--muted); font-size: .8rem; }
  .s-body  { padding: 0; }
  .sec { padding: 14px 16px; border-bottom: 1px solid var(--bg); }
  .sec:last-child { border-bottom: none; }
  .warmup-sec   h3 { color: var(--warmup);   border-left: 3px solid var(--warmup);   padding-left: 8px; }
  .strength-sec h3 { color: var(--strength); border-left: 3px solid var(--strength); padding-left: 8px; }
  .metcon-sec   h3 { color: var(--metcon);   border-left: 3px solid var(--metcon);   padding-left: 8px; }
  .mobility-sec h3 { color: var(--mobility); border-left: 3px solid var(--mobility); padding-left: 8px; }
  .ex-list { display: flex; flex-direction: column; gap: 10px; }
  .ex { display: flex; gap: 12px; align-items: flex-start; }
  .ex-num { width: 26px; height: 26px; background: var(--strength); color: #fff;
    border-radius: 50%; font-size: .78rem; font-weight: 700; display: flex;
    align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
  .ex-detail { flex: 1; }
  .ex-name { font-weight: 600; font-size: .9rem; margin-bottom: 3px;
    display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
  .ex-rx   { font-size: .875rem; margin-bottom: 3px; }
  .metcon-header-row { display: flex; justify-content: space-between; flex-wrap: wrap;
    gap: 6px; margin-bottom: 6px; align-items: baseline; }
  .metcon-header-row strong { font-size: .95rem; }
  .m-format { background: #ede9fe; color: #5b21b6; font-size: .75rem;
    font-weight: 700; padding: 2px 8px; border-radius: 100px; }
  .metcon-desc { font-size: .85rem; color: var(--muted); margin-bottom: 8px; }
  @media (max-width: 400px) { body { padding: 12px; font-size: 15px; } }
</style>
</head>
<body>
<div class="prog-header">
  <h1>${currentProgram.programName}</h1>
  <p class="meta">${currentProgram.weeks} weeks · starts ${fmtDate(currentProgram.startDate)}</p>
  <p class="just">${currentProgram.progressionModel}: ${currentProgram.progressionJustification}</p>
  ${currentProgram.weeklyVolumeNotes ? `<p class="just">${currentProgram.weeklyVolumeNotes}</p>` : ''}
</div>
${byWeek}
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const slug = currentProgram.programName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  a.href     = url;
  a.download = `${slug}.html`;
  a.click();
  URL.revokeObjectURL(url);
  toast('HTML file downloaded — open it on any device', 'success');
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function fmtDate(str) {
  if (!str) return '';
  try {
    return new Date(str + 'T12:00:00').toLocaleDateString('en-US',
      { month: 'long', day: 'numeric', year: 'numeric' });
  } catch { return str; }
}

function setDefaultStartDate() {
  const today = new Date();
  const offset = (8 - today.getDay()) % 7 || 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() + offset);
  $('start-date').value = monday.toISOString().split('T')[0];
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  setDefaultStartDate();

  currentProgram = Storage.getCurrentProgram();
  renderHomeSummary();
  if (currentProgram) show($('current-program-card'));

  // Settings
  $('settings-btn').addEventListener('click', openSettings);
  $('close-settings-btn').addEventListener('click', closeSettings);
  $('settings-overlay').addEventListener('click', closeSettings);
  $('save-settings-btn').addEventListener('click', saveSettings);
  $('add-max-load-btn').addEventListener('click', () => {
    const row = makeMaxLoadRow();
    $('max-loads-list').appendChild(row);
    row.querySelector('.ml-name').focus();
  });

  // Generate
  $('generate-btn').addEventListener('click', handleGenerate);

  // View current program from home
  $('view-current-prog-btn').addEventListener('click', () => {
    if (currentProgram) renderProgramView();
  });

  // Program screen navigation
  $('prev-week-btn').addEventListener('click',    () => { if (currentWeek > 1) renderWeek(currentWeek - 1); });
  $('next-week-btn').addEventListener('click',    () => { if (currentProgram && currentWeek < currentProgram.weeks) renderWeek(currentWeek + 1); });
  $('back-home-btn').addEventListener('click',    () => showScreen('home-screen'));
  $('export-html-btn').addEventListener('click',  exportToHTML);
  $('back-prog-btn').addEventListener('click',    () => showScreen('program-screen'));

  // Max load modal
  $('ml-save-btn').addEventListener('click',  () => { if (maxLoadResolve) maxLoadResolve(); });
  $('ml-skip-btn').addEventListener('click',  () => { hide($('max-load-modal')); promptNextMaxLoad(); });
  $('ml-modal-input').addEventListener('keydown', e => { if (e.key === 'Enter' && maxLoadResolve) maxLoadResolve(); });

  // Keyboard escape for modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      hide($('settings-modal'));
      hide($('max-load-modal'));
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
