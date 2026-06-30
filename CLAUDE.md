# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Deployment

This is a static frontend deployed on **Netlify**. There is no build step — files are served directly. The only backend is a Netlify serverless function at `netlify/functions/proxy.js`.

To preview locally, use any static file server:
```
npx serve .
# or
python3 -m http.server
```

The Netlify function requires an `ANTHROPIC_API_KEY` environment variable set in the Netlify dashboard. It will not work locally without a local Netlify dev setup (`netlify dev`).

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

**Conversation modes:** `main.js` tracks `conversationMode` with three states:
1. `chat` — gathering trip preferences; uses `CHAT_PROMPT`
2. `planning` — triggered when AI returns `[READY_TO_PLAN]`; runs 4 specialist agents in parallel via `Promise.all`
3. `done` — itinerary generated; follow-up messages are classified by `INTENT_PROMPT` and routed to specialist agents (restaurants, hotels, activities, directions, weather, or general)

**API proxy:** All Claude calls go through `/.netlify/functions/proxy` to keep the API key server-side. The proxy calls `claude-sonnet-4-5` with a 1000-token limit and trims history to the last 20 messages.

**Maps:** Leaflet.js (loaded via CDN) is used for the directions card. Weather data is fetched from the Open-Meteo API (free, no key required) via `cards.js`.
