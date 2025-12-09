// ============================================
// SNAKE MULTIJOUEUR - VERSION FLUIDE 60 FPS
// ============================================

// Configuration
const WS_URL = `ws://${window.location.hostname}:8081`;
const GRID_SIZE = 25;
const CELL_SIZE = 20;
const CANVAS_SIZE = GRID_SIZE * CELL_SIZE; // 500px

// État global
let ws = null;
let clientId = null;
let username = '';
let currentRoomCode = null;
let isHost = false;
let isReady = false;
let myId = null;
let isGameOver = false;
let isInGame = false;

// État du jeu pour interpolation fluide
let players = new Map();
let previousPlayers = new Map();
let food = null;
let previousFood = null;
let lastUpdateTime = 0;
let serverTickRate = 80;
let canvas, ctx;
let animationFrameId = null;

// Système de particules
let particles = [];

// Couleurs des joueurs avec glow
const PLAYER_COLORS = [
    { main: '#00ff00', dark: '#00aa00', glow: 'rgba(0, 255, 0, 0.5)', name: 'Vert' },
    { main: '#ff2e63', dark: '#cc2450', glow: 'rgba(255, 46, 99, 0.5)', name: 'Rouge' },
    { main: '#00f2ff', dark: '#00b8c2', glow: 'rgba(0, 242, 255, 0.5)', name: 'Cyan' },
    { main: '#ffd700', dark: '#ccac00', glow: 'rgba(255, 215, 0, 0.5)', name: 'Jaune' }
];

// ============================================
// ÉLÉMENTS DOM
// ============================================

const lobbyContainer = document.getElementById('lobby-container');
const gameContainer = document.getElementById('game-container');

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
    errorCloseBtn: document.getElementById('error-close-btn'),

    // Jeu
    gameRoomCode: document.getElementById('game-room-code'),
    gameStatus: document.getElementById('game-status'),
    leaveGameBtn: document.getElementById('leave-game-btn'),
    scoresList: document.getElementById('scores-list'),
    myUsername: document.getElementById('my-username'),
    myScore: document.getElementById('my-score'),
    myLength: document.getElementById('my-length'),
    countdownOverlay: document.getElementById('countdown-overlay'),
    countdownNumber: document.getElementById('countdown-number'),
    gameoverOverlay: document.getElementById('gameover-overlay'),
    gameoverTitle: document.getElementById('gameover-title'),
    winnerDisplay: document.getElementById('winner-display'),
    finalScores: document.getElementById('final-scores'),
    returnLobbyBtn: document.getElementById('return-lobby-btn')
};

// ============================================
// NAVIGATION
// ============================================

function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
}

function showLobby() {
    lobbyContainer.style.display = 'block';
    gameContainer.style.display = 'none';
    isInGame = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

function showGame() {
    lobbyContainer.style.display = 'none';
    gameContainer.style.display = 'flex';
    isInGame = true;
    
    // Initialiser le canvas
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    
    // Afficher les infos
    elements.gameRoomCode.textContent = currentRoomCode;
    elements.myUsername.textContent = username;
    elements.gameStatus.textContent = 'Préparation...';
    
    // Réinitialiser l'état
    isGameOver = false;
    players.clear();
    previousPlayers.clear();
    particles = [];
    elements.gameoverOverlay.style.display = 'none';
    elements.countdownOverlay.style.display = 'flex';
    elements.countdownNumber.textContent = '...';
    
    // Démarrer la boucle de rendu 60 FPS
    startRenderLoop();
}

// Boucle de rendu 60 FPS indépendante du serveur
function startRenderLoop() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    
    let lastFrameTime = 0;
    
    function gameLoop(timestamp) {
        if (!isInGame) return;
        
        const deltaTime = timestamp - lastFrameTime;
        lastFrameTime = timestamp;
        
        render(timestamp, deltaTime);
        animationFrameId = requestAnimationFrame(gameLoop);
    }
    
    animationFrameId = requestAnimationFrame(gameLoop);
}

function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorModal.classList.add('active');
}

