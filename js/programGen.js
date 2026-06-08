const ProgramGen = (() => {
  const MODEL   = 'claude-sonnet-4-20250514';
  const API_URL = 'https://api.anthropic.com/v1/messages';

  // ─── Prompt building ────────────────────────────────────────────────────────

  function weekStartDates(startDate, weeks) {
    return Array.from({ length: weeks }, (_, i) => {
      const d = new Date(startDate + 'T12:00:00');
      d.setDate(d.getDate() + i * 7);
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    });
  }

  function prevProgramSummary(prog) {
    if (!prog) return 'No previous program.';
    const focuses = [...new Set((prog.sessions || []).map(s => s.focus).filter(Boolean))];
    const movs = [...new Set(
      (prog.sessions || []).flatMap(s => (s.strength || []).map(e => e.movement))
    )].slice(0, 8).join(', ');
    return (
      `Previous: "${prog.programName}" (${prog.progressionModel}, ${prog.weeks} weeks, ` +
      `started ${prog.startDate}). Focus areas: ${focuses.join(', ')}. ` +
      `Key movements used: ${movs || 'N/A'}.`
    );
  }

  function buildSystemPrompt() {
    return `You are a world-class strength and conditioning coach specialising in training post-menopausal women. You have deep expertise in:
- Periodisation models (LP, DUP, double progression, block)
- Evidence-based set/rep volume for bone density and sarcopenia prevention
- CrossFit-style programming with low-impact modifications
- Mobility for lat tightness, thoracic stiffness, and shoulder internal rotation

You output ONLY valid JSON — no markdown fences, no prose, no comments outside the JSON object. Your JSON must exactly match the schema given.`;
  }

  function buildUserMessage({ profile, maxLoads, previousProgram, comments, weeks, progressionModel, startDate }) {
    const dates = weekStartDates(startDate, weeks);

    const maxLoadsText = Object.keys(maxLoads).length
      ? Object.entries(maxLoads).map(([k, v]) => `  ${k}: ${v} kg`).join('\n')
      : '  (none saved yet — use "start conservative" guidance for all lifts)';

    const prevText  = prevProgramSummary(previousProgram);
    const commText  = comments?.trim()
      ? `Trainee feedback on last program: "${comments}"`
      : 'No feedback on previous program.';

    const progReq = progressionModel === 'auto'
      ? 'Choose the optimal progression model (LP, double, DUP, wave, or other) and justify your choice in 1–2 sentences based on her profile.'
      : `Use ${progressionModel} progression and briefly justify why it fits this trainee.`;

    const weekLines = dates.map((d, i) => `  Week ${i + 1}: starts ${d}`).join('\n');

    return `Generate a complete ${weeks}-week strength training program for this trainee.

## TRAINEE
- Post-menopausal woman, age ${profile.age}, bodyweight ${profile.bodyweight} kg
- Trains at a CrossFit gym with: rower, air bike, ski erg, barbells, full free weights, all sizes of KBs and DBs
- Goals: get stronger; preserve bone density and muscle mass (sarcopenia prevention)
- Mobility issues: lat tightness, thoracic stiffness, limited shoulder internal rotation

## HARD CONSTRAINTS — NON-NEGOTIABLE
- NO running, NO jump rope (any form), NO box jumps with hard landings
- Low-impact plyometrics only: step-ups, low pogo hops on soft surface, medicine ball slams/throws
- All weights in KILOGRAMS

## CURRENT MAX LOADS
${maxLoadsText}

## HISTORY
${prevText}
${commText}

## WEEKLY VOLUME TARGETS (evidence-based for post-menopausal trainee)
- Posterior chain (hamstrings, glutes, erectors): 16–22 sets/week — DO NOT underload relative to anterior
- Anterior chain (quads, chest, front delts): 10–16 sets/week
- Upper back / horizontal & vertical pull: 12–18 sets/week
- Shoulders: 8–14 sets/week
- Core / anti-rotation / carries: 8–12 sets/week
- Max ~9 working sets per muscle group per session; spread volume across sessions

## PROGRAM STRUCTURE
- 3–4 sessions per week
- Each session must contain:
  1. WARM-UP (8–12 min, specific to that day's work)
  2. STRENGTH (main compound lifts + accessories)
  3. METCON (10–20 min, CrossFit-style — see allowed movements below)
  4. MOBILITY/COOLDOWN (target lat, thoracic, shoulder IR for sessions where it fits)

## METCON ALLOWED MOVEMENTS
KB swings, KB cleans, KB snatches, DB snatches, DB thrusters, wall balls, step-ups,
burpees (no-jump: step back/forward), pull-ups, ring rows, push-ups, dips,
row machine, air bike, ski erg, battle ropes, med ball slams, loaded carries,
sled pushes/pulls, hollow holds, GHD sit-ups, toes-to-bar, hanging knee raises.
NOT allowed in metcons: running, jump rope, double-unders, box jumps with hard landing.

## MANDATORY ELEMENTS (spread across the full program)
Include ALL of the following at least once in every 2-week block:
- Grip strength (plate pinches, dead hangs, towel grip, fat-grip work)
- Wrist/forearm (wrist curls, reverse curls, or rice bucket drill)
- Balance / proprioception (single-leg stance, perturbation drills)
- Unilateral lower body (Bulgarian split squat, step-up, single-leg RDL, or pistol)
- Low-impact plyometrics (step-ups for power, med ball slams, low pogo on soft surface)
- Loaded carries (farmers, suitcase, overhead, Zercher) for bone density + core
- Erg cardio intervals for VO₂ (row, air bike, ski erg)

## PROGRESSION
${progReq}

## WEEK SCHEDULE
${weekLines}

## OUTPUT SCHEMA
Return ONLY this JSON structure, no text outside it:

{
  "programName": "string",
  "progressionModel": "string",
  "progressionJustification": "1–2 sentences",
  "weeklyVolumeNotes": "brief summary of how volume is distributed across muscle groups",
  "sessions": [
    {
      "sessionNumber": 1,
      "week": 1,
      "dayWithinWeek": 1,
      "suggestedDay": "Monday",
      "label": "Workout 1 for the week starting January 6, 2025",
      "focus": "Lower Body — Posterior Chain + Grip",
      "warmup": [
        { "name": "string", "duration": "string or null", "reps": "number or null", "notes": "string or null" }
      ],
      "strength": [
        {
          "order": 1,
          "movement": "string",
          "category": "posterior chain | anterior chain | upper back | shoulders | core | carry | plyometric | balance | grip",
          "isUnilateral": false,
          "sets": 3,
          "reps": "5",
          "percentOfMax": 75,
          "coachingNotes": "string or null"
        }
      ],
      "metcon": {
        "name": "string",
        "format": "AMRAP | For Time | EMOM | Tabata | Rounds For Time",
        "timeMinutes": 15,
        "description": "full written description of the workout",
        "movements": [
          { "name": "string", "reps": "string or null", "load": "string or null", "calories": "number or null", "distance": "string or null", "notes": "string or null" }
        ]
      },
      "mobility": [
        { "name": "string", "duration": "string", "notes": "string or null" }
      ]
    }
  ]
}

Rules:
- percentOfMax: use number (e.g. 75) when the lift should be percentage-based AND it is in the saved maxes list; otherwise null
- If percentOfMax is null due to no saved max, set coachingNotes to explain how to choose weight
- Carry loads should be absolute (e.g. "32 kg KB per hand") or bodyweight-based
- Every session must have at least 1 posterior chain movement in strength
- Keep metcons 10–20 min, CrossFit-style but fully low-impact`;
  }

  // ─── API call ────────────────────────────────────────────────────────────────

  async function callClaude(systemPrompt, userMessage, apiKey) {
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
        max_tokens: 16000,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: userMessage }],
      }),
    });

    if (!res.ok) {
      let msg = `API error ${res.status}`;
      try { const e = await res.json(); msg = e?.error?.message || msg; } catch {}
      throw new Error(msg);
    }

    const data = await res.json();
    return data.content[0].text;
  }

  // ─── Response parsing ────────────────────────────────────────────────────────

  function coerceSession(s, i) {
    return {
      sessionNumber:  s.sessionNumber  ?? (i + 1),
      week:           s.week           ?? 1,
      dayWithinWeek:  s.dayWithinWeek  ?? 1,
      suggestedDay:   s.suggestedDay   ?? '',
      label:          s.label          ?? `Session ${i + 1}`,
      focus:          s.focus          ?? '',
      warmup:         (s.warmup  || []).map(w => ({
        name:     w.name     || '',
        duration: w.duration || null,
        reps:     w.reps     ?? null,
        notes:    w.notes    || null,
      })),
      strength: (s.strength || []).map((e, j) => ({
        order:          e.order         ?? (j + 1),
        movement:       e.movement      || 'Unknown',
        category:       e.category      || '',
        isUnilateral:   e.isUnilateral  ?? false,
        sets:           e.sets          ?? 3,
        reps:           String(e.reps   ?? '5'),
        percentOfMax:   e.percentOfMax  ?? null,
        coachingNotes:  e.coachingNotes || null,
      })),
      metcon: {
        name:        s.metcon?.name        || 'Metcon',
        format:      s.metcon?.format      || '',
        timeMinutes: s.metcon?.timeMinutes ?? 15,
        description: s.metcon?.description || '',
        movements: (s.metcon?.movements || []).map(m => ({
          name:     m.name     || '',
          reps:     m.reps     ?? null,
          load:     m.load     || null,
          calories: m.calories ?? null,
          distance: m.distance || null,
          notes:    m.notes    || null,
        })),
      },
      mobility: (s.mobility || []).map(m => ({
        name:     m.name     || '',
        duration: m.duration || '',
        notes:    m.notes    || null,
      })),
    };
  }

  function parseResponse(text, { weeks, startDate, comments }) {
    let json = text.trim();
    // Strip accidental markdown fences
    json = json.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    // Find first { in case there's leading text
    const start = json.indexOf('{');
    if (start > 0) json = json.slice(start);

    const raw = JSON.parse(json);
    return {
      id:                   Date.now().toString(),
      createdAt:            new Date().toISOString(),
      startDate,
      weeks:                parseInt(weeks),
      commentsUsed:         comments || '',
      programName:          raw.programName          || 'Training Program',
      progressionModel:     raw.progressionModel     || 'Custom',
      progressionJustification: raw.progressionJustification || '',
      weeklyVolumeNotes:    raw.weeklyVolumeNotes    || '',
      sessions:             (raw.sessions || []).map(coerceSession),
    };
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  return {
    async generate(params) {
      const { profile } = params;
      if (!profile.apiKey?.trim()) {
        throw new Error('API key not set. Please add your Anthropic API key in Settings.');
      }
      const sys  = buildSystemPrompt();
      const user = buildUserMessage(params);
      const text = await callClaude(sys, user, profile.apiKey.trim());
      return parseResponse(text, params);
    },
  };
})();
