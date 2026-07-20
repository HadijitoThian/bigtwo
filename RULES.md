# Big Two (Dai Di / 大老二) — Game Rules Spec

> Locked with Hadi on Mon 2026-07-20 13:12 GMT+7
> Updated Mon 2026-07-20 14:03 GMT+7 — multi-round matches + last-card rule

## Match Structure
- A **match** = configurable number of rounds: **12, 16, or 18**
- Points & money **carry forward** across all rounds (cumulative)
- Players can **stop early** — settle current totals, no penalty
- Round 1: player with **3♦** starts, must include 3♦ in first play
- Round 2+: previous round's **winner starts** with any valid play

## Players & Deck
- Standard 52-card deck, no jokers
- **4 players:** 13 cards each
- **3 players:** 17 cards each, 1 card burned face-down (not revealed)

## Card Ranking
- **Rank:** 2 > A > K > Q > J > 10 > 9 > 8 > 7 > 6 > 5 > 4 > 3
- **Suit:** Spades ♠ > Hearts ♥ > Clubs ♣ > Diamonds ♦
- Highest card: 2♠ | Lowest card: 3♦

## Valid Plays
1. **Single** — 1 card
2. **Pair** — 2 same rank
3. **Triple** — 3 same rank
4. **Five-card hands** (low → high):
   - Straight
   - Flush
   - Full House
   - Four of a Kind (+ 1 any card)
   - Straight Flush

### Straight Rules
- 5 consecutive ranks, suits don't matter
- 2 CAN be in a straight: A-2-3-4-5 and 2-3-4-5-6 both valid
- A straight containing a 2 **beats** 10-J-Q-K-A straight
- Tie between two 2-straights → compare suit of the 2

## Gameplay (per round)
1. Round 1: player with 3♦ starts, must include it. Round 2+: previous winner starts with any play.
2. Clockwise turns
3. Each turn: play same type + same card count that beats previous, OR pass
4. **Pass = locked out** for that trick
5. When all other players pass → last player to play wins trick, starts new trick
6. First to empty hand = **round winner**, round ends immediately

## "Last Card" Rule
**Trigger:** A player has exactly 1 card left → must announce.

**Effect:** The player whose turn comes **immediately before the announcer's next turn** is under the rule:
- If they play a **single** → must be their **highest single card**
- If they play a **multi-card combo** → no restriction
- If they **cannot beat the table** → they pass, no penalty

**Penalty:** If they play a non-highest single when they could have played higher, AND the announcer wins on their very next turn → penalized player pays **normal leftover score + 50 points**

**Example (4 players, order A→B→C→D):**
- A plays a single, has 1 card left → announces
- B plays, C plays
- D is under the rule (D's turn is right before A's next turn)
- D must play highest single or multi-combo, or pass if can't beat
- If D plays a low single (had higher), and A wins next → D penalized +50

## Scoring (per round, per loser)

### Step 1: Base
- Each **2** in hand = 10 pts
- Add count of remaining non-2 cards

### Step 2: Multiplier (based on TOTAL cards left)
| Total cards | Multiplier |
|---|---|
| 1–6 | ×1 |
| 7–9 | ×2 |
| 10–12 | ×3 |
| 13 | ×4 |

**Formula:** `(10 × num_2s + non_2_card_count) × multiplier`

### Penalty Addition
- If a player is penalized (last-card rule): their score = `normal_score + 50`

## Winner Bonus (per round)
- Finishes **without** 2 on final play: **+10**
- Finishes **with** 2 on final play: **+20**

## Face-to-Face Settlement (per round)
Every player settles with every other player individually.
- **Loser vs Winner:** loser pays `(loser_score + winner_bonus)`
- **Loser vs Loser:** higher-score pays lower-score the **difference**

Round is zero-sum. Match totals = sum of all rounds.

## Money
- Bet tiers: **5K / 10K / 20K / 30K / 50K** per point
- Money = net points × bet amount (cumulative across rounds)

## Worked Example (single round, 4 players, 10K/point)
- Alice (winner, finished with 2♠) → +20 bonus
- Bob: 5 cards, no 2s → 5 pts
- Carol: 8 cards, one 2♥ → 34 pts
- David: 13 cards, two 2s → 124 pts

| Matchup | Payment |
|---|---|
| Bob → Alice | 25 |
| Carol → Alice | 54 |
| Carol → Bob | 29 |
| David → Alice | 144 |
| David → Bob | 119 |
| David → Carol | 90 |

| Player | Net Pts | Money (10K) |
|---|---|---|
| Alice | +223 | +2,230,000 |
| Bob | +123 | +1,230,000 |
| Carol | +7 | +70,000 |
| David | −353 | −3,530,000 |
