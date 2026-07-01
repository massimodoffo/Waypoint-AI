// ── interactive.js ────────────────────────────────────────────────────────────
// Lightweight, dependency-free interaction polish: 3D tilt on result cards and
// parallax drift on the welcome screen. Both bail out on touch devices and
// when the user prefers reduced motion.

function motionAllowed() {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

// ── CARD TILT ────────────────────────────────────────────────────────────────
const TILT_SELECTOR = '.resto-card, .hotel-card, .activity-card';
const TILT_MAX_DEG = 6;

function applyTilt(card, e) {
  const rect = card.getBoundingClientRect();
  const px = (e.clientX - rect.left) / rect.width;
  const py = (e.clientY - rect.top) / rect.height;
  const rotateY = (px - 0.5) * TILT_MAX_DEG * 2;
  const rotateX = (0.5 - py) * TILT_MAX_DEG * 2;
  card.style.transition = 'transform 0.1s ease-out';
  card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-2px)`;
}

function resetTilt(card) {
  card.style.transition = 'transform 0.4s ease';
  card.style.transform = '';
}

function initCardTilt() {
  const chat = document.getElementById('chat');
  if (!chat || !motionAllowed()) return;

  chat.addEventListener('mousemove', (e) => {
    const card = e.target.closest(TILT_SELECTOR);
    if (card) applyTilt(card, e);
  });

  chat.addEventListener('mouseout', (e) => {
    const card = e.target.closest(TILT_SELECTOR);
    if (card && !card.contains(e.relatedTarget)) resetTilt(card);
  });
}

// ── WELCOME PARALLAX ──────────────────────────────────────────────────────────
const PARALLAX_SPEEDS = { '.welcome-ghost': -12, '.welcome-icon': 14, '.chips': 6 };

// .welcome-icon and .chips play a one-shot "slideUp ... both" entrance animation.
// Its fill-mode pins the transform property indefinitely, which silently wins
// over any inline transform we set — so parallax would never visibly move
// those layers. Drop the animation once it finishes to hand transform back to us.
function releaseEntranceAnimation(el) {
  if (!el || el.dataset.parallaxReady) return;
  el.dataset.parallaxReady = '1';
  el.addEventListener('animationend', () => { el.style.animation = 'none'; }, { once: true });
}

function handleWelcomeMove(chat, e) {
  const welcome = document.getElementById('welcome');
  if (!welcome) return false; // welcome screen is gone — caller should stop listening

  const rect = chat.getBoundingClientRect();
  const px = (e.clientX - rect.left) / rect.width - 0.5;
  const py = (e.clientY - rect.top) / rect.height - 0.5;

  for (const selector in PARALLAX_SPEEDS) {
    const el = welcome.querySelector(selector);
    if (el) el.style.transform = `translate(${px * PARALLAX_SPEEDS[selector]}px, ${py * PARALLAX_SPEEDS[selector]}px)`;
  }
  return true;
}

function initWelcomeParallax() {
  const chat = document.getElementById('chat');
  if (!chat || !motionAllowed()) return;

  const welcome = document.getElementById('welcome');
  if (welcome) {
    for (const selector in PARALLAX_SPEEDS) releaseEntranceAnimation(welcome.querySelector(selector));
  }

  // clearChat() rebuilds #welcome with the same id and calls this again — the
  // previous listener never observes #welcome as null (it was replaced, not
  // removed, in the same tick), so it never self-detaches. Explicitly swap it
  // out here instead of letting listeners pile up on #chat forever.
  if (chat._parallaxHandler) chat.removeEventListener('mousemove', chat._parallaxHandler);

  function onMove(e) {
    if (!handleWelcomeMove(chat, e)) {
      chat.removeEventListener('mousemove', onMove);
      chat._parallaxHandler = null;
    }
  }
  chat._parallaxHandler = onMove;
  chat.addEventListener('mousemove', onMove);
}

// ── EXPORTS ───────────────────────────────────────────────────────────────────
export { initCardTilt, initWelcomeParallax };
