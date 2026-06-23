// ── storage.js ────────────────────────────────────────────────────────────────
// Handles all localStorage persistence for trips and chat history

function saveTrips(trips, currentTripId, tripCounter) {
  try {
    const data = {
      trips: trips.map(t => ({
        ...t,
        date: t.date instanceof Date ? t.date.toISOString() : t.date
      })),
      currentTripId,
      tripCounter,
      conversationModes: Object.fromEntries(trips.map(t => [t.id, t._mode || 'chat']))
    };
    localStorage.setItem('wp_trips', JSON.stringify(data));
  } catch (e) {
    console.warn('Could not save trips:', e);
  }
}

function loadTrips() {
  try {
    const raw = localStorage.getItem('wp_trips');
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.trips || !data.trips.length) return null;

    const trips = data.trips.map(t => ({ ...t, date: new Date(t.date) }));
    const currentTripId = data.currentTripId ?? trips[trips.length - 1].id;
    const tripCounter = data.tripCounter ?? trips.length - 1;
    const modes = data.conversationModes || {};
    trips.forEach(t => { t._mode = modes[t.id] || 'chat'; });

    return { trips, currentTripId, tripCounter };
  } catch (e) {
    console.warn('Could not load trips:', e);
    return null;
  }
}

// ── EXPORTS ───────────────────────────────────────────────────────────────────
export { saveTrips, loadTrips };
