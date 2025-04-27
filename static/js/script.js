document.addEventListener('DOMContentLoaded', function() {
    const cards = document.querySelectorAll('.card');
    const movesElement = document.getElementById('moves');
    const matchesElement = document.getElementById('matches');
    const winMessageElement = document.getElementById('win-message');
    const finalMovesElement = document.getElementById('final-moves');
    let canFlip = true;

    // Preload all card images
    fetch('/preload_images')
        .then(response => response.json())
        .then(data => {
            console.log('Preloading images:', data.images);
            data.images.forEach(src => {
                const img = new Image();
                img.src = src;
                console.log('Preloaded:', src);
            });
        })
        .catch(error => console.error('Error preloading images:', error));

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

            // Handle non-matching cards
            if (data.no_match && data.cards_to_flip_back) {
                console.log('No match found, will flip cards back');
                canFlip = false;

                // Wait before flipping back
                setTimeout(() => {
                    // Call the server to reset the cards
                    fetch('/reset_flipped_cards', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            card_ids: data.cards_to_flip_back
                        })
                    })
                    .then(response => response.json())
                    .then(resetData => {
                        console.log('Cards reset response:', resetData);
                        // Update UI with reset data
                        updateGameUI(resetData);
                        canFlip = true;
                    })
                    .catch(error => {
                        console.error('Error resetting cards:', error);
                        canFlip = true; // Ensure we don't lock the game if reset fails
                    });
                }, 1000);
            }
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

        //handle the case a match is found
        if (game_state.match_found && game_state.matched_card_ids) {
            //make sure cards are marked in UI
            game_state.matched_card_ids.forEach(card_id => {
                const cardElement = document.querySelector(`.card[data-id="${card_id}"]`);
                if (cardElement) {
                    cardElement.classList.add('matched');
                    cardElement.classList.add('flipped');
                }
            });
        }

        // Update card states
        if (game_state.cards) {
            game_state.cards.forEach(card => {
                const cardElement = document.querySelector(`.card[data-id="${card.id}"]`);
                if (!cardElement) {
                    console.error(`Card element with ID ${card.id} not found`);
                    return;
                }

                if (card.is_matched) {
                    cardElement.classList.add('matched');
                    cardElement.classList.add('flipped'); // make sure matched cards stay flipped open, had some issues with this
                } else if (card.is_flipped) {
                    cardElement.classList.add('flipped');
                } else {
                    cardElement.classList.remove('flipped');
                }

            });
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

    // For restart button
    const restartButton = document.querySelector('button[type="submit"]');
    if (restartButton && restartButton.textContent.trim() === 'Restart Game') {
        // Override the form submission
        const form = restartButton.closest('form');
        if (form) {
            form.addEventListener('submit', function(e) {
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
            });
        }
    }
});