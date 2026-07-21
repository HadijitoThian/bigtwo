import { playCardSound, playTurnSound, playWinSound, playErrorSound, playTimerWarningSound, playClapSound, playLoserSound } from './sounds.js';
import { playDealAnimation } from './deal.js';

// ===== SOUND TOGGLE =====
let soundEnabled = true;
try {
  soundEnabled = localStorage.getItem('bigtwo_sound') !== 'off';
} catch {}
function toggleSound() {
  soundEnabled = !soundEnabled;
  try { localStorage.setItem('bigtwo_sound', soundEnabled ? 'on' : 'off'); } catch {}
  renderSoundBtn();
}
function renderSoundBtn() {
  const icon = soundEnabled ? '🔊' : '🔇';
  const btns = document.querySelectorAll('#sound-toggle-btn, #sound-toggle-btn-lobby');
  btns.forEach(b => b.textContent = icon);
}

// ===== TIMER =====
const TURN_TIME = 45; // seconds per turn
let timerInterval = null;
let timerSeconds = 0;
let timerRunning = false;

function startTimer() {
  clearTimer();
  timerSeconds = TURN_TIME;
  timerRunning = true;
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timerSeconds--;
    updateTimerDisplay();
    // Warning sound at 15 seconds
    if (timerSeconds === 15) {
      if (soundEnabled) playTimerWarningSound();
      const bar = $('timer-bar');
      if (bar) bar.classList.add('warning');
    }
    // Auto-pass at 0
    if (timerSeconds <= 0) {
      clearTimer();
      socket.emit('pass');
      selected.clear();
    }
  }, 1000);
}

function clearTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  timerRunning = false;
  timerSeconds = 0;
  const bar = $('timer-bar');
  if (bar) { bar.style.width = '0%'; bar.classList.remove('warning'); }
  $('timer-text').textContent = '';
}

function updateTimerDisplay() {
  const pct = (timerSeconds / TURN_TIME) * 100;
  const bar = $('timer-bar');
  if (bar) {
    bar.style.width = pct + '%';
    if (timerSeconds <= 5) bar.classList.add('critical');
    else bar.classList.remove('critical');
  }
  $('timer-text').textContent = timerSeconds + 's';
}

const socket = io({
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 3000,
  timeout: 15000,
});

let state = null;
let selected = new Set();
let hints = [];
let myName = '';
let lastRoomCode = null;
let lastPlayerName = null;

// Keep socket alive when tab is backgrounded (mobile/browser suspends JS)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (socket.disconnected) {
      console.log('Tab visible again, reconnecting...');
      socket.connect();
    }
    // Resume audio context if suspended
    try { audioCtx?.resume(); } catch {}
  }
  // Save reconnect data when leaving (use localStorage so it survives tab close)
  if (document.visibilityState === 'hidden') {
    try {
      if (lastRoomCode && lastPlayerName) {
        localStorage.setItem('bigtwo_room', lastRoomCode);
        localStorage.setItem('bigtwo_name', lastPlayerName);
      }
    } catch {}
  }
});

// On page load, check if we were in a room (localStorage survives browser restart)
(function restoreSession() {
  try {
    const savedRoom = localStorage.getItem('bigtwo_room');
    const savedName = localStorage.getItem('bigtwo_name');
    if (savedRoom && savedName) {
      lastRoomCode = savedRoom;
      lastPlayerName = savedName;
      myName = savedName;
      els.playerName.value = savedName;
    }
  } catch {}
})();

socket.on('connect', () => {
  console.log('Connected');
  // Auto-reconnect to room if we were in one (survives browser close/restart)
  if (lastRoomCode && lastPlayerName && !state?.code) {
    socket.emit('reconnect', { code: lastRoomCode, name: lastPlayerName });
    console.log('Auto-reconnecting to room ' + lastRoomCode + ' as ' + lastPlayerName);
  }
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  if (reason === 'io server disconnect') {
    showError('Server restarted. Automatically reconnecting...');
  } else if (reason === 'transport close' || reason === 'ping timeout') {
    // Auto-reconnect will handle this — keep localStorage for reconnect
    showError('Connection lost. Reconnecting...');
  }
  // Don't clear localStorage — player can still reconnect on page reload
});

