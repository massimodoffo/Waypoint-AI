// ── cards.js ──────────────────────────────────────────────────────────────────
// All card builders: itinerary, results, restaurant, hotel, activity

import { escHtml, appendMsg } from './chat.js';


// ── ITINERARY CARD ────────────────────────────────────────────────────────────
function buildItinCard(itin, dest, dur) {
  const div = document.createElement('div');
  div.className = 'itin-full';
  div.innerHTML = `
    <div class="itin-hero">
      <h2>${dest}</h2>
      <div class="itin-meta-row"><span class="itin-badge">✦ ${dur}</span></div>
    </div>
    <div class="itin-days">
      ${itin.days.map(d => `
        <div class="day-block">
          <div class="day-header">
            <div class="day-header-left">Day ${d.day} — ${d.theme}</div>
          </div>
          ${d.stops.map(s => `
            <div class="stop">
              <div class="stop-time">${s.time}</div>
              <div class="stop-body">
                <div class="stop-name">${s.name}</div>
                <div class="stop-desc">${s.description}</div>
                <div class="stop-tags"><span class="stag stag-${s.tag}">${s.tag}</span></div>
              </div>
            </div>`).join('')}
        </div>`).join('')}
    </div>`;
  return div;
}

// ── RESULTS CARDS (budget, hotels, local) ────────────────────────────────────
function buildResultCards(budget, hotels, local) {
  const grid = document.createElement('div');
  grid.className = 'result-grid';

  // Budget card
  const bc = document.createElement('div');
  bc.className = 'result-card';
  bc.innerHTML = `
    <div class="rc-header"><div class="rc-dot" style="background:var(--accent5)"></div>Budget</div>
    <div class="rc-body">
      <div style="font-size:18px;font-family:'Fraunces',serif;color:var(--text);margin-bottom:6px">
        ${budget.daily_estimate}<span style="font-size:11px;color:var(--text3)"> /day</span>
      </div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:10px">Total: ${budget.total_estimate}</div>
      ${Object.entries(budget.breakdown).map(([k, v]) => `
        <div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;border-bottom:1px solid var(--border)">
          <span style="color:var(--text2);text-transform:capitalize">${k}</span>
          <span style="color:var(--text)">${v}</span>
        </div>`).join('')}
      <div style="margin-top:10px;font-size:12px;color:var(--text2)">
        ${budget.money_tips.map(t => `<div style="margin-bottom:4px">· ${t}</div>`).join('')}
      </div>
    </div>`;
  grid.appendChild(bc);

  // Hotels card
  const hc = document.createElement('div');
  hc.className = 'result-card';
  hc.innerHTML = `
    <div class="rc-header"><div class="rc-dot" style="background:var(--accent3)"></div>Where to stay</div>
    <div class="rc-body">
      ${hotels.hotel_picks.map(h => `
        <div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--border)">
          <div style="font-weight:500;font-size:13px;color:var(--text)">${h.name}</div>
          <div style="font-size:11px;color:var(--accent3);margin:2px 0">${h.price_range} · ${h.type}</div>
          <div style="font-size:12px;color:var(--text2)">${h.why}</div>
        </div>`).join('')}
      <div style="font-size:12px;color:var(--text2);margin-top:4px">💡 ${hotels.booking_tips}</div>
    </div>`;
  grid.appendChild(hc);

  // Local tips card
  const lc = document.createElement('div');
  lc.className = 'result-card';
  lc.style.gridColumn = '1/-1';
  lc.innerHTML = `
    <div class="rc-header"><div class="rc-dot" style="background:var(--accent2)"></div>Local insider tips</div>
    <div class="rc-body" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div>
        <div style="font-size:11px;font-weight:500;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Insider tips</div>
        ${local.insider_tips.map(t => `<div style="font-size:12px;color:var(--text2);margin-bottom:5px">· ${t}</div>`).join('')}
      </div>
      <div>
        <div style="font-size:11px;font-weight:500;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Avoid</div>
        ${local.avoid.map(t => `<div style="font-size:12px;color:var(--text2);margin-bottom:5px">· ${t}</div>`).join('')}
        <div style="margin-top:10px;font-size:11px;font-weight:500;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Useful phrases</div>
        ${local.phrases.map(p => `
          <div style="font-size:12px;margin-bottom:4px">
            <span style="color:var(--accent);font-style:italic">${p.phrase}</span>
            <span style="color:var(--text3)">— ${p.means}</span>
          </div>`).join('')}
      </div>
    </div>`;
  grid.appendChild(lc);
  return grid;
}

