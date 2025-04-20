import random
from flask import Flask, render_template, request, session, jsonify, redirect, url_for
import os
import uuid

app = Flask(__name__,
            template_folder='templates',
            static_folder='static')
app.secret_key = os.urandom(24)  # generates the secret key for the session

total_pairs = 8  # as we only have one game mode so far we use this constant

#function to create the card entities, load different lists with properties
def create_cards():
    # Define the card symbols we'll use
    card_symbols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']  # will be replaced by pictures later

    # Create pairs by duplicating each symbol
    cards = []
    for symbol in card_symbols:
        cards.append(symbol)
        cards.append(symbol)

    # Shuffle the cards
    random.shuffle(cards)

    # Create card objects with necessary properties
    card_objects = []
    for i, symbol in enumerate(cards):
        card_objects.append({
            'id': i,
            'symbol': symbol,
            'is_flipped': False,
            'is_matched': False
        })
    return card_objects

def start_new_game():
    # new session id
    game_id = str(uuid.uuid4())

    game_state = {
        'cards': create_cards(),
        'total_pairs': total_pairs,
        'flipped_cards': [],
        'matched_pairs': 0,
        'moves': 0,
        'game_completed': False
    }
    return game_id, game_state

# Routes
@app.route('/')
def index():
    # Start a new game when visiting the homepage
    game_id, game_state = start_new_game()

    # Store game state in session
    session['game_id'] = game_id
    session[f'game_{game_id}'] = game_state

    return render_template('index.html',
                           game_id=game_id,
                           game_state=game_state)

@app.route('/new_game', methods=['POST'])
def new_game():
    # Create new game
    game_id, game_state = start_new_game()

    # Store in session
    session['game_id'] = game_id
    session[f'game_{game_id}'] = game_state

    return redirect(url_for('index'))


@app.route('/flip_card', methods=['POST'])
def flip_card():
    # Get current game
    game_id = session.get('game_id')
    if not game_id or f'game_{game_id}' not in session:
        return jsonify({'error': 'No active game'}), 400

    game_state = session[f'game_{game_id}']

    # Get card ID from request
    card_id = int(request.form.get('card_id', -1))
    if card_id < 0 or card_id >= len(game_state['cards']):
        return jsonify({'error': 'Invalid card ID'}), 400

    # Get the card
    card = game_state['cards'][card_id]

    # Check if card can be flipped
    if card['is_flipped'] or card['is_matched'] or game_state['game_completed']:
        return jsonify(game_state), 200

    # Flip the card
    card['is_flipped'] = True
    game_state['flipped_cards'].append(card_id)

    # Process logic for two flipped cards
    result = {}
    if len(game_state['flipped_cards']) == 2:
        game_state['moves'] += 1

        # Get the two flipped cards
        first_card_id = game_state['flipped_cards'][0]
        second_card_id = game_state['flipped_cards'][1]
        first_card = game_state['cards'][first_card_id]
        second_card = game_state['cards'][second_card_id]

        # Check for match
        if first_card['symbol'] == second_card['symbol']:
            # It's a match!
            first_card['is_matched'] = True
            second_card['is_matched'] = True
            game_state['matched_pairs'] += 1
            game_state['flipped_cards'] = []

            # Check if game is complete
            if game_state['matched_pairs'] == game_state['total_pairs']:
                game_state['game_completed'] = True
                result['game_completed'] = True
                result['moves'] = game_state['moves']
        else:
            # No match - cards will be flipped back by front-end after delay
            result['no_match'] = True
            result['cards_to_flip_back'] = game_state['flipped_cards']
            game_state['flipped_cards'] = []

    # Update session
    session[f'game_{game_id}'] = game_state

    # Return updated game state
    return jsonify({**game_state, **result})


@app.route('/reset_flipped_cards', methods=['POST'])
def reset_flipped_cards():
    """Endpoint to reset flipped cards when they don't match"""
    game_id = session.get('game_id')
    if not game_id or f'game_{game_id}' not in session:
        return jsonify({'error': 'No active game'}), 400

    game_state = session[f'game_{game_id}']

    # Get card IDs from request
    card_ids = request.json.get('card_ids', [])

    # Reset the flipped state for these cards
    for card_id in card_ids:
        if 0 <= card_id < len(game_state['cards']):
            game_state['cards'][card_id]['is_flipped'] = False

    # Update session
    session[f'game_{game_id}'] = game_state

    return jsonify({'success': True})

if __name__ == "__main__":
    app.run(debug=True)