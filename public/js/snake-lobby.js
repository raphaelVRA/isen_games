// Configuration
const WS_URL = `ws://${window.location.hostname}:8081`;

// État de l'application
let ws = null;
let clientId = null;
let username = '';
let currentRoomCode = null;
let isHost = false;
let isReady = false;

// Éléments DOM
const screens = {
    connect: document.getElementById('connect-screen'),
    menu: document.getElementById('menu-screen'),
    room: document.getElementById('room-screen')
};

const elements = {
    // Écran de connexion
    usernameInput: document.getElementById('username-input'),
    connectBtn: document.getElementById('connect-btn'),
    connectStatus: document.getElementById('connect-status'),

    // Écran menu
    currentUsername: document.getElementById('current-username'),
    createRoomBtn: document.getElementById('create-room-btn'),
    roomCodeInput: document.getElementById('room-code-input'),
    joinRoomBtn: document.getElementById('join-room-btn'),

    // Écran salon
    roomCode: document.getElementById('room-code'),
    playerCount: document.getElementById('player-count'),
    playersList: document.getElementById('players-list'),
    leaveRoomBtn: document.getElementById('leave-room-btn'),
    toggleReadyBtn: document.getElementById('toggle-ready-btn'),
    startGameBtn: document.getElementById('start-game-btn'),

    // Modal
    errorModal: document.getElementById('error-modal'),
    errorMessage: document.getElementById('error-message'),
    errorCloseBtn: document.getElementById('error-close-btn')
};

// Couleurs des joueurs
const PLAYER_COLORS = ['#00ff00', '#ff2e63', '#00f2ff', '#ffd700'];

// Navigation entre les écrans
function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
}

// Afficher une erreur
function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorModal.classList.add('active');
}

// Connexion WebSocket
function connectWebSocket() {
    elements.connectStatus.textContent = 'Connexion au serveur...';
    
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log('✅ Connecté au serveur WebSocket');
        elements.connectStatus.textContent = 'Connecté ! Entrez votre pseudo.';
        elements.connectBtn.disabled = false;
    };

    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            handleServerMessage(message);
        } catch (error) {
            console.error('❌ Erreur lors du traitement du message:', error);
        }
    };

    ws.onerror = (error) => {
        console.error('❌ Erreur WebSocket:', error);
        elements.connectStatus.textContent = 'Erreur de connexion au serveur';
        showError('Impossible de se connecter au serveur. Assurez-vous que le serveur est démarré.');
    };

    ws.onclose = () => {
        console.log('🔌 Connexion fermée');
        elements.connectStatus.textContent = 'Déconnecté du serveur';
        
        // Retour à l'écran de connexion après 2 secondes
        setTimeout(() => {
            showScreen('connect');
            elements.connectBtn.disabled = true;
            // Tentative de reconnexion
            setTimeout(connectWebSocket, 2000);
        }, 1000);
    };
}

// Gérer les messages du serveur
function handleServerMessage(message) {
    console.log('📨 Message reçu:', message);

    switch (message.type) {
        case 'connected':
            clientId = message.data.clientId;
            console.log(`🆔 Client ID: ${clientId}`);
            break;

        case 'username-set':
            username = message.data.username;
            elements.currentUsername.textContent = username;
            showScreen('menu');
            break;

        case 'snake-room-created':
            currentRoomCode = message.data.code;
            isHost = true;
            showRoomScreen();
            break;

        case 'snake-room-joined':
            currentRoomCode = message.data.code;
            isHost = false;
            showRoomScreen();
            break;

        case 'snake-room-status':
            updateRoomStatus(message.data);
            break;

        case 'snake-player-joined':
            console.log(`👋 ${message.data.username} a rejoint le salon`);
            break;

        case 'snake-player-left':
            console.log(`👋 ${message.data.username} a quitté le salon`);
            break;

        case 'snake-room-left':
            currentRoomCode = null;
            isHost = false;
            isReady = false;
            showScreen('menu');
            break;

        case 'snake-countdown':
            // Le compte à rebours commence, on va rediriger
            console.log('🎮 Compte à rebours commencé, préparation...');
            break;

        case 'snake-game-started':
            // Le jeu a démarré, rediriger vers la page du jeu
            sessionStorage.setItem('snake-multiplayer', JSON.stringify({
                roomCode: currentRoomCode,
                username: username,
                wsUrl: WS_URL
            }));
            window.location.href = 'snake.html';
            break;

        case 'error':
            showError(message.data.message);
            break;
    }
}

