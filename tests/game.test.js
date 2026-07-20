import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDeck, shuffle, deal, findStarter, compareCards, card, SUIT, cardToString } from '../server/game/deck.js';
import { identifyPlay, comparePlays, canBeat, PLAY_TYPE } from '../server/game/validator.js';
import { calculateHandScore, winnerBonus, settleFaceToFace, netPoints, toMoney } from '../server/game/scoring.js';
import { BigTwoGame, GAME_STATE } from '../server/game/engine.js';

// ============ DECK TESTS ============

test('deck has 52 cards', () => {
  const deck = createDeck();
  assert.equal(deck.length, 52);
});

test('deal 4 players → 13 each', () => {
  const deck = createDeck();
  const { hands, burned } = deal(deck, 4);
  assert.equal(hands.length, 4);
  hands.forEach(h => assert.equal(h.length, 13));
  assert.equal(burned.length, 0);
});

test('deal 3 players → 17 each + 1 burned', () => {
  const deck = createDeck();
  const { hands, burned } = deal(deck, 3);
  assert.equal(hands.length, 3);
  hands.forEach(h => assert.equal(h.length, 17));
  assert.equal(burned.length, 1);
});

test('card comparison: 2♠ is highest, 3♦ is lowest', () => {
  const twoSpade = card(15, SUIT.SPADE);
  const threeDiamond = card(3, SUIT.DIAMOND);
  assert.ok(compareCards(twoSpade, threeDiamond) > 0);
  assert.ok(compareCards(threeDiamond, twoSpade) < 0);
});

test('suit order: ♠ > ♥ > ♣ > ♦ for same rank', () => {
  assert.ok(compareCards(card(15, SUIT.SPADE), card(15, SUIT.HEART)) > 0);
  assert.ok(compareCards(card(15, SUIT.HEART), card(15, SUIT.CLUB)) > 0);
  assert.ok(compareCards(card(15, SUIT.CLUB), card(15, SUIT.DIAMOND)) > 0);
});

// ============ VALIDATOR TESTS ============

test('identify single', () => {
  const play = identifyPlay([card(15, SUIT.SPADE)]);
  assert.equal(play.type, PLAY_TYPE.SINGLE);
});

test('identify pair', () => {
  const play = identifyPlay([card(10, SUIT.SPADE), card(10, SUIT.HEART)]);
  assert.equal(play.type, PLAY_TYPE.PAIR);
});

test('reject invalid pair', () => {
  const play = identifyPlay([card(10, SUIT.SPADE), card(11, SUIT.HEART)]);
  assert.equal(play, null);
});

test('identify triple', () => {
  const play = identifyPlay([card(7, SUIT.SPADE), card(7, SUIT.HEART), card(7, SUIT.CLUB)]);
  assert.equal(play.type, PLAY_TYPE.TRIPLE);
});

test('identify straight (normal)', () => {
  const cards = [card(3, SUIT.DIAMOND), card(4, SUIT.CLUB), card(5, SUIT.HEART), card(6, SUIT.SPADE), card(7, SUIT.DIAMOND)];
  const play = identifyPlay(cards);
  assert.equal(play.type, PLAY_TYPE.STRAIGHT);
});

test('identify straight with A-2-3-4-5', () => {
  const cards = [card(14, SUIT.DIAMOND), card(15, SUIT.CLUB), card(3, SUIT.HEART), card(4, SUIT.SPADE), card(5, SUIT.DIAMOND)];
  const play = identifyPlay(cards);
  assert.equal(play.type, PLAY_TYPE.STRAIGHT);
  assert.equal(play.straightInfo.hasTwo, true);
});

test('identify straight with 2-3-4-5-6', () => {
  const cards = [card(15, SUIT.DIAMOND), card(3, SUIT.CLUB), card(4, SUIT.HEART), card(5, SUIT.SPADE), card(6, SUIT.DIAMOND)];
  const play = identifyPlay(cards);
  assert.equal(play.type, PLAY_TYPE.STRAIGHT);
  assert.equal(play.straightInfo.hasTwo, true);
});

