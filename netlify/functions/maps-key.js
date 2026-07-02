// Hands the client the Google Maps Embed API key, if the site owner has
// configured one. This is not a secret-protection boundary — Maps Embed/JS
// API keys are designed to be used client-side and are safe to expose,
// provided the key itself is restricted to this site's domain(s) in Google
// Cloud Console (HTTP referrer restriction). Routing it through a function
// instead of hardcoding it in the static JS just keeps it out of git, so it
// can be set/rotated from the Netlify dashboard like ANTHROPIC_API_KEY.
exports.handler = async function (event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const key = process.env.GOOGLE_MAPS_EMBED_KEY;
  if (!key) {
    return { statusCode: 404, body: JSON.stringify({ error: 'GOOGLE_MAPS_EMBED_KEY not configured' }) };
  }

  return {
    statusCode: 200,
    // Cached client-side (see getGoogleMapsKey in cards.js) — this only ever
    // needs to be fetched once per page load, and the key rarely changes.
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
    body: JSON.stringify({ key }),
  };
};