// ── SHARED CARD HTML BUILDERS ─────────────────────────────────────────────────
function buildRestoCardHTML(r, cardId, mapsUrl, stars) {
  return `
    <div class="resto-header">
      <div class="resto-name-row">
        <a class="resto-name" href="${r.booking_url}" target="_blank" rel="noopener">
          ${escHtml(r.name)}<span class="resto-name-link-icon">↗</span>
        </a>
        <div class="resto-cuisine">${escHtml(r.cuisine)} · ${escHtml(r.meal_type)}</div>
      </div>
      <div class="resto-rating-badge">${stars} ${r.rating}</div>
    </div>
    <div class="resto-divider"></div>
    <div class="resto-body">
      <div class="resto-desc">${escHtml(r.description)}</div>
      <div class="resto-meta-row">
        <div class="resto-tag"><span class="resto-tag-icon">✦</span> Must order: ${escHtml(r.must_order)}</div>
      </div>
      <div class="resto-pricing">
        <div class="resto-pricing-title">Estimated cost</div>
        <div class="resto-pricing-row">
          <div class="resto-people-btns">
            ${[1, 2, 3, 4].map(n => `<button class="rpb${n === 1 ? ' active' : ''}" onclick="updateRestoPrice('${cardId}', ${r.price_per_person}, ${n}, this)">${n}</button>`).join('')}
            <button class="rpb" onclick="updateRestoPricePlus('${cardId}', ${r.price_per_person}, this)" style="width:auto;padding:0 8px">+</button>
          </div>
          <div class="resto-price-display" id="${cardId}-price">$${r.price_per_person} <span>per person / 1 guest</span></div>
        </div>
      </div>
    </div>
    <div class="resto-footer">
      <div class="resto-location">📍 ${escHtml(r.neighborhood)}</div>
      <a class="resto-maps-btn" href="${mapsUrl}" target="_blank" rel="noopener">Open in Maps ↗</a>
    </div>`;
}

function buildHotelCardHTML(h, cardId, mapsUrl, stars) {
  const amenityHtml = (h.amenities || []).map(a => `<span class="hotel-amenity">${escHtml(a)}</span>`).join('');
  return `
    <div class="hotel-header">
      <div class="hotel-name-row">
        <a class="hotel-name" href="${h.booking_url}" target="_blank" rel="noopener">
          ${escHtml(h.name)} <span style="font-size:11px;color:var(--text3)">↗</span>
        </a>
        <div class="hotel-type">${escHtml(h.type)} · Best for: ${escHtml(h.best_for)}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px">
        <div class="hotel-rating-badge">${stars} ${h.rating}</div>
        <div class="hotel-price-badge">
          <div class="hotel-price-main">$${h.price_per_night}</div>
          <div class="hotel-price-sub">per night</div>
        </div>
      </div>
    </div>
    <div class="resto-divider"></div>
    <div class="hotel-body">
      <div class="hotel-desc">${escHtml(h.description)}</div>
      <div class="hotel-amenities">${amenityHtml}</div>
      <div class="hotel-nights-calc">
        <div class="hotel-nights-title">Estimated stay cost</div>
        <div class="hotel-nights-row">
          <div class="hotel-nights-btns">
            <button class="hnb" onclick="changeNights('${cardId}', ${h.price_per_night}, -1)">−</button>
            <span class="hnb-count" id="${cardId}-nights">3</span>
            <button class="hnb" onclick="changeNights('${cardId}', ${h.price_per_night}, 1)">+</button>
            <span style="font-size:12px;color:var(--text3);margin-left:4px">nights</span>
          </div>
          <div class="hotel-total-display" id="${cardId}-total">$${h.price_per_night * 3} <span>total</span></div>
        </div>
      </div>
    </div>
    <div class="hotel-footer">
      <div class="hotel-location">📍 ${escHtml(h.neighborhood)}</div>
      <a class="hotel-book-btn" href="${mapsUrl}" target="_blank" rel="noopener">Open in Maps ↗</a>
    </div>`;
}

