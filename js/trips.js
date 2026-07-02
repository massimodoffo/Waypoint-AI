// ── trips.js ──────────────────────────────────────────────────────────────────
// Trip state management: create, delete, switch, sidebar rendering, chat restore

import { saveTrips } from './storage.js';
import { appendMsg, formatDate } from './chat.js';
import {
  buildItinCard, buildResultCards,
  buildRestoCardHTML, buildHotelCardHTML, buildActivityCardHTML,
  renderDirectionsCard, restoreWeatherCard
} from './cards.js';
import { initWelcomeParallax } from './interactive.js';

// Shared mutable state — imported by main.js
let trips = [{ id: 0, name: 'New trip', history: [], date: new Date() }];
let currentTripId = 0;
let tripCounter = 0;
let conversationMode = 'chat';

function setTrips(val) { trips = val; }
function setCurrentTripId(val) { currentTripId = val; }
function setTripCounter(val) { tripCounter = val; }
function setConversationMode(val) { conversationMode = val; }

function getCurrentTrip() {
  return trips.find(t => t.id === currentTripId);
}

function newTrip() {
  tripCounter++;
  const t = { id: tripCounter, name: 'New trip', history: [], date: new Date(), _mode: 'chat' };
  trips.push(t);
  currentTripId = tripCounter;
  conversationMode = 'chat';
  saveTrips(trips, currentTripId, tripCounter);
  renderTripList();
  clearChat();
}

function deleteTrip(id) {
  if (trips.length === 1) {
    trips = [{ id: 0, name: 'New trip', history: [], date: new Date() }];
    currentTripId = 0; tripCounter = 0; conversationMode = 'chat';
  } else {
    trips = trips.filter(t => t.id !== id);
    if (currentTripId === id) {
      currentTripId = trips[trips.length - 1].id;
      const cur = trips.find(t => t.id === currentTripId);
      conversationMode = cur?._mode || 'chat';
    }
  }
  saveTrips(trips, currentTripId, tripCounter);
  renderTripList();
  restoreChat();
}

function renderTripList() {
  const list = document.getElementById('tripList');
  list.innerHTML = '';
  [...trips].reverse().forEach(t => {
    const el = document.createElement('div');
    el.className = 'trip-entry' + (t.id === currentTripId ? ' active' : '');
    el.setAttribute('data-id', t.id);
    el.innerHTML = `
      <span class="trip-entry-icon">✦</span>
      <div style="flex:1;min-width:0">
        <div class="trip-entry-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.name}</div>
        <div class="trip-entry-meta">${formatDate(t.date)}</div>
      </div>
      <button data-del="${t.id}" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:14px;padding:2px 4px;opacity:0;transition:opacity 0.15s;flex-shrink:0" class="trip-del-btn">✕</button>`;
    el.onclick = (e) => {
      if (e.target.classList.contains('trip-del-btn')) {
        deleteTrip(t.id);
        return;
      }
      currentTripId = t.id;
      const cur = trips.find(tr => tr.id === t.id);
      conversationMode = cur?._mode || 'chat';
      renderTripList();
      restoreChat();
    };
    el.onmouseenter = () => { const btn = el.querySelector('.trip-del-btn'); if (btn) btn.style.opacity = '1'; };
    el.onmouseleave = () => { const btn = el.querySelector('.trip-del-btn'); if (btn) btn.style.opacity = '0'; };
    list.appendChild(el);
  });
}

// Single source of truth for the welcome screen — used both for the initial
// empty-chat render (index.html ships #chat empty) and for clearChat(), which
// previously built a second, drifted-out-of-sync copy of this markup inline.
function buildWelcomeEl() {
  const welcome = document.createElement('div');
  welcome.className = 'welcome';
  welcome.id = 'welcome';
  welcome.innerHTML = `
    <div class="welcome-ghost" aria-hidden="true">Waypoint</div>
    <div class="welcome-content">
      <div class="welcome-icon">✦</div>
      <h1>Plan your next <em>adventure</em></h1>
      <p>I'm Waypoint, your personal AI travel agent. Tell me where you want to go and I'll get to know your travel style before building your perfect itinerary.</p>
      <div style="background:var(--bg2);border:1px solid var(--border2);border-radius:var(--radius-lg);padding:1.25rem 1.5rem;max-width:480px;text-align:left;margin-bottom:1.5rem;width:100%">
        <div style="font-size:11px;font-weight:500;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:0.85rem">How to get started</div>
        <div style="font-size:13px;color:var(--text2);line-height:1.9">
          <div style="margin-bottom:5px"><span style="color:var(--accent)">1.</span> Tell me <strong style="color:var(--text)">where</strong> you want to go</div>
          <div style="margin-bottom:5px"><span style="color:var(--accent)">2.</span> Share <strong style="color:var(--text)">how long</strong> you are thinking</div>
          <div style="margin-bottom:5px"><span style="color:var(--accent)">3.</span> Describe <strong style="color:var(--text)">what you love</strong> — food, culture, nightlife, nature, adventure</div>
          <div><span style="color:var(--accent)">4.</span> I will ask follow-up questions, then build your full trip</div>
        </div>
      </div>
      <div style="font-size:13px;color:var(--text3);margin-bottom:1rem">Or jump in with one of these:</div>
      <div class="chips">
        <button class="chip" data-prompt="I want to go to Japan for about 5 days. I love street food and hidden local spots.">Japan · street food</button>
        <button class="chip" data-prompt="Thinking about Paris for a long weekend. I love art, wine, and staying out late.">Paris · art & nights</button>
        <button class="chip" data-prompt="I want to explore Colombia. Big into coffee, beaches, and nightlife.">Colombia · coffee & beaches</button>
        <button class="chip" data-prompt="Portugal for 10 days, slow travel. Wine, old towns, seafood, maybe some surfing.">Portugal · slow travel</button>
      </div>
    </div>`;
  welcome.querySelectorAll('.chip[data-prompt]').forEach(btn => {
    btn.addEventListener('click', () => {
      // quickStart is exposed on window by main.js
      if (typeof window.quickStart === 'function') window.quickStart(btn.getAttribute('data-prompt'));
    });
  });
  return welcome;
}

