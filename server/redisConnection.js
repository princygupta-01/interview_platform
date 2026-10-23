require('dotenv').config();

// TLS is on by default (Upstash etc. require it). It is skipped automatically
// for a local Redis, or can be forced either way with REDIS_TLS=true|false.
const host = process.env.REDIS_HOST;
const isLocal = !host || host === 'localhost' || host === '127.0.0.1';
const useTls =
  process.env.REDIS_TLS !== undefined
    ? process.env.REDIS_TLS === 'true'
    : !isLocal;

const connection = {
  host: host || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  ...(useTls ? { tls: {} } : {}),
};

module.exports = connection;
