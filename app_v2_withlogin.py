import random
from flask import Flask, render_template, request, session, jsonify, redirect, url_for
import os
import uuid
from flask_login import LoginManager, login_user, login_required, logout_user, UserMixin, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__,
            template_folder='templates',
            static_folder='static')
app.secret_key = os.urandom(24)  # generates the secret key for the session

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'  # Database file
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False  # Disable warnings

db = SQLAlchemy(app)

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(150), nullable=False)
    high_score = db.Column(db.Integer, default=0)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

#Integrating Login part
# Set up Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


###########

total_pairs = 8  # as we only have one game mode so far we use this constant

#function to create the card entities, load different lists with properties
def create_cards():
    # Define the card symbols we'll use
    card_symbols = [
        'static/images/card_pictures/card_picture_1.jpg',
        'static/images/card_pictures/card_picture_2.jpg',
        'static/images/card_pictures/card_picture_3.jpg',
        'static/images/card_pictures/card_picture_4.jpg',
        'static/images/card_pictures/card_picture_5.jpg',
        'static/images/card_pictures/card_picture_6.jpg',
        'static/images/card_pictures/card_picture_7.jpg',
        'static/images/card_pictures/card_picture_8.jpg'
    ]  # will add the real pictures later, currently only stock photos

    # Create pairs by duplicating each symbol
    cards = []
    for image_path in card_symbols:
        cards.append(image_path)
        cards.append(image_path)

    # Shuffle the cards
    random.shuffle(cards)

    # Create card objects with necessary properties
    card_objects = []
    for i, image_path in enumerate(cards):
        card_objects.append({
            'id': i,
            'image_path': image_path,
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










# --- Game Routes Protected by Login ---

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        password_hash = generate_password_hash(password)

        # Check if the user already exists
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            # Suggest some usernames
            suggestions = [
                f"{username}{random.randint(1, 100)}",
                f"{username}_{random.randint(100, 999)}",
                f"{username}{random.randint(1000, 9999)}"
            ]
            return render_template('signup.html',
                                   error="Username already exists!",
                                   suggestions=suggestions,
                                   original_username=username)

        # Create new user and save to DB
        user = User(username=username, password_hash=password_hash)
        db.session.add(user)
        db.session.commit()

        print(f"User {user.username} saved to DB with ID {user.id}")  # DEBUG PRINT

        login_user(user)
        return redirect(url_for('index'))
    return render_template('signup.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        user = User.query.filter_by(username=username).first()
        if user and user.check_password(password):
            login_user(user)
            return redirect(url_for('index'))
        return 'Invalid username or password'
    return render_template('login.html')


@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/')
@login_required
def index():
    game_id, game_state = start_new_game()
    session['game_id'] = game_id
    session[f'game_{game_id}'] = game_state
    return render_template('index.html',
                           game_id=game_id,
                           game_state=game_state,
                           username=current_user.username)

@app.route('/new_game', methods=['POST'])
@login_required
def new_game():
    game_id, game_state = start_new_game()
    session['game_id'] = game_id
    session[f'game_{game_id}'] = game_state
    return redirect(url_for('index'))

@app.route('/flip_card', methods=['POST'])
@login_required
def flip_card():
    game_id = session.get('game_id')
    if not game_id or f'game_{game_id}' not in session:
        return jsonify({'error': 'No active game'}), 400

    game_state = session[f'game_{game_id}']
    card_id = int(request.form.get('card_id', -1))
    if card_id < 0 or card_id >= len(game_state['cards']):
        return jsonify({'error': 'Invalid card ID'}), 400

    card = game_state['cards'][card_id]

    if card['is_flipped'] or card['is_matched'] or game_state['game_completed']:
        return jsonify(game_state), 200

    card['is_flipped'] = True
    game_state['flipped_cards'].append(card_id)

    result = {}
    if len(game_state['flipped_cards']) == 2:
        game_state['moves'] += 1
        first_card_id, second_card_id = game_state['flipped_cards']
        first_card = game_state['cards'][first_card_id]
        second_card = game_state['cards'][second_card_id]

        if first_card['image_path'] == second_card['image_path']:
            first_card['is_matched'] = True
            second_card['is_matched'] = True
            game_state['matched_pairs'] += 1
            result['match_found'] = True
            result['matched_card_ids'] = [first_card_id, second_card_id]
            game_state['flipped_cards'] = []

            if game_state['matched_pairs'] >= game_state['total_pairs']:
                game_state['game_completed'] = True
                result['moves'] = game_state['moves']
        else:
            result['no_match'] = True
            result['cards_to_flip_back'] = game_state['flipped_cards']
            game_state['flipped_cards'] = []

    session[f'game_{game_id}'] = game_state
    session.modified = True
    response_data = game_state.copy()
    response_data.update(result)
    return jsonify(response_data)

@app.route('/reset_flipped_cards', methods=['POST'])
@login_required
def reset_flipped_cards():
    game_id = session.get('game_id')
    if not game_id or f'game_{game_id}' not in session:
        return jsonify({'error': 'No active game'}), 400

    game_state = session[f'game_{game_id}']
    card_ids = request.json.get('card_ids', [])

    for card_id in card_ids:
        if 0 <= card_id < len(game_state['cards']):
            game_state['cards'][card_id]['is_flipped'] = False

    session[f'game_{game_id}'] = game_state
    return jsonify(game_state)

@app.route('/preload_images')
@login_required
def preload_images():
    card_symbols = [
        'static/images/card_pictures/card_picture_1.jpg',
        'static/images/card_pictures/card_picture_2.jpg',
        'static/images/card_pictures/card_picture_3.jpg',
        'static/images/card_pictures/card_picture_4.jpg',
        'static/images/card_pictures/card_picture_5.jpg',
        'static/images/card_pictures/card_picture_6.jpg',
        'static/images/card_pictures/card_picture_7.jpg',
        'static/images/card_pictures/card_picture_8.jpg'
    ]
    return jsonify(images=card_symbols)

# Create the database tables (if not already created)
with app.app_context():
    db.create_all()

if __name__ == "__main__":
    app.run(debug=True, port=5001)







# # Routes
# @app.route('/')
# def index():
#     # Start a new game when visiting the homepage
#     game_id, game_state = start_new_game()
#
#     # Store game state in session
#     session['game_id'] = game_id
#     session[f'game_{game_id}'] = game_state
#
#     return render_template('index.html',
#                            game_id=game_id,
#                            game_state=game_state)
#
# @app.route('/new_game', methods=['POST'])
# def new_game():
#     # Create new game
#     game_id, game_state = start_new_game()
#
#     # Store in session
#     session['game_id'] = game_id
#     session[f'game_{game_id}'] = game_state
#
#     return redirect(url_for('index'))
#
#
# @app.route('/flip_card', methods=['POST'])
# def flip_card():
#     # Get current game
#     game_id = session.get('game_id')
#     if not game_id or f'game_{game_id}' not in session:
#         return jsonify({'error': 'No active game'}), 400
#
#     game_state = session[f'game_{game_id}']
#
#     # Get card ID from request
#     card_id = int(request.form.get('card_id', -1))
#     if card_id < 0 or card_id >= len(game_state['cards']):
#         return jsonify({'error': 'Invalid card ID'}), 400
#
#     # Get the card
#     card = game_state['cards'][card_id]
#
#     # Check if card can be flipped
#     if card['is_flipped'] or card['is_matched'] or game_state['game_completed']:
#         return jsonify(game_state), 200
#
#     # Flip the card
#     card['is_flipped'] = True
#     game_state['flipped_cards'].append(card_id)
#
#     # Process logic for two flipped cards
#     result = {}
#     if len(game_state['flipped_cards']) == 2:
#         game_state['moves'] += 1
#
#         # Get the two flipped cards
#         first_card_id = game_state['flipped_cards'][0]
#         second_card_id = game_state['flipped_cards'][1]
#         first_card = game_state['cards'][first_card_id]
#         second_card = game_state['cards'][second_card_id]
#
#         # Check for match
#         if first_card['image_path'] == second_card['image_path']:
#             #adjust status of cards
#             first_card['is_matched'] = True
#             second_card['is_matched'] = True
#             game_state['matched_pairs'] += 1
#             result['match_found'] = True
#             result['matched_card_ids'] = [first_card_id, second_card_id]
#             game_state['flipped_cards'] = []
#
#             # Check if game is complete
#             if game_state['matched_pairs'] >= game_state['total_pairs']:
#                 game_state['game_completed'] = True
#                 result['moves'] = game_state['moves']
#         else:
#             # No match - cards will be flipped back
#             result['no_match'] = True
#             result['cards_to_flip_back'] = game_state['flipped_cards']
#             game_state['flipped_cards'] = []
#
#     # Update session and return game state
#     session[f'game_{game_id}'] = game_state
#     session.modified = True
#
#     # create copy and merge to avoid duplicate keys
#     response_data = game_state.copy()  # Create a copy of game_state
#     response_data.update(result)  # Update with result (this will overwrite any duplicate keys)
#
#     return jsonify(response_data)  # Return the merged dictionary
#
# #route that handles the back flipping of the cards
# @app.route('/reset_flipped_cards', methods=['POST'])
# def reset_flipped_cards():
#     #Endpoint to reset flipped cards when they dont match
#     game_id = session.get('game_id')
#     if not game_id or f'game_{game_id}' not in session:
#         return jsonify({'error': 'No active game'}), 400
#
#     game_state = session[f'game_{game_id}']
#
#     # Get card IDs from request
#     card_ids = request.json.get('card_ids', [])
#
#     # Reset the flipped state for these cards
#     for card_id in card_ids:
#         if 0 <= card_id < len(game_state['cards']):
#             game_state['cards'][card_id]['is_flipped'] = False
#
#     # Update session and return game state
#     session[f'game_{game_id}'] = game_state
#     return jsonify(game_state)
#
# #reload the card pictures for better performance - important for time keeping mode (will be added later)
# @app.route('/preload_images')
# def preload_images():
#     card_symbols = [
#         'static/images/card_pictures/card_picture_1.jpg',
#         'static/images/card_pictures/card_picture_2.jpg',
#         'static/images/card_pictures/card_picture_3.jpg',
#         'static/images/card_pictures/card_picture_4.jpg',
#         'static/images/card_pictures/card_picture_5.jpg',
#         'static/images/card_pictures/card_picture_6.jpg',
#         'static/images/card_pictures/card_picture_7.jpg',
#         'static/images/card_pictures/card_picture_8.jpg'
#     ]
#     return jsonify(images=card_symbols)
#
# if __name__ == "__main__":
#     app.run(debug=True)