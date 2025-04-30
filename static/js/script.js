document.addEventListener('DOMContentLoaded', function() {
    const cards = document.querySelectorAll('.card');
    const movesElement = document.getElementById('moves');
    const matchesElement = document.getElementById('matches');
    const winMessageElement = document.getElementById('win-message');
    const finalMovesElement = document.getElementById('final-moves');
    const startGameButton = document.getElementById('start-game');
    const memoryGame = document.getElementById('memory-game');
    const gameInfo = document.getElementById('game-info');
    const gameControls = document.getElementById('game-controls');
    let canFlip = false; //to make sure game is started only when loading is done
    let preloadedImages = {};
    let loadedImages = 0;
    let totalImages = 0;
    let gameStarted = false;


    //hide the game until start button is pressed
    if (memoryGame) {
        memoryGame.style.visibility = 'hidden';
    }

    if (gameInfo) {
        gameInfo.style.visibility = 'hidden';
    }

    if (gameControls) {
        gameControls.style.visibility = 'hidden';
    }

    // Preload all card images
    function preloadCardImages() {
        const cardFrontImages = document.querySelectorAll('.front img');
        totalImages = cardFrontImages.length;

        const gameContainer = document.querySelector('.game-container');
        const loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'loading-indicator';
        loadingIndicator.textContent = 'Preparing the game...';
        loadingIndicator.style.textAlign = 'center';
        loadingIndicator.style.margin = '10px 0';
        loadingIndicator.style.color = '#3498db';
        loadingIndicator.style.fontWeight = 'bold';

        //Hide the start button until game is done loading the pictures, show loading indicator in the mean time
        if (startGameButton) {
            startGameButton.disabled = true;
            startGameButton.style.opacity = '0.5';
            startGameButton.textContent = 'Loading images...';
        }

        if (gameContainer && memoryGame) {
            gameContainer.insertBefore(loadingIndicator, startGameButton.parentNode);
        }

        //process each image
        cardFrontImages.forEach(imgElement => {
            const src = imgElement.getAttribute('src');
            const img = new Image();

            img.onload = function() {
                loadedImages++;
                preloadedImages[src] = true;

                //update the loading indicator
                if (loadingIndicator) {
                    loadingIndicator.textContent = `Loading cards (${loadedImages}/${totalImages})...`;
                }

                if (loadedImages >= totalImages) {
                    //remove the loading div
                    if (loadingIndicator) loadingIndicator.remove();

                    //show start button
                    if (startGameButton) {
                        startGameButton.disabled = false;
                        startGameButton.style.opacity = '1';
                        startGameButton.textContent = 'Start Game';
                    }
                    console.log('All images are now preloaded successfully');
                }
            };
            img.src = src;
        });
    }
    //start the preloading directly
    preloadCardImages();

     // Start game button click handler
    if (startGameButton) {
        startGameButton.addEventListener('click', function() {
            if (loadedImages >= totalImages) {
                startGame();
            } else {
                alert('Please wait until all images are loaded.');
            }
        });
    }

    // Function to start the game
    function startGame() {
        gameStarted = true;
        canFlip = true; //just allow flipping now

        // Hide the start button
        if (startGameButton) {
            startGameButton.style.display = 'none';
        }

        // Show the memory game
        if (memoryGame) {
            memoryGame.style.visibility = 'visible';
        }

        // Show game info and controls
        if (gameInfo) {
            gameInfo.style.visibility = 'visible';
        }

        if (gameControls) {
            gameControls.style.visibility = 'visible';
        }

        console.log('Game started!');
    }

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