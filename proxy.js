const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

exports.handler = async function(event) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Parse body
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  // Validate
  if (!body.messages || !Array.isArray(body.messages) || !body.system) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing messages or system prompt' }) };
  }

  // Sanitize — only forward safe fields
  const payload = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: body.system,
    messages: body.messages
      .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: String(m.content).slice(0, 8000) }))
      .slice(0, 20),
  };

  // Call Anthropic using the secret env variable
  let response;
  try {
    response = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: 'Failed to reach Anthropic' }) };
  }

  const data = await response.json();

  if (!response.ok) {
    return { statusCode: 502, body: JSON.stringify({ error: 'Upstream API error' }) };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  };
};