function buildActivityCardHTML(a, mapsUrl, stars) {
  const tagHtml = (a.tags || []).map(t => `<span class="activity-tag">${escHtml(t)}</span>`).join('');
  const costText = a.price_per_person === 0 ? 'Free' : `$${a.price_per_person} <span>per person</span>`;
  return `
    <div class="activity-header">
      <div class="activity-name-row">
        <a class="activity-name" href="${a.booking_url}" target="_blank" rel="noopener">
          ${escHtml(a.name)} <span style="font-size:11px;color:var(--text3)">↗</span>
        </a>
        <div class="activity-category">${escHtml(a.category)} · ${escHtml(a.best_time)}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px">
        <div class="activity-rating-badge">${stars} ${a.rating}</div>
        <div class="activity-duration-badge">⏱ ${escHtml(a.duration)}</div>
      </div>
    </div>
    <div class="resto-divider"></div>
    <div class="activity-body">
      <div class="activity-desc">${escHtml(a.description)}</div>
      <div class="activity-tags">${tagHtml}</div>
      <div class="activity-cost-row">
        <div class="activity-cost-label">Cost per person</div>
        <div class="activity-cost-val">${costText}</div>
      </div>
      <div style="background:rgba(200,184,122,0.06);border:1px solid rgba(200,184,122,0.15);border-radius:var(--radius);padding:0.55rem 0.75rem;margin-top:0.5rem;font-size:12px;color:var(--text2)">
        <span style="color:var(--accent);font-size:11px">✦ Insider tip:</span> ${escHtml(a.insider_tip)}
      </div>
    </div>
    <div class="activity-footer">
      <div class="activity-location">📍 ${escHtml(a.neighborhood)}</div>
      <a class="activity-book-btn" href="${mapsUrl}" target="_blank" rel="noopener">Open in Maps ↗</a>
    </div>`;
}

// ── RENDER FUNCTIONS ──────────────────────────────────────────────────────────
function renderRestaurantCards(data) {
  const chat = document.getElementById('chat');
  const welcome = document.getElementById('welcome');
  if (welcome) welcome.remove();

  appendMsg('ai', data.intro);

  const wrap = document.createElement('div');
  wrap.className = 'msg ai';
  wrap.innerHTML = '<div class="avatar ai" style="opacity:0"></div>';
  const grid = document.createElement('div');
  grid.className = 'resto-grid';

  data.restaurants.forEach((r, idx) => {
    const card = document.createElement('div');
    card.className = 'resto-card';
    const cardId = 'rc-' + Date.now() + '-' + idx;
    const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(r.google_maps_query);
    const stars = parseFloat(r.rating) >= 4.5 ? '★★★★★' : parseFloat(r.rating) >= 4.0 ? '★★★★☆' : '★★★☆☆';
    card.innerHTML = buildRestoCardHTML(r, cardId, mapsUrl, stars);
    grid.appendChild(card);
  });

  wrap.appendChild(grid);
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}

