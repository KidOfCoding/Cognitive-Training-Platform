import { Clerk } from '@clerk/clerk-js';

// --- CONFIGURATION ---
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPubKey) {
  throw new Error("Missing Publishable Key. Make sure to set VITE_CLERK_PUBLISHABLE_KEY in your .env file and restart the server.");
}

// Generate or retrieve persistent unique device ID for this client/browser
function getDeviceId() {
  let id = localStorage.getItem('cognitive_device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now();
    localStorage.setItem('cognitive_device_id', id);
  }
  return id;
}

const deviceId = getDeviceId();

const crossTabChannel = typeof window.BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('cognitive_games_tab_sync')
  : null;

if (crossTabChannel) {
  crossTabChannel.onmessage = (event) => {
    const data = event.data;
    if (!data) return;
    if (data.type === 'BALANCES_UPDATED') {
      if (data.freeChances) userState.freeChances = data.freeChances;
      if (data.paidChances !== undefined) userState.paidChances = data.paidChances;
      updateUI();
    } else if (data.type === 'SESSION_REVOKED') {
      if (data.sourceDeviceId && data.sourceDeviceId === deviceId) {
        // Same browser/device tabs must not revoke each other
        return;
      }
      stopHeartbeat();
      stopAutoRetry();
      showConcurrentDevicePage(currentUser?.primaryEmailAddress?.emailAddress || '');
    }
  };
}

function broadcastBalanceUpdate() {
  if (crossTabChannel && userState) {
    try {
      crossTabChannel.postMessage({
        type: 'BALANCES_UPDATED',
        freeChances: userState.freeChances,
        paidChances: userState.paidChances,
      });
    } catch {
      // Ignore broadcast errors
    }
  }
}

// Calculate total available chances summed across all games
function calculateTotalChances(state = userState) {
  if (!state) return 0;
  let total = 0;
  for (const game of games) {
    const free = Number(state.freeChances?.[game.id]) || 0;
    let paid = 0;
    if (typeof state.paidChances === 'object' && state.paidChances !== null) {
      paid = Number(state.paidChances[game.id]) || 0;
    } else {
      paid = Number(state.paidChances) || 0;
    }
    total += Math.max(0, free) + Math.max(0, paid);
  }
  return total;
}

// Helper: Formats user agent strings into readable device labels
function formatDeviceName(userAgentStr) {
  if (!userAgentStr) return 'Registered Device';
  const ua = userAgentStr.toLowerCase();
  let os = 'Device';
  if (ua.includes('windows')) os = 'Windows PC';
  else if (ua.includes('macintosh') || ua.includes('mac os')) os = 'Mac';
  else if (ua.includes('iphone')) os = 'iPhone';
  else if (ua.includes('ipad')) os = 'iPad';
  else if (ua.includes('android')) os = 'Android Phone';
  else if (ua.includes('linux')) os = 'Linux PC';

  let browser = '';
  if (ua.includes('edg/')) browser = 'Edge';
  else if (ua.includes('chrome/')) browser = 'Chrome';
  else if (ua.includes('firefox/')) browser = 'Firefox';
  else if (ua.includes('safari/')) browser = 'Safari';

  return browser ? `${os} (${browser})` : os;
}

// Helper: Verify whether an email address is from an official college/university domain
function isCollegeEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const cleanEmail = email.trim().toLowerCase();
  const atIdx = cleanEmail.lastIndexOf('@');
  if (atIdx === -1) return false;

  const domain = cleanEmail.slice(atIdx + 1);
  if (!domain || domain.includes(' ') || !domain.includes('.') || domain.includes('..') || domain.startsWith('.') || domain.endsWith('.')) return false;

  // 1. Check custom domains specified via environment variable (comma-separated)
  const envDomainsStr = import.meta.env.VITE_ALLOWED_EMAIL_DOMAINS || '';
  const customDomains = envDomainsStr
    .split(',')
    .map(d => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);

  if (customDomains.some(custom => domain === custom || domain.endsWith('.' + custom))) {
    return true;
  }

  // 2. Reject common public consumer webmail domains
  const publicMailProviders = [
    'gmail.com',
    'googlemail.com',
    'yahoo.com',
    'yahoo.co.in',
    'outlook.com',
    'hotmail.com',
    'live.com',
    'icloud.com',
    'aol.com',
    'proton.me',
    'protonmail.com',
    'zoho.com'
  ];
  if (publicMailProviders.includes(domain)) {
    return false;
  }

  // 3. Educational domains (.edu, .edu.in, .edu.au, etc.)
  // Must strictly terminate with .edu or .edu.<country-code>
  if (domain === 'edu' || /\.edu(\.[a-z]{2,3})?$/i.test(domain)) {
    return true;
  }

  // 4. Academic ccTLDs (.ac.in, .ac.uk, .ac.nz, .ac.za, .ac.jp, etc.)
  // Must strictly terminate with .ac or .ac.<country-code>
  if (domain === 'ac' || /\.ac(\.[a-z]{2,3})?$/i.test(domain)) {
    return true;
  }

  return false;
}

const games = [
    { 
      id: 'path-finder', 
      title: 'Dynamic Memory Path', 
      description: 'Memorize the invisible path to reach the goal.', 
      path: '/path_game/Path_Find_V3_Cool.html', 
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18.1 12.1a2 2 0 1 0-2.2 2.2"/><path d="M12.1 18.1a2 2 0 1 0 2.2-2.2"/><path d="m3 9 6-6"/><path d="m9 3 6 6"/><path d="M3 15h6"/><path d="M15 3h6"/></svg>` 
    },
    { 
      id: 'bubble-sort', 
      title: 'Math Bubble Sort', 
      description: 'Calculate and sort the mathematical expressions.', 
      path: '/bubble_game/Bubble_V4_Good.html', 
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="17" r="3"/><circle cx="16" cy="14" r="4"/><circle cx="11" cy="6" r="3"/></svg>` 
    },
    { 
      id: 'tile-maze', 
      title: 'PathFinder Mouse', 
      description: 'Rotate tiles to connect the mouse to the cheese.', 
      path: '/tile_game/Tile_Arrow_Game_Amazing.html', 
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 8h10"/><path d="M7 12h5"/><path d="M7 16h8"/></svg>` 
    }
];

// --- DOM ELEMENT SELECTORS ---
const signInPage = document.getElementById('sign-in-page');
const clerkMountPoint = document.getElementById('clerk-mount-point');
const appContainer = document.getElementById('app-container');
const userButtonMount = document.getElementById('user-button');
const gameListContainer = document.getElementById('game-list');
const gameFrame = document.getElementById('game-frame');
const loader = document.getElementById('loader');
const welcomeScreen = document.getElementById('welcome-screen');
const mobileGameTitle = document.getElementById('mobile-game-title');

// College Email Restriction Elements
const collegeEmailRequiredPage = document.getElementById('college-email-required-page');
const deniedEmailDisplay = document.getElementById('denied-email-display');
const emailDeniedSignOutBtn = document.getElementById('email-denied-sign-out');

