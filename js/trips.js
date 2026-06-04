// ── trips.js ──────────────────────────────────────────────────────────────────
// Trip state management: create, delete, switch, sidebar rendering, chat restore

import { saveTrips } from './storage.js';
import { appendMsg, renderMarkdown, formatDate } from './chat.js';
import { buildItinCard, buildResultCards, buildRestoCardHTML, buildHotelCardHTML, buildActivityCardHTML } from './cards.js';

// Shared mutable state — imported by main.js
export let trips = [{ id: 0, name: 'New trip', history: [], date: new Date() }];
export let currentTripId = 0;
export let tripCounter = 0;
export let conversationMode = 'chat';

export function setTrips(val) { trips = val; }
export function setCurrentTripId(val) { currentTripId = val; }
export function setTripCounter(val) { tripCounter = val; }
export function setConversationMode(val) { conversationMode = val; }

export function getCurrentTrip() {
  return trips.find(t => t.id === currentTripId);
}

export function newTrip() {
  tripCounter++;
  const t = { id: tripCounter, name: 'New trip', history: [], date: new Date(), _mode: 'chat' };
  trips.push(t);
  currentTripId = tripCounter;
  conversationMode = 'chat';
  saveTrips(trips, currentTripId, tripCounter);
  renderTripList();
  clearChat();
}

export function deleteTrip(id) {
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

export function renderTripList() {
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

export function clearChat() {
  const chat = document.getElementById('chat');
  chat.innerHTML = '';
  const welcome = document.createElement('div');
  welcome.className = 'welcome';
  welcome.id = 'welcome';
  welcome.innerHTML = `
    <div class="welcome-icon">✦</div>
    <h1>Plan your next <em>adventure</em></h1>
    <p>Tell me where you want to go and I will get to know your travel style before building your itinerary.</p>
    <div class="chips">
      <button class="chip" onclick="window.quickStart('I want to go to Japan for about 5 days. I love street food and hidden local spots.')">Japan · street food</button>
      <button class="chip" onclick="window.quickStart('Thinking about Paris for a long weekend. I love art, wine, and staying out late.')">Paris · art and nights</button>
      <button class="chip" onclick="window.quickStart('I want to explore Colombia. Big into coffee, beaches, and nightlife.')">Colombia · coffee and beaches</button>
    </div>`;
  chat.appendChild(welcome);
}

export function restoreChat() {
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
      } else if (!m.content.startsWith('Full itinerary generated')) {
        appendMsg('ai', m.content);
      }
    }
  });
  chat.scrollTop = chat.scrollHeight;
}
