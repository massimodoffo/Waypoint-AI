// Permanently deletes the calling user's own Netlify Identity account.
//
// Deleting a user is an Identity *Admin* API operation (DELETE
// {identity_url}/admin/users/{id}), which normally requires an admin-role
// token — not something a regular user's own JWT can call directly, and not
// something this repo wants to hand a service-role secret to the client for.
// Netlify Functions get a narrow, purpose-built way around that: when a
// request carries a valid Identity JWT, Netlify's edge populates
// context.clientContext.identity with { url, token } — a token scoped to
// that site's Identity Admin API, provided only inside the function
// execution context, never exposed to the client. Combined with
// context.clientContext.user.sub (the calling user's own verified ID), this
// lets the function delete exactly the calling user's own account and
// nothing else, with no separate admin secret to provision or leak.
exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const user = context.clientContext?.user;
  const identity = context.clientContext?.identity;
  if (!user || !identity?.url || !identity?.token) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Sign in required' }) };
  }

  let response;
  try {
    // Shorter than the client's own 8s timeout (js/auth.js's
    // IDENTITY_TIMEOUT_MS) so this function always resolves — success or
    // failure — before the client gives up and shows a "try again" that
    // might really mean "already deleted, just slow to confirm."
    response = await fetch(`${identity.url}/admin/users/${user.sub}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${identity.token}` },
      signal: AbortSignal.timeout(6000),
    });
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: 'Failed to reach Identity admin API: ' + err.message }) };
  }

  // GoTrue's admin DELETE returns 200 with an empty body on success, not
  // JSON — parsing it as JSON here would throw on the happy path.
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return { statusCode: response.status, body: JSON.stringify({ error: 'Account deletion failed: ' + (text || response.statusText) }) };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deleted: true }),
  };
};