const SUIT_SYMBOL = ['♦', '♣', '♥', '♠'];
const RANK_LABEL = {
  3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2'
};

// DiceBear avatar URL helpers
function avatarUrl(seed, style = 'bottts') {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&size=48`;
}
function avatarUrlBig(seed, style = 'bottts') {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&size=120`;
}

const AVATAR_STYLES = ['bottts', 'fun-emoji', 'identicon', 'initials', 'thumbs', 'pixel-art', 'lorelei'];

const $ = (id) => document.getElementById(id);

const els = {
  lobbyScreen: $('lobby-screen'),
  gameScreen: $('game-screen'),
  playerName: $('playerName'),
  roomCode: $('roomCode'),
  createRoomBtn: $('createRoomBtn'),
  joinRoomBtn: $('joinRoomBtn'),
  joinSection: $('join-section'),
  roomLobby: $('room-lobby'),
  displayCode: $('displayCode'),
  playerList: $('playerList'),
  hostControls: $('host-controls'),
  waitingHost: $('waiting-host'),
  totalRounds: $('totalRounds'),
  bet: $('bet'),
  startMatchBtn: $('startMatchBtn'),
  gameRoomCode: $('game-room-code'),
  roundIndicator: $('round-indicator'),
  cumulativeScores: $('cumulative-scores'),
  opponents: $('opponents'),
  turnIndicator: $('turn-indicator'),
  lastCardAlert: $('last-card-alert'),
  lastCardText: $('last-card-text'),
  tableCards: $('table-cards'),
  tableType: $('table-type'),
  playBtn: $('playBtn'),
  passBtn: $('passBtn'),
  hintBtn: $('hintBtn'),
  errorMsg: $('error-msg'),
  myName: $('my-name'),
  myCardCount: $('my-card-count'),
  myHand: $('my-hand'),
  stopMatchBtn: $('stopMatchBtn'),
  roundEndModal: $('round-end-modal'),
  roundEndNum: $('round-end-num'),
  roundEndBody: $('round-end-body'),
  nextRoundBtn: $('nextRoundBtn'),
  stopMatchBtn2: $('stopMatchBtn2'),
  matchEndModal: $('match-end-modal'),
  matchEndBody: $('match-end-body'),
  closeMatchEnd: $('closeMatchEnd'),
  // Chat
  chatMessages: $('chat-messages'),
  chatInput: $('chat-input'),
  chatSendBtn: $('chat-send-btn'),
  // Profile
  profileBtn: null,
  // Music
  copyCodeBtn: $('copyCodeBtn'),
};

// ===== LOBBY =====

els.createRoomBtn.onclick = () => {
  myName = els.playerName.value.trim();
  if (!myName) return showError('Enter your name');
  socket.emit('createRoom', { name: myName });
};

els.joinRoomBtn.onclick = () => {
  myName = els.playerName.value.trim();
  const code = els.roomCode.value.trim().toUpperCase();
  if (!myName) return showError('Enter your name');
  if (!code || code.length !== 4) return showError('Enter 4-letter room code');
  socket.emit('joinRoom', { code, name: myName });
};

els.startMatchBtn.onclick = () => {
  socket.emit('startMatch', {
    betPerPoint: parseInt(els.bet.value),
    totalRounds: parseInt(els.totalRounds.value),
  });
};

// ===== GAME ACTIONS =====

els.playBtn.onclick = () => {
  if (selected.size === 0) return;
  const indices = [...selected].sort((a, b) => a - b);
  if (soundEnabled) playCardSound();
  socket.emit('play', { cardIndices: indices });
  selected.clear();
};

els.passBtn.onclick = () => {
  socket.emit('pass');
  selected.clear();
};

els.hintBtn.onclick = () => socket.emit('hint');

els.nextRoundBtn.onclick = () => {
  socket.emit('nextRound');
  els.roundEndModal.classList.add('hidden');
};

els.stopMatchBtn.onclick = () => {
  if (confirm('Stop the match? All current scores will be final and the match will end for everyone. This cannot be undone.')) socket.emit('stopMatch');
};
els.stopMatchBtn2.onclick = () => {
  if (confirm('Stop the match? All current scores will be final and the match will end for everyone. This cannot be undone.')) {
    socket.emit('stopMatch');
    els.roundEndModal.classList.add('hidden');
  }
};