test('identify flush', () => {
  const cards = [card(3, SUIT.SPADE), card(5, SUIT.SPADE), card(7, SUIT.SPADE), card(9, SUIT.SPADE), card(11, SUIT.SPADE)];
  const play = identifyPlay(cards);
  assert.equal(play.type, PLAY_TYPE.FLUSH);
});

test('identify full house', () => {
  const cards = [card(7, SUIT.SPADE), card(7, SUIT.HEART), card(7, SUIT.CLUB), card(11, SUIT.DIAMOND), card(11, SUIT.SPADE)];
  const play = identifyPlay(cards);
  assert.equal(play.type, PLAY_TYPE.FULL_HOUSE);
});

test('identify four of a kind', () => {
  const cards = [card(9, SUIT.SPADE), card(9, SUIT.HEART), card(9, SUIT.CLUB), card(9, SUIT.DIAMOND), card(3, SUIT.SPADE)];
  const play = identifyPlay(cards);
  assert.equal(play.type, PLAY_TYPE.FOUR_OF_A_KIND);
});

test('identify straight flush', () => {
  const cards = [card(3, SUIT.SPADE), card(4, SUIT.SPADE), card(5, SUIT.SPADE), card(6, SUIT.SPADE), card(7, SUIT.SPADE)];
  const play = identifyPlay(cards);
  assert.equal(play.type, PLAY_TYPE.STRAIGHT_FLUSH);
});

test('2-straight beats 10-J-Q-K-A straight', () => {
  const twoStraight = identifyPlay([
    card(15, SUIT.DIAMOND), card(3, SUIT.CLUB), card(4, SUIT.HEART), card(5, SUIT.SPADE), card(6, SUIT.DIAMOND)
  ]);
  const aceHighStraight = identifyPlay([
    card(10, SUIT.DIAMOND), card(11, SUIT.CLUB), card(12, SUIT.HEART), card(13, SUIT.SPADE), card(14, SUIT.DIAMOND)
  ]);
  assert.ok(comparePlays(twoStraight, aceHighStraight) > 0);
});

test('between two 2-straights, higher suit of 2 wins', () => {
  const spadeTwo = identifyPlay([
    card(15, SUIT.SPADE), card(3, SUIT.CLUB), card(4, SUIT.HEART), card(5, SUIT.SPADE), card(6, SUIT.DIAMOND)
  ]);
  const diamondTwo = identifyPlay([
    card(15, SUIT.DIAMOND), card(3, SUIT.HEART), card(4, SUIT.CLUB), card(5, SUIT.DIAMOND), card(6, SUIT.CLUB)
  ]);
  assert.ok(comparePlays(spadeTwo, diamondTwo) > 0);
});

test('straight flush beats four of a kind (cross-type comparison)', () => {
  const sf = identifyPlay([
    card(3, SUIT.SPADE), card(4, SUIT.SPADE), card(5, SUIT.SPADE), card(6, SUIT.SPADE), card(7, SUIT.SPADE)
  ]);
  const foak = identifyPlay([
    card(9, SUIT.SPADE), card(9, SUIT.HEART), card(9, SUIT.CLUB), card(9, SUIT.DIAMOND), card(3, SUIT.DIAMOND)
  ]);
  // Straight flush (rank 5) > Four of a kind (rank 4)
  assert.ok(comparePlays(sf, foak) > 0);
  assert.ok(comparePlays(foak, sf) < 0);
});

test('flush beats straight (cross-type comparison)', () => {
  const flush = identifyPlay([
    card(3, SUIT.HEART), card(5, SUIT.HEART), card(7, SUIT.HEART), card(9, SUIT.HEART), card(11, SUIT.HEART)
  ]);
  const straight = identifyPlay([
    card(3, SUIT.DIAMOND), card(4, SUIT.CLUB), card(5, SUIT.HEART), card(6, SUIT.SPADE), card(7, SUIT.DIAMOND)
  ]);
  // Flush (rank 2) > Straight (rank 1)
  assert.ok(comparePlays(flush, straight) > 0);
  assert.ok(comparePlays(straight, flush) < 0);
});

