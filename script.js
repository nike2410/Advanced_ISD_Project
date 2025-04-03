document.getElementById('dark-mode').addEventListener('click', function() {
    document.body.classList.toggle('dark-mode');

    const cards = [
    { id: 1, img: 'img1.png' },
    { id: 2, img: 'img2.png' },
    // Add more cards here
];

let shuffledCards = shuffle(cards.concat(cards)); // Duplicate and shuffle cards

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function createCard(card) {
    const cardElement = document.createElement('div');
    cardElement.classList.add('card');
    cardElement.dataset.id = card.id;
    cardElement.innerHTML = `<img src="${card.img}" class="front"><div class="back"></div>`;
    cardElement.addEventListener('click', flipCard);
    return cardElement;
}

function flipCard() {
    // Add flip logic here
}

function restart() {
    // Add restart logic here
}

document.querySelector('.grid-container').append(...shuffledCards.map(createCard));
});