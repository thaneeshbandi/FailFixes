/**
 * Field allowlists for update endpoints.
 *
 * Both `updateUserProfile` and `updateStory` previously did
 * `findByIdAndUpdate(id, { $set: req.body })`, so any client could write any
 * schema path: `role`, `password` (bypassing the bcrypt pre-save hook and
 * landing in the DB as cleartext), `followers`, `stats`, `author`, `likes`,
 * `comments`, `createdAt`, and so on.
 *
 * The rule here is allowlist-only: a field is writable because it is named
 * below, never because it merely isn't blocked.
 */

/**
 * Nested-allowlist spec. `true` = writable leaf, object = recurse.
 */
const PROFILE_UPDATE_SPEC = {
  name: true,
  bio: true,
  location: true,
  website: true,
  avatar: true,
  preferences: {
    emailNotifications: true,
    profileVisibility: true,
    showEmail: true,
  },
};

const STORY_UPDATE_SPEC = {
  title: true,
  content: true,
  category: true,
  tags: true,
  status: true,
  excerpt: true,
  metadata: {
    failureType: true,
    recoveryTime: true,
    currentStatus: true,
    keyLessons: true,
  },
};

// Documented for the error message / tests. Everything not in the spec is
// rejected; these are simply the ones worth naming explicitly.
const PROTECTED_PROFILE_FIELDS = [
  'role',
  'password',
  'isActive',
  'isVerified',
  'tokenVersion',
  'followers',
  'following',
  'likedStories',
  'stats',
  'email',
  'username',
  '_id',
  'createdAt',
  'emailVerificationToken',
];

const PROTECTED_STORY_FIELDS = [
  'author',
  'authorUsername',
  'likes',
  'bookmarks',
  'comments',
  'stats',
  'featured',
  'moderationStatus',
  'slug',
  '_id',
  'createdAt',
  'publishedAt',
];

/**
 * A key is unsafe if it could be interpreted as a MongoDB operator ($) or as a
 * dotted path escaping its subdocument. Allowlisting already blocks these, but
 * checking explicitly makes the intent obvious and covers future spec edits.
 */
function isUnsafeKey(key) {
  return typeof key !== 'string' || key.startsWith('$') || key.includes('.') || key === '__proto__';
}

/**
 * Flatten an allowlisted update into dotted `$set` paths.
 *
 * Dotted paths matter for nested objects: `$set: { preferences: {...} }` would
 * replace the whole subdocument and silently wipe `favoriteCategories` /
 * `favoriteTags`. `$set: { 'preferences.showEmail': true }` updates in place.
 *
 * @param {object} source untrusted input (req.body)
 * @param {object} spec   allowlist spec
 * @param {string} prefix internal, for recursion
 * @returns {{ updates: object, rejected: string[] }}
 */
function buildAllowedUpdate(source, spec, prefix = '') {
  const updates = {};
  const rejected = [];

  if (source === null || typeof source !== 'object' || Array.isArray(source)) {
    return { updates, rejected };
  }

  for (const key of Object.keys(source)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (isUnsafeKey(key) || !Object.prototype.hasOwnProperty.call(spec, key)) {
      rejected.push(path);
      continue;
    }

    const rule = spec[key];
    const value = source[key];

    if (rule === true) {
      // Never let a leaf carry operator keys (e.g. tags: { $each: [...] }).
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        if (Object.keys(value).some(isUnsafeKey)) {
          rejected.push(path);
          continue;
        }
      }
      updates[path] = value;
    } else if (typeof rule === 'object') {
      const nested = buildAllowedUpdate(value, rule, path);
      Object.assign(updates, nested.updates);
      rejected.push(...nested.rejected);
    }
  }

  return { updates, rejected };
}

/**
 * Cap the rejected-field list echoed back to the client. Without it a body full
 * of junk keys turns a 400 into a response-amplification vector.
 */
const MAX_REPORTED_REJECTED_FIELDS = 20;

function summariseRejected(rejected) {
  if (rejected.length <= MAX_REPORTED_REJECTED_FIELDS) return rejected;
  return [
    ...rejected.slice(0, MAX_REPORTED_REJECTED_FIELDS),
    `…and ${rejected.length - MAX_REPORTED_REJECTED_FIELDS} more`,
  ];
}

module.exports = {
  summariseRejected,
  MAX_REPORTED_REJECTED_FIELDS,
  PROFILE_UPDATE_SPEC,
  STORY_UPDATE_SPEC,
  PROTECTED_PROFILE_FIELDS,
  PROTECTED_STORY_FIELDS,
  buildAllowedUpdate,
  isUnsafeKey,
};
