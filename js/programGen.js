const ProgramGen = (() => {
  const MODEL   = 'claude-sonnet-4-6';
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

## WEEKLY VOLUME TARGETS (working sets, main-work only)

GLUTES_HAMSTRINGS    10–12 sets/week, minimum 2 different movements
UPPER_BACK_ERECTORS   8–10 sets/week, minimum 2 different movements
QUAD_DOMINANT         8–10 sets/week
PUSH                  6–8  sets/week
VERTICAL_PULL         6–8  sets/week
UNILATERAL_LOWER      6    sets/week per leg (count per leg, not bilateral)
CORE                  4–6  sets/week
CARRIES_LOADED        1–2 per week (presence required; not counted in sets)

---

## PER-SESSION CONSTRAINTS (enforce strictly)

1. Maximum 5 working sets per muscle group per session
2. Maximum 2 hinge-pattern movements per session
   Hinge = any GLUTES_HAMSTRINGS or UPPER_BACK_ERECTORS movement that loads the lumbar spine (deadlift, RDL, good morning)
   Hip thrust and cable pull-through do NOT count as hinges (hip-dominant, non-spinal-loading)
3. No session may contain 3 or more exercises targeting the same primary muscle group consecutively
4. Total working sets per session: 15–20
5. Each muscle group's weekly volume must be spread across at least 2 of the 3 sessions
6. If a muscle group target is ≥10 sets/week, it must appear in all 3 sessions
7. No two consecutive sessions lead with the same primary movement pattern (if Session A leads with a hinge, Session B must lead with squat or push)

---

## EXERCISE SELECTION RULES

- Rotate accessory selection across the cycle (do not repeat identical accessories every week — vary every 3–4 weeks)
- Primary movements (deadlift variants, squat variants, press variants) stay consistent within a cycle for progressive overload
- Include at least 1 unilateral lower body movement per session
- Include at least 1 rowing movement per session
- Include hip thrust or glute bridge at least 2× per week
- Prefer landmine press over barbell overhead press for shoulder safety

---

## TWO-PASS GENERATION

Generate the program in two passes:

PASS 1 — Volume architecture:
  For each session in the week, decide how many sets of each muscle group go where.
  Verify every constraint is met. Output this allocation as the volumeAudit array in the JSON.

PASS 2 — Exercise population:
  Fill in specific exercises into the slots from Pass 1. Apply exercise selection rules. Assign loads.

---

## PROGRAM STRUCTURE
- 3 sessions per week
- Each session must contain:
  1. WARM-UP (8–12 min, specific to that day's work)
  2. STRENGTH — structured in two parts:
     a. MAIN WORK: exactly 2 heavy compound movements targeting different primary muscle groups
        - type: "main" in the JSON; 3–5 sets, reps 3–8, high load
        - The two movements MUST target different primary muscle groups
     b. ACCESSORY WORK: 3–5 lighter complementary exercises
        - type: "accessory" in the JSON
        - Unilateral work, carries, isolation, core, rotator cuff
  3. METCON (10–20 min, CrossFit-style — see allowed movements below)
  4. MOBILITY/COOLDOWN (lat, thoracic, shoulder IR)

## METCON ALLOWED MOVEMENTS
KB swings, KB cleans, KB snatches, DB snatches, DB thrusters, wall balls, step-ups,
burpees (no-jump: step back/forward), pull-ups, ring rows, push-ups, dips,
row machine, air bike, ski erg, battle ropes, med ball slams, loaded carries,
sled pushes/pulls, hollow holds, sit-ups, toes-to-bar, hanging knee raises,
goblet squats, lunges, glute bridge, leg curl, planks, dead bugs, single arm row,
lat pulldown, flies, split squats, leg press, reverse lunge, overhead press,
air squat, push press, overhead squat, push jerk, db clean, db clean and jerk.
NOT allowed: running, jump rope, double-unders, box jumps with hard landing.

## MANDATORY ELEMENTS (at least once per 2-week block)
- Wrist/forearm (wrist curls, reverse curls, or rice bucket drill)
- Balance / proprioception (single-leg stance, perturbation drills)
- Low-impact plyometrics (med ball slams, step-ups for power, low pogo on soft surface)
- Erg cardio intervals for VO₂ (row, air bike, ski erg in metcon)

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
  "volumeAudit": [
    {
      "muscleGroup": "GLUTES_HAMSTRINGS",
      "weeklyTarget": "10–12",
      "weeklySetsProgrammed": 11,
      "sessionBreakdown": [4, 4, 3],
      "meetsTarget": true,
      "anySessionOver5": false,
      "flag": "string or null"
    }
  ],
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
          "type": "main",
          "order": 1,
          "movement": "string",
          "category": "GLUTES_HAMSTRINGS | UPPER_BACK_ERECTORS | QUAD_DOMINANT | PUSH | VERTICAL_PULL | UNILATERAL_LOWER | CORE | CARRIES_LOADED | ROTATOR_CUFF | GRIP | BALANCE | PLYOMETRIC",
          "isUnilateral": false,
          "sets": 3,
          "reps": "5",
          "percentOfMax": 75,
          "restSeconds": 180,
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
- type: exactly 2 "main" exercises per session (first in the array), then 3–5 "accessory" exercises
- The 2 main movements must use different primary movement patterns (no two hinges, no two squats, no two pushes)
- category — use exactly these values:
  GLUTES_HAMSTRINGS   = deadlift, RDL, hip thrust, cable pull-through, good morning, hamstring curl
  UPPER_BACK_ERECTORS = barbell row, DB row, cable row, chest-supported row, back extension
  QUAD_DOMINANT       = back squat, front squat, goblet squat, leg press, hack squat
  PUSH                = bench press, incline press, push-up, dip, strict press, push press, landmine press
  VERTICAL_PULL       = pull-up, chin-up, lat pulldown, straight-arm pulldown
  UNILATERAL_LOWER    = single-leg RDL, Bulgarian split squat, step-up, reverse lunge, pistol
  CORE                = plank, Pallof press, dead bug, hollow hold, GHD sit-up
  CARRIES_LOADED      = farmer carry, suitcase carry, overhead carry, Zercher carry
  ROTATOR_CUFF        = face pull, band pull-apart, external rotation, Y/T/W raise
  GRIP                = plate pinch, dead hang, fat-grip, rice bucket
  BALANCE             = single-leg stance, perturbation drills
  PLYOMETRIC          = med ball slam, step-up for power, low pogo
- volumeAudit: populate one entry per tracked muscle group (GLUTES_HAMSTRINGS through CORE); sessionBreakdown is an array of sets per session in order; flag any violations
- Do not reference a per-session set cap or per-session limit anywhere in coachingNotes, weeklyVolumeNotes, or any other text field — the only volume constraint is weekly
- percentOfMax: use number (e.g. 75) for main lifts when the movement is in the saved maxes list; for accessory lifts set to null and explain load in coachingNotes
- If percentOfMax is null due to no saved max, set coachingNotes to explain how to choose weight
- Carry loads should be absolute (e.g. "32 kg KB per hand") or bodyweight-based
- Keep metcons 10–20 min, CrossFit-style but fully low-impact
- restSeconds: post-menopausal women need full recovery — use these guidelines:
  • Heavy compound (≤5 reps or ≥80% 1RM): 180–240 s
  • Moderate compound (6–10 reps): 120–180 s
  • Accessory / isolation (10+ reps): 90–120 s
  • Carries, loaded holds, core: 60–90 s`;
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
        max_tokens: 32000,
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
        type:           e.type === 'main' ? 'main' : 'accessory',
        order:          e.order         ?? (j + 1),
        movement:       e.movement      || 'Unknown',
        category:       e.category      || '',
        isUnilateral:   e.isUnilateral  ?? false,
        sets:           e.sets          ?? 3,
        reps:           String(e.reps   ?? '5'),
        percentOfMax:   e.percentOfMax  ?? null,
        restSeconds:    e.restSeconds   ?? null,
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
      volumeAudit:          (raw.volumeAudit || []).map(a => ({
        muscleGroup:         a.muscleGroup          || '',
        weeklyTarget:        a.weeklyTarget         || '',
        weeklySetsProgrammed: a.weeklySetsProgrammed ?? null,
        sessionBreakdown:    Array.isArray(a.sessionBreakdown) ? a.sessionBreakdown : [],
        meetsTarget:         a.meetsTarget          ?? null,
        anySessionOver5:     a.anySessionOver5      ?? null,
        flag:                a.flag                 || null,
      })),
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
