"""Check a generated cycle JSON against the hard rules in js/programGen.js before importing it.

Usage:
    python tools/check_cycle.py block8.json                         # rule checks
    python tools/check_cycle.py block8.json --prev block7-with-mobility.json   # + diff vs last block

FAIL = breaks a rule as written. WARN = probably intended, but decide consciously.
The checks mirror buildRulesPrompt(); when a rule there changes, change it here too.
"""
import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

RULEBOOK = Path(__file__).resolve().parent.parent / "js" / "programGen.js"
BANNED = re.compile(r"\b(run|running|jump rope|skipping rope|double.?unders?|box jump)", re.I)
STEP_DOWN = re.compile(r"step.?down", re.I)  # box jump-up + step-down is allowed (no hard landing)
LOWER = {"GLUTES_HAMSTRINGS", "QUAD_DOMINANT"}
SPREAD_GROUPS = ["GLUTES_HAMSTRINGS", "UPPER_BACK_ERECTORS", "QUAD_DOMINANT", "PUSH", "VERTICAL_PULL", "UNILATERAL_LOWER"]
DAYS = {1: ("Sunday", "strength"), 2: ("Wednesday", "strength"), 3: ("Friday", "metcon"), 4: ("Saturday", "mobility")}
POWER = re.compile(r"push press|swing|clean|snatch|med ball (chest )?pass|throw", re.I)
HINGE = re.compile(r"deadlift|rdl|romanian|good morning|clean|snatch", re.I)
OLYMPIC = re.compile(r"\b(clean|snatch)\b", re.I)
WEEKLY_TARGETS = {  # working sets/week, from WEEKLY VOLUME TARGETS
    "GLUTES_HAMSTRINGS": (10, 12), "UPPER_BACK_ERECTORS": (8, 10), "QUAD_DOMINANT": (8, 10),
    "PUSH": (8, 10), "VERTICAL_PULL": (6, 8), "UNILATERAL_LOWER": (6, 6), "CORE": (4, 6),
}

results = []


def report(level, where, msg):
    results.append((level, where, msg))


def sets(e):
    return e.get("sets") or 0


def strength_sessions(prog):
    return [s for s in prog["sessions"] if s.get("strength")]


def tag(s):
    return f"W{s['week']} {s.get('suggestedDay', 'D' + str(s['dayWithinWeek']))}"