// Concurrent Session Elements (1 Device Active at a Time)
const concurrentSessionPage = document.getElementById('concurrent-session-page');
const concurrentEmailDisplay = document.getElementById('concurrent-email-display');
const concurrentTakeoverBtn = document.getElementById('concurrent-takeover-btn');
const concurrentRetryBtn = document.getElementById('concurrent-retry-btn');
const concurrentRetryText = document.getElementById('concurrent-retry-text');
const concurrentSignOutBtn = document.getElementById('concurrent-sign-out-btn');
const concurrentAutoRetryNotice = document.getElementById('concurrent-auto-retry-notice');

// Device Limit Elements (Strict 2 Devices Policy)
const deviceLimitPage = document.getElementById('device-limit-page');
const deviceLimitEmailDisplay = document.getElementById('device-limit-email-display');
const deviceLimitResetBtn = document.getElementById('device-limit-reset-btn');
const deviceLimitResetLabel = document.getElementById('device-limit-reset-label');
const deviceLimitSignOutBtn = document.getElementById('device-limit-sign-out-btn');
const gameActiveNav = document.getElementById('game-active-nav');
const exitGameToDashboardBtn = document.getElementById('exit-game-to-dashboard-btn');

// Game Launch Consent / Preview Elements
const gamePreviewScreen = document.getElementById('game-preview-screen');
const previewGameIcon = document.getElementById('preview-game-icon');
const previewGameTitle = document.getElementById('preview-game-title');
const previewGameDesc = document.getElementById('preview-game-desc');
const previewGameChancesBadge = document.getElementById('preview-game-chances-badge');
const startGameBtn = document.getElementById('start-game-btn');
const cancelGameBtn = document.getElementById('cancel-game-btn');
const previewWatchDemoBtn = document.getElementById('preview-watch-demo-btn');

// Payment & Balance Elements
const paidChancesCountEl = document.getElementById('paid-chances-count');
const buyChancesBtn = document.getElementById('buy-chances-btn');
const buyChancesPackLabel = document.getElementById('buy-chances-pack-label');
const buyChancesPriceTag = document.getElementById('buy-chances-price-tag');
const balanceBreakdownSubtext = document.getElementById('balance-breakdown-subtext');
const paymentModal = document.getElementById('payment-modal');
const closePaymentModalBtn = document.getElementById('close-payment-modal');
const modalNoticeText = document.getElementById('modal-notice-text');
const modalPackName = document.getElementById('modal-pack-name');
const modalPackAttempts = document.getElementById('modal-pack-attempts');
const packPriceDisplay = document.getElementById('pack-price-display');
const payNowBtn = document.getElementById('pay-now-btn');
const payBtnLabel = document.getElementById('pay-btn-label');
const paymentStatusMsg = document.getElementById('payment-status-msg');
const welcomePackFeatureLine = document.getElementById('welcome-pack-feature-line');
const welcomePriceValue = document.getElementById('welcome-price-value');
const welcomePriceUnit = document.getElementById('welcome-price-unit');
const welcomeBuyPackLabel = document.getElementById('welcome-buy-pack-label');

// State
let clerkInstance = null;
let currentUser = null;
let heartbeatInterval = null;
let autoRetryInterval = null;
let autoRetrySecondsLeft = 15;
let activePreviewGame = null;

function readPositiveConfigNumber(rawValue, fallback = 0) {
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeConfig(rawConfig = {}) {
  return {
    paidChancesPack: readPositiveConfigNumber(
      rawConfig.paidChancesPack,
      readPositiveConfigNumber(import.meta.env.VITE_PAID_CHANCES, 0)
    ),
    paidChancesPrice: readPositiveConfigNumber(
      rawConfig.paidChancesPrice,
      readPositiveConfigNumber(import.meta.env.VITE_PAID_CHANCES_PRICE, 0)
    ),
    razorpayKeyId: rawConfig.razorpayKeyId || '',
  };
}

let userState = {
  freeChances: {
    'path-finder': readPositiveConfigNumber(import.meta.env.VITE_FREE_CHANCES, 0),
    'bubble-sort': readPositiveConfigNumber(import.meta.env.VITE_FREE_CHANCES, 0),
    'tile-maze': readPositiveConfigNumber(import.meta.env.VITE_FREE_CHANCES, 0),
  },
  paidChances: {
    'path-finder': 0,
    'bubble-sort': 0,
    'tile-maze': 0,
  },
  config: normalizeConfig(),
};

// --- VIEW MANAGEMENT ---
function switchView(view) {
  // view: 'sign-in' | 'college-denied' | 'concurrent-denied' | 'device-limit-denied' | 'app'
  const screens = [
    { el: signInPage, name: 'sign-in' },
    { el: collegeEmailRequiredPage, name: 'college-denied' },
    { el: concurrentSessionPage, name: 'concurrent-denied' },
    { el: deviceLimitPage, name: 'device-limit-denied' },
    { el: appContainer, name: 'app' },
  ];

  screens.forEach(({ el, name }) => {
    if (!el) return;
    if (view === name) {
      el.classList.remove('hidden');
      el.style.setProperty('display', 'flex', 'important');
    } else {
      el.classList.add('hidden');
      el.style.setProperty('display', 'none', 'important');
    }
  });
}

function showCollegeDeniedPage(email) {
  stopHeartbeat();
  stopAutoRetry();
  if (deniedEmailDisplay) {
    deniedEmailDisplay.textContent = email || 'No Email';
  }
  switchView('college-denied');
}

function showConcurrentDevicePage(email) {
  stopHeartbeat();
  stopAutoRetry();
  if (concurrentEmailDisplay) {
    concurrentEmailDisplay.textContent = email || 'Current Account';
  }
  if (concurrentAutoRetryNotice) {
    concurrentAutoRetryNotice.textContent = 'Only 1 device may access assessments at a time. Click "Continue on This Device" to transfer active access here.';
  }
  switchView('concurrent-denied');
}

function showDeviceLimitPage(email) {
  stopHeartbeat();
  stopAutoRetry();
  if (deviceLimitEmailDisplay) {
    deviceLimitEmailDisplay.textContent = email || 'Current Account';
  }
  switchView('device-limit-denied');
}

// --- SESSION & HEARTBEAT MANAGEMENT ---
function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

function startHeartbeat(userId) {
  stopHeartbeat();
  // Clerk manages the primary session lifecycle.
  // A gentle 2-minute check ensures superseded devices discover session state gracefully.
  heartbeatInterval = setInterval(async () => {
    if (!currentUser || currentUser.id !== userId) {
      stopHeartbeat();
      return;
    }
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'heartbeat',
          userId,
          deviceId,
        })
      });

      const data = await res.json();
      if (!res.ok || !data.allowed) {
        stopHeartbeat();
        if (data.error === 'DEVICE_LIMIT_EXCEEDED') {
          showDeviceLimitPage(currentUser?.primaryEmailAddress?.emailAddress || '', data.allowedDevices || []);
        } else {
          showConcurrentDevicePage(currentUser?.primaryEmailAddress?.emailAddress || '');
        }
      }
    } catch {
      // Gentle background check: ignore transient network hiccups
    }
  }, 25000);
}