els.closeMatchEnd.onclick = () => {
  els.matchEndModal.classList.add('hidden');
  try {
    localStorage.removeItem('bigtwo_room');
    localStorage.removeItem('bigtwo_name');
  } catch {}
  lastRoomCode = null;
  lastPlayerName = null;
  state = null;
  render();
};

// Sound toggle (exposed globally for inline onclick)
window.toggleSound = () => {
  toggleSound();
};

// Reconnect button
$('reconnect-btn').onclick = () => {
  const name = myName || lastPlayerName;
  const code = lastRoomCode;
  if (name && code) {
    socket.emit('reconnect', { code, name });
    showError('Reconnecting...');
  } else {
    showError('No active room to reconnect to');
  }
  renderSoundBtn();
};

// ===== PROFILE =====

let profileData = null;
let selectedAvatarStyle = 'bottts';

const profileModal = $('profile-modal');
const profileNameField = $('profile-name-field');
const profileAvatarPreview = $('profile-avatar-preview');
const avatarStyleGrid = $('avatar-style-grid');
const saveProfileBtn = $('save-profile-btn');
const profileSettingsBtn = $('profile-settings-btn');

profileSettingsBtn.onclick = () => {
  profileNameField.value = myName || '';
  selectedAvatarStyle = profileData?.avatarStyle || 'bottts';
  renderAvatarStyles();
  updateProfilePreview();
  profileModal.classList.remove('hidden');
};

saveProfileBtn.onclick = () => {
  const name = profileNameField.value.trim();
  if (!name) return;
  myName = name;
  els.playerName.value = name;
  socket.emit('updateProfile', {
    name,
    avatarSeed: profileData?.avatarSeed || name,
    avatarStyle: selectedAvatarStyle,
    color: '#ffb300',
  });
  profileModal.classList.add('hidden');
};

function renderAvatarStyles() {
  avatarStyleGrid.innerHTML = '';
  const seed = profileData?.avatarSeed || myName || 'default';
  AVATAR_STYLES.forEach(style => {
    const div = document.createElement('div');
    div.className = 'avatar-style-option';
    if (style === selectedAvatarStyle) div.classList.add('selected');
    div.innerHTML = `<img src="${avatarUrl(seed, style)}" alt="${style}">`;
    div.title = style;
    div.onclick = () => {
      selectedAvatarStyle = style;
      renderAvatarStyles();
      updateProfilePreview();
    };
    avatarStyleGrid.appendChild(div);
  });
}

function updateProfilePreview() {
  const seed = profileData?.avatarSeed || myName || 'default';
  profileAvatarPreview.src = avatarUrlBig(seed, selectedAvatarStyle);
}

socket.on('profile', (p) => {
  if (p) profileData = p;
});

// Load profile on startup when name changes
const origCreateRoom = els.createRoomBtn.onclick;
els.createRoomBtn.onclick = () => {
  const name = els.playerName.value.trim();
  if (name) {
    socket.emit('getProfile', { name });
    myName = name;
  }
  origCreateRoom();
};

const origJoinRoom = els.joinRoomBtn.onclick;
els.joinRoomBtn.onclick = () => {
  const name = els.playerName.value.trim();
  if (name) {
    socket.emit('getProfile', { name });
    myName = name;
  }
  origJoinRoom();
};

// Update avatar display in lobby player list
// ===== CHAT =====

els.chatSendBtn.onclick = () => {
  const msg = els.chatInput.value.trim();
  if (!msg) return;
  socket.emit('chatMessage', { message: msg });
  els.chatInput.value = '';
};
els.chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') els.chatSendBtn.click();
});

// ===== CHAT MOBILE TOGGLE =====
$('chat-toggle-btn').onclick = () => {
  $('chat-sidebar').classList.add('open');
  $('chat-toggle-btn').style.display = 'none';
};
$('chat-close-btn').onclick = () => {
  $('chat-sidebar').classList.remove('open');
  $('chat-toggle-btn').style.display = '';
};
// On desktop, ensure chat is visible
if (window.innerWidth >= 769) {
  $('chat-sidebar').style.display = 'flex';
}

