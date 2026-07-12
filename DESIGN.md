---
name: Waypoint AI
description: Cinematic AI travel-planning assistant — a night-flight-deck of dense, precise itinerary data rendered as living cards.
colors:
  cobalt: "#5b8fff"
  sage: "#8fa87a"
  teal: "#7a9fa8"
  mauve: "#a87a8f"
  tan: "#a8947a"
  ink-black: "#0e0f0e"
  panel-black: "#161714"
  raised-black: "#1e1f1c"
  paper: "#f0ede6"
  paper-muted: "#9e9b93"
  paper-faint: "#5c5a54"
typography:
  display:
    fontFamily: "Clash Display, sans-serif"
    fontSize: "clamp(2.8rem, 7.5vw, 6.5rem)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Clash Display, sans-serif"
    fontSize: "1.9rem"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Clash Display, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Switzer, sans-serif"
    fontSize: "15.5px"
    fontWeight: 400
    lineHeight: 1.8
  label:
    fontFamily: "Switzer, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    letterSpacing: "0.05em"
rounded:
  sm: "6px"
  md: "10px"
  lg: "16px"
  shell: "20px"
  pill: "999px"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.25rem"
  xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.cobalt}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.cobalt}"
    textColor: "#ffffff"
  card-shell:
    backgroundColor: "{colors.panel-black}"
    rounded: "{rounded.shell}"
    padding: "6px"
  card-core:
    backgroundColor: "{colors.panel-black}"
    textColor: "{colors.paper}"
    rounded: "{rounded.lg}"
---

# Design System: Waypoint AI

## 1. Overview

**Creative North Star: "Waypoint is a globe coming alive under your fingertips — every AI decision is a route drawn in real time, not a line of text."**

Waypoint AI is not a form that outputs a PDF itinerary; it's a flight deck. The user sits in a near-black cockpit (`#0e0f0e`) lit by a single cobalt instrument glow, watching four specialist agents work in parallel — each decision (a hotel, a stop, a route) resolving into a precise, tactile readout rather than a wall of prose. The globe on the splash screen isn't decoration; it's the thesis statement, rendered literally. Every card in the app after that point is a smaller echo of the same idea: information with weight, motion with intent, one color that means "this is live."

This system explicitly rejects the generic SaaS dashboard: no gradient-clip hero-metric tiles, no identical icon+heading card grids, no boilerplate uppercase eyebrow tags stacked above every section, no side-stripe accent borders, no decorative glassmorphism. The floating nav's `backdrop-blur` is the one deliberate exception — functional (fixed/sticky), not decorative.

**Key Characteristics:**
- Dark-first OLED canvas with a warm off-white ink, not pure white-on-black
- A single cobalt accent (`#5b8fff`) carries all "this is interactive / this is live" meaning; four muted secondary hues exist only for semantic tagging (food/culture/nature/nightlife categories), never for decoration
- Clash Display for anything that names or labels (headings, prices, agent identity); Switzer for anything read at length
- Spring-decelerated motion (`cubic-bezier(0.32,0.72,0,1)`) on every tactile interaction — cards lift, buttons press, chips depress
- Double-bezel card architecture: a quiet outer shell around the primary content surface, so major cards read as machined hardware rather than flat DOM boxes

## 2. Colors

The palette is a single saturated accent against a warm-neutral dark (or, in light mode, warm-neutral paper) ramp — Restrained-to-Committed strategy: cobalt is rare by area but unmistakable wherever it appears.

### Primary
- **Cobalt** (`#5b8fff` dark / `#2f5fd6` light): The one color that means "interactive, live, or currently true." Send button, active agent dots, active toggle states, the accent dot in the logo, hover borders on interactive elements, the itinerary timeline's route dots.

### Secondary (semantic tags only — never decorative)
- **Sage** (`#8fa87a` dark / `#4a7a3a` light): Nature tags, "done" status badges.
- **Slate Teal** (`#7a9fa8` dark / `#2a6b78` light): Culture tags, hotel category badges, rain-forecast figures.
- **Dusty Mauve** (`#a87a8f` dark / `#7a3a5e` light): Nightlife tags.
- **Warm Tan** (`#a8947a` dark / `#7a5a2e` light): Food tags.

