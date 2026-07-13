const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

// Netlify verifies the Identity JWT's signature at the edge before this
// function ever runs, and only populates context.clientContext.user from a
// token that passed that check — there's no separate JWT library to add or
// signature verification to hand-roll here, just this check has to actually
// happen. Without it, the login screen was a UX funnel: it gated the app's
// UI but nothing stopped a direct, unauthenticated POST to this endpoint
// from spending the shared ANTHROPIC_API_KEY. This only takes effect once
// deployed on Netlify (see this repo's CLAUDE.md — functions don't run at
// all under a plain static server or without `netlify dev`), same
// constraint every other function here already has.
exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!context.clientContext?.user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Sign in required' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!body.messages || !Array.isArray(body.messages) || !body.system) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing messages or system prompt' }) };
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured on server' }) };
  }

  const payload = {
    model: 'claude-sonnet-4-5',
    max_tokens: 1000,
    system: body.system,
    messages: body.messages
      .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: String(m.content).slice(0, 8000) }))
      .slice(0, 20),
  };

  let response;
  try {
    response = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: 'Failed to reach Anthropic: ' + err.message }) };
  }

  const data = await response.json();

  if (!response.ok) {
    return { 
      statusCode: response.status, 
      body: JSON.stringify({ error: 'Anthropic error: ' + (data.error?.message || JSON.stringify(data)) }) 
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  };
};
