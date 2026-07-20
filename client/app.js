const socket = io();

let state = null;
let selected = new Set();
let hints = [];
let myName = '';
let lastRoomCode = null;

socket.on('connect', () => {
  console.log('Connected');
});

socket.on('disconnect', (reason) => {
  if (reason === 'io server disconnect' || reason === 'transport close') {
    showError('Server connection lost. The server may be restarting (code deploy). Refresh and rejoin.');
  }
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
  if (confirm('Stop the match? Current standings are final.')) socket.emit('stopMatch');
};
els.stopMatchBtn2.onclick = () => {
  if (confirm('Stop the match? Current standings are final.')) {
    socket.emit('stopMatch');
    els.roundEndModal.classList.add('hidden');
  }
};

els.closeMatchEnd.onclick = () => els.matchEndModal.classList.add('hidden');

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
  state = s;
  selected.clear();
  hints = [];
  render();

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
  els.roundEndModal.classList.add('hidden');

  let html = `<p>Match ended after <strong>${state.currentRound}</strong> of ${state.totalRounds} rounds.</p>`;
  html += `<div class="section-title">Final Standings</div>`;
  html += `<table><tr><th>Rank</th><th>Player</th><th>Total Points</th><th>Total Money</th></tr>`;

  const standings = names.map((name, i) => ({
    name, pts: state.cumulativePoints[i], money: state.cumulativeMoney[i],
  })).sort((a, b) => b.pts - a.pts);

  standings.forEach((s, rank) => {
    const cls = s.pts >= 0 ? 'positive' : 'negative';
    const medal = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `${rank + 1}.`;
    html += `<tr><td>${medal}</td><td>${s.name}</td>
      <td class="${cls}">${s.pts >= 0 ? '+' : ''}${s.pts}</td>
      <td class="${cls}">${s.pts >= 0 ? '+' : '−'}${Math.abs(s.money).toLocaleString('id-ID')}</td></tr>`;
  });
  html += `</table>`;

  if (state.roundHistory.length > 0) {
    html += `<div class="section-title">Round History</div>`;
    html += `<table><tr><th>Round</th><th>Winner</th><th>Net Points</th></tr>`;
    state.roundHistory.forEach(h => {
      const ptsStr = h.netPoints.map(n => (n >= 0 ? '+' : '') + n).join(' / ');
      html += `<tr><td>${h.round}</td><td>${names[h.winner]}</td><td style="font-size:12px">${ptsStr}</td></tr>`;
    });
    html += `</table>`;
  }

  els.matchEndBody.innerHTML = html;
  els.matchEndModal.classList.remove('hidden');
}

render();
