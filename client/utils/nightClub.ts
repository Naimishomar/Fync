// Mirrors backend/utils/nightClub.js. The club is an IST thing, and the server
// is the bouncer — it gates on IST regardless of where the phone is.
//
// Both screens used to read `new Date().getHours()`, the *device's* hour. On any
// phone not set to IST that made the door disagree with the bouncer: the UI lit
// up "CLUB IS LIVE", the user tapped ENTER, and the socket answered "The Club is
// closed." Reading the same clock the server reads keeps the two honest.

export const CLUB_TIMEZONE = 'Asia/Kolkata';
export const CLUB_OPEN_HOUR = 0;
export const CLUB_CLOSE_HOUR = 6;

const SECONDS_PER_DAY = 86400;

const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: CLUB_TIMEZONE,
  hourCycle: 'h23',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const parts = (now: Date) => {
  const out: Record<string, string> = {};
  for (const p of formatter.formatToParts(now)) {
    if (p.type !== 'literal') out[p.type] = p.value;
  }
  return out;
};

export interface ClubStatus {
  isOpen: boolean;
  hour: number;
  secondsUntilOpen: number;
  secondsUntilClose: number;
}

export const checkClubStatus = (now: Date = new Date()): ClubStatus => {
  const p = parts(now);
  const hour = Number(p.hour ?? 0) % 24;
  const minute = Number(p.minute ?? 0);
  const second = Number(p.second ?? 0);

  const isOpen = hour >= CLUB_OPEN_HOUR && hour < CLUB_CLOSE_HOUR;
  const secondsIntoDay = hour * 3600 + minute * 60 + second;

  return {
    isOpen,
    hour,
    secondsUntilOpen: isOpen ? 0 : SECONDS_PER_DAY - secondsIntoDay,
    secondsUntilClose: isOpen ? CLUB_CLOSE_HOUR * 3600 - secondsIntoDay : 0,
  };
};

// The server now rotates identities nightly by handing out a per-night
// pseudonym, so the alias is seeded from that alone — no date needed here, and
// no way for two devices to disagree about which night it is.

export const formatCountdown = (totalSeconds: number): string => {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${m.toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
};
