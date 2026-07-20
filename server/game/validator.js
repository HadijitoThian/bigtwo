// Play validation and comparison
// Play types: SINGLE, PAIR, TRIPLE, STRAIGHT, FLUSH, FULL_HOUSE, FOUR_OF_A_KIND, STRAIGHT_FLUSH

import { compareCards } from './deck.js';

export const PLAY_TYPE = {
  SINGLE: 'SINGLE',
  PAIR: 'PAIR',
  TRIPLE: 'TRIPLE',
  STRAIGHT: 'STRAIGHT',
  FLUSH: 'FLUSH',
  FULL_HOUSE: 'FULL_HOUSE',
  FOUR_OF_A_KIND: 'FOUR_OF_A_KIND',
  STRAIGHT_FLUSH: 'STRAIGHT_FLUSH',
};

// Five-card hand rankings (higher number = stronger)
const FIVE_CARD_RANK = {
  STRAIGHT: 1,
  FLUSH: 2,
  FULL_HOUSE: 3,
  FOUR_OF_A_KIND: 4,
  STRAIGHT_FLUSH: 5,
};

// Identify what type of play a set of cards is, or null if invalid
export function identifyPlay(cards) {
  if (!cards || cards.length === 0) return null;
  const n = cards.length;

  if (n === 1) return { type: PLAY_TYPE.SINGLE, cards };
  if (n === 2) {
    if (cards[0].rank === cards[1].rank) return { type: PLAY_TYPE.PAIR, cards };
    return null;
  }
  if (n === 3) {
    if (cards.every(c => c.rank === cards[0].rank)) return { type: PLAY_TYPE.TRIPLE, cards };
    return null;
  }
  if (n === 5) {
    return identifyFiveCard(cards);
  }
  return null;
}

function identifyFiveCard(cards) {
  const sorted = [...cards].sort(compareCards);
  const ranks = sorted.map(c => c.rank);
  const suits = sorted.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);
  const straightInfo = checkStraight(ranks);

  if (isFlush && straightInfo.isStraight) {
    return { type: PLAY_TYPE.STRAIGHT_FLUSH, cards: sorted, straightInfo };
  }
  if (straightInfo.isStraight) {
    return { type: PLAY_TYPE.STRAIGHT, cards: sorted, straightInfo };
  }
  if (isFlush) {
    return { type: PLAY_TYPE.FLUSH, cards: sorted };
  }

  // Count rank occurrences
  const rankCount = {};
  for (const r of ranks) rankCount[r] = (rankCount[r] || 0) + 1;
  const counts = Object.values(rankCount).sort((a, b) => b - a);

  // Four of a kind: [4, 1]
  if (counts[0] === 4) {
    const quadRank = parseInt(Object.keys(rankCount).find(r => rankCount[r] === 4));
    return { type: PLAY_TYPE.FOUR_OF_A_KIND, cards: sorted, quadRank };
  }
  // Full house: [3, 2]
  if (counts[0] === 3 && counts[1] === 2) {
    const tripRank = parseInt(Object.keys(rankCount).find(r => rankCount[r] === 3));
    return { type: PLAY_TYPE.FULL_HOUSE, cards: sorted, tripRank };
  }

  return null;
}

// Check if 5 ranks form a straight
// Returns { isStraight, highCard, hasTwo, twoSuit }
// Handles: normal straights (3-4-5-6-7 ... 10-J-Q-K-A), A-2-3-4-5, 2-3-4-5-6
function checkStraight(ranks) {
  const r = [...ranks].sort((a, b) => a - b);

  // Normal straight: consecutive
  const isConsecutive = (arr) => {
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] !== arr[i - 1] + 1) return false;
    }
    return true;
  };

  // Case 1: regular consecutive (no 2 involved, or A-high like 10-J-Q-K-A)
  if (isConsecutive(r) && !r.includes(15)) {
    return { isStraight: true, highCard: r[4], hasTwo: false };
  }

  // Case 2: A-2-3-4-5 → ranks are [3,4,5,14,15]
  if (JSON.stringify(r) === JSON.stringify([3, 4, 5, 14, 15])) {
    return { isStraight: true, highCard: 5, hasTwo: true, isAceTwo: true };
  }

  // Case 3: 2-3-4-5-6 → ranks are [3,4,5,6,15]
  if (JSON.stringify(r) === JSON.stringify([3, 4, 5, 6, 15])) {
    return { isStraight: true, highCard: 6, hasTwo: true, isTwoLow: true };
  }

  return { isStraight: false };
}