// ============================================
// WEBSOCKET
// ============================================

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
            console.error('❌ Erreur:', error);
        }
    };

    ws.onerror = (error) => {
        console.error('❌ Erreur WebSocket:', error);
        elements.connectStatus.textContent = 'Erreur de connexion';
        showError('Impossible de se connecter au serveur. Vérifiez que le serveur est démarré.');
    };

    ws.onclose = () => {
        console.log('🔌 Connexion fermée');
        elements.connectStatus.textContent = 'Déconnecté';
        setTimeout(() => {
            showScreen('connect');
            elements.connectBtn.disabled = true;
            setTimeout(connectWebSocket, 2000);
        }, 1000);
    };
}

function send(message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}

// ============================================
// GESTION DES MESSAGES
// ============================================

function handleServerMessage(message) {
    switch (message.type) {
        // === Connexion ===
        case 'connected':
            clientId = message.data.clientId;
            myId = clientId;
            break;

        case 'username-set':
            username = message.data.username;
            elements.currentUsername.textContent = username;
            showScreen('menu');
            break;

        // === Lobby ===
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
            break;

        case 'snake-player-left':
            break;

        case 'snake-room-left':
            currentRoomCode = null;
            isHost = false;
            isReady = false;
            if (isInGame) {
                showLobby();
            }
            showScreen('menu');
            break;

        // === Jeu ===
        case 'snake-your-id':
            myId = message.data.id;
            break;

        case 'snake-countdown':
            if (!isInGame) {
                showGame();
            }
            showCountdown(message.data.count);
            break;

        case 'snake-game-started':
            elements.countdownOverlay.style.display = 'none';
            elements.gameStatus.textContent = '🎮 En cours !';
            break;

        case 'snake-game-state':
            if (!isInGame) {
                showGame();
                elements.countdownOverlay.style.display = 'none';
            }
            updateGameState(message.data);
            break;

        case 'snake-player-died':
            handlePlayerDied(message.data);
            break;

        case 'snake-game-end':
            handleGameEnd(message.data);
            break;

        case 'error':
            showError(message.data.message);
            break;
    }
}

// ============================================
// LOBBY FUNCTIONS
// ============================================

function showRoomScreen() {
    showScreen('room');
    elements.roomCode.textContent = currentRoomCode;
    isReady = false;
    updateReadyButton();
}

function updateRoomStatus(data) {
    // Si on reçoit un statut pendant le jeu, ignorer les updates lobby
    if (isInGame && data.status === 'waiting') {
        // Le jeu est terminé, retour au lobby
        showLobby();
        showScreen('room');
    }
    
    elements.roomCode.textContent = data.code;
    elements.playerCount.textContent = data.players.length;

    elements.playersList.innerHTML = '';
    
    data.players.forEach((player, index) => {
        const playerCard = document.createElement('div');
        playerCard.className = `player-card ${player.isReady ? 'ready' : ''}`;
        playerCard.style.setProperty('--player-color', player.color || PLAYER_COLORS[index].main);
        
        playerCard.innerHTML = `
            <div class="player-avatar" style="background-color: ${player.color || PLAYER_COLORS[index].main}">
                🐍
            </div>
            <div class="player-info">
                <span class="player-name">${player.username}</span>
                <span class="player-status">${player.isHost ? '👑 Hôte' : ''} ${player.isReady ? '✓ Prêt' : 'En attente'}</span>
            </div>
        `;
        
        elements.playersList.appendChild(playerCard);
    });

    const me = data.players.find(p => p.id === clientId);
    if (me) {
        isHost = me.isHost;
        isReady = me.isReady;
        updateReadyButton();
    }

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

// ============================================
// GAME FUNCTIONS
// ============================================

function showCountdown(count) {
    elements.countdownOverlay.style.display = 'flex';
    elements.countdownNumber.textContent = count > 0 ? count : 'GO!';
    elements.countdownNumber.classList.remove('animate');
    void elements.countdownNumber.offsetWidth;
    elements.countdownNumber.classList.add('animate');
    
    if (count === 0) {
        setTimeout(() => {
            elements.countdownOverlay.style.display = 'none';
        }, 500);
    }
}

function updateGameState(data) {
    // Sauvegarder l'état précédent pour interpolation fluide
    previousPlayers = new Map();
    players.forEach((player, id) => {
        previousPlayers.set(id, {
            ...player,
            snake: player.snake ? [...player.snake] : []
        });
    });
    previousFood = food;
    lastUpdateTime = performance.now();
    
    if (data.tickRate) {
        serverTickRate = data.tickRate;
    }

    // Mettre à jour les joueurs
    players.clear();
    data.players.forEach((p, index) => {
        const prevPlayer = previousPlayers.get(p.id);
        players.set(p.id, {
            ...p,
            color: PLAYER_COLORS[index % PLAYER_COLORS.length],
            prevSnake: prevPlayer ? prevPlayer.snake : p.snake
        });
    });

    // Nourriture - créer des particules si mangée
    if (food && data.food && (food.x !== data.food.x || food.y !== data.food.y)) {
        spawnParticles(
            food.x * CELL_SIZE + CELL_SIZE / 2, 
            food.y * CELL_SIZE + CELL_SIZE / 2, 
            food.isSuper ? '#ffd700' : '#ff2e63'
        );
    }
    food = data.food;

    // Mise à jour de l'UI
    const me = players.get(myId);
    if (me) {
        elements.myScore.textContent = me.score;
        elements.myLength.textContent = me.snake ? me.snake.length : 0;
    }

    updateScoreboard();
}

// Système de particules pour les effets visuels
function spawnParticles(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
        const speed = 3 + Math.random() * 4;
        particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            color,
            size: Math.random() * 4 + 2
        });
    }
}

