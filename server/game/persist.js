// Persistence layer — pure Node.js fs, zero dependencies
// Profiles and match history survive temp filesystem; permanent with Railway volume

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', '..', '.data');

function ensureDir() {
  try { mkdirSync(DATA_DIR, { recursive: true }); } catch {}
}
ensureDir();

function safeFilename(str) {
  return str.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
}

// ===== PROFILE =====

export function getProfile(name) {
  try {
    const file = join(DATA_DIR, `profile_${safeFilename(name)}.json`);
    if (!existsSync(file)) return null;
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch { return null; }
}

export function saveProfile({ name, avatarSeed = '', avatarStyle = 'bottts', color = '#ffb300' }) {
  const file = join(DATA_DIR, `profile_${safeFilename(name)}.json`);
  const profile = { name, avatarSeed, avatarStyle, color };
  writeFileSync(file, JSON.stringify(profile, null, 2));
  return profile;
}

export function listProfiles() {
  try {
    return readdirSync(DATA_DIR)
      .filter(f => f.startsWith('profile_') && f.endsWith('.json'))
      .map(f => {
        try { return JSON.parse(readFileSync(join(DATA_DIR, f), 'utf8')); }
        catch { return null; }
      })
      .filter(Boolean);
  } catch { return []; }
}

// ===== MATCH HISTORY =====

export function saveMatchHistory({ roomCode, totalRounds, betPerPoint, players, roundsPlayed, finalPoints, finalMoney }) {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const file = join(DATA_DIR, `match_${id}.json`);
  writeFileSync(file, JSON.stringify({
    id, roomCode, totalRounds, betPerPoint, players,
    roundsPlayed, finalPoints, finalMoney, finishedAt: Date.now(),
  }, null, 2));
  // Prune old match files — keep only last 20
  pruneOldMatches(20);
  return id;
}

export function getRecentMatches(limit = 10) {
  try {
    return readdirSync(DATA_DIR)
      .filter(f => f.startsWith('match_') && f.endsWith('.json'))
      .map(f => {
        try { return JSON.parse(readFileSync(join(DATA_DIR, f), 'utf8')); }
        catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0))
      .slice(0, limit);
  } catch { return []; }
}

// Keep only the N most recent match files
export function pruneOldMatches(keep = 20) {
  try {
    const files = readdirSync(DATA_DIR)
      .filter(f => f.startsWith('match_') && f.endsWith('.json'))
      .map(f => {
        try { return JSON.parse(readFileSync(join(DATA_DIR, f), 'utf8')); }
        catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0));
    if (files.length <= keep) return;
    for (const m of files.slice(keep)) {
      try { unlinkSync(join(DATA_DIR, `match_${m.id}.json`)); } catch {}
    }
  } catch {}
}
