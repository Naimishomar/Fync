/**
 * Copy of backend/utils/ludoRules.js (tested there) for the offline vs-computer
 * mode. Online games are decided by the server; keep the two in step.
 *
 * Colours: 0 red, 1 green, 2 yellow, 3 blue (clockwise). A token's position is
 * relative to its own colour: -1 base, 0..50 main track (0 = own start square),
 * 51..55 home column, 56 home. Absolute track square = (START[color] + rel) % 52.
 */

export const TRACK = 52;
export const HOME_COL = 51;
export const HOME = 56;
export const START = [0, 13, 26, 39];
// Start squares + star squares: nobody can be captured here.
export const SAFE = new Set<number>([0, 8, 13, 21, 26, 34, 39, 47]);
export const SEATS: Record<number, number[]> = { 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] };

export const absOf = (color: number, rel: number): number | null => (rel < 0 || rel >= HOME_COL ? null : (START[color] + rel) % TRACK);

export type Phase = 'roll' | 'move' | 'over';
export type LudoState = {
    players: { color: number; tokens: number[] }[];
    turn: number;
    phase: Phase;
    dice: number | null;
    sixes: number;
    movable: number[];
    winner: number | null;
};
export type Capture = { seat: number; token: number };

export const newGame = (n: number): LudoState => ({
    players: SEATS[n].map((color) => ({ color, tokens: [-1, -1, -1, -1] })),
    turn: 0,
    phase: 'roll',
    dice: null,
    sixes: 0,
    movable: [],
    winner: null,
});

const canMove = (rel: number, dice: number) => (rel === -1 ? dice === 6 : rel + dice <= HOME && rel !== HOME);

const clone = (g: LudoState): LudoState => JSON.parse(JSON.stringify(g));

const passTurn = (g: LudoState) => {
    g.turn = (g.turn + 1) % g.players.length;
    g.phase = 'roll';
    g.dice = null;
    g.sixes = 0;
    g.movable = [];
};

const landing = (from: number, dice: number) => (from === -1 ? 0 : from + dice);

/** Opponent tokens sitting on absolute square `sq` (none on safe squares). */
const victims = (g: LudoState, seat: number, sq: number | null) => {
    const out: Capture[] = [];
    if (sq == null || SAFE.has(sq)) return out;
    g.players.forEach((o, s) => {
        if (s === seat) return;
        o.tokens.forEach((r, t) => { if (absOf(o.color, r) === sq) out.push({ seat: s, token: t }); });
    });
    return out;
};

/**
 * Apply a die roll for the current player. With no legal move, or on the third
 * six in a row, the turn passes straight away (`passed: true`).
 */
export const roll = (game: LudoState, dice: number) => {
    if (game.phase !== 'roll') throw new Error('not rolling');
    const g = clone(game);
    g.dice = dice;
    g.sixes = dice === 6 ? g.sixes + 1 : 0;
    if (g.sixes === 3) {
        passTurn(g);
        return { game: g, dice, forfeit: true, passed: true, movable: [] };
    }
    const movable = g.players[g.turn].tokens.map((r, i) => (canMove(r, dice) ? i : -1)).filter((i) => i >= 0);
    if (!movable.length) {
        passTurn(g);
        return { game: g, dice, forfeit: false, passed: true, movable };
    }
    g.phase = 'move';
    g.movable = movable;
    return { game: g, dice, forfeit: false, passed: false, movable };
};

/** Move token `t` of the current player by the rolled dice. */
export const move = (game: LudoState, t: number) => {
    if (game.phase !== 'move' || !game.movable.includes(t)) throw new Error('illegal move');
    const g = clone(game);
    const seat = g.turn;
    const p = g.players[seat];
    const from = p.tokens[t];
    const to = landing(from, g.dice!);
    p.tokens[t] = to;
    const captured = victims(g, seat, absOf(p.color, to));
    for (const v of captured) g.players[v.seat].tokens[v.token] = -1;
    if (p.tokens.every((r) => r === HOME)) {
        g.phase = 'over';
        g.winner = seat;
        g.movable = [];
        return { game: g, seat, token: t, from, to, captured, extra: false };
    }
    const extra = g.dice === 6 || captured.length > 0 || to === HOME;
    if (extra) {
        g.phase = 'roll';
        g.dice = null;
        g.movable = [];
    } else {
        passTurn(g);
    }
    return { game: g, seat, token: t, from, to, captured, extra };
};

/** How many opponent tokens could hit absolute square `sq` with one roll. */
const threats = (g: LudoState, seat: number, sq: number | null) => {
    if (sq == null || SAFE.has(sq)) return 0;
    let n = 0;
    g.players.forEach((o, s) => {
        if (s === seat) return;
        for (const r of o.tokens) {
            const a = absOf(o.color, r);
            if (a == null) continue;
            const d = (sq - a + TRACK) % TRACK;
            if (d >= 1 && d <= 6 && r + d < HOME_COL) n++;
        }
    });
    return n;
};

/** Bot / timeout pick: capture > leave base > reach home > safest advance. */
export const botPick = (game: LudoState) => {
    const seat = game.turn;
    const p = game.players[seat];
    let best = game.movable[0];
    let bestScore = -Infinity;
    for (const t of game.movable) {
        const from = p.tokens[t];
        const to = landing(from, game.dice!);
        const sq = absOf(p.color, to);
        let score = to; // tiebreak: push the furthest token
        if (victims(game, seat, sq).length) score += 10000;
        else if (from === -1) score += 5000;
        else if (to === HOME) score += 4000;
        else {
            score -= threats(game, seat, sq) * 300;
            if (sq == null || SAFE.has(sq)) score += 200;
            score += threats(game, seat, absOf(p.color, from)) * 150; // escaping danger is worth something
        }
        if (score > bestScore) { bestScore = score; best = t; }
    }
    return best;
};