test('full house beats flush (cross-type comparison)', () => {
  const fh = identifyPlay([
    card(7, SUIT.SPADE), card(7, SUIT.HEART), card(7, SUIT.CLUB), card(11, SUIT.DIAMOND), card(11, SUIT.SPADE)
  ]);
  const flush = identifyPlay([
    card(3, SUIT.HEART), card(5, SUIT.HEART), card(7, SUIT.HEART), card(9, SUIT.HEART), card(11, SUIT.HEART)
  ]);
  assert.ok(comparePlays(fh, flush) > 0);
});

test('four of a kind beats full house (cross-type comparison)', () => {
  const foak = identifyPlay([
    card(9, SUIT.SPADE), card(9, SUIT.HEART), card(9, SUIT.CLUB), card(9, SUIT.DIAMOND), card(3, SUIT.DIAMOND)
  ]);
  const fh = identifyPlay([
    card(7, SUIT.SPADE), card(7, SUIT.HEART), card(7, SUIT.CLUB), card(11, SUIT.DIAMOND), card(11, SUIT.SPADE)
  ]);
  assert.ok(comparePlays(foak, fh) > 0);
});

test('straight loses to flush (canBeat)', () => {
  const flush = identifyPlay([
    card(3, SUIT.HEART), card(5, SUIT.HEART), card(7, SUIT.HEART), card(9, SUIT.HEART), card(11, SUIT.HEART)
  ]);
  const straight = identifyPlay([
    card(3, SUIT.DIAMOND), card(4, SUIT.CLUB), card(5, SUIT.HEART), card(6, SUIT.SPADE), card(7, SUIT.DIAMOND)
  ]);
  assert.ok(canBeat(flush, straight));
  assert.ok(!canBeat(straight, flush));
});

// ============ SCORING TESTS — Using our worked example ============

test('Bob: 5 cards, no 2s → 5 pts', () => {
  const hand = [card(4, 0), card(6, 1), card(8, 2), card(9, 3), card(11, 0)];
  assert.equal(calculateHandScore(hand), 5);
});

// ============ 3-PLAYER SCORING TESTS ============

test('3p: 8 cards no 2 → 8×2 = 16 pts (8-10 = ×2)', () => {
  const hand = Array.from({ length: 8 }, (_, i) => card(3 + i, 0));
  assert.equal(calculateHandScore(hand, 3), 16);
});

test('3p: 9 cards one 2 → (10+8)×2 = 36 pts', () => {
  const hand = [card(15, 0), ...Array.from({ length: 8 }, (_, i) => card(4 + i, 0))];
  assert.equal(hand.length, 9);
  assert.equal(calculateHandScore(hand, 3), 36);
});

test('3p: 17 cards two 2s → (20+15)×4 = 140 pts', () => {
  const hand = [card(15, 0), card(15, 1), ...Array.from({ length: 15 }, (_, i) => card(4 + (i % 10), 2))];
  assert.equal(calculateHandScore(hand, 3), 140);
});

test('3p: 12 cards no 2 → 12×3 = 36 pts', () => {
  const hand = Array.from({ length: 12 }, (_, i) => card(3 + i, 0));
  assert.equal(calculateHandScore(hand, 3), 36);
});

test('3p: 11 cards one 2 → (10+10)×3 = 60 pts', () => {
  const hand = [card(15, 0), ...Array.from({ length: 10 }, (_, i) => card(4 + i, 0))];
  assert.equal(calculateHandScore(hand, 3), 60);
});

test('Carol: 8 cards, one 2 → (10+7) × 2 = 34 pts', () => {
  const hand = [
    card(15, SUIT.HEART), // the 2
    card(4, 0), card(6, 1), card(8, 2), card(9, 3), card(11, 0), card(12, 1), card(13, 2)
  ];
  assert.equal(calculateHandScore(hand), 34);
});

