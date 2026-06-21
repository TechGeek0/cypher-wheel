import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'rounds.json');

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify({ rounds: [] }, null, 2));
}

export function load() {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return { rounds: [] };
  }
}

export function saveRound(round) {
  const db = load();
  db.rounds.unshift(round); // newest first
  db.rounds = db.rounds.slice(0, 200); // keep last 200
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

export function getRounds(limit = 25) {
  return load().rounds.slice(0, limit);
}

export function lastRound() {
  return load().rounds[0] || null;
}
