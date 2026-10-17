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

// Calculate available chances for a specific game
function calculateGameChances(state = userState, gameId) {
  if (!state || !gameId) return 0;
  const free = Number(state.freeChances?.[gameId]) || 0;
  let paid = 0;
  if (typeof state.paidChances === 'object' && state.paidChances !== null) {
    paid = Number(state.paidChances[gameId]) || 0;
  } else {
    paid = Number(state.paidChances) || 0;
  }
  return Math.max(0, free) + Math.max(0, paid);
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

const DEFAULT_ALLOWED_DOMAINS = [
  'cgu-odisha.ac.in',
  'iitbbs.ac.in',
  'iiit-bh.ac.in',
  'outr.ac.in',
  'bput.ac.in',
  'kiit.ac.in',
  'soa.ac.in',
  'cutm.ac.in',
  'silicon.ac.in',
  'gita.edu.in',
  'gift.edu.in',
  'gec.edu.in',
  'trident.ac.in',
  'bit.edu.in',
  'becbbsr.ac.in',
  'aryan.ac.in',
  'koustuvgroup.ac.in',
  'hit.ac.in',
  'indus.ac.in',
  'kmbb.in'
];

function getAllowedDomainsList() {
  const envDomainsStr = String(
    import.meta.env.VITE_ALLOWED_EMAIL_DOMAINS || DEFAULT_ALLOWED_DOMAINS.join(',')
  ).trim();

  const entries = envDomainsStr
    .split(',')
    .map(d => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);

  return entries.length > 0 ? entries : DEFAULT_ALLOWED_DOMAINS;
}

function isAllowAllCollegesActive() {
  const allowAllVal = String(
    import.meta.env.VITE_ALLOW_ALL_COLLEGES ??
    import.meta.env.VITE_ALLOW_ALL_UNIVERSITIES ??
    ''
  ).trim().toLowerCase();

  return allowAllVal === '1' || allowAllVal === 'true' || allowAllVal === 'yes';
}

// Helper: Verify whether an email address is from an official college/university domain
function isCollegeEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const cleanEmail = email.trim().toLowerCase();
  const atIdx = cleanEmail.lastIndexOf('@');
  if (atIdx === -1) return false;

  const domain = cleanEmail.slice(atIdx + 1);
  if (!domain || domain.includes(' ') || !domain.includes('.') || domain.includes('..') || domain.startsWith('.') || domain.endsWith('.')) return false;

  // 1. Check custom domains/emails specified via environment variable
  const customAllowedEntries = getAllowedDomainsList();

  const matchesCustom = customAllowedEntries.some(entry => {
    if (entry.includes('@')) {
      return cleanEmail === entry;
    }
    return domain === entry || domain.endsWith('.' + entry);
  });

  if (matchesCustom) {
    return true;
  }

  // 2. If toggle ALLOW_ALL_COLLEGES=1 is set, allow any accredited university (.edu, .ac.in, etc.)
  if (isAllowAllCollegesActive()) {
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

    if (domain === 'edu' || /\.edu(\.[a-z]{2,3})?$/i.test(domain)) {
      return true;
    }
    if (domain === 'ac' || /\.ac(\.[a-z]{2,3})?$/i.test(domain)) {
      return true;
    }
  }

  return false;
}

const PERSONAL_EMAIL_PROVIDERS = [
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.in',
  'yahoo.in',
  'ymail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'mail.com',
  'gmx.com',
  'yandex.com',
  'rediffmail.com'
];

function isEducationEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const cleanEmail = email.trim().toLowerCase();
  const atIdx = cleanEmail.lastIndexOf('@');
  if (atIdx === -1) return false;

  const domain = cleanEmail.slice(atIdx + 1);
  if (!domain || domain.includes(' ') || !domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) return false;

  // 1. If in personal provider list, it's definitely not an education email
  if (PERSONAL_EMAIL_PROVIDERS.includes(domain)) {
    return false;
  }

  // 2. If in allowed list, it's an education email
  const customAllowed = getAllowedDomainsList();
  if (customAllowed.some(entry => entry === domain || domain.endsWith('.' + entry) || cleanEmail === entry)) {
    return true;
  }

  // 3. Academic TLD patterns (.edu, .edu.in, .ac.in, .ac.uk, etc.)
  if (domain === 'edu' || /\.edu(\.[a-z]{2,3})?$/i.test(domain) || domain.includes('.edu.')) {
    return true;
  }

  if (domain === 'ac' || /\.ac(\.[a-z]{2,3})?$/i.test(domain) || domain.includes('.ac.')) {
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
  // view: 'sign-in' | 'college-denied' | 'app'
  const screens = [
    { el: signInPage, name: 'sign-in' },
    { el: collegeEmailRequiredPage, name: 'college-denied' },
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


async function handleReturnToSignIn() {
  try {
    if (currentUser) releaseDeviceSession(currentUser.id);
  } catch (e) {}
  try {
    if (clerkInstance) {
      await clerkInstance.signOut();
    }
  } catch (err) {
    console.warn('Sign out cleanup error:', err);
  }
  currentUser = null;
  switchView('sign-in');
  if (typeof renderSignIn === 'function') {
    renderSignIn();
  }
  if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/index') {
    window.location.href = window.location.origin + '/index.html';
  }
}

function showCollegeDeniedPage(email) {
  if (deniedEmailDisplay) {
    deniedEmailDisplay.textContent = email || 'No Email';
  }
  const reqEmailInput = document.getElementById('req-college-email');
  if (reqEmailInput && email) {
    reqEmailInput.value = email;
  }

  const deniedTitle = document.getElementById('college-denied-title');
  const allowedDesc = document.getElementById('college-denied-description');
  if (deniedTitle) deniedTitle.textContent = 'Campus Service Notice';
  if (allowedDesc) allowedDesc.textContent = 'Assessments are currently restricted to partner campuses. If not enrolled, request access below:';

  // Ensure request form is visible and feedback is reset
  const requestForm = document.getElementById('college-request-form');
  const feedbackBox = document.getElementById('college-request-feedback');
  if (requestForm) requestForm.classList.remove('hidden');
  if (feedbackBox) {
    feedbackBox.classList.add('hidden');
    feedbackBox.innerHTML = '';
  }

  // Setup navigation back buttons
  const topBackBtn = document.getElementById('college-gate-top-back-btn');
  if (topBackBtn && !topBackBtn.dataset.listenerAttached) {
    topBackBtn.dataset.listenerAttached = 'true';
    topBackBtn.addEventListener('click', handleReturnToSignIn);
  }

  const bottomBackBtn = document.getElementById('email-denied-back-to-signin');
  if (bottomBackBtn && !bottomBackBtn.dataset.listenerAttached) {
    bottomBackBtn.dataset.listenerAttached = 'true';
    bottomBackBtn.addEventListener('click', handleReturnToSignIn);
  }

  const deniedSignOutBtn = document.getElementById('email-denied-sign-out');
  if (deniedSignOutBtn && !deniedSignOutBtn.dataset.listenerAttached) {
    deniedSignOutBtn.dataset.listenerAttached = 'true';
    deniedSignOutBtn.addEventListener('click', handleReturnToSignIn);
  }

  // Setup form submit listener once
  if (requestForm && !requestForm.dataset.listenerAttached) {
    requestForm.dataset.listenerAttached = 'true';
    requestForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const collegeName = document.getElementById('req-college-name')?.value?.trim();
      const userEmail = document.getElementById('req-college-email')?.value?.trim();
      const submitBtn = document.getElementById('req-college-submit-btn');

      if (!collegeName || !userEmail) return;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting Request...';
      }

      try {
        const res = await fetch('/api/request-college', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collegeName, email: userEmail }),
        });
        const data = await res.json();

        if (feedbackBox) {
          requestForm.classList.add('hidden');
          feedbackBox.classList.remove('hidden');
          feedbackBox.className = 'mt-2 p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-xs text-emerald-300';
          feedbackBox.innerHTML = `
            <div class="flex items-start gap-2 text-left">
              <span class="text-lg flex-shrink-0">🎉</span>
              <div class="flex-1">
                <p class="font-bold text-emerald-300 text-xs">Request Successfully Received!</p>
                <p class="mt-0.5 text-slate-300 text-[11px] leading-snug">
                  Submitted <strong>${collegeName}</strong>. If verified, access will be activated within <strong>12 hours</strong>.
                </p>
                <button type="button" id="feedback-back-to-signin-btn" class="mt-2 w-full py-1.5 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5">
                  <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span>Back to Sign In</span>
                </button>
              </div>
            </div>
          `;
          document.getElementById('feedback-back-to-signin-btn')?.addEventListener('click', handleReturnToSignIn);
        }
        requestForm.reset();
      } catch (err) {
        if (feedbackBox) {
          feedbackBox.classList.remove('hidden');
          feedbackBox.className = 'mt-2 p-2 rounded-lg bg-rose-950/80 border border-rose-500/40 text-xs text-rose-300';
          feedbackBox.textContent = 'Unable to send request right now. Please check your connection and try again.';
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Request Activation (Within 12h)';
        }
      }
    });
  }

  switchView('college-denied');
}