### Neutral
- **Ink Black** (`#0e0f0e`): App background (dark mode). The cockpit itself.
- **Panel Black** (`#161714`): Card and sidebar surfaces — one step up from the void.
- **Raised Black** (`#1e1f1c`): Pressed/hover surface state, nested readouts (pricing/cost rows inside cards).
- **Paper** (`#f0ede6`): Primary text (dark mode) — warm off-white, never pure `#fff`.
- **Paper Muted** (`#9e9b93`): Secondary text, metadata.
- **Paper Faint** (`#5c5a54`): Tertiary text, placeholder, disabled.
- Light mode inverts the ramp onto warm paper (`#f7f5f0` bg / `#ffffff` panel / `#1a1916` ink) with the same role structure — see frontmatter is dark-canonical; light-mode hexes are documented in Do's and Don'ts.

### Named Rules
**The One Signal Rule.** Cobalt appears only where something is interactive or currently true (buttons, active states, live agent dots, the one accent dot). It never appears as a passive decorative wash across a whole section.

**The Warm Neutral Rule.** Backgrounds and text are never pure black/white. Ink Black carries a green undertone (`#0e0f0e`, not `#000`); Paper carries a warm cream undertone (`#f0ede6`, not `#fff`). This is what keeps the dark mode from reading as generic "dark SaaS."

## 3. Typography

**Display Font:** Clash Display (with `sans-serif` fallback)
**Body Font:** Switzer (with `sans-serif` fallback)

**Character:** A geometric, slightly architectural display face for anything that names or quantifies (headings, prices, city names), paired with a warmer, higher-x-height grotesk for anything read in paragraphs (chat replies, descriptions). The pairing reads as "instrument panel labels + pilot's notes."

### Hierarchy
- **Display** (400, `clamp(2.8rem, 7.5vw, 6.5rem)`, 1.05): Welcome-screen H1 only. Reserve for the single moment per screen that should read as a statement.
- **Headline** (500, `1.9rem`, 1.15, `-0.025em`): Itinerary hero title, weather city name.
- **Title** (500, `1.25rem`, 1.2, `-0.015em`): Card titles — hotel name, restaurant name, activity name.
- **Body** (400, `15.5px`–`16.5px`, 1.8): Chat bubbles. AI replies run slightly larger (`16.5px`) and borderless, in deliberate contrast to the filled user bubble, so they read as flowing editorial text rather than a boxed reply.
- **Label** (500, `10–12px`, `0.04–0.08em`, uppercase where used): Card section headers, badges, agent-pill status, sidebar section titles.

### Named Rules
**The No-Italic Rule.** Clash Display ships no italic face. Emphasis within display type is weight + cobalt color (`.em { font-weight: 600; color: var(--accent); }`), never a synthesized skew-italic.

## 4. Elevation

Hybrid: flat panels at rest, double-bezel nested shells on primary content surfaces, responsive lift on hover. Depth is structural (it tells you "this is a discrete object you can act on"), not ambient decoration.

### Shadow Vocabulary
- **Resting shadow** (`0 2px 14px rgba(10,8,2,0.45)` dark / `0 2px 14px rgba(60,46,10,0.1)` light): Default state for every card, warm-black tint (never pure `rgba(0,0,0,…)`, never tinted to the cobalt accent) so it reads as ambient shade, independent of accent hue.
- **Hover shadow** (`0 8px 28px rgba(10,8,2,0.4)` dark / `0 8px 28px rgba(60,46,10,0.14)` light): Paired with a `translateY(-3px)` lift on hover — the card physically rises toward the viewer.
- **Inset highlight** (`inset 0 1px 0 rgba(255,255,255,0.05)` dark / `inset 0 1px 0 rgba(255,255,255,0.6)` light): A one-pixel top-edge catch-light on every card, simulating a physical bevel under a single overhead light source.
- **Double-bezel shell** (outer: `padding: 6px; border-radius: 20px; background: var(--bg2); box-shadow: var(--shadow);` / inner core: `border-radius: 16px` — 4px smaller, concentric): Reserved for primary content surfaces (itinerary hero, result cards, the composer input) to read as a glass plate seated in a machined tray.

### Named Rules
**The Concentric Radius Rule.** Any nested shell's inner radius = outer radius − padding, so the curves stay visually concentric (20px shell around a 16px core with 6px padding, not two arbitrarily different radii).

## 5. Components

### Buttons
- **Shape:** Fully rounded pill (`border-radius: 999px`) for primary actions (send button); `6–8px` radius for compact toggle buttons (people-count, night-count, mode switches).
- **Primary (send button):** Cobalt fill, white icon, circular (`36×36px`). Hover lifts (`translateY(-1px) scale(1.06)`) with a cobalt glow shadow; active presses to `scale(0.94)`.
- **Ghost/Toggle (chip, rpb, hnb, dmb, wut):** Transparent fill, `1px` border in `--border2`, fills to `--bg3`/cobalt on hover/active. Active/selected state fills solid cobalt with white text — the same "this is currently true" signal as everywhere else.
- **Hover / Focus:** All buttons use the spring ease (`cubic-bezier(0.32,0.72,0,1)`) at 200–350ms; press states scale to `0.93–0.98`, never lower — nothing should look like it's disappearing.