function releaseDeviceSession(userId) {
  if (!userId) return;
  const payload = JSON.stringify({
    action: 'release',
    userId,
    deviceId,
  });

  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' });
    navigator.sendBeacon('/api/session', blob);
  } else {
    fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }
}

async function claimDeviceSession(userId, email) {
  try {
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'claim',
        userId,
        deviceId,
        email,
        deviceInfo: navigator.userAgent,
      })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.allowed) {
      return { allowed: true };
    }

    if (res.status === 403 && data.error === 'DEVICE_LIMIT_EXCEEDED') {
      return {
        allowed: false,
        error: 'DEVICE_LIMIT_EXCEEDED',
        message: data.message,
        allowedDevices: data.allowedDevices || [],
      };
    }

    if (res.status === 409 && data.error === 'ACTIVE_SESSION_EXISTS') {
      return {
        allowed: false,
        error: 'ACTIVE_SESSION_EXISTS',
        message: data.message,
        secondsRemaining: data.secondsRemaining || 15,
      };
    }

    if (res.status === 403 && data.error === 'COLLEGE_EMAIL_REQUIRED') {
      return {
        allowed: false,
        error: 'COLLEGE_EMAIL_REQUIRED',
        message: data.message,
      };
    }

    return {
      allowed: false,
      error: 'SERVER_ERROR',
      message: data.error || data.message || 'Server connection error',
    };
  } catch (err) {
    console.error('Error claiming device session:', err);
    return {
      allowed: false,
      error: 'NETWORK_ERROR',
      message: 'Network connection error',
    };
  }
}

async function triggerSessionTakeover() {
  if (!currentUser) return;
  const email = currentUser.primaryEmailAddress?.emailAddress || '';

  if (concurrentTakeoverBtn) {
    concurrentTakeoverBtn.disabled = true;
    concurrentTakeoverBtn.classList.add('opacity-75');
  }

  try {
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'takeover',
        userId: currentUser.id,
        deviceId,
        email,
        deviceInfo: navigator.userAgent,
      })
    });

    const data = await res.json();
    if (res.ok && data.allowed) {
      stopAutoRetry();
      switchView('app');
      clerkInstance.mountUserButton(userButtonMount);
      populateGameList();
      startHeartbeat(currentUser.id);
      await syncUserWithDB(currentUser);
    } else {
      console.warn('Takeover error:', data);
    }
  } catch (err) {
    console.error('Error taking over session:', err);
  } finally {
    if (concurrentTakeoverBtn) {
      concurrentTakeoverBtn.disabled = false;
      concurrentTakeoverBtn.classList.remove('opacity-75');
    }
  }
}

function stopAutoRetry() {
  if (autoRetryInterval) {
    clearInterval(autoRetryInterval);
    autoRetryInterval = null;
  }
}

function startAutoRetry(seconds = 15) {
  stopAutoRetry();
  autoRetrySecondsLeft = Math.max(1, seconds);
  if (concurrentAutoRetryNotice) {
    concurrentAutoRetryNotice.innerHTML = `Active on another device (expires in <span class="text-amber-400 font-mono font-bold">${autoRetrySecondsLeft}s</span>). Click <strong>"Continue on This Device"</strong> to transfer access here now.`;
  }

  autoRetryInterval = setInterval(async () => {
    autoRetrySecondsLeft--;
    if (autoRetrySecondsLeft <= 0) {
      stopAutoRetry();
      if (concurrentAutoRetryNotice) {
        concurrentAutoRetryNotice.textContent = 'Auto-checking availability...';
      }
      await triggerSessionRetry();
    } else {
      if (concurrentAutoRetryNotice) {
        concurrentAutoRetryNotice.innerHTML = `Active on another device (expires in <span class="text-amber-400 font-mono font-bold">${autoRetrySecondsLeft}s</span>). Click <strong>"Continue on This Device"</strong> to transfer access here now.`;
      }
    }
  }, 1000);
}

async function triggerSessionRetry() {
  if (!currentUser) return;
  const email = currentUser.primaryEmailAddress?.emailAddress || '';

  if (concurrentRetryBtn) {
    concurrentRetryBtn.disabled = true;
    concurrentRetryBtn.classList.add('opacity-75');
  }
  if (concurrentRetryText) {
    concurrentRetryText.textContent = 'Checking availability...';
  }

  const claim = await claimDeviceSession(currentUser.id, email);

  if (concurrentRetryBtn) {
    concurrentRetryBtn.disabled = false;
    concurrentRetryBtn.classList.remove('opacity-75');
  }
  if (concurrentRetryText) {
    concurrentRetryText.textContent = 'Check Availability';
  }

  if (claim.allowed) {
    stopAutoRetry();
    switchView('app');
    clerkInstance.mountUserButton(userButtonMount, { afterSignOutUrl: '/index.html' });
    populateGameList();
    startHeartbeat(currentUser.id);
    await syncUserWithDB(currentUser);
  } else if (claim.error === 'DEVICE_LIMIT_EXCEEDED') {
    stopAutoRetry();
    showDeviceLimitPage(email, claim.allowedDevices || []);
  } else {
    startAutoRetry(claim.secondsRemaining || 15);
  }
}

async function triggerDeviceReset() {
  if (!currentUser) return;
  const email = currentUser.primaryEmailAddress?.emailAddress || '';

  if (deviceLimitResetBtn) {
    deviceLimitResetBtn.disabled = true;
    deviceLimitResetBtn.classList.add('opacity-75');
  }
  if (deviceLimitResetLabel) {
    deviceLimitResetLabel.textContent = 'Authorizing device...';
  }

  try {
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reset-devices',
        userId: currentUser.id,
        deviceId,
        email,
        deviceInfo: navigator.userAgent,
      })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.allowed) {
      stopAutoRetry();
      switchView('app');
      clerkInstance.mountUserButton(userButtonMount, { afterSignOutUrl: '/index.html' });
      populateGameList();
      startHeartbeat(currentUser.id);
      await syncUserWithDB(currentUser);
    } else {
      alert(data.message || 'Unable to authorize this device. Please try again.');
    }
  } catch (err) {
    console.error('Error resetting device:', err);
    alert('Network communication error while resetting device.');
  } finally {
    if (deviceLimitResetBtn) {
      deviceLimitResetBtn.disabled = false;
      deviceLimitResetBtn.classList.remove('opacity-75');
    }
    if (deviceLimitResetLabel) {
      deviceLimitResetLabel.textContent = 'Authorize This Device (Reset Slots)';
    }
  }
}