// --- Simplified Session Helpers (No-ops for removed restrictions) ---
function stopHeartbeat() {}
function startHeartbeat() {}
function releaseDeviceSession() {}
async function claimDeviceSession() { return { allowed: true }; }
function showConcurrentDevicePage() {}
function showDeviceLimitPage() {}
function stopAutoRetry() {}
function startAutoRetry() {}
async function triggerSessionTakeover() {}
async function triggerSessionRetry() {}
async function triggerDeviceReset() {}

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

    if (res.status === 403) {
      showCollegeDeniedPage(user.primaryEmailAddress?.emailAddress || '');
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
      previewGameChancesBadge.textContent = `${totalLeft} Chance${totalLeft > 1 ? 's' : ''} Available`;
    } else {
      previewGameChancesBadge.className = 'badge badge--rose';
      previewGameChancesBadge.textContent = '0 Chances — Recharge Needed';
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
    buyChancesPackLabel.textContent = `+${packSize} Chances`;
  }
  if (buyChancesPriceTag) {
    buyChancesPriceTag.textContent = `₹${packPrice}`;
  }
  if (modalPackName) {
    modalPackName.textContent = `${packSize} Chances Power Pack`;
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
      +${packSize} Chances for all ${gameCount} assessments
    `;
  }
  if (welcomePriceValue) {
    welcomePriceValue.textContent = `₹${packPrice}`;
  }
  if (welcomePriceUnit) {
    welcomePriceUnit.textContent = `/ ${packSize} Chances`;
  }
  if (welcomeBuyPackLabel) {
    welcomeBuyPackLabel.textContent = `Get ${packSize} Chances Pack`;
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
          badge.textContent = `${totalLeft} Chance${totalLeft > 1 ? 's' : ''} Left`;
        } else {
          badge.className = 'game-chance-badge badge badge--cyan';
          badge.textContent = `${totalLeft} Chance${totalLeft > 1 ? 's' : ''} Left`;
        }
      } else {
        badge.className = 'game-chance-badge badge';
        badge.style.background = 'rgba(255,255,255,0.04)';
        badge.style.color = 'rgba(255,255,255,0.28)';
        badge.style.borderColor = 'rgba(255,255,255,0.06)';
        badge.textContent = '0 Chances Left';
      }
    }
  });

  if (activePreviewGame) {
    refreshPreviewScreen(activePreviewGame);
  }
}

function openPaymentModal(noticeMessage = '') {
  if (modalNoticeText) {
    modalNoticeText.textContent = noticeMessage || `You have exhausted your available chances. Recharge with ${readPositiveConfigNumber(userState.config?.paidChancesPack, 0)} extra chances to continue training!`;
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
      emailDeniedSignOutBtn.addEventListener('click', handleReturnToSignIn);
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

    // Consent Screen: Start Game Button (only verifies available balance; deduction happens inside the game on first move/action)
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
          // Launch game directly without pre-deduction.
          // 1 play will be deducted when the user makes their first active move/rotation inside the game!
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
              const gamePlays = calculateGameChances(userState, activePreviewGame.id);
              gameFrame.contentWindow?.postMessage({
                type: 'GAME_SESSION_INFO',
                gameId: activePreviewGame.id,
                gameChances: gamePlays,
                remainingChances: gamePlays,
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
                const targetGameId = event.data.gameId || activePreviewGame?.id;
                const gamePlays = targetGameId ? calculateGameChances(userState, targetGameId) : calculateTotalChances(userState);
                event.source?.postMessage({
                  type: 'GAME_SESSION_INFO',
                  gameId: targetGameId,
                  gameChances: gamePlays,
                  remainingChances: gamePlays,
                  totalChances: calculateTotalChances(userState)
                }, '*');
              } catch (e) {}
              return;
            }

          if (event.data.type === 'REQUEST_NEW_GAME' || event.data.type === 'REQUEST_PLAY_ACTION') {
            const reqType = event.data.type;
            const targetGameId = event.data.gameId || activePreviewGame?.id;
            if (!targetGameId || !currentUser) {
              event.source?.postMessage({
                type: reqType === 'REQUEST_PLAY_ACTION' ? 'PLAY_ACTION_AUTHORIZED' : 'NEW_GAME_AUTHORIZED',
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
              openPaymentModal(`You have exhausted your available chances for "${targetGame?.title || 'this game'}". Recharge to start a new game!`);
              event.source?.postMessage({
                type: reqType === 'REQUEST_PLAY_ACTION' ? 'PLAY_ACTION_DENIED' : 'NEW_GAME_DENIED',
                reason: 'NO_CHANCES',
                message: 'No chances available. Please recharge!'
              }, '*');
              return;
            }

            // Deduct chance via backend
            const clearance = await requestPlayGame(targetGameId);
            if (clearance.allowed) {
              const gamePlays = calculateGameChances(userState, targetGameId);
              event.source?.postMessage({
                type: reqType === 'REQUEST_PLAY_ACTION' ? 'PLAY_ACTION_AUTHORIZED' : 'NEW_GAME_AUTHORIZED',
                allowed: true,
                gameId: targetGameId,
                gameChances: gamePlays,
                remainingChances: gamePlays,
                totalChances: calculateTotalChances(userState)
              }, '*');
            } else {
              if (clearance.message) {
                openPaymentModal(clearance.message);
              }
              event.source?.postMessage({
                type: reqType === 'REQUEST_PLAY_ACTION' ? 'PLAY_ACTION_DENIED' : 'NEW_GAME_DENIED',
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
    let lastDisallowedMessage = null;

    function showPreAuthError(title, msg) {
        lastDisallowedMessage = { title, msg };
        const errorBox = document.getElementById('clerk-preauth-error');
        const errorTitle = document.getElementById('clerk-preauth-error-title');
        const errorText = document.getElementById('clerk-preauth-error-text');
        if (errorBox) {
            if (errorTitle) errorTitle.textContent = title || 'Personal Email Not Allowed';
            if (errorText) errorText.textContent = msg;
            errorBox.classList.remove('hidden');
            errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    function clearPreAuthError() {
        lastDisallowedMessage = null;
        const errorBox = document.getElementById('clerk-preauth-error');
        if (errorBox) {
            errorBox.classList.add('hidden');
        }
    }

    function initClerkPreAuthInterceptor() {
        if (!clerkMountPoint || clerkMountPoint.dataset.interceptorAttached) return;
        clerkMountPoint.dataset.interceptorAttached = 'true';

        function getEnteredEmail() {
            if (!clerkMountPoint) return '';
            const inputs = clerkMountPoint.querySelectorAll('input');
            for (const input of inputs) {
                const type = (input.type || '').toLowerCase();
                const name = (input.name || '').toLowerCase();
                if (type === 'password' || type === 'checkbox' || type === 'radio' || type === 'hidden') continue;
                const val = (input.value || '').trim();
                if (val && (val.includes('@') || type === 'email' || name.includes('identifier') || name.includes('email'))) {
                    return val;
                }
            }
            return '';
        }

        function handleCheck(e) {
            if (e.type === 'keydown' && e.key !== 'Enter') return;
            if (e.type === 'click') {
                const btn = e.target.closest('button');
                if (!btn) return;
                const btnType = (btn.type || '').toLowerCase();
                const btnClass = (btn.className || '').toLowerCase();
                const btnText = (btn.textContent || '').toLowerCase();
                const isSubmit = btnType === 'submit' || btnClass.includes('primary') || btnText.includes('continue') || btnText.includes('sign in') || btnText.includes('sign up');
                if (!isSubmit) return;
            }

            const email = getEnteredEmail();
            if (!email || !email.includes('@')) return;

            // 1. If not an educational email (personal consumer email like Gmail, Yahoo, Outlook, etc.)
            if (!isEducationEmail(email)) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                showPreAuthError(
                    'Personal Email Not Allowed',
                    'Personal email addresses (e.g. Gmail, Yahoo, Outlook) are not permitted. Please use your official college or university email ID.'
                );
                return;
            }

            // 2. If it is an educational email, but not in our allowed campus list
            if (!isCollegeEmail(email)) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                clearPreAuthError();
                showCollegeDeniedPage(email);
                return;
            }

            // 3. Approved college email
            clearPreAuthError();
        }

        clerkMountPoint.addEventListener('keydown', handleCheck, true);
        clerkMountPoint.addEventListener('submit', handleCheck, true);
        clerkMountPoint.addEventListener('click', handleCheck, true);
        clerkMountPoint.addEventListener('input', () => {
            clearPreAuthError();
        }, true);
    }

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
                initClerkPreAuthInterceptor();
            }
            if (lastDisallowedMessage) {
                showPreAuthError(lastDisallowedMessage.title, lastDisallowedMessage.msg);
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

      // 1. Enforce Educational Email Only Policy (Reject Personal Emails e.g. Gmail, Yahoo, Outlook)
      if (!isEducationEmail(userEmail)) {
        console.warn(`[Auth Policy] Disallowed personal email: ${userEmail}`);
        try {
          await clerk.signOut();
        } catch (e) {
          console.error('Error signing out disallowed email:', e);
        }
        currentUser = null;
        switchView('sign-in');
        renderSignIn();
        showPreAuthError(
          'Personal Email Not Allowed',
          `The Google account (${userEmail || 'Personal'}) is a personal email. Personal email IDs (e.g. @gmail.com) are strictly not permitted. Please sign in with your official college or university email address.`
        );
        return;
      }

      // 2. Educational Email, but Campus Not Yet Enrolled / Allowed
      if (!isCollegeEmail(userEmail)) {
        showCollegeDeniedPage(userEmail);
        return;
      }

      // 3. Direct Authorized Access
      currentUser = user;
      switchView('app');
      
      clerk.mountUserButton(userButtonMount, {
        afterSignOutUrl: '/index.html',
        appearance: {
          variables: {
            colorPrimary: '#06b6d4',
            colorBackground: '#0b1329',
            colorText: '#f8fafc',
            colorTextSecondary: '#94a3b8',
            colorInputBackground: '#0f172a',
            colorInputText: '#f8fafc',
            borderRadius: '0.875rem',
          },
          elements: {
            userButtonPopoverCard: {
              backgroundColor: '#0a101f',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
              color: '#f8fafc',
            },
            userButtonPopoverActionButton: {
              color: '#cbd5e1',
            },
            userPreviewMainIdentifier: {
              color: '#f8fafc',
              fontWeight: '600',
            },
            userPreviewSecondaryIdentifier: {
              color: '#94a3b8',
            }
          }
        }
      });

      // Inject custom Refund Policy & Grievance action inside Clerk User Profile Popover
      setupClerkPopoverInjector();

      populateGameList();
      await syncUserWithDB(user);
    }

    // Function to inject custom section into Clerk's profile popup
    function setupClerkPopoverInjector() {
      if (window.__clerkPopoverObserverAttached) return;
      window.__clerkPopoverObserverAttached = true;

      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) {
              const popoverActions = node.querySelector ? (node.querySelector('.cl-userButtonPopoverActions') || node.querySelector('[role="menu"]') || node.closest?.('.cl-userButtonPopoverCard')?.querySelector('.cl-userButtonPopoverActions')) : null;
              if (popoverActions && !popoverActions.querySelector('#clerk-custom-grievance-item')) {
                const item = document.createElement('button');
                item.id = 'clerk-custom-grievance-item';
                item.type = 'button';
                item.className = 'cl-userButtonPopoverActionButton';
                item.setAttribute('role', 'menuitem');
                item.style.cssText = 'display: flex; align-items: center; gap: 12px; width: 100%; padding: 8px 12px; background: transparent; border: none; border-radius: 8px; color: #cbd5e1; font-weight: 500; font-size: 13px; cursor: pointer; text-align: left; transition: all 0.15s ease;';
                item.innerHTML = `
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <span>Refund Policy &amp; Grievances</span>
                `;
                item.addEventListener('mouseenter', () => {
                  item.style.backgroundColor = 'rgba(56, 189, 248, 0.1)';
                  item.style.color = '#38bdf8';
                });
                item.addEventListener('mouseleave', () => {
                  item.style.backgroundColor = 'transparent';
                  item.style.color = '#cbd5e1';
                });
                item.addEventListener('click', (ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  const email = currentUser?.primaryEmailAddress?.emailAddress || '';
                  if (typeof window.openGrievanceModal === 'function') {
                    window.openGrievanceModal('refund_irrelevant', email);
                  }
                  // Close the clerk popover if open
                  const popoverCard = document.querySelector('.cl-userButtonPopoverCard');
                  if (popoverCard) {
                    popoverCard.style.display = 'none';
                  }
                });
                popoverActions.insertBefore(item, popoverActions.firstChild);
              }
            }
          }
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      // Also wire up sidebar grievance button
      const sidebarGrievanceBtn = document.getElementById('sidebar-grievance-btn');
      if (sidebarGrievanceBtn) {
        sidebarGrievanceBtn.addEventListener('click', () => {
          const email = currentUser?.primaryEmailAddress?.emailAddress || '';
          if (typeof window.openGrievanceModal === 'function') {
            window.openGrievanceModal('refund_irrelevant', email);
          }
        });
      }
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

