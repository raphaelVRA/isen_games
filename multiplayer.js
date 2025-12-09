// Configuration
const WS_URL = `ws://${window.location.hostname}:8081`;

// État du jeu
let ws = null;
let gameData = null;
let wordLength = 0;
let firstLetter = '';
let currentRow = 0;
let currentCol = 1;
let gameActive = false;
let currentMode = '';
let roomCode = '';
let myFinished = false;
let myUsername = '';

// Éléments DOM
const elements = {
    roomCode: document.getElementById('room-code'),
    modeDisplay: document.getElementById('mode-display'),
    timerDisplay: document.getElementById('timer-display'),
    timerValue: document.getElementById('timer-value'),
    leaveGameBtn: document.getElementById('leave-game-btn'),
    currentAttempt: document.getElementById('current-attempt'),
    gameGrid: document.getElementById('game-grid'),
    keyboard: document.getElementById('keyboard'),
    playersCount: document.getElementById('players-count'),
    playersList: document.getElementById('players-list'),
    
    // Modal de fin
    endModal: document.getElementById('end-modal'),
    endTitle: document.getElementById('end-title'),
    revealedWord: document.getElementById('revealed-word'),
    finalRanking: document.getElementById('final-ranking'),
    newGameBtn: document.getElementById('new-game-btn'),
    backToLobbyBtn: document.getElementById('back-to-lobby-btn'),
    
    // Modal d'erreur
    errorModal: document.getElementById('error-modal'),
    errorMessage: document.getElementById('error-message'),
    errorCloseBtn: document.getElementById('error-close-btn')
};

// Récupérer les données de session
function loadGameData() {
    const data = sessionStorage.getItem('tusmo-multiplayer');
    if (!data) {
        alert('Aucune partie en cours');
        window.location.href = 'lobby.html';
        return null;
    }
    return JSON.parse(data);
}

// Afficher une erreur
function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorModal.classList.add('active');
}

// Initialiser la grille
function initializeGrid() {
    elements.gameGrid.innerHTML = '';
    
    for (let row = 0; row < 6; row++) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'grid-row';
        rowDiv.dataset.row = row;
        
        for (let col = 0; col < wordLength; col++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            // Première lettre en indice sur la première cellule de chaque ligne
            if (col === 0) {
                cell.textContent = firstLetter;
                cell.classList.add('hint-letter');
            }
            
            rowDiv.appendChild(cell);
        }
        
        elements.gameGrid.appendChild(rowDiv);
    }
}

// Obtenir la cellule à une position donnée
function getCell(row, col) {
    return document.querySelector(`.grid-cell[data-row="${row}"][data-col="${col}"]`);
}

// Obtenir le mot de la ligne actuelle
function getCurrentWord() {
    let word = '';
    for (let col = 0; col < wordLength; col++) {
        const cell = getCell(currentRow, col);
        word += cell.textContent || '';
    }
    return word;
}

// Ajouter une lettre
function addLetter(letter) {
    if (!gameActive || myFinished || currentRow >= 6) return;
    
    // Ne pas écraser la première lettre (indice)
    if (currentCol === 0) {
        currentCol = 1;
    }
    
    if (currentCol < wordLength) {
        const cell = getCell(currentRow, currentCol);
        cell.textContent = letter;
        cell.classList.remove('hint-letter');
        cell.classList.add('filled');
        currentCol++;
    }
}

// Supprimer une lettre
function removeLetter() {
    if (!gameActive || myFinished || currentCol <= 1) return;
    
    currentCol--;
    const cell = getCell(currentRow, currentCol);
    cell.textContent = '';
    cell.classList.remove('filled');
}

// Soumettre un mot
function submitWord() {
    console.log('submitWord appelé - gameActive:', gameActive, 'myFinished:', myFinished, 'currentCol:', currentCol, 'wordLength:', wordLength);
    
    if (!gameActive || myFinished || currentCol !== wordLength) {
        console.log('Validation bloquée - gameActive:', gameActive, 'myFinished:', myFinished, 'currentCol:', currentCol, 'wordLength:', wordLength);
        return;
    }
    
    const word = getCurrentWord();
    console.log('Mot soumis:', word);
    
    // Vérifier que la première lettre est correcte
    if (word[0] !== firstLetter) {
        showError(`Le mot doit commencer par ${firstLetter}`);
        return;
    }
    
    // Envoyer au serveur
    sendMessage('submit-guess', { guess: word });
}

