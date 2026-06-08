const Chat = (() => {
  const MODEL   = 'claude-sonnet-4-6';
  const API_URL = 'https://api.anthropic.com/v1/messages';

  let _history = [];
  let _program = null;
  let _profile = null;

  function buildSystem() {
    const who = _profile
      ? `post-menopausal woman, age ${_profile.age}, bodyweight ${_profile.bodyweight} kg`
      : 'post-menopausal woman';

    return `You are an expert strength and conditioning coach reviewing a training program you designed for a ${who}. Hard constraints: no running, jump rope, or box jumps. All loads in kg.

Answer questions about programming decisions clearly and specifically — cite the rationale (volume targets, movement balance, progression logic, etc.).

When asked to make changes: explain what you're changing and why, then output the COMPLETE updated program JSON wrapped in <program-update> and </program-update> tags. The JSON must follow the exact same schema as the input. Do not truncate or summarise — the full sessions array is required.

CURRENT PROGRAM JSON:
${JSON.stringify(_program, null, 2)}`;
  }

  function init(program, profile) {
    _program = program;
    _profile = profile;
    _history = [];
  }

  function updateProgram(program) {
    _program = program;
  }

  async function send(userText, apiKey) {
    _history.push({ role: 'user', content: userText });

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: 32000,
        system:     buildSystem(),
        messages:   _history,
      }),
    });

    if (!res.ok) {
      _history.pop();
      let msg = `API error ${res.status}`;
      try { const e = await res.json(); msg = e?.error?.message || msg; } catch {}
      throw new Error(msg);
    }

    const data  = await res.json();
    const reply = data.content[0].text;
    _history.push({ role: 'assistant', content: reply });
    return reply;
  }

  function extractUpdate(reply) {
    const m = reply.match(/<program-update>([\s\S]*?)<\/program-update>/);
    if (!m) return null;
    try {
      const parsed = JSON.parse(m[1].trim());
      return Array.isArray(parsed.sessions) && parsed.sessions.length ? parsed : null;
    } catch { return null; }
  }

  function stripUpdateTag(reply) {
    return reply.replace(/\s*<program-update>[\s\S]*?<\/program-update>\s*/, '').trim();
  }

  return { init, updateProgram, send, extractUpdate, stripUpdateTag };
})();
