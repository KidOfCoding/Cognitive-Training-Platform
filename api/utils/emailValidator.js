import fs from 'fs';
import dotenv from 'dotenv';

function getLiveEnv(key) {
  try {
    if (fs.existsSync('.env')) {
      const parsed = dotenv.parse(fs.readFileSync('.env', 'utf-8'));
      if (parsed[key] !== undefined) return parsed[key];
    }
  } catch (e) { }
  return process.env[key];
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

export function getAllowedDomainsList() {
  const envDomainsStr = (
    getLiveEnv('ALLOWED_EMAIL_DOMAINS') ||
    getLiveEnv('VITE_ALLOWED_EMAIL_DOMAINS') ||
    DEFAULT_ALLOWED_DOMAINS.join(',')
  ).trim();

  const entries = envDomainsStr
    .split(',')
    .map(d => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);

  return entries.length > 0 ? entries : DEFAULT_ALLOWED_DOMAINS;
}

export function isAllowAllCollegesActive() {
  const allowAllVal = (
    getLiveEnv('ALLOW_ALL_COLLEGES') ||
    getLiveEnv('VITE_ALLOW_ALL_COLLEGES') ||
    getLiveEnv('ALLOW_ALL_UNIVERSITIES') ||
    getLiveEnv('VITE_ALLOW_ALL_UNIVERSITIES') ||
    ''
  ).trim().toLowerCase();

  return allowAllVal === '1' || allowAllVal === 'true' || allowAllVal === 'yes';
}

export function isCollegeEmail(email) {
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

  // 2. If toggle ALLOW_ALL_COLLEGES=1 is enabled, allow all accredited university domains (.edu, .ac.in, etc.)
  if (isAllowAllCollegesActive()) {
    // Reject common consumer email providers
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

    // Educational domains (.edu, .edu.in, .edu.au, etc.)
    if (domain === 'edu' || /\.edu(\.[a-z]{2,3})?$/i.test(domain)) {
      return true;
    }

    // Academic ccTLDs (.ac.in, .ac.uk, .ac.nz, .ac.za, .ac.jp, etc.)
    if (domain === 'ac' || /\.ac(\.[a-z]{2,3})?$/i.test(domain)) {
      return true;
    }
  }

  return false;
}

export const PERSONAL_EMAIL_PROVIDERS = [
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

export function isEducationEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const cleanEmail = email.trim().toLowerCase();
  const atIdx = cleanEmail.lastIndexOf('@');
  if (atIdx === -1) return false;

  const domain = cleanEmail.slice(atIdx + 1);
  if (!domain || domain.includes(' ') || !domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) return false;

  if (PERSONAL_EMAIL_PROVIDERS.includes(domain)) {
    return false;
  }

  const customAllowed = getAllowedDomainsList();
  if (customAllowed.some(entry => entry === domain || domain.endsWith('.' + entry) || cleanEmail === entry)) {
    return true;
  }

  if (domain === 'edu' || /\.edu(\.[a-z]{2,3})?$/i.test(domain) || domain.includes('.edu.')) {
    return true;
  }

  if (domain === 'ac' || /\.ac(\.[a-z]{2,3})?$/i.test(domain) || domain.includes('.ac.')) {
    return true;
  }

  return false;
}

