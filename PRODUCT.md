# Product

## Register

product

## Users

Travelers planning a trip who want a fast, low-friction way to go from a vague idea ("a week in Japan") to a concrete itinerary. They're in a chat conversation, iterating with the app rather than filling out a form — asking for hotel swaps, budget checks, restaurant picks, and directions as follow-ups. Sessions happen on both desktop and mobile, often in short bursts (a few minutes at a time) rather than one long sitting.

## Product Purpose

Waypoint AI is an AI-driven travel planning assistant. A conversational front-end routes requests to specialist agents (itinerary, budget, hotels, local tips/restaurants, directions, weather) and renders their results as rich cards. Success looks like: the user trusts the itinerary enough to act on it, and follow-up edits feel as fast as the initial plan.

## Brand Personality

Cinematic & confident. The app already leans into agency-tier polish — a 3D globe splash, tactile card hover/tilt, a floating "island" nav, spring-based motion (`cubic-bezier(0.32,0.72,0,1)`), and a cobalt accent on a near-black canvas. The revamp should intensify this direction, not soften it: the product should feel like a premium, considered piece of software, not a utilitarian form-filler — while never sacrificing legibility or task speed for spectacle.

## Anti-references

Must not read as a generic SaaS dashboard: no gradient-clip hero-metric tiles, no identical icon+heading card grids, no boilerplate uppercase "eyebrow" tags stacked above every section, no side-stripe accent borders, no glassmorphism used decoratively rather than functionally. The floating nav's existing `backdrop-blur` is the one deliberate exception — it's functional (fixed/sticky), not decorative.

## Design Principles

1. **Motion earns its place.** Every animation must have a stated purpose (state feedback, spatial continuity, entrance) — never decoration for its own sake on frequently-seen elements (sending a chat message, opening the sidebar).
2. **Depth over flatness, restraint over spectacle.** Use the existing double-bezel/tactile card language (hover tilt, inset highlights, spring easing) consistently across every card type (itinerary, budget, hotels, directions, weather) rather than only on hero moments like the splash.
3. **Cobalt accent stays singular.** One accent color carries emphasis and interactive state; the four secondary accent hues (`--accent2..5`) are reserved for semantic/category differentiation (agents, tags), never decoration.
4. **Dark-first, light-equal.** Dark is the default and the primary design target, but light mode is a fully realized second theme, not an afterthought — verify contrast and shadow language in both.
5. **Speed is part of the craft.** Since this is a chat-driven tool used in short, iterative bursts, perceived responsiveness (fast button feedback, sub-300ms UI transitions) matters as much as visual polish.

## Accessibility & Inclusion

WCAG AA minimum: body text ≥4.5:1 contrast, large text ≥3:1, including placeholder text. Full `prefers-reduced-motion` support — every transform/opacity-driven animation gets a reduced-motion fallback (crossfade or instant), not just a global "turn off". Keyboard-navigable end to end (chat input, sidebar trip list, card actions). Touch-only devices must not trigger hover-gated interactions (`@media (hover: hover) and (pointer: fine)` guard).
