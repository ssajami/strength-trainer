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
  $('prev-week-btn').addEventListener('click', () => { if (currentWeek > 1) renderWeek(currentWeek - 1); });
  $('next-week-btn').addEventListener('click', () => { if (currentProgram && currentWeek < currentProgram.weeks) renderWeek(currentWeek + 1); });
  $('back-home-btn').addEventListener('click',    () => showScreen('home-screen'));
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