socket.on('chatMessage', (msg) => {
  if (!msg) return;
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.innerHTML = `
    <span class="chat-sender p${msg.fromIndex}">${msg.from}</span>
    <span class="chat-time">${msg.time}</span><br>
    <span class="chat-text">${msg.text}</span>
  `;
  els.chatMessages.appendChild(div);
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
});

// ===== SOCKET EVENTS =====

socket.on('state', (s) => {
  const prevState = state?.state;
  const prevPlayer = state?.game?.currentPlayer;
  const prevMyIdx = state?.game?.myIndex;
  const prevRound = state?.currentRound;
  state = s;
  // Remember room code for reconnect (survives browser crash)
  if (s.code) {
    lastRoomCode = s.code;
    lastPlayerName = myName;
    try {
      localStorage.setItem('bigtwo_room', s.code);
      localStorage.setItem('bigtwo_name', myName);
    } catch {}
  }
  selected.clear();
  hints = [];

  // ===== SOUNDS =====
  if (soundEnabled) {
    const g = s.game;
    const prevG = prevState ? state?.game : null;
    // Round winner detected (game just finished)
    if (g?.state === 'FINISHED' && prevState === 'PLAYING') {
      // Clap for winner
      playClapSound();
      // Loser sound if anyone still has full hand (never played)
      const result = g?.result;
      if (result) {
        const numPlayers = s.numPlayers || 4;
        const fullHandCount = numPlayers === 3 ? 17 : 13;
        result.leftoverHands?.forEach((hand, idx) => {
          if (idx !== g.winner && hand.length >= fullHandCount) {
            setTimeout(() => playLoserSound(), 800);
          }
        });
      }
    }
    // Error from server
    // My turn just started
    if (g?.state === 'PLAYING' && g?.myIndex === g?.currentPlayer &&
        (prevMyIdx !== g?.currentPlayer || !prevG)) {
      playTurnSound();
    }
  }

  // ===== TIMER =====
  const g = s.game;
  if (g?.state === 'PLAYING' && g?.myIndex === g?.currentPlayer && g?.tablePlay !== null) {
    // My turn, table has a play to beat → start timer
    if (!timerRunning || prevMyIdx !== g?.currentPlayer) {
      startTimer();
    }
  } else if (g?.state === 'PLAYING' && g?.myIndex === g?.currentPlayer && g?.tablePlay === null) {
    // Free play — start timer
    if (!timerRunning) startTimer();
  } else {
    // Not my turn → clear timer
    clearTimer();
  }

  render();

  // ===== DEAL ANIMATION =====
  // Trigger on: first round (lobby -> playing) or new round (round_end -> playing)
  const isNewRound = (s.state === 'PLAYING' && s.currentRound > 0) &&
                      (prevState === 'LOBBY' || prevState === 'ROUND_END');
  const isFirstPlay = s.state === 'PLAYING' && s.currentRound === 1 && prevState === 'LOBBY';

  if ((isNewRound || isFirstPlay) && s.playerNames && s.playerNames.length >= 2) {
    const names = s.playerNames;
    const count = s.playerNames.length;
    playDealAnimation(names, count, () => {
      render();
    });
  }

  // Show modals on transitions
  if (state.state === 'ROUND_END' && prevState !== 'ROUND_END') {
    renderRoundEnd();
  }
  if (state.state === 'FINISHED' && prevState !== 'FINISHED') {
    renderMatchEnd();
  }
});

socket.on('error', (msg) => showError(msg));

socket.on('hints', (h) => {
  hints = h;
  if (h.length > 0) selected = new Set(h[0].indices);
  render();
});

function showError(msg) {
  if (soundEnabled) playErrorSound();
  // Show in lobby error if visible, otherwise game error
  const lobbyError = $('lobby-error');
  if (lobbyError && lobbyError.offsetParent !== null) {
    lobbyError.textContent = msg;
    setTimeout(() => { lobbyError.textContent = ''; }, 3500);
  }
  els.errorMsg.textContent = msg;
  setTimeout(() => { els.errorMsg.textContent = ''; }, 3500);
}

// ===== RENDER =====

