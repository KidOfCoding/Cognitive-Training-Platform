/**
 * Cognitive Games - Universal Access Guard & Session Sync
 * Anti-Tamper & Anti-Offline Security System:
 * 1. Blocks offline usage completely (file:// scheme, navigator.onLine === false).
 * 2. If someone saves the webpage locally (e.g., Ctrl+S / Save Page As) and tries to run it offline,
 *    it terminates all boards/canvases, wipes game engines, and locks the screen.
 * 3. Enforces real-time online institutional authentication check with Clerk / parent dashboard.
 * 4. Listens to window 'offline' events in real time to pause/freeze and lock games immediately.
 */

(function () {
  'use strict';

  const CLERK_PUBLISHABLE_KEY = 'pk_test_bXV0dWFsLWNveW90ZS05LmNsZXJrLmFjY291bnRzLmRldiQ';

  // Inject protective style immediately to hide content before auth verification completes
  const lockStyle = document.createElement('style');
  lockStyle.id = 'cognitive-auth-guard-style';
  lockStyle.innerHTML = `
    .auth-guard-hidden {
      display: none !important;
      visibility: hidden !important;
      filter: blur(40px) grayscale(100%) !important;
      pointer-events: none !important;
      user-select: none !important;
      overflow: hidden !important;
    }
    #cognitive-auth-lock-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      background: rgba(3, 7, 18, 0.98);
      backdrop-filter: blur(25px);
      -webkit-backdrop-filter: blur(25px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #f8fafc;
    }
    #cognitive-auth-lock-overlay.hidden {
      display: none !important;
    }
    .auth-lock-card {
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(9, 13, 24, 0.99) 100%);
      border: 1px solid rgba(239, 68, 68, 0.35);
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.95), 0 0 50px rgba(239, 68, 68, 0.15);
      border-radius: 1.5rem;
      padding: 2.5rem 2rem;
      max-width: 450px;
      width: 100%;
      text-align: center;
      position: relative;
      animation: authCardIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes authCardIn {
      from { opacity: 0; transform: scale(0.95) translateY(10px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    .auth-lock-icon {
      width: 68px;
      height: 68px;
      border-radius: 1.25rem;
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(185, 28, 28, 0.3));
      border: 1px solid rgba(239, 68, 68, 0.4);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 30px;
      margin-bottom: 1.25rem;
      box-shadow: 0 10px 25px -5px rgba(239, 68, 68, 0.3);
    }
    .auth-lock-title {
      font-size: 1.4rem;
      font-weight: 800;
      color: #ffffff;
      margin: 0 0 0.5rem;
      letter-spacing: -0.02em;
    }
    .auth-lock-subtitle {
      font-size: 0.875rem;
      color: #94a3b8;
      line-height: 1.55;
      margin: 0 0 1.75rem;
    }
    .auth-lock-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 0.85rem;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 9999px;
      color: #f87171;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      margin-bottom: 1.25rem;
    }
    .auth-lock-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      width: 100%;
      padding: 0.85rem 1.25rem;
      border-radius: 0.875rem;
      font-weight: 700;
      font-size: 0.925rem;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.2s ease;
      box-sizing: border-box;
      border: none;
    }
    .auth-lock-btn-primary {
      background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%);
      color: #ffffff;
      box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.4);
    }
    .auth-lock-btn-primary:hover {
      background: linear-gradient(135deg, #0369a1 0%, #1d4ed8 100%);
      transform: translateY(-1px);
    }
    .auth-lock-btn-secondary {
      background: rgba(30, 41, 59, 0.8);
      color: #cbd5e1;
      border: 1px solid rgba(255, 255, 255, 0.08);
      margin-top: 0.75rem;
    }
    .auth-lock-btn-secondary:hover {
      background: rgba(51, 65, 85, 0.9);
      color: #ffffff;
    }
  `;
  document.head.appendChild(lockStyle);

  // Apply hidden state to document body right away
  if (document.body) {
    document.body.classList.add('auth-guard-hidden');
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.classList.add('auth-guard-hidden');
    });
  }

  // Wipes all interactive game elements to ensure downloaded files cannot be played locally
  function neutralizeGameElements() {
    try {
      const targets = [
        'board-9x9',
        'grid',
        'grid-wrapper',
        'bubbles',
        'game-container',
        'ambient-bubbles-canvas'
      ];
      targets.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.innerHTML = '';
          el.style.display = 'none';
        }
      });
    } catch (e) {}
  }

  function createLockOverlay(title = 'Authentication Required', message = '', isOffline = false) {
    let overlay = document.getElementById('cognitive-auth-lock-overlay');
    const badgeText = isOffline ? 'Internet Connection Required' : 'Institutional Access Required';
    const icon = isOffline ? '📡' : '🔒';
    const descText = message || (isOffline
      ? 'Assessments require an active internet connection. Offline play and downloaded files are strictly prohibited.'
      : 'You must be signed in with your verified college or university email address to access cognitive assessment games.');

    const returnUrl = '/index.html';

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'cognitive-auth-lock-overlay';
      overlay.innerHTML = `
        <div class="auth-lock-card">
          <div class="auth-lock-icon">${icon}</div>
          <div class="auth-lock-pill" id="auth-lock-badge">${badgeText}</div>
          <h2 class="auth-lock-title" id="auth-lock-title">${title}</h2>
          <p class="auth-lock-subtitle" id="auth-lock-desc">${descText}</p>
          <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
            ${isOffline ? `
            <button type="button" id="auth-lock-retry-btn" class="auth-lock-btn auth-lock-btn-primary" style="cursor: pointer; border: none; background: linear-gradient(135deg, #06b6d4, #3b82f6);">
              <span>⚡ Retry Connection</span>
            </button>
            ` : ''}
            <a class="auth-lock-btn ${isOffline ? 'auth-lock-btn-secondary' : 'auth-lock-btn-primary'}" 
               href="${returnUrl}" 
               target="_top" 
               onclick="if (window.top && window.top !== window) { window.top.location.href = '${returnUrl}'; return false; }">
              <span>Return to Dashboard</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </a>
          </div>
        </div>
      `;
      document.documentElement.appendChild(overlay);

      const retryBtn = overlay.querySelector('#auth-lock-retry-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          if (navigator.onLine) {
            runGuard();
          } else {
            alert('Internet is still offline. Please verify your connection.');
          }
        });
      }
    } else {
      const titleEl = document.getElementById('auth-lock-title');
      const descEl = document.getElementById('auth-lock-desc');
      const badgeEl = document.getElementById('auth-lock-badge');
      if (titleEl) titleEl.textContent = title;
      if (descEl) descEl.textContent = descText;
      if (badgeEl) badgeEl.textContent = badgeText;
      overlay.classList.remove('hidden');
    }
  }

  function unlockContent() {
    if (document.body) {
      document.body.classList.remove('auth-guard-hidden');
    }
    const overlay = document.getElementById('cognitive-auth-lock-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }
  }

  // --- STRICT OFFLINE & DOWNLOAD / LOCAL SCHEME CHECKS ---
  function isDownloadedOrOffline() {
    // 1. file:// scheme check (user saved HTML to desktop or disk)
    if (window.location.protocol === 'file:') {
      return true;
    }
    // 2. Browser offline state
    if (typeof navigator.onLine === 'boolean' && !navigator.onLine) {
      return true;
    }
    // 3. Blob or data URL check
    if (window.location.protocol === 'blob:' || window.location.protocol === 'data:') {
      return true;
    }
    return false;
  }

  // Real-time offline detection: if user goes offline mid-game, immediately lock
  window.addEventListener('offline', () => {
    neutralizeGameElements();
    createLockOverlay('Internet Connection Lost', 'Assessment paused. Playing offline is strictly forbidden. Please reconnect to continue.', true);
  });

  // Real-time online recovery: when connection restores, re-verify and reload smoothly
  window.addEventListener('online', () => {
    if (isEmbeddedInHost()) {
      // embedded in dashboard - re-handshake
      runGuard();
    } else {
      window.location.reload();
    }
  });

  // Check if embedded in parent dashboard
  function isEmbeddedInHost() {
    return (window.parent && window.parent !== window) || (window.opener && !window.opener.closed);
  }

  // Handshake with parent frame
  function verifyHostSession() {
    return new Promise((resolve) => {
      if (!isEmbeddedInHost()) {
        resolve(null);
        return;
      }

      const hostWin = (window.parent && window.parent !== window) ? window.parent : window.opener;
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          window.removeEventListener('message', handleHostMsg);
          resolve(null);
        }
      }, 1500);

      const handleHostMsg = (e) => {
        if (!e.data || typeof e.data !== 'object') return;
        if (e.data.type === 'GAME_SESSION_INFO' || e.data.type === 'SESSION_ACTIVE') {
          resolved = true;
          clearTimeout(timeout);
          window.removeEventListener('message', handleHostMsg);
          resolve(e.data);
        }
      };

      window.addEventListener('message', handleHostMsg);
      try {
        hostWin.postMessage({ type: 'GET_GAME_SESSION_INFO', requestAuthCheck: true }, '*');
      } catch (e) {
        resolved = true;
        clearTimeout(timeout);
        window.removeEventListener('message', handleHostMsg);
        resolve(null);
      }
    });
  }

  // Load Clerk CDN directly to verify active user session if standalone tab
  async function verifyStandaloneClerk() {
    return new Promise((resolve) => {
      if (window.Clerk) {
        initClerkInstance(window.Clerk, resolve);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@clerk/clerk-js@latest/dist/clerk.browser.js';
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        if (window.Clerk) {
          initClerkInstance(window.Clerk, resolve);
        } else {
          resolve(null);
        }
      };
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    });
  }

  async function initClerkInstance(ClerkConstructor, callback) {
    try {
      const clerk = new ClerkConstructor(CLERK_PUBLISHABLE_KEY);
      await clerk.load();
      if (clerk.user) {
        callback(clerk.user);
      } else {
        callback(null);
      }
    } catch (e) {
      callback(null);
    }
  }

  // Main Guard Runner
  async function runGuard() {
    // 1. Immediate offline or local disk execution check
    if (isDownloadedOrOffline()) {
      neutralizeGameElements();
      createLockOverlay('Offline / Local File Detected', 'Downloaded HTML files and offline play are strictly prohibited. You must access assessments online while connected.', true);
      return;
    }

    // 2. Embedded in authenticated host dashboard
    const hostSession = await verifyHostSession();
    if (hostSession && hostSession.authenticated !== false) {
      unlockContent();
      return;
    }

    // 3. Standalone tab check via Clerk
    const clerkUser = await verifyStandaloneClerk();
    if (clerkUser) {
      unlockContent();
      return;
    }

    // 4. No verified authentication found: Lock and redirect
    neutralizeGameElements();
    createLockOverlay('Sign In Required');
    try {
      sessionStorage.setItem('cognitive_return_url', window.location.pathname);
    } catch (e) {}

    setTimeout(() => {
      if (window.location.protocol.startsWith('http')) {
        window.location.replace('/index.html');
      }
    }, 1200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runGuard);
  } else {
    runGuard();
  }

  // Expose lock/unlock interface
  window.__COGNITIVE_AUTH_GUARD__ = {
    unlock: unlockContent,
    lock: createLockOverlay,
    neutralize: neutralizeGameElements
  };
})();
