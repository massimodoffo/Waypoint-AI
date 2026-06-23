// ── main.js ───────────────────────────────────────────────────────────────────
import { initTheme, toggleTheme, toggleSidebar } from './theme.js';
import { saveTrips, loadTrips } from './storage.js';
import {
  appendMsg, showTyping, removeTyping,
  setAgentState, resetAgents, buildAgentActivityEl, updateTask,
  autoResize, safeJSON, renderMarkdown
} from './chat.js';
import {
  buildItinCard, buildResultCards,
  renderRestaurantCards, renderHotelCards, renderActivityCards,
  renderDirectionsCard, fetchAndRenderWeather
} from './cards.js';
import {
  trips, currentTripId, tripCounter, conversationMode,
  setTrips, setCurrentTripId, setTripCounter, setConversationMode,
  getCurrentTrip, newTrip, renderTripList, clearChat, restoreChat
} from './trips.js';
import {
  callClaude,
  CHAT_PROMPT, ORCHESTRATOR_PROMPT,
  ITINERARY_PROMPT, BUDGET_PROMPT, HOTELS_PROMPT, LOCAL_PROMPT,
  INTENT_PROMPT, DIRECTIONS_PROMPT, WEATHER_PROMPT,
  RESTAURANT_SPECIALIST_PROMPT, HOTEL_SPECIALIST_PROMPT, ACTIVITY_SPECIALIST_PROMPT
} from './agents.js';

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  const saved = loadTrips();
  if (saved) {
    setTrips(saved.trips);
    setCurrentTripId(saved.currentTripId);
    setTripCounter(saved.tripCounter);
    const cur = saved.trips.find(t => t.id === saved.currentTripId);
    setConversationMode(cur?._mode || 'chat');
  }

  renderTripList();

  const trip = getCurrentTrip();
  if (trip && trip.history && trip.history.length > 0) {
    restoreChat();
  }

  // Events are wired in index.html plain script tag
});