function renderHotelCards(data) {
  const chat = document.getElementById('chat');
  const welcome = document.getElementById('welcome');
  if (welcome) welcome.remove();

  appendMsg('ai', data.intro);

  const wrap = document.createElement('div');
  wrap.className = 'msg ai';
  wrap.innerHTML = '<div class="avatar ai" style="opacity:0"></div>';
  const grid = document.createElement('div');
  grid.className = 'hotel-grid';

  data.hotels.forEach((h, idx) => {
    const card = document.createElement('div');
    card.className = 'hotel-card';
    const cardId = 'hc-' + Date.now() + '-' + idx;
    const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(h.google_maps_query);
    const stars = parseFloat(h.rating) >= 4.5 ? '★★★★★' : parseFloat(h.rating) >= 4.0 ? '★★★★☆' : '★★★☆☆';
    card.innerHTML = buildHotelCardHTML(h, cardId, mapsUrl, stars);
    grid.appendChild(card);
  });

  wrap.appendChild(grid);
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}

function renderActivityCards(data) {
  const chat = document.getElementById('chat');
  const welcome = document.getElementById('welcome');
  if (welcome) welcome.remove();

  appendMsg('ai', data.intro);

  const wrap = document.createElement('div');
  wrap.className = 'msg ai';
  wrap.innerHTML = '<div class="avatar ai" style="opacity:0"></div>';
  const grid = document.createElement('div');
  grid.className = 'activity-grid';

  data.activities.forEach(a => {
    const card = document.createElement('div');
    card.className = 'activity-card';
    const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(a.google_maps_query);
    const stars = parseFloat(a.rating) >= 4.5 ? '★★★★★' : parseFloat(a.rating) >= 4.0 ? '★★★★☆' : '★★★☆☆';
    card.innerHTML = buildActivityCardHTML(a, mapsUrl, stars);
    grid.appendChild(card);
  });

  wrap.appendChild(grid);
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}

// ── INTERACTIVE PRICE UPDATERS (called from inline onclick) ───────────────────
// These need to be on window since they're called from innerHTML onclick attributes
window.updateRestoPrice = function(cardId, pricePerPerson, people, btn) {
  const display = document.getElementById(cardId + '-price');
  if (!display) return;
  display.innerHTML = `$${pricePerPerson * people} <span>total / ${people} guest${people > 1 ? 's' : ''}</span>`;
  btn.closest('.resto-people-btns').querySelectorAll('.rpb').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
};

window.updateRestoPricePlus = function(cardId, pricePerPerson, btn) {
  const display = document.getElementById(cardId + '-price');
  if (!display) return;
  const match = display.textContent.match(/(\d+)\s*guest/);
  const next = match ? parseInt(match[1]) + 1 : 5;
  display.innerHTML = `$${pricePerPerson * next} <span>total / ${next} guests</span>`;
  btn.closest('.resto-people-btns').querySelectorAll('.rpb:not([onclick*="Plus"])').forEach(b => b.classList.remove('active'));
};

window.changeNights = function(cardId, pricePerNight, delta) {
  const nightsEl = document.getElementById(cardId + '-nights');
  const totalEl = document.getElementById(cardId + '-total');
  if (!nightsEl || !totalEl) return;
  const next = Math.max(1, parseInt(nightsEl.textContent) + delta);
  nightsEl.textContent = next;
  totalEl.innerHTML = `$${pricePerNight * next} <span>total</span>`;
};

// ── DIRECTIONS CARD ───────────────────────────────────────────────────────────
// A free, keyless built-in map. Google retired its keyless embed, so the map
// itself is rendered with Leaflet + OpenStreetMap tiles (no key, no billing),
// places markers for both points, and draws the real route via the free OSRM
// service (falling back to a straight line if OSRM is unavailable). The
// "Open in Maps" button still hands off to Google for full turn-by-turn.
//
// Requires Leaflet to be loaded on the page (added via CDN in index.html).
const DIR_MODE_ICON = { driving: '🚗', walking: '🚶', transit: '🚇' };
const DIR_MODE_LABEL = { driving: 'Driving', walking: 'Walking', transit: 'Transit' };

function dirOpenUrl(origin, destination, mode) {
  const o = encodeURIComponent(origin || '');
  const d = encodeURIComponent(destination || '');
  return `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${d}&travelmode=${mode}`;
}

