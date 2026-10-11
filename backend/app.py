from flask import Flask
app = Flask(__name__)

@app.route("/")
def home():
    return "<h1>JARVIS Online</h1><p>Backend Flask conectado com sucesso.</p>"

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000)
