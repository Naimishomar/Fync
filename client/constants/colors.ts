/**
 * The palette, as values.
 *
 * tailwind.config.js already holds these, but a Tailwind class cannot reach a
 * prop — `Ionicons` takes `color`, `ActivityIndicator` takes `color`,
 * `RefreshControl` takes `tintColor`. Those props were filled with literal hex
 * in 2,079 places, which made the token system advisory rather than binding:
 * a brand change meant a find-and-replace, and a dark theme was impossible.
 *
 * Keep this in step with tailwind.config.js. It is the same palette, expressed
 * where JavaScript can see it.
 */
export const brand = {
  50: '#fff7ed',
  100: '#ffedd5',
  200: '#fed7aa',
  300: '#fdba74',
  400: '#fb923c',
  500: '#F97316',
  600: '#ea580c',
  700: '#c2410c',
  800: '#9a3412',
  900: '#7c2d12',
} as const;

export const C = {
  brand,
  accent: brand[500],
  accentText: brand[600],

  /** Headings, borders, tab bar. */
  ink: '#12100E',
  /** Body copy. */
  ink2: '#57534E',
  /** Meta, timestamps. */
  ink3: '#8B857E',
  /** Disabled, placeholder — never body text. */
  ink4: '#C4BEB6',

  /** App background. */
  paper: '#F5F2EC',
  /** Pressed / inset surfaces. */
  paper2: '#EDE8E0',
  card: '#FFFFFF',
  /** Hairline. */
  line: '#E3DDD3',

  student: '#F97316',
  alumni: '#B45309',
  alumniLit: '#F5B700',
  recruiter: '#4F46E5',

  fam: {
    study: '#7C3AED',
    career: '#2563EB',
    events: '#EA580C',
    social: '#0891B2',
    campus: '#57534E',
    fun: '#DB2777',
  },

  success: '#047857',
  warning: '#B45309',
  danger: '#DC2626',
  info: '#2563EB',

  night: '#0D0B12',
  night2: '#171320',
  nightInk: '#EDE8E0',
  night3: '#8B8397',

  violet: '#A78BFA',
  white: '#FFFFFF',
} as const;
