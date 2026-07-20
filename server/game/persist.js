// Persistence layer — SQLite for rooms, profiles, and game history
// Survives server restarts. Railway-friendly (no external service needed).

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbDir = process.env.DATA_DIR || join(__dirname, '..', '..', '.data');
try { mkdirSync(dbDir, { recursive: true }); } catch {}

const db = new Database(join(dbDir, 'bigtwo.db'));
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    name TEXT PRIMARY KEY,
    avatar_seed TEXT DEFAULT '',
    avatar_style TEXT DEFAULT 'bottts',
    color TEXT DEFAULT '#ffb300',
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS match_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_code TEXT NOT NULL,
    total_rounds INTEGER NOT NULL,
    bet_per_point INTEGER NOT NULL,
    players_json TEXT NOT NULL,
    rounds_played INTEGER NOT NULL,
    final_points_json TEXT NOT NULL,
    final_money_json TEXT NOT NULL,
    finished_at INTEGER DEFAULT (unixepoch())
  );
`);

// ===== PROFILE =====

const stmtGetProfile = db.prepare('SELECT * FROM profiles WHERE name = ?');
const stmtUpsertProfile = db.prepare(`
  INSERT INTO profiles (name, avatar_seed, avatar_style, color, updated_at)
  VALUES (?, ?, ?, ?, unixepoch())
  ON CONFLICT(name) DO UPDATE SET
    avatar_seed = excluded.avatar_seed,
    avatar_style = excluded.avatar_style,
    color = excluded.color,
    updated_at = unixepoch()
`);
const stmtListProfiles = db.prepare('SELECT * FROM profiles ORDER BY name');

export function getProfile(name) {
  const row = stmtGetProfile.get(name);
  if (!row) return null;
  return {
    name: row.name,
    avatarSeed: row.avatar_seed,
    avatarStyle: row.avatar_style,
    color: row.color,
  };
}

export function saveProfile({ name, avatarSeed = '', avatarStyle = 'bottts', color = '#ffb300' }) {
  stmtUpsertProfile.run(name, avatarSeed, avatarStyle, color);
  return getProfile(name);
}

export function listProfiles() {
  return stmtListProfiles.all().map(row => ({
    name: row.name,
    avatarSeed: row.avatar_seed,
    avatarStyle: row.avatar_style,
    color: row.color,
  }));
}

// ===== MATCH HISTORY =====

const stmtSaveMatch = db.prepare(`
  INSERT INTO match_history (room_code, total_rounds, bet_per_point, players_json, rounds_played, final_points_json, final_money_json)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const stmtRecentMatches = db.prepare(`
  SELECT * FROM match_history ORDER BY finished_at DESC LIMIT ?
`);

export function saveMatchHistory({ roomCode, totalRounds, betPerPoint, players, roundsPlayed, finalPoints, finalMoney }) {
  return stmtSaveMatch.run(
    roomCode, totalRounds, betPerPoint,
    JSON.stringify(players),
    roundsPlayed,
    JSON.stringify(finalPoints),
    JSON.stringify(finalMoney)
  );
}

export function getRecentMatches(limit = 10) {
  return stmtRecentMatches.all(limit).map(r => ({
    ...r,
    players: JSON.parse(r.players_json),
    finalPoints: JSON.parse(r.final_points_json),
    finalMoney: JSON.parse(r.final_money_json),
  }));
}

export default db;
