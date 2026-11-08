/** Rules for "Ask me anything" (anonymous questions). Pure, tested in askRules.test.mjs. */
import crypto from 'node:crypto';

export const MAX_LEN = 300;
export const TTL_DAYS = 7;
export const DAY = 86400000;
export const USERNAME = /^[A-Za-z0-9._-]{1,40}$/;
export const LIMITS = { ipTo: 5, ip: 30, to: 200 }; // per hour, per hour, per day

// C0/C1 controls except \n, plus zero-width / bidi tricks; at most 2 blank lines in a row.
const CONTROL = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F​-‏‪-‮⁠-⁤﻿]/g;
export const cleanText = (s) => String(s ?? '').replace(/\r\n?/g, '\n').replace(CONTROL, '')
  .replace(/\n{3,}/g, '\n\n').trim();

// Abuse words matched as word prefixes (catches -ing/-er/-iya forms), short ones as whole words only.
const STEMS = ['fuck', 'motherfuck', 'bitch', 'slut', 'whore', 'cunt', 'bastard', 'retard', 'nigg', 'faggot',
  'madarchod', 'maderchod', 'behenchod', 'behanchod', 'bhenchod', 'bhanchod', 'chutiy', 'chutiya',
  'bhosd', 'bhosad', 'randi', 'gandu', 'gaandu', 'lauda', 'lawda', 'loda', 'chinal', 'harami', 'kutiya', 'hijda', 'hijra'];
const WORDS = new Set(['dick', 'dicks', 'pussy', 'cock', 'kys', 'rape', 'raped', 'rapist', 'lund', 'lun', 'gaand',
  'chodu', 'mc', 'bsdk', 'bkl']);
const THREATS = ['kill you', 'kill u', 'kill yourself', 'kill urself', 'go die', 'die bitch', 'rape you', 'rape u',
  'i will find you', 'i know where you live', 'leak your', 'leak ur', 'your nudes', 'ur nudes', 'send nudes', 'acid attack',
  'throw acid', 'maar dunga', 'maar dalunga', 'maar daalunga', 'jaan se maar', 'jaan se maarunga', 'uthwa lunga',
  'utha lunga', 'tujhe dekh lunga', 'dekh lunga tujhe', 'ghar aa ke', 'mar ja', 'mar jaa', 'suicide kar'];

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i' };
const normalize = (s) => String(s).toLowerCase().replace(/[013457@$!]/g, (c) => LEET[c])
  .replace(/(.)\1{2,}/g, '$1$1') // fuuuuck -> fuuck; keeps real double letters
  .replace(/[^a-zऀ-ॿ]+/g, ' ').trim();

/** True when the text has an abusive word or a threat phrase. */
export const isAbusive = (text) => {
  const n = normalize(text);
  const squeezed = n.replace(/(.)\1+/g, '$1'); // fuuck -> fuck, for the stem check
  const words = [...n.split(' '), ...squeezed.split(' ')];
  if (words.some((w) => WORDS.has(w) || STEMS.some((s) => w.startsWith(s)))) return true;
  const padded = ` ${n} `;
  return THREATS.some((t) => padded.includes(` ${t} `));
};

/** Why an anonymous message is refused, or null. Returns { text } cleaned on success. */
export const checkMessage = ({ text, honeypot }) => {
  if (honeypot) return { error: 'Could not send' }; // bots fill every field
  const t = cleanText(text);
  if (!t) return { error: 'Write something first' };
  if (t.length > MAX_LEN) return { error: `Keep it under ${MAX_LEN} characters` };
  if (isAbusive(t)) return { error: "Keep it kind - that message can't be sent." };
  return { text: t };
};

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const dayKey = (t) => new Date(t).toISOString().slice(0, 10);

/** Never store the raw IP: a hash salted with the server secret and the UTC day. */
export const senderHash = (ip, secret, now = Date.now()) => sha(`${ip}|${secret}|${dayKey(now)}`).slice(0, 32);

// A blocked hash comes from a message up to 7 days old and the block lasts 7 days, so a
// sender is checked against the last 14 daily salts. ponytail: 14 sha256s per post, cheap.
export const recentHashes = (ip, secret, now = Date.now()) =>
  Array.from({ length: TTL_DAYS * 2 }, (_, i) => senderHash(ip, secret, now - i * DAY));

export const isBlockedSender = (blocked, hashes, now = Date.now()) => {
  const live = new Set((blocked || []).filter((b) => new Date(b.exp).getTime() > now).map((b) => b.h));
  return hashes.some((h) => live.has(h));
};

/** Signature for a card URL so answered cards can't be enumerated by _id. */
export const cardSig = (id, secret) => crypto.createHmac('sha256', String(secret)).update(`ask-card:${id}`).digest('base64url').slice(0, 22);
export const sigOk = (id, k, secret) => {
  const a = Buffer.from(String(k || '')), b = Buffer.from(cardSig(id, secret));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export const expiresAt = (createdAt = new Date()) => new Date(new Date(createdAt).getTime() + TTL_DAYS * DAY);