// Geocode a place name → {lat, lon} using OpenStreetMap Nominatim (free, no key)
async function geocodeOSM(query) {
  if (!query || !query.trim()) return null;
  const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=' + encodeURIComponent(query);
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

// Get a road-following route geometry between two points via the free OSRM demo
async function routeOSM(a, b) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes || !data.routes.length) return null;
    // GeoJSON coords are [lon, lat]; Leaflet wants [lat, lon]
    return data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
  } catch { return null; }
}

function buildDirectionsHTML(domId, data, mode) {
  const hasOrigin = data.origin && data.origin.trim() !== '';
  const modeBtns = ['driving','walking','transit'].map(m =>
    `<button class="dmb${m === mode ? ' active' : ''}" data-mode="${m}" onclick="switchDirectionsMode('${domId}', '${m}')">${DIR_MODE_ICON[m]} ${DIR_MODE_LABEL[m]}</button>`
  ).join('');

  return `
    <div class="directions-header">
      <div class="directions-route">
        ${hasOrigin ? `
          <div class="directions-from">
            <div class="directions-dot from"></div>
            <span>${escHtml(data.origin_label || data.origin)}</span>
          </div>
          <div class="directions-line"></div>` : ''}
        <div class="directions-to">
          <div class="directions-dot to"></div>
          <span>${escHtml(data.destination_label || data.destination)}</span>
        </div>
      </div>
      <div class="directions-mode-badge">${DIR_MODE_ICON[mode] || '🗺'} ${DIR_MODE_LABEL[mode] || mode}</div>
    </div>
    ${data.context ? `<div class="directions-context">${escHtml(data.context)}</div>` : ''}
    <div class="directions-map" id="dmap-${domId}"><div class="directions-map-loading">Loading map…</div></div>
    <div class="directions-footer">
      <div class="directions-mode-btns">${modeBtns}</div>
      <a class="directions-open-btn" href="${dirOpenUrl(data.origin, data.destination, mode)}" target="_blank" rel="noopener">Open in Maps ↗</a>
    </div>`;
}

// Build the Leaflet map inside the card's map container
async function initDirectionsMap(domId) {
  const entry = window._dirCache[domId];
  if (!entry) return;
  const mapDiv = document.getElementById('dmap-' + domId);
  if (!mapDiv) return;
  const { data } = entry;

  if (!window.L) {
    mapDiv.innerHTML = `<a class="directions-map-cta" href="${dirOpenUrl(data.origin, data.destination, entry.mode)}" target="_blank" rel="noopener"><div class="directions-map-cta-icon">🗺</div><div class="directions-map-cta-text">Open the route in Google Maps</div><div class="directions-map-cta-sub">↗</div></a>`;
    return;
  }

  try {
    const dest = await geocodeOSM(data.destination);
    if (!dest) throw new Error('Could not locate ' + data.destination);
    const origin = data.origin && data.origin.trim() ? await geocodeOSM(data.origin) : null;

    mapDiv.innerHTML = '';
    const map = window.L.map(mapDiv, { zoomControl: true, scrollWheelZoom: false });
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap'
    }).addTo(map);
    entry.map = map;

    window.L.circleMarker([dest.lat, dest.lon], { radius: 8, color: '#c8b87a', fillColor: '#c8b87a', fillOpacity: 1, weight: 2 })
      .addTo(map).bindPopup(data.destination_label || data.destination);

    if (origin) {
      window.L.circleMarker([origin.lat, origin.lon], { radius: 6, color: '#c8b87a', fillColor: '#1e1f1c', fillOpacity: 1, weight: 2 })
        .addTo(map).bindPopup(data.origin_label || data.origin);

      const route = await routeOSM(origin, dest);
      if (route) {
        window.L.polyline(route, { color: '#c8b87a', weight: 4, opacity: 0.9 }).addTo(map);
        map.fitBounds(window.L.latLngBounds(route).pad(0.12));
      } else {
        const line = [[origin.lat, origin.lon], [dest.lat, dest.lon]];
        window.L.polyline(line, { color: '#c8b87a', weight: 3, opacity: 0.7, dashArray: '6,7' }).addTo(map);
        map.fitBounds(window.L.latLngBounds(line).pad(0.2));
      }
    } else {
      map.setView([dest.lat, dest.lon], 14);
    }

    // Leaflet needs a size recalc once the card has settled into the layout
    setTimeout(() => map.invalidateSize(), 250);
  } catch (err) {
    console.error('[Waypoint] directions map failed:', err);
    mapDiv.innerHTML = `<a class="directions-map-cta" href="${dirOpenUrl(data.origin, data.destination, entry.mode)}" target="_blank" rel="noopener"><div class="directions-map-cta-icon">🗺</div><div class="directions-map-cta-text">Open the route in Google Maps</div><div class="directions-map-cta-sub">↗</div></a>`;
  }
}

