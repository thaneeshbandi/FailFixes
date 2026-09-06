/**
 * Helpers for building MongoDB queries from untrusted input.
 *
 * Two classes of bug this prevents:
 *
 * 1. Regex injection / ReDoS. Several controllers did
 *      new RegExp(`^${req.params.username}$`, 'i')
 *    so `GET /api/users/profile/.%2A` matched an arbitrary user, and a
 *    catastrophic-backtracking pattern such as `(a+)+$` evaluated against every
 *    story's `content` field could pin a database core. Unauthenticated.
 *
 * 2. Operator injection. Express parses `?category[$ne]=x` into an object, and
 *    those objects were assigned straight into query filters.
 */

// Characters with special meaning in a MongoDB (PCRE-ish) regex.
const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;

/**
 * Escape a string for literal use inside a regular expression.
 */
function escapeRegex(input) {
  return String(input).replace(REGEX_SPECIALS, '\\$&');
}

/**
 * Case-insensitive *exact* match on an untrusted value.
 * This is what the username lookups actually meant.
 */
function exactInsensitive(value, maxLength = 200) {
  // Length-capped even though callers are route-validated: a helper that builds
  // a regex from untrusted input should not depend on its caller for safety.
  return new RegExp(`^${escapeRegex(String(value).slice(0, maxLength))}$`, 'i');
}

/**
 * Case-insensitive *contains* match on an untrusted value, with a length cap so
 * a huge pattern can't be used to burn CPU.
 */
function containsInsensitive(value, maxLength = 100) {
  return new RegExp(escapeRegex(String(value).slice(0, maxLength)), 'i');
}

/**
 * Accept a value only if it is a plain string. Anything else — notably the
 * objects Express produces for `?field[$ne]=1` — becomes undefined, so it is
 * simply not added to the query.
 *
 * @returns {string|undefined}
 */
function asString(value) {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Accept a value only if it is a string present in `allowed`.
 * Used for sort fields and status filters, where a free-form value would
 * otherwise become an arbitrary query/sort key.
 *
 * @returns {string|undefined}
 */
function asEnum(value, allowed, fallback = undefined) {
  return typeof value === 'string' && allowed.includes(value) ? value : fallback;
}

/**
 * Clamp a pagination value into a safe integer range.
 */
function asBoundedInt(value, { min, max, fallback }) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

module.exports = {
  escapeRegex,
  exactInsensitive,
  containsInsensitive,
  asString,
  asEnum,
  asBoundedInt,
};