function cardEl(c, idx, opts = {}) {
  const div = document.createElement('div');
  div.className = 'card';
  if (c.suit === 0 || c.suit === 2) div.classList.add('red');

  const rank = document.createElement('div');
  rank.className = 'rank';
  rank.textContent = RANK_LABEL[c.rank];
  const suit = document.createElement('div');
  suit.className = 'suit';
  suit.textContent = SUIT_SYMBOL[c.suit];
  div.appendChild(rank);
  div.appendChild(suit);

  if (opts.selectable) {
    div.classList.add('selectable');
    if (selected.has(idx)) div.classList.add('selected');
    if (hints.some(h => h.indices.includes(idx))) div.classList.add('hint');
    div.onclick = () => {
      if (selected.has(idx)) selected.delete(idx);
      else selected.add(idx);
      render();
    };
  } else {
    div.classList.add('not-selectable');
  }
  return div;
}

function render() {
  if (!state || state.state === 'NO_ROOM') {
    els.lobbyScreen.classList.remove('hidden');
    els.gameScreen.classList.add('hidden');
    els.joinSection.classList.remove('hidden');
    els.roomLobby.classList.add('hidden');
    return;
  }

  // In lobby (room created/joined, match not started)
  if (state.matchState === 'LOBBY' || state.state === 'LOBBY') {
    els.lobbyScreen.classList.remove('hidden');
    els.gameScreen.classList.add('hidden');
    els.joinSection.classList.add('hidden');
    els.roomLobby.classList.remove('hidden');

    els.displayCode.textContent = state.code;
    els.playerList.innerHTML = '';
    state.players.forEach((p, i) => {
      const div = document.createElement('div');
      div.className = 'player-item';
      const profile = p.profile || {};
      const avaUrl = avatarUrl(profile.avatarSeed || p.name, profile.avatarStyle || 'bottts');
      div.innerHTML = `
        <img src="${avaUrl}" class="player-avatar" alt="">
        <span>${p.name}</span>
        ${i === 0 ? '<span class="host-badge">host</span>' : ''}
        <span class="status ${p.connected ? 'online' : 'offline'}">${p.connected ? '●' : '○'}</span>
      `;
      els.playerList.appendChild(div);
    });

    // Show host controls if I'm the first player
    const myIndex = state.players.findIndex(p => p.name === myName);
    if (myIndex === 0) {
      els.hostControls.classList.remove('hidden');
      els.waitingHost.classList.add('hidden');
    } else {
      els.hostControls.classList.add('hidden');
      els.waitingHost.classList.remove('hidden');
    }
    return;
  }

  // In game
  els.lobbyScreen.classList.add('hidden');
  els.gameScreen.classList.remove('hidden');

  const g = state.game;
  if (!g) return;

  const names = state.playerNames;
  const myIdx = g.myIndex;
  const isMyTurn = g.currentPlayer === myIdx && g.state === 'PLAYING';
  const isPlaying = g.state === 'PLAYING';

  els.gameRoomCode.textContent = state.code;
  els.roundIndicator.textContent = `Round ${state.currentRound} / ${state.totalRounds}`;

  // Cumulative scores
  els.cumulativeScores.innerHTML = '';
  names.forEach((name, i) => {
    const pts = state.cumulativePoints[i];
    const div = document.createElement('div');
    div.className = 'score-item';
    const cls = pts >= 0 ? 'positive' : 'negative';
    div.innerHTML = `<div class="name">${name}</div><div class="pts ${cls}">${pts >= 0 ? '+' : ''}${pts}</div>`;
    els.cumulativeScores.appendChild(div);
  });

  // Opponents (everyone except me)
  els.opponents.innerHTML = '';
  names.forEach((name, i) => {
    if (i === myIdx) return;
    const div = document.createElement('div');
    div.className = 'opponent';
    if (isPlaying && i === g.currentPlayer) div.classList.add('active');
    if (g.passed.includes(i)) div.classList.add('passed');

    const playerInfo = state.players.find(p => p.index === i);
    const isConnected = playerInfo ? playerInfo.connected : true;
    const profile = playerInfo?.profile || {};
    const avaUrl = avatarUrl(profile.avatarSeed || name, profile.avatarStyle || 'bottts');

    let badges = '';
    if (g.passed.includes(i)) badges += '<span class="badge pass">passed</span>';
    if (g.handCounts[i] === 1 && isPlaying) badges += '<span class="badge last-card">last card!</span>';
    if (!isConnected) badges += '<span class="badge disconnected">offline</span>';
    if (g.state === 'FINISHED' && i === g.winner) badges += '<span class="badge">🏆</span>';

    div.innerHTML = `
      <img src="${avaUrl}" class="opponent-avatar" alt="">
      <div class="opp-name">${name}</div>
      <div class="opp-count">${g.handCounts[i]}</div>
      <div class="opp-badges">${badges}</div>
    `;
    els.opponents.appendChild(div);
  });

  // Turn indicator
  if (isPlaying) {
    const turnName = names[g.currentPlayer];
    const isFreePlay = g.tablePlay === null;
    els.turnIndicator.textContent = isMyTurn
      ? (isFreePlay ? 'Your turn — free play' : 'Your turn')
      : `${turnName}'s turn`;
  } else if (g.state === 'FINISHED') {
    els.turnIndicator.textContent = `🏆 ${names[g.winner]} wins round ${state.currentRound}!`;
  }

  // Last card alert
  if (g.lastCardAnnouncer !== null && g.lastCardAnnouncer !== undefined && isPlaying) {
    const announcer = names[g.lastCardAnnouncer];
    const isTarget = g.lastCardRuleTarget === myIdx;
    els.lastCardText.textContent = isTarget
      ? `${announcer} has 1 card left! You must play highest single or multi-combo.`
      : `${announcer} has 1 card left!`;
    els.lastCardAlert.classList.remove('hidden');
    els.lastCardAlert.classList.toggle('rule-target', isTarget);
  } else {
    els.lastCardAlert.classList.add('hidden');
  }

  // Table play
  els.tableCards.innerHTML = '';
  if (g.tablePlayCards) {
    g.tablePlayCards.forEach(c => els.tableCards.appendChild(cardEl(c, -1)));
    els.tableType.textContent = `${g.tablePlayType} by ${names[g.tablePlayBy]}`;
  } else {
    els.tableType.textContent = isPlaying ? 'Free play — any valid combination' : '';
  }

  // Buttons
  els.playBtn.disabled = !isMyTurn || selected.size === 0;
  els.passBtn.disabled = !isMyTurn || g.tablePlay === null;
  els.hintBtn.disabled = !isMyTurn;

  // My hand
  els.myName.textContent = myName + (isMyTurn ? ' (your turn)' : '');
  els.myCardCount.textContent = `${g.hand ? g.hand.length : 0} cards`;
  els.myHand.innerHTML = '';
  if (g.hand) {
    g.hand.forEach((c, cIdx) => {
      els.myHand.appendChild(cardEl(c, cIdx, { selectable: isMyTurn }));
    });
  }
}

