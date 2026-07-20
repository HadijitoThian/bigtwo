// Card representation and deck operations
// Card = { rank: 3-15, suit: 0-3 }
// rank: 3=3, 4=4, ..., 10=10, 11=J, 12=Q, 13=K, 14=A, 15=2
// suit: 0=Diamond, 1=Club, 2=Heart, 3=Spade

export const SUIT = { DIAMOND: 0, CLUB: 1, HEART: 2, SPADE: 3 };
export const SUIT_SYMBOL = ['♦', '♣', '♥', '♠'];
export const RANK_LABEL = {
  3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2'
};

export function card(rank, suit) {
  return { rank, suit };
}

export function cardToString(c) {
  return `${RANK_LABEL[c.rank]}${SUIT_SYMBOL[c.suit]}`;
}

export function createDeck() {
  const deck = [];
  for (let rank = 3; rank <= 15; rank++) {
    for (let suit = 0; suit <= 3; suit++) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

export function shuffle(deck, rng = Math.random) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// Deal for 4 players (13 each), 3 players (17 each + 1 burned), 2 players (26 each)
export function deal(deck, numPlayers) {
  if (numPlayers === 4) {
    const hands = [[], [], [], []];
    deck.forEach((c, i) => hands[i % 4].push(c));
    hands.forEach(sortHand);
    return { hands, burned: [] };
  }
  if (numPlayers === 3) {
    const hands = [[], [], []];
    for (let i = 0; i < 51; i++) {
      hands[i % 3].push(deck[i]);
    }
    hands.forEach(sortHand);
    return { hands, burned: [deck[51]] };
  }
  if (numPlayers === 2) {
    const hands = [[], []];
    // 26 cards each
    for (let i = 0; i < 52; i++) {
      hands[i % 2].push(deck[i]);
    }
    hands.forEach(sortHand);
    return { hands, burned: [] };
  }
  throw new Error(`Unsupported player count: ${numPlayers}`);
}

// Sort by rank asc, then suit asc
export function sortHand(hand) {
  hand.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.suit - b.suit;
  });
  return hand;
}

// Compare two cards: returns negative if a < b, 0 if equal, positive if a > b
export function compareCards(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank;
  return a.suit - b.suit;
}

// Find who has 3 of diamonds (the lowest card, always starts)
export function findStarter(hands) {
  for (let p = 0; p < hands.length; p++) {
    if (hands[p].some(c => c.rank === 3 && c.suit === SUIT.DIAMOND)) {
      return p;
    }
  }
  // In 3-player game, 3♦ might be burned — then lowest card holder starts
  // Find the lowest card across all hands
  let lowestPlayer = 0;
  let lowestCard = null;
  for (let p = 0; p < hands.length; p++) {
    const first = hands[p][0]; // hands are sorted
    if (!lowestCard || compareCards(first, lowestCard) < 0) {
      lowestCard = first;
      lowestPlayer = p;
    }
  }
  return lowestPlayer;
}
