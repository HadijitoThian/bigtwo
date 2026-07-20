const socket = io();

let state = null;
let selected = new Set();
let hints = [];
let myName = '';

const SUIT_SYMBOL = ['♦', '♣', '♥', '♠'];
const RANK_LABEL = {
  3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2'
};

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
      div.innerHTML = `
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

    let badges = '';
    if (g.passed.includes(i)) badges += '<span class="badge pass">passed</span>';
    if (g.handCounts[i] === 1 && isPlaying) badges += '<span class="badge last-card">last card!</span>';
    if (!isConnected) badges += '<span class="badge disconnected">offline</span>';
    if (g.state === 'FINISHED' && i === g.winner) badges += '<span class="badge">🏆</span>';

    div.innerHTML = `
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
