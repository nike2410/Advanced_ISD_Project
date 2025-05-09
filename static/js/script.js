document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const cards = document.querySelectorAll('.card');
    const movesElement = document.getElementById('moves');
    const matchesElement = document.getElementById('matches');
    const winMessageElement = document.getElementById('win-message');
    const finalMovesElement = document.getElementById('final-moves');
    const finalTimeElement = document.getElementById('final-time');
    const startGameButton = document.getElementById('start-game-button');
    const memoryGame = document.getElementById('memory-game');
    const gameInfo = document.getElementById('game-info');
    const restartButtonContainer = document.getElementById('restart-button-container');
    const timerElement = document.getElementById('timer');

    // Game state variables
    let canFlip = false; // Controls if cards can be flipped, at the beggining they should not
    let preloadedImages = {};
    let gameStarted = false;
    let gameTimer = null;
    let secondsElapsed = 0;

    // Initial UI setup
    if (memoryGame) memoryGame.style.visibility = 'hidden';
    if (gameInfo) gameInfo.style.visibility = 'hidden';
    if (restartButtonContainer) restartButtonContainer.style.display = 'none';

    /*Formats seconds to MM:SS or HH:MM:SS format in the frontend */
    function formatTime(totalSeconds) {
        const hours = totalSeconds / 3600;
        const minutes = Math.floor(totalSeconds / 60) % 60;
        const seconds = totalSeconds % 60;

        if (hours < 1) {
            return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            const hoursInt = Math.floor(hours);
            return `${hoursInt.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    /* Starts the game timer   */
    function startTimer() {
        if (gameTimer) clearInterval(gameTimer); // clear any existing timer

        secondsElapsed = 0;
        updateTimerDisplay(); //call to show initial time

        gameTimer = setInterval(function() { //define when 1 second should be added to the timer - in milliseconds
            secondsElapsed++;
            updateTimerDisplay();
        }, 1000);
    }

    /* Updates the timer display with the current elapsed time  */
    function updateTimerDisplay() {
        if (timerElement) {
            timerElement.textContent = formatTime(secondsElapsed); //update the element and format the time
        }
    }

     //Stops the game timer
    function stopTimer() {
        if (gameTimer) {
            clearInterval(gameTimer); // see above
            gameTimer = null;
        }
    }

    // function to preload all pictures before starting the game TODO: check why still the first card takes longer (maybe cache?)
function preloadCardImages() {

    const cards = document.querySelectorAll('.card');   //get the cards, create set and array
    const imagesToLoad = [];
    const uniqueImages = new Set();

    cards.forEach(card => {
        const imgElement = card.querySelector('.front img');            //get image, add it to set and array
        if (imgElement && !uniqueImages.has(imgElement.src)) {
            uniqueImages.add(imgElement.src);
            imagesToLoad.push(imgElement.src);
        }
    });

    // Show loading status - delete maybe?
    const loadingIndicator = document.getElementById('loading-indicator') || //put styling to css?
        document.createElement('div');
    loadingIndicator.id = 'loading-indicator';
    loadingIndicator.textContent = 'Loading cards...';
    loadingIndicator.style.textAlign = 'center';
    loadingIndicator.style.margin = '10px 0';
    loadingIndicator.style.color = '#3498db';

    // Add or update loading indicator
    if (!document.getElementById('loading-indicator')) {
        const gameContainer = document.querySelector('.game-container');
        const startGameContainer = document.querySelector('.start-game-container');
        if (gameContainer && startGameContainer) {
            gameContainer.insertBefore(loadingIndicator, startGameContainer);
        }
    }

    // Update start button state after the loading is done
    if (startGameButton) {
        startGameButton.disabled = true;
        startGameButton.textContent = 'Loading...';
    }

    // Load all images in parallel
    let loaded = 0;
    const totalImages = imagesToLoad.length;

    // If there are no images to load, enable the start button immediately
    if (totalImages === 0) {
        if (loadingIndicator) loadingIndicator.remove();
        if (startGameButton) {
            startGameButton.disabled = false;
            startGameButton.textContent = 'Start Game';
        }
        return;
    }

    // Preload each image adn adjust loading constant
    imagesToLoad.forEach(src => {
        const img = new Image();
        img.onload = img.onerror = () => {
            loaded++;
            loadingIndicator.textContent = `Loading cards (${loaded}/${totalImages})...`;

            // When all images are loaded
            if (loaded >= totalImages) {
                if (loadingIndicator) loadingIndicator.remove();
                if (startGameButton) {
                    startGameButton.disabled = false;
                    startGameButton.textContent = 'Start Game';
                }
            }
        };
        img.src = src;
    });
}
    // Start preloading right away after script is loaded
    preloadCardImages();

    // start the game after
    function startGame() {
        gameStarted = true;
        canFlip = true; // Allow card flipping only now (implemented because of bug)

        startTimer();

        // Update the UI elements accordingly
        if (startGameButton) startGameButton.style.display = 'none';
        if (memoryGame) memoryGame.style.visibility = 'visible';
        if (gameInfo) gameInfo.style.visibility = 'visible';
        if (restartButtonContainer) restartButtonContainer.style.display = 'block';
    }

    // Start game button click handler
    if (startGameButton) {
        startGameButton.addEventListener('click', startGame);
    }

    /* makes AJAX request and flips a card  */
    function flipCard(cardId) {

        // Create form data
        const formData = new FormData();
        formData.append('card_id', cardId);

        // Send request to server
        fetch('/flip_card', {
            method: 'POST',
            body: formData
        })

        .then(response => {
            return response.json();
        })

        .then(data => {

            // Update UI based on response
            updateGameUI(data);

            // Handle case of non-matching cards
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
                }, 900);                //adjust if game feels too slow
            }
        })
        .catch(error => console.error('Error:', error));
    }

    /* Updates game UI based on server response     */
    function updateGameUI(game_state) {

        // Update stats counters
        if (movesElement && game_state.moves !== undefined) {
            movesElement.textContent = game_state.moves;
        }

        if (matchesElement && game_state.matched_pairs !== undefined) {
            matchesElement.textContent = game_state.matched_pairs;
        }

        // Handle matched cards
        if (game_state.match_found && game_state.matched_card_ids) {
            game_state.matched_card_ids.forEach(card_id => {
                const cardElement = document.querySelector(`.card[data-id="${card_id}"]`);
                if (cardElement) {
                    cardElement.classList.add('matched');
                    cardElement.classList.add('flipped');
                }
            });
        }

        // Update all card states
        if (game_state.cards) {
            game_state.cards.forEach(card => {
                const cardElement = document.querySelector(`.card[data-id="${card.id}"]`);
                if (!cardElement) {
                    return;
                }

                if (card.is_matched) {
                    cardElement.classList.add('matched');
                    cardElement.classList.add('flipped'); // Ensure matched cards stay flipped
                } else if (card.is_flipped) {
                    cardElement.classList.add('flipped');
                } else {
                    cardElement.classList.remove('flipped');
                }
            });
        }

        // Handle game completion
        if (game_state.game_completed) {

            stopTimer();

            if (winMessageElement) winMessageElement.style.display = 'block';
            if (finalMovesElement) finalMovesElement.textContent = game_state.moves;
            if (finalTimeElement) finalTimeElement.textContent = formatTime(secondsElapsed);

            // Save score when game is completed
            saveScore(game_state.moves, secondsElapsed);
        }
    }

    function saveScore(moves, seconds) {
    fetch('/save_score', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            moves: moves,
            seconds: seconds
        })
    })
    .then(response => response.json())
    .then(data => {

        // Update the win message with score information
        const scoreElement = document.getElementById('final-score');
        if (scoreElement) {
            scoreElement.textContent = data.score;
        }

        // Show high score message if applicable
        const highScoreMessage = document.getElementById('high-score-message');
        if (highScoreMessage) {
            if (data.is_high_score) {
                highScoreMessage.style.display = 'block';
                highScoreMessage.textContent = `New personal high score: ${data.score}!`;
            } else {
                highScoreMessage.style.display = 'block';
                highScoreMessage.textContent = `Your high score: ${data.high_score}`;
            }
        }
    });
}

    // Add click event listeners for cards
    cards.forEach(card => {
        card.addEventListener('click', function() {
            if (!canFlip || !gameStarted ||
                this.classList.contains('flipped') ||
                this.classList.contains('matched')) {
                return;
            }
            const cardId = this.dataset.id;
            flipCard(cardId);
        });
    });

    // Configure restart button
    const restartButton = document.querySelector('button[type="submit"][form="restart-form"]');
    if (restartButton) {
        const form = restartButton.closest('form');
        if (form) {
            form.addEventListener('submit', function(e) {
                e.preventDefault();

                stopTimer();

                fetch('/new_game', {
                    method: 'POST'
                })
                .then(response => {
                    if (response.redirected) {
                        window.location.href = response.url;
                    }
                });
            });
        }
    }
});