function updateParticles(deltaTime) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= deltaTime * 0.003;
        p.vx *= 0.94;
        p.vy *= 0.94;
        
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function renderParticles() {
    particles.forEach(p => {
        ctx.globalAlpha = p.life * 0.8;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

function updateScoreboard() {
    const sortedPlayers = Array.from(players.values())
        .sort((a, b) => b.score - a.score);

    elements.scoresList.innerHTML = sortedPlayers.map((p, index) => `
        <div class="score-item ${!p.alive ? 'dead' : ''} ${p.id === myId ? 'me' : ''}">
            <span class="rank">#${index + 1}</span>
            <span class="player-color" style="background-color: ${p.color.main}"></span>
            <span class="player-name">${p.username}${p.id === myId ? ' (Toi)' : ''}</span>
            <span class="player-score">${p.score}</span>
            ${!p.alive ? '<span class="dead-icon">💀</span>' : ''}
        </div>
    `).join('');
}

function handlePlayerDied(data) {
    const player = players.get(data.playerId);
    if (player) {
        // Explosion de particules à la mort
        if (player.snake && player.snake.length > 0) {
            player.snake.forEach((seg, idx) => {
                if (idx % 2 === 0) { // Moins de particules pour la performance
                    spawnParticles(
                        seg.x * CELL_SIZE + CELL_SIZE / 2, 
                        seg.y * CELL_SIZE + CELL_SIZE / 2, 
                        player.color.main, 
                        4
                    );
                }
            });
        }
        player.alive = false;
        if (data.playerId === myId) {
            elements.gameStatus.textContent = '💀 Tu es éliminé !';
        }
        updateScoreboard();
    }
}

function handleGameEnd(data) {
    isGameOver = true;
    elements.gameoverOverlay.style.display = 'flex';

    if (data.winner) {
        const isMe = data.winner.id === myId;
        elements.gameoverTitle.textContent = isMe ? '🎉 Victoire !' : 'Partie terminée';
        elements.winnerDisplay.innerHTML = `
            <div class="winner-card">
                <span class="crown">👑</span>
                <span class="winner-name">${data.winner.username}</span>
                ${isMe ? '<span class="winner-tag">C\'est toi !</span>' : ''}
            </div>
        `;
    } else {
        elements.gameoverTitle.textContent = 'Égalité !';
        elements.winnerDisplay.innerHTML = '';
    }

    elements.finalScores.innerHTML = data.results
        .sort((a, b) => b.score - a.score)
        .map((p, index) => `
            <div class="final-score-item ${p.id === myId ? 'me' : ''}">
                <span class="final-rank">#${index + 1}</span>
                <span class="final-name">${p.username}</span>
                <span class="final-score">${p.score} pts</span>
                <span class="final-length">${p.length} 🐍</span>
            </div>
        `).join('');
}

// ============================================
// RENDU CANVAS FLUIDE 60 FPS
// ============================================

function render(timestamp, deltaTime) {
    if (!ctx) return;
    
    // Calculer le progrès d'interpolation (0 à 1)
    const timeSinceUpdate = performance.now() - lastUpdateTime;
    const interpolation = Math.min(timeSinceUpdate / serverTickRate, 1);
    
    // Clear avec léger effet de traînée
    ctx.fillStyle = 'rgba(10, 22, 40, 0.92)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Grille subtile
    ctx.strokeStyle = 'rgba(30, 50, 70, 0.25)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(i * CELL_SIZE, 0);
        ctx.lineTo(i * CELL_SIZE, canvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * CELL_SIZE);
        ctx.lineTo(canvas.width, i * CELL_SIZE);
        ctx.stroke();
    }

    // Nourriture avec animation pulsante
    if (food) {
        renderFood(timestamp);
    }

    // Serpents avec interpolation fluide
    players.forEach((player) => {
        if (!player.alive || !player.snake || player.snake.length === 0) return;
        renderSnake(player, interpolation);
    });
    
    // Particules
    updateParticles(deltaTime || 16);
    renderParticles();
}

function renderFood(timestamp) {
    const pulse = Math.sin(timestamp * 0.006) * 0.15 + 1;
    const x = food.x * CELL_SIZE + CELL_SIZE / 2;
    const y = food.y * CELL_SIZE + CELL_SIZE / 2;
    
    if (food.isSuper) {
        // Super nourriture dorée avec brillance
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 20 * pulse;
        
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, CELL_SIZE * 0.6 * pulse);
        gradient.addColorStop(0, '#fff7cc');
        gradient.addColorStop(0.5, '#ffd700');
        gradient.addColorStop(1, '#ff8c00');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, CELL_SIZE * 0.5 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    } else {
        // Nourriture normale
        ctx.shadowColor = '#ff2e63';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#ff2e63';
        ctx.beginPath();
        ctx.arc(x, y, CELL_SIZE * 0.35 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

function renderSnake(player, interpolation) {
    const snake = player.snake;
    const prevSnake = player.prevSnake || snake;
    const color = player.color;
    
    // Dessiner de la queue vers la tête pour le bon ordre z
    for (let i = snake.length - 1; i >= 0; i--) {
        const segment = snake[i];
        const prevSegment = prevSnake[i] || segment;
        
        // Interpoler la position pour fluidité
        const x = lerp(prevSegment.x, segment.x, interpolation) * CELL_SIZE + CELL_SIZE / 2;
        const y = lerp(prevSegment.y, segment.y, interpolation) * CELL_SIZE + CELL_SIZE / 2;
        
        const isHead = i === 0;
        
        // Taille dégressive vers la queue
        const sizeFactor = isHead ? 1 : (1 - (i / snake.length) * 0.35);
        const size = (CELL_SIZE / 2 - 1) * sizeFactor;
        
        // Intensité de couleur dégressive
        const colorIntensity = 1 - (i / snake.length) * 0.4;
        
        if (isHead) {
            // Tête avec glow
            ctx.shadowColor = color.glow;
            ctx.shadowBlur = 12;
            
            ctx.fillStyle = color.main;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            
            // Yeux
            const eyeOffset = size * 0.4;
            const eyeSize = size * 0.22;
            
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(x - eyeOffset * 0.5, y - eyeOffset * 0.4, eyeSize, 0, Math.PI * 2);
            ctx.arc(x + eyeOffset * 0.5, y - eyeOffset * 0.4, eyeSize, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(x - eyeOffset * 0.5, y - eyeOffset * 0.4, eyeSize * 0.5, 0, Math.PI * 2);
            ctx.arc(x + eyeOffset * 0.5, y - eyeOffset * 0.4, eyeSize * 0.5, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Corps avec dégradé de couleur
            ctx.fillStyle = lerpColor(color.dark, color.main, colorIntensity);
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Nom au-dessus de la tête
    if (snake.length > 0) {
        const headPrev = prevSnake[0] || snake[0];
        const headX = lerp(headPrev.x, snake[0].x, interpolation) * CELL_SIZE + CELL_SIZE / 2;
        const headY = lerp(headPrev.y, snake[0].y, interpolation) * CELL_SIZE;
        
        ctx.fillStyle = color.main;
        ctx.font = 'bold 11px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 3;
        ctx.fillText(player.username, headX, headY - 6);
        ctx.shadowBlur = 0;
    }
}

// Interpolation linéaire
function lerp(a, b, t) {
    return a + (b - a) * t;
}

// Interpolation de couleur hex
function lerpColor(color1, color2, t) {
    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);
    const r = Math.round(lerp(c1.r, c2.r, t));
    const g = Math.round(lerp(c1.g, c2.g, t));
    const b = Math.round(lerp(c1.b, c2.b, t));
    return `rgb(${r},${g},${b})`;
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

// ============================================
// CONTRÔLES
// ============================================

function setupControls() {
    document.addEventListener('keydown', (e) => {
        if (!isInGame || isGameOver) return;

        let direction = null;

        switch (e.key) {
            case 'ArrowUp':
            case 'z':
            case 'Z':
            case 'w':
            case 'W':
                direction = 'up';
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                direction = 'down';
                break;
            case 'ArrowLeft':
            case 'q':
            case 'Q':
            case 'a':
            case 'A':
                direction = 'left';
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                direction = 'right';
                break;
        }

        if (direction) {
            e.preventDefault();
            send({ type: 'snake-direction', data: { direction } });
        }
    });
    
    // Support tactile pour mobile
    let touchStartX = 0;
    let touchStartY = 0;

    document.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        if (!isInGame || isGameOver) return;

        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;

        if (Math.abs(dx) < 30 && Math.abs(dy) < 30) return;

        let direction = Math.abs(dx) > Math.abs(dy)
            ? (dx > 0 ? 'right' : 'left')
            : (dy > 0 ? 'down' : 'up');

        send({ type: 'snake-direction', data: { direction } });
    }, { passive: true });
}

// ============================================
// EVENT LISTENERS
// ============================================

// Connexion
elements.connectBtn.addEventListener('click', () => {
    const name = elements.usernameInput.value.trim();
    if (name.length < 2) {
        showError('Le pseudo doit contenir au moins 2 caractères');
        return;
    }
    send({ type: 'set-username', data: { username: name } });
});

elements.usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') elements.connectBtn.click();
});

// Lobby
elements.createRoomBtn.addEventListener('click', () => {
    send({ type: 'create-snake-room' });
});

elements.joinRoomBtn.addEventListener('click', () => {
    const code = elements.roomCodeInput.value.trim().toUpperCase();
    if (code.length !== 4) {
        showError('Le code doit contenir 4 lettres');
        return;
    }
    send({ type: 'join-snake-room', data: { code } });
});

elements.roomCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') elements.joinRoomBtn.click();
});

elements.leaveRoomBtn.addEventListener('click', () => {
    send({ type: 'leave-snake-room' });
});

elements.toggleReadyBtn.addEventListener('click', () => {
    send({ type: 'toggle-snake-ready' });
});

elements.startGameBtn.addEventListener('click', () => {
    send({ type: 'start-snake-game' });
});

// Jeu
elements.leaveGameBtn.addEventListener('click', () => {
    if (confirm('Voulez-vous vraiment quitter ?')) {
        send({ type: 'leave-snake-room' });
        showLobby();
        showScreen('menu');
    }
});

elements.returnLobbyBtn.addEventListener('click', () => {
    showLobby();
    showScreen('room');
    // Demander le statut de la room
    send({ type: 'leave-snake-room' });
    setTimeout(() => {
        send({ type: 'join-snake-room', data: { code: currentRoomCode } });
    }, 500);
});

// Modal
elements.errorCloseBtn.addEventListener('click', () => {
    elements.errorModal.classList.remove('active');
});

elements.errorModal.addEventListener('click', (e) => {
    if (e.target === elements.errorModal) {
        elements.errorModal.classList.remove('active');
    }
});

// ============================================
// DÉMARRAGE
// ============================================

setupControls();
connectWebSocket();