// Sync latest balances and device authorization state when window/tab gains focus
window.addEventListener('focus', async () => {
  if (currentUser && appContainer && appContainer.style.display !== 'none') {
    await syncUserWithDB(currentUser);
  }
});

// --- API CLIENT ---
async function syncUserWithDB(user) {
  try {
    const res = await fetch('/api/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        email: user.primaryEmailAddress?.emailAddress || '',
        name: user.fullName || user.firstName || 'Player',
        deviceId,
      }),
    });

    if (res.status === 409) {
      if (crossTabChannel) crossTabChannel.postMessage({ type: 'SESSION_REVOKED', sourceDeviceId: deviceId });
      showConcurrentDevicePage(user.primaryEmailAddress?.emailAddress || '');
      return false;
    }

    if (res.status === 403) {
      const errData = await res.json().catch(() => ({}));
      if (errData.error === 'DEVICE_LIMIT_EXCEEDED') {
        showDeviceLimitPage(user.primaryEmailAddress?.emailAddress || '', errData.allowedDevices || []);
      } else {
        showCollegeDeniedPage(user.primaryEmailAddress?.emailAddress || '');
      }
      return false;
    }

    if (!res.ok) throw new Error('Failed to fetch user state');
    const data = await res.json();
    userState = {
      freeChances: data.freeChances || {},
      paidChances: data.paidChances ?? 0,
      config: normalizeConfig(data.config || userState.config),
    };
    updateUI();
    broadcastBalanceUpdate();
    return true;
  } catch (err) {
    console.error('Error syncing user:', err);
    return false;
  }
}

async function requestPlayGame(gameId) {
  try {
    const res = await fetch('/api/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.id,
        gameId,
        deviceId,
      }),
    });
    const data = await res.json();

    if (res.status === 403 && data.error === 'DEVICE_LIMIT_EXCEEDED') {
      showDeviceLimitPage(currentUser?.primaryEmailAddress?.emailAddress || '', data.allowedDevices || []);
      return { allowed: false, message: data.message };
    }

    if (res.status === 403 && (data.error === 'ACTIVE_SESSION_EXISTS' || data.error === 'SESSION_REVOKED')) {
      if (crossTabChannel) crossTabChannel.postMessage({ type: 'SESSION_REVOKED', sourceDeviceId: deviceId });
      showConcurrentDevicePage(currentUser?.primaryEmailAddress?.emailAddress || '');
      return { allowed: false, message: data.message };
    }

    if (res.status === 403 && data.error === 'COLLEGE_EMAIL_REQUIRED') {
      showCollegeDeniedPage(currentUser?.primaryEmailAddress?.emailAddress || '');
      return { allowed: false, message: data.message };
    }

    if (res.ok && data.allowed) {
      userState.freeChances = data.freeChances;
      userState.paidChances = data.paidChances;
      updateUI();
      broadcastBalanceUpdate();
      return { allowed: true, usedType: data.usedType };
    }
    return { allowed: false, message: data.message };
  } catch (err) {
    console.error('Error verifying play chance:', err);
    return { allowed: false, message: 'Server communication error' };
  }
}

// --- UI UPDATES ---
function refreshPreviewScreen(game) {
  if (!game) return;
  const freeLeft = userState.freeChances?.[game.id] || 0;
  let paidLeft = 0;
  if (typeof userState.paidChances === 'object' && userState.paidChances !== null) {
    paidLeft = userState.paidChances[game.id] || 0;
  } else {
    paidLeft = Number(userState.paidChances) || 0;
  }
  const totalLeft = freeLeft + paidLeft;

  if (previewGameIcon) previewGameIcon.innerHTML = game.icon;
  if (previewGameTitle) previewGameTitle.textContent = game.title;
  if (previewGameDesc) previewGameDesc.textContent = game.description;

  if (previewGameChancesBadge) {
    if (totalLeft > 0) {
      previewGameChancesBadge.className = 'badge badge--emerald';
      previewGameChancesBadge.textContent = `${totalLeft} Play${totalLeft > 1 ? 's' : ''} Available`;
    } else {
      previewGameChancesBadge.className = 'badge badge--rose';
      previewGameChancesBadge.textContent = '0 Plays — Recharge Needed';
    }
  }
}

function updateUI() {
  const totalChances = calculateTotalChances(userState);
  const packSize = readPositiveConfigNumber(userState.config?.paidChancesPack, 0);
  const packPrice = readPositiveConfigNumber(userState.config?.paidChancesPrice, 0);
  const gameCount = games.length;

  if (paidChancesCountEl) {
    paidChancesCountEl.textContent = `${totalChances}`;
  }
  if (balanceBreakdownSubtext) {
    balanceBreakdownSubtext.textContent = `Summed across all ${gameCount} assessments`;
  }
  if (buyChancesPackLabel) {
    buyChancesPackLabel.textContent = `+${packSize} Plays`;
  }
  if (buyChancesPriceTag) {
    buyChancesPriceTag.textContent = `₹${packPrice}`;
  }
  if (modalPackName) {
    modalPackName.textContent = `${packSize} Plays Power Pack`;
  }
  if (modalPackAttempts) {
    modalPackAttempts.textContent = `${packSize} extra attempts`;
  }
  if (packPriceDisplay) {
    packPriceDisplay.textContent = `₹${packPrice}`;
  }
  if (payBtnLabel) {
    payBtnLabel.textContent = `Pay ₹${packPrice} via Razorpay / UPI`;
  }
  if (welcomePackFeatureLine) {
    welcomePackFeatureLine.innerHTML = `
      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      +${packSize} Plays for all ${gameCount} assessments
    `;
  }
  if (welcomePriceValue) {
    welcomePriceValue.textContent = `₹${packPrice}`;
  }
  if (welcomePriceUnit) {
    welcomePriceUnit.textContent = `/ ${packSize} Plays`;
  }
  if (welcomeBuyPackLabel) {
    welcomeBuyPackLabel.textContent = `Get ${packSize} Plays Pack`;
  }

  // Update badges on all game cards
  games.forEach(game => {
    const card = document.querySelector(`.game-card[data-game-id="${game.id}"]`);
    if (!card) return;
    const badge = card.querySelector('.game-chance-badge');
    const freeLeft = userState.freeChances?.[game.id] || 0;
    let paidLeft = 0;
    if (typeof userState.paidChances === 'object' && userState.paidChances !== null) {
      paidLeft = userState.paidChances[game.id] || 0;
    } else {
      paidLeft = Number(userState.paidChances) || 0;
    }
    const totalLeft = freeLeft + paidLeft;

    if (badge) {
      if (totalLeft > 0) {
        if (freeLeft > 0) {
          badge.className = 'game-chance-badge badge badge--emerald';
          badge.textContent = `${totalLeft} Play${totalLeft > 1 ? 's' : ''} Left`;
        } else {
          badge.className = 'game-chance-badge badge badge--cyan';
          badge.textContent = `${totalLeft} Play${totalLeft > 1 ? 's' : ''} Left`;
        }
      } else {
        badge.className = 'game-chance-badge badge';
        badge.style.background = 'rgba(255,255,255,0.04)';
        badge.style.color = 'rgba(255,255,255,0.28)';
        badge.style.borderColor = 'rgba(255,255,255,0.06)';
        badge.textContent = '0 Plays Left';
      }
    }
  });

  if (activePreviewGame) {
    refreshPreviewScreen(activePreviewGame);
  }
}

