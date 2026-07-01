// ── theme.js ──────────────────────────────────────────────────────────────────
// Handles light/dark mode toggle and system preference detection

function toggleTheme() {
  const root = document.documentElement;
  const isLight = root.classList.toggle('light');
  root.classList.remove(isLight ? 'dark' : 'light');
  document.getElementById('themeIcon').textContent = isLight ? '🌙' : '☀';
  localStorage.setItem('wp_theme', isLight ? 'light' : 'dark');
}

function toggleSidebar() {
  const sidebar = document.querySelector('aside');
  const isMobile = window.matchMedia('(max-width: 700px)').matches;
  if (isMobile) {
    sidebar.classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('visible');
  } else {
    const collapsed = sidebar.classList.toggle('collapsed');
    localStorage.setItem('wp_sidebar', collapsed ? 'collapsed' : 'open');
  }
}

function initSidebar() {
  const isMobile = window.matchMedia('(max-width: 700px)').matches;
  if (!isMobile && localStorage.getItem('wp_sidebar') === 'collapsed') {
    document.querySelector('aside')?.classList.add('collapsed');
  }
}

function initTheme() {
  const root = document.documentElement;
  const isMobile = window.matchMedia('(max-width: 700px)').matches;
  const saved = localStorage.getItem('wp_theme');

  if (saved === 'light') {
    root.classList.add('light');
    const icon = document.getElementById('themeIcon');
    if (icon) icon.textContent = '🌙';
  } else if (!saved) {
    // No saved preference — follow OS
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (!prefersDark) {
      root.classList.add('light');
      const icon = document.getElementById('themeIcon');
      if (icon) icon.textContent = '🌙';
    }
    // Listen for real-time OS changes when no manual preference set
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (localStorage.getItem('wp_theme')) return;
      if (e.matches) {
        root.classList.remove('light');
        const icon = document.getElementById('themeIcon');
        if (icon) icon.textContent = '☀';
      } else {
        root.classList.add('light');
        const icon = document.getElementById('themeIcon');
        if (icon) icon.textContent = '🌙';
      }
    });
  }
}

// ── EXPORTS ───────────────────────────────────────────────────────────────────
export { toggleTheme, toggleSidebar, initTheme, initSidebar };
