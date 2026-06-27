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

  // ─── Metcon movement pool ────────────────────────────────────────────────────

  const METCON_MOVEMENTS = {
    // name: { pattern, modality, equipment, unilateral, ends_overhead, risk_flags, spawnWeight }
    // spawnWeight: 1=rare, 2=occasional, 3=normal, 4=common
    'KB swing':                   { pattern:'hinge',             modality:'weightlifting',  equipment:'kb',         unilateral:false, ends_overhead:false, risk_flags:['grip','lumbar'],               spawnWeight:4 },
    'KB clean':                   { pattern:'hinge',             modality:'weightlifting',  equipment:'kb',         unilateral:false, ends_overhead:false, risk_flags:['grip','skill'],                spawnWeight:3 },
    'KB snatch':                  { pattern:'hinge',             modality:'weightlifting',  equipment:'kb',         unilateral:true,  ends_overhead:true,  risk_flags:['grip','overhead','skill'],     spawnWeight:2 },
    'DB snatch':                  { pattern:'hinge',             modality:'weightlifting',  equipment:'db',         unilateral:true,  ends_overhead:true,  risk_flags:['grip','overhead','skill'],     spawnWeight:2 },
    'DB thruster':                { pattern:'squat',             modality:'weightlifting',  equipment:'db',         unilateral:false, ends_overhead:true,  risk_flags:['overhead'],                   spawnWeight:3 },
    'wall ball':                  { pattern:'squat',             modality:'weightlifting',  equipment:'wallball',   unilateral:false, ends_overhead:true,  risk_flags:['overhead'],                   spawnWeight:4 },
    'step-up':                    { pattern:'lunge',             modality:'weightlifting',  equipment:'bodyweight', unilateral:true,  ends_overhead:false, risk_flags:[],                             spawnWeight:4 },
    'burpee (no-jump)':           { pattern:'horizontal_push',   modality:'gymnastics',     equipment:'bodyweight', unilateral:false, ends_overhead:false, risk_flags:['lumbar'],                     spawnWeight:3 },
    'pull-up':                    { pattern:'vertical_pull',     modality:'gymnastics',     equipment:'bodyweight', unilateral:false, ends_overhead:false, risk_flags:['grip'],                       spawnWeight:4 },
    'ring row':                   { pattern:'horizontal_pull',   modality:'gymnastics',     equipment:'bodyweight', unilateral:false, ends_overhead:false, risk_flags:[],                             spawnWeight:4 },
    'push-up':                    { pattern:'horizontal_push',   modality:'gymnastics',     equipment:'bodyweight', unilateral:false, ends_overhead:false, risk_flags:[],                             spawnWeight:4 },
    'dip':                        { pattern:'vertical_push',     modality:'gymnastics',     equipment:'bodyweight', unilateral:false, ends_overhead:false, risk_flags:[],                             spawnWeight:3 },
    'row machine':                { pattern:'monostructural',    modality:'monostructural', equipment:'machine',    unilateral:false, ends_overhead:false, risk_flags:[],                             spawnWeight:4 },
    'air bike':                   { pattern:'monostructural',    modality:'monostructural', equipment:'machine',    unilateral:false, ends_overhead:false, risk_flags:[],                             spawnWeight:4 },
    'ski erg':                    { pattern:'monostructural',    modality:'monostructural', equipment:'machine',    unilateral:false, ends_overhead:false, risk_flags:[],                             spawnWeight:4 },
    'battle ropes':               { pattern:'monostructural',    modality:'monostructural', equipment:'bodyweight', unilateral:false, ends_overhead:false, risk_flags:['grip'],                       spawnWeight:3 },
    'med ball slam':              { pattern:'hinge',             modality:'weightlifting',  equipment:'medball',    unilateral:false, ends_overhead:true,  risk_flags:['lumbar'],                     spawnWeight:4 },
    'loaded carry':               { pattern:'carry',             modality:'weightlifting',  equipment:'kb',         unilateral:false, ends_overhead:false, risk_flags:['grip','lumbar'],               spawnWeight:3 },
    'sled push':                  { pattern:'horizontal_push',   modality:'monostructural', equipment:'sled',       unilateral:false, ends_overhead:false, risk_flags:[],                             spawnWeight:3 },
    'sled pull':                  { pattern:'horizontal_pull',   modality:'monostructural', equipment:'sled',       unilateral:false, ends_overhead:false, risk_flags:['grip'],                       spawnWeight:3 },
    'hollow hold':                { pattern:'core_isometric',    modality:'gymnastics',     equipment:'bodyweight', unilateral:false, ends_overhead:false, risk_flags:[],                             spawnWeight:3 },
    'sit-up':                     { pattern:'core_flexion',      modality:'gymnastics',     equipment:'bodyweight', unilateral:false, ends_overhead:false, risk_flags:[],                             spawnWeight:4 },
    'toes-to-bar':                { pattern:'core_flexion',      modality:'gymnastics',     equipment:'bodyweight', unilateral:false, ends_overhead:false, risk_flags:['grip','skill'],               spawnWeight:2 },
    'hanging knee raise':         { pattern:'core_flexion',      modality:'gymnastics',     equipment:'bodyweight', unilateral:false, ends_overhead:false, risk_flags:['grip'],                       spawnWeight:3 },
    'goblet squat':               { pattern:'squat',             modality:'weightlifting',  equipment:'kb',         unilateral:false, ends_overhead:false, risk_flags:[],                             spawnWeight:4 },
    'lunge':                      { pattern:'lunge',             modality:'weightlifting',  equipment:'bodyweight', unilateral:true,  ends_overhead:false, risk_flags:[],                             spawnWeight:4 },
    'glute bridge':               { pattern:'hinge',             modality:'weightlifting',  equipment:'bodyweight', unilateral:false, ends_overhead:false, risk_flags:[],                             spawnWeight:3 },
    'leg curl':                   { pattern:'hinge',             modality:'weightlifting',  equipment:'machine',    unilateral:false, ends_overhead:false, risk_flags:[],                             spawnWeight:3 },
    'plank':                      { pattern:'core_isometric',    modality:'gymnastics',     equipment:'bodyweight', unilateral:false, ends_overhead:false, risk_flags:[],                             spawnWeight:3 },
    'dead bug':                   { pattern:'core_antirotation', modality:'gymnastics',     equipment:'bodyweight', unilateral:false, ends_overhead:false, risk_flags:[],                             spawnWeight:3 },
    'single-arm row':             { pattern:'horizontal_pull',   modality:'weightlifting',  equipment:'db',         unilateral:true,  ends_overhead:false, risk_flags:[],                             spawnWeight:4 },
    'lat pulldown':               { pattern:'vertical_pull',     modality:'weightlifting',  equipment:'band_cable', unilateral:false, ends_overhead:false, risk_flags:[],                             spawnWeight:3 },
    'fly':                        { pattern:'horizontal_push',   modality:'weightlifting',  equipment:'db',         unilateral:false, ends_overhead:false, risk_flags:[],                             spawnWeight:3 },
    'split squat':                { pattern:'lunge',             modality:'weightlifting',  equipment:'bodyweight', unilateral:true,  ends_overhead:false, risk_flags:[],                             spawnWeight:4 },
    'leg press':                  { pattern:'squat',             modality:'weightlifting',  equipment:'machine',    unilateral:false, ends_overhead:false, risk_flags:[],                             spawnWeight:3 },
    'reverse lunge':              { pattern:'lunge',             modality:'weightlifting',  equipment:'bodyweight', unilateral:true,  ends_overhead:false, risk_flags:[],                             spawnWeight:4 },
    'DB/landmine overhead press': { pattern:'vertical_push',     modality:'weightlifting',  equipment:'db',         unilateral:false, ends_overhead:true,  risk_flags:['overhead'],                   spawnWeight:3 },
    'air squat':                  { pattern:'squat',             modality:'gymnastics',     equipment:'bodyweight', unilateral:false, ends_overhead:false, risk_flags:[],                             spawnWeight:4 },
    'push press':                 { pattern:'vertical_push',     modality:'weightlifting',  equipment:'db',         unilateral:false, ends_overhead:true,  risk_flags:['overhead'],                   spawnWeight:3 },
    'overhead squat':             { pattern:'squat',             modality:'weightlifting',  equipment:'db',         unilateral:false, ends_overhead:true,  risk_flags:['overhead','skill','mobility'], spawnWeight:1 },
    'push jerk':                  { pattern:'vertical_push',     modality:'weightlifting',  equipment:'kb',         unilateral:false, ends_overhead:true,  risk_flags:['overhead','skill'],           spawnWeight:2 },
    'DB clean':                   { pattern:'hinge',             modality:'weightlifting',  equipment:'db',         unilateral:false, ends_overhead:false, risk_flags:['skill'],                      spawnWeight:3 },
    'DB clean and jerk':          { pattern:'hinge',             modality:'weightlifting',  equipment:'db',         unilateral:false, ends_overhead:true,  risk_flags:['overhead','skill'],           spawnWeight:2 },
    // additions
    'DB floor press':             { pattern:'horizontal_push',   modality:'weightlifting',  equipment:'db',         unilateral:false, ends_overhead:false, risk_flags:[],                             spawnWeight:3 },
    'Romanian deadlift':          { pattern:'hinge',             modality:'weightlifting',  equipment:'db',         unilateral:false, ends_overhead:false, risk_flags:['lumbar'],                     spawnWeight:3 },
    'KB deadlift':                { pattern:'hinge',             modality:'weightlifting',  equipment:'kb',         unilateral:false, ends_overhead:false, risk_flags:['lumbar'],                     spawnWeight:3 },
    'Pallof press':               { pattern:'core_antirotation', modality:'weightlifting',  equipment:'band_cable', unilateral:false, ends_overhead:false, risk_flags:[],                             spawnWeight:3 },
    'rotational med ball throw':  { pattern:'core_rotational',   modality:'weightlifting',  equipment:'medball',    unilateral:false, ends_overhead:false, risk_flags:[],                             spawnWeight:3 },
    'Turkish get-up':             { pattern:'carry',             modality:'weightlifting',  equipment:'kb',         unilateral:true,  ends_overhead:true,  risk_flags:['overhead','skill'],           spawnWeight:2 },
    'good morning':               { pattern:'hinge',             modality:'weightlifting',  equipment:'barbell',    unilateral:false, ends_overhead:false, risk_flags:['lumbar'],                     spawnWeight:2 },
    'back extension':             { pattern:'hinge',             modality:'weightlifting',  equipment:'bodyweight', unilateral:false, ends_overhead:false, risk_flags:['lumbar'],                     spawnWeight:2 },
    'single-leg squat':           { pattern:'squat',             modality:'gymnastics',     equipment:'bodyweight', unilateral:true,  ends_overhead:false, risk_flags:['skill'],                           spawnWeight:2 },
    // barbell metcon movements
    'devil\'s press':             { pattern:'hinge',             modality:'weightlifting',  equipment:'db',         unilateral:false, ends_overhead:true,  risk_flags:['overhead','lumbar','skill'],        spawnWeight:2 },
    'pike push-up':               { pattern:'vertical_push',     modality:'gymnastics',     equipment:'bodyweight', unilateral:false, ends_overhead:false, risk_flags:[],                                  spawnWeight:3 },
    'BB power clean':             { pattern:'hinge',             modality:'weightlifting',  equipment:'barbell',    unilateral:false, ends_overhead:false, risk_flags:['skill','lumbar','mobility'],        spawnWeight:2 },
    'BB squat clean':             { pattern:'squat',             modality:'weightlifting',  equipment:'barbell',    unilateral:false, ends_overhead:false, risk_flags:['skill','lumbar','mobility'],        spawnWeight:1 },
    'BB snatch':                  { pattern:'hinge',             modality:'weightlifting',  equipment:'barbell',    unilateral:false, ends_overhead:true,  risk_flags:['overhead','skill','mobility'],      spawnWeight:1 },
    'BB thruster':                { pattern:'squat',             modality:'weightlifting',  equipment:'barbell',    unilateral:false, ends_overhead:true,  risk_flags:['overhead','mobility'],              spawnWeight:2 },
    'front squat':                { pattern:'squat',             modality:'weightlifting',  equipment:'barbell',    unilateral:false, ends_overhead:false, risk_flags:[],                                  spawnWeight:3 },
    'sumo deadlift':              { pattern:'hinge',             modality:'weightlifting',  equipment:'barbell',    unilateral:false, ends_overhead:false, risk_flags:['lumbar'],                          spawnWeight:3 },
    'sumo deadlift high pull':    { pattern:'hinge',             modality:'weightlifting',  equipment:'barbell',    unilateral:false, ends_overhead:false, risk_flags:['lumbar','grip'],                   spawnWeight:3 },
    'BB deadlift':                { pattern:'hinge',             modality:'weightlifting',  equipment:'barbell',    unilateral:false, ends_overhead:false, risk_flags:['lumbar'],                          spawnWeight:3 },
    'BB hang power clean':        { pattern:'hinge',             modality:'weightlifting',  equipment:'barbell',    unilateral:false, ends_overhead:false, risk_flags:['skill','lumbar','mobility'],        spawnWeight:2 },
    'BB hang squat clean':        { pattern:'squat',             modality:'weightlifting',  equipment:'barbell',    unilateral:false, ends_overhead:false, risk_flags:['skill','lumbar','mobility'],        spawnWeight:1 },
    'BB power snatch':            { pattern:'hinge',             modality:'weightlifting',  equipment:'barbell',    unilateral:false, ends_overhead:true,  risk_flags:['overhead','skill','mobility'],      spawnWeight:1 },
    'BB hang power snatch':       { pattern:'hinge',             modality:'weightlifting',  equipment:'barbell',    unilateral:false, ends_overhead:true,  risk_flags:['overhead','skill','mobility'],      spawnWeight:1 },
    'BB push press':              { pattern:'vertical_push',     modality:'weightlifting',  equipment:'barbell',    unilateral:false, ends_overhead:true,  risk_flags:['overhead'],                        spawnWeight:3 },
    'BB push jerk':               { pattern:'vertical_push',     modality:'weightlifting',  equipment:'barbell',    unilateral:false, ends_overhead:true,  risk_flags:['overhead','skill'],                spawnWeight:2 },
    'BB clean and jerk':          { pattern:'hinge',             modality:'weightlifting',  equipment:'barbell',    unilateral:false, ends_overhead:true,  risk_flags:['overhead','skill','mobility'],      spawnWeight:1 },
    'BB strict press':            { pattern:'vertical_push',     modality:'weightlifting',  equipment:'barbell',    unilateral:false, ends_overhead:true,  risk_flags:['overhead','mobility'],              spawnWeight:2 },
    'BB front rack lunge':        { pattern:'lunge',             modality:'weightlifting',  equipment:'barbell',    unilateral:true,  ends_overhead:false, risk_flags:['mobility'],                        spawnWeight:3 },
    'BB overhead lunge':          { pattern:'lunge',             modality:'weightlifting',  equipment:'barbell',    unilateral:true,  ends_overhead:true,  risk_flags:['overhead','mobility'],              spawnWeight:2 },
    'DB bench press':             { pattern:'horizontal_push',   modality:'weightlifting',  equipment:'db',         unilateral:false, ends_overhead:false, risk_flags:[],                                  spawnWeight:3 },
    'BB bench press':             { pattern:'horizontal_push',   modality:'weightlifting',  equipment:'barbell',    unilateral:false, ends_overhead:false, risk_flags:[],                                  spawnWeight:3 },
    'DB incline press':           { pattern:'horizontal_push',   modality:'weightlifting',  equipment:'db',         unilateral:false, ends_overhead:false, risk_flags:[],                                  spawnWeight:3 },
    'BB incline press':           { pattern:'horizontal_push',   modality:'weightlifting',  equipment:'barbell',    unilateral:false, ends_overhead:false, risk_flags:[],                                  spawnWeight:3 },
  };

  function buildMetconMovementPrompt() {
    const lines = [
      '## METCON MOVEMENT POOL',
      'Format: name | pattern | modality | equipment | unilateral | ends_overhead | risk_flags | spawnWeight(1=rare,4=common)',
      '',
    ];
    for (const [name, m] of Object.entries(METCON_MOVEMENTS)) {
      const flags = m.risk_flags.length ? m.risk_flags.join(',') : 'none';
      lines.push(
        `${name} | ${m.pattern} | ${m.modality} | ${m.equipment} | ` +
        `unilateral:${m.unilateral} | overhead:${m.ends_overhead} | flags:${flags} | w:${m.spawnWeight}`
      );
    }
    return lines.join('\n');
  }

  function validateMetcon(metcon, format) {
    const violations = [];
    const movements  = metcon.movements || [];
    const isTabata   = format === 'Tabata';
    const isEMOM     = format === 'EMOM';

    function lookupMeta(name) {
      const key = Object.keys(METCON_MOVEMENTS).find(
        k => k.toLowerCase() === (name || '').toLowerCase().trim()
      );
      return key ? METCON_MOVEMENTS[key] : null;
    }

    const tagged = movements.map(m => ({ m, meta: lookupMeta(m.name) }));

    // HARD: max 1 ends_overhead
    const overheadCount = tagged.filter(t => t.meta?.ends_overhead).length;
    if (overheadCount > 1) {
      violations.push(`overhead: ${overheadCount} ends_overhead movements (max 1)`);
    }

    // HARD: max 1 lumbar-flagged; no ballistic hinge + carry combo
    const lumbarCount = tagged.filter(t => t.meta?.risk_flags?.includes('lumbar')).length;
    if (lumbarCount > 1) {
      violations.push(`lumbar: ${lumbarCount} lumbar-flagged movements (max 1)`);
    }
    const BALLISTIC = ['kb swing', 'med ball slam'];
    const hasBallisticHinge = tagged.some(t => BALLISTIC.includes((t.m.name || '').toLowerCase().trim()));
    const hasCarry          = tagged.some(t => t.meta?.pattern === 'carry');
    if (hasBallisticHinge && hasCarry) {
      violations.push('lumbar: ballistic hinge (KB swing / med ball slam) + loaded carry not allowed in same metcon');
    }

    // HARD: max 2 grip-flagged; no 3+ consecutive
    const gripCount = tagged.filter(t => t.meta?.risk_flags?.includes('grip')).length;
    if (gripCount > 2) {
      violations.push(`grip: ${gripCount} grip-flagged movements (max 2)`);
    }
    let consecutive = 0;
    for (const t of tagged) {
      consecutive = t.meta?.risk_flags?.includes('grip') ? consecutive + 1 : 0;
      if (consecutive >= 3) { violations.push('grip: 3+ grip movements sequenced consecutively'); break; }
    }

    // HARD: no skill in Tabata or EMOM
    if (isTabata || isEMOM) {
      const skillMoves = tagged.filter(t => t.meta?.risk_flags?.includes('skill'));
      if (skillMoves.length > 0) {
        violations.push(
          `skill: [${skillMoves.map(t => t.m.name).join(', ')}] not allowed in ${format} — fatigue + speed breaks form`
        );
      }
    }

    return violations; // empty array = passes all hard constraints
  }

  function buildSystemPrompt() {
    return `You are a world-class strength and conditioning coach specialising in training post-menopausal women. You have deep expertise in:
- Periodisation models (LP, DUP, double progression, block)
- Evidence-based set/rep volume for bone density and sarcopenia prevention
- CrossFit-style programming with low-impact modifications
- Mobility for lat tightness, thoracic stiffness, and shoulder internal rotation

You output ONLY valid JSON — no markdown fences, no prose, no comments outside the JSON object. Your JSON must exactly match the schema given.`;
  }

  function buildUserMessage({ profile, maxLoads, accessoryLoads, previousProgram, comments, weeks, progressionModel, startDate }) {
    const dates = weekStartDates(startDate, weeks);

    const maxLoadsText = Object.keys(maxLoads).length
      ? Object.entries(maxLoads).map(([k, v]) => `  ${k}: ${v} kg`).join('\n')
      : '  (none saved yet — use "start conservative" guidance for all lifts)';

    const accessoryLoadsText = Object.keys(accessoryLoads || {}).length
      ? Object.entries(accessoryLoads).map(([mv, { kg, date }]) => `  ${mv}: ${kg} kg (last used ${date})`).join('\n')
      : '  (none saved yet)';

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

## PREVIOUSLY USED ACCESSORY WEIGHTS
When an accessory exercise matches one of these, reference the saved weight in coachingNotes to maintain continuity (e.g. "start at 20 kg — your last logged weight").
${accessoryLoadsText}

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
     Include rotator cuff / scapular activation here (band pull-aparts, external rotation, Y/T/W) — NOT as working sets
  2. STRENGTH — structured in three tiers (see MOVEMENT CLASSIFICATION below):
     a. PRIMARY: 1 heavy compound lift — type: "primary"
     b. SECONDARY: 1–2 supporting compounds — type: "secondary"
     c. ACCESSORY: 2–3 isolation / lower-load movements — type: "accessory"

## SUPERSET PAIRING (primary + secondary tiers only)

Where primary and secondary exercises target non-competing muscle groups, pair them as supersets to reduce total session time (the rest period of one exercise is used to perform the other).

Rules:
- Assign the same supersetGroup letter ("A", "B", …) to exercises that should be supersetted
- Non-competing = different primary muscle group patterns (e.g. squat + row, hinge + push, press + pull)
- Groups can be 2 exercises (superset) or 3 exercises (tri-set) — never 4+
- Primary may be supersetted with one or both secondaries when the primary is moderate-intensity (≤80% 1RM)
  Do NOT superset a max-effort or near-max primary set (>85% 1RM) — full neural recovery required
- Two secondary exercises may be supersetted if they target non-competing groups
- Accessory exercises may also be supersetted with each other when they target non-competing muscles (e.g. face pull + tricep extension, single-leg RDL + lateral raise)
- Standalone exercises (not in a superset) get supersetGroup: null
- Each exercise's restSeconds still reflects the desired rest for that movement; the app handles timing
  3. METCON (10–20 min, CrossFit-style — see allowed movements below)
  4. MOBILITY/COOLDOWN (lat, thoracic, shoulder IR)

## MOVEMENT CLASSIFICATION

PRIMARY (type: "primary") — 1 per session:
  The main compound lift, programmed to the DUP session type.
  Sets/reps/load vary by session type (heavy/moderate/volume).
  Examples: back squat, conventional deadlift, bench press, strict press, front squat

SECONDARY (type: "secondary") — 1–2 per session:
  Compound or semi-compound movements supporting the primary.
  Fixed: 3–4 sets × 6–10 reps, moderate load, regardless of session type.
  Examples: RDL, barbell row, hip thrust, Bulgarian split squat, landmine press, pull-up

ACCESSORY (type: "accessory") — 2–3 per session:
  Isolation or lower-load movements filling volume gaps or targeting weak points.
  Fixed: 3 sets × 10–15 reps, load by feel (RPE 7–8).
  Examples: single-leg RDL, cable pull-through, face pull, Pallof press, single-arm row, dead bug

## ACCESSORY PROGRAMMING RULES

1. Accessories must not duplicate the primary or secondary movement pattern in the same session
   (e.g., if primary = deadlift and secondary = RDL, accessories must come from push, pull, unilateral, or core — no more hinges)

2. After placing primary and secondary, check which muscle groups are still below their weekly target and prioritize those in accessory slots

3. Accessory progression across the cycle:
   Weeks 1–2: establish working weight at RPE 7
   Weeks 3–4: add 1 rep per set at the same weight
   Weeks 5–6: add 1–2 kg, reset to original rep target
   Deload week (if applicable): 60% load, same reps

4. Combined secondary + accessory sets per session must not exceed 15 working sets

5. Core accessories always placed last in the session
   Time-based: 2 sets × 20–40 s
   Rep-based: 2 sets × 10–15 reps
   Rotator cuff work belongs in the warm-up only — never as working sets

${buildMetconMovementPrompt()}

## METCON HARD CONSTRAINTS (enforce strictly — never violate)

1. OVERHEAD: max 1 ends_overhead movement per metcon.
   overhead squat (w=1): use rarely; cap reps ≤5/round; forbidden in Tabata and EMOM; counts as your sole overhead movement.

2. LUMBAR: max 1 lumbar-flagged movement per metcon.
   Never pair KB swing or med ball slam (ballistic hinge) with loaded carry in the same metcon.

3. GRIP: max 2 grip-flagged movements per metcon.
   Never sequence 3+ grip movements consecutively.

4. SKILL: skill-flagged movements (snatches, toes-to-bar, get-ups, OHS, push jerk, pistols) must NOT appear in Tabata or EMOM — fatigue and time pressure break technique.

## METCON SOFT PREFERENCES

- Push/pull balance: if the metcon has any push pattern, include at least one pull (and vice versa).
- Modality variety: avoid all-weightlifting or all-gymnastics metcons; mix modalities.
- Cardio machine rotation: rotate row machine / air bike / ski erg across sessions; avoid the same machine in consecutive sessions.
- Spawn weight guidance: prefer w=3–4 movements for routine selection; w=1–2 sparingly (overhead squat at most once per 4 sessions).
- Use DB/landmine overhead press only — never strict barbell press in a metcon.
NOT allowed in any metcon: running, jump rope, double-unders, box jumps with hard landing.

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
          "type": "primary | secondary | accessory",
          "order": 1,
          "supersetGroup": "A | null",
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
- supersetGroup: assign matching letters ("A", "B", …) to exercises that should be performed as a superset; applies to any tier — primary, secondary, or accessory; set to null for standalone exercises
- type: exactly 1 "primary", then 1–2 "secondary", then 2–3 "accessory" exercises (in that order in the array)
- Primary and secondary must target different muscle groups (no two hinges, no two squats, no two pushes)
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
- volumeAudit: populate one entry per tracked muscle group (GLUTES_HAMSTRINGS through CORE); sessionBreakdown is an array of primary + secondary working sets per session in order (do not count accessory sets); flag any violations
- Do not reference a per-session set cap or per-session limit anywhere in coachingNotes, weeklyVolumeNotes, or any other text field — the only volume constraint is weekly
- percentOfMax: set a number for ALL primary and secondary exercises — use a sensible training % (e.g. 75 for primary heavy day, 65 for secondary) regardless of whether the movement is in the saved maxes list (the app will show "65 kg" when a max is saved, or "65%" when it is not, which is still useful); set to null ONLY for type "accessory" exercises
- For accessory exercises (percentOfMax null): coachingNotes MUST describe how to choose weight (e.g. "moderate weight, RPE 7–8 — approximately 20–25 kg DB")
- Carry loads should be absolute (e.g. "32 kg KB per hand") or bodyweight-based
- Keep metcons 10–20 min, CrossFit-style but fully low-impact; select exclusively from the METCON MOVEMENT POOL above and enforce all hard constraints before finalising
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

  function estimateSessionTimes(session) {
    function parseReps(repsStr) {
      const s = String(repsStr || '').trim();
      const timeMatch = s.match(/^(\d+)(?:[–\-](\d+))?\s*s/i);
      if (timeMatch) {
        const lo = parseInt(timeMatch[1]);
        const hi = timeMatch[2] ? parseInt(timeMatch[2]) : lo;
        return { type: 'time', seconds: Math.round((lo + hi) / 2) };
      }
      const rangeMatch = s.match(/^(\d+)[–\-](\d+)/);
      if (rangeMatch) {
        return { type: 'reps', count: Math.round((parseInt(rangeMatch[1]) + parseInt(rangeMatch[2])) / 2) };
      }
      const num = parseInt(s);
      return { type: 'reps', count: isNaN(num) ? 8 : num };
    }

    function exerciseMinutes(ex, transitionSec) {
      const sets = ex.sets || 3;
      const rest = ex.restSeconds || 90;
      const parsed = parseReps(ex.reps);
      const setDuration = parsed.type === 'time' ? parsed.seconds : parsed.count * 4;
      return (sets * setDuration + (sets - 1) * rest + transitionSec) / 60;
    }

    const byType = { primary: [], secondary: [], accessory: [] };
    for (const ex of session.strength || []) {
      if (byType[ex.type]) byType[ex.type].push(ex);
    }

    const sum = (exs, trans) => exs.reduce((acc, ex) => acc + exerciseMinutes(ex, trans), 0);

    const primaryMinutes   = Math.round(sum(byType.primary,   120));
    const secondaryMinutes = Math.round(sum(byType.secondary,  90));
    const accessoryMinutes = Math.round(sum(byType.accessory,  60));
    const metconMinutes    = session.metcon?.timeMinutes ?? 15;

    // Superset savings: each paired exercise saves (sets-1) × its own rest (the shared rest
    // comes from the partner; only the max rest of the pair is used per round)
    const allStrength = [...byType.primary, ...byType.secondary];
    const seenGroups = new Set();
    let supersetSavingsSec = 0;
    for (const ex of allStrength) {
      if (ex.supersetGroup && !seenGroups.has(ex.supersetGroup)) {
        seenGroups.add(ex.supersetGroup);
        const group = allStrength.filter(e => e.supersetGroup === ex.supersetGroup);
        if (group.length > 1) {
          const sets = group[0].sets || 3;
          const rests = group.map(e => e.restSeconds || 90).sort((a, b) => b - a);
          // Save (sets-1) × all rests except the longest (the one shared rest)
          supersetSavingsSec += (sets - 1) * rests.slice(1).reduce((a, b) => a + b, 0);
          supersetSavingsSec += 60; // one fewer transition per extra exercise in the pair
        }
      }
    }
    const supersetSavingsMinutes = Math.round(supersetSavingsSec / 60);

    return {
      warmupMinutes:    10,
      primaryMinutes,
      secondaryMinutes,
      accessoryMinutes,
      metconMinutes,
      mobilityMinutes:  8,
      totalMinutes:     10 + primaryMinutes + secondaryMinutes + accessoryMinutes - supersetSavingsMinutes + metconMinutes + 8,
    };
  }

  function coerceSession(s, i) {
    const session = {
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
        type:           ['primary','secondary','accessory'].includes(e.type) ? e.type : 'accessory',
        order:          e.order         ?? (j + 1),
        supersetGroup:  e.supersetGroup || null,
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
    session.timeEstimates = estimateSessionTimes(session);
    return session;
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
        flag:                a.flag                 || null,
      })),
      sessions:             (raw.sessions || []).map(coerceSession),
    };
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  return {
    validateMetcon,
    estimateSessionTimes,

    async generate(params) {
      const { profile } = params;
      if (!profile.apiKey?.trim()) {
        throw new Error('API key not set. Please add your Anthropic API key in Settings.');
      }
      const sys     = buildSystemPrompt();
      const user    = buildUserMessage(params);
      const text    = await callClaude(sys, user, profile.apiKey.trim());
      const program = parseResponse(text, params);

      for (const session of program.sessions) {
        const violations = validateMetcon(session.metcon, session.metcon.format);
        if (violations.length > 0) {
          session.metcon.validationViolations = violations;
        }
      }

      return program;
    },
  };
})();
