// ===== CARD DEALING ANIMATION =====
// Triggered at the start of each round. Shows cards being shuffled and dealt
// to each player, then transitions into the game view.

const DEAL_DURATION = 2000; // Total animation time in ms

export function playDealAnimation(playerNames, playerCount, callback) {
  // Remove any existing overlay
  document.querySelectorAll('.deal-overlay').forEach(el => el.remove());

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'deal-overlay';

  // Create positions for players around the table
  // We'll place players in a diamond/cross pattern
  const positions = getPlayerPositions(playerCount);

  // Player name labels
  positions.forEach((pos, i) => {
    const label = document.createElement('div');
    label.className = 'deal-player-label';
    label.style.left = pos.x + '%';
    label.style.top = pos.y + '%';
    if (pos.x < 50) label.style.transform = 'translateX(-50%)';
    else label.style.transform = 'translateX(-50%)';
    label.textContent = playerNames[i] || 'Player ' + (i + 1);
    overlay.appendChild(label);
  });

  // Create deck of cards in center
  const deckPile = document.createElement('div');
  deckPile.className = 'deal-deck';
  deckPile.style.left = '50%';
  deckPile.style.top = '50%';

  // Stack of cards in deck
  const deckCards = [];
  for (let i = 0; i < 5; i++) {
    const card = document.createElement('div');
    card.className = 'deal-card back';
    card.style.transform = `translate(-50%, -50%) rotate(${(i - 2) * 3}deg)`;
    card.style.animationDelay = (i * 50) + 'ms';
    deckPile.appendChild(card);
    deckCards.push(card);
  }
  overlay.appendChild(deckPile);

  // Create flying cards that will go to each player
  const cardsPerPlayer = playerCount === 3 ? 17 : 13;
  const totalCards = cardsPerPlayer * playerCount;
  let cardsDealt = 0;

  // Shuffle animation first, then deal
  overlay.classList.add('shuffling');
  document.body.appendChild(overlay);

  // Phase 1: Shuffle (stack cards jittering in center)
  setTimeout(() => {
    // Phase 2: Deal cards one by one to players
    overlay.classList.remove('shuffling');
    overlay.classList.add('dealing');

    const dealInterval = DEAL_DURATION / (totalCards + playerCount * 2);

    function dealCard(toPlayer) {
      if (cardsDealt >= totalCards) return;

      const pos = positions[toPlayer];
      const card = document.createElement('div');
      card.className = 'deal-card dealt';
      card.style.left = '50%';
      card.style.top = '50%';
      card.style.setProperty('--target-x', pos.x + '%');
      card.style.setProperty('--target-y', pos.y + '%');
      card.style.setProperty('--fly-rotate', (Math.random() * 30 - 15) + 'deg');
      card.style.animation = `dealCard ${dealInterval * 2}ms ease-in-out forwards`;
      overlay.appendChild(card);

      // Remove after animation
      setTimeout(() => card.remove(), dealInterval * 2 + 100);
      cardsDealt++;
    }

    let currentPlayer = 0;
    const dealLoop = setInterval(() => {
      if (cardsDealt >= totalCards) {
        clearInterval(dealLoop);

        // Brief pause, then transition out
        setTimeout(() => {
          overlay.classList.add('fadeout');
          setTimeout(() => {
            overlay.remove();
            if (callback) callback();
          }, 400);
        }, 300);
        return;
      }

      // Deal next card
      dealCard(currentPlayer);
      currentPlayer = (currentPlayer + 1) % playerCount;
    }, dealInterval);

  }, 600); // Shuffle lasts 600ms

  return overlay;
}

function getPlayerPositions(count) {
  // Return position objects {x, y} as percentages
  if (count === 2) {
    return [
      { x: 50, y: 10 },  // Top
      { x: 50, y: 80 },  // Bottom
    ];
  } else if (count === 3) {
    return [
      { x: 50, y: 10 },  // Top
      { x: 15, y: 75 },  // Bottom left
      { x: 85, y: 75 },  // Bottom right
    ];
  }
  // 4 players (default)
  return [
    { x: 50, y: 10 },  // Top
    { x: 15, y: 60 },  // Left
    { x: 85, y: 60 },  // Right
    { x: 50, y: 80 },  // Bottom (you)
  ];
}
