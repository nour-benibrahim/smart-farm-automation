#!/usr/bin/env node
/**
 * Creates a test user via the backend REST API.
 *
 * Usage:
 *   node create-test-user.js
 *       --email you@example.com
 *       --password yourpassword
 *       --first-name John
 *       --last-name Doe
 *       --role farmer
 *
 * Defaults to environment variables TEST_EMAIL / TEST_PASSWORD if provided.
 */

const http = require('http');
const https = require('https');

function getArg(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : (process.env[name.replace('--', '').replace(/-/g, '_').toUpperCase()] || fallback);
}

const email     = getArg('--email',      process.env.TEST_EMAIL)     || 'admin@example.com';
const password  = getArg('--password',   process.env.TEST_PASSWORD)  || null;
const firstName = getArg('--first-name', null)                       || 'Admin';
const lastName  = getArg('--last-name',  null)                       || 'User';
const role      = getArg('--role',       null)                       || 'farmer';
const baseUrl   = getArg('--url',        null)                       || 'http://localhost:3000';

if (!password) {
  console.error('❌ Password is required. Use --password <value> or set TEST_PASSWORD env var.');
  process.exit(1);
}

const userData = JSON.stringify({ email, password, first_name: firstName, last_name: lastName, role });

async function createTestUser() {
  const url = new URL('/api/v1/users/register', baseUrl);
  const lib = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = lib.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(userData) },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('✅ User created:', data.email || email);
            console.log('Login with:', email, '/', password);
          } else {
            console.error('❌ Error:', res.statusCode, data);
          }
        } catch { console.error('❌ Unexpected response:', body); }
        resolve();
      });
    });
    req.on('error', reject);
    req.write(userData);
    req.end();
  });
}

createTestUser().catch((e) => { console.error('❌ Network error:', e.message); process.exit(1); });
