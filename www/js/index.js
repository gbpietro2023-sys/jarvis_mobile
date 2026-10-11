document.addEventListener('deviceready', onDeviceReady, false);

var API_BASE = "http://192.168.1.6:5000";

function falar(texto) {
    if (!window.speechSynthesis) return;
    var utter = new SpeechSynthesisUtterance(texto);
    utter.lang = 'pt-BR';
    speechSynthesis.speak(utter);
}

function onDeviceReady() {
    document.getElementById('status').innerText = "JARVIS pronto.";
    falar("Sistemas on-line, senhor.");
    iniciarRastreamento();
    document.getElementById('btnOndeEstou').addEventListener('click', perguntarOndeEstou);
}

function iniciarRastreamento() {
    navigator.geolocation.watchPosition(function(pos) {
        document.getElementById('coords').innerText =
            "Lat: " + pos.coords.latitude.toFixed(5) + ", Lon: " + pos.coords.longitude.toFixed(5);
    }, function(err) {
        document.getElementById('status').innerText = "Erro de localização: " + err.message;
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 });
}

function perguntarOndeEstou() {
    navigator.geolocation.getCurrentPosition(function(pos) {
        var lat = pos.coords.latitude;
        var lon = pos.coords.longitude;
        fetch(API_BASE + "/api/onde_estou?lat=" + lat + "&lon=" + lon)
            .then(function(res) { return res.json(); })
            .then(function(data) {
                document.getElementById('status').innerText = data.endereco;
                falar("Senhor, você está em " + data.endereco);
            })
            .catch(function() {
                falar("Não consegui me conectar ao backend.");
            });
    }, function(err) {
        falar("Não consegui obter sua localização.");
    }, { enableHighAccuracy: true, timeout: 15000 });
}