function openPaymentModal(noticeMessage = '') {
  if (modalNoticeText) {
    modalNoticeText.textContent = noticeMessage || `You have exhausted your available plays. Recharge with ${readPositiveConfigNumber(userState.config?.paidChancesPack, 0)} extra plays to continue training!`;
  }
  if (paymentStatusMsg) {
    paymentStatusMsg.textContent = '';
  }
  if (paymentModal) {
    paymentModal.classList.remove('hidden');
    paymentModal.style.setProperty('display', 'flex', 'important');
  }
}

function closePaymentModal() {
  if (paymentModal) {
    paymentModal.classList.add('hidden');
    paymentModal.style.setProperty('display', 'none', 'important');
  }
}

let paymentListenersInitialized = false;
function initPaymentModalListeners() {
  if (paymentListenersInitialized) return;
  paymentListenersInitialized = true;

  if (buyChancesBtn) {
    buyChancesBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openPaymentModal(`Top up your account with ${readPositiveConfigNumber(userState.config?.paidChancesPack, 0)} extra plays across all cognitive games!`);
    });
  }

  const welcomeBuyBtn = document.getElementById('welcome-buy-pack-btn');
  if (welcomeBuyBtn) {
    welcomeBuyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openPaymentModal(`Top up your account with ${readPositiveConfigNumber(userState.config?.paidChancesPack, 0)} extra plays across all cognitive games!`);
    });
  }

  if (closePaymentModalBtn) {
    closePaymentModalBtn.addEventListener('click', closePaymentModal);
  }

  if (payNowBtn) {
    payNowBtn.addEventListener('click', startRazorpayCheckout);
  }

  if (paymentModal) {
    paymentModal.addEventListener('click', (e) => {
      if (e.target === paymentModal) closePaymentModal();
    });
  }
}

// Wire up payment listeners immediately
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPaymentModalListeners);
} else {
  initPaymentModalListeners();
}

// --- RAZORPAY CHECKOUT & RECHARGE FLOW ---
async function simulateRecharge() {
  if (!currentUser) {
    if (paymentStatusMsg) {
      paymentStatusMsg.textContent = 'Please sign in first to credit plays to your account.';
      paymentStatusMsg.className = 'text-xs text-rose-400 mt-3';
    }
    return;
  }
  if (paymentStatusMsg) {
    paymentStatusMsg.textContent = 'Crediting plays (Test simulation)...';
    paymentStatusMsg.className = 'text-xs text-sky-400 mt-3';
  }

  try {
    const res = await fetch('/api/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.id,
        isDevSimulation: true,
      }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      userState.paidChances = data.paidChances;
      if (data.freeChances) userState.freeChances = data.freeChances;
      updateUI();
      broadcastBalanceUpdate();
      paymentStatusMsg.textContent = `Success! ${data.credited || 7} plays credited to your balance!`;
      paymentStatusMsg.className = 'text-xs text-emerald-400 font-semibold mt-3';
      setTimeout(() => closePaymentModal(), 1500);
    } else {
      paymentStatusMsg.textContent = data.error || 'Recharge failed';
      paymentStatusMsg.className = 'text-xs text-rose-400 mt-3';
    }
  } catch (err) {
    paymentStatusMsg.textContent = 'Server communication error';
    paymentStatusMsg.className = 'text-xs text-rose-400 mt-3';
  }
}

function retryRazorpayLoad() {
  if (paymentStatusMsg) {
    paymentStatusMsg.textContent = 'Reloading Razorpay gateway SDK...';
    paymentStatusMsg.className = 'text-xs text-sky-400 mt-3';
  }

  const existing = document.getElementById('rzp-dynamic-script');
  if (existing) existing.remove();

  const s = document.createElement('script');
  s.id = 'rzp-dynamic-script';
  s.src = 'https://checkout.razorpay.com/v1/checkout.js';
  s.async = true;
  s.onload = () => {
    paymentStatusMsg.textContent = 'Razorpay loaded successfully. Ready to pay.';
    paymentStatusMsg.className = 'text-xs text-emerald-400 mt-3';
  };
  s.onerror = () => {
    paymentStatusMsg.innerHTML = `
      <span>Razorpay CDN timed out on this network.</span>
      <div class="mt-2.5 flex justify-center">
        <button id="dev-sim-recharge-btn" type="button" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-xs shadow transition">
          ⚡ Add +${userState.config?.paidChancesPack || 7} Plays (Test Credit)
        </button>
      </div>
    `;
    paymentStatusMsg.className = 'text-xs text-rose-400 mt-3';
    document.getElementById('dev-sim-recharge-btn')?.addEventListener('click', simulateRecharge);
  };
  document.head.appendChild(s);
}