### Chips (welcome-screen suggestion chips)
- **Style:** Transparent background, `1px` dashed-free solid border, `20px` pill radius.
- **State:** Hover fills `--bg3`, border turns cobalt, lifts `translateY(-2px)`; active adds a `scale(0.97)` press.

### Cards / Containers (result cards, hotel/resto/activity/weather/directions cards)
- **Corner Style:** `16px` inner radius; double-bezel outer shell `20px` where the shell pattern is applied (itinerary hero, primary result cards).
- **Background:** Panel Black (`#161714`) core inside an Ink-Black-tinted shell.
- **Shadow Strategy:** Resting shadow + inset highlight at rest; hover shadow + `translateY(-3px)` lift on interaction. See Elevation.
- **Border:** `1px solid var(--border)` at rest, brightening to `var(--border2)` on hover — never a colored border except the deliberate cobalt-tinted first card in a result grid (the "hero tile" convention).
- **Internal Padding:** Header `0.75–1.25rem`; body `0.75–1rem`; footer `0.6rem 1rem`.

### Inputs / Fields (composer textarea)
- **Style:** Panel Black background, `1px` border in `--border2`, `16px` radius, generous internal padding.
- **Focus:** Border brightens to cobalt at 40% opacity (`rgba(91,143,255,0.4)`) — no glow ring, no layout shift.

### Navigation
- **Style:** Floating "island" nav — detached from the viewport edge (`margin: 0.85rem 1.25rem 0`), `20px` radius, `backdrop-blur(16px) saturate(140%)`, sticky with matching top offset so the gap above it survives scroll. Clash Display logo with a cobalt dot; agent/status indicators use small colored dots, never full badges, to keep the bar quiet.
- **Mobile:** Nav margins compress; sidebar becomes a fixed off-canvas drawer (`left: -280px` → `left: 0`) instead of the desktop width-collapse.

### Agent Status (signature component)
Small colored dots (`--agent-dot`), not progress bars or spinners, represent each specialist agent's state: idle (faint), running (cobalt, `pulse` animation), done (sage). This keeps multi-agent parallelism legible at a glance without turning the sidebar into a dashboard of loaders.

## 6. Do's and Don'ts

### Do:
- **Do** keep cobalt (`#5b8fff` dark / `#2f5fd6` light) as the only color that signals interactivity or "currently true" — active toggles, hover borders, send button, live agent dots.
- **Do** use the spring ease `cubic-bezier(0.32,0.72,0,1)` for every tactile hover/press interaction; reserve plain `ease`/`ease-out` for passive fades only.
- **Do** pair a resting shadow + 1px inset top highlight on every card, brightening to a hover shadow + `translateY(-3px)` lift on interaction — never a static, shadowless card.
- **Do** keep Ink Black (`#0e0f0e`) and Paper (`#f0ede6`) warm-tinted, never pure `#000`/`#fff`.
- **Do** respect `prefers-reduced-motion`: entrance choreography (stagger, rise-and-fade) is cut entirely, not just shortened; functional feedback (hover color, focus) survives at a faster duration.
- **Do** gate all `:hover`-only affordances behind `@media (hover: hover) and (pointer: fine)` so touch devices don't get stuck in a false-hover state.

### Don't:
- **Don't** ship a generic SaaS dashboard: no gradient-clip hero-metric tiles, no identical icon+heading card grids repeated endlessly, no uppercase "eyebrow" kicker stacked above every section, no `border-left`/`border-right` colored stripes as accents.
- **Don't** use glassmorphism decoratively. `backdrop-blur` is reserved for the fixed/sticky nav island only — never on scrolling card content.
- **Don't** synthesize a fake italic for Clash Display; use weight + cobalt color for emphasis instead.
- **Don't** let a secondary accent (sage/teal/mauve/tan) leak into a role cobalt owns (buttons, active states) — they're semantic tags only.
- **Don't** animate `top`/`left`/`width`/`height`. Transform and opacity only, so motion stays GPU-cheap on mobile.
- **Don't** let scale-based entrance animations start from `scale(0)` — nothing in the real world appears from nothing; start from `scale(0.9)`+ with opacity.