test('David: 13 cards, two 2s → (20+11) × 4 = 124 pts', () => {
  const hand = [
    card(15, SUIT.CLUB), card(15, SUIT.DIAMOND), // two 2s
    card(3, 0), card(4, 1), card(5, 2), card(6, 3), card(7, 0),
    card(8, 1), card(9, 2), card(10, 3), card(11, 0), card(12, 1), card(13, 2)
  ];
  assert.equal(hand.length, 13);
  assert.equal(calculateHandScore(hand), 124);
});

test('winner bonus: +20 if final play has 2', () => {
  assert.equal(winnerBonus([card(15, SUIT.SPADE)]), 20);
});

test('winner bonus: +10 if final play has no 2', () => {
  assert.equal(winnerBonus([card(14, SUIT.SPADE)]), 10);
});

test('full settlement matches worked example', () => {
  // Alice (winner, finished with 2♠), Bob 5 cards no 2s, Carol 8 cards one 2♥, David 13 cards two 2s
  const players = [
    { id: 'alice', leftoverCards: [] }, // winner, 0 cards
    {
      id: 'bob', leftoverCards: [
        card(4, 0), card(6, 1), card(8, 2), card(9, 3), card(11, 0)
      ]
    },
    {
      id: 'carol', leftoverCards: [
        card(15, SUIT.HEART),
        card(4, 1), card(6, 2), card(8, 3), card(9, 0), card(11, 1), card(12, 2), card(13, 3)
      ]
    },
    {
      id: 'david', leftoverCards: [
        card(15, SUIT.CLUB), card(15, SUIT.DIAMOND),
        card(3, 0), card(4, 2), card(5, 3), card(6, 0), card(7, 1),
        card(8, 0), card(9, 1), card(10, 2), card(11, 3), card(12, 0), card(13, 1)
      ]
    },
  ];

  const { transactions, scores, bonus } = settleFaceToFace(players, 0, [card(15, SUIT.SPADE)]);

  assert.equal(bonus, 20);
  assert.deepEqual(scores, [0, 5, 34, 124]);

  // Verify each transaction
  const txMap = {};
  for (const t of transactions) {
    txMap[`${t.from}→${t.to}`] = t.points;
  }

  // Bob(1) → Alice(0): 5 + 20 = 25
  assert.equal(txMap['1→0'], 25);
  // Carol(2) → Alice(0): 34 + 20 = 54
  assert.equal(txMap['2→0'], 54);
  // Carol(2) → Bob(1): 34 - 5 = 29
  assert.equal(txMap['2→1'], 29);
  // David(3) → Alice(0): 124 + 20 = 144
  assert.equal(txMap['3→0'], 144);
  // David(3) → Bob(1): 124 - 5 = 119
  assert.equal(txMap['3→1'], 119);
  // David(3) → Carol(2): 124 - 34 = 90
  assert.equal(txMap['3→2'], 90);

  // Net points
  const net = netPoints(4, transactions);
  assert.equal(net[0], 223);   // Alice
  assert.equal(net[1], 123);   // Bob
  assert.equal(net[2], 7);     // Carol
  assert.equal(net[3], -353);  // David

  // Zero-sum
  assert.equal(net.reduce((a, b) => a + b, 0), 0);

  // Money at 10K
  const money = toMoney(net, 10000);
  assert.equal(money[0], 2230000);
  assert.equal(money[1], 1230000);
  assert.equal(money[2], 70000);
  assert.equal(money[3], -3530000);
});

// ============ ENGINE TESTS ============

test('game: 4 players can start', () => {
  const g = new BigTwoGame(4, 10000);
  g.addPlayer('p1', 'Alice');
  g.addPlayer('p2', 'Bob');
  g.addPlayer('p3', 'Carol');
  g.addPlayer('p4', 'David');
  const state = g.start();
  assert.equal(state.state, GAME_STATE.PLAYING);
  assert.equal(state.handCounts.length, 4);
  state.handCounts.forEach(c => assert.equal(c, 13));
});

