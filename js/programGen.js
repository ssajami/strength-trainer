const ProgramGen = (() => {
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

  // Maps a session's primary-lift category to the metcon movement pattern(s)
  // that would repeat the same muscle group — e.g. a back squat (QUAD_DOMINANT)
  // day shouldn't also suggest metcon movements with pattern 'squat'.
  const CATEGORY_TO_METCON_PATTERNS = {
    GLUTES_HAMSTRINGS:   ['hinge'],
    UPPER_BACK_ERECTORS: ['horizontal_pull'],
    QUAD_DOMINANT:       ['squat'],
    PUSH:                ['horizontal_push', 'vertical_push'],
    VERTICAL_PULL:       ['vertical_pull'],
    UNILATERAL_LOWER:    ['lunge'],
    CORE:                ['core_isometric', 'core_flexion', 'core_antirotation', 'core_rotational'],
    CARRIES_LOADED:      ['carry'],
  };

  // Deterministic (no AI involved) "what to avoid in your metcon" guidance,
  // derived purely from the strength work already programmed in this session.
  // Metcons are authored by the trainee herself in the app now, not generated —
  // this replaces relying on the model to remember overhead/lumbar/grip caps.
  // Which sessions get the metcon box. Programs from Block 8 on tag every
  // session with sessionType and only the Friday "metcon" session has one;
  // older programs (no sessionType) keep a metcon slot on every strength day.
  function hasMetconSlot(session) {
    if (session.sessionType) return session.sessionType === 'metcon';
    return (session.strength || []).some(e => e.type === 'primary' || e.type === 'main');
  }

  function buildMetconRequirements(session) {
    if (session.sessionType === 'metcon') {
      const avoid = [
        'Heavy or high-volume lumbar loading (heavy deadlifts, lots of heavy swings) — Sunday is the heavy hinge day, keep it moderate here.',
      ];
      const general = [
        'Aim for 30–45 minutes — one long piece, or 2–3 shorter pieces back to back',
        'Include one power / impact piece for bone loading — KB swing, sled push, step-up, med ball slam, jump-up/step-down',
        'Max 1 overhead-loading movement per piece, max 2 grip-heavy movements (never 3+ back to back)',
        'No running, jump rope, or box jumps with hard landings',
      ];
      // guidelines is shown in-app on the long-metcon day only; strength-day
      // metcons (older programs) show worked/suggestions instead.
      return { worked: [], avoid, general, suggestions: [], guidelines: [...general, ...avoid.map(a => `Avoid: ${a}`)] };
    }
    const strength = session.strength || [];

    const isHinge = e =>
      ['GLUTES_HAMSTRINGS', 'UPPER_BACK_ERECTORS'].includes(e.category) &&
      /deadlift|rdl|romanian|good morning/i.test(e.movement || '');
    const isOverhead  = e => /overhead|strict press|push press|jerk|snatch/i.test(e.movement || '');
    const isGripHeavy = e =>
      ['VERTICAL_PULL', 'CARRIES_LOADED', 'GRIP'].includes(e.category) ||
      /row|pull-?up|chin-?up|carry|dead ?hang/i.test(e.movement || '');

    const worked = strength.map(e => `${e.category || '—'}: ${e.movement} (${e.sets}×${e.reps})`);

    const avoid = [];
    const hinge = strength.find(isHinge);
    if (hinge) {
      avoid.push(`Additional lumbar loading — already did ${hinge.movement}. Skip ballistic hinge / loaded-carry combos (e.g. KB swing, med ball slam, sumo deadlift high pull).`);
    }
    const overhead = strength.find(isOverhead);
    if (overhead) {
      avoid.push(`More overhead pressing/holding — already did ${overhead.movement}. Skip wall ball, thruster, push press, overhead squat.`);
    }
    const grip = strength.find(isGripHeavy);
    if (grip) {
      avoid.push(`Heavy additional grip demand — already did ${grip.movement}. Keep carries, dead hangs, or high-rep pulling light if included at all.`);
    }

    const general = [
      'Max 1 overhead-loading movement, max 1 lumbar-loading movement, max 2 grip-heavy movements (never 3+ back to back)',
      'No running, jump rope, or box jumps with hard landings',
      'Skip skill-heavy movements (snatches, toes-to-bar, pistols, get-ups) if using a Tabata or EMOM format',
      'Aim for 10–20 minutes',
    ];

    // Inspiration only, not a requirement — pool movements that don't trip a
    // flag already avoided above, don't repeat today's primary muscle group,
    // and aren't a cardio machine (the trainee adds her own each day). Every
    // movement in the pool is fair game regardless of spawnWeight -- the
    // trainee built this list herself and is fine with any of them showing up.
    const primary = strength.find(e => e.type === 'primary');
    const excludedPatterns = new Set(CATEGORY_TO_METCON_PATTERNS[primary?.category] || []);

    const eligible = Object.entries(METCON_MOVEMENTS)
      .filter(([, m]) =>
        m.modality !== 'monostructural' &&
        !excludedPatterns.has(m.pattern) &&
        !(overhead && m.ends_overhead) &&
        !(hinge && m.risk_flags.includes('lumbar')) &&
        !(grip && m.risk_flags.includes('grip'))
      )
      .map(([name]) => name);

    // Shuffle (Fisher-Yates) so the pick varies day to day instead of always
    // handing back the same movements in object-declaration order.
    const shuffled = [...eligible];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const suggestions = shuffled.slice(0, 2 + Math.floor(Math.random() * 3)); // 2-4

    return { worked, avoid, general, suggestions };
  }

  // Full rulebook shared by program generation AND chat-based edits, so the coach
  // chat has the same movement pool / caps / taxonomy instead of improvising.
  function buildRulesPrompt() {
    return `## HARD CONSTRAINTS — NON-NEGOTIABLE
- NO running, NO jump rope (any form), NO box jumps with hard landings
- Low-impact plyometrics only: step-ups, low pogo hops on soft surface, medicine ball slams/throws,
  and low box jump-UP with a STEP-DOWN (jump onto a box <=30 cm, always step down, never jump down —
  the bone-loading stimulus comes from the take-off; the hard landing is what's banned)
- All weights in KILOGRAMS

## WEEKLY VOLUME TARGETS (working sets, main-work only)

GLUTES_HAMSTRINGS    10–12 sets/week, minimum 2 different movements
UPPER_BACK_ERECTORS   8–10 sets/week, minimum 2 different movements
QUAD_DOMINANT         8–10 sets/week
PUSH                  8–10 sets/week
VERTICAL_PULL         6–8  sets/week
UNILATERAL_LOWER      6    sets/week per leg (count per leg, not bilateral)
CORE                  4–6  sets/week
CARRIES_LOADED        1–2 per week (presence required; not counted in sets)
PLYOMETRIC (impact)   1 element in EVERY strength session (presence required; see BONE LOADING)

Total working sets per week (both strength sessions, all tiers): ~52–58 (Block 7 ran ~59 in weeks 2–4) — weekly
volume stays where the 3-session split had it; the sessions get longer instead.

---

## WEEKLY STRUCTURE (since Block 8 — standing choice, not something to ask about each cycle)

Four sessions per week, fixed days (the gym is closed Saturdays, so Saturday is
the at-home mobility day):

  dayWithinWeek 1  Sunday     STRENGTH A — hinge-led   (sessionType "strength")
  dayWithinWeek 2  Wednesday  STRENGTH B — squat-led   (sessionType "strength")
  dayWithinWeek 3  Friday     LONG METCON              (sessionType "metcon")
  dayWithinWeek 4  Saturday   WEEKLY MOBILITY          (sessionType "mobility")

Week start dates (startDate, label) are Sundays.

Why: the trainee was skipping the short post-strength metcons — not only for
time but because she was too tired and unmotivated after lifting (reported
2026-10-16). Two longer strength sessions plus one stand-alone metcon she does
fresh beats three strength sessions with metcons that mostly don't happen.
Two full-body sessions/week is enough to keep and build strength at this age
as long as loads stay heavy and weekly volume is held.

Why squat on Wednesday: the Friday metcon is trainee-authored and often has
lunges/step-ups; Wednesday is 5 days after it, Sunday's hinge day only 2. That
satisfies the quad-endurance note's "no quad-heavy metcon in the 48h before
the QUAD_DOMINANT day" rule by construction.

---

## PER-SESSION CONSTRAINTS (enforce strictly)

1. Maximum 6 working sets per muscle group per session
2. Maximum 2 hinge-pattern movements per session
   Hinge = any GLUTES_HAMSTRINGS or UPPER_BACK_ERECTORS movement that loads the lumbar spine (deadlift, RDL, good morning, clean/snatch pull)
   Hip thrust and cable pull-through do NOT count as hinges (hip-dominant, non-spinal-loading)
3. No session may contain 3 or more exercises targeting the same primary muscle group consecutively
4. Total working sets per strength session: 24–30 (week 1 of a re-entry block may run lower)
5. Every tracked muscle group with a target of ≥6 sets/week (GLUTES_HAMSTRINGS, UPPER_BACK_ERECTORS,
   QUAD_DOMINANT, PUSH, VERTICAL_PULL, UNILATERAL_LOWER) must appear in BOTH strength sessions
6. Strength A leads with a hinge, Strength B leads with a squat (see WEEKLY STRUCTURE)
7. Supersets are how the longer sessions stay manageable — pair non-competing work wherever the
   SUPERSET PAIRING rules allow; aim for an estimated session time of roughly 80–100 min

---

## EXERCISE SELECTION RULES

- Accessory exercises MUST rotate mid-cycle: choose one set of accessories for weeks 1–2 and a DIFFERENT set for weeks 3–4. At most 1 accessory movement may carry over between blocks. This applies per session slot — if Session A uses Bulgarian Split Squat in weeks 1–2, weeks 3–4 must use a different unilateral lower movement (e.g. Reverse Lunge, Step-Up)
- Primary movements (deadlift variants, squat variants, press variants) stay consistent within a cycle for progressive overload
- Include at least 1 unilateral lower body movement per session
- Include at least 1 rowing movement per session
- Include hip thrust or glute bridge at least 2× per week (i.e. in both strength sessions)
- Include 1 PLYOMETRIC / impact element in every strength session (see BONE LOADING)
- Include 1 power / explosive movement per week beyond the plyometric (push press, KB swing,
  hang power clean, med ball chest pass/throw) — power declines faster than strength with age
- Prefer landmine press over barbell overhead press for shoulder safety

---

## RESOLVED — shoulder IR progression (Block 7)
Block 7 added Face Pull back as a real ACCESSORY with working sets (3 sets,
RPE 7 in weeks 1–2, +1 rep in weeks 3–4) on Wednesday, per the prior pending
note. The overhead step was originally deferred to Block 8, but on 2026-10-06
(after Week 1 Session 1) the trainee asked to swap the PUSH primary DB Floor
Press -> Strict Press for all of Block 7: strict press at 25 kg x8 in metcons
felt fine on shoulder and elbow. Strict was chosen over Push Press as the
first overhead step (no ballistic catch, less loaded elbow flexion). When
building Block 8, ask how Strict Press went (shoulder pinch at lockout? elbow
in the front rack?): if it went well, Push Press is the planned next step
(the trainee originally asked for it); if not, step back to landmine.
(The sleeper-stretch item that used to be here is done — it now lives in the
weekly mobility session below, which is a better fit than the daily cooldown
blocks since it isn't time-squeezed.)

## PENDING FOR NEXT CYCLE (Block 8+) — Trap Bar retirement, revisit viability
Block 7 (starting 2026-10-04) swapped Conventional Deadlift back in for Trap
Bar Deadlift — the trainee reported the Trap Bar "problematic to use" for
roughly the next two months. When building Block 8 (or whichever block
starts on/after ~2026-11-09), ask whether Trap Bar access/use is viable
again before deciding to keep Conventional Deadlift or swap back. Also: a
real conventional 1RM should be logged during Block 7 (was only an ~88 kg
estimate going in) — use that logged number rather than re-estimating.
Delete this section once Block 8 has actually asked/decided this.

## PENDING FOR NEXT CYCLE (Block 8+) — elbow pain, monitor
Trainee reported slight elbow pain going into Block 7, unclear cause, worse
at full elbow flexion — flagged in Block 7 on Pull-Up and the new Face Pull
accessory (the two biggest end-range-flexion-under-load movements in the
program) with cautions to stay submaximal and stop on sharp pain, plus a
few accessory choices this block leaned elbow-friendly where the category
allowed it (Dead Hang, Zercher/Front-Rack Carry, Bird Dog). When building
Block 8, ask whether it resolved, is unchanged, or got worse:
- Resolved: drop the extra cautions, no longer a constraint.
- Unchanged/worse: keep the same cautions, and if it hasn't improved after
  a second block of monitoring, that's a stronger signal it warrants an
  actual look (PT/doctor) rather than continuing to program around it
  indefinitely — say so plainly rather than just quietly flagging forever.
Delete this section once resolved, or once escalated to "get it checked"
and the trainee has confirmed they will.

## PENDING FOR NEXT CYCLE (Block 8+) — quad local-endurance deficit
Block 6 added Spanish Squat (band-anchored, 3 sets x 12, controlled 3–4s
eccentric, RPE 6–7) as an ACCESSORY after the Back Squat on all four Friday
sessions; Block 7 continued it (3x12 weeks 1–2, 3x14 weeks 3–4, per the
standard accessory progression). Trigger: the trainee reported disproportionate quad soreness/
burning from squat-pattern and unilateral-lower work (lunges, step-ups, air
bike) despite leg press feeling fine — read as a local muscular-endurance/
conditioning gap specific to the quads, not a strength deficit, and directly
caused a missed squat day (a Wednesday metcon with DB lunges left quads too
fatigued for Friday's Back Squat).
Unlike normal accessories, do NOT rotate this away after one block:
1. Keep a quad isolation accessory (Spanish Squat, or leg extension if a
   machine becomes available) on the QUAD_DOMINANT primary day for at least
   the next 2–3 cycles — this is a multi-block conditioning fix, not a
   quick one.
2. Only taper or drop it once the trainee reports the pattern has actually
   normalized (squat day no longer missed to residual quad fatigue, lunge/
   metcon soreness no longer disproportionate) — ask at each cycle review
   rather than assuming from set/rep numbers alone.
3. When reviewing metcon content for the next cycle (metcons are trainee-
   authored, not generated by this rulebook), flag keeping quad-dominant
   patterns (lunge, squat, step-up) out of self-authored metcons in the 48h
   before the QUAD_DOMINANT session — that's what caused the missed session
   above, and the rulebook has no control over metcon content to enforce it.
Delete this section once the trainee confirms the pattern has normalized and
the accessory has been dropped/tapered accordingly.

---

## PROGRAM STRUCTURE
- 2 strength sessions + 1 long metcon session + 1 weekly mobility session per week (see WEEKLY STRUCTURE)
- Each STRENGTH session must contain:
  1. WARM-UP (8–12 min, specific to that day's work)
     Include rotator cuff / scapular activation here (band pull-aparts, external rotation, Y/T/W) — NOT as working sets
  2. STRENGTH — structured in three tiers (see MOVEMENT CLASSIFICATION below):
     a. PRIMARY: 2 heavy compound lifts — one LOWER (hinge on Strength A, squat on Strength B)
        and one UPPER press — type: "primary", lower first
     b. SECONDARY: 2–3 supporting compounds — type: "secondary"
     c. ACCESSORY: 3–5 isolation / lower-load movements, including the PLYOMETRIC element — type: "accessory"
  3. No metcon — strength sessions no longer carry a metcon slot
  4. MOBILITY/COOLDOWN (lat, thoracic, shoulder IR) — short, 3 items, not the main mobility work (see below)

## DUP ACROSS TWO SESSIONS
Each primary lift is trained once per week, so DUP works across the two days:
the session whose LOWER primary is the heavy type (3–5 reps, ~75–85%) pairs it
with an UPPER primary on the moderate/volume type (6–8 reps, ~65–75%), and the
other session flips it (lower moderate/volume, upper heavy). Note the pairing in
progressionJustification. Week-to-week progression within the cycle is unchanged.

## LONG METCON SESSION (Friday — trainee-authored)

dayWithinWeek 3, suggestedDay "Friday", sessionType "metcon". The trainee writes
the metcon herself in the app (see METCON — NOT YOUR JOB); the generator only
provides the frame:
- strength: [] (empty — no tiers, no percentOfMax)
- warmup: a general 8–10 min warm-up (cyclical machine + dynamic hips/shoulders/T-spine)
- mobility: a short 3-item cooldown
- focus: something like "Long Metcon — 30–45 min, your choice"
- Never add a "metcon" field or any metcon content.
The app shows her the long-metcon guidance (duration, include a power/impact
piece, keep heavy lumbar loading moderate before Sunday's hinge day).

## WEEKLY MOBILITY SESSION (dedicated 4th session)

Saturday, sessionType "mobility" (done at home — the gym is closed). A standing
part of every cycle, not something to ask about each time. Distinct
from the short per-strength-session cooldown blocks above — this is a real
~25–30 min session in its own right.

Schema: strength: [] (empty — no primary/secondary/accessory tiers, no
percentOfMax, no metcon prompt), all content in mobility: [{name, duration,
notes}]. dayWithinWeek: 4, suggestedDay "Saturday" — set focus to something like
"Weekly Mobility — Shoulder IR, Thoracic Spine, Hips".

Two tiers, matching the trainee's age (55, post-menopausal — reduced collagen
elasticity means real fall-risk and adhesive-capsulitis ("frozen shoulder")
considerations, not just comfort) and her documented shoulder IR limitation:

1. CORE CORRECTIVE (identical every week, all 4 weeks of the cycle — unlike
   accessories, this should NOT rotate; ROM corrections need repeated,
   consistent exposure to actually change something):
   - Sleeper stretch (targets posterior capsule tightness — the usual cause of
     limited shoulder IR)
   - Thoracic extension over foam roller
   - Shoulder CARs (controlled articular rotations — slow, full-range, no
     weight; safe for a stiff/at-risk shoulder since the trainee controls the
     range herself)
   - Couch stretch (hip flexor length — offsets the heavy weekly hinge volume)

2. SUPPLEMENTARY (rotates at the week-2/3 boundary, same convention as
   strength-day accessories — weeks 1–2 one set, weeks 3–4 a different set,
   at most 1 carryover): pick ~4 from cross-body shoulder stretch, hip
   internal/external rotation work (90/90, pigeon), ankle dorsiflexion (wall
   stretch), adductor rock-back, standing quad stretch, single-leg balance
   hold (fall-risk work — can progress eyes-open to eyes-closed, or add band
   perturbation, across the rotation).

Nothing here needs percentOfMax or restSeconds (it's all in the mobility
array, not strength). Skip anything ballistic or forced — tightness
discomfort is fine, sharp/pinching pain is not (flag in coachingNotes-
equivalent text that persistent pain, not just stiffness, warrants a PT
look rather than pushing through it).

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
- With 2 primaries per session, the lower + upper primary are the natural superset when both are ≤80% 1RM
- Standalone exercises (not in a superset) get supersetGroup: null
- Each exercise's restSeconds still reflects the desired rest for that movement; the app handles timing

## MOVEMENT CLASSIFICATION

PRIMARY (type: "primary") — 2 per strength session (one lower squat/hinge, one upper press):
  The main compound lifts, programmed to the DUP type (see DUP ACROSS TWO SESSIONS).
  Sets/reps/load vary by session type (heavy/moderate/volume).
  Examples: back squat, conventional deadlift, bench press, strict press, front squat, power clean, hang power clean, power snatch, hang power snatch
  Clean/snatch variants: trainee has years of Olympic-lifting experience and trains with coach supervision available — see OLYMPIC LIFT VARIANTS below for the constraints specific to these movements

SECONDARY (type: "secondary") — 2–3 per session:
  Compound or semi-compound movements supporting the primary.
  Fixed: 3–4 sets × 6–10 reps, moderate load, regardless of session type.
  Examples: RDL, barbell row, hip thrust, Bulgarian split squat, landmine press, pull-up

ACCESSORY (type: "accessory") — 3–5 per session:
  Isolation or lower-load movements filling volume gaps or targeting weak points.
  Fixed: 3 sets × 10–15 reps, load by feel (RPE 7–8).
  Examples: single-leg RDL, cable pull-through, face pull, Pallof press, single-arm row, dead bug

## OLYMPIC LIFT VARIANTS (PRIMARY ONLY)

Power clean, hang power clean, power snatch, hang power snatch are permitted as PRIMARY movements ONLY — never secondary or accessory (neither tier's rep/load scheme fits a technical, explosive lift). category: GLUTES_HAMSTRINGS.

- Default to power/hang variants (power clean, hang power clean, power snatch, hang power snatch), not full squat clean / squat snatch — the trainee has a documented shoulder IR limitation (already the reason landmine press is preferred over barbell overhead press elsewhere), and a full-catch position asks more of that same shoulder than a power/hang catch does. Only use a full squat-catch variant if the trainee explicitly requests it for a specific cycle.
- Reps: 3–5 sets × 1–3 reps regardless of DUP session type (heavy/moderate/volume days adjust %1RM only, never push reps higher — these are never programmed for "volume" in the 6-10 rep sense the way squats/deadlifts are)
- restSeconds: 180–240 s (full recovery between technical attempts)
- Never assign a supersetGroup to a clean/snatch primary, at any %1RM — technical execution needs full focus and a fresh CNS between sets, unlike the ≤80%/>85% intensity-based superset rule that applies to other primaries
- Counts as a hinge movement toward the "max 2 hinge-pattern movements per session" cap (see PER-SESSION CONSTRAINTS)
- Takes the LOWER primary slot on Strength A (it is the hinge); it also satisfies the weekly power-movement rule
- coachingNotes should note that supervision is available/recommended for these sessions

## ACCESSORY PROGRAMMING RULES

1. Accessories must not duplicate the primary or secondary movement pattern in the same session
   (e.g., if primary = deadlift and secondary = RDL, accessories must come from push, pull, unilateral, or core — no more hinges)

2. After placing primary and secondary, check which muscle groups are still below their weekly target and prioritize those in accessory slots

3. Accessory progression across the cycle:
   Weeks 1–2: establish working weight at RPE 7
   Weeks 3–4: add 1 rep per set at the same weight
   Weeks 5–6: add 1–2 kg, reset to original rep target
   Deload week (if applicable): 60% load, same reps

4. Combined secondary + accessory sets per session must not exceed 20 working sets

5. Core accessories always placed last in the session
   Time-based: 2 sets × 20–40 s
   Rep-based: 2 sets × 10–15 reps
   Rotator cuff work belongs in the warm-up only — never as working sets

## METCON — NOT YOUR JOB

Metcons are entered by the trainee herself in the app, not generated by you — and only on the Friday LONG METCON SESSION; strength sessions have no metcon slot. Never invent metcon movements, a format, a description, or a metconPlan for any session. The app independently computes session-specific "what to avoid" guidance from the strength work you programmed, and gives her a free-text box to enter her own metcon.

## MANDATORY ACCESSORY ELEMENTS (at least once per 2-week block, via ACCESSORY-tier exercises)
- Wrist/forearm (wrist curls, reverse curls, or rice bucket drill) — category GRIP
- Balance / proprioception (single-leg stance, perturbation drills) — category BALANCE
- (PLYOMETRIC is no longer once per block — it is in every strength session, see BONE LOADING)

## BONE LOADING (every strength session)
Post-menopausal bone responds to high-strain, high-rate loading, and weight
loss (calorie deficit, GLP-1 medication) adds bone loss on top. Heavy primaries
cover the strain; add the rate with 1 PLYOMETRIC accessory per strength session:
- Options: low box jump-up with step-down (<=30 cm), low pogo hops on a soft
  surface, med ball slam, med ball chest pass / scoop toss against a wall,
  jumping step-up onto a low box (step down)
- Dose: 3 × 5 (pogo: 3 × 10–15 contacts), full intent on every rep, 60–90 s rest
- Place it first in the accessory tier (fresh, before fatigue); core still goes last
- Rotates at the week-2/3 boundary like other accessories; progress by box
  height/intent, not by adding reps
- Hip-tendon caveat: if the lateral hip flares, switch to med ball variants
  (upper-body-driven) rather than dropping the element

## MUSCLE PRESERVATION IN A CALORIE DEFICIT / ON GLP-1
Applies whenever the trainee is losing weight (deficit or GLP-1 medication) or
reports unusual fatigue — she reported more fatigue in Oct 2026, so treat it
as active until she says otherwise:
- Load is what preserves muscle, more than set count. When a session has to
  be cut short or she is low on energy: drop accessory sets first, then
  secondary sets — keep the primaries at the programmed load (fewer sets is
  fine, lighter is the last resort). Say this in the primaries' coachingNotes.
- At each cycle review, compare the logged primary loads/e1RMs against the
  previous block. If 2+ primaries dropped ~5% or more, say so plainly as a
  possible sign of lean-mass loss or under-fuelling (protein, total energy,
  sleep) rather than just lowering the targets — and ask about it.
- Don't push volume above the weekly targets during a deficit; recovery is
  reduced and the extra sets cost more than they return.

## CATEGORY TAXONOMY
category — use exactly these values:
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

## LOAD & REST GUIDANCE
- percentOfMax: set a number for ALL primary and secondary exercises — use a sensible training % (e.g. 75 for primary heavy day, 65 for secondary) regardless of whether the movement is in the saved maxes list; set to null ONLY for type "accessory" exercises
- For accessory exercises (percentOfMax null): coachingNotes MUST describe how to choose weight (e.g. "moderate weight, RPE 7–8 — approximately 20–25 kg DB")
- Carry loads should be absolute (e.g. "32 kg KB per hand") or bodyweight-based
- restSeconds: post-menopausal women need full recovery — use these guidelines:
  • Heavy compound (≤5 reps or ≥80% 1RM): 180–240 s
  • Moderate compound (6–10 reps): 120–180 s
  • Accessory / isolation (10+ reps): 90–120 s
  • Carries, loaded holds, core: 60–90 s

## PROGRAM JSON SCHEMA
Programs are generated outside the app (in Claude Code) and imported as JSON via the "Import New Program" box on the home screen. Return ONLY this JSON structure, no text outside it:

{
  "programName": "string",
  "progressionModel": "string",
  "progressionJustification": "1–2 sentences",
  "weeklyVolumeNotes": "brief summary of how volume is distributed across muscle groups",
  "startDate": "YYYY-MM-DD",
  "weeks": 4,
  "volumeAudit": [
    {
      "muscleGroup": "GLUTES_HAMSTRINGS",
      "weeklyTarget": "10–12",
      "weeklySetsProgrammed": 11,
      "sessionBreakdown": [6, 5],
      "meetsTarget": true,
      "flag": "string or null"
    }
  ],
  "sessions": [
    {
      "sessionNumber": 1,
      "week": 1,
      "dayWithinWeek": 1,
      "suggestedDay": "Sunday",
      "sessionType": "strength | metcon | mobility",
      "label": "Workout 1 for the week starting January 5, 2025",
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
      "mobility": [
        { "name": "string", "duration": "string", "notes": "string or null" }
      ]
    }
  ]
}

Rules:
- supersetGroup: assign matching letters ("A", "B", …) to exercises that should be performed as a superset; applies to any tier — primary, secondary, or accessory; set to null for standalone exercises
- sessionType: required on every session — "strength" (2 per week), "metcon" (Friday, strength: []), "mobility" (Saturday, strength: [])
- type (strength sessions): exactly 2 "primary" (lower, then upper press), then 2–3 "secondary", then 3–5 "accessory" exercises (in that order in the array)
- Secondaries must not repeat a primary's pattern (no second squat on squat day, no second overhead press on press day); an RDL secondary on hinge day still counts toward the 2-hinge cap
- category, percentOfMax, restSeconds: follow the CATEGORY TAXONOMY and LOAD & REST GUIDANCE above
- volumeAudit: populate one entry per tracked muscle group (GLUTES_HAMSTRINGS through CORE); sessionBreakdown is an array of primary + secondary working sets per STRENGTH session in order (2 entries) (do not count accessory sets); flag any violations
- Do not reference a per-session set cap or per-session limit anywhere in coachingNotes, weeklyVolumeNotes, or any other text field — the only volume constraint is weekly
- Do not include a "metcon" field on any session — metcons are entered by the trainee separately, see METCON section above`;
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
    // A session with no primary lift is a dedicated mobility/stretch day —
    // no metcon applies, and its "mobility" content isn't a short cooldown
    // block but the actual point of the session, so estimate from item count
    // instead of the flat cooldown default.
    const hasPrimary = byType.primary.length > 0;
    const isMetconDay = session.sessionType === 'metcon';
    const metconMinutes = isMetconDay ? (session.metcon?.timeMinutes ?? 40)
                        : hasMetconSlot(session) ? (session.metcon?.timeMinutes ?? 15) : 0;
    const mobilityMinutes = hasPrimary || isMetconDay ? 8 : Math.max(15, (session.mobility || []).length * 3);

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

    const warmupMinutes = hasPrimary || isMetconDay ? 10 : 5;

    return {
      warmupMinutes,
      primaryMinutes,
      secondaryMinutes,
      accessoryMinutes,
      metconMinutes,
      mobilityMinutes,
      totalMinutes: warmupMinutes + primaryMinutes + secondaryMinutes + accessoryMinutes - supersetSavingsMinutes + metconMinutes + mobilityMinutes,
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
      sessionType:    ['strength', 'metcon', 'mobility'].includes(s.sessionType) ? s.sessionType : null,
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
      // Metcons are no longer AI-generated — the trainee enters her own via the
      // app (session.metconText); metcon stays null until she does.
      metcon:     null,
      metconText: s.metconText || null,
      mobility: (s.mobility || []).map(m => ({
        name:     m.name     || '',
        duration: m.duration || '',
        notes:    m.notes    || null,
      })),
    };
    session.timeEstimates = estimateSessionTimes(session);
    return session;
  }

  // Programs are generated outside the app (in Claude Code, against the rulebook
  // in buildRulesPrompt()) and pasted in as JSON via the "Import New Program" box.
  // This parses + coerces that JSON into the same shape the app has always used.
  function parseProgramJSON(text) {
    let json = text.trim();
    // Strip accidental markdown fences
    json = json.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    // Find first { in case there's leading text
    const start = json.indexOf('{');
    if (start > 0) json = json.slice(start);

    const raw = JSON.parse(json);
    if (!Array.isArray(raw.sessions) || !raw.sessions.length) {
      throw new Error('JSON has no "sessions" array');
    }
    if (!raw.startDate) throw new Error('JSON is missing "startDate"');

    return {
      id:                   Date.now().toString(),
      createdAt:            new Date().toISOString(),
      startDate:            raw.startDate,
      weeks:                parseInt(raw.weeks) || Math.max(...raw.sessions.map(s => s.week || 1)),
      commentsUsed:         raw.commentsUsed || '',
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
      sessions:             raw.sessions.map(coerceSession),
    };
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  return {
    estimateSessionTimes,
    hasMetconSlot,
    buildRulesPrompt,
    buildMetconRequirements,
    parseProgramJSON,
  };
})();
