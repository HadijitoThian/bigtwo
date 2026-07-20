// Game engine — state machine for a single round of Big Two
// Includes last-card rule + penalty tracking

import { createDeck, shuffle, deal, findStarter, compareCards, SUIT } from './deck.js';
import { identifyPlay, canBeat, PLAY_TYPE } from './validator.js';
import { settleFaceToFace, netPoints, toMoney } from './scoring.js';

export const GAME_STATE = {
  WAITING: 'WAITING',
  PLAYING: 'PLAYING',
  FINISHED: 'FINISHED',
};

export class BigTwoGame {
  /**
   * @param numPlayers 3 or 4
   * @param betPerPoint money per point
   * @param options.rng RNG function
   * @param options.starterIndex player index who starts (overrides 3♦ rule for round 2+)
   */
  constructor(numPlayers = 4, betPerPoint = 10000, options = {}) {
    if (numPlayers < 2 || numPlayers > 4) {
      throw new Error('Only 2-4 players supported');
    }
    this.numPlayers = numPlayers;
    this.betPerPoint = betPerPoint;
    this.rng = options.rng || Math.random;
    this.starterIndex = options.starterIndex ?? null; // null = use 3♦ rule
    this.state = GAME_STATE.WAITING;
    this.players = [];
    this.hands = [];
    this.burned = [];
    this.currentPlayer = 0;
    this.tablePlay = null;
    this.tablePlayBy = null;
    this.passed = new Set();
    this.lastPlayCards = null;
    this.winner = null;
    this.result = null;
    this.isFirstPlay = true;

    // Last-card rule state
    this.lastCardAnnouncer = null;   // player index with 1 card left
    this.lastCardRuleTarget = null;  // player index under the rule
    this.lastCardViolation = null;   // player index who violated (pending penalty)
  }

  addPlayer(id, name) {
    if (this.players.length >= this.numPlayers) throw new Error('Game full');
    if (this.state !== GAME_STATE.WAITING) throw new Error('Game already started');
    this.players.push({ id, name });
    return this.players.length - 1;
  }

  start() {
    if (this.players.length !== this.numPlayers) {
      throw new Error(`Need ${this.numPlayers} players, have ${this.players.length}`);
    }
    const deck = shuffle(createDeck(), this.rng);
    const { hands, burned } = deal(deck, this.numPlayers);
    this.hands = hands;
    this.burned = burned;

    if (this.starterIndex !== null) {
      // Round 2+: previous winner starts with any play
      this.currentPlayer = this.starterIndex;
      this.isFirstPlay = false; // no 3♦ requirement
    } else {
      // Round 1: 3♦ holder starts
      this.currentPlayer = findStarter(hands);
      this.isFirstPlay = true;
    }

    this.state = GAME_STATE.PLAYING;
    this.tablePlay = null;
    this.tablePlayBy = null;
    this.passed = new Set();
    return this.getState();
  }

  getState(forPlayerIndex = null) {
    return {
      state: this.state,
      numPlayers: this.numPlayers,
      currentPlayer: this.currentPlayer,
      tablePlay: this.tablePlay,
      tablePlayBy: this.tablePlayBy,
      passed: [...this.passed],
      handCounts: this.hands.map(h => h.length),
      hand: forPlayerIndex !== null ? this.hands[forPlayerIndex] : null,
      winner: this.winner,
      result: this.result,
      isFirstPlay: this.isFirstPlay,
      lastCardAnnouncer: this.lastCardAnnouncer,
      lastCardRuleTarget: this.lastCardRuleTarget,
      lastCardViolation: this.lastCardViolation,
    };
  }

  play(playerIndex, cardIndices) {
    this._assertPlaying();
    this._assertCurrentPlayer(playerIndex);

    if (this.passed.has(playerIndex)) {
      throw new Error('You have passed this trick');
    }

    const hand = this.hands[playerIndex];
    const cards = cardIndices.map(i => hand[i]);
    const play = identifyPlay(cards);

    if (!play) throw new Error('Invalid combination');

    // First play of round 1 must include 3♦
    if (this.isFirstPlay) {
      const hasStarter = this.hands.some(h => h.some(c => c.rank === 3 && c.suit === SUIT.DIAMOND));
      if (hasStarter) {
        const includes3D = cards.some(c => c.rank === 3 && c.suit === SUIT.DIAMOND);
        if (!includes3D) throw new Error('First play must include 3♦');
      }
    }

    // Must beat current table play
    if (!canBeat(play, this.tablePlay)) {
      throw new Error('Play does not beat current table play');
    }

    // ===== LAST-CARD RULE VALIDATION =====
    // If this player is the rule target and playing a single, it must be their highest
    if (this.lastCardRuleTarget === playerIndex && play.type === PLAY_TYPE.SINGLE) {
      const highest = this._getHighestSingle(hand);
      const playedCard = cards[0];
      if (compareCards(playedCard, highest) !== 0) {
        // Check if the highest single could have beaten the table
        const highestPlay = identifyPlay([highest]);
        if (canBeat(highestPlay, this.tablePlay)) {
          // Violation! Mark it (penalty applied if announcer wins next)
          this.lastCardViolation = playerIndex;
        }
        // If highest couldn't beat table anyway, no violation
      }
    }

    // Remove cards from hand
    const sortedIndices = [...cardIndices].sort((a, b) => b - a);
    for (const i of sortedIndices) hand.splice(i, 1);

    this.tablePlay = play;
    this.tablePlayBy = playerIndex;
    this.lastPlayCards = cards;
    this.isFirstPlay = false;
    // NOTE: Do NOT clear passes here — they clear only when trick ends (in pass())

    // Check win
    if (hand.length === 0) {
      this._finish(playerIndex);
      return this.getState();
    }

    // ===== UPDATE LAST-CARD STATE =====
    this._updateLastCardState(playerIndex);

    this._advance();
    return this.getState();
  }