async function startRazorpayCheckout() {
  if (!currentUser) {
    if (paymentStatusMsg) {
      paymentStatusMsg.textContent = 'Please sign in first to purchase plays.';
      paymentStatusMsg.className = 'text-xs text-rose-400 mt-3';
    }
    return;
  }

  if (typeof window.Razorpay === 'undefined') {
    paymentStatusMsg.innerHTML = `
      <span>Razorpay script timed out on this network (ERR_CONNECTION_TIMED_OUT).</span>
      <div class="mt-2.5 flex flex-col gap-2 items-center">
        <button id="dev-sim-recharge-btn" type="button" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-xs shadow transition">
          ⚡ Add +${userState.config?.paidChancesPack || 7} Plays (Test Credit)
        </button>
        <button id="retry-razorpay-load-btn" type="button" class="text-[11px] text-cyan-400 hover:underline">
          ↻ Retry Loading Razorpay
        </button>
      </div>
    `;
    paymentStatusMsg.className = 'text-xs text-rose-400 mt-3';
    document.getElementById('dev-sim-recharge-btn')?.addEventListener('click', simulateRecharge);
    document.getElementById('retry-razorpay-load-btn')?.addEventListener('click', retryRazorpayLoad);
    return;
  }

  try {
    payNowBtn.disabled = true;
    payNowBtn.classList.add('opacity-75');
    paymentStatusMsg.textContent = 'Creating secure order...';
    paymentStatusMsg.className = 'text-xs text-sky-400 mt-3';

    const orderRes = await fetch('/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.id,
        email: currentUser.primaryEmailAddress?.emailAddress || '',
        deviceId,
      }),
    });

    if (!orderRes.ok) {
      const errData = await orderRes.json().catch(() => ({}));
      throw new Error(errData.error || errData.message || 'Failed to create payment order');
    }

    const orderData = await orderRes.json();

    const options = {
      key: orderData.keyId,
      amount: orderData.amount,
      currency: orderData.currency || 'INR',
      name: 'Cognitive Games Platform',
      description: `${orderData.packChances} Extra Cognitive Game Plays`,
      order_id: orderData.orderId,
      prefill: {
        name: currentUser.fullName || currentUser.firstName || 'Player',
        email: currentUser.primaryEmailAddress?.emailAddress || '',
      },
      theme: {
        color: '#0284c7', // Sky-600
      },
      handler: async function (response) {
        paymentStatusMsg.textContent = 'Verifying payment with bank...';
        paymentStatusMsg.className = 'text-xs text-amber-400 mt-3';

        try {
          const verifyRes = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: currentUser.id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });

          const verifyData = await verifyRes.json();

          if (verifyRes.ok && verifyData.success) {
            userState.paidChances = verifyData.paidChances;
            if (verifyData.freeChances) {
              userState.freeChances = verifyData.freeChances;
            }
            updateUI();
            broadcastBalanceUpdate();
            paymentStatusMsg.textContent = `Payment Successful! ${userState.config.paidChancesPack} chances credited.`;
            paymentStatusMsg.className = 'text-xs text-emerald-400 font-semibold mt-3';

            setTimeout(() => {
              closePaymentModal();
            }, 1500);
          } else {
            throw new Error(verifyData.error || 'Signature verification failed');
          }
        } catch (vErr) {
          console.error('Payment verification error:', vErr);
          paymentStatusMsg.textContent = `Verification error: ${vErr.message}`;
          paymentStatusMsg.className = 'text-xs text-rose-400 mt-3';
        }
      },
      modal: {
        ondismiss: function () {
          payNowBtn.disabled = false;
          payNowBtn.classList.remove('opacity-75');
          paymentStatusMsg.textContent = 'Payment cancelled.';
          paymentStatusMsg.className = 'text-xs text-slate-400 mt-3';
        }
      }
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function (response) {
      paymentStatusMsg.textContent = `Payment Failed: ${response.error?.description || 'Transaction declined'}`;
      paymentStatusMsg.className = 'text-xs text-rose-400 mt-3';
      payNowBtn.disabled = false;
      payNowBtn.classList.remove('opacity-75');
    });

    rzp.open();
  } catch (error) {
    console.error('Error launching Razorpay:', error);
    paymentStatusMsg.innerHTML = `
      <span>Payment failed: ${error.message || 'Gateway error'}</span>
      <div class="mt-2.5 flex justify-center">
        <button id="dev-sim-recharge-btn-fallback" type="button" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-xs shadow transition">
          ⚡ Add +${userState.config?.paidChancesPack || 7} Plays (Test Credit)
        </button>
      </div>
    `;
    paymentStatusMsg.className = 'text-xs text-rose-400 mt-3';
    document.getElementById('dev-sim-recharge-btn-fallback')?.addEventListener('click', simulateRecharge);
  } finally {
    payNowBtn.disabled = false;
    payNowBtn.classList.remove('opacity-75');
  }
}

// --- MAIN APP FUNCTION ---
let populateGameList = null;