// Afficher l'écran du salon
function showRoomScreen() {
    showScreen('room');
    elements.roomCode.textContent = currentRoomCode;
    isReady = false;
    updateReadyButton();
}

// Mettre à jour le statut du salon
function updateRoomStatus(data) {
    elements.roomCode.textContent = data.code;
    elements.playerCount.textContent = data.players.length;

    // Mettre à jour la liste des joueurs
    elements.playersList.innerHTML = '';
    
    data.players.forEach((player, index) => {
        const playerCard = document.createElement('div');
        playerCard.className = `player-card ${player.isReady ? 'ready' : ''}`;
        playerCard.style.setProperty('--player-color', player.color || PLAYER_COLORS[index]);
        
        playerCard.innerHTML = `
            <div class="player-avatar" style="background-color: ${player.color || PLAYER_COLORS[index]}">
                🐍
            </div>
            <div class="player-info">
                <span class="player-name">${player.username}</span>
                <span class="player-status">${player.isHost ? '👑 Hôte' : ''} ${player.isReady ? '✓ Prêt' : 'En attente'}</span>
            </div>
        `;
        
        elements.playersList.appendChild(playerCard);
    });

    // Vérifier si on est l'hôte
    const me = data.players.find(p => p.id === clientId);
    if (me) {
        isHost = me.isHost;
        isReady = me.isReady;
        updateReadyButton();
    }

    // Afficher/masquer le bouton de démarrage
    const allReady = data.players.every(p => p.isReady);
    const canStart = isHost && allReady && data.players.length >= 2;
    elements.startGameBtn.style.display = isHost ? 'block' : 'none';
    elements.startGameBtn.disabled = !canStart;
    
    if (!canStart && isHost) {
        if (data.players.length < 2) {
            elements.startGameBtn.textContent = 'En attente de joueurs...';
        } else if (!allReady) {
            elements.startGameBtn.textContent = 'En attente que tous soient prêts...';
        }
    } else {
        elements.startGameBtn.textContent = 'Lancer la partie !';
    }
}

// Mettre à jour le bouton "Prêt"
function updateReadyButton() {
    if (isReady) {
        elements.toggleReadyBtn.textContent = 'Annuler';
        elements.toggleReadyBtn.classList.remove('btn-warning');
        elements.toggleReadyBtn.classList.add('btn-secondary');
    } else {
        elements.toggleReadyBtn.textContent = 'Je suis prêt !';
        elements.toggleReadyBtn.classList.add('btn-warning');
        elements.toggleReadyBtn.classList.remove('btn-secondary');
    }
}

// Envoyer un message au serveur
function send(message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}

// === Event Listeners ===

// Connexion avec pseudo
elements.connectBtn.addEventListener('click', () => {
    const name = elements.usernameInput.value.trim();
    if (name.length < 2) {
        showError('Le pseudo doit contenir au moins 2 caractères');
        return;
    }
    send({ type: 'set-username', data: { username: name } });
});

elements.usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        elements.connectBtn.click();
    }
});

// Créer un salon
elements.createRoomBtn.addEventListener('click', () => {
    send({ type: 'create-snake-room' });
});

// Rejoindre un salon
elements.joinRoomBtn.addEventListener('click', () => {
    const code = elements.roomCodeInput.value.trim().toUpperCase();
    if (code.length !== 4) {
        showError('Le code du salon doit contenir 4 lettres');
        return;
    }
    send({ type: 'join-snake-room', data: { code } });
});

elements.roomCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        elements.joinRoomBtn.click();
    }
});

// Quitter le salon
elements.leaveRoomBtn.addEventListener('click', () => {
    send({ type: 'leave-snake-room' });
});

// Toggle prêt
elements.toggleReadyBtn.addEventListener('click', () => {
    send({ type: 'toggle-snake-ready' });
});

// Démarrer la partie
elements.startGameBtn.addEventListener('click', () => {
    send({ type: 'start-snake-game' });
});

// Fermer la modal d'erreur
elements.errorCloseBtn.addEventListener('click', () => {
    elements.errorModal.classList.remove('active');
});

// Fermer la modal en cliquant à l'extérieur
elements.errorModal.addEventListener('click', (e) => {
    if (e.target === elements.errorModal) {
        elements.errorModal.classList.remove('active');
    }
});

// Démarrer la connexion
connectWebSocket();