  pass(playerIndex) {
    this._assertPlaying();
    this._assertCurrentPlayer(playerIndex);

    if (this.tablePlay === null) {
      throw new Error('Cannot pass on a free play — you must play');
    }

    this.passed.add(playerIndex);

    // If the rule target passes, they can't beat the table → no violation
    if (this.lastCardRuleTarget === playerIndex) {
      // Explicitly no violation — they couldn't play
    }

    // Check if trick is over
    const passersNeeded = this.numPlayers - 1;
    if (this.passed.size >= passersNeeded) {
      this.currentPlayer = this.tablePlayBy;
      this.tablePlay = null;
      this.tablePlayBy = null;
      this.passed.clear();
      // Trick ended — if announcer still has 1 card, rule persists
      // (target recalculated on next play)
    } else {
      this._advance();
    }

    return this.getState();
  }

  // After a play, update last-card announcer/target
  _updateLastCardState(justPlayedIndex) {
    const justPlayedHandSize = this.hands[justPlayedIndex].length;

    // If there was a violation pending and the announcer is about to change,
    // preserve the violation — the original announcer might still win next turn
    const hadViolation = this.lastCardViolation !== null;
    const previousAnnouncer = this.lastCardAnnouncer;

    // Check if the player who just played now has 1 card
    if (justPlayedHandSize === 1) {
      // Don't overwrite if this player is already the announcer (shouldn't happen)
      if (this.lastCardAnnouncer !== justPlayedIndex) {
        // If the previous announcer still has 1 card and there was a violation,
        // the previous announcer's window is still open — don't overwrite
        if (previousAnnouncer !== null &&
            this.hands[previousAnnouncer].length === 1 &&
            hadViolation) {
          // Keep the original announcer/target/violation — the original
          // announcer's next turn hasn't happened yet
          return;
        }
        this.lastCardAnnouncer = justPlayedIndex;
        this.lastCardRuleTarget = (justPlayedIndex - 1 + this.numPlayers) % this.numPlayers;
        this.lastCardViolation = null;
      }
      return;
    }

    // If the announcer just won (hand empty), clear state — handled by _finish
    // If the announcer played and now has >1 card (shouldn't happen), clear
    if (this.lastCardAnnouncer !== null && this.hands[this.lastCardAnnouncer].length !== 1) {
      this.lastCardAnnouncer = null;
      this.lastCardRuleTarget = null;
      this.lastCardViolation = null;
      return;
    }
  }

  _getHighestSingle(hand) {
    // Hand is sorted ascending — last card is highest
    return hand[hand.length - 1];
  }

  _advance() {
    let next = (this.currentPlayer + 1) % this.numPlayers;
    let guard = 0;
    while (this.passed.has(next) && guard < this.numPlayers * 2) {
      next = (next + 1) % this.numPlayers;
      guard++;
    }
    this.currentPlayer = next;
  }

  _finish(winnerIndex) {
    this.state = GAME_STATE.FINISHED;
    this.winner = winnerIndex;

    // Determine if penalty applies:
    // - There was a last-card announcer
    // - The announcer is the winner
    // - There was a violation recorded
    let penalizedPlayer = null;
    if (
      this.lastCardAnnouncer === winnerIndex &&
      this.lastCardViolation !== null
    ) {
      penalizedPlayer = this.lastCardViolation;
    }

    const playersWithLeftovers = this.players.map((p, i) => ({
      id: p.id,
      name: p.name,
      leftoverCards: this.hands[i],
    }));

    const { transactions, scores, bonus } = settleFaceToFace(
      playersWithLeftovers,
      winnerIndex,
      this.lastPlayCards,
      penalizedPlayer
    );

    const net = netPoints(this.numPlayers, transactions);
    const money = toMoney(net, this.betPerPoint);

    this.result = {
      winnerIndex,
      winnerBonus: bonus,
      scores,
      transactions,
      netPoints: net,
      money,
      betPerPoint: this.betPerPoint,
      penalizedPlayer,
      penaltyAmount: penalizedPlayer !== null ? 50 : 0,
    };
  }

  _assertPlaying() {
    if (this.state !== GAME_STATE.PLAYING) throw new Error('Game not in progress');
  }

  _assertCurrentPlayer(playerIndex) {
    if (playerIndex !== this.currentPlayer) {
      throw new Error(`Not your turn (current: ${this.currentPlayer})`);
    }
  }
}