function renderDirectionsCard(data) {
  const chat = document.getElementById('chat');
  const welcome = document.getElementById('welcome');
  if (welcome) welcome.remove();

  const wrap = document.createElement('div');
  wrap.className = 'msg ai';
  wrap.innerHTML = '<div class="avatar ai" style="opacity:0"></div>';

  const card = document.createElement('div');
  card.className = 'directions-card';
  const domId = 'dir-' + Date.now();
  card.id = domId;

  const mode = data.travel_mode || 'driving';
  window._dirCache = window._dirCache || {};
  window._dirCache[domId] = { data, mode, map: null };
  card.innerHTML = buildDirectionsHTML(domId, data, mode);

  wrap.appendChild(card);
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;

  // Build the map after the card is in the DOM
  initDirectionsMap(domId);
}

window._dirCache = window._dirCache || {};

// Switch travel mode WITHOUT tearing down the map — just update the badge,
// the active button, and the Google hand-off link.
window.switchDirectionsMode = function(domId, mode) {
  const card = document.getElementById(domId);
  const entry = window._dirCache[domId];
  if (!card || !entry) return;
  entry.mode = mode;

  const badge = card.querySelector('.directions-mode-badge');
  if (badge) badge.textContent = (DIR_MODE_ICON[mode] || '🗺') + ' ' + (DIR_MODE_LABEL[mode] || mode);

  const openBtn = card.querySelector('.directions-open-btn');
  if (openBtn) openBtn.href = dirOpenUrl(entry.data.origin, entry.data.destination, mode);

  card.querySelectorAll('.dmb').forEach(b => b.classList.toggle('active', b.getAttribute('data-mode') === mode));
};


// ── WEATHER CARD ──────────────────────────────────────────────────────────────
// WMO weather code → emoji + description
function weatherCodeInfo(code) {
  if (code === 0) return { icon: '☀️', desc: 'Clear sky' };
  if (code === 1) return { icon: '🌤️', desc: 'Mainly clear' };
  if (code === 2) return { icon: '⛅', desc: 'Partly cloudy' };
  if (code === 3) return { icon: '☁️', desc: 'Overcast' };
  if ([45,48].includes(code)) return { icon: '🌫️', desc: 'Foggy' };
  if ([51,53,55].includes(code)) return { icon: '🌦️', desc: 'Drizzle' };
  if ([61,63,65].includes(code)) return { icon: '🌧️', desc: 'Rain' };
  if ([71,73,75,77].includes(code)) return { icon: '❄️', desc: 'Snow' };
  if ([80,81,82].includes(code)) return { icon: '🌦️', desc: 'Rain showers' };
  if ([85,86].includes(code)) return { icon: '🌨️', desc: 'Snow showers' };
  if ([95,96,99].includes(code)) return { icon: '⛈️', desc: 'Thunderstorm' };
  return { icon: '🌡️', desc: 'Unknown' };
}