function renderRoundEnd() {
  const g = state.game;
  const r = g.result;
  const names = state.playerNames;

  els.roundEndNum.textContent = state.currentRound;

  let html = `<p><strong>${names[r.winnerIndex]}</strong> wins with bonus <strong>+${r.winnerBonus}</strong> pts`;
  if (r.penalizedPlayer !== null) {
    html += ` • <span style="color:#ef5350">${names[r.penalizedPlayer]} penalized +50</span>`;
  }
  html += `</p>`;

  html += `<div class="section-title">Round ${state.currentRound} Result</div>`;
  html += `<table><tr><th>Player</th><th>Net Points</th><th>Money</th></tr>`;
  r.netPoints.forEach((n, i) => {
    const cls = n >= 0 ? 'positive' : 'negative';
    html += `<tr><td>${names[i]}${i === r.winnerIndex ? ' 🏆' : ''}</td>
      <td class="${cls}">${n >= 0 ? '+' : ''}${n}</td>
      <td class="${cls}">${n >= 0 ? '+' : '−'}${Math.abs(r.money[i]).toLocaleString('id-ID')}</td></tr>`;
  });
  html += `</table>`;

  html += `<div class="section-title">Cumulative (after ${state.currentRound} rounds)</div>`;
  html += `<table><tr><th>Player</th><th>Total Points</th><th>Total Money</th></tr>`;
  state.cumulativePoints.forEach((n, i) => {
    const cls = n >= 0 ? 'positive' : 'negative';
    html += `<tr><td>${names[i]}</td>
      <td class="${cls}">${n >= 0 ? '+' : ''}${n}</td>
      <td class="${cls}">${n >= 0 ? '+' : '−'}${Math.abs(state.cumulativeMoney[i]).toLocaleString('id-ID')}</td></tr>`;
  });
  html += `</table>`;

  els.roundEndBody.innerHTML = html;
  els.roundEndModal.classList.remove('hidden');
}