test('game: 3 players → 17 each + 1 burned', () => {
  const g = new BigTwoGame(3, 10000);
  g.addPlayer('p1', 'Alice');
  g.addPlayer('p2', 'Bob');
  g.addPlayer('p3', 'Carol');
  const state = g.start();
  assert.equal(state.handCounts.length, 3);
  state.handCounts.forEach(c => assert.equal(c, 17));
  assert.equal(g.burned.length, 1);
});

test('game: player with 3♦ starts', () => {
  const g = new BigTwoGame(4, 10000);
  g.addPlayer('p1', 'A');
  g.addPlayer('p2', 'B');
  g.addPlayer('p3', 'C');
  g.addPlayer('p4', 'D');
  g.start();
  const starterHand = g.hands[g.currentPlayer];
  const has3D = starterHand.some(c => c.rank === 3 && c.suit === SUIT.DIAMOND);
  assert.ok(has3D);
});

test('game: pass locks you out until new trick', () => {
  // Setup a controlled game
  const g = new BigTwoGame(4, 10000, () => 0.5); // deterministic-ish shuffle
  g.addPlayer('p1', 'A');
  g.addPlayer('p2', 'B');
  g.addPlayer('p3', 'C');
  g.addPlayer('p4', 'D');
  g.start();

  const starter = g.currentPlayer;

  // Starter plays their lowest single (must include 3♦)
  const starterHand = g.hands[starter];
  const idx3D = starterHand.findIndex(c => c.rank === 3 && c.suit === SUIT.DIAMOND);
  g.play(starter, [idx3D]);

  // Next player passes
  const next = g.currentPlayer;
  g.pass(next);

  // Player after that passes
  const third = g.currentPlayer;
  g.pass(third);

  // Fourth player passes — trick should end, back to starter
  const fourth = g.currentPlayer;
  g.pass(fourth);

  // Now it should be starter's turn with a free play
  assert.equal(g.currentPlayer, starter);
  assert.equal(g.tablePlay, null);

  // The players who passed should be able to play again on the new trick
  assert.equal(g.passed.size, 0);
});

test('game: cannot pass on free play', () => {
  const g = new BigTwoGame(4, 10000);
  g.addPlayer('p1', 'A');
  g.addPlayer('p2', 'B');
  g.addPlayer('p3', 'C');
  g.addPlayer('p4', 'D');
  g.start();

  // First play is a free play (but must include 3♦)
  assert.throws(() => g.pass(g.currentPlayer), /Cannot pass/);
});

test('game: full game simulation to completion', () => {
  const g = new BigTwoGame(4, 10000);
  g.addPlayer('p1', 'A');
  g.addPlayer('p2', 'B');
  g.addPlayer('p3', 'C');
  g.addPlayer('p4', 'D');
  g.start();

  let turns = 0;
  const maxTurns = 500;

  while (g.state === GAME_STATE.PLAYING && turns < maxTurns) {
    const p = g.currentPlayer;
    const hand = g.hands[p];

    // Try to find a valid play
    let played = false;

    if (g.tablePlay === null) {
      // Free play: play lowest single (or include 3♦ if first)
      if (g.isFirstPlay) {
        const idx = hand.findIndex(c => c.rank === 3 && c.suit === SUIT.DIAMOND);
        if (idx >= 0) {
          g.play(p, [idx]);
          played = true;
        }
      }
      if (!played) {
        g.play(p, [0]); // lowest card
        played = true;
      }
    } else {
      // Try to beat with a single
      if (g.tablePlay.type === PLAY_TYPE.SINGLE) {
        for (let i = 0; i < hand.length; i++) {
          const tryPlay = identifyPlay([hand[i]]);
          if (tryPlay && canBeat(tryPlay, g.tablePlay)) {
            g.play(p, [i]);
            played = true;
            break;
          }
        }
      }
      if (!played) {
        g.pass(p);
      }
    }
    turns++;
  }

  assert.equal(g.state, GAME_STATE.FINISHED);
  assert.ok(g.winner !== null);
  assert.ok(g.result);
  assert.equal(g.result.netPoints.reduce((a, b) => a + b, 0), 0); // zero-sum
});
