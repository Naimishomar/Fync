import { ANSWERS, EXTRA } from './words';

/**
 * Client copy of backend/utils/wordRules.js for solo play (Daily, Endless).
 * Duels are scored on the server; keep scoreGuess/dailyAnswer in sync with it.
 * Marks: 2 green, 1 yellow, 0 grey.
 */
export type Mark = 0 | 1 | 2;
export const WORD_LEN = 5;
export const MAX_GUESSES = 6;

const split = (s: string) => s.match(/.{5}/g) || [];
export const ANSWER_LIST = split(ANSWERS);
let allowed: Set<string> | null = null; // built on first use, not at app start
export const isAllowed = (w: string) => (allowed ??= new Set([...ANSWER_LIST, ...split(EXTRA)])).has(w.toLowerCase());
export const randomAnswer = () => ANSWER_LIST[Math.floor(Math.random() * ANSWER_LIST.length)];

export const scoreGuess = (guess: string, answer: string): Mark[] => {
  const g = guess.toLowerCase(), a = answer.toLowerCase();
  const marks: Mark[] = Array(WORD_LEN).fill(0);
  const left: Record<string, number> = {};
  for (let i = 0; i < WORD_LEN; i++) {
    if (g[i] === a[i]) marks[i] = 2;
    else left[a[i]] = (left[a[i]] || 0) + 1;
  }
  for (let i = 0; i < WORD_LEN; i++) {
    if (marks[i] !== 2 && left[g[i]] > 0) {
      marks[i] = 1;
      left[g[i]]--;
    }
  }
  return marks;
};
export const isSolved = (m: Mark[]) => m.every((x) => x === 2);

export const istDay = (ms = Date.now()) => Math.floor((ms + 5.5 * 3600 * 1000) / 86400000);
export const dailyAnswer = (ms = Date.now()) => ANSWER_LIST[(istDay(ms) * 7919) % ANSWER_LIST.length];
