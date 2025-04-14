document.addEventListener('DOMContentLoaded', function() {
    const cards = document.querySelectorAll('.card');
    const movesElement = document.getElementById('moves');
    const matchesElement = document.getElementById('matches');
    const winMessageElement = document.getElementById('win-message');
    const finalMovesElement = document.getElementById('final-moves');
    let canFlip = true;

    // Add click event listeners for cards
    cards.forEach(card => {
        card.addEventListener('click', function() {
            if (!canFlip || this.classList.contains('flipped') || this.classList.contains('matched')) {
                return;
            }

            const cardId = this.dataset.id;
            flipCard(cardId);
        });
    });

    // Function to flip a card via AJAX
    function flipCard(cardId) {
        // Create form data
        const formData = new FormData();
        formData.append('card_id', cardId);

        // Send request to server
        fetch('/flip_card', {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                // Update UI based on response
                updateGameUI(data);
            })
            .catch(error => console.error('Error:', error));
    }

    // Update game UI based on server response
    function updateGameUI(game_status) {
        // Update moves counter
        movesElement.textContent = game_state.moves;
        matchesElement.textContent = game_status.matched_pairs;

        // Update card states
        game_status.cards.forEach(card => {
            const cardElement = document.querySelector(.card[data-id="${card.id}"]);
            if (card.is_flipped) {
                cardElement.classList.add('flipped');
            } else {
                cardElement.classList.remove('flipped');
            }
            if (card.is_matched) {
                cardElement.classList.add('matched');
            }
        });

        // Handle non-matching cards
        if (gameState.no_match) {
            canFlip = false;

            // Wait before flipping back
            setTimeout(() => {
                // Create request to reset flipped cards
                fetch('/reset_flipped_cards', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        card_ids: gameState.cards_to_flip_back
                    })
                })
                    .then(() => {
                        // Remove flipped class from cards
                        gameState.cards_to_flip_back.forEach(cardId => {
                            const cardElement = document.querySelector(.card[data-id="${cardId}"]);
                            cardElement.classList.remove('flipped');
                        });
                        canFlip = true;
                    });
                }, 1000);
        }

        // Handle game completion
        if (gameState.game_completed) {
            winMessageElement.style.display = 'block';
            finalMovesElement.textContent = gameState.moves;
        }
    }
});