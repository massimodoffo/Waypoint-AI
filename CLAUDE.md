# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## PR workflow (required)

Always open a pull request once a set of changes is complete — don't wait for it to be explicitly requested. Before opening any pull request:

1. Run `/commit-hygiene` to clean up and split staged changes into atomic, well-formed commits.
2. Run `/pre-pr-review` — this launches three subagents (`bug-hunter`, `security-reviewer`, `consistency-reviewer`) in parallel against the diff, then cross-references their findings. Fix any Must-fix issues and re-run before proceeding.
3. Run `/pr-description` to draft and open the PR once review is clean.

Never open a PR by running `gh pr create` directly without going through `/pre-pr-review` first.

### Subagents

- `bug-hunter`, `security-reviewer`, `consistency-reviewer` are read-only (no Edit/Write/Bash-write access). They report findings; the main session applies fixes.
- Don't ask them to fix issues directly — they diagnose, the main session (with your approval) fixes.

### Commit style

Conventional Commits: `type(scope): summary`. Types: feat, fix, refactor, chore, docs, style, test, perf.

### Lint / test / build

- Lint: `npm run lint` (fix: `npm run lint:fix`)
- Test: `npm run test` (pure functions only — formatters, parsers, route math; not Leaflet/DOM/network code)
- Build: no bundler in use. `npm run build` is a no-op placeholder — this project deploys static ES modules directly to Netlify. Add a real build step here if a bundler (Vite/esbuild) is introduced later.
- `pre-pr-review` and `commit-hygiene` should run lint before reporting findings — if lint fails, treat lint errors as must-fix alongside subagent findings.

## Deployment

This is a static frontend deployed on **Netlify**. There is no build step — files are served directly. The backend is two Netlify serverless functions: `netlify/functions/proxy.js` and `netlify/functions/maps-key.js`.

To preview locally, use any static file server:
```
npx serve .
# or
python3 -m http.server
```

The Netlify functions require environment variables set in the Netlify dashboard:
- `ANTHROPIC_API_KEY` (required) — used by `proxy.js` for all Claude calls.
- `GOOGLE_MAPS_EMBED_KEY` (optional) — used by `maps-key.js` to enable the real Google Maps embed on directions cards. Must be a Maps Embed API key restricted (in Google Cloud Console) to the deployed domain's HTTP referrer — that restriction is what makes it safe to hand to the client, the same way any client-side Google Maps key works. Without it, directions cards fall back to the free Leaflet/OpenStreetMap map — no functionality is lost, just the Google-branded look.

Functions will not work locally without a local Netlify dev setup (`netlify dev`).

## Architecture

**Frontend:** Vanilla JS using ES modules. `index.html` loads `js/main.js` as `type="module"`, which imports from all other JS files. Event handlers called from inline HTML attributes are explicitly attached to `window` at the bottom of `main.js`.

**Module responsibilities:**
- `js/agents.js` — All Claude API calls (`callClaude`) and every system prompt as named constants
- `js/main.js` — Conversation state machine (`sendMessage`, `generateItinerary`); routes user input based on `conversationMode`
- `js/trips.js` — Trip list state, sidebar rendering, trip CRUD
- `js/cards.js` — Renders rich result cards: itinerary, budget, hotels, restaurants, activities, directions, weather
- `js/chat.js` — DOM helpers for messages, typing indicator, agent status dots, markdown rendering
- `js/storage.js` — `localStorage` persistence for trips and chat history
- `js/theme.js` — Dark/light theme toggle, sidebar toggle
- `js/interactive.js` — Card tilt-on-hover and welcome-screen parallax hover effects
- `js/splash.js` — Entry splash screen: 3D globe (Three.js, loaded via CDN import map) and the "Start new chat" transition into the main app
- `js/globe-coastlines.js` — Static coastline/flight-hub coordinate data consumed by `js/splash.js`

**Conversation modes:** `main.js` tracks `conversationMode` with three states:
1. `chat` — gathering trip preferences; uses `CHAT_PROMPT`
2. `planning` — triggered when AI returns `[READY_TO_PLAN]`; runs 4 specialist agents in parallel via `Promise.all`
3. `done` — itinerary generated; follow-up messages are classified by `INTENT_PROMPT` and routed to specialist agents (restaurants, hotels, activities, directions, weather, or general)

**API proxy:** All Claude calls go through `/.netlify/functions/proxy` to keep the API key server-side. The proxy calls `claude-sonnet-4-5` with a 1000-token limit and trims history to the last 20 messages.

**Maps:** The directions card renders Google's own Maps Embed API when `GOOGLE_MAPS_EMBED_KEY` is configured (key delivered to the client via `netlify/functions/maps-key.js` — see Deployment above), falling back to Leaflet.js (vendored locally under `vendor/leaflet/`, not CDN-loaded — a blocked/slow CDN silently degraded every directions card to its link fallback) + OpenStreetMap tiles/OSRM routing when no key is set. Weather data is fetched from the Open-Meteo API (free, no key required) via `cards.js`.

**3D:** Three.js (loaded via a CDN import map in `index.html`) is used only by `js/splash.js` for the entry globe. It's dynamically imported and fails gracefully — the splash button still works — if the CDN or WebGL is unavailable.
