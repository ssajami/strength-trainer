// ─── State ───────────────────────────────────────────────────────────────────
let currentProgram = null;
let currentWeek    = 1;
let maxLoadQueue   = [];
let maxLoadResolve = null;
let chatProgramId  = null;

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

// ─── Error banner ────────────────────────────────────────────────────────────
function showError(msg) {
  const existing = document.getElementById('error-banner');
  if (existing) existing.remove();
  const banner = document.createElement('div');
  banner.id = 'error-banner';
  banner.className = 'error-banner';
  banner.innerHTML = `<span class="error-banner-msg">Error: ${msg}</span><button class="error-banner-close" aria-label="Dismiss">✕</button>`;
  banner.querySelector('.error-banner-close').onclick = () => banner.remove();
  document.querySelector('main').prepend(banner);
}

// ─── Settings ────────────────────────────────────────────────────────────────
function openSettings() {
  const p = Storage.getProfile();
  $('setting-api-key').value    = p.apiKey       || '';
  $('setting-age').value        = p.age          || 55;
  $('setting-bodyweight').value = p.bodyweight   || 65;
  $('setting-set-min').value    = p.weeklySetMin ?? 9;
  $('setting-set-max').value    = p.weeklySetMax ?? 12;
  renderMaxLoadsList();
  show($('settings-modal'));
}

function closeSettings() {
  hide($('settings-modal'));
}

function clearAllData() {
  if (!confirm('Delete all programs, max loads, and settings?\n\nThis cannot be undone.')) return;
  ['spt_profile','spt_max_loads','spt_accessory_loads','spt_programs','spt_last_comments'].forEach(k => localStorage.removeItem(k));
  currentProgram = null;
  closeSettings();
  hide($('current-program-card'));
  $('previous-comments').value = '';
  showScreen('home-screen');
  toast('All data cleared', 'success');
}

