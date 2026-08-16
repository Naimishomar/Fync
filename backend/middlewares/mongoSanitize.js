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
    // Sanitize body - replace with sanitized version
    if (req.body && typeof req.body === 'object') {
      req.body = sanitize(req.body);
    }
    
    // Sanitize query - create new object instead of mutating
    if (req.query && typeof req.query === 'object') {
      req.query = sanitize(req.query);
    }
    
    // Sanitize params
    if (req.params && typeof req.params === 'object') {
      req.params = sanitize(req.params);
    }
  } catch (err) {
    console.warn('Mongo sanitize error:', err.message);
  }
  next();
};

export default mongoSanitize;