// ── INPUT HELPERS ─────────────────────────────────────────────────────────────
function quickStart(text) {
  const input = document.getElementById('msgInput');
  input.value = text;
  autoResize(input);
  sendMessage();
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

// ── SEND MESSAGE ──────────────────────────────────────────────────────────────
async function sendMessage() {
  const input = document.getElementById('msgInput');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';
  document.getElementById('sendBtn').disabled = true;

  const trip = getCurrentTrip();
  appendMsg('user', text);
  trip.history.push({ role: 'user', content: text });
  saveTrips(trips, currentTripId, tripCounter);

  const chat = document.getElementById('chat');
  showTyping();

  try {
    if (conversationMode === 'chat') {
      setAgentState('orchestrator', 'running');
      const reply = await callClaude(CHAT_PROMPT, text, trip.history.slice(0, -1));
      setAgentState('orchestrator', 'idle');
      removeTyping();

      if (trip.name === 'New trip') {
        trip.name = text.split(' ').slice(0, 4).join(' ');
        saveTrips(trips, currentTripId, tripCounter);
        renderTripList();
      }

      trip.history.push({ role: 'assistant', content: reply });
      saveTrips(trips, currentTripId, tripCounter);

      if (reply.includes('[READY_TO_PLAN]')) {
        const cleanReply = reply.replace('[READY_TO_PLAN]', '').trim();
        appendMsg('ai', cleanReply);
        setTimeout(() => {
          const transMsg = document.createElement('div');
          transMsg.className = 'msg ai';
          transMsg.innerHTML = '<div class="avatar ai">W</div><div class="bubble ai"><span style="color:var(--accent)">✦</span> Perfect — I have everything I need. Let me build your trip now...</div>';
          chat.appendChild(transMsg);
          chat.scrollTop = chat.scrollHeight;
          setConversationMode('planning');
          setTimeout(() => generateItinerary(trip), 800);
        }, 600);
      } else {
        appendMsg('ai', reply);
      }

    } else if (conversationMode === 'done') {
      setAgentState('orchestrator', 'running');
      const intent = (await callClaude(INTENT_PROMPT, text)).trim().toUpperCase().split('\n')[0];
      setAgentState('orchestrator', 'idle');
      const tripContext = trip.history.map(m => m.role + ': ' + m.content).join('\n');

      if (intent === 'WEATHER') {
        setAgentState('local', 'running');
        const weatherRaw = await callClaude(WEATHER_PROMPT, text + '\n\nTrip context: ' + tripContext);
        setAgentState('local', 'idle');
        removeTyping();
        const weatherData = safeJSON(weatherRaw);
        if (weatherData && weatherData.city) {
          appendMsg('ai', 'Let me pull up the live forecast for ' + weatherData.city + '...');
          await fetchAndRenderWeather(weatherData, trip);
          saveTrips(trips, currentTripId, tripCounter);
        } else { await fallbackReply(trip, text); }

      } else if (intent === 'RESTAURANTS') {
        setAgentState('local', 'running');
        const restoRaw = await callClaude(RESTAURANT_SPECIALIST_PROMPT, tripContext);
        setAgentState('local', 'idle');
        removeTyping();
        const restoData = safeJSON(restoRaw);
        if (restoData && restoData.restaurants) {
          const msgId = Date.now();
          trip.history.push({ role: 'assistant', content: 'Showed restaurant recommendations.', cardType: 'restaurants', _id: msgId, cardData: restoData });
          saveTrips(trips, currentTripId, tripCounter);
          renderRestaurantCards(restoData);
        } else { await fallbackReply(trip, text); }

      } else if (intent === 'HOTELS') {
        setAgentState('hotels', 'running');
        const hotelRaw = await callClaude(HOTEL_SPECIALIST_PROMPT, tripContext);
        setAgentState('hotels', 'idle');
        removeTyping();
        const hotelData = safeJSON(hotelRaw);
        if (hotelData && hotelData.hotels) {
          const msgId = Date.now();
          trip.history.push({ role: 'assistant', content: 'Showed hotel recommendations.', cardType: 'hotels', _id: msgId, cardData: hotelData });
          saveTrips(trips, currentTripId, tripCounter);
          renderHotelCards(hotelData);
        } else { await fallbackReply(trip, text); }

      } else if (intent === 'ACTIVITIES') {
        setAgentState('itinerary', 'running');
        const activityRaw = await callClaude(ACTIVITY_SPECIALIST_PROMPT, tripContext);
        setAgentState('itinerary', 'idle');
        removeTyping();
        const activityData = safeJSON(activityRaw);
        if (activityData && activityData.activities) {
          const msgId = Date.now();
          trip.history.push({ role: 'assistant', content: 'Showed activity recommendations.', cardType: 'activities', _id: msgId, cardData: activityData });
          saveTrips(trips, currentTripId, tripCounter);
          renderActivityCards(activityData);
        } else { await fallbackReply(trip, text); }

      } else if (intent === 'DIRECTIONS') {
        setAgentState('orchestrator', 'running');
        const dirRaw = await callClaude(DIRECTIONS_PROMPT, text);
        setAgentState('orchestrator', 'idle');
        removeTyping();
        const dirData = safeJSON(dirRaw);
        if (dirData && dirData.destination) {
          if (!dirData.origin || dirData.origin.trim() === '') {
            appendMsg('ai', 'Where would you like directions from? For example: "from my hotel" or "from Times Square".');
          } else {
            trip.history.push({ role: 'assistant', content: `Showing directions from ${dirData.origin_label || dirData.origin} to ${dirData.destination_label || dirData.destination}.`, cardType: 'directions', cardData: dirData });
            saveTrips(trips, currentTripId, tripCounter);
            renderDirectionsCard(dirData);
          }
        } else { await fallbackReply(trip, text); }

      } else {
        const followUpPrompt = `You are Waypoint — an expert travel agent who knows this destination inside out. Answer the traveler's follow-up question like a knowledgeable friend. Be specific, practical, and include real details. Keep it conversational — no bullet points or headers.\n\nIMPORTANT: Never include goo.gl or Google Maps short URLs.\n\nTrip context:\n${tripContext}`;
        const reply = await callClaude(followUpPrompt, text);
        removeTyping();
        trip.history.push({ role: 'assistant', content: reply });
        saveTrips(trips, currentTripId, tripCounter);
        appendMsg('ai', reply);
      }
    }
  } catch (err) {
    removeTyping();
    resetAgents();
    appendMsg('ai', 'Something went wrong: ' + err.message + '. Please try again.');
  }

  chat.scrollTop = chat.scrollHeight;
  document.getElementById('sendBtn').disabled = false;
  resetAgents();
}

// ── GENERATE ITINERARY ────────────────────────────────────────────────────────
async function generateItinerary(trip) {
  const chat = document.getElementById('chat');
  const tasks = [
    { icon: '◈', label: 'Orchestrator — parsing your trip' },
    { icon: '🗺', label: 'Itinerary agent — building your days' },
    { icon: '💰', label: 'Budget agent — estimating costs' },
    { icon: '🏨', label: 'Hotels agent — finding places to stay' },
    { icon: '🌍', label: 'Local tips agent — insider knowledge' },
  ];

  const activityWrap = document.createElement('div');
  activityWrap.className = 'msg ai';
  const avatar = document.createElement('div');
  avatar.className = 'avatar orchestrator';
  avatar.textContent = 'W';
  activityWrap.appendChild(avatar);
  activityWrap.appendChild(buildAgentActivityEl(tasks));
  chat.appendChild(activityWrap);
  chat.scrollTop = chat.scrollHeight;

  try {
    setAgentState('orchestrator', 'running'); updateTask(0, 'running');
    const convoSummary = trip.history.map(m => m.role + ': ' + m.content).join('\n');
    const orchRaw = await callClaude(ORCHESTRATOR_PROMPT, convoSummary);
    const params = safeJSON(orchRaw);
    updateTask(0, 'done'); setAgentState('orchestrator', 'idle');
    if (!params) throw new Error('Could not parse trip details');

    if (params.destination) {
      trip.name = params.destination;
      trip._mode = 'done';
      saveTrips(trips, currentTripId, tripCounter);
      renderTripList();
    }

    const tripContext = JSON.stringify(params);
    setAgentState('itinerary', 'running'); updateTask(1, 'running');
    setAgentState('budget', 'running');    updateTask(2, 'running');
    setAgentState('hotels', 'running');    updateTask(3, 'running');
    setAgentState('local', 'running');     updateTask(4, 'running');

    const [itinRaw, budgetRaw, hotelsRaw, localRaw] = await Promise.all([
      callClaude(ITINERARY_PROMPT, tripContext),
      callClaude(BUDGET_PROMPT, tripContext),
      callClaude(HOTELS_PROMPT, tripContext),
      callClaude(LOCAL_PROMPT, tripContext),
    ]);

    updateTask(1, 'done'); setAgentState('itinerary', 'idle');
    updateTask(2, 'done'); setAgentState('budget', 'idle');
    updateTask(3, 'done'); setAgentState('hotels', 'idle');
    updateTask(4, 'done'); setAgentState('local', 'idle');

    const itin   = safeJSON(itinRaw);
    const budget = safeJSON(budgetRaw);
    const hotels = safeJSON(hotelsRaw);
    const local  = safeJSON(localRaw);

    activityWrap.remove();

    const summaryText = (params.trip_summary || 'Here is your trip to ' + params.destination + '.') + ' Feel free to ask me anything about it!';
    appendMsg('ai', summaryText);
    trip.history.push({ role: 'assistant', content: summaryText, cardType: 'summary' });

    if (itin) {
      const itinWrap = document.createElement('div');
      itinWrap.className = 'msg ai';
      itinWrap.innerHTML = '<div class="avatar ai" style="opacity:0"></div>';
      itinWrap.appendChild(buildItinCard(itin, params.destination, params.duration));
      chat.appendChild(itinWrap);
      trip.history.push({ role: 'assistant', content: 'Itinerary card', cardType: 'itinerary', cardData: { itin, destination: params.destination, duration: params.duration } });
    }

    if (budget && hotels && local) {
      const cardsWrap = document.createElement('div');
      cardsWrap.className = 'msg ai';
      cardsWrap.innerHTML = '<div class="avatar ai" style="opacity:0"></div>';
      cardsWrap.appendChild(buildResultCards(budget, hotels, local));
      chat.appendChild(cardsWrap);
      trip.history.push({ role: 'assistant', content: 'Results cards', cardType: 'results', cardData: { budget, hotels, local } });
    }

    trip.history.push({ role: 'assistant', content: 'Full itinerary generated for ' + params.destination });
    setConversationMode('done');
    trip._mode = 'done';
    saveTrips(trips, currentTripId, tripCounter);

  } catch (err) {
    activityWrap.remove();
    resetAgents();
    appendMsg('ai', 'Something went wrong building your itinerary: ' + err.message + '. Please try again.');
    setConversationMode('chat');
  }

  chat.scrollTop = chat.scrollHeight;
  resetAgents();
}

// ── FALLBACK REPLY ────────────────────────────────────────────────────────────
async function fallbackReply(trip, text) {
  removeTyping();
  const tripContext = trip.history.map(m => m.role + ': ' + m.content).join('\n');
  try {
    const reply = await callClaude(
      'You are Waypoint, a knowledgeable travel agent. Answer this follow-up question conversationally. Trip context: ' + tripContext,
      text
    );
    trip.history.push({ role: 'assistant', content: reply });
    saveTrips(trips, currentTripId, tripCounter);
    appendMsg('ai', reply);
  } catch {
    appendMsg('ai', 'Something went wrong. Please try again.');
  }
}

// Export key functions to window so the plain inline handlers in index.html can call them
window.sendMessage   = sendMessage;
window.toggleSidebar = toggleSidebar;
window.toggleTheme   = toggleTheme;
window.newTrip       = newTrip;
window.quickStart    = quickStart;
window.handleKey     = handleKey;
window.autoResize    = autoResize;
