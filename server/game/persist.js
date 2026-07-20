// Persistence layer — node-persist (pure JS, no native deps)
// Profiles and match history survive server restarts on Railway volumes

import storage from 'node-persist';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || join(__dirname, '..', '..', '.data');
try { mkdirSync(dataDir, { recursive: true }); } catch {}

await storage.init({ dir: join(dataDir, 'storage') });

// ===== PROFILE =====

const PROFILE_KEY = (name) => `profile:${name.toLowerCase()}`;

export function getProfile(name) {
  const key = PROFILE_KEY(name);
  const data = storage.getItemSync(key);
  return data || null;
}

export function saveProfile({ name, avatarSeed = '', avatarStyle = 'bottts', color = '#ffb300' }) {
  const key = PROFILE_KEY(name);
  const profile = { name, avatarSeed, avatarStyle, color };
  storage.setItemSync(key, profile);
  return profile;
}

export function listProfiles() {
  return storage.valuesSync().filter(v => v && v.name);
}

// ===== MATCH HISTORY =====

const MATCH_PREFIX = 'match:';

export function saveMatchHistory({ roomCode, totalRounds, betPerPoint, players, roundsPlayed, finalPoints, finalMoney }) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  storage.setItemSync(`${MATCH_PREFIX}${id}`, {
    id,
    roomCode,
    totalRounds,
    betPerPoint,
    players,
    roundsPlayed,
    finalPoints,
    finalMoney,
    finishedAt: Date.now(),
  });
  return id;
}

export function getRecentMatches(limit = 10) {
  const matches = storage.valuesSync()
    .filter(v => v && v.id && v.players)
    .sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0));
  return matches.slice(0, limit);
}

export default storage;
