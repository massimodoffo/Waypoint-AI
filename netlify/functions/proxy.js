const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
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
