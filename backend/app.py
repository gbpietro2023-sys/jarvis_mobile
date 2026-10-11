from flask import Flask, jsonify, request
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)

@app.route("/api/status")
def status():
    return jsonify({"status": "online"})

@app.route("/api/onde_estou")
def onde_estou():
    lat = request.args.get("lat")
    lon = request.args.get("lon")
    if not lat or not lon:
        return jsonify({"erro": "faltam coordenadas"}), 400
    url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}"
    headers = {"User-Agent": "JARVIS-App"}
    r = requests.get(url, headers=headers, timeout=10)
    dados = r.json()
    endereco = dados.get("display_name", "Endereço não encontrado")
    return jsonify({"endereco": endereco})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
