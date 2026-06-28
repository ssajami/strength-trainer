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

    return `You are an expert strength and conditioning coach who designed the training program below for a ${who}. Hard constraints: no running, jump rope, or box jumps. All loads in kg.

## HOW THIS CHAT WORKS — READ THIS FIRST

This chat is embedded inside a training app. When you output a program update using the <program-update> tags described below, the app automatically detects it and shows an "Apply changes to program" button to the user. YOU CAN AND SHOULD make program changes — outputting the tags IS the mechanism for applying them. Never tell the user you "cannot change" the program or that they need to do it manually.

## TWO MODES

1. QUESTION → Answer clearly, cite rationale (volume targets, movement balance, progression logic). No JSON needed.

2. CHANGE REQUEST → You MUST:
   a. Briefly explain what you are changing and why (2–4 sentences)
   b. Output the complete updated program JSON inside <program-update> tags like this:

<program-update>
{ ...full updated JSON here... }
</program-update>

CRITICAL rules for the JSON block:
- Output raw JSON only — NO markdown code fences (no \`\`\`json), no comments, no ellipsis
- Include ALL sessions for ALL weeks — never truncate or summarise
- Follow the exact same schema as the input JSON below
- supersetGroup field must be preserved or updated on all exercises

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
      // Strip markdown code fences in case Claude wraps the JSON anyway
      const raw = m[1].trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed.sessions) && parsed.sessions.length ? parsed : null;
    } catch (e) {
      console.warn('program-update parse failed:', e.message);
      return null;
    }
  }

  function stripUpdateTag(reply) {
    return reply.replace(/\s*<program-update>[\s\S]*?<\/program-update>\s*/, '').trim();
  }

  return { init, updateProgram, send, extractUpdate, stripUpdateTag };
})();
