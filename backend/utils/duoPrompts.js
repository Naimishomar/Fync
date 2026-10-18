// Prompt banks for Couples Corner. Every game is a run of two-option rounds:
// both players tap one side, then the picks are revealed together. Keep these
// friendly and campus-safe — random matchmaking pairs strangers.

export const DUO_GAMES = {
    thisOrThat: {
        rounds: 10,
        prompts: [
            ["Chai", "Coffee"], ["Mountains", "Beach"], ["Morning class", "Late-night study"],
            ["Maggi", "Momos"], ["Movie at home", "Movie in theatre"], ["Text", "Call"],
            ["Dogs", "Cats"], ["Bollywood", "Hollywood"], ["Sunrise", "Sunset"],
            ["Road trip", "Flight"], ["Biryani", "Pizza"], ["Front bench", "Last bench"],
            ["Spotify", "YouTube Music"], ["Instagram", "Snapchat"], ["Rain", "Winter"],
            ["Sweet", "Spicy"], ["Planner", "Go with the flow"], ["Books", "Podcasts"],
            ["Gym", "Yoga"], ["Party", "Netflix night"], ["Introvert", "Extrovert"],
            ["Long walks", "Long drives"], ["Gol gappe", "Chaat"], ["Android", "iPhone"],
            ["Early bird", "Night owl"], ["Ice cream", "Cake"], ["Cricket", "Football"],
        ],
    },
    wouldYouRather: {
        rounds: 8,
        prompts: [
            ["Never use Instagram again", "Never watch Netflix again"],
            ["Ace every exam", "Land a dream internship"],
            ["Live without music", "Live without movies"],
            ["Read minds", "Be invisible"],
            ["Always be 10 min late", "Always be 30 min early"],
            ["Eat only Maggi for a month", "Eat only canteen food for a month"],
            ["Travel the world alone", "Stay home with your best people"],
            ["Give up your phone for a week", "Give up sleep-ins for a month"],
            ["Be famous on campus", "Be the topper nobody knows"],
            ["Have a pause button", "Have a rewind button"],
            ["Speak every language", "Play every instrument"],
            ["Win a hackathon", "Win the college fest"],
            ["Know your future", "Change your past"],
            ["Unlimited data forever", "Unlimited food delivery forever"],
            ["Always say what you think", "Never speak again"],
        ],
    },
    knowMe: {
        rounds: 10,
        // Asked about the round's subject: they answer for themselves, the other guesses.
        prompts: [
            ["Chai", "Coffee"], ["Early bird", "Night owl"], ["Texter", "Caller"],
            ["Plans everything", "Totally spontaneous"], ["Sweet tooth", "Spice lover"],
            ["Cries at movies", "Never cries at movies"], ["Messy room", "Neat freak"],
            ["Mountains", "Beach"], ["Sleeps in class", "Never sleeps in class"],
            ["Saves money", "Spends it all"], ["Dances at parties", "Watches from the side"],
            ["Replies instantly", "Leaves you on read"], ["Dog person", "Cat person"],
            ["Cooks well", "Burns Maggi"], ["Overthinker", "Chill always"],
            ["Gets jealous", "Never jealous"], ["Sings in the shower", "Silent shower"],
        ],
    },
    neverHaveI: {
        rounds: 10,
        prompts: [
            "bunked a class to sleep", "eaten someone else's tiffin", "cried over an exam result",
            "fallen asleep in a lecture", "faked being sick", "stalked a crush's profile",
            "sent a text to the wrong person", "pulled an all-nighter before an exam",
            "laughed at the wrong moment", "lied about reading a book", "forgotten a friend's birthday",
            "sung loudly in public", "got lost in my own college", "binge-watched a full season in one day",
            "pretended to be on a call", "eaten Maggi at 3 AM", "submitted an assignment at 11:59 PM",
            "copied homework", "danced in the rain", "had a crush on a teacher",
        ].map((s) => [`I have ${s}`, `Never have I ever ${s}`]),
    },
};

export const isDuoGame = (game) => Object.prototype.hasOwnProperty.call(DUO_GAMES, game);

/** `n` distinct prompts in random order. `rand` is injectable for tests. */
export const pickPrompts = (game, rand = Math.random) => {
    const { prompts, rounds } = DUO_GAMES[game];
    const pool = prompts.slice();
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, Math.min(rounds, pool.length));
};

/** A round matches when both players picked, and picked the same side. */
export const isMatch = (picks, players) => {
    const [a, b] = players.map((p) => picks[p]);
    return a != null && a === b;
};
