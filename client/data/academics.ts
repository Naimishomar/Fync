/**
 * Shared academic vocabulary.
 *
 * A hackathon that targets "2027" only means something if a student can
 * actually have "2027" on their profile, so signup and eligibility read the
 * same lists rather than each keeping their own.
 */

/** Passout years — what `user.year` holds. */
export const PASSOUT_YEARS = ['2025', '2026', '2027', '2028', '2029', '2030'];

/** Degree programmes — what `user.major` holds. */
export const MAJORS = ['B.Tech', 'BCA', 'MCA', 'MBA', 'Pharmacy', 'B.Sc', 'M.Tech'];

/**
 * Branches / specialisations.
 *
 * Students do not carry a branch on their profile, so this is descriptive:
 * it tells a reader who the hackathon is aimed at. Fync never enforces it —
 * the organiser's own registration form decides who gets in.
 */
export const BRANCHES = [
  'Computer Science (CSE)',
  'Information Technology (IT)',
  'Artificial Intelligence & ML',
  'Data Science',
  'Electronics & Communication (ECE)',
  'Electrical (EE)',
  'Electrical & Electronics (EEE)',
  'Mechanical',
  'Civil',
  'Chemical',
  'Biotechnology',
  'Aerospace',
  'Automobile',
  'Instrumentation',
  'Metallurgy',
  'Production & Industrial',
  'Mathematics & Computing',
  'Management (BBA / MBA)',
  'Design',
  'Other',
];
