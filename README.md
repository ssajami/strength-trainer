# Strength Program Generator

A browser-based app that uses Claude AI to generate personalised strength-training programs, built for a post-menopausal CrossFit trainee focused on getting stronger, preserving bone density, and preventing sarcopenia.

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
2. Paste your **Anthropic API key** (starts with `sk-ant-`). Get one at [console.anthropic.com](https://console.anthropic.com).
3. Confirm your **age** and **bodyweight** (defaults: 55 / 65 kg).
4. Optionally add any known **1-rep maxes** under "Max loads."
5. Hit **Save settings**.
6. Back on home: pick a start date, program length, and click **Generate New Program**.

Generation takes 15–30 seconds. For the first program you can leave the feedback box empty.

---

## Storage

Everything is persisted in **localStorage** (your browser, no server needed):

| Key | Contents |
|-----|----------|
| `spt_profile` | Age, bodyweight, API key |
| `spt_max_loads` | Per-movement 1RM in kg |
| `spt_programs` | Last 15 programs (newest first) |
| `spt_last_comments` | Your feedback text from the last generation |

**Why localStorage?** Zero backend, zero hosting, works offline after first load, persists across browser sessions. The trade-off is data is device-specific — export/import is not yet implemented.

---

## Features

- **Generates complete programs** via Claude AI (`claude-sonnet-4-6`): warm-up, strength, CrossFit-style metcon, and mobility/cooldown per session.
- **Builds on prior programs**: the prompt includes your previous program's movements, the progression model used, and your feedback.
- **Max-load tracking**: when a movement uses percentage-based loading, you're prompted for your 1RM. Working weight is then displayed as e.g. `70 kg (70% of 100 kg)`, rounded to the nearest 2.5 kg.
- **Low-impact hard constraint**: no running, jump rope, or box jumps ever appear.
- **Evidence-based volume**: the prompt encodes per-muscle weekly set targets for post-menopausal trainees, with posterior chain never underloaded.
- **Mobile-first layout**: one session at a time, large tap targets, readable on a phone.

---

## Architecture

```
index.html          HTML shell + all screens (home, program, session detail)
css/styles.css      All styling — mobile-first, no frameworks
js/
  storage.js        localStorage wrapper — pure data layer, no UI
  programGen.js     Prompt building + Anthropic API call + JSON parsing
  app.js            UI layer — event handlers, DOM rendering, screen navigation
```

### Separation of concerns

- **`storage.js`** — knows nothing about the UI. Exposes `getProfile`, `saveMaxLoad`, `saveProgram`, etc.
- **`programGen.js`** — knows nothing about the DOM. Takes parameters, builds the Claude prompt, calls the API, returns a parsed program object.
- **`app.js`** — knows nothing about the API. Calls `ProgramGen.generate()` and `Storage.*` and renders the results.

To change how programs are generated (prompt logic, JSON schema): edit `programGen.js`.  
To change how programs are displayed: edit `app.js` and `css/styles.css`.

---

## Customising your profile

Beyond age/bodyweight in Settings, the hard-coded profile constraints live in `programGen.js` → `buildUserMessage()`. You can edit:
- Equipment list
- Mobility issues
- Volume targets per muscle group
- Metcon allowed/forbidden movements

---

## Getting an Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign in → API Keys → Create key
3. Copy the key (starts with `sk-ant-`) and paste it into Settings

Your key is stored only in your browser's localStorage and is sent directly to `api.anthropic.com` on each generation — never to any third-party server.