function saveSettings() {
  Storage.saveProfile({
    apiKey:       $('setting-api-key').value.trim(),
    age:          parseInt($('setting-age').value)          || 55,
    bodyweight:   parseFloat($('setting-bodyweight').value) || 65,
    weeklySetMin: parseInt($('setting-set-min').value)      || 9,
    weeklySetMax: parseInt($('setting-set-max').value)      || 12,
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
    maxLoads:         Storage.getMaxLoads(),
    accessoryLoads:   Storage.getAccessoryLoads(),
    previousProgram:  Storage.getCurrentProgram(),
    comments:         $('previous-comments').value.trim(),
    weeks:            parseInt($('program-weeks').value),
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
    showError(err.message);
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
  $('prog-name').textContent = currentProgram.programName;
  $('prog-meta').textContent =
    `${currentProgram.progressionModel} · ${currentProgram.weeks} weeks · starts ${fmtDate(currentProgram.startDate)}`;
  renderWeek(currentWeek);
  showScreen('program-screen');
}

function renderVolumeAudit() {
  const el = $('volume-audit');
  if (!el || !currentProgram) return;

  // ── Session load breakdown (computed from actual session data) ──────────────
  const weekSessions = currentProgram.sessions.filter(s => s.week === currentWeek);
  const sessionLoads = weekSessions.map((s, i) => {
    const sum = (...types) => (s.strength || []).filter(e => types.includes(e.type)).reduce((n, e) => n + (e.sets || 0), 0);
    const primary   = sum('primary', 'main');
    const secondary = sum('secondary');
    const accessory = sum('accessory');
    const total  = primary + secondary + accessory;
    const secAcc = secondary + accessory;
    return { label: s.suggestedDay || `Session ${i + 1}`, primary, secondary, accessory, total, secAcc, flagged: secAcc > 15 };
  });
  const anyLoadFlagged = sessionLoads.some(s => s.flagged);
  const loadRows = sessionLoads.map(s => `
    <tr class="${s.flagged ? 'audit-fail' : ''}">
      <td>${s.label}</td>
      <td>${s.primary}</td>
      <td>${s.secondary}</td>
      <td>${s.accessory}</td>
      <td><strong>${s.total}</strong></td>
      <td class="audit-flag-cell">${s.flagged ? `⚠ Sec+Acc = ${s.secAcc}` : ''}</td>
    </tr>`).join('');

  // ── Muscle group volume — fully client-computed ────────────────────────────
  const TARGETS = [
    { cat: 'GLUTES_HAMSTRINGS',   label: '10–12', min: 10, max: 12 },
    { cat: 'UPPER_BACK_ERECTORS', label: '8–10',  min: 8,  max: 10 },
    { cat: 'QUAD_DOMINANT',       label: '8–10',  min: 8,  max: 10 },
    { cat: 'PUSH',                label: '6–8',   min: 6,  max: 8  },
    { cat: 'VERTICAL_PULL',       label: '6–8',   min: 6,  max: 8  },
    { cat: 'UNILATERAL_LOWER',    label: '6/leg', min: 6,  max: null },
    { cat: 'CORE',                label: '4–6',   min: 4,  max: 6  },
    { cat: 'CARRIES_LOADED',      label: '1–2×',  min: 1,  max: 2, presence: true },
  ];

  // Per-session set counts by category.
  // CORE and UNILATERAL_LOWER count all tiers; everything else counts primary + secondary only.
  const ALL_TIERS = new Set(['CORE', 'UNILATERAL_LOWER']);
  const catSets = {};
  weekSessions.forEach((s, si) => {
    (s.strength || []).forEach(e => {
      const cat = e.category;
      if (!cat) return;
      if (!ALL_TIERS.has(cat) && !['primary', 'main', 'secondary'].includes(e.type)) return;
      if (!catSets[cat]) catSets[cat] = Array(weekSessions.length).fill(0);
      catSets[cat][si] += (e.sets || 0);
    });
    // Carries: count presence across all tiers
    if ((s.strength || []).some(e => e.category === 'CARRIES_LOADED')) {
      if (!catSets['CARRIES_LOADED']) catSets['CARRIES_LOADED'] = Array(weekSessions.length).fill(0);
      catSets['CARRIES_LOADED'][si] = 1;
    }
  });

  const groupRows = TARGETS.map(t => {
    const breakdown = catSets[t.cat] || Array(weekSessions.length).fill(0);
    const total = breakdown.reduce((n, x) => n + x, 0);
    const meetsTarget = total >= t.min;
    const overMax = t.max !== null && total > t.max;
    const bad  = !meetsTarget;
    const warn = overMax && !bad;
    const flag = bad  ? `${total} of ${t.min} required`
               : warn ? `${total} exceeds max ${t.max}`
               : '';
    const bdStr = `<span class="audit-breakdown">${breakdown.join(' / ')}</span>`;
    const setDisplay = t.presence
      ? (total >= 1 ? `✓ present ${bdStr}` : `✗ missing`)
      : `${total} ${bdStr}`;
    return `<tr class="${bad ? 'audit-fail' : warn ? 'audit-warn' : ''}">
      <td>${catLabel(t.cat)}</td>
      <td>${t.label}</td>
      <td>${setDisplay}</td>
      <td>${meetsTarget ? '✓' : '✗'}</td>
      <td class="audit-flag-cell">${flag}</td>
    </tr>`;
  }).join('');

  const flaggedGroupCount = TARGETS.filter(t => {
    const total = (catSets[t.cat] || []).reduce((n, x) => n + x, 0);
    return total < t.min || (t.max !== null && total > t.max);
  }).length;
  const totalFlags = (anyLoadFlagged ? 1 : 0) + flaggedGroupCount;
  const badgeTxt = totalFlags
    ? `<span class="audit-badge audit-badge-warn">${totalFlags} flag${totalFlags > 1 ? 's' : ''}</span>`
    : '<span class="audit-badge audit-badge-ok">all targets met</span>';

  el.innerHTML = `
    <details class="audit-details"${totalFlags ? ' open' : ''}>
      <summary class="audit-summary">Volume audit ${badgeTxt}</summary>

      <p class="audit-section-label">Session load — Week ${currentWeek}</p>
      <table class="audit-table">
        <thead><tr><th>Session</th><th>Primary</th><th>Secondary</th><th>Accessory</th><th>Total</th><th>Flag</th></tr></thead>
        <tbody>${loadRows}</tbody>
      </table>

      ${groupRows ? `
      <p class="audit-section-label">Weekly volume by muscle group</p>
      <table class="audit-table">
        <thead><tr><th>Muscle group</th><th>Target</th><th>Sets (S1/S2/S3)</th><th>Met?</th><th>Flag</th></tr></thead>
        <tbody>${groupRows}</tbody>
      </table>` : ''}
    </details>`;
}

const ALL_TIERS_CATS = new Set(['CORE', 'UNILATERAL_LOWER']);

function calcWeekVolume(sessions) {
  const totals = {};
  sessions.forEach(s => {
    (s.strength || []).forEach(e => {
      const cat = e.category || 'other';
      if (!ALL_TIERS_CATS.has(cat) && !['primary', 'main', 'secondary'].includes(e.type)) return;
      totals[cat] = (totals[cat] || 0) + (e.sets || 0);
    });
    if ((s.strength || []).some(e => e.category === 'CARRIES_LOADED'))
      totals['CARRIES_LOADED'] = (totals['CARRIES_LOADED'] || 0) + 1;
  });
  return totals;
}

const CAT_LABELS = {
  GLUTES_HAMSTRINGS:   'Glutes & Hamstrings',
  UPPER_BACK_ERECTORS: 'Upper Back / Erectors',
  QUAD_DOMINANT:       'Quad Dominant',
  PUSH:                'Push',
  VERTICAL_PULL:       'Vertical Pull',
  UNILATERAL_LOWER:    'Unilateral Lower',
  CORE:                'Core',
  CARRIES_LOADED:      'Carries',
  ROTATOR_CUFF:        'Rotator Cuff',
  GRIP:                'Grip',
  BALANCE:             'Balance',
  PLYOMETRIC:          'Plyometric',
};

function catLabel(cat) {
  return CAT_LABELS[cat] || cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function capFirst(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

function renderWeek(week) {
  currentWeek = week;
  $('week-label').textContent = `Week ${week} of ${currentProgram.weeks}`;
  $('prev-week-btn').disabled = week <= 1;
  $('next-week-btn').disabled = week >= currentProgram.weeks;
  renderVolumeAudit();

  const sessions = currentProgram.sessions.filter(s => s.week === week);

  const summary = $('week-volume-summary');
  summary.innerHTML = '';
  const volume = calcWeekVolume(sessions);
  Object.entries(volume)
    .sort(([, a], [, b]) => b - a)
    .forEach(([cat, sets]) => {
      const chip = document.createElement('span');
      chip.className = 'vol-chip';
      chip.textContent = `${catLabel(cat)}: ${sets} sets`;
      summary.appendChild(chip);
    });

  const container = $('sessions-list');
  container.innerHTML = '';
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

  const primaryMove    = (session.strength || []).find(e => e.type === 'primary' || e.type === 'main');
  const secondaryMoves = (session.strength || []).filter(e => e.type === 'secondary');
  const accCount     = (session.strength || []).filter(e => e.type === 'accessory').length;

  const makePreviewRow = (e, cls = '') => {
    const load = e.percentOfMax !== null ? resolveLoad(e.movement, e.percentOfMax) : null;
    return `<div class="preview-row${cls ? ' ' + cls : ''}">
      <span class="preview-name">${e.movement}${e.isUnilateral ? ' <em>(unilateral)</em>' : ''}</span>
      <span class="preview-rx">${e.sets}×${e.reps}${load ? ` @ ${load}` : ''}</span>
    </div>`;
  };

  const primaryBlock = primaryMove ? `
    <p class="preview-tier-label preview-tier-primary">Primary</p>
    ${makePreviewRow(primaryMove, 'preview-primary')}` : '';

  const secondaryBlock = secondaryMoves.length ? `
    <p class="preview-tier-label preview-tier-secondary">Secondary</p>
    ${secondaryMoves.map(e => makePreviewRow(e, 'preview-secondary')).join('')}` : '';

  const accessoryBlock = accCount > 0 ? `
    <p class="preview-tier-label preview-tier-acc">Accessory</p>
    <p class="more-hint">+ ${accCount} exercise${accCount > 1 ? 's' : ''}</p>` : '';

  const preview = primaryBlock + secondaryBlock + accessoryBlock;
  const more = '';

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
    <div class="strength-preview">${preview}</div>
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

  if (session.warmup?.length)   root.appendChild(mkSection('🔥 Warm-Up',           renderWarmup(session.warmup),    'warmup'));
  if (session.strength?.length) root.appendChild(mkSection('💪 Strength',           renderStrength(session.strength), 'strength'));
  root.appendChild(mkSection('⚡ Metcon',          renderMetcon(session.metcon),    'metcon'));
  if (session.mobility?.length) root.appendChild(mkSection('🧘 Mobility & Cooldown', renderMobility(session.mobility), 'mobility'));

  showScreen('session-screen');
}

function badge(text, cls) {
  const el = document.createElement('div');
  el.className = cls;
  el.textContent = text;
  return el;
}

function mkSection(title, content, type) {
  const sec = document.createElement('div');
  sec.className = type ? `session-section section-${type}` : 'session-section';
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

function makeStrengthRow(ex, i) {
  const load = ex.percentOfMax !== null ? resolveLoad(ex.movement, ex.percentOfMax) : null;
  const isAccessory = ex.type === 'accessory';
  const el = document.createElement('div');
  const typeCls = (ex.type === 'primary' || ex.type === 'main') ? ' strength-primary' : ex.type === 'secondary' ? ' strength-secondary' : ' strength-accessory';
  el.className = `item-row strength-row${typeCls}`;

  let accTrackerHtml = '';
  if (isAccessory) {
    const saved = Storage.getAccessoryLoad(ex.movement);
    const lastUsedHtml = saved
      ? `<span class="acc-last-used">Last used: ${saved.kg} kg · ${fmtShortDate(saved.date)}</span>`
      : '';
    accTrackerHtml = `
      <div class="acc-weight-tracker">
        ${lastUsedHtml}
        <div class="acc-weight-log">
          <input type="number" class="acc-weight-input" placeholder="Log kg used today" min="0" step="0.5"${saved ? ` value="${saved.kg}"` : ''}>
          <button class="btn-xs acc-save-btn">Save</button>
        </div>
      </div>`;
  }

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
        ${fmtRest(ex.restSeconds) ? `<span class="rest-val">Rest ${fmtRest(ex.restSeconds)}</span>` : ''}
      </div>
      ${ex.coachingNotes ? `<div class="coaching-notes">${ex.coachingNotes}</div>` : ''}
      ${accTrackerHtml}
    </div>
  `;

  if (isAccessory) {
    el.querySelector('.acc-save-btn').addEventListener('click', () => {
      const input = el.querySelector('.acc-weight-input');
      const kg = parseFloat(input.value);
      if (isNaN(kg) || kg <= 0) { toast('Enter a valid weight', 'error'); return; }
      Storage.setAccessoryLoad(ex.movement, kg);
      const today = new Date().toISOString().split('T')[0];
      let lastUsed = el.querySelector('.acc-last-used');
      if (lastUsed) {
        lastUsed.textContent = `Last used: ${kg} kg · ${fmtShortDate(today)}`;
      } else {
        lastUsed = document.createElement('span');
        lastUsed.className = 'acc-last-used';
        lastUsed.textContent = `Last used: ${kg} kg · ${fmtShortDate(today)}`;
        el.querySelector('.acc-weight-tracker').prepend(lastUsed);
      }
      toast(`Saved ${kg} kg for ${ex.movement}`, 'success');
    });
  }

  return el;
}

function renderStrength(items) {
  const wrap = document.createElement('div');
  wrap.className = 'item-list';

  // legacy 'main' (pre-3-tier) treated as primary for display
  const primary   = items.filter(e => e.type === 'primary' || e.type === 'main');
  const secondary = items.filter(e => e.type === 'secondary');
  const accessory = items.filter(e => e.type === 'accessory');
  let offset = 0;

  if (primary.length) {
    const label = document.createElement('p');
    label.className = 'strength-sublabel strength-sublabel-primary';
    label.textContent = 'Primary';
    wrap.appendChild(label);
    primary.forEach((ex, i) => wrap.appendChild(makeStrengthRow(ex, offset + i)));
    offset += primary.length;
  }

  if (secondary.length) {
    const label = document.createElement('p');
    label.className = 'strength-sublabel strength-sublabel-secondary';
    label.textContent = 'Secondary';
    wrap.appendChild(label);
    secondary.forEach((ex, i) => wrap.appendChild(makeStrengthRow(ex, offset + i)));
    offset += secondary.length;
  }

  if (accessory.length) {
    const label = document.createElement('p');
    label.className = 'strength-sublabel strength-sublabel-acc';
    label.textContent = 'Accessory';
    wrap.appendChild(label);
    accessory.forEach((ex, i) => wrap.appendChild(makeStrengthRow(ex, offset + i)));
  }

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

// ─── Chat ─────────────────────────────────────────────────────────────────────
function openChat() {
  if (!currentProgram) return;
  if (chatProgramId !== currentProgram.id) {
    Chat.init(currentProgram, Storage.getProfile());
    const container = $('chat-messages');
    container.innerHTML = '';
    const intro = document.createElement('p');
    intro.className = 'chat-intro';
    intro.textContent = 'Ask about your program — why something was programmed, request changes, or get coaching advice.';
    container.appendChild(intro);
    chatProgramId = currentProgram.id;
  }
  showScreen('chat-screen');
  setTimeout(() => $('chat-input').focus(), 100);
}

function appendChatMessage(role, text, update) {
  const container = $('chat-messages');
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble chat-bubble-${role}`;

  const body = document.createElement('div');
  body.className = 'chat-bubble-body';
  body.innerHTML = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
  bubble.appendChild(body);

  if (update) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-sm btn-primary chat-apply-btn';
    btn.textContent = 'Apply changes to program';
    btn.onclick = () => applyChatUpdate(update, btn);
    bubble.appendChild(btn);
  }

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

function showChatTyping() {
  const el = document.createElement('div');
  el.id = 'chat-typing';
  el.className = 'chat-bubble chat-bubble-assistant chat-typing';
  el.innerHTML = '<span></span><span></span><span></span>';
  $('chat-messages').appendChild(el);
  $('chat-messages').scrollTop = $('chat-messages').scrollHeight;
}

function hideChatTyping() {
  const el = $('chat-typing');
  if (el) el.remove();
}

async function handleChatSend() {
  const input = $('chat-input');
  const text  = input.value.trim();
  if (!text) return;

  const profile = Storage.getProfile();
  if (!profile.apiKey) {
    toast('Add your Anthropic API key in Settings first', 'error');
    return;
  }

  input.value = '';
  appendChatMessage('user', text);
  showChatTyping();
  $('chat-send-btn').disabled = true;

  try {
    const reply  = await Chat.send(text, profile.apiKey);
    hideChatTyping();
    const update = Chat.extractUpdate(reply);
    appendChatMessage('assistant', update ? Chat.stripUpdateTag(reply) : reply, update);
  } catch (err) {
    hideChatTyping();
    appendChatMessage('assistant', `Sorry, something went wrong: ${err.message}`);
  } finally {
    $('chat-send-btn').disabled = false;
    input.focus();
  }
}

function applyChatUpdate(updatedProgram, btn) {
  const merged = {
    ...updatedProgram,
    id:        Date.now().toString(),
    createdAt: new Date().toISOString(),
    startDate: currentProgram.startDate,
    weeks:     updatedProgram.weeks ?? currentProgram.weeks,
  };
  Storage.saveProgram(merged);
  currentProgram = merged;
  chatProgramId  = merged.id;
  currentWeek    = 1;
  Chat.updateProgram(merged);
  renderHomeSummary();
  btn.textContent = 'Changes applied ✓';
  btn.disabled = true;
  toast('Program updated!', 'success');
  setTimeout(() => { showScreen('program-screen'); renderProgramView(); }, 800);
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

  function buildStrengthRows(strength) {
    const makeRow = (e, i) => {
      const loadStr = rl(e.movement, e.percentOfMax);
      const typeCls = (e.type === 'primary' || e.type === 'main') ? 'ex-primary' : e.type === 'secondary' ? 'ex-secondary' : 'ex-acc';
      return `<div class="ex ${typeCls}">
        <div class="ex-num">${i + 1}</div>
        <div class="ex-detail">
          <div class="ex-name">${e.movement}${e.isUnilateral ? ' <span class="tag">Unilateral</span>' : ''} <span class="tag cat">${e.category}</span></div>
          <div class="ex-rx">${e.sets} sets × ${e.reps} reps${loadStr ? ` &nbsp;·&nbsp; <strong class="load">${loadStr}</strong>` : ''}${e.restSeconds ? ` &nbsp;·&nbsp; <span class="rest">Rest ${fmtRest(e.restSeconds)}</span>` : ''}</div>
          ${e.coachingNotes ? `<div class="note">${e.coachingNotes}</div>` : ''}
        </div>
      </div>`;
    };
    const primary   = strength.filter(e => e.type === 'primary' || e.type === 'main');
    const secondary = strength.filter(e => e.type === 'secondary');
    const acc       = strength.filter(e => e.type === 'accessory');
    let html = '';
    if (primary.length)   html += `<p class="ex-sublabel ex-sublabel-primary">Primary</p>${primary.map((e, i) => makeRow(e, i)).join('')}`;
    if (secondary.length) html += `<p class="ex-sublabel ex-sublabel-secondary">Secondary</p>${secondary.map((e, i) => makeRow(e, primary.length + i)).join('')}`;
    if (acc.length)       html += `<p class="ex-sublabel ex-sublabel-acc">Accessory</p>${acc.map((e, i) => makeRow(e, primary.length + secondary.length + i)).join('')}`;
    return html;
  }

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

      const strengthRows = buildStrengthRows(s.strength || []);

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

    const weekVolume = calcWeekVolume(sessions);
    const volChips = Object.entries(weekVolume)
      .sort(([, a], [, b]) => b - a)
      .map(([cat, sets]) => `<span class="vol-chip">${catLabel(cat)}: ${sets} sets</span>`)
      .join('');

    return `<div class="week-block">
      <h2 class="week-heading">Week ${w} <span class="week-date">— starting ${weekDate}</span></h2>
      ${volChips ? `<div class="vol-summary">${volChips}</div>` : ''}
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
  .rest  { color: var(--muted); font-size: .85em; }
  .ex-sublabel { font-size: .65rem; font-weight: 800; text-transform: uppercase;
    letter-spacing: .07em; margin: 0; padding: 7px 16px; display: block;
    border-left: 4px solid transparent; }
  .ex-sublabel-primary   { background: rgba(217,119,6,.12); color: #92400e;
    border-left-color: #d97706; }
  .ex-sublabel-secondary { background: rgba(14,165,233,.12); color: #0369a1;
    border-left-color: #0ea5e9; margin-top: 8px; border-top: 2px solid rgba(14,165,233,.25); }
  .ex-sublabel-acc { background: #f1f5f9; color: #475569;
    border-left-color: #94a3b8; margin-top: 8px; border-top: 2px solid #e2e8f0; }
  .ex-primary   { border-left: 4px solid var(--strength); padding-left: 10px; }
  .ex-secondary { border-left: 4px solid #0ea5e9; padding-left: 10px; }
  .ex-acc       { border-left: 3px solid #cbd5e1; padding-left: 10px; opacity: .88; }
  .tag   { background: #f1f5f9; color: var(--muted); font-size: .7rem; font-weight: 700;
    padding: 1px 6px; border-radius: 100px; text-transform: capitalize; }
  .tag.cat { }
  .prog-title { font-size: 1.1rem; font-weight: 800; color: #0f172a; margin-bottom: 16px; }
  .week-block  { margin-bottom: 28px; }
  .week-heading { font-size: 1rem; font-weight: 800; color: #0f172a;
    border-bottom: 2px solid var(--primary); padding-bottom: 6px; margin-bottom: 8px; }
  .week-date { font-weight: 400; color: var(--muted); font-size: .88rem; }
  .vol-summary { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 12px; }
  .vol-chip { font-size: .72rem; background: #f1f5f9; border: 1px solid #e2e8f0;
    border-radius: 100px; padding: 3px 9px; color: #64748b; white-space: nowrap; }
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
  .warmup-sec   { background: #f0f9ff; }
  .strength-sec { background: #fffbeb; }
  .metcon-sec   { background: #ede9fe; }
  .mobility-sec { background: #f0fdf4; }
  .warmup-sec   h3 { color: var(--warmup);   border-left: 4px solid var(--warmup);   padding-left: 8px; }
  .strength-sec h3 { color: var(--strength); border-left: 4px solid var(--strength); padding-left: 8px; }
  .metcon-sec   h3 { color: var(--metcon);   border-left: 4px solid var(--metcon);   padding-left: 8px; }
  .mobility-sec h3 { color: var(--mobility); border-left: 4px solid var(--mobility); padding-left: 8px; }
  .ex-list { display: flex; flex-direction: column; gap: 0; }
  .ex { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 10px; padding: 0 16px; }
  .ex:last-child { margin-bottom: 0; }
  .ex-num { width: 28px; height: 28px; background: var(--strength); color: #fff;
    border-radius: 50%; font-size: .8rem; font-weight: 700; display: flex;
    align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
  .ex-secondary .ex-num { background: #0ea5e9; }
  .ex-acc .ex-num { background: #94a3b8; }
  .ex-detail { flex: 1; }
  .ex-name { font-weight: 600; font-size: .95rem; margin-bottom: 4px;
    display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
  .ex-rx   { font-size: .9rem; margin-bottom: 4px; }
  .metcon-header-row { display: flex; justify-content: space-between; flex-wrap: wrap;
    gap: 6px; margin-bottom: 6px; align-items: baseline; }
  .metcon-header-row strong { font-size: .95rem; }
  .m-format { background: #ede9fe; color: #5b21b6; font-size: .75rem;
    font-weight: 700; padding: 2px 8px; border-radius: 100px; }
  .metcon-desc { font-size: .85rem; color: var(--muted); margin-bottom: 8px; }
  @media (max-width: 640px) {
    body { padding: 10px; font-size: 16px; }
    .sec { padding: 12px 14px; }
    .ex  { padding: 0 12px; }
    h3   { font-size: .9rem; margin-bottom: 8px; }
    .ex-name { font-size: 1rem; }
    .ex-rx   { font-size: .95rem; }
    .note    { font-size: .85rem; }
    .ex-sublabel { font-size: .72rem; padding: 8px 14px; }
    .ex-sublabel-secondary,
    .ex-sublabel-acc { margin-top: 10px; }
    li { font-size: .95rem; }
  }
</style>
</head>
<body>
<h1 class="prog-title">${currentProgram.programName}</h1>
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
function fmtRest(seconds) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}:${String(s).padStart(2, '0')} min` : `${m} min`;
}

function fmtDate(str) {
  if (!str) return '';
  try {
    return new Date(str + 'T12:00:00').toLocaleDateString('en-US',
      { month: 'long', day: 'numeric', year: 'numeric' });
  } catch { return str; }
}

function fmtShortDate(str) {
  if (!str) return '';
  try {
    return new Date(str + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
  $('clear-data-btn').addEventListener('click',   clearAllData);
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
  $('chat-btn').addEventListener('click',         openChat);
  $('export-html-btn').addEventListener('click',  exportToHTML);
  $('back-from-chat-btn').addEventListener('click', () => showScreen('program-screen'));
  $('chat-send-btn').addEventListener('click',    handleChatSend);
  $('chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); }
  });
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
