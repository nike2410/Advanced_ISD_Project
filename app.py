from flask import Flask

app = Flask(__Name__)

@app.route("/")
def hello_world():
  return"<p>Hello, World!</p>
