import random
import os
import uuid
from flask import Flask, render_template, request, session, jsonify, redirect, url_for
from flask_login import LoginManager, login_user, login_required, logout_user, UserMixin, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from flask_sqlalchemy import SQLAlchemy
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from dotenv import load_dotenv

# standard initialization of flask app
app = Flask(__name__, template_folder='templates', static_folder='static')
app.secret_key = os.urandom(24)  # Secret key for session management

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Game constants
total_pairs = 8  # Number of card pairs for the game

# User model definition
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(150), nullable=False)
    high_score = db.Column(db.Integer, default=0)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class VerificationCode(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(150), nullable=False, unique=True)
    code = db.Column(db.String(6), nullable=False)
    password_hash = db.Column(db.String(150), nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

# Flask-Login setup
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

def send_verification_email(to_email, code):
    message = Mail(
        from_email='trimygame@outlook.com',
        to_emails=to_email,
        subject='Your Memory Game Verification Code',
        html_content=f'<strong>Your code is: {code}</strong>'
    )
    try:
        sg = SendGridAPIClient("INSERT THE API")
        response = sg.send(message)
        print("STATUS:", response.status_code)
        print("HEADERS:", response.headers)
    except Exception as e:
        print("SENDGRID ERROR:", str(e))

# Game helper functions
def create_cards():
    #Create and shuffle memory game cards
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    image_folder = os.path.join(BASE_DIR, 'static', 'images', 'Photos')

    if not os.path.isdir(image_folder):
        raise FileNotFoundError(f"Folder not found: {image_folder}")
    all_images = [f for f in os.listdir(image_folder) if f.lower().endswith('.jpg')] #read the whole folder and store picture in .jpg format
    selected_images = random.sample(all_images, 8) #select randon 8 pictures

    # Create pairs by duplicating each image and saving it in a list
    cards = []
    for image in selected_images:
        image_path = os.path.join('static', 'images', 'Photos', image) #get the path of every selected picture and double it
        cards.extend([image_path, image_path])

    # randomly shuffle the list of cards
    random.shuffle(cards)

    # use list comprehension to give all 16 cards the needed properties
    card_objects = [
        {
            'id': i,
            'image_path': image_path,
            'is_flipped': False, #those states will be changed when clicked / matched
            'is_matched': False
        } for i, image_path in enumerate(cards) #use enumerate to add an id (0 to 15) to the cards
    ]
    return card_objects


def cleanup_old_sessions(session, max_sessions=3):          #try to solve 502 error
    game_keys = [key for key in list(session.keys()) if key.startswith('game_')]        # Get all keys that start with 'game_'

    if len(game_keys) > max_sessions:
        game_keys.sort()

        # Remove the oldest sessions, keeping only max_sessions
        sessions_to_remove = game_keys[:-max_sessions]
        for key in sessions_to_remove:
            session.pop(key, None)
        session.modified = True #save changes


def start_new_game():
    #initialize a new game session
    # Generate unique game ID
    game_id = str(uuid.uuid4())

    # Set up initial game state
    game_state = {
        'cards': create_cards(),
        'total_pairs': total_pairs,
        'flipped_cards': [],
        'matched_pairs': 0,
        'moves': 0,
        'game_completed': False
    }
    cleanup_old_sessions(session)               # Clean up old sessions before adding a new one
    return game_id, game_state


def calculate_score(moves, seconds_elapsed, total_pairs):
    # Minimum possible moves is equal to the number of pairs (right now 8, subject to change if we implement a hard mode)
    min_possible_moves = total_pairs
    base_score = 10000

    # Penalty per extra move (beyond the minimum)
    move_penalty = 80
    extra_moves = max(0, moves - min_possible_moves)
    move_deduction = extra_moves * move_penalty

    # Time penalty (points deducted per second)
    time_penalty = 10
    time_deduction = seconds_elapsed * time_penalty

    score = max(100, base_score - move_deduction - time_deduction)

    return int(score) #int to make sure its a whole number

#print(calculate_score(12, 24, 8))

""" 
def calculate_score(moves, seconds_elapsed):
    base = 5000
    move_penalty = moves * 30
    time_penalty = time * 5
    return max(100, base - move_penalty - time_penalty)

"""

@app.route('/save_score', methods=['POST'])
@login_required #make sure user is logged in
def save_score(): #Save game score to user's record if it's a high score

    # Get the game results from psot request
    data = request.json
    moves = data.get('moves')   # extract values from data
    seconds_elapsed = data.get('seconds') #

    # Calculate score using our algorithm
    game_id = session.get('game_id')

    game_state = session[f'game_{game_id}']
    total_pairs = game_state['total_pairs']

    score = calculate_score(moves, seconds_elapsed, total_pairs)

    # Check if this is a new high score for the user
    user = current_user
    is_high_score = False

    if score > user.high_score: # compare the current scrore to his best from the db
        user.high_score = score
        db.session.commit()
        is_high_score = True

    return jsonify({  #return response about the score to js as a json
        'score': score,
        'is_high_score': is_high_score,
        'high_score': user.high_score
    })

@app.route('/leaderboard')
def leaderboard():
    top_users = User.query.order_by(User.high_score.desc()).limit(10).all()
    return render_template('leaderboard.html', users=top_users)

# Authentication routes
@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        # Only allow university email addresses
        if not username:
            return render_template('signup.html',
                                   error="Username is required.",
                                   suggestions=[],
                                   original_username="")
        elif not username.strip().endswith('@gmail.com'):
            return render_template('signup.html',
                                   error="Only Google emails (@gmail.com) are allowed.",
                                   suggestions=[],
                                   original_username=username)
            return render_template('signup.html',
                                   error="Only Google emails (@gmail.com) are allowed.",
                                   suggestions=[],
                                   original_username=username)
        print("Passed email check, sending code to:", username)

        existing_user = User.query.filter_by(username=username).first()

        # Generate verification code
        code = str(random.randint(100000, 999999))
        password_hash = generate_password_hash(password)

        # Remove any existing code for that email
        VerificationCode.query.filter_by(email=username).delete()

        # Save new code to database
        verification = VerificationCode(email=username, code=code, password_hash=password_hash)
        db.session.add(verification)
        db.session.commit()

        send_verification_email(username, code)

        return render_template('verify.html', email=username)

    return render_template('signup.html')

@app.route('/verify', methods=['GET', 'POST'])
def verify():
    if request.method == 'POST':
        username = request.form.get('email')
        entered_code = request.form.get('code')

        verification = VerificationCode.query.filter_by(email=username).first()
        if verification:
            correct_code = verification.code
            password_hash = verification.password_hash

            if entered_code == correct_code:
                print("Correct verification code entered.")
                print("Creating user with:", username)

                user = User(username=username, password_hash=password_hash)
                db.session.add(user)
                db.session.commit()

                print("User committed to DB:", user)

                db.session.delete(verification)
                db.session.commit()

                return redirect(url_for('login', verified='true'))

            else:
                return render_template('verify.html', email=username, error="Incorrect code.")
        else:
            return render_template('verify.html', email=username, error="No verification record found.")
    email = request.args.get('email', '')
    return render_template('verify.html', email=email)

@app.route('/login', methods=['GET', 'POST'])
def login():
    verified = request.args.get('verified')
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        # Verify user credentials
        user = User.query.filter_by(username=username).first()
        if user and user.check_password(password):
            login_user(user)
            return redirect(url_for('index'))
        return 'Invalid username or password'

    # GET request - display login form
    return render_template('login.html', verified=verified)

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))