// Gérer le résultat d'une tentative
function handleGuessResult(data) {
    const { guess, evaluation, attemptNumber } = data;
    
    // Animer les cellules avec le résultat
    for (let col = 0; col < wordLength; col++) {
        const cell = getCell(currentRow, col);
        const state = evaluation[col];
        
        setTimeout(() => {
            cell.classList.add('flip');
            cell.classList.add(state);
            
            // Mettre à jour le clavier
            const key = document.querySelector(`.key[data-key="${guess[col]}"]`);
            if (key && !key.classList.contains('correct')) {
                if (state === 'correct') {
                    key.classList.remove('misplaced', 'wrong');
                    key.classList.add('correct');
                } else if (state === 'misplaced' && !key.classList.contains('misplaced')) {
                    key.classList.remove('wrong');
                    key.classList.add('misplaced');
                } else if (state === 'wrong' && !key.classList.contains('wrong') && !key.classList.contains('misplaced')) {
                    key.classList.add('wrong');
                }
            }
        }, col * 100);
    }
    
    // Vérifier si c'est correct
    const isCorrect = evaluation.every(e => e === 'correct');
    
    setTimeout(() => {
        if (isCorrect) {
            myFinished = true;
            gameActive = false;
            // La fin sera gérée par le serveur
        } else {
            // Passer à la ligne suivante
            currentRow++;
            currentCol = 1;
            elements.currentAttempt.textContent = currentRow + 1;
            
            if (currentRow >= 6) {
                gameActive = false;
                myFinished = true;
            }
        }
    }, wordLength * 100 + 500);
}

// Mettre à jour le classement
function updateLeaderboard(players) {
    elements.playersCount.textContent = players.length;
    elements.playersList.innerHTML = '';
    
    // Trier par score décroissant
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    
    sortedPlayers.forEach((player, index) => {
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        
        if (player.finished) {
            playerItem.classList.add('finished');
        }
        
        if (player.isWinner) {
            playerItem.classList.add('winner');
        }
        
        const playerHeader = document.createElement('div');
        playerHeader.className = 'player-header';
        
        const playerName = document.createElement('div');
        playerName.className = 'player-name';
        
        const rankEmojis = ['🥇', '🥈', '🥉'];
        const rankEmoji = index < 3 ? rankEmojis[index] : `${index + 1}.`;
        
        playerName.innerHTML = `<span class="player-rank">${rankEmoji}</span> ${player.username}`;
        
        const playerScore = document.createElement('div');
        playerScore.className = 'player-score';
        playerScore.textContent = player.score || 0;
        
        playerHeader.appendChild(playerName);
        playerHeader.appendChild(playerScore);
        
        const playerStats = document.createElement('div');
        playerStats.className = 'player-stats';
        
        const attemptsIcon = player.finished ? '✓' : '⏳';
        const attemptsText = player.finished 
            ? `${player.attemptCount} essai${player.attemptCount > 1 ? 's' : ''}`
            : `${player.attemptCount} essai${player.attemptCount > 1 ? 's' : ''}`;
        
        playerStats.innerHTML = `
            <div class="stat-item">
                <span class="stat-icon">${attemptsIcon}</span>
                <span class="stat-value">${attemptsText}</span>
            </div>
        `;
        
        if (player.finished && player.finishTime) {
            const seconds = Math.floor(player.finishTime / 1000);
            playerStats.innerHTML += `
                <div class="stat-item">
                    <span class="stat-icon">⏱️</span>
                    <span class="stat-value">${seconds}s</span>
                </div>
            `;
        }
        
        playerItem.appendChild(playerHeader);
        playerItem.appendChild(playerStats);
        elements.playersList.appendChild(playerItem);
    });
}

// Afficher les résultats finaux
function showGameEnd(data) {
    const { reason, word, results } = data;
    
    elements.revealedWord.textContent = word;
    
    if (reason === 'timeout') {
        elements.endTitle.textContent = '⏰ Temps écoulé !';
    } else {
        elements.endTitle.textContent = '🏁 Partie terminée !';
    }
    
    // Afficher le classement final
    elements.finalRanking.innerHTML = '';
    
    const sortedResults = [...results].sort((a, b) => b.score - a.score);
    
    sortedResults.forEach((player, index) => {
        const rankItem = document.createElement('div');
        rankItem.className = 'ranking-item';
        
        const position = document.createElement('div');
        position.className = 'ranking-position';
        if (index === 0) position.classList.add('first');
        if (index === 1) position.classList.add('second');
        if (index === 2) position.classList.add('third');
        
        const positionEmojis = ['🥇', '🥈', '🥉'];
        position.textContent = index < 3 ? positionEmojis[index] : `${index + 1}°`;
        
        const name = document.createElement('div');
        name.className = 'ranking-player';
        name.textContent = player.username;
        
        if (player.isWinner) {
            name.textContent += ' 👑';
        }
        
        const score = document.createElement('div');
        score.className = 'ranking-score';
        score.textContent = `${player.score} pts`;
        
        rankItem.appendChild(position);
        rankItem.appendChild(name);
        rankItem.appendChild(score);
        
        elements.finalRanking.appendChild(rankItem);
    });
    
    elements.endModal.classList.add('active');
    gameActive = false;
}

