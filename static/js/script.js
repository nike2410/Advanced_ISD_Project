let cards = [];
let flippedCards = [];
let score = 0;

// get the card values from the server
fetch('/cards')
    .then(response => response.json())
    .then(data => {
        cards = data;
        createCards();
    });

function createCards() {
    const gridContainer = document.querySelector('.grid-container');
    gridContainer.innerHTML = '';
    cards.forEach((value, index) => {
        const card = document.createElement('div');
        card.classList.add('card');
        card.dataset.value = value;
        card.dataset.index = index;
        card.addEventListener('click', handleCardClick);
        gridContainer.appendChild(card);
    });
}

function handleCardClick(event) {
    const card = event.target;
    if (flippedCards.length < 2 && !card.classList.contains('flipped')) {
        card.classList.add('flipped');
        card.textContent = card.dataset.value;
        flippedCards.push(card);
        if (flippedCards.length === 2) {
            checkForMatch();
        }
    }
}

function checkForMatch() {
    const [card1, card2] = flippedCards;
    if (card1.dataset.value === card2.dataset.value) {
        score++;
        document.querySelector('.score').textContent = score;
        flippedCards = [];
    } else {
        setTimeout(() => {
            card1.classList.remove('flipped');
            card2.classList.remove('flipped');
            card1.textContent = '';
            card2.textContent = '';
            flippedCards = [];
        }, 1000);
    }
}

function restart() {
    score = 0;
    document.querySelector('.score').textContent = score;
    flippedCards = [];
    fetch('/cards')
        .then(response => response.json())
        .then(data => {
            cards = data;
            createCards();
        });
}
