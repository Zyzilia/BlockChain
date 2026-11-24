class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// created_at SQLite ("2026-11-24 10:00:00", UTC) -> ISO 8601
const toIso = (s) => (s ? s.replace(' ', 'T') + 'Z' : null);

const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

module.exports = { HttpError, toIso, isInt };
