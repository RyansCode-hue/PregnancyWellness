#!/usr/bin/env node
/**
 * Bump the patch (or minor / major) component of expo.version in app.json.
 * Usage:
 *   node scripts/bump-version.js          # patch (default)
 *   node scripts/bump-version.js patch
 *   node scripts/bump-version.js minor
 *   node scripts/bump-version.js major
 */
const fs = require('fs');
const path = require('path');

const part = (process.argv[2] || 'patch').toLowerCase();
if (!['patch', 'minor', 'major'].includes(part)) {
  console.error(`Unknown bump type "${part}". Use patch | minor | major.`);
  process.exit(1);
}

const file = path.resolve(__dirname, '..', 'app.json');
const json = JSON.parse(fs.readFileSync(file, 'utf8'));
const current = json.expo.version || '0.0.0';
const parts = current.split('.').map((n) => parseInt(n, 10));
while (parts.length < 3) parts.push(0);
let [major, minor, patch] = parts;

if (part === 'major') {
  major += 1;
  minor = 0;
  patch = 0;
} else if (part === 'minor') {
  minor += 1;
  patch = 0;
} else {
  patch += 1;
}

const next = `${major}.${minor}.${patch}`;
json.expo.version = next;
fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
console.log(`app.json: ${current} → ${next}`);
