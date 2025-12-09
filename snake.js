// Configuration
const GRID_SIZE = 40;
const CELL_SIZE = 15;

// État du jeu
let ws = null;
let gameData = null;
let players = new Map();
let food = null;
let myId = null;
let isGameOver = false;
let animationFrameId = null;

// Canvas
let canvas, ctx;

// Couleurs des joueurs
const PLAYER_COLORS = [
    { main: '#00ff00', dark: '#00cc00', name: 'Vert' },
    { main: '#ff2e63', dark: '#cc2550', name: 'Rouge' },
    { main: '#00f2ff', dark: '#00c2cc', name: 'Cyan' },
    { main: '#ffd700', dark: '#ccac00', name: 'Jaune' }
];

// Éléments DOM
const elements = {
    roomCode: document.getElementById('room-code'),
    gameStatus: document.getElementById('game-status'),
    leaveBtn: document.getElementById('leave-btn'),
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

// Initialisation
function init() {
    // Récupérer les données de session
    const sessionData = sessionStorage.getItem('snake-multiplayer');
    if (!sessionData) {
        alert('Session invalide. Retour au lobby.');
        window.location.href = 'snake-lobby.html';
        return;
    }

    gameData = JSON.parse(sessionData);
    
    // Initialiser le canvas
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    canvas.width = GRID_SIZE * CELL_SIZE;
    canvas.height = GRID_SIZE * CELL_SIZE;

    // Afficher les infos
    elements.roomCode.textContent = gameData.roomCode;
    elements.myUsername.textContent = gameData.username;

    // Connexion WebSocket
    connectWebSocket();

    // Event listeners
    setupControls();
    elements.leaveBtn.addEventListener('click', leaveGame);
    elements.returnLobbyBtn.addEventListener('click', returnToLobby);
}

// Connexion WebSocket
function connectWebSocket() {
    ws = new WebSocket(gameData.wsUrl);

    ws.onopen = () => {
        console.log('✅ Connecté au serveur');
        // Se déclarer avec le username d'abord
        send({
            type: 'set-username',
            data: { username: gameData.username }
        });
        
        // Puis rejoindre la room
        setTimeout(() => {
            send({
                type: 'snake-rejoin-game',
                data: {
                    roomCode: gameData.roomCode,
                    username: gameData.username
                }
            });
        }, 100);
    };

    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            handleServerMessage(message);
        } catch (error) {
            console.error('Erreur message:', error);
        }
    };

    ws.onerror = (error) => {
        console.error('Erreur WebSocket:', error);
    };

    ws.onclose = () => {
        console.log('Connexion fermée');
        if (!isGameOver) {
            // Tentative de reconnexion
            setTimeout(connectWebSocket, 2000);
        }
    };
}

// Gérer les messages du serveur
function handleServerMessage(message) {
    console.log('📨 Message:', message.type, message.data);

    switch (message.type) {
        case 'connected':
            // Ignoré, on envoie set-username dans onopen
            break;

        case 'username-set':
            // Username configuré, ignoré
            break;

        case 'snake-your-id':
            myId = message.data.id;
            console.log(`🆔 Mon ID: ${myId}`);
            // Cacher l'overlay de compte à rebours une fois connecté
            elements.countdownOverlay.style.display = 'none';
            elements.gameStatus.textContent = 'Connecté, en attente...';
            break;

        case 'snake-game-started':
            elements.countdownOverlay.style.display = 'none';
            elements.gameStatus.textContent = '🎮 En cours !';
            console.log('🎮 Jeu démarré !');
            break;

        case 'snake-game-state':
            updateGameState(message.data);
            break;

        case 'snake-countdown':
            showCountdown(message.data.count);
            break;

        case 'snake-game-started':
            elements.countdownOverlay.style.display = 'none';
            elements.gameStatus.textContent = 'En cours !';
            break;

        case 'snake-player-died':
            handlePlayerDied(message.data);
            break;

        case 'snake-game-end':
            handleGameEnd(message.data);
            break;

        case 'snake-your-id':
            myId = message.data.id;
            break;

        case 'error':
            alert(message.data.message);
            break;
    }
}

// Afficher le compte à rebours
function showCountdown(count) {
    elements.countdownOverlay.style.display = 'flex';
    elements.countdownNumber.textContent = count;
    elements.countdownNumber.classList.remove('animate');
    void elements.countdownNumber.offsetWidth; // Force reflow
    elements.countdownNumber.classList.add('animate');
    
    if (count === 0) {
        elements.countdownNumber.textContent = 'GO!';
        setTimeout(() => {
            elements.countdownOverlay.style.display = 'none';
        }, 500);
    }
}

// Mettre à jour l'état du jeu
function updateGameState(data) {
    // Mettre à jour les joueurs
    players.clear();
    data.players.forEach((p, index) => {
        players.set(p.id, {
            ...p,
            color: PLAYER_COLORS[index % PLAYER_COLORS.length]
        });
    });

    // Mettre à jour la nourriture
    food = data.food;

    // Mettre à jour mes stats
    const me = players.get(myId);
    if (me) {
        elements.myScore.textContent = me.score;
        elements.myLength.textContent = me.snake.length;
    }

    // Mettre à jour le scoreboard
    updateScoreboard();

    // Dessiner
    render();
}

// Mettre à jour le scoreboard
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

