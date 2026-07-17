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

    return `You are an expert strength and conditioning coach who designed the training program below for a ${who}. All loads in kg.

## HOW THIS CHAT WORKS — READ THIS FIRST

This chat is embedded inside a training app. When you output a program update using the <program-update> tags described below, the app automatically detects it and shows an "Apply changes to program" button to the user. YOU CAN AND SHOULD make program changes — outputting the tags IS the mechanism for applying them. Never tell the user you "cannot change" the program or that they need to do it manually.

## TWO MODES

1. QUESTION → Answer clearly, cite rationale (volume targets, movement balance, progression logic). No JSON needed.

2. CHANGE REQUEST → You MUST:
   a. Briefly explain what you are changing and why (2–4 sentences)
   b. Output ONLY the session(s) you actually changed — never the whole program — inside <program-update> tags like this:

<program-update>
{ "sessions": [ { ...one complete updated session object, full schema, not a diff... } ] }
</program-update>

CRITICAL rules for the JSON block:
- Output raw JSON only — NO markdown code fences (no \`\`\`json), no comments, no ellipsis
- Include ONLY the session(s) you changed — omit every untouched session entirely. The app matches each returned session back into the full program by its "sessionNumber" field and replaces just that one.
- Each session you DO include must be the COMPLETE session object (all fields: warmup, strength, metcon, mobility, sessionNumber, week, etc.) — never a partial diff of just the changed field
- Follow the exact same per-session schema as the sessions in the input JSON below
- supersetGroup field must be preserved or updated on all exercises in any session you return
- Any change (swapping a movement, adjusting volume, rebuilding a metcon, etc.) MUST respect the full rulebook below — the same rules the program was originally generated under. In particular, pick metcon movements from the full METCON MOVEMENT POOL rather than reusing a small default set, and keep the per-program variety caps (no movement in more than 2 of 12 sessions, etc.) in mind relative to what's already in the rest of the program.

${ProgramGen.buildRulesPrompt()}

---

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

  function fmtMs(ms) {
    return ms === null ? '?' : `${Math.round(ms)}ms`;
  }

  // Text visible to the user while streaming — hides the <program-update> JSON blob
  // so it doesn't flash raw into the chat as it's generated.
  function visibleText(text) {
    const idx = text.indexOf('<program-update>');
    return idx === -1 ? text : text.slice(0, idx).trim();
  }

  async function send(userText, apiKey, onDelta) {
    _history.push({ role: 'user', content: userText });

    const t0 = performance.now();
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
        stream:     true,
        // cache_control lets Anthropic reuse the (large, mostly-unchanged) system
        // prompt across turns in this session instead of reprocessing it every time.
        system:     [{ type: 'text', text: buildSystem(), cache_control: { type: 'ephemeral' } }],
        messages:   _history,
      }),
    });

    if (!res.ok) {
      _history.pop();
      let msg = `API error ${res.status}`;
      try { const e = await res.json(); msg = e?.error?.message || msg; } catch {}
      throw new Error(msg);
    }

    const fetchMs = performance.now() - t0;

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let reply  = '';
    let usage  = {};
    let firstTokenMs     = null;
    let firstReadMs      = null;
    let messageStartMs   = null;
    let blockStartMs     = null;
    let firstDeltaText   = null;
    let stopReason       = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (firstReadMs === null) firstReadMs = performance.now() - t0;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        let evt;
        try { evt = JSON.parse(line.slice(6)); } catch { continue; }
        if (evt.type === 'message_start') {
          if (messageStartMs === null) messageStartMs = performance.now() - t0;
          usage = { ...usage, ...evt.message?.usage };
        } else if (evt.type === 'content_block_start') {
          if (blockStartMs === null) blockStartMs = performance.now() - t0;
        } else if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
          if (firstTokenMs === null) {
            firstTokenMs = performance.now() - t0;
            firstDeltaText = evt.delta.text;
          }
          reply += evt.delta.text;
          onDelta?.(reply);
        } else if (evt.type === 'message_delta') {
          usage = { ...usage, ...evt.usage };
          if (evt.delta?.stop_reason) stopReason = evt.delta.stop_reason;
        } else if (evt.type === 'error') {
          _history.pop();
          throw new Error(evt.error?.message || 'Stream error');
        }
      }
    }

    console.log(
      `[Chat] fetch: ${Math.round(fetchMs)}ms, first-read: ${fmtMs(firstReadMs)}, ` +
      `message_start: ${fmtMs(messageStartMs)}, content_block_start: ${fmtMs(blockStartMs)}, ` +
      `first-delta: ${fmtMs(firstTokenMs)} (text: ${JSON.stringify(firstDeltaText)}), ` +
      `total: ${Math.round(performance.now() - t0)}ms, stop_reason: ${stopReason} | ` +
      `input: ${usage.input_tokens ?? '?'}, cache read: ${usage.cache_read_input_tokens ?? 0}, ` +
      `cache write: ${usage.cache_creation_input_tokens ?? 0}, output: ${usage.output_tokens ?? '?'}`
    );

    // A response that got cut off mid-JSON (hit max_tokens) leaves a <program-update>
    // tag with no closing tag. If we stored that verbatim it would (a) never produce
    // a usable update — extractUpdate requires a closing tag — and (b) sit in history
    // forever, resending a huge broken JSON blob on every future turn and derailing
    // the model into repeating itself. Detect it and drop it instead.
    const truncated = stopReason === 'max_tokens' && /<program-update>(?![\s\S]*<\/program-update>)/.test(reply);

    // Store only the explanation in history, not the (potentially huge) program
    // JSON — that JSON is already reflected in _program and re-sent fresh via
    // buildSystem() each turn, so keeping old copies here is pure dead weight.
    const trimmed = stripUpdateTag(reply);
    _history.push({ role: 'assistant', content: trimmed || '(program updated — see applied changes)' });
    return { text: reply, truncated };
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
    // Strip a well-formed tag, or — if the response got cut off before closing —
    // strip from the dangling opening tag to the end so a truncated JSON dump
    // never ends up stored in chat history.
    return reply
      .replace(/\s*<program-update>[\s\S]*?<\/program-update>\s*/, '')
      .replace(/\s*<program-update>[\s\S]*$/, '')
      .trim();
  }

  return { init, updateProgram, send, extractUpdate, stripUpdateTag, visibleText };
})();