// Compare two plays. Returns:
//   > 0 if playA beats playB
//   < 0 if playA loses to playB
//   0 if equal (shouldn't happen with distinct cards)
//   null if not comparable (different card counts)
export function comparePlays(playA, playB) {
  // Different card counts → not comparable
  if (playA.cards.length !== playB.cards.length) return null;

  // For 5-card hands, different types ARE comparable via FIVE_CARD_RANK
  if (playA.cards.length === 5 && playA.type !== playB.type) {
    const rankA = FIVE_CARD_RANK[playA.type];
    const rankB = FIVE_CARD_RANK[playB.type];
    if (rankA !== undefined && rankB !== undefined) {
      return rankA - rankB;
    }
    return null;
  }

  // Same type comparison
  if (playA.type !== playB.type) return null;

  switch (playA.type) {
    case PLAY_TYPE.SINGLE:
      return compareCards(playA.cards[0], playB.cards[0]);

    case PLAY_TYPE.PAIR: {
      // Same rank by definition; compare highest suit
      const maxSuitA = Math.max(...playA.cards.map(c => c.suit));
      const maxSuitB = Math.max(...playB.cards.map(c => c.suit));
      if (playA.cards[0].rank !== playB.cards[0].rank) {
        return playA.cards[0].rank - playB.cards[0].rank;
      }
      return maxSuitA - maxSuitB;
    }

    case PLAY_TYPE.TRIPLE: {
      // Compare rank only (suits don't matter for triples in standard rules)
      return playA.cards[0].rank - playB.cards[0].rank;
    }

    case PLAY_TYPE.STRAIGHT:
      return compareStraights(playA, playB);

    case PLAY_TYPE.FLUSH: {
      // Higher suit first, then highest card
      const suitA = playA.cards[0].suit;
      const suitB = playB.cards[0].suit;
      if (suitA !== suitB) return suitA - suitB;
      // Same suit: compare highest card
      return compareCards(playA.cards[4], playB.cards[4]);
    }

    case PLAY_TYPE.FULL_HOUSE:
      // Compare the triple rank
      return playA.tripRank - playB.tripRank;

    case PLAY_TYPE.FOUR_OF_A_KIND:
      return playA.quadRank - playB.quadRank;

    case PLAY_TYPE.STRAIGHT_FLUSH:
      return compareStraights(playA, playB);

    default:
      return null;
  }
}

// Compare two straights (or straight flushes)
// Rules:
// - A straight with a 2 beats 10-J-Q-K-A
// - Between two 2-straights, compare suit of the 2
// - Otherwise compare high card
function compareStraights(playA, playB) {
  const infoA = playA.straightInfo;
  const infoB = playB.straightInfo;

  // Both have 2 → compare suit of the 2
  if (infoA.hasTwo && infoB.hasTwo) {
    const twoA = playA.cards.find(c => c.rank === 15);
    const twoB = playB.cards.find(c => c.rank === 15);
    // First compare by straight "strength": 2-3-4-5-6 vs A-2-3-4-5
    // 2-3-4-5-6 (highCard 6) beats A-2-3-4-5 (highCard 5)
    if (infoA.highCard !== infoB.highCard) {
      return infoA.highCard - infoB.highCard;
    }
    return twoA.suit - twoB.suit;
  }

  // Only A has 2 → A wins (2-straight beats non-2 straight including 10-J-Q-K-A)
  if (infoA.hasTwo && !infoB.hasTwo) return 1;
  if (!infoA.hasTwo && infoB.hasTwo) return -1;

  // Neither has 2 → compare high card, then suit of high card
  if (infoA.highCard !== infoB.highCard) {
    return infoA.highCard - infoB.highCard;
  }
  // Same high card: compare suit of the highest card
  const highA = playA.cards.find(c => c.rank === infoA.highCard);
  const highB = playB.cards.find(c => c.rank === infoB.highCard);
  return highA.suit - highB.suit;
}

// Check if a play can beat the current table play
export function canBeat(newPlay, tablePlay) {
  if (!tablePlay) return true; // Free play (new trick)
  const result = comparePlays(newPlay, tablePlay);
  return result !== null && result > 0;
}