function clearChat() {
  const chat = document.getElementById('chat');
  chat.innerHTML = '';
  chat.appendChild(buildWelcomeEl());
  // The parallax listener detaches itself once #welcome is gone — reattach for the fresh one
  initWelcomeParallax();
}

function restoreChat() {
  const trip = trips.find(t => t.id === currentTripId);
  if (!trip || !trip.history || trip.history.length === 0) { clearChat(); return; }
  const chat = document.getElementById('chat');
  const welcome = document.getElementById('welcome');
  if (welcome) welcome.remove();
  chat.innerHTML = '';

  trip.history.forEach(m => {
    if (m.role === 'user') {
      appendMsg('user', m.content);
    } else if (m.role === 'assistant') {
      if (m.cardType === 'summary') {
        appendMsg('ai', m.content);
      } else if (m.cardType === 'itinerary' && m.cardData) {
        const wrap = document.createElement('div');
        wrap.className = 'msg ai';
        wrap.innerHTML = '<div class="avatar ai" style="opacity:0"></div>';
        wrap.appendChild(buildItinCard(m.cardData.itin, m.cardData.destination, m.cardData.duration));
        chat.appendChild(wrap);
      } else if (m.cardType === 'results' && m.cardData) {
        const wrap = document.createElement('div');
        wrap.className = 'msg ai';
        wrap.innerHTML = '<div class="avatar ai" style="opacity:0"></div>';
        wrap.appendChild(buildResultCards(m.cardData.budget, m.cardData.hotels, m.cardData.local));
        chat.appendChild(wrap);
      } else if (m.cardType === 'restaurants' && m.cardData) {
        appendMsg('ai', m.cardData.intro);
        const wrap = document.createElement('div');
        wrap.className = 'msg ai';
        wrap.innerHTML = '<div class="avatar ai" style="opacity:0"></div>';
        const grid = document.createElement('div'); grid.className = 'resto-grid';
        m.cardData.restaurants.forEach((r, idx) => {
          const cardId = 'rc-restore-' + m._id + '-' + idx;
          const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(r.google_maps_query);
          const stars = parseFloat(r.rating) >= 4.5 ? '★★★★★' : parseFloat(r.rating) >= 4.0 ? '★★★★☆' : '★★★☆☆';
          const card = document.createElement('div'); card.className = 'resto-card';
          card.innerHTML = buildRestoCardHTML(r, cardId, mapsUrl, stars);
          grid.appendChild(card);
        });
        wrap.appendChild(grid); chat.appendChild(wrap);
      } else if (m.cardType === 'hotels' && m.cardData) {
        appendMsg('ai', m.cardData.intro);
        const wrap = document.createElement('div');
        wrap.className = 'msg ai';
        wrap.innerHTML = '<div class="avatar ai" style="opacity:0"></div>';
        const grid = document.createElement('div'); grid.className = 'hotel-grid';
        m.cardData.hotels.forEach((h, idx) => {
          const cardId = 'hc-restore-' + m._id + '-' + idx;
          const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(h.google_maps_query);
          const stars = parseFloat(h.rating) >= 4.5 ? '★★★★★' : parseFloat(h.rating) >= 4.0 ? '★★★★☆' : '★★★☆☆';
          const card = document.createElement('div'); card.className = 'hotel-card';
          card.innerHTML = buildHotelCardHTML(h, cardId, mapsUrl, stars);
          grid.appendChild(card);
        });
        wrap.appendChild(grid); chat.appendChild(wrap);
      } else if (m.cardType === 'activities' && m.cardData) {
        appendMsg('ai', m.cardData.intro);
        const wrap = document.createElement('div');
        wrap.className = 'msg ai';
        wrap.innerHTML = '<div class="avatar ai" style="opacity:0"></div>';
        const grid = document.createElement('div'); grid.className = 'activity-grid';
        m.cardData.activities.forEach(a => {
          const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(a.google_maps_query);
          const stars = parseFloat(a.rating) >= 4.5 ? '★★★★★' : parseFloat(a.rating) >= 4.0 ? '★★★★☆' : '★★★☆☆';
          const card = document.createElement('div'); card.className = 'activity-card';
          card.innerHTML = buildActivityCardHTML(a, mapsUrl, stars);
          grid.appendChild(card);
        });
        wrap.appendChild(grid); chat.appendChild(wrap);
      } else if (m.cardType === 'weather' && m.cardData) {
        appendMsg('ai', 'Restoring live weather for ' + m.cardData.city + '...');
        restoreWeatherCard(m.cardData);
      } else if (m.cardType === 'directions' && m.cardData) {
        renderDirectionsCard(m.cardData);
      } else if (!m.content.startsWith('Full itinerary generated')) {
        appendMsg('ai', m.content);
      }
    }
  });
  chat.scrollTop = chat.scrollHeight;
}

// ── EXPORTS ───────────────────────────────────────────────────────────────────
export {
  trips, currentTripId, tripCounter, conversationMode,
  setTrips, setCurrentTripId, setTripCounter, setConversationMode,
  getCurrentTrip, newTrip, renderTripList, clearChat, restoreChat
};
