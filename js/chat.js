// ── chat.js ───────────────────────────────────────────────────────────────────
// Chat UI utilities: message rendering, markdown, typing indicators

export function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderMarkdown(text) {
  let s = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Markdown links: [text](url)
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline;text-underline-offset:2px">$1 ↗</a>');

  // Bare URLs
  s = s.replace(/(^|\s)(https?:\/\/[^\s<]+)/g,
    '$1<a href="$2" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline;text-underline-offset:2px">$2 ↗</a>');

  // Bold+italic: ***text***
  s = s.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Bold: **text**
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:var(--text);font-weight:600">$1</strong>');
  // Italic: *text*
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // Italic: _text_
  s = s.replace(/_([^_]+)_/g, '<em>$1</em>');
  // Underline: __text__
  s = s.replace(/__([^_]+)__/g, '<u>$1</u>');
  // Line breaks
  s = s.replace(/\n/g, '<br>');

  return s;
}

export function appendMsg(role, content) {
  const welcome = document.getElementById('welcome');
  if (welcome) welcome.remove();
  const chat = document.getElementById('chat');
  const wrap = document.createElement('div');
  wrap.className = 'msg ' + role;
  if (role === 'user') {
    wrap.innerHTML = `<div class="avatar user">You</div><div class="bubble user">${escHtml(content)}</div>`;
  } else {
    wrap.innerHTML = `<div class="avatar ai">W</div><div class="bubble ai">${renderMarkdown(content)}</div>`;
  }
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
  return wrap;
}

export function showTyping() {
  const chat = document.getElementById('chat');
  const wrap = document.createElement('div');
  wrap.className = 'msg ai';
  wrap.id = 'typing';
  wrap.innerHTML = '<div class="avatar ai">W</div><div class="bubble ai"><div class="typing-dots"><span></span><span></span><span></span></div></div>';
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}

export function removeTyping() {
  const t = document.getElementById('typing');
  if (t) t.remove();
}

export function setAgentState(agent, state) {
  const dot = document.getElementById('ad-' + agent);
  const pill = document.getElementById('ap-' + agent);
  if (!dot) return;
  dot.classList.toggle('active', state === 'running');
  pill.classList.toggle('running', state === 'running');
}

export function resetAgents() {
  ['orchestrator', 'itinerary', 'budget', 'hotels', 'local'].forEach(a => setAgentState(a, 'idle'));
}

export function buildAgentActivityEl(tasks) {
  const div = document.createElement('div');
  div.className = 'agent-activity';
  div.innerHTML = `<div class="agent-activity-header"><span style="color:var(--accent)">◈</span> Agent pipeline</div><div class="agent-tasks" id="atasks"></div>`;
  const tasksDiv = div.querySelector('#atasks');
  tasks.forEach((t, i) => {
    const row = document.createElement('div');
    row.className = 'agent-task pending';
    row.id = 'at-' + i;
    row.innerHTML = `<span class="task-icon">${t.icon}</span><span class="task-label">${t.label}</span><span class="task-badge pending" id="atb-${i}">waiting</span>`;
    tasksDiv.appendChild(row);
  });
  return div;
}

export function updateTask(idx, state) {
  const row = document.getElementById('at-' + idx);
  const badge = document.getElementById('atb-' + idx);
  if (!row || !badge) return;
  row.className = 'agent-task ' + state;
  badge.className = 'task-badge ' + state;
  badge.textContent = state === 'done' ? 'done' : state === 'running' ? 'running…' : 'waiting';
}

export function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

export function formatDate(d) {
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  return d.toLocaleDateString();
}

export function safeJSON(str) {
  try { return JSON.parse(str.replace(/```json|```/g, '').trim()); } catch { return null; }
}