function celsiusToF(c) { return Math.round(c * 9/5 + 32); }
function formatDay(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}
async function fetchAndRenderWeather(cityData, trip) {
  const chat = document.getElementById('chat');
  const welcome = document.getElementById('welcome');
  if (welcome) welcome.remove();

  const wrap = document.createElement('div');
  wrap.className = 'msg ai';
  wrap.innerHTML = '<div class="avatar ai" style="opacity:0"></div>';
  const loadingCard = document.createElement('div');
  loadingCard.className = 'weather-card';
  loadingCard.innerHTML = '<div class="weather-loading">⏳ Fetching live weather for ' + escHtml(cityData.city) + '...</div>';
  wrap.appendChild(loadingCard);
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;

  try {
    // 1) Geocode city name → lat/lng (Open-Meteo geocoding, free, no key)
    const geoRes = await fetch(
      'https://geocoding-api.open-meteo.com/v1/search?name=' +
      encodeURIComponent(cityData.city) + '&count=1&language=en&format=json'
    );
    const geoData = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) {
      throw new Error('Could not find location: ' + cityData.city);
    }
    const { latitude, longitude, name, country } = geoData.results[0];

    // 2) 7-day forecast. We pull per-day aggregates (feels-like, wind, rain)
    //    so any day can be inspected individually — not just today.
    const wxRes = await fetch(
      'https://api.open-meteo.com/v1/forecast?' +
      'latitude=' + latitude + '&longitude=' + longitude +
      '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,' +
      'wind_speed_10m_max,precipitation_probability_max,precipitation_sum' +
      '&timezone=auto&forecast_days=7'
    );
    const wx = await wxRes.json();

    // Surface API-level errors instead of failing silently downstream
    if (wx.error) throw new Error(wx.reason || 'Open-Meteo error');
    if (!wx.current || !wx.daily || !Array.isArray(wx.daily.time)) {
      throw new Error('Weather data was incomplete for ' + name);
    }

    const cardId = 'wx-' + Date.now();
    loadingCard.id = cardId;

    // Cache everything needed to re-render on day / unit changes
    window._weatherCache = window._weatherCache || {};
    window._weatherCache[cardId] = {
      city: name, country,
      cur: wx.current, daily: wx.daily,
      unit: 'C', selectedDay: 0
    };

    loadingCard.innerHTML = buildWeatherHTML(cardId);

    if (trip) {
      trip.history.push({ role: 'assistant', content: 'Showed weather for ' + name + '.', cardType: 'weather', cardData: { city: name, country } });
    }
  } catch (err) {
    console.error('[Waypoint] weather card failed:', err);
    loadingCard.innerHTML = '<div class="weather-loading" style="color:var(--accent4)">Could not load weather: ' + escHtml(err.message) + '</div>';
  }
  chat.scrollTop = chat.scrollHeight;
}

