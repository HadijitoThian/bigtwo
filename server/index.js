import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { RoomManager, generateHints } from './game/rooms.js';
import { MATCH_STATE } from './game/match.js';
import { GAME_STATE } from './game/engine.js';
import { saveProfile, getProfile, listProfiles, saveMatchHistory } from './game/persist.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const http = createServer(app);
const io = new Server(http);

app.use(express.static(join(__dirname, '../client')));

const manager = new RoomManager();

// Broadcast state to all players in a room (each gets their own view)
function broadcastRoom(room) {
  // Auto-save match history when match finishes
  if (room.match && room.match.state === 'FINISHED' && !room._historySaved) {
    room._historySaved = true;
    try {
      saveMatchHistory({
        roomCode: room.code,
        totalRounds: room.match.totalRounds,
        betPerPoint: room.match.betPerPoint,
        players: room.match.playerNames,
        roundsPlayed: room.match.currentRound,
        finalPoints: room.match.cumulativePoints,
        finalMoney: room.match.cumulativeMoney,
      });
    } catch { /* non-critical */ }
  }
  for (const player of room.players) {
    if (player.connected) {
      const state = room.serializeFor(player.socketId);
      io.to(player.socketId).emit('state', state);
    }
  }
}

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  // Send initial state
  socket.emit('state', { state: 'NO_ROOM' });

  // ===== LOBBY =====

  socket.on('createRoom', ({ name } = {}) => {
    try {
      if (!name?.trim()) throw new Error('Name required');
      // Auto-create/sync profile
      let profile = getProfile(name);
      if (!profile) profile = saveProfile({ name, avatarSeed: name, avatarStyle: 'bottts' });
      const room = manager.createRoom(socket.id);
      room.addPlayer(socket.id, name.trim());
      // Store profile on room so we have it for persistence
      room.playerProfiles = room.playerProfiles || {};
      room.playerProfiles[name] = profile;
      socket.emit('state', room.serializeFor(socket.id));
      console.log(`Room ${room.code} created by ${name}`);
    } catch (e) {
      socket.emit('error', e.message);
    }
  });

  socket.on('joinRoom', ({ code, name } = {}) => {
    try {
      if (!name?.trim()) throw new Error('Name required');
      // Auto-create/sync profile
      let profile = getProfile(name);
      if (!profile) profile = saveProfile({ name, avatarSeed: name, avatarStyle: 'bottts' });
      const room = manager.getRoom(code);
      if (!room) throw new Error('Room not found');
      room.addPlayer(socket.id, name.trim());
      room.playerProfiles = room.playerProfiles || {};
      room.playerProfiles[name] = profile;
      // Send chat history to the new player
      if (room.chatHistory?.length > 0) {
        for (const msg of room.chatHistory.slice(-50)) {
          socket.emit('chatMessage', msg);
        }
      }
      broadcastRoom(room);
      console.log(`${name} joined room ${room.code}`);
    } catch (e) {
      socket.emit('error', e.message);
    }
  });

  socket.on('startMatch', ({ betPerPoint = 10000, totalRounds = 12 } = {}) => {
    try {
      const room = manager.findRoomBySocket(socket.id);
      if (!room) throw new Error('Not in a room');
      if (socket.id !== room.hostSocketId) throw new Error('Only host can start');
      if (room.players.length < 2) throw new Error('Need at least 2 players');
      room.startMatch({ betPerPoint, totalRounds });
      broadcastRoom(room);
      console.log(`Match started in room ${room.code}`);
    } catch (e) {
      socket.emit('error', e.message);
    }
  });

  // ===== GAMEPLAY =====

  socket.on('play', ({ cardIndices }) => {
    try {
      const room = manager.findRoomBySocket(socket.id);
      if (!room?.match) throw new Error('No active match');
      const player = room.getPlayerBySocket(socket.id);
      if (!player) throw new Error('Not in this room');
      room.match.play(player.index, cardIndices);
      broadcastRoom(room);
    } catch (e) {
      socket.emit('error', e.message);
      broadcastRoom(manager.findRoomBySocket(socket.id));
    }
  });

  socket.on('pass', () => {
    try {
      const room = manager.findRoomBySocket(socket.id);
      if (!room?.match) throw new Error('No active match');
      const player = room.getPlayerBySocket(socket.id);
      if (!player) throw new Error('Not in this room');
      room.match.pass(player.index);
      broadcastRoom(room);
    } catch (e) {
      socket.emit('error', e.message);
      broadcastRoom(manager.findRoomBySocket(socket.id));
    }
  });

  socket.on('nextRound', () => {
    try {
      const room = manager.findRoomBySocket(socket.id);
      if (!room?.match) throw new Error('No active match');
      room.match.nextRound();
      broadcastRoom(room);
    } catch (e) {
      socket.emit('error', e.message);
    }
  });

  socket.on('stopMatch', () => {
    try {
      const room = manager.findRoomBySocket(socket.id);
      if (!room?.match) throw new Error('No active match');
      room.match.stopMatch();
      // Save match history
      try {
        saveMatchHistory({
          roomCode: room.code,
          totalRounds: room.match.totalRounds,
          betPerPoint: room.match.betPerPoint,
          players: room.match.playerNames,
          roundsPlayed: room.match.currentRound,
          finalPoints: room.match.cumulativePoints,
          finalMoney: room.match.cumulativeMoney,
        });
      } catch { /* non-critical */ }
      broadcastRoom(room);
    } catch (e) {
      socket.emit('error', e.message);
    }
  });

  socket.on('hint', () => {
    try {
      const room = manager.findRoomBySocket(socket.id);
      if (!room?.match?.game || room.match.game.state !== GAME_STATE.PLAYING) return;
      const player = room.getPlayerBySocket(socket.id);
      if (!player) return;
      const hints = generateHints(room.match.game, player.index);
      socket.emit('hints', hints);
    } catch (e) {
      socket.emit('error', e.message);
    }
  });

  // ===== RECONNECT =====

  socket.on('reconnect', ({ code, name } = {}) => {
    try {
      const room = manager.getRoom(code);
      if (!room) throw new Error('Room not found');
      // Find player by name (simple reconnect strategy)
      const player = room.players.find(p => p.name === name && !p.connected);
      if (!player) throw new Error('No disconnected player with that name');
      player.socketId = socket.id;
      player.connected = true;
      broadcastRoom(room);
      console.log(`${name} reconnected to room ${room.code}`);
    } catch (e) {
      socket.emit('error', e.message);
    }
  });

  // ===== PROFILE =====

  socket.on('getProfile', ({ name } = {}) => {
    const profile = getProfile(name);
    socket.emit('profile', profile);
  });

  socket.on('listProfiles', () => {
    socket.emit('profileList', listProfiles());
  });

  socket.on('updateProfile', ({ name, avatarSeed, avatarStyle, color } = {}) => {
    if (!name?.trim()) return;
    const profile = saveProfile({ name, avatarSeed, avatarStyle, color });
    socket.emit('profile', profile);
    // Also update in room if they're in one
    const room = manager.findRoomBySocket(socket.id);
    if (room) {
      if (!room.playerProfiles) room.playerProfiles = {};
      room.playerProfiles[name] = profile;
      broadcastRoom(room);
    }
  });

  // ===== CHAT =====

  socket.on('chatMessage', ({ message } = {}) => {
    try {
      if (!message?.trim()) return;
      const room = manager.findRoomBySocket(socket.id);
      if (!room) return;
      const player = room.getPlayerBySocket(socket.id);
      if (!player) return;
      const chatMsg = {
        from: player.name,
        fromIndex: player.index,
        text: message.trim(),
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      };
      room.chatHistory = room.chatHistory || [];
      room.chatHistory.push(chatMsg);
      // Keep last 200 messages
      if (room.chatHistory.length > 200) room.chatHistory = room.chatHistory.slice(-200);
      // Send to all connected players
      for (const p of room.players) {
        if (p.connected) {
          io.to(p.socketId).emit('chatMessage', chatMsg);
        }
      }
    } catch (e) {
      socket.emit('error', e.message);
    }
  });

  // ===== DISCONNECT =====

  socket.on('disconnect', () => {
    const room = manager.findRoomBySocket(socket.id);
    if (room) {
      room.removePlayer(socket.id);
      broadcastRoom(room);
      console.log(`Disconnected from room ${room.code}`);
      // Clean up empty rooms after 5 min
      setTimeout(() => manager.cleanup(), 5 * 60 * 1000);
    }
    console.log(`Disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
http.listen(PORT, '0.0.0.0', () => {
  console.log(`Big Two server running on port ${PORT}`);
});
