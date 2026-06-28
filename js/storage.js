const Storage = (() => {
  const KEYS = {
    PROFILE:          'spt_profile',
    MAX_LOADS:        'spt_max_loads',
    ACCESSORY_LOADS:  'spt_accessory_loads',
    PROGRAMS:         'spt_programs',
    LAST_COMMENTS:    'spt_last_comments',
    GITHUB_TOKEN:     'spt_github_token',
  };

  const DEFAULT_PROFILE = { age: 55, bodyweight: 65, apiKey: '', weeklySetMin: 9, weeklySetMax: 12 };

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

    getPrograms:      () => read(KEYS.PROGRAMS) || [],
    getCurrentProgram() {
      const p = read(KEYS.PROGRAMS) || [];
      return p[0] || null;
    },
    saveProgram(program) {
      const p = read(KEYS.PROGRAMS) || [];
      p.unshift(program);
      if (p.length > 15) p.length = 15;
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
