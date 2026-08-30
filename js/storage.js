const Storage = (() => {
  const KEYS = {
    PROFILE:          'spt_profile',
    MAX_LOADS:        'spt_max_loads',
    ACCESSORY_LOADS:  'spt_accessory_loads',
    SESSION_LOGS:     'spt_session_logs',   // actual weight used per movement (primary/secondary)
    PROGRAMS:         'spt_programs',
    LAST_COMMENTS:    'spt_last_comments',
    GITHUB_TOKEN:     'spt_github_token',
  };

  const DEFAULT_PROFILE = { age: 55, bodyweight: 65, apiKey: '', weeklySetMin: 9, weeklySetMax: 12, barWeight: 20 };
  const PROGRAM_HISTORY_LIMIT = 3; // current + 2 previous finalized programs

  function read(key) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }
    catch { return null; }
  }

  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { console.error('Storage write error:', e); }
  }

  return {
    getProfile:   () => ({ ...DEFAULT_PROFILE, ...(read(KEYS.PROFILE) || {}) }),
    saveProfile:  (p) => write(KEYS.PROFILE, p),

    getMaxLoads:  () => read(KEYS.MAX_LOADS) || {},
    saveMaxLoads: (m) => write(KEYS.MAX_LOADS, m),
    setMaxLoad(movement, kg) {
      const m = read(KEYS.MAX_LOADS) || {};
      m[movement.toLowerCase().trim()] = kg;
      write(KEYS.MAX_LOADS, m);
    },
    getMaxLoad(movement) {
      const m = read(KEYS.MAX_LOADS) || {};
      return m[movement.toLowerCase().trim()] ?? null;
    },

    // Last actual weight, reps, and (optionally) RPE for primary/secondary
    // exercises -- separate from estimated 1RM, which is derived from these.
    getSessionLog(movement) {
      const m = read(KEYS.SESSION_LOGS) || {};
      return m[movement.toLowerCase().trim()] ?? null;
    },
    setSessionLog(movement, kg, reps, rpe) {
      const m = read(KEYS.SESSION_LOGS) || {};
      const entry = { kg, date: new Date().toISOString().split('T')[0] };
      if (reps != null) entry.reps = reps;
      if (rpe != null) entry.rpe = rpe;
      m[movement.toLowerCase().trim()] = entry;
      write(KEYS.SESSION_LOGS, m);
    },

    getPrograms:      () => read(KEYS.PROGRAMS) || [],
    getCurrentProgram() {
      const p = read(KEYS.PROGRAMS) || [];
      return p[0] || null;
    },
    // Programs keep a stable programNumber across edits (chat tweaks, metcon
    // saves, re-imports of a revised draft) -- matched by programName, so
    // re-saving the program you're iterating on overwrites its entry instead
    // of piling up a new history row. Only a genuinely new programName gets
    // the next number. History is capped at PROGRAM_HISTORY_LIMIT (current +
    // a couple of finalized priors) to keep the synced payload small.
    saveProgram(program) {
      const p = read(KEYS.PROGRAMS) || [];
      const existingIdx = p.findIndex(x => x.programName === program.programName);
      const programNumber = existingIdx !== -1
        ? p[existingIdx].programNumber
        : p.reduce((max, x) => Math.max(max, x.programNumber || 0), 0) + 1;
      if (existingIdx !== -1) p.splice(existingIdx, 1);
      p.unshift({ ...program, programNumber });
      if (p.length > PROGRAM_HISTORY_LIMIT) p.length = PROGRAM_HISTORY_LIMIT;
      write(KEYS.PROGRAMS, p);
    },

    getAccessoryLoads: () => read(KEYS.ACCESSORY_LOADS) || {},
    getAccessoryLoad(movement) {
      const m = read(KEYS.ACCESSORY_LOADS) || {};
      return m[movement.toLowerCase().trim()] ?? null;
    },
    setAccessoryLoad(movement, kg, notes) {
      const m = read(KEYS.ACCESSORY_LOADS) || {};
      const entry = { date: new Date().toISOString().split('T')[0] };
      if (kg != null) entry.kg = kg;
      if (notes != null) entry.notes = notes;
      m[movement.toLowerCase().trim()] = entry;
      write(KEYS.ACCESSORY_LOADS, m);
    },

    getLastComments:  () => read(KEYS.LAST_COMMENTS) || '',
    saveLastComments: (c) => write(KEYS.LAST_COMMENTS, c),

    getGithubToken:   () => read(KEYS.GITHUB_TOKEN) || '',
    saveGithubToken:  (t) => write(KEYS.GITHUB_TOKEN, t),
  };
})();
