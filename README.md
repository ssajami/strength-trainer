# Strength Program Tracker

A browser-based app for a post-menopausal CrossFit trainee focused on getting stronger, preserving bone density, and preventing sarcopenia. Training cycles are generated in Claude Code (against the rulebook in `js/programGen.js`) and imported into the app as JSON; the app displays the program, tracks logged weights, and syncs everything to GitHub. An in-app chat is still available for on-the-fly questions and small on-the-spot adjustments.

---

## Quick start

**Option A — open directly (may hit CORS on some browsers):**
```
double-click index.html
```

**Option B — local server (recommended, avoids any CORS issues):**
```bash
# Python 3
python -m http.server 8080
# then open http://localhost:8080

# OR Node.js
npx serve .
# then open the printed URL
```

---

## First-time setup

1. Open the app and tap the **⚙ Settings** icon (top-right).
2. Paste your **Anthropic API key** (starts with `sk-ant-`) — used only by "Chat with coach," not by program generation. Get one at [console.anthropic.com](https://console.anthropic.com).
3. Confirm your **age** and **bodyweight** (defaults: 55 / 65 kg).
4. Optionally add any known **1-rep maxes** under "Max loads."
5. Hit **Save settings**.
6. Ask Claude Code to generate a new cycle (it reads your synced weights/notes and follows the rulebook in `js/programGen.js`), then paste the returned JSON into the **Import New Program** box on the home screen and click **Import Program**.

## Generating a new cycle

Program generation happens in Claude Code, not in the browser — this gives the coach full tool use (it can verify its own volume math) and the current model, instead of a single unverified API call from the page. To start a new cycle:

1. Ask Claude Code to generate the next cycle (mention any feedback — it can also read the "Notes for next cycle" text you leave in the app, synced via GitHub).
2. Claude Code generates and verifies a program JSON matching the schema documented in `js/programGen.js` → `buildRulesPrompt()`.
3. Paste that JSON into **Import New Program** on the home screen and hit **Import Program**.

The in-app chat is still available for quick questions or small tweaks to the current program.

---

## Storage

Everything is persisted in **localStorage** (your browser, no server needed):

| Key | Contents |
|-----|----------|
| `spt_profile` | Age, bodyweight, API key |
| `spt_max_loads` | Per-movement 1RM in kg |
| `spt_programs` | Last 15 programs (newest first) |
| `spt_last_comments` | Your notes for the next cycle |

**Why localStorage?** Zero backend, zero hosting, works offline after first load, persists across browser sessions. The trade-off is data is device-specific on its own — GitHub sync (below) and the "Download backup" button in Settings cover cross-device access and export.

---

## Features

- **Programs generated in Claude Code, imported as JSON**: warm-up, strength, and mobility/cooldown per session, checked against the rulebook before you paste it in.
- **On-the-fly coach chat** (`claude-sonnet-5`) for questions and small in-app tweaks to the current program.
- **You write your own metcons**: the app shows deterministic, session-specific guidance (computed in-app, no AI call) — what muscle groups/patterns the strength work already hit and what to avoid layering on top — plus a free-text box to paste or type your own metcon in any format.
- **Max-load tracking**: when a movement uses percentage-based loading, you're prompted for your 1RM. Working weight is then displayed as e.g. `70 kg (70% of 100 kg)`, rounded to the nearest 2.5 kg.
- **Low-impact hard constraint**: no running, jump rope, or box jumps ever appear.
- **Evidence-based volume**: the rulebook encodes per-muscle weekly set targets for post-menopausal trainees, with posterior chain never underloaded.
- **Mobile-first layout**: one session at a time, large tap targets, readable on a phone.
- **GitHub sync**: weights, logs, and programs sync to `data/sync.json` in this repo, so they're available across devices and to Claude Code when generating the next cycle.

---

## Architecture

```
index.html          HTML shell + all screens (home, program, session detail)
css/styles.css      All styling — mobile-first, no frameworks
js/
  storage.js        localStorage wrapper — pure data layer, no UI
  sync.js           GitHub sync — pushes/pulls data/sync.json
  programGen.js     Rulebook (shared with chat), JSON-import parsing, session time estimates
  chat.js           Coach chat — Anthropic API calls for on-the-fly Q&A/edits
  app.js            UI layer — event handlers, DOM rendering, screen navigation
```

### Separation of concerns

- **`storage.js`** — knows nothing about the UI. Exposes `getProfile`, `saveMaxLoad`, `saveProgram`, etc.
- **`programGen.js`** — knows nothing about the DOM or the network. Holds the generation rulebook (also used by `chat.js`) and parses/coerces imported program JSON into the app's schema.
- **`chat.js`** — calls the Anthropic API for the coach chat only; program generation itself happens in Claude Code, outside the browser.
- **`app.js`** — calls `ProgramGen.parseProgramJSON()` and `Storage.*` and renders the results.

To change the generation rulebook or JSON schema (used both by Claude Code and validated on import): edit `programGen.js` → `buildRulesPrompt()`.
To change how programs are displayed: edit `app.js` and `css/styles.css`.

---

## Customising your profile

Beyond age/bodyweight in Settings, the hard-coded profile constraints live in `programGen.js` → `buildRulesPrompt()`. You can edit:
- Equipment list
- Mobility issues
- Volume targets per muscle group
- The metcon movement pool (`METCON_MOVEMENTS`) used only for the in-app "what to avoid" guidance and movement suggestions — not for AI-generated metcons

---

## Getting an Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign in → API Keys → Create key
3. Copy the key (starts with `sk-ant-`) and paste it into Settings

Your key is stored only in your browser's localStorage and is sent directly to `api.anthropic.com` when you use "Chat with coach" — never to any third-party server.
