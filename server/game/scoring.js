// Scoring engine — implements Hadi's exact rules
// See RULES.md for the full spec

import { compareCards } from './deck.js';

// Calculate a loser's score from their leftover hand
// Formula: (10 * num_2s + non_2_card_count) * multiplier
//
// Multiplier depends on player count:
//   4 players (13 cards): 1-6 → ×1, 7-9 → ×2, 10-12 → ×3, 13 → ×4
//   3 players (17 cards): 1-7 → ×1, 8-10 → ×2, 11-16 → ×3, 17 → ×4
//   2 players (26 cards): 1-7 → ×1, 8-13 → ×2, 14-20 → ×3, 21-26 → ×4
export function calculateHandScore(leftoverCards, numPlayers = 4) {
  const total = leftoverCards.length;
  if (total === 0) return 0;

  const twos = leftoverCards.filter(c => c.rank === 15).length;
  const nonTwos = total - twos;
  const base = twos * 10 + nonTwos;

  let multiplier;
  if (numPlayers === 3) {
    if (total <= 7) multiplier = 1;
    else if (total <= 10) multiplier = 2;
    else if (total <= 16) multiplier = 3;
    else multiplier = 4; // 17
  } else if (numPlayers === 2) {
    if (total <= 7) multiplier = 1;
    else if (total <= 13) multiplier = 2;
    else if (total <= 20) multiplier = 3;
    else multiplier = 4;
  } else {
    // 4 players (default)
    if (total <= 6) multiplier = 1;
    else if (total <= 9) multiplier = 2;
    else if (total <= 12) multiplier = 3;
    else multiplier = 4; // 13
  }

  return base * multiplier;
}

// Winner bonus based on their final play
// +20 if final play contained a 2, +10 otherwise
export function winnerBonus(finalPlayCards) {
  const hasTwo = finalPlayCards.some(c => c.rank === 15);
  return hasTwo ? 20 : 10;
}

// Face-to-face settlement
// Returns array of { from, to, points } transactions
//
// Inputs:
//   players: [{ id, leftoverCards }] — all players
//   winnerIndex: index of the winner in players array
//   finalPlayCards: the cards in the winner's last play
//   penalizedPlayer: index of player who violated last-card rule (gets +50 added to their score)
export function settleFaceToFace(players, winnerIndex, finalPlayCards, penalizedPlayer = null) {
  const n = players.length;
  const scores = players.map(p => calculateHandScore(p.leftoverCards, players.length));
  const bonus = winnerBonus(finalPlayCards);

  // Apply last-card penalty: +50 to the violator's score
  if (penalizedPlayer !== null && penalizedPlayer !== winnerIndex) {
    scores[penalizedPlayer] += 50;
  }

  const transactions = [];

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (i === winnerIndex && j === winnerIndex) continue;

      if (i === winnerIndex) {
        // Loser j pays winner i: score_j + bonus
        transactions.push({
          from: j,
          to: i,
          points: scores[j] + bonus,
        });
      } else if (j === winnerIndex) {
        // Loser i pays winner j: score_i + bonus
        transactions.push({
          from: i,
          to: j,
          points: scores[i] + bonus,
        });
      } else {
        // Loser vs loser: higher score pays lower score the difference
        const diff = scores[i] - scores[j];
        if (diff > 0) {
          transactions.push({ from: i, to: j, points: diff });
        } else if (diff < 0) {
          transactions.push({ from: j, to: i, points: -diff });
        }
        // diff === 0 → no payment
      }
    }
  }

  return { transactions, scores, bonus };
}

// Calculate net points per player from transactions
export function netPoints(numPlayers, transactions) {
  const net = new Array(numPlayers).fill(0);
  for (const t of transactions) {
    net[t.from] -= t.points;
    net[t.to] += t.points;
  }
  return net;
}

// Convert net points to money
export function toMoney(netPointsArray, betPerPoint) {
  return netPointsArray.map(p => p * betPerPoint);
}

export const BET_TIERS = [5000, 10000, 20000, 30000, 50000];
