/**
 * Makes a user-supplied string safe to put inside a RegExp.
 *
 * Without it a search for "(" throws `Invalid regular expression` and 500s the
 * endpoint, and a search for ".*.*.*" makes the database scan pathologically.
 * The helper existed already but only inside auth.controller.js, so every other
 * search endpoint built its regex raw.
 */
export const escapeRegExp = (str = '') => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export default escapeRegExp;
