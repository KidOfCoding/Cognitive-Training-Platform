/**
 * Email validation utility to enforce institutional/college email requirement.
 */

const DEFAULT_ALLOWED_DOMAINS = [];

export function isCollegeEmail(email) {
  if (!email || typeof email !== 'string') return false;
  
  const cleanEmail = email.trim().toLowerCase();
  const atIdx = cleanEmail.lastIndexOf('@');
  if (atIdx === -1) return false;

  const domain = cleanEmail.slice(atIdx + 1);
  if (!domain || domain.includes(' ') || !domain.includes('.') || domain.includes('..') || domain.startsWith('.') || domain.endsWith('.')) return false;

  // 1. Check custom domains specified via environment variable (comma-separated)
  const envDomainsStr = process.env.ALLOWED_EMAIL_DOMAINS || process.env.VITE_ALLOWED_EMAIL_DOMAINS || '';
  const customDomains = envDomainsStr
    .split(',')
    .map(d => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);

  if (customDomains.some(custom => domain === custom || domain.endsWith('.' + custom))) {
    return true;
  }

  // 2. Reject common consumer email providers (gmail, yahoo, hotmail, etc.) unless explicitly in custom domains
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
