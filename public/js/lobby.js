// Configuration
const WS_URL = `ws://${window.location.hostname}:8081`;

// État de l'application
let ws = null;
let clientId = null;
let username = '';
let currentRoomCode = null;
let isHost = false;
let isReady = false;
let currentMode = 'essais';

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
    roomModeText: document.getElementById('room-mode-text'),
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
        }, 2000);
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

        case 'room-created':
            currentRoomCode = message.data.code;
            currentMode = message.data.mode;
            isHost = true;
            showRoomScreen();
            break;

        case 'room-joined':
            currentRoomCode = message.data.code;
            currentMode = message.data.mode;
            isHost = false;
            showRoomScreen();
            break;

        case 'room-status':
            updateRoomStatus(message.data);
            break;

        case 'player-joined':
            console.log(`👋 ${message.data.username} a rejoint le salon`);
            break;

        case 'player-left':
            console.log(`👋 ${message.data.username} a quitté le salon`);
            break;

        case 'room-left':
            currentRoomCode = null;
            isHost = false;
            isReady = false;
            showScreen('menu');
            break;

        case 'game-start':
            // Rediriger vers la page de jeu multijoueur
            sessionStorage.setItem('tusmo-multiplayer', JSON.stringify({
                roomCode: currentRoomCode,
                mode: currentMode,
                wordLength: message.data.wordLength,
                firstLetter: message.data.firstLetter,
                username: username
            }));
            window.location.href = 'multiplayer.html';
            break;

        case 'error':
            showError(message.data.message);
            break;

        default:
            console.log('⚠️ Type de message inconnu:', message.type);
    }
}

// Envoyer un message au serveur
function sendMessage(type, data = {}) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, data }));
    } else {
        console.error('❌ WebSocket non connecté');
        showError('Connexion perdue avec le serveur');
    }
}

// Afficher l'écran du salon
function showRoomScreen() {
    elements.roomCode.textContent = currentRoomCode;
    const modeText = currentMode === 'essais' ? '⏱️ Moins d\'essais' : '⚡ Moins de temps';
    elements.roomModeText.textContent = modeText;
    
    elements.toggleReadyBtn.style.display = 'block';
    elements.startGameBtn.style.display = isHost ? 'block' : 'none';
    
    isReady = false;
    updateReadyButton();
    
    showScreen('room');
}

// Mettre à jour le statut du salon
function updateRoomStatus(data) {
    const players = data.players || [];
    elements.playerCount.textContent = players.length;
    elements.playersList.innerHTML = '';

    players.forEach(player => {
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item' + (player.isReady ? ' ready' : '');

        const playerInfo = document.createElement('div');
        playerInfo.className = 'player-info';

        const avatar = document.createElement('div');
        avatar.className = 'player-avatar';
        avatar.textContent = player.username.charAt(0).toUpperCase();

        const name = document.createElement('div');
        name.className = 'player-name';
        name.textContent = player.username;

        playerInfo.appendChild(avatar);
        playerInfo.appendChild(name);

        const badges = document.createElement('div');
        badges.className = 'player-badges';

        if (player.isHost) {
            const hostBadge = document.createElement('span');
            hostBadge.className = 'badge badge-host';
            hostBadge.textContent = '👑 Hôte';
            badges.appendChild(hostBadge);
        }

        if (player.isReady) {
            const readyBadge = document.createElement('span');
            readyBadge.className = 'badge badge-ready';
            readyBadge.textContent = '✓ Prêt';
            badges.appendChild(readyBadge);
        }

        playerItem.appendChild(playerInfo);
        playerItem.appendChild(badges);
        elements.playersList.appendChild(playerItem);
    });

    // Mettre à jour le bouton de démarrage
    const allReady = players.length >= 2 && players.every(p => p.isReady);
    elements.startGameBtn.disabled = !allReady;
}

// Mettre à jour le bouton "Prêt"
function updateReadyButton() {
    if (isReady) {
        elements.toggleReadyBtn.textContent = '✓ Prêt';
        elements.toggleReadyBtn.classList.remove('btn-secondary');
        elements.toggleReadyBtn.classList.add('btn-primary');
    } else {
        elements.toggleReadyBtn.innerHTML = '<span class="ready-icon">✓</span> Je suis prêt';
        elements.toggleReadyBtn.classList.remove('btn-primary');
        elements.toggleReadyBtn.classList.add('btn-secondary');
    }
}

// Event Listeners

// Connexion
elements.connectBtn.addEventListener('click', () => {
    const inputUsername = elements.usernameInput.value.trim();
    
    if (inputUsername.length < 2) {
        showError('Le pseudo doit contenir au moins 2 caractères');
        return;
    }

    sendMessage('set-username', { username: inputUsername });
});

elements.usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        elements.connectBtn.click();
    }
});

// Création de salon
elements.createRoomBtn.addEventListener('click', () => {
    const selectedMode = document.querySelector('input[name="mode"]:checked').value;
    currentMode = selectedMode;
    sendMessage('create-room', { mode: selectedMode });
});

// Rejoindre un salon
elements.joinRoomBtn.addEventListener('click', () => {
    const code = elements.roomCodeInput.value.trim().toUpperCase();
    
    if (code.length !== 4) {
        showError('Le code doit contenir 4 lettres');
        return;
    }

    sendMessage('join-room', { code });
});

elements.roomCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        elements.joinRoomBtn.click();
    }
});

// Forcer les majuscules dans le champ de code
elements.roomCodeInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
});

// Quitter le salon
elements.leaveRoomBtn.addEventListener('click', () => {
    sendMessage('leave-room');
});

// Toggle prêt
elements.toggleReadyBtn.addEventListener('click', () => {
    isReady = !isReady;
    updateReadyButton();
    sendMessage('toggle-ready');
});

// Démarrer la partie
elements.startGameBtn.addEventListener('click', () => {
    sendMessage('start-game');
});

// Fermer le modal d'erreur
elements.errorCloseBtn.addEventListener('click', () => {
    elements.errorModal.classList.remove('active');
});

// Fermer le modal en cliquant à l'extérieur
elements.errorModal.addEventListener('click', (e) => {
    if (e.target === elements.errorModal) {
        elements.errorModal.classList.remove('active');
    }
});

// Initialisation
console.log('🚀 Lobby TUSMO Multijoueur');
elements.connectBtn.disabled = true;
connectWebSocket();
