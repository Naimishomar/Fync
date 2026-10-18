import { ANSWERS, EXTRA } from "./wordDuelWords.js";

/**
 * Word Duel rules (pure, no IO). A copy of scoreGuess/dailyAnswer lives in
 * client/components/games/word/wordRules.ts for solo play; keep them in sync.
 * Marks: 2 = right letter right spot (green), 1 = in the word elsewhere (yellow), 0 = not (grey).
 */

export const WORD_LEN = 5;
export const MAX_GUESSES = 6;
export const WINS_NEEDED = 2; // best of 3
export const MAX_ROUNDS = 3;

const split = (s) => s.match(/.{5}/g) || [];
export const ANSWER_LIST = split(ANSWERS);
const ALLOWED = new Set([...ANSWER_LIST, ...split(EXTRA)]);

export const isAllowed = (w) => typeof w === "string" && ALLOWED.has(w.toLowerCase());
export const randomAnswer = () => ANSWER_LIST[Math.floor(Math.random() * ANSWER_LIST.length)];

// Greens first, then yellows from what's left: a letter only lights up as many
// times as it appears in the answer (guess "speed" vs "abide" -> one yellow e, not two).
export const scoreGuess = (guess, answer) => {
    const g = guess.toLowerCase(), a = answer.toLowerCase();
    const marks = Array(WORD_LEN).fill(0);
    const left = {};
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

export const isSolved = (marks) => marks.every((m) => m === 2);

// Closeness of one row: greens matter more than any number of yellows.
const rowRank = (marks) => marks.reduce((s, m) => s + (m === 2 ? 10 : m), 0);
const bestRank = (guesses) => guesses.reduce((b, g) => Math.max(b, rowRank(g.marks)), -1);

/**
 * Who took the round. p = { guesses: [{ marks }], solvedAt: ms | null }.
 * Returns "a", "b" or null for a draw.
 * One solved -> they win. Both solved -> fewer guesses, then earlier.
 * Neither -> the closest single row (greens, then yellows) wins; equal is a draw.
 */
export const roundWinner = (a, b) => {
    if (a.solvedAt != null && b.solvedAt == null) return "a";
    if (b.solvedAt != null && a.solvedAt == null) return "b";
    if (a.solvedAt != null && b.solvedAt != null) {
        if (a.guesses.length !== b.guesses.length) return a.guesses.length < b.guesses.length ? "a" : "b";
        if (a.solvedAt !== b.solvedAt) return a.solvedAt < b.solvedAt ? "a" : "b";
        return null;
    }
    const ra = bestRank(a.guesses), rb = bestRank(b.guesses);
    return ra === rb ? null : ra > rb ? "a" : "b";
};

/** Match state after a round: { over, winner } where winner is "a" | "b" | null (draw). */
export const matchStatus = (winsA, winsB, roundsPlayed) => {
    if (winsA >= WINS_NEEDED) return { over: true, winner: "a" };
    if (winsB >= WINS_NEEDED) return { over: true, winner: "b" };
    if (roundsPlayed >= MAX_ROUNDS) return { over: true, winner: winsA === winsB ? null : winsA > winsB ? "a" : "b" };
    return { over: false, winner: null };
};

// Same word for everyone on an IST calendar day. 7919 is prime and coprime with
// the list length, so consecutive days walk the whole list before repeating.
export const istDay = (ms = Date.now()) => Math.floor((ms + 5.5 * 3600 * 1000) / 86400000);
export const dailyAnswer = (ms = Date.now()) => ANSWER_LIST[(istDay(ms) * 7919) % ANSWER_LIST.length];
