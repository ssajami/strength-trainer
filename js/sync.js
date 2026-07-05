const Sync = (() => {
  const OWNER = 'ssajami';
  const REPO  = 'strength-trainer';
  const PATH  = 'data/sync.json';
  const API   = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;

  const SYNC_KEYS = [
    'spt_profile',
    'spt_max_loads',
    'spt_accessory_loads',
    'spt_session_logs',
    'spt_programs',
    'spt_last_comments',
  ];

  let _token      = null;
  let _sha        = null;   // SHA of the current file — required by GitHub API to update
  let _saving     = false;  // lock — prevents concurrent PUTs with a stale SHA
  let _pendingSave = false; // if a save arrived while one was in flight, run it after

  function init(token) {
    _token = token || null;
  }

  function isConfigured() {
    return !!_token;
  }

  function githubHeaders() {
    return {
      'Authorization': `Bearer ${_token}`,
      'Content-Type':  'application/json',
      'Accept':        'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  function encodePayload(obj) {
    const json  = JSON.stringify(obj, null, 2);
    const bytes = new TextEncoder().encode(json);
    let binary  = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary);
  }

  function decodeContent(b64) {
    const binary = atob(b64.replace(/\n/g, ''));
    const bytes  = Uint8Array.from(binary, c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  async function load() {
    if (!_token) return null;
    setStatus('syncing');
    try {
      const res = await fetch(API, { headers: githubHeaders() });
      if (res.status === 404) { setStatus('ok'); return null; } // file not created yet
      if (!res.ok) throw new Error(`${res.status}`);

      const file    = await res.json();
      _sha          = file.sha;
      const payload = decodeContent(file.content);

      // Write each key into localStorage (GitHub is source of truth on load).
      // spt_profile: merge rather than overwrite — apiKey is device-only and never synced.
      for (const key of SYNC_KEYS) {
        if (payload.data?.[key] === undefined) continue;
        if (key === 'spt_profile') {
          let local = {};
          try { local = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}
          const merged = { ...local, ...payload.data[key], apiKey: local.apiKey || '' };
          localStorage.setItem(key, JSON.stringify(merged));
        } else {
          localStorage.setItem(key, JSON.stringify(payload.data[key]));
        }
      }
      setStatus('ok', payload.updatedAt);
      return payload;
    } catch (e) {
      console.error('Sync load failed:', e);
      setStatus('error');
      return null;
    }
  }

  async function save() {
    if (!_token) return;

    // If a save is already in flight, just flag that another one is needed
    if (_saving) { _pendingSave = true; return; }
    _saving = true;
    setStatus('syncing');
    try {
      const snapshot = {};
      for (const key of SYNC_KEYS) {
        try {
          const v = localStorage.getItem(key);
          snapshot[key] = v ? JSON.parse(v) : null;
        } catch { snapshot[key] = null; }
      }
      // Never sync sensitive credentials — entered once per device
      if (snapshot['spt_profile']) {
        const { apiKey, ...rest } = snapshot['spt_profile'];
        snapshot['spt_profile'] = rest;
      }

      const payload = { version: 1, updatedAt: new Date().toISOString(), data: snapshot };

      async function attemptPut(sha) {
        const body = {
          message: `sync ${new Date().toISOString()}`,
          content: encodePayload(payload),
          ...(sha ? { sha } : {}),
        };
        return fetch(API, { method: 'PUT', headers: githubHeaders(), body: JSON.stringify(body) });
      }

      let res = await attemptPut(_sha);

      // SHA conflict — re-fetch current SHA from GitHub and retry once
      if (res.status === 409 || res.status === 422) {
        const fileRes = await fetch(API, { headers: githubHeaders() });
        if (fileRes.ok) { const f = await fileRes.json(); _sha = f.sha; }
        res = await attemptPut(_sha);
      }

      if (!res.ok) throw new Error(`${res.status}`);

      const result = await res.json();
      _sha = result.content.sha;
      setStatus('ok', payload.updatedAt);
      return true;
    } catch (e) {
      console.error('Sync save failed:', e);
      setStatus('error');
      return false;
    } finally {
      _saving = false;
      if (_pendingSave) { _pendingSave = false; save(); }
    }
  }

  function setStatus(state, updatedAt) {
    const el = document.getElementById('sync-status');
    if (!el) return;
    el.dataset.state = state;
    if (state === 'ok' && updatedAt) {
      const d = new Date(updatedAt);
      el.title = `Synced ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (state === 'syncing') {
      el.title = 'Syncing…';
    } else if (state === 'error') {
      el.title = 'Sync failed — check GitHub token';
    } else {
      el.title = 'Sync not configured';
    }
  }

  return { init, isConfigured, load, save, setStatus };
})();