function formatLongDay(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

// Build the entire card from cached state. Driven by cardId so day/unit
// toggles are a one-line state change + re-render.
function buildWeatherHTML(cardId) {
  const data = window._weatherCache[cardId];
  if (!data) return '';
  const { city, country, cur, daily, unit, selectedDay } = data;
  const isF = unit === 'F';
  const conv = (c) => (isF ? celsiusToF(c) : Math.round(c));
  const isToday = selectedDay === 0;

  const dayInfo = weatherCodeInfo(daily.weather_code[selectedDay]);
  const heroTemp = isToday ? conv(cur.temperature_2m) : conv(daily.temperature_2m_max[selectedDay]);
  const heroLabel = isToday ? 'Now' : formatLongDay(daily.time[selectedDay]);
  const hiSel = conv(daily.temperature_2m_max[selectedDay]);
  const loSel = conv(daily.temperature_2m_min[selectedDay]);

  // Per-day stat boxes — today uses live "current" readings, other days use
  // the daily aggregates we requested above.
  const stats = isToday
    ? [
        ['Feels like', conv(cur.apparent_temperature) + '°' + unit],
        ['Humidity', cur.relative_humidity_2m + '%'],
        ['Wind', Math.round(cur.wind_speed_10m) + ' km/h'],
        ['Rain now', cur.precipitation + ' mm'],
      ]
    : [
        ['Feels like', conv(daily.apparent_temperature_max[selectedDay]) + '°' + unit],
        ['Rain chance', (daily.precipitation_probability_max[selectedDay] ?? 0) + '%'],
        ['Wind', Math.round(daily.wind_speed_10m_max[selectedDay]) + ' km/h'],
        ['Precip', (daily.precipitation_sum[selectedDay] ?? 0) + ' mm'],
      ];

  const statsHtml = stats.map(s => `
      <div class="weather-stat">
        <div class="weather-stat-label">${s[0]}</div>
        <div class="weather-stat-val">${s[1]}</div>
      </div>`).join('');

  const dayCards = daily.time.map((date, i) => {
    const hi = conv(daily.temperature_2m_max[i]);
    const lo = conv(daily.temperature_2m_min[i]);
    const info = weatherCodeInfo(daily.weather_code[i]);
    const rain = daily.precipitation_probability_max[i];
    const cls = 'weather-day' + (i === selectedDay ? ' selected' : '');
    return `
      <button type="button" class="${cls}" onclick="selectWeatherDay('${cardId}', ${i})">
        <div class="weather-day-name">${i === 0 ? 'Today' : formatDay(date)}</div>
        <div class="weather-day-icon">${info.icon}</div>
        <div class="weather-day-high">${hi}°</div>
        <div class="weather-day-low">${lo}°</div>
        ${rain > 20 ? `<div class="weather-day-rain">💧 ${rain}%</div>` : ''}
      </button>`;
  }).join('');

  const now = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return `
    <div class="weather-hero">
      <div class="weather-location">
        <div class="weather-city">${escHtml(city)}</div>
        <div class="weather-country">${escHtml(country)}</div>
        <div class="weather-sel-day">${heroLabel}</div>
      </div>
      <div class="weather-current">
        <div class="weather-temp">${heroTemp}<span class="weather-temp-unit">°${unit}</span></div>
        <div class="weather-condition">${dayInfo.icon} ${dayInfo.desc}</div>
        <div class="weather-hilo">H ${hiSel}° · L ${loSel}°</div>
      </div>
    </div>
    <div class="weather-stats">${statsHtml}</div>
    <div class="weather-forecast">${dayCards}</div>
    <div class="weather-footer">
      <div class="weather-updated">Updated ${now} · tap a day for details</div>
      <div class="weather-unit-toggle">
        <button class="wut${!isF ? ' active' : ''}" onclick="switchWeatherUnit('${cardId}', 'C')">°C</button>
        <button class="wut${isF ? ' active' : ''}" onclick="switchWeatherUnit('${cardId}', 'F')">°F</button>
      </div>
    </div>`;
}

window._weatherCache = window._weatherCache || {};

function rerenderWeather(cardId) {
  const card = document.getElementById(cardId);
  if (!card || !window._weatherCache[cardId]) return;
  card.innerHTML = buildWeatherHTML(cardId);
}

// Called from inline onclick on each forecast day — retarget the card to that day
window.selectWeatherDay = function(cardId, dayIndex) {
  const data = window._weatherCache[cardId];
  if (!data) return;
  data.selectedDay = dayIndex;
  rerenderWeather(cardId);
};

window.switchWeatherUnit = function(cardId, unit) {
  const data = window._weatherCache[cardId];
  if (!data) return;
  data.unit = unit;
  rerenderWeather(cardId);
};

// Restoring from trip history → re-fetch live (weather should always be fresh)
async function restoreWeatherCard(cityData) {
  await fetchAndRenderWeather(cityData, null);
}

// ── EXPORTS ───────────────────────────────────────────────────────────────────
export {
  buildItinCard, buildResultCards,
  buildRestoCardHTML, buildHotelCardHTML, buildActivityCardHTML,
  renderRestaurantCards, renderHotelCards, renderActivityCards,
  renderDirectionsCard,
  fetchAndRenderWeather, restoreWeatherCard
};