// Mettre à jour le timer
function updateTimer(remainingMs) {
    const minutes = Math.floor(remainingMs / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000);
    elements.timerValue.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Changer la couleur si moins de 30 secondes
    if (remainingMs < 30000) {
        elements.timerValue.style.color = 'var(--accent-red)';
    }
}

// Connexion WebSocket
function connectWebSocket() {
    ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
        console.log('✅ Connecté au serveur WebSocket');
        
        // S'identifier et rejoindre la room
        const username = gameData.username || 'Joueur';
        sendMessage('set-username', { username });
        
        // Rejoindre la room
        setTimeout(() => {
            sendMessage('join-room', { code: roomCode });
        }, 100);
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
        showError('Erreur de connexion au serveur');
    };
    
    ws.onclose = () => {
        console.log('🔌 Connexion fermée');
        showError('Connexion perdue avec le serveur');
        setTimeout(() => {
            window.location.href = 'lobby.html';
        }, 2000);
    };
}

// Gérer les messages du serveur
function handleServerMessage(message) {
    console.log('📨 Message reçu:', message);
    
    switch (message.type) {
        case 'connected':
            console.log('✅ ID client reçu:', message.data.clientId);
            break;
            
        case 'username-set':
            console.log('✅ Username confirmé:', message.data.username);
            break;
            
        case 'room-joined':
            console.log('✅ Room rejointe:', message.data.code);
            break;
            
        case 'guess-result':
            handleGuessResult(message.data);
            break;
            
        case 'player-progress':
            // Mettre à jour le classement en temps réel
            console.log(`${message.data.username}: ${message.data.attemptCount} essais`);
            break;
            
        case 'room-status':
            updateLeaderboard(message.data.players);
            // Activer le jeu si la partie est en cours
            if (message.data.status === 'playing') {
                gameActive = true;
            }
            break;
            
        case 'timer-update':
            updateTimer(message.data.remainingMs);
            break;
            
        case 'game-end':
            showGameEnd(message.data);
            break;
            
        case 'error':
            showError(message.data.message);
            // Si la room n'existe plus, retourner au lobby
            if (message.data.message.includes('introuvable') || message.data.message.includes('en cours')) {
                setTimeout(() => {
                    window.location.href = 'lobby.html';
                }, 2000);
            }
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
    }
}

// Gestion du clavier virtuel
elements.keyboard.addEventListener('click', (e) => {
    if (!e.target.classList.contains('key')) return;
    
    const key = e.target.dataset.key;
    
    if (key === 'Enter') {
        submitWord();
    } else if (key === 'Backspace') {
        removeLetter();
    } else {
        addLetter(key);
    }
});

// Gestion du clavier physique
document.addEventListener('keydown', (e) => {
    if (!gameActive || myFinished) return;
    
    if (e.key === 'Enter') {
        submitWord();
    } else if (e.key === 'Backspace') {
        e.preventDefault();
        removeLetter();
    } else if (/^[a-zA-Z]$/.test(e.key)) {
        addLetter(e.key.toUpperCase());
    }
});

// Boutons de la modal
elements.newGameBtn.addEventListener('click', () => {
    elements.endModal.classList.remove('active');
    window.location.reload();
});

elements.backToLobbyBtn.addEventListener('click', () => {
    sendMessage('leave-room');
    window.location.href = 'lobby.html';
});

elements.leaveGameBtn.addEventListener('click', () => {
    if (confirm('Êtes-vous sûr de vouloir quitter la partie ?')) {
        sendMessage('leave-room');
        window.location.href = 'lobby.html';
    }
});

elements.errorCloseBtn.addEventListener('click', () => {
    elements.errorModal.classList.remove('active');
});

// Initialisation
console.log('🎮 TUSMO Multijoueur');

gameData = loadGameData();
if (gameData) {
    roomCode = gameData.roomCode;
    currentMode = gameData.mode;
    wordLength = gameData.wordLength;
    firstLetter = gameData.firstLetter;
    myUsername = gameData.username || 'Joueur';
    currentCol = 1; // Commencer à 1 car la première lettre est l'indice
    
    elements.roomCode.textContent = roomCode;
    
    const modeText = currentMode === 'essais' ? '⏱️ Moins d\'essais' : '⚡ Moins de temps';
    elements.modeDisplay.textContent = `Mode: ${modeText}`;
    
    // Afficher le timer en mode temps
    if (currentMode === 'temps') {
        elements.timerDisplay.style.display = 'flex';
    }
    
    initializeGrid();
    connectWebSocket();
}
