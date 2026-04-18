'use strict';
const sanitizeHtml = require('sanitize-html');

// Strip all HTML tags from string fields — prevents XSS in stored content
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return sanitizeHtml(str, { allowedTags: [], allowedAttributes: {} }).trim();
}

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map(v => typeof v === 'string' ? sanitizeString(v) : v);
    } else if (value && typeof value === 'object') {
      result[key] = sanitizeObject(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// Text fields that should be sanitized (user-generated content)
const TEXT_FIELDS = new Set([
  'comment', 'content', 'description', 'notes', 'message', 'body',
  'response', 'reason', 'adminNotes', 'rejectionReason', 'suspendReason',
  'review', 'text', 'excerpt', 'title',
]);

module.exports = function sanitizeMiddleware(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      if (TEXT_FIELDS.has(key) && typeof req.body[key] === 'string') {
        req.body[key] = sanitizeString(req.body[key]);
      }
    }
  }
  next();
};
