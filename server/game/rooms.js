// Room manager — handles multiple concurrent matches

import { BigTwoMatch, MATCH_STATE } from './match.js';
import { GAME_STATE } from './engine.js';
import { cardToString } from './deck.js';
import { identifyPlay, canBeat } from './validator.js';

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 confusion

function generateRoomCode() {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

function serializeCard(c) {
  return { rank: c.rank, suit: c.suit, label: cardToString(c) };
}

export class Room {
  constructor(code, hostSocketId) {
    this.code = code;
    this.hostSocketId = hostSocketId;
    this.players = [];       // [{ socketId, name, index, connected }]
    this.match = null;
    this.createdAt = Date.now();
  }

  get numPlayers() { return this.players.length; }

  addPlayer(socketId, name) {
    if (this.players.length >= 4) throw new Error('Room full');
    if (this.match) throw new Error('Match already started');
    const index = this.players.length;
    this.players.push({ socketId, name, index, connected: true });
    return index;
  }

  removePlayer(socketId) {
    const p = this.players.find(p => p.socketId === socketId);
    if (p) p.connected = false;
  }

  // Fully remove a player and re-index the remaining ones.
  // Safe only when a match is not in progress.
  leavePlayer(socketId) {
    const idx = this.players.findIndex(p => p.socketId === socketId);
    if (idx === -1) return false;
    this.players.splice(idx, 1);
    this.players.forEach((p, i) => { p.index = i; });
    if (this.hostSocketId === socketId && this.players.length > 0) {
      this.hostSocketId = this.players[0].socketId;
    }
    return true;
  }

  reconnectPlayer(socketId, oldSocketId) {
    const p = this.players.find(p => p.socketId === oldSocketId);
    if (p) {
      p.socketId = socketId;
      p.connected = true;
      return p.index;
    }
    return -1;
  }

  getPlayerBySocket(socketId) {
    return this.players.find(p => p.socketId === socketId);
  }

  startMatch({ numPlayers, betPerPoint, totalRounds }) {
    const names = this.players.map(p => p.name);
    this.match = new BigTwoMatch({
      numPlayers: this.players.length,
      betPerPoint,
      totalRounds,
      playerNames: names,
    });
    this.match.start();
  }

  // Serialize state for a specific player's view
  serializeFor(socketId) {
    const player = this.getPlayerBySocket(socketId);
    const base = {
      code: this.code,
      players: this.players.map(p => ({
        name: p.name,
        index: p.index,
        connected: p.connected,
        profile: this.playerProfiles ? this.playerProfiles[p.name] : null,
      })),
      matchState: this.match ? this.match.state : 'LOBBY',
    };

    if (!this.match) {
      return { ...base, state: 'LOBBY' };
    }

    const m = this.match;
    const g = m.game;

    const out = {
      ...base,
      state: m.state,
      numPlayers: m.numPlayers,
      betPerPoint: m.betPerPoint,
      totalRounds: m.totalRounds,
      currentRound: m.currentRound,
      playerNames: m.playerNames,
      cumulativePoints: [...m.cumulativePoints],
      cumulativeMoney: [...m.cumulativeMoney],
      roundHistory: m.roundHistory.map(h => ({
        round: h.round,
        winner: h.winner,
        netPoints: h.result.netPoints,
        money: h.result.money,
        penalizedPlayer: h.result.penalizedPlayer,
      })),
      lastWinner: m.lastWinner,
    };

    if (g) {
      const myIndex = player ? player.index : -1;
      out.game = {
        state: g.state,
        numPlayers: g.numPlayers,
        currentPlayer: g.currentPlayer,
        tablePlay: g.tablePlay,
        tablePlayBy: g.tablePlayBy,
        passed: [...g.passed],
        handCounts: g.hands.map(h => h.length),
        // Only send the requesting player's hand
        hand: myIndex >= 0 ? g.hands[myIndex].map(serializeCard) : [],
        myIndex,
        winner: g.winner,
        isFirstPlay: g.isFirstPlay,
        lastCardAnnouncer: g.lastCardAnnouncer,
        lastCardRuleTarget: g.lastCardRuleTarget,
        lastCardViolation: g.lastCardViolation,
        tablePlayCards: g.tablePlay ? g.tablePlay.cards.map(serializeCard) : null,
        tablePlayType: g.tablePlay ? g.tablePlay.type : null,
        result: g.result ? {
          ...g.result,
          leftoverHands: g.hands.map(h => h.map(serializeCard)),
        } : null,
      };
    }

    return out;
  }
}

export class RoomManager {
  constructor() {
    this.rooms = new Map(); // code → Room
  }

  createRoom(hostSocketId) {
    let code;
    do { code = generateRoomCode(); } while (this.rooms.has(code));
    const room = new Room(code, hostSocketId);
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code) {
    return this.rooms.get(code?.toUpperCase());
  }

  removeRoom(code) {
    this.rooms.delete(code);
  }

  // Find room by socket ID
  findRoomBySocket(socketId) {
    for (const room of this.rooms.values()) {
      if (room.players.some(p => p.socketId === socketId)) return room;
    }
    return null;
  }

  // Clean up empty rooms
  cleanup() {
    for (const [code, room] of this.rooms) {
      if (room.players.every(p => !p.connected)) {
        this.rooms.delete(code);
      }
    }
  }
}

// Hint generator (shared logic)
export function generateHints(game, playerIndex) {
  const hand = game.hands[playerIndex];
  const hints = [];

  if (game.tablePlay === null) {
    hints.push({ type: 'single', indices: [0] });
    return hints;
  }

  const needed = game.tablePlay.type;
  const neededCount = game.tablePlay.cards.length;

  if (neededCount === 1) {
    for (let i = 0; i < hand.length; i++) {
      const play = identifyPlay([hand[i]]);
      if (play && canBeat(play, game.tablePlay)) {
        hints.push({ type: 'single', indices: [i] });
      }
    }
  } else if (neededCount === 2) {
    for (let i = 0; i < hand.length; i++) {
      for (let j = i + 1; j < hand.length; j++) {
        const play = identifyPlay([hand[i], hand[j]]);
        if (play && canBeat(play, game.tablePlay)) {
          hints.push({ type: 'pair', indices: [i, j] });
        }
      }
    }
  } else if (neededCount === 3) {
    for (let i = 0; i < hand.length; i++) {
      for (let j = i + 1; j < hand.length; j++) {
        for (let k = j + 1; k < hand.length; k++) {
          const play = identifyPlay([hand[i], hand[j], hand[k]]);
          if (play && canBeat(play, game.tablePlay)) {
            hints.push({ type: 'triple', indices: [i, j, k] });
          }
        }
      }
    }
  } else if (neededCount === 5) {
    for (let a = 0; a < hand.length - 4; a++)
      for (let b = a + 1; b < hand.length - 3; b++)
        for (let c = b + 1; c < hand.length - 2; c++)
          for (let d = c + 1; d < hand.length - 1; d++)
            for (let e = d + 1; e < hand.length; e++) {
              const cards = [hand[a], hand[b], hand[c], hand[d], hand[e]];
              const play = identifyPlay(cards);
              if (play && canBeat(play, game.tablePlay)) {
                hints.push({ type: play.type, indices: [a, b, c, d, e] });
              }
            }
  }

  // Sort: if last-card rule target, put highest single first
  if (game.lastCardRuleTarget === playerIndex && game.tablePlay && game.tablePlay.cards.length === 1) {
    const highestIdx = hand.length - 1;
    hints.sort((a, b) => {
      const aH = a.indices.length === 1 && a.indices[0] === highestIdx;
      const bH = b.indices.length === 1 && b.indices[0] === highestIdx;
      if (aH && !bH) return -1;
      if (!aH && bH) return 1;
      return 0;
    });
  }

  return hints.slice(0, 20);
}
