// ── cards.js ──────────────────────────────────────────────────────────────────
// All card builders: itinerary, results, restaurant, hotel, activity


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
function renderDirectionsCard(data) {
  const chat = document.getElementById('chat');
  const welcome = document.getElementById('welcome');
  if (welcome) welcome.remove();

  const wrap = document.createElement('div');
  wrap.className = 'msg ai';
  wrap.innerHTML = '<div class="avatar ai" style="opacity:0"></div>';

  const card = document.createElement('div');
  card.className = 'directions-card';

  const modeIcon = { driving: '🚗', walking: '🚶', transit: '🚇' };
  const modeLabel = { driving: 'Driving', walking: 'Walking', transit: 'Transit' };

  // Build Google Maps embed URL
  function buildEmbedUrl(origin, destination, mode) {
    const base = 'https://www.google.com/maps/embed/v1/directions';
    const key = 'AIzaSyD-placeholder'; // No key needed for basic embed
    const params = new URLSearchParams({
      origin: origin || destination,
      destination: destination,
      mode: mode,
    });
    // Use the non-API embed which doesn't need a key
    const mapsMode = mode === 'transit' ? 'transit' : mode === 'walking' ? 'walking' : 'driving';
    const originEnc = encodeURIComponent(origin || destination);
    const destEnc = encodeURIComponent(destination);
    return `https://www.google.com/maps?saddr=${originEnc}&daddr=${destEnc}&dirflg=${mode === 'transit' ? 'r' : mode === 'walking' ? 'w' : 'd'}&output=embed`;
  }

  function buildOpenUrl(origin, destination, mode) {
    const modeFlag = mode === 'transit' ? 'r' : mode === 'walking' ? 'w' : 'd';
    const o = encodeURIComponent(origin || '');
    const d = encodeURIComponent(destination);
    return `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${d}&travelmode=${mode}`;
  }

  const currentMode = data.travel_mode || 'driving';
  const iframeId = 'dir-iframe-' + Date.now();
  const hasOrigin = data.origin && data.origin.trim() !== '';

  card.innerHTML = `
    <div class="directions-header">
      <div class="directions-route">
        ${hasOrigin ? `
          <div class="directions-from">
            <div class="directions-dot from"></div>
            <span>${escHtml(data.origin_label || data.origin)}</span>
          </div>
          <div class="directions-line"></div>
        ` : ''}
        <div class="directions-to">
          <div class="directions-dot to"></div>
          <span>${escHtml(data.destination_label || data.destination)}</span>
        </div>
      </div>
      <div class="directions-mode-badge">${modeIcon[currentMode] || '🗺'} ${modeLabel[currentMode] || currentMode}</div>
    </div>
    ${data.context ? `<div class="directions-context">${escHtml(data.context)}</div>` : ''}
    <iframe
      id="${iframeId}"
      class="directions-map"
      src="${buildEmbedUrl(data.origin, data.destination, currentMode)}"
      allowfullscreen
      loading="lazy"
      referrerpolicy="no-referrer-when-downgrade"
    ></iframe>
    <div class="directions-footer">
      <div class="directions-mode-btns">
        ${['driving','walking','transit'].map(m => `
          <button class="dmb${m === currentMode ? ' active' : ''}"
            onclick="switchDirectionsMode('${iframeId}', '${escHtml(data.origin)}', '${escHtml(data.destination)}', '${m}', this)">
            ${modeIcon[m]} ${modeLabel[m]}
          </button>`).join('')}
      </div>
      <a class="directions-open-btn" href="${buildOpenUrl(data.origin, data.destination, currentMode)}" target="_blank" rel="noopener">
        Open in Maps ↗
      </a>
    </div>
  `;

  wrap.appendChild(card);
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}

