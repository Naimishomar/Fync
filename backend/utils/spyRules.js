/**
 * Who's the Spy: pure rules (no IO). Civilians share word A, the spy (two at
 * 7-8 players) gets the close-but-different word B. Nobody is told their role.
 */

// [civilian word, spy word]; deal() flips the orientation at random.
export const WORD_PAIRS = [
    ["Chai", "Coffee"], ["Metro", "Local train"], ["Maggi", "Pasta"], ["Hostel", "PG"], ["Canteen", "Mess"],
    ["IPL", "World Cup"], ["Samosa", "Kachori"], ["Auto", "Cab"], ["Biryani", "Pulao"], ["Dosa", "Uttapam"],
    ["Instagram", "Snapchat"], ["WhatsApp", "Telegram"], ["Netflix", "Prime Video"], ["Zomato", "Swiggy"], ["Ola", "Uber"],
    ["Bollywood", "Hollywood"], ["Cricket", "Football"], ["Kabaddi", "Kho Kho"], ["Pani puri", "Bhel puri"], ["Vada pav", "Pav bhaji"],
    ["Lassi", "Buttermilk"], ["Paratha", "Roti"], ["Idli", "Dhokla"], ["Gulab jamun", "Rasgulla"], ["Jalebi", "Imarti"],
    ["Diwali", "Holi"], ["Navratri", "Durga Puja"], ["Eid", "Christmas"], ["Rakhi", "Bhai Dooj"], ["Lohri", "Pongal"],
    ["Assignment", "Project"], ["Viva", "Presentation"], ["Midsem", "Endsem"], ["Attendance", "Proxy"], ["Backlog", "Supplementary"],
    ["Lecture", "Lab"], ["Professor", "HOD"], ["Library", "Reading room"], ["Notes", "Textbook"], ["Internship", "Placement"],
    ["Resume", "Cover letter"], ["Hackathon", "Coding contest"], ["LinkedIn", "Naukri"], ["GPA", "Percentage"], ["Topper", "Backbencher"],
    ["Fest", "Farewell"], ["Freshers", "Alumni meet"], ["DJ night", "Garba night"], ["Ragging", "Prank"], ["Warden", "Security guard"],
    ["Roommate", "Neighbour"], ["Curfew", "Gate pass"], ["Laundry", "Ironing"], ["Bunk", "Mass bunk"], ["Maggi point", "Tapri"],
    ["Goa", "Manali"], ["Ladakh", "Spiti"], ["Rishikesh", "Haridwar"], ["Mumbai", "Pune"], ["Delhi", "Gurgaon"],
    ["Bangalore", "Hyderabad"], ["Kolkata", "Chennai"], ["Jaipur", "Udaipur"], ["Kerala", "Goa beach"], ["Shimla", "Mussoorie"],
    ["Train", "Bus"], ["Scooty", "Bike"], ["Sleeper", "AC coach"], ["Flight", "Vande Bharat"], ["Rickshaw", "Tempo"],
    ["Shah Rukh", "Salman"], ["Virat", "Rohit"], ["Dhoni", "Sachin"], ["Arijit", "Badshah"], ["Kapil Sharma", "Bhuvan Bam"],
    ["Ludo", "Carrom"], ["BGMI", "Free Fire"], ["Antakshari", "Dumb charades"], ["Chess", "Cards"], ["Truth or dare", "Never have I ever"],
    ["Paneer", "Tofu"], ["Chole", "Rajma"], ["Momos", "Dimsum"], ["Pizza", "Burger"], ["Ice cream", "Kulfi"],
    ["Cold coffee", "Milkshake"], ["Nimbu pani", "Jaljeera"], ["Thali", "Buffet"], ["Chaat", "Golgappa"], ["Mango", "Litchi"],
    ["Wedding", "Engagement"], ["Sangeet", "Mehendi"], ["Baraat", "Reception"], ["Birthday", "Anniversary"], ["Sleepover", "House party"],
    ["Crush", "Ex"], ["Situationship", "Relationship"], ["Best friend", "Sibling"], ["Group chat", "Family group"], ["Meme", "Reel"],
    ["Selfie", "Group photo"], ["Story", "Post"], ["Podcast", "Vlog"], ["YouTube", "Spotify"], ["Laptop", "Tablet"],
    ["Charger", "Power bank"], ["Earphones", "Headphones"], ["Umbrella", "Raincoat"], ["Monsoon", "Winter"], ["Sunrise", "Sunset"],
    ["Gym", "Yoga"], ["Jogging", "Cycling"], ["Swimming", "Diving"], ["Badminton", "Tennis"], ["Hockey", "Polo"],
    ["Doctor", "Nurse"], ["Engineer", "Architect"], ["Startup", "MNC"], ["Salary", "Stipend"], ["UPSC", "CAT"],
    ["JEE", "NEET"], ["Coaching", "Tuition"], ["Kota", "Delhi coaching"], ["Exam hall", "Waiting room"], ["Result day", "Admit card"],
];

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 8;
export const spyCount = (n) => (n >= 7 ? 2 : 1);

const shuffle = (arr, rand = Math.random) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

export const deal = (playerIds, rand = Math.random) => {
    const pair = WORD_PAIRS[Math.floor(rand() * WORD_PAIRS.length)];
    const [civWord, spyWord] = rand() < 0.5 ? pair : [pair[1], pair[0]];
    const spies = shuffle(playerIds, rand).slice(0, spyCount(playerIds.length));
    return { civWord, spyWord, spies };
};

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z]/g, "");

/** One word, letters only, max 20, and it can't give away your own word. */
export const checkClue = (raw, ownWord) => {
    const clue = String(raw || "").trim();
    if (!/^[A-Za-z]{1,20}$/.test(clue)) return { ok: false, error: "One word, letters only (max 20)." };
    const c = clue.toLowerCase();
    const parts = [norm(ownWord), ...String(ownWord).toLowerCase().split(/\s+/).map(norm).filter((t) => t.length >= 3)];
    if (parts.some((p) => p && (c.includes(p)))) return { ok: false, error: "Your clue can't contain your word." };
    return { ok: true, clue: clue[0].toUpperCase() + clue.slice(1).toLowerCase() };
};

/** votes: { voterId: targetId }. Only alive voters for alive targets count. Tie or no votes -> null. */
export const tally = (votes, aliveIds) => {
    const alive = new Set(aliveIds);
    const counts = {};
    for (const [voter, target] of Object.entries(votes || {})) {
        if (alive.has(voter) && alive.has(target)) counts[target] = (counts[target] || 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (!sorted.length || (sorted[1] && sorted[1][1] === sorted[0][1])) return null;
    return sorted[0][0];
};

/** 'civilians' when every spy is out, 'spies' when spies >= civilians alive, else null. */
export const winner = (aliveIds, spies) => {
    const aliveSpies = aliveIds.filter((id) => spies.includes(id)).length;
    if (aliveSpies === 0) return "civilians";
    if (aliveSpies >= aliveIds.length - aliveSpies) return "spies";
    return null;
};

export const guessMatches = (guess, civWord) => !!norm(guess) && norm(guess) === norm(civWord);