async function startApp() {
    const clerk = new Clerk(clerkPubKey);
    clerkInstance = clerk;
    await clerk.load();

    // Event Listeners for Payment Modal
    if (buyChancesBtn) {
      buyChancesBtn.addEventListener('click', () => {
        openPaymentModal(`Top up your account with ${readPositiveConfigNumber(userState.config?.paidChancesPack, 0)} extra plays across all cognitive games!`);
      });
    }

    if (closePaymentModalBtn) {
      closePaymentModalBtn.addEventListener('click', closePaymentModal);
    }

    if (payNowBtn) {
      payNowBtn.addEventListener('click', startRazorpayCheckout);
    }

    // Modal background click to close
    paymentModal.addEventListener('click', (e) => {
      if (e.target === paymentModal) closePaymentModal();
    });

    // Event Listeners for Restriction Screens
    if (emailDeniedSignOutBtn) {
      emailDeniedSignOutBtn.addEventListener('click', async () => {
        if (currentUser) releaseDeviceSession(currentUser.id);
        await clerk.signOut({ redirectUrl: window.location.origin + '/index.html' });
      });
    }

    if (concurrentTakeoverBtn) {
      concurrentTakeoverBtn.addEventListener('click', triggerSessionTakeover);
    }

    if (concurrentSignOutBtn) {
      concurrentSignOutBtn.addEventListener('click', async () => {
        if (currentUser) releaseDeviceSession(currentUser.id);
        stopAutoRetry();
        await clerk.signOut({ redirectUrl: window.location.origin + '/index.html' });
      });
    }

    if (deviceLimitResetBtn) {
      deviceLimitResetBtn.addEventListener('click', triggerDeviceReset);
    }

    if (deviceLimitSignOutBtn) {
      deviceLimitSignOutBtn.addEventListener('click', async () => {
        if (currentUser) releaseDeviceSession(currentUser.id);
        stopAutoRetry();
        stopHeartbeat();
        await clerk.signOut({ redirectUrl: window.location.origin + '/index.html' });
      });
    }

    if (concurrentRetryBtn) {
      concurrentRetryBtn.addEventListener('click', triggerSessionRetry);
    }

    if (exitGameToDashboardBtn) {
      exitGameToDashboardBtn.addEventListener('click', () => {
        activePreviewGame = null;
        if (gameActiveNav) {
          gameActiveNav.classList.add('hidden');
          gameActiveNav.style.display = 'none';
        }
        const activeTitleLabel = document.getElementById('game-active-title-label');
        if (activeTitleLabel) activeTitleLabel.innerHTML = '';
        const workspaceContainer = document.getElementById('game-workspace-container');
        if (workspaceContainer) workspaceContainer.classList.remove('game-active');
        if (gameFrame) {
          gameFrame.classList.add('hidden');
          gameFrame.src = 'about:blank';
        }
        if (gamePreviewScreen) {
          gamePreviewScreen.classList.add('hidden');
          gamePreviewScreen.style.display = 'none';
        }
        document.querySelectorAll('.game-card').forEach(card => card.classList.remove('active'));
        if (mobileGameTitle) mobileGameTitle.textContent = 'Select a Game';
        if (welcomeScreen) welcomeScreen.classList.remove('hidden');
      });
    }

    // Consent Screen: Start Game Button (only deducts play upon explicit user click)
    if (startGameBtn) {
      startGameBtn.addEventListener('click', async () => {
        if (!activePreviewGame || !currentUser) return;

        const freeLeft = userState.freeChances?.[activePreviewGame.id] || 0;
        let paidLeft = 0;
        if (typeof userState.paidChances === 'object' && userState.paidChances !== null) {
          paidLeft = userState.paidChances[activePreviewGame.id] || 0;
        } else {
          paidLeft = Number(userState.paidChances) || 0;
        }

        if (freeLeft <= 0 && paidLeft <= 0) {
          openPaymentModal(`You have used all plays for "${activePreviewGame.title}". Recharge to continue!`);
          return;
        }

        startGameBtn.disabled = true;
        startGameBtn.classList.add('opacity-75');

        try {
          const clearance = await requestPlayGame(activePreviewGame.id);

          if (!clearance.allowed) {
            if (clearance.message) {
              openPaymentModal(clearance.message);
            }
            return;
          }

          // Clearance granted!
          if (activePreviewGame.id === 'tile-maze') {
            // Open in a new window as requested
            if (gamePreviewScreen) {
              gamePreviewScreen.classList.add('hidden');
              gamePreviewScreen.style.display = 'none';
            }
            if (welcomeScreen) welcomeScreen.classList.remove('hidden');
            window.open(activePreviewGame.path, '_blank');
          } else {
            // Hide preview screen, show loader and launch iframe for other games
            if (gamePreviewScreen) {
              gamePreviewScreen.classList.add('hidden');
              gamePreviewScreen.style.display = 'none';
            }
            if (loader) loader.style.display = 'flex';
            gameFrame.src = activePreviewGame.path;
          }
        } finally {
          startGameBtn.disabled = false;
          startGameBtn.classList.remove('opacity-75');
        }
      });
    }

    // Consent Screen: Watch Demo Button (free to watch, does not consume plays)
    if (previewWatchDemoBtn) {
      previewWatchDemoBtn.addEventListener('click', () => {
        if (!activePreviewGame) return;
        if (activePreviewGame.id === 'tile-maze') {
          if (gamePreviewScreen) {
            gamePreviewScreen.classList.add('hidden');
            gamePreviewScreen.style.display = 'none';
          }
          if (welcomeScreen) welcomeScreen.classList.remove('hidden');
          window.open(activePreviewGame.path + '?demo=1', '_blank');
        } else {
          if (gamePreviewScreen) {
            gamePreviewScreen.classList.add('hidden');
            gamePreviewScreen.style.display = 'none';
          }
          if (loader) loader.style.display = 'flex';
          // Launch directly into demo mode!
          gameFrame.src = activePreviewGame.path + '?demo=1';
        }
      });
    }

    // Consent Screen: Cancel / Back Button
    if (cancelGameBtn) {
      cancelGameBtn.addEventListener('click', () => {
        activePreviewGame = null;
        if (gameActiveNav) {
          gameActiveNav.classList.add('hidden');
          gameActiveNav.style.display = 'none';
        }
        const activeTitleLabel = document.getElementById('game-active-title-label');
        if (activeTitleLabel) activeTitleLabel.innerHTML = '';
        const workspaceContainer = document.getElementById('game-workspace-container');
        if (workspaceContainer) workspaceContainer.classList.remove('game-active');
        if (gamePreviewScreen) {
          gamePreviewScreen.classList.add('hidden');
          gamePreviewScreen.style.display = 'none';
        }
        document.querySelectorAll('.game-card').forEach(card => card.classList.remove('active'));
        if (mobileGameTitle) mobileGameTitle.textContent = 'Select a Game';
        if (welcomeScreen) welcomeScreen.classList.remove('hidden');
      });
    }

    // Function to select and open game preview screen
    const selectGameForPreview = (game) => {
      if (!game) return;
      activePreviewGame = game;

      document.querySelectorAll('.game-card').forEach(card => {
        const isSelected = card.dataset.gameId === game.id;
        card.classList.toggle('active', isSelected);
        card.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      });
      if (mobileGameTitle) mobileGameTitle.textContent = game.title;

      refreshPreviewScreen(game);

      if (welcomeScreen) welcomeScreen.classList.add('hidden');
      if (loader) loader.style.display = 'none';
      if (gameFrame) gameFrame.classList.add('hidden');
      if (gameActiveNav) {
        gameActiveNav.classList.add('hidden');
        gameActiveNav.style.display = 'none';
      }
      if (gamePreviewScreen) {
        gamePreviewScreen.classList.remove('hidden');
        gamePreviewScreen.style.display = 'flex';
      }
    };

    // Welcome Screen Interactive Controls
    const welcomeBuyBtn = document.getElementById('welcome-buy-pack-btn');
    if (welcomeBuyBtn) {
      welcomeBuyBtn.addEventListener('click', () => {
        openPaymentModal(`Top up your account with ${readPositiveConfigNumber(userState.config?.paidChancesPack, 0)} extra plays across all cognitive games!`);
      });
    }

    document.querySelectorAll('[data-start-game]').forEach(btn => {
      btn.addEventListener('click', () => {
        const gameId = btn.getAttribute('data-start-game');
        const game = games.find(g => g.id === gameId);
        if (game) {
          selectGameForPreview(game);
        }
      });
    });

    // UI Logic: populate games list
    populateGameList = function () {
        if (gameListContainer.children.length > 0) return;

        gameFrame.addEventListener('load', () => {
          if (loader) loader.style.display = 'none';
          if (gameFrame && activePreviewGame && gameFrame.src && !gameFrame.src.endsWith('about:blank')) {
            gameFrame.classList.remove('hidden');
            if (gameActiveNav) {
              gameActiveNav.classList.remove('hidden');
              gameActiveNav.style.setProperty('display', 'flex', 'important');
            }
            const activeTitleLabel = document.getElementById('game-active-title-label');
            if (activeTitleLabel) {
              activeTitleLabel.innerHTML = `<span class="text-sky-300 font-bold">${activePreviewGame.title}</span>`;
            }
            const workspaceContainer = document.getElementById('game-workspace-container');
            if (workspaceContainer) {
              workspaceContainer.classList.add('game-active');
            }
            // Inform child game of current session info
            try {
              gameFrame.contentWindow?.postMessage({
                type: 'GAME_SESSION_INFO',
                gameId: activePreviewGame.id,
                totalChances: calculateTotalChances(userState)
              }, '*');
            } catch (e) {}
          }
        });

        // Listen for requests from embedded game iframes or popup game windows
        if (!window.__gameMessageListenerRegistered) {
          window.__gameMessageListenerRegistered = true;
          window.addEventListener('message', async (event) => {
            if (!event.data || typeof event.data !== 'object') return;

            if (event.data.type === 'OPEN_PAYMENT_MODAL') {
              openPaymentModal(event.data.message || `Top up your account with ${readPositiveConfigNumber(userState.config?.paidChancesPack, 0)} extra plays!`);
              try { window.focus(); } catch (e) {}
              return;
            }

            if (event.data.type === 'GET_GAME_SESSION_INFO') {
              try {
                event.source?.postMessage({
                  type: 'GAME_SESSION_INFO',
                  gameId: activePreviewGame?.id,
                  totalChances: calculateTotalChances(userState)
                }, '*');
              } catch (e) {}
              return;
            }

          if (event.data.type === 'REQUEST_NEW_GAME') {
            const targetGameId = event.data.gameId || activePreviewGame?.id;
            if (!targetGameId || !currentUser) {
              event.source?.postMessage({
                type: 'NEW_GAME_AUTHORIZED',
                allowed: true,
                standalone: true
              }, '*');
              return;
            }

            const freeLeft = userState.freeChances?.[targetGameId] || 0;
            let paidLeft = 0;
            if (typeof userState.paidChances === 'object' && userState.paidChances !== null) {
              paidLeft = userState.paidChances[targetGameId] || 0;
            } else {
              paidLeft = Number(userState.paidChances) || 0;
            }

            if (freeLeft <= 0 && paidLeft <= 0) {
              const targetGame = games.find(g => g.id === targetGameId) || activePreviewGame;
              openPaymentModal(`You have exhausted your available plays for "${targetGame?.title || 'this game'}". Recharge to start a new game!`);
              event.source?.postMessage({
                type: 'NEW_GAME_DENIED',
                reason: 'NO_CHANCES',
                message: 'No plays available. Please recharge!'
              }, '*');
              return;
            }

            // Deduct chance via backend
            const clearance = await requestPlayGame(targetGameId);
            if (clearance.allowed) {
              event.source?.postMessage({
                type: 'NEW_GAME_AUTHORIZED',
                allowed: true,
                remainingChances: calculateTotalChances(userState)
              }, '*');
            } else {
              if (clearance.message) {
                openPaymentModal(clearance.message);
              }
              event.source?.postMessage({
                type: 'NEW_GAME_DENIED',
                reason: 'CLEARANCE_FAILED',
                message: clearance.message || 'Unable to deduct chance.'
              }, '*');
            }
          }
        });
        }

        games.forEach(game => {
          const card = document.createElement('div');
          card.className = 'game-card';
          card.dataset.gameId = game.id;
          card.tabIndex = 0;
          card.setAttribute('role', 'button');
          card.setAttribute('aria-label', `Select ${game.title}`);
          card.setAttribute('aria-selected', 'false');

          card.innerHTML = `
            <div class="flex items-start gap-3">
              <div class="icon-bg">
                ${game.icon}
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="truncate mb-0.5">${game.title}</h3>
                <p class="game-description">${game.description}</p>
                <div class="game-chance-badge badge badge--emerald">
                  Plays loading...
                </div>
              </div>
            </div>
          `;

          const triggerSelect = () => selectGameForPreview(game);
          card.addEventListener('click', triggerSelect);
          card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              triggerSelect();
            }
          });

          gameListContainer.appendChild(card);
        });

        updateUI();
    };

    // Handle OAuth / SSO redirect callback if returning from Google / external provider
    if (window.location.search.includes('__clerk') || window.location.hash.includes('__clerk')) {
      try {
        await clerk.handleRedirectCallback();
      } catch (cbErr) {
        console.warn('OAuth redirect handled or already processed:', cbErr);
      }
    }

    // Authentication Logic
    let isSignInMounted = false;

    function renderSignIn() {
        if (!clerk.user) {
            if (!isSignInMounted || clerkMountPoint.children.length === 0) {
                try {
                  if (isSignInMounted) {
                    clerk.unmountSignIn(clerkMountPoint);
                  }
                } catch (e) {}
                clerkMountPoint.innerHTML = '';
                clerk.mountSignIn(clerkMountPoint, {
                    routing: 'hash',
                    afterSignInUrl: '/index.html',
                    afterSignUpUrl: '/index.html',
                    redirectUrl: '/index.html',
                    localization: {
                      formFieldInputPlaceholder__emailAddress: 'Enter your college mail id',
                    },
                    appearance: {
                      variables: {
                        colorPrimary: '#22D3EE',
                        colorText: 'rgba(255, 255, 255, 0.9)',
                        colorTextSecondary: 'rgba(255, 255, 255, 0.55)',
                        colorBackground: '#0C1220',
                        colorInputBackground: '#101828',
                        colorInputText: 'rgba(255, 255, 255, 0.9)',
                        borderRadius: '12px',
                        fontFamily: 'Outfit, Inter, sans-serif',
                      },
                      elements: {
                        rootBox: 'w-full',
                        card: 'clerk-card',
                        headerTitle: 'clerk-header-title',
                        headerSubtitle: 'clerk-header-subtitle',
                        socialButtonsBlockButton: 'clerk-social-button',
                        socialButtonsBlockButtonText: 'clerk-social-button-text',
                        dividerLine: 'clerk-divider-line',
                        dividerText: 'clerk-divider-text',
                        formFieldLabel: 'clerk-form-label',
                        formFieldInput: 'clerk-form-input',
                        formButtonPrimary: 'clerk-primary-button',
                        footerActionLink: 'clerk-footer-link',
                        identityPreviewEditButton: 'clerk-footer-link',
                        formFieldAction: 'clerk-footer-link',
                      },
                    },
                });
                isSignInMounted = true;
            }
        }
    }

    async function handleAuthState(user) {
      currentUser = user;

      if (!user) {
        stopHeartbeat();
        stopAutoRetry();
        switchView('sign-in');
        renderSignIn();
        return;
      }

      if (isSignInMounted) {
        try {
          clerk.unmountSignIn(clerkMountPoint);
        } catch (e) {}
        isSignInMounted = false;
      }

      const userEmail = user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress || '';

      // 1. Enforce College Email Policy
      if (!isCollegeEmail(userEmail)) {
        showCollegeDeniedPage(userEmail);
        return;
      }

      // 2. Enforce Device Limit (Max 2 Devices) & Single-Device Active Concurrency
      const claimResult = await claimDeviceSession(user.id, userEmail);
      if (!claimResult.allowed) {
        if (claimResult.error === 'DEVICE_LIMIT_EXCEEDED') {
          showDeviceLimitPage(userEmail, claimResult.allowedDevices || []);
          return;
        }
        if (claimResult.error === 'ACTIVE_SESSION_EXISTS') {
          showConcurrentDevicePage(userEmail, claimResult.secondsRemaining);
          return;
        }
        if (claimResult.error === 'COLLEGE_EMAIL_REQUIRED') {
          showCollegeDeniedPage(userEmail);
          return;
        }

        // If it's a temporary server/DB error, retry after 2 seconds
        console.warn('Temporary server/DB connection delay:', claimResult.message);
        setTimeout(async () => {
          if (currentUser) {
            await handleAuthState(currentUser);
          }
        }, 2000);
        return;
      }

      // 3. User is authorized, device slot confirmed, and active session claimed!
      stopAutoRetry();
      switchView('app');
      clerk.mountUserButton(userButtonMount, { afterSignOutUrl: '/index.html' });
      populateGameList();
      startHeartbeat(user.id);
      await syncUserWithDB(user);
    }

    clerk.addListener(async ({ user }) => {
      await handleAuthState(user);
    });

    if (clerk.user) {
      await handleAuthState(clerk.user);
    } else {
      switchView('sign-in');
      renderSignIn();
    }
}

// --- Start the application ---
startApp();
