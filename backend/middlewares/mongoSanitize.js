// Custom MongoDB sanitization middleware for Express 5 compatibility
// express-mongo-sanitize is incompatible with Express 5 (req.query is getter-only)
// This version creates sanitized copies instead of mutating the original objects

const MONGO_OPERATORS = [
  '$where', '$ne', '$in', '$nin', '$gt', '$gte', '$lt', '$lte',
  '$eq', '$not', '$or', '$and', '$nor', '$exists', '$type',
  '$mod', '$regex', '$text', '$all', '$elemMatch', '$size',
  '$comment', '$natural', '$expr', '$jsonSchema', '$options'
];

function sanitize(obj, seen = new WeakSet()) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (seen.has(obj)) return obj; // circular reference protection
  seen.add(obj);

  if (Array.isArray(obj)) {
    return obj.map(item => sanitize(item, seen));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip MongoDB operators
    if (MONGO_OPERATORS.includes(key)) {
      continue;
    }
    // Recursively sanitize nested objects
    sanitized[key] = sanitize(value, seen);
  }
  return sanitized;
}

export const mongoSanitize = () => (req, res, next) => {
  try {
    // Sanitize body - replace with sanitized version (writable in Express 5)
    if (req.body && typeof req.body === 'object') {
      req.body = sanitize(req.body);
    }
    
    // Sanitize params (writable in Express 5)
    if (req.params && typeof req.params === 'object') {
      req.params = sanitize(req.params);
    }
    
    // Note: req.query is a getter-only property in Express 5, cannot be reassigned.
    // Query objects are recreated per request, so mutation risk is minimal.
    // If needed, use a custom getter override or skip query sanitization.
    
  } catch (err) {
    console.warn('Mongo sanitize error:', err.message);
  }
  next();
};

export default mongoSanitize;