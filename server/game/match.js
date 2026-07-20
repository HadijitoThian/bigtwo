// Match manager — multi-round with carry-forward scoring

import { BigTwoGame, GAME_STATE } from './engine.js';

export const MATCH_STATE = {
  WAITING: 'WAITING',
  PLAYING: 'PLAYING',     // a round is in progress
  ROUND_END: 'ROUND_END', // between rounds
  FINISHED: 'FINISHED',   // match complete (all rounds or stopped early)
};

export const ROUND_OPTIONS = [12, 16, 18];

export class BigTwoMatch {
  constructor({ numPlayers = 4, betPerPoint = 10000, totalRounds = 12, playerNames = [] } = {}) {
    if (!ROUND_OPTIONS.includes(totalRounds)) {
      throw new Error(`totalRounds must be one of ${ROUND_OPTIONS.join(', ')}`);
    }
    this.numPlayers = numPlayers; // support 2-4 players
    // Note: 2-player mode works but the game is designed for 3-4
    if (numPlayers < 2 || numPlayers > 4) {
      throw new Error('Only 2-4 players supported');
    }
    this.betPerPoint = betPerPoint;
    this.totalRounds = totalRounds;
    this.playerNames = playerNames.length === numPlayers
      ? playerNames
      : Array.from({ length: numPlayers }, (_, i) => `Player ${i + 1}`);

    this.state = MATCH_STATE.WAITING;
    this.currentRound = 0;          // 1-indexed once started
    this.game = null;               // current BigTwoGame instance
    this.cumulativePoints = new Array(numPlayers).fill(0);
    this.cumulativeMoney = new Array(numPlayers).fill(0);
    this.roundHistory = [];         // [{ round, winner, result }]
    this.lastWinner = null;         // starter for next round
  }

  start() {
    this.state = MATCH_STATE.PLAYING;
    this.currentRound = 0;
    this.cumulativePoints = new Array(this.numPlayers).fill(0);
    this.cumulativeMoney = new Array(this.numPlayers).fill(0);
    this.roundHistory = [];
    this.lastWinner = null;
    this._startNextRound();
    return this.getState();
  }

  _startNextRound() {
    this.currentRound++;
    const options = {};
    // Round 2+: previous winner starts
    if (this.lastWinner !== null) {
      options.starterIndex = this.lastWinner;
    }
    this.game = new BigTwoGame(this.numPlayers, this.betPerPoint, options);
    for (let i = 0; i < this.numPlayers; i++) {
      this.game.addPlayer(`p${i}`, this.playerNames[i]);
    }
    this.game.start();
    this.state = MATCH_STATE.PLAYING;
  }

  // Proxy play/pass to current game, detect round end
  play(playerIndex, cardIndices) {
    if (this.state !== MATCH_STATE.PLAYING) throw new Error('No round in progress');
    const result = this.game.play(playerIndex, cardIndices);
    this._checkRoundEnd();
    return result;
  }

  pass(playerIndex) {
    if (this.state !== MATCH_STATE.PLAYING) throw new Error('No round in progress');
    const result = this.game.pass(playerIndex);
    this._checkRoundEnd();
    return result;
  }

  _checkRoundEnd() {
    if (this.game.state === GAME_STATE.FINISHED) {
      // Accumulate
      const r = this.game.result;
      for (let i = 0; i < this.numPlayers; i++) {
        this.cumulativePoints[i] += r.netPoints[i];
        this.cumulativeMoney[i] += r.money[i];
      }
      this.roundHistory.push({
        round: this.currentRound,
        winner: this.game.winner,
        result: r,
      });
      this.lastWinner = this.game.winner;

      if (this.currentRound >= this.totalRounds) {
        this.state = MATCH_STATE.FINISHED;
      } else {
        this.state = MATCH_STATE.ROUND_END;
      }
    }
  }

  // Advance to next round (called by user)
  nextRound() {
    if (this.state !== MATCH_STATE.ROUND_END) {
      throw new Error('Not between rounds');
    }
    this._startNextRound();
    return this.getState();
  }

  // Stop match early
  stopMatch() {
    if (this.state === MATCH_STATE.FINISHED) return;
    this.state = MATCH_STATE.FINISHED;
    return this.getState();
  }

  getState() {
    return {
      state: this.state,
      numPlayers: this.numPlayers,
      betPerPoint: this.betPerPoint,
      totalRounds: this.totalRounds,
      currentRound: this.currentRound,
      playerNames: this.playerNames,
      cumulativePoints: [...this.cumulativePoints],
      cumulativeMoney: [...this.cumulativeMoney],
      roundHistory: this.roundHistory.map(h => ({
        round: h.round,
        winner: h.winner,
        netPoints: h.result.netPoints,
        money: h.result.money,
        penalizedPlayer: h.result.penalizedPlayer,
      })),
      game: this.game ? this.game.getState() : null,
      lastWinner: this.lastWinner,
    };
  }
}
