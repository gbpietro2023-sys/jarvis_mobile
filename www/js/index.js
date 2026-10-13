document.addEventListener('deviceready', onDeviceReady, false);

var DEFAULT_API_BASE = "http://192.168.1.6:5000";
var API_BASE = localStorage.getItem('jarvis_api_base') || DEFAULT_API_BASE;
var escutaEmAndamento = false;

function falar(texto) {
    if (window.TTS) {
        TTS.speak({ text: texto, locale: 'pt-BR', rate: 1.0 });
    } else if (window.speechSynthesis) {
        var utter = new SpeechSynthesisUtterance(texto);
        utter.lang = 'pt-BR';
        speechSynthesis.speak(utter);
    }
}

function onDeviceReady() {
    document.getElementById('status').innerText = "JARVIS pronto.";
    document.getElementById('serverAddress').value = API_BASE;
    falar("Sistemas on-line, senhor.");
    iniciarRastreamento();
    document.getElementById('btnOndeEstou').addEventListener('click', perguntarOndeEstou);
    document.getElementById('btnTracarRota').addEventListener('click', function() {
        tracarRota(document.getElementById('destino').value);
    });
    document.getElementById('btnMicrofone').addEventListener('click', iniciarEscuta);
    document.getElementById('btnSalvarEndereco').addEventListener('click', salvarEndereco);
    document.getElementById('btnTestarConexao').addEventListener('click', testarConexao);
}

function salvarEndereco() {
    var novoEndereco = document.getElementById('serverAddress').value.trim();
    var connStatus = document.getElementById('connStatus');
    if (!novoEndereco) {
        connStatus.innerText = "Endereço não pode ficar vazio.";
        connStatus.style.color = "#f55";
        return;
    }
    if (novoEndereco.endsWith("/")) {
        novoEndereco = novoEndereco.slice(0, -1);
    }
    API_BASE = novoEndereco;
    localStorage.setItem('jarvis_api_base', API_BASE);
    connStatus.innerText = "Endereço salvo: " + API_BASE;
    connStatus.style.color = "#0f0";
}

function testarConexao() {
    var connStatus = document.getElementById('connStatus');
    var controller = new AbortController();
    var terminou = false;

    connStatus.innerText = "Testando conexão...";
    connStatus.style.color = "#999";

    var timeout = setTimeout(function() {
        terminou = true;
        controller.abort();
        connStatus.innerText = "Tempo esgotado ao conectar. Verifique o servidor e a rede.";
        connStatus.style.color = "#f55";
    }, 8000);

    fetch(API_BASE + "/api/status", {
        method: "GET",
        signal: controller.signal
    })
        .then(function(res) {
            if (!res.ok) {
                throw new Error("Resposta inválida do servidor.");
            }
            return res.json();
        })
        .then(function(data) {
            if (terminou) return;
            clearTimeout(timeout);

            if (data && data.status === "online") {
                connStatus.innerText = "Conectado com sucesso ao servidor.";
                connStatus.style.color = "#0f0";
            } else {
                connStatus.innerText = "Servidor respondeu, mas o status é inesperado.";
                connStatus.style.color = "#f55";
            }
        })
        .catch(function(err) {
            if (terminou) return;
            clearTimeout(timeout);
            connStatus.innerText = "Falha ao conectar: verifique o servidor e o endereço.";
            connStatus.style.color = "#f55";
        });
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

function tracarRota(destino) {
    if (!destino) {
        falar("Por favor, diga ou digite um destino.");
        return;
    }
    falar("Traçando rota para " + destino);
    var url = "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(destino) + "&travelmode=driving";
    if (window.cordova && cordova.InAppBrowser) {
        cordova.InAppBrowser.open(url, "_system");
    } else {
        window.open(url, "_system");
    }
}

// ---- Reconhecimento de voz ----

function definirEstadoBotaoMicrofone(ativo) {
    var btn = document.getElementById('btnMicrofone');
    btn.disabled = ativo;
    btn.style.opacity = ativo ? "0.5" : "1";
}

function encerrarEscuta() {
    escutaEmAndamento = false;
    definirEstadoBotaoMicrofone(false);
}

function iniciarEscuta() {
    var voiceStatus = document.getElementById('voiceStatus');

    // Protecao contra captura simultanea: ignora toques enquanto ja
    // existe uma escuta em andamento (botao tambem fica desabilitado
    // visualmente, mas esta checagem e a garantia logica real).
    if (escutaEmAndamento) {
        return;
    }

    if (!window.plugins || !window.plugins.speechRecognition) {
        voiceStatus.innerText = "Reconhecimento de voz não disponível neste dispositivo.";
        falar("Reconhecimento de voz não está disponível.");
        return;
    }

    escutaEmAndamento = true;
    definirEstadoBotaoMicrofone(true);

    var speech = window.plugins.speechRecognition;

    speech.hasPermission(function(hasPermission) {
        if (hasPermission) {
            escutar();
        } else {
            speech.requestPermission(function() {
                escutar();
            }, function() {
                voiceStatus.innerText = "Permissão de microfone negada.";
                falar("Preciso de permissão para usar o microfone.");
                encerrarEscuta();
            });
        }
    }, function() {
        voiceStatus.innerText = "Erro ao verificar permissão do microfone.";
        falar("Não consegui verificar a permissão do microfone.");
        encerrarEscuta();
    });

    function escutar() {
        voiceStatus.innerText = "🎤 Ouvindo... fale agora.";
        speech.startListening(function(matches) {
            voiceStatus.innerText = "Processando comando...";
            if (matches && matches.length > 0) {
                processarComando(matches[0]);
            } else {
                voiceStatus.innerText = "Não entendi, tente novamente.";
                falar("Não entendi o comando.");
            }
            encerrarEscuta();
        }, function(error) {
            // O plugin nativo nao garante um codigo de erro detalhado e
            // consistente entre fabricantes de Android, por isso usamos
            // uma mensagem generica para qualquer falha de captura
            // (inclui timeout de silencio, sem rede quando o motor
            // online e usado, ou falha interna do reconhecedor).
            voiceStatus.innerText = "Erro na captura de voz. Tente novamente.";
            falar("Houve um erro ao tentar escutar.");
            encerrarEscuta();
        }, {
            language: "pt-BR",
            matches: 1,
            showPopup: false
        });
    }
}

function processarComando(texto) {
    var voiceStatus = document.getElementById('voiceStatus');
    var comando = texto.toLowerCase();
    voiceStatus.innerText = 'Comando reconhecido: "' + texto + '"';

    if (comando.indexOf("onde") !== -1) {
        perguntarOndeEstou();
    } else if (comando.indexOf("rota") !== -1 || comando.indexOf("traçar") !== -1 || comando.indexOf("tracar") !== -1) {
        var destino = texto;
        var marcador = comando.indexOf(" para ");
        if (marcador !== -1) {
            destino = texto.substring(marcador + 6);
        }
        document.getElementById('destino').value = destino;
        tracarRota(destino);
    } else {
        falar("Comando não reconhecido. Diga onde eu estou, ou traçar rota para um destino.");
        voiceStatus.innerText = "Comando não reconhecido.";
    }
}