// Called from inline onclick — must be on window
window.switchDirectionsMode = function(iframeId, origin, destination, mode, btn) {
  const iframe = document.getElementById(iframeId);
  if (!iframe) return;
  const modeFlag = mode === 'transit' ? 'r' : mode === 'walking' ? 'w' : 'd';
  const originEnc = encodeURIComponent(origin || destination);
  const destEnc = encodeURIComponent(destination);
  iframe.src = `https://www.google.com/maps?saddr=${originEnc}&daddr=${destEnc}&dirflg=${modeFlag}&output=embed`;

  // Update open-in-maps link
  const footer = iframe.nextElementSibling;
  if (footer) {
    const openBtn = footer.querySelector('.directions-open-btn');
    if (openBtn) openBtn.href = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=${mode}`;
  }

  // Update active button
  btn.closest('.directions-mode-btns').querySelectorAll('.dmb').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
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

  // Show loading card while fetching
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
    // Step 1: Geocode city name → lat/lng using Open-Meteo geocoding (free, no key)
    const geoRes = await fetch(
      'https://geocoding-api.open-meteo.com/v1/search?name=' +
      encodeURIComponent(cityData.city) + '&count=1&language=en&format=json'
    );
    const geoData = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) {
      throw new Error('Could not find location: ' + cityData.city);
    }
    const { latitude, longitude, name, country } = geoData.results[0];

    // Step 2: Fetch 7-day forecast from Open-Meteo (free, no key)
    const wxRes = await fetch(
      'https://api.open-meteo.com/v1/forecast?' +
      'latitude=' + latitude + '&longitude=' + longitude +
      '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum' +
      '&timezone=auto&forecast_days=7'
    );
    const wx = await wxRes.json();
    const cur = wx.current;
    const daily = wx.daily;
    const curInfo = weatherCodeInfo(cur.weather_code);

    // Build card HTML
    const cardId = 'wx-' + Date.now();
    loadingCard.innerHTML = buildWeatherHTML(cardId, name, country, cur, daily, curInfo, 'C');

    // Cache for unit switching
    window._weatherCache = window._weatherCache || {};
    window._weatherCache[cardId] = { city: name, country, cur, daily };

    // Save to trip history
    if (trip) {
      trip.history.push({ role: 'assistant', content: 'Showed weather for ' + name + '.', cardType: 'weather', cardData: { city: name, country } });
    }

  } catch (err) {
    loadingCard.innerHTML = '<div class="weather-loading" style="color:var(--accent4)">Could not load weather: ' + escHtml(err.message) + '</div>';
  }
  chat.scrollTop = chat.scrollHeight;
}

function buildWeatherHTML(cardId, city, country, cur, daily, curInfo, unit) {
  const isF = unit === 'F';
  const temp = isF ? celsiusToF(cur.temperature_2m) : Math.round(cur.temperature_2m);
  const feelsLike = isF ? celsiusToF(cur.apparent_temperature) : Math.round(cur.apparent_temperature);
  const wind = Math.round(cur.wind_speed_10m);
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const dayCards = daily.time.map((date, i) => {
    const hi = isF ? celsiusToF(daily.temperature_2m_max[i]) : Math.round(daily.temperature_2m_max[i]);
    const lo = isF ? celsiusToF(daily.temperature_2m_min[i]) : Math.round(daily.temperature_2m_min[i]);
    const info = weatherCodeInfo(daily.weather_code[i]);
    const rain = daily.precipitation_probability_max[i];
    const isToday = i === 0;
    return \`
      <div class="weather-day\${isToday ? '" style="border-color:var(--accent);background:rgba(200,184,122,0.06)' : ''}">
        <div class="weather-day-name">\${isToday ? 'Today' : formatDay(date)}</div>
        <div class="weather-day-icon">\${info.icon}</div>
        <div class="weather-day-high">\${hi}°</div>
        <div class="weather-day-low">\${lo}°</div>
        \${rain > 20 ? \`<div class="weather-day-rain">💧 \${rain}%</div>\` : ''}
      </div>\`;
  }).join('');

  return \`
    <div class="weather-hero">
      <div class="weather-location">
        <div class="weather-city">\${escHtml(city)}</div>
        <div class="weather-country">\${escHtml(country)}</div>
      </div>
      <div class="weather-current">
        <div class="weather-temp">\${temp}<span class="weather-temp-unit">°\${unit}</span></div>
        <div class="weather-condition">\${curInfo.icon} \${curInfo.desc}</div>
      </div>
    </div>
    <div class="weather-stats">
      <div class="weather-stat">
        <div class="weather-stat-label">Feels like</div>
        <div class="weather-stat-val">\${feelsLike}°\${unit}</div>
      </div>
      <div class="weather-stat">
        <div class="weather-stat-label">Humidity</div>
        <div class="weather-stat-val">\${cur.relative_humidity_2m}%</div>
      </div>
      <div class="weather-stat">
        <div class="weather-stat-label">Wind</div>
        <div class="weather-stat-val">\${wind} km/h</div>
      </div>
      <div class="weather-stat">
        <div class="weather-stat-label">Rain now</div>
        <div class="weather-stat-val">\${cur.precipitation} mm</div>
      </div>
    </div>
    <div class="weather-forecast">\${dayCards}</div>
    <div class="weather-footer">
      <div class="weather-updated">Updated \${timeStr}</div>
      <div class="weather-unit-toggle">
        <button class="wut\${!isF ? ' active' : ''}" onclick="switchWeatherUnit('\${cardId}', 'C')">°C</button>
        <button class="wut\${isF ? ' active' : ''}" onclick="switchWeatherUnit('\${cardId}', 'F')">°F</button>
      </div>
    </div>\`;
}

// Store raw data on card element for unit switching
window._weatherCache = window._weatherCache || {};

window.switchWeatherUnit = function(cardId, unit) {
  const card = document.getElementById(cardId);
  if (!card) return;
  const cached = window._weatherCache[cardId];
  if (!cached) return;
  const { city, country, cur, daily } = cached;
  const curInfo = weatherCodeInfo(cur.weather_code);
  card.innerHTML = buildWeatherHTML(cardId, city, country, cur, daily, curInfo, unit);
  // Re-cache since innerHTML was replaced
  window._weatherCache[cardId] = { city, country, cur, daily };
};

// Version for restoring from trip history
async function restoreWeatherCard(cityData) {
  // Just re-fetch live — weather should always be fresh anyway
  await fetchAndRenderWeather(cityData, null);
}
