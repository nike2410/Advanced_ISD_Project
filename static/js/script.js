document.addEventListener('DOMContentLoaded', function() {
    const cards = document.querySelectorAll('.card');
    const movesElement = document.getElementById('moves');
    const matchesElement = document.getElementById('matches');
    const winMessageElement = document.getElementById('win-message');
    const finalMovesElement = document.getElementById('final-moves');
    let canFlip = true;

    // Debug: Check if cards are found
    console.log(`Found ${cards.length} cards`);

    // Add click event listeners for cards
    cards.forEach(card => {
        card.addEventListener('click', function() {
            if (!canFlip || this.classList.contains('flipped') || this.classList.contains('matched')) {
                return;
            }
            const cardId = this.dataset.id;
            console.log(`Clicked card with ID: ${cardId}`);
            flipCard(cardId);
        });
    });

    // Function to flip a card via AJAX
    function flipCard(cardId) {
        console.log(`Sending flip request for card: ${cardId}`);

        // Create form data
        const formData = new FormData();
        formData.append('card_id', cardId);

        // Send request to server
        fetch('/flip_card', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            console.log('Response received:', response);
            if (!response.ok) {
                throw new Error('Server responded with an error');
            }
            return response.json();
        })
        .then(data => {
            console.log('Data received:', data);
            // Update UI based on response
            updateGameUI(data);
        })
        .catch(error => console.error('Error:', error));
    }

    // Update game UI based on server response
    function updateGameUI(game_state) {
        console.log('Updating game UI with:', game_state);

        // Update moves counter
        if (movesElement && game_state.moves !== undefined) {
            movesElement.textContent = game_state.moves;
        }

        if (matchesElement && game_state.matched_pairs !== undefined) {
            matchesElement.textContent = game_state.matched_pairs;
        }

        // Update card states
        if (game_state.cards) {
            game_state.cards.forEach(card => {
                const cardElement = document.querySelector(`.card[data-id="${card.id}"]`);
                if (!cardElement) {
                    console.error(`Card element with ID ${card.id} not found`);
                    return;
                }

                if (card.is_flipped) {
                    cardElement.classList.add('flipped');
                } else {
                    cardElement.classList.remove('flipped');
                }

                if (card.is_matched) {
                    cardElement.classList.add('matched');
                }
            });
        }

        // Handle non-matching cards
        if (game_state.no_match) {
            console.log('No match found, will flip cards back');
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
                        card_ids: game_state.cards_to_flip_back
                    })
                })
                .then(response => response.json())
                .then(data => {
                    console.log('Cards reset response:', data);
                    // Remove flipped class from cards
                    if (game_state.cards_to_flip_back) {
                        game_state.cards_to_flip_back.forEach(cardId => {
                            const cardElement = document.querySelector(`.card[data-id="${cardId}"]`);
                            if (cardElement) {
                                cardElement.classList.remove('flipped');
                            }
                        });
                    }
                    canFlip = true;
                })
                .catch(error => {
                    console.error('Error resetting cards:', error);
                    canFlip = true; // Ensure we don't lock the game if reset fails
                });
            }, 1000);
        }

        // Handle game completion
        if (game_state.game_completed) {
            console.log('Game completed!');
            if (winMessageElement) {
                winMessageElement.style.display = 'block';
            }
            if (finalMovesElement) {
                finalMovesElement.textContent = game_state.moves;
            }
        }
    }

    // For restart button if you have one separate from the form
    const restartButton = document.querySelector('button[onclick="restart()"]');
    if (restartButton) {
        // Override the inline onclick handler
        restartButton.onclick = function(e) {
            e.preventDefault();
            fetch('/new_game', {
                method: 'POST'
            })
            .then(response => {
                if (response.redirected) {
                    window.location.href = response.url;
                }
            })
            .catch(error => console.error('Error restarting game:', error));
        };
    }
});