# Game routes
@app.route('/')
@login_required
def index():   #check if we still need this? game gets started with the button now?
    #Main game page - start a new game
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
    #Create a new game session
    game_id, game_state = start_new_game() #calls function from above
    session['game_id'] = game_id
    session[f'game_{game_id}'] = game_state #create unique key for each state (for now one)
    return redirect(url_for('index'))


@app.route('/flip_card', methods=['POST'])
@login_required #redirect to login page if user is not logged in
def flip_card():
    """Handle card flip actions"""
    # Get current game from session
    game_id = session.get('game_id') #get the gameid from the session
    game_state = session[f'game_{game_id}'] #get the state by looking for the id in the session

    # Get card ID from the js request
    card_id = int(request.form.get('card_id'))  #TODO: check if int is needed anymore?

    # use the cardid to get the card
    card = game_state['cards'][card_id]

    # Check if card can be flipped
    if card['is_flipped'] or card['is_matched'] or game_state['game_completed']:
        return jsonify(game_state), 200
    card['is_flipped'] = True                # Flip the card and add to list
    game_state['flipped_cards'].append(card_id)

    # Process logic for two flipped cards
    result = {}
    if len(game_state['flipped_cards']) == 2:
        game_state['moves'] = game_state['moves'] + 1
        first_card_id, second_card_id = game_state['flipped_cards']
        first_card = game_state['cards'][first_card_id]
        second_card = game_state['cards'][second_card_id]

        # Check for match
        if first_card['image_path'] == second_card['image_path']:
            # Match found - update card status
            first_card['is_matched'] = True
            second_card['is_matched'] = True
            game_state['matched_pairs'] += 1
            result['match_found'] = True
            result['matched_card_ids'] = [first_card_id, second_card_id]
            game_state['flipped_cards'] = []   #reset flipped cards list

            # Check if game is complete
            if game_state['matched_pairs'] >= game_state['total_pairs']:
                game_state['game_completed'] = True
                result['moves'] = game_state['moves']
        else:
            # No match - cards will be flipped back
            result['no_match'] = True
            result['cards_to_flip_back'] = game_state['flipped_cards']
            game_state['flipped_cards'] = []

    # Update session and return response
    session[f'game_{game_id}'] = game_state
    session.modified = True       # used to make sure changes are registered by flask

    # Create response with game state and result data
    response_data = game_state.copy()
    response_data.update(result)
    return jsonify(response_data)


@app.route('/reset_flipped_cards', methods=['POST'])
@login_required
def reset_flipped_cards():
    #Reset cards that don't match back to unflipped state
    game_id = session.get('game_id')
    if not game_id or f'game_{game_id}' not in session:
        return jsonify({'error': 'No active game'}), 400

    game_state = session[f'game_{game_id}']
    card_ids = request.json.get('card_ids', [])

    # Reset the flipped state for these cards
    for card_id in card_ids:
        if 0 <= card_id < len(game_state['cards']):
            game_state['cards'][card_id]['is_flipped'] = False

    # Update session and return game state
    session[f'game_{game_id}'] = game_state
    return jsonify(game_state)


@app.route('/preload_images')
@login_required
def preload_images():
    #Return paths of card images for preloading
    card_symbols = [
        f'static/images/card_pictures/card_picture_{i}.jpg' for i in range(1, 9)
    ]
    return jsonify(images=card_symbols)


# Create database tables on application startup
with app.app_context():
    db.create_all()

if __name__ == "__main__":
    app.run(debug=True, port=5001)

# still needed? maybe delete
with app.app_context():
    users = User.query.all()
    print("All users in database:")
    for user in users:
        print(f"- {user.username}")