def check(prog):
    sessions = prog["sessions"]
    weeks = prog.get("weeks", 4)
    if len(sessions) != weeks * 4:
        report("FAIL", "structure", f"{len(sessions)} sessions, expected {weeks * 4} (2 strength + metcon + mobility per week)")
    for s in sessions:
        day, kind = DAYS.get(s["dayWithinWeek"], (None, None))
        if s.get("sessionType") != kind:
            report("FAIL", tag(s), f"sessionType {s.get('sessionType')!r}, expected {kind!r} for day {s['dayWithinWeek']}")
        if day and s.get("suggestedDay") != day:
            report("WARN", tag(s), f"suggestedDay {s.get('suggestedDay')!r}, expected {day}")
        if kind in ("metcon", "mobility") and s.get("strength"):
            report("FAIL", tag(s), f"{kind} session must have strength: []")
        if s.get("metcon"):
            report("FAIL", tag(s), "metcon content is trainee-authored, generator must not add a metcon field")

    for s in sessions:
        for part in ("warmup", "strength", "mobility"):
            for e in s.get(part) or []:
                name = e.get("movement") or e.get("name") or ""
                if BANNED.search(name) and not STEP_DOWN.search(name):
                    report("FAIL", tag(s), f"banned movement (hard constraint): {name}")

    for s in strength_sessions(prog):
        st = s["strength"]
        t = tag(s)
        prim = [e for e in st if e["type"] == "primary"]
        sec = [e for e in st if e["type"] == "secondary"]
        acc = [e for e in st if e["type"] == "accessory"]

        if len(prim) != 2 or prim[0]["category"] not in LOWER or prim[1]["category"] != "PUSH":
            report("FAIL", t, "expected 2 primaries: lower (squat/hinge) then upper press, got "
                              + ", ".join(f"{e['movement']} [{e['category']}]" for e in prim))
        elif s["dayWithinWeek"] == 1 and prim[0]["category"] != "GLUTES_HAMSTRINGS":
            report("FAIL", t, f"Strength A (Sunday) should lead with a hinge, leads with {prim[0]['movement']}")
        elif s["dayWithinWeek"] == 2 and prim[0]["category"] != "QUAD_DOMINANT":
            report("FAIL", t, f"Strength B (Wednesday) should lead with a squat, leads with {prim[0]['movement']}")
        if not 2 <= len(sec) <= 3:
            report("FAIL", t, f"{len(sec)} secondaries (rule: 2-3)")
        if not 3 <= len(acc) <= 5:
            report("FAIL", t, f"{len(acc)} accessories (rule: 3-5)")

        per_group = Counter()
        for e in st:
            per_group[e["category"]] += sets(e)
        for g, n in per_group.items():
            if n > 6:
                names = ", ".join(f"{e['movement']} {sets(e)}" for e in st if e["category"] == g)
                report("FAIL", t, f"{g} has {n} sets (max 6/session): {names}")

        hinges = [e for e in st if e["category"] in ("GLUTES_HAMSTRINGS", "UPPER_BACK_ERECTORS")
                  and HINGE.search(e["movement"]) and not re.search(r"single.?leg|b-stance|pull", e["movement"], re.I)]
        if len(hinges) > 2:
            report("FAIL", t, f"{len(hinges)} hinge movements (max 2): {', '.join(e['movement'] for e in hinges)}")

        sec_acc = sum(sets(e) for e in sec + acc)
        if sec_acc > 20:
            report("FAIL", t, f"secondary + accessory = {sec_acc} sets (max 20)")

        total = sum(sets(e) for e in st)
        if not 24 <= total <= 30:
            report("WARN" if s["week"] == 1 else "FAIL", t, f"{total} working sets (rule: 24-30)")

        if not any(e["category"] == "UNILATERAL_LOWER" or e.get("isUnilateral") for e in st):
            report("FAIL", t, "no unilateral lower movement")
        if not any("row" in e["movement"].lower() for e in st):
            report("FAIL", t, "no rowing movement")
        if not any(e["category"] == "PLYOMETRIC" for e in st):
            report("FAIL", t, "no PLYOMETRIC / impact element (bone loading, every strength session)")

        groups = Counter(e.get("supersetGroup") for e in st if e.get("supersetGroup"))
        for g, n in groups.items():
            if n > 3:
                report("FAIL", t, f"superset group {g} has {n} exercises (max 3)")
        for e in st:
            if OLYMPIC.search(e["movement"]) and "pull" not in e["movement"].lower():
                if e["type"] != "primary":
                    report("FAIL", t, f"{e['movement']} allowed as PRIMARY only")
                if e.get("supersetGroup"):
                    report("FAIL", t, f"{e['movement']} must not be in a superset")
            if e["type"] == "accessory" and e.get("percentOfMax") is None and not e.get("coachingNotes"):
                report("FAIL", t, f"{e['movement']}: accessory without weight-selection coachingNotes")
        if acc and acc[-1]["category"] != "CORE" and any(e["category"] == "CORE" for e in acc):
            report("FAIL", t, "core accessory not placed last")

    for w in range(1, weeks + 1):
        ss = [s for s in strength_sessions(prog) if s["week"] == w]
        for g in SPREAD_GROUPS:
            n = sum(1 for s in ss if any(e["category"] == g for e in s["strength"]))
            if n < len(ss):
                report("FAIL", f"W{w}", f"{g} appears in {n} of {len(ss)} strength sessions (must be in both)")
        total = sum(sets(e) for s in ss for e in s["strength"])
        if not 52 <= total <= 58:
            report("WARN", f"W{w}", f"{total} working sets this week (aim ~52-58)")
        if not any(POWER.search(e["movement"]) for s in ss for e in s["strength"] if e["category"] != "PLYOMETRIC"):
            report("WARN", f"W{w}", "no power/explosive movement beyond the plyometric element")

    by_week = defaultdict(list)
    for s in strength_sessions(prog):
        by_week[s["week"]].append(s)
    for w, ss in sorted(by_week.items()):
        n = sum(1 for s in ss for e in s["strength"] if re.search(r"hip thrust|glute bridge", e["movement"], re.I))
        if n < 2:
            report("FAIL", f"W{w}", f"hip thrust / glute bridge appears {n}x (min 2x/week)")

    # Primaries must stay the same within the cycle, per weekday + lower/upper slot.
    slots = defaultdict(set)
    for s in strength_sessions(prog):
        for e in s["strength"]:
            if e["type"] == "primary":
                slots[(s["dayWithinWeek"], "lower" if e["category"] in LOWER else "upper")].add(e["movement"])
    for d, mv in slots.items():
        if len(mv) > 1:
            report("FAIL", f"day {d}", f"primary changes within cycle: {sorted(mv)}")

    # Accessories rotate between weeks 1-2 and 3-4 (max 1 carry-over per slot).
    for d in {day for day, _ in slots}:
        a = {e["movement"] for s in strength_sessions(prog) if s["dayWithinWeek"] == d and s["week"] <= 2
             for e in s["strength"] if e["type"] == "accessory"}
        b = {e["movement"] for s in strength_sessions(prog) if s["dayWithinWeek"] == d and s["week"] >= 3
             for e in s["strength"] if e["type"] == "accessory"}
        carried = a & b
        if len(carried) > 1:
            report("WARN", f"day {d}", f"{len(carried)} accessories carried from wk1-2 to wk3-4 "
                               f"(rule: max 1, unless a PENDING note exempts it): {sorted(carried)}")

    volume_table(prog, by_week)


def volume_table(prog, by_week):
    audit = {a["muscleGroup"]: a for a in prog.get("volumeAudit", [])}
    week = 2 if 2 in by_week else min(by_week)
    main, allsets = Counter(), Counter()
    for s in by_week[week]:
        for e in s["strength"]:
            allsets[e["category"]] += sets(e)
            if e["type"] != "accessory":
                main[e["category"]] += sets(e)
    print(f"\nWeekly volume, week {week} (target / audit claims / primary+secondary / all working sets)")
    for g, (lo, hi) in WEEKLY_TARGETS.items():
        claimed = audit.get(g, {}).get("weeklySetsProgrammed", "-")
        flag = "" if lo <= allsets[g] <= hi or lo <= main[g] <= hi else "  <- outside target either way"
        if claimed not in ("-", main[g], allsets[g]):
            flag += "  <- audit matches neither count"
        print(f"  {g:<20} {lo}-{hi:<4} {str(claimed):>4} {main[g]:>4} {allsets[g]:>4}{flag}")


def diff(prog, prev):
    print(f"\nChanges vs previous block ({prev.get('programName', '?')[:50]})")
    def primaries(p):  # keyed by lower/upper, since the weekday layout changed in Block 8
        out = defaultdict(list)
        for s in strength_sessions(p):
            if s["week"] == 2:
                for e in s["strength"]:
                    if e["type"] == "primary":
                        out["lower" if e["category"] in LOWER else "upper"].append(e["movement"])
        return {k: sorted(v) for k, v in out.items()}
    def movements(p):
        return {e["movement"] for s in strength_sessions(p) for e in s["strength"]}
    old, new = primaries(prev), primaries(prog)
    for d in sorted(set(old) | set(new)):
        if old.get(d) != new.get(d):
            print(f"  {d} primaries: {old.get(d)} -> {new.get(d)}")
    added, removed = movements(prog) - movements(prev), movements(prev) - movements(prog)
    if added:
        print(f"  added:   {', '.join(sorted(added))}")
    if removed:
        print(f"  removed: {', '.join(sorted(removed))}")
    lost = [tag(s) for s in prev["sessions"] if s.get("metconText")
            for n in prog["sessions"] if (n["week"], n["dayWithinWeek"]) == (s["week"], s["dayWithinWeek"])
            and not n.get("metconText")]
    if lost and prog.get("programName") == prev.get("programName"):
        report("FAIL", "re-import", f"metconText lost in {', '.join(lost)}")


def pending_checklist():
    text = RULEBOOK.read_text(encoding="utf-8")
    items = re.findall(r"^## (PENDING FOR NEXT CYCLE.*|RESOLVED.*)$", text, re.M)
    if items:
        print("\nBefore approving, confirm each rulebook note was asked about and handled:")
        for i in items:
            print(f"  [ ] {i}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("program")
    ap.add_argument("--prev")
    args = ap.parse_args()
    prog = json.loads(Path(args.program).read_text(encoding="utf-8"))
    check(prog)
    if args.prev:
        diff(prog, json.loads(Path(args.prev).read_text(encoding="utf-8")))
    pending_checklist()
    fails = [r for r in results if r[0] == "FAIL"]
    print(f"\n{len(fails)} FAIL, {len(results) - len(fails)} WARN")
    for level, where, msg in sorted(results, key=lambda r: (r[0] != "FAIL", r[1])):
        print(f"  {level:<4} {where:<14} {msg}")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