function renderMatchEnd() {
  const names = state.playerNames;
  const bet = state.betPerPoint || 10000;
  els.roundEndModal.classList.add('hidden');

  let html = `<div class="match-end-header">
    <h2>Match Finished</h2>
    <p class="match-end-meta">${state.currentRound} of ${state.totalRounds} rounds | ${bet.toLocaleString('id-ID')} / pt</p>
  </div>`;

  // --- FINAL STANDINGS ---
  html += `<div class="section-title">Final Standings</div>`;
  html += `<table class="standings-table"><tr><th>Rank</th><th>Player</th><th>Points</th><th>Money</th></tr>`;

  const standings = names.map((name, i) => ({
    name, pts: state.cumulativePoints[i], money: state.cumulativeMoney[i],
  })).sort((a, b) => b.pts - a.pts);

  standings.forEach((s, rank) => {
    const cls = s.pts >= 0 ? 'positive' : 'negative';
    const medal = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `${rank + 1}.`;
    html += `<tr><td class="rank-col">${medal}</td><td>${s.name}</td>
      <td class="${cls}">${s.pts >= 0 ? '+' : ''}${s.pts}</td>
      <td class="${cls}">${s.pts >= 0 ? '+' : '−'}${Math.abs(s.money).toLocaleString('id-ID')}</td></tr>`;
  });
  html += `</table>`;

  // --- PER-ROUND BREAKDOWN ---
  if (state.roundHistory.length > 0) {
    const rLen = state.roundHistory.length;
    const rHist = state.roundHistory;

    // Build per-round detail including settlement calculations
    rHist.forEach((h, hi) => {
      const result = h.result;
      if (!result) return;

      html += `<div class="section-title">Round ${h.round} — ${names[h.winner]} wins 🏆</div>`;

      // Player leftover cards & base scores
      html += `<table><tr><th>Player</th><th>Leftover</th><th>Score</th></tr>`;
      const leftoverCards = result.leftoverHands || [];
      const scores = result.scores || [];
      let baseCount = 0;
      let twosCount = 0;

      names.forEach((name, i) => {
        const numLeft = leftoverCards[i] ? leftoverCards[i].length : (names.length === 3 ? 17 : 13);
        const score = scores[i] || 0;
        let label = numLeft + ' cards';
        // Count twos
        if (leftoverCards[i]) {
          const twosOnly = leftoverCards[i].filter(c => c.rank === 15);
          if (twosOnly.length > 0) {
            label += ' (' + twosOnly.length + 'x 2 = ' + (twosOnly.length * 10) + ')';
          }
        }
        const isWinner = i === h.winner && numLeft === 0;
        if (isWinner) label = '0 (winner!)';
        html += `<tr>
          <td>${name}${isWinner ? ' 🏆' : ''}</td>
          <td>${label}</td>
          <td class="${score > 0 ? 'negative' : ''}">${score}</td>
        </tr>`;
      });

      // Winner bonus
      const bonus = result.winnerBonus || (result.winnerIndex !== null ? (result.scores ? 20 : 10) : 20);
      html += `<tr><td colspan="3" style="font-size:11px;color:#ffd54f">
        Winner bonus: +${bonus} pts
        ${result.penalizedPlayer !== null ? ' • ' + names[result.penalizedPlayer] + ' penalized +50 pts' : ''}
      </td></tr>`;
      html += `</table>`;

      // Settlement — head to head
      if (result.transactions && result.transactions.length > 0) {
        html += `<div style="font-weight:bold;color:#ffd54f;font-size:12px;margin-top:10px">Settlement</div>`;
        html += `<table><tr><th>From</th><th>To</th><th>Points</th><th>Money</th></tr>`;
        result.transactions.forEach(t => {
          const pts = t.points;
          const money = pts * bet;
          html += `<tr>
            <td>${names[t.from]}</td>
            <td>${names[t.to]}</td>
            <td>${pts}</td>
            <td class="negative">${money.toLocaleString('id-ID')}</td>
          </tr>`;
        });
        html += `</table>`;
      }

      // Net for this round
      html += `<table><tr><th>Player</th><th>Net Points</th><th>Net Money</th></tr>`;
      const netPts = result.netPoints || [];
      const netMoney = result.money || [];
      names.forEach((name, i) => {
        const n = netPts[i] || 0;
        const m = netMoney[i] || 0;
        const cls = n >= 0 ? 'positive' : 'negative';
        html += `<tr>
          <td>${name}</td>
          <td class="${cls}">${n >= 0 ? '+' : ''}${n}</td>
          <td class="${cls}">${n >= 0 ? '+' : '−'}${Math.abs(m).toLocaleString('id-ID')}</td>
        </tr>`;
      });
      html += `</table>`;
    });

    // Cumulative table (all rounds combined)
    html += `<div class="section-title">Cumulative (All Rounds)</div>`;
    html += `<table><tr><th>Player</th><th>Total Points</th><th>Total Money</th></tr>`;
    state.cumulativePoints.forEach((n, i) => {
      const cls = n >= 0 ? 'positive' : 'negative';
      const m = state.cumulativeMoney[i] || 0;
      html += `<tr><td>${names[i]}</td>
        <td class="${cls}">${n >= 0 ? '+' : ''}${n}</td>
        <td class="${cls}">${n >= 0 ? '+' : '−'}${Math.abs(m).toLocaleString('id-ID')}</td></tr>`;
    });
    html += `</table>`;
  }

  html += `<div class="match-end-footer">
    <button id="matchEndReturnBtn">Return to Lobby</button>
  </div>`;

  els.matchEndBody.innerHTML = html;
  els.matchEndModal.classList.remove('hidden');

  // Wire return button
  setTimeout(() => {
    const btn = $('matchEndReturnBtn');
    if (btn) {
      btn.onclick = () => {
        els.matchEndModal.classList.add('hidden');
        // Clear localStorage so they don't auto-reconnect to finished match
        try {
          localStorage.removeItem('bigtwo_room');
          localStorage.removeItem('bigtwo_name');
        } catch {}
        lastRoomCode = null;
        lastPlayerName = null;
        state = null;
        render();
      };
    }
  }, 100);
}