// Gérer la mort d'un joueur
function handlePlayerDied(data) {
    const player = players.get(data.playerId);
    if (player) {
        player.alive = false;
        if (data.playerId === myId) {
            elements.gameStatus.textContent = '💀 Tu es éliminé !';
        }
        updateScoreboard();
    }
}

// Fin de partie
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

    // Afficher les scores finaux
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

// Rendu du jeu
function render() {
    // Clear
    ctx.fillStyle = '#0a1628';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grille
    ctx.strokeStyle = '#1a2a3a';
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

    // Dessiner la nourriture
    if (food) {
        if (food.isSuper) {
            // Super nourriture (plus grande, effet brillant)
            const gradient = ctx.createRadialGradient(
                food.x * CELL_SIZE + CELL_SIZE / 2,
                food.y * CELL_SIZE + CELL_SIZE / 2,
                0,
                food.x * CELL_SIZE + CELL_SIZE / 2,
                food.y * CELL_SIZE + CELL_SIZE / 2,
                CELL_SIZE
            );
            gradient.addColorStop(0, '#ffd700');
            gradient.addColorStop(1, '#ff8c00');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(
                food.x * CELL_SIZE + CELL_SIZE / 2,
                food.y * CELL_SIZE + CELL_SIZE / 2,
                CELL_SIZE * 0.7,
                0,
                Math.PI * 2
            );
            ctx.fill();
            
            // Effet de brillance
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 15;
            ctx.fill();
            ctx.shadowBlur = 0;
        } else {
            // Nourriture normale
            ctx.fillStyle = '#ff2e63';
            ctx.beginPath();
            ctx.arc(
                food.x * CELL_SIZE + CELL_SIZE / 2,
                food.y * CELL_SIZE + CELL_SIZE / 2,
                CELL_SIZE * 0.4,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
    }

    // Dessiner les serpents
    players.forEach((player) => {
        if (!player.alive || !player.snake || player.snake.length === 0) return;

        player.snake.forEach((segment, index) => {
            const isHead = index === 0;
            const color = isHead ? player.color.main : player.color.dark;
            
            ctx.fillStyle = color;
            
            if (isHead) {
                // Tête avec effet
                ctx.shadowColor = player.color.main;
                ctx.shadowBlur = 8;
                ctx.fillRect(
                    segment.x * CELL_SIZE + 1,
                    segment.y * CELL_SIZE + 1,
                    CELL_SIZE - 2,
                    CELL_SIZE - 2
                );
                ctx.shadowBlur = 0;

                // Yeux
                ctx.fillStyle = '#000';
                const eyeSize = CELL_SIZE * 0.15;
                const eyeOffset = CELL_SIZE * 0.25;
                
                // Position des yeux selon la direction
                let eyePositions = [
                    { x: eyeOffset, y: eyeOffset },
                    { x: CELL_SIZE - eyeOffset - eyeSize, y: eyeOffset }
                ];
                
                eyePositions.forEach(pos => {
                    ctx.beginPath();
                    ctx.arc(
                        segment.x * CELL_SIZE + pos.x + eyeSize / 2,
                        segment.y * CELL_SIZE + pos.y + eyeSize / 2,
                        eyeSize,
                        0,
                        Math.PI * 2
                    );
                    ctx.fill();
                });
            } else {
                // Corps
                const padding = index === player.snake.length - 1 ? 3 : 2;
                ctx.fillRect(
                    segment.x * CELL_SIZE + padding,
                    segment.y * CELL_SIZE + padding,
                    CELL_SIZE - padding * 2,
                    CELL_SIZE - padding * 2
                );
            }
        });

        // Afficher le nom au-dessus du serpent
        if (player.snake.length > 0) {
            const head = player.snake[0];
            ctx.fillStyle = player.color.main;
            ctx.font = 'bold 10px Montserrat';
            ctx.textAlign = 'center';
            ctx.fillText(
                player.username,
                head.x * CELL_SIZE + CELL_SIZE / 2,
                head.y * CELL_SIZE - 5
            );
        }
    });
}

// Gestion des contrôles
function setupControls() {
    document.addEventListener('keydown', (e) => {
        if (isGameOver) return;

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
            send({
                type: 'snake-direction',
                data: { direction }
            });
        }
    });

    // Support tactile pour mobile
    let touchStartX = 0;
    let touchStartY = 0;

    canvas.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    });

    canvas.addEventListener('touchend', (e) => {
        if (isGameOver) return;

        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;

        const dx = touchEndX - touchStartX;
        const dy = touchEndY - touchStartY;

        let direction = null;

        if (Math.abs(dx) > Math.abs(dy)) {
            direction = dx > 0 ? 'right' : 'left';
        } else {
            direction = dy > 0 ? 'down' : 'up';
        }

        if (direction) {
            send({
                type: 'snake-direction',
                data: { direction }
            });
        }
    });
}

// Envoyer un message
function send(message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}

// Quitter la partie
function leaveGame() {
    if (confirm('Voulez-vous vraiment quitter la partie ?')) {
        send({ type: 'leave-snake-room' });
        returnToLobby();
    }
}

// Retour au lobby
function returnToLobby() {
    sessionStorage.removeItem('snake-multiplayer');
    window.location.href = 'snake-lobby.html';
}

// Démarrer
init();