render();
renderSoundBtn();

// ===== LOBBY MUSIC =====
let musicAudio = null;
let musicEnabled = true;
try { musicEnabled = localStorage.getItem('bigtwo_music') !== 'off'; } catch {}

function startLobbyMusic() {
  if (musicAudio) return;
  try {
    musicAudio = new Audio('/audio/lobby.mp3');
    musicAudio.loop = true;
    musicAudio.volume = musicEnabled ? 0.15 : 0;
    // play() returns a promise — must be called during user interaction context
    const playPromise = musicAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch((e) => {
        // Browser blocked autoplay even after click — retry
        console.warn('Music autoplay blocked:', e);
        musicAudio = null;
      });
    }
  } catch {
    musicAudio = null;
  }
}

function stopLobbyMusic() {
  if (musicAudio) {
    musicAudio.pause();
    musicAudio = null;
  }
}

window.toggleMusic = () => {
  musicEnabled = !musicEnabled;
  try { localStorage.setItem('bigtwo_music', musicEnabled ? 'on' : 'off'); } catch {}
  if (musicAudio) {
    musicAudio.volume = musicEnabled ? 0.15 : 0;
  }
  renderMusicBtn();
};

function renderMusicBtn() {
  const icon = musicEnabled ? '🎵' : '🔇';
  document.querySelectorAll('#music-toggle-btn-lobby').forEach(b => b.textContent = icon);
}

let musicStarted = false;
document.addEventListener('click', () => { if(!musicStarted){musicStarted=true;startLobbyMusic();} }, {once:true});
document.addEventListener('keydown', () => { if(!musicStarted){musicStarted=true;startLobbyMusic();} }, {once:true});
renderMusicBtn();
