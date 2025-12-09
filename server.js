const WebSocket = require('ws');
const fs = require('fs');
const http = require('http');
const path = require('path');

// Configuration des serveurs
const HTTP_PORT = 3000;
const WS_PORT = 8081;

// Créer le serveur HTTP pour servir les fichiers statiques
const httpServer = http.createServer((req, res) => {
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4',
        '.woff': 'application/font-woff',
        '.ttf': 'application/font-ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.otf': 'application/font-otf',
        '.wasm': 'application/wasm'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - Fichier non trouvé</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Erreur serveur: ' + error.code + ' ..\n');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

httpServer.listen(HTTP_PORT, () => {
    console.log(`🌐 Serveur HTTP démarré sur http://localhost:${HTTP_PORT}`);
    console.log(`   Ouvrez http://localhost:${HTTP_PORT}/snake-lobby.html pour jouer`);
});

// Créer le serveur WebSocket
const wss = new WebSocket.Server({ port: WS_PORT });

// Charger le dictionnaire de mots
let FRENCH_WORDS = [];
try {
    const wordsData = fs.readFileSync('./words.js', 'utf8');
    const match = wordsData.match(/FRENCH_WORDS\s*=\s*(\[[\s\S]*?\]);/);
    if (match) {
        FRENCH_WORDS = JSON.parse(match[1].replace(/'/g, '"'));
    }
} catch (error) {
    console.error('⚠️ Erreur lors du chargement du dictionnaire:', error.message);
}

// Si le dictionnaire est vide, charger depuis une source externe
if (FRENCH_WORDS.length === 0) {
    console.log('📥 Chargement du dictionnaire depuis une source externe...');
    // Pour l'instant, on utilisera un tableau vide et on récupérera les mots à la demande
}

// Structures de données
const clients = new Map(); // ws -> { id, username, roomCode, isReady }
const rooms = new Map(); // roomCode -> Room object (TUSMO)
const snakeRooms = new Map(); // roomCode -> SnakeRoom object
const bannedIPs = new Set(); // IPs bannis
const connectionTracker = new Map(); // IP -> { count, lastReset }

// Générateur d'IDs uniques
let clientIdCounter = 0;

// Limites de connexion
const MAX_CONNECTIONS_PER_MINUTE = 10;
const BAN_DURATION = 5 * 60 * 1000; // 5 minutes

// ==========================================
// ====== SNAKE MULTIPLAYER CLASSES =========
// ==========================================

const SNAKE_GRID_SIZE = 15;
const SNAKE_INITIAL_LENGTH = 3;
const SNAKE_TICK_RATE = 80; // ms - plus rapide et fluide
const PLAYER_COLORS = ['#00ff00', '#ff2e63', '#00f2ff', '#ffd700', '#ff69b4', '#9d4edd'];

// Types de power-ups
const POWERUP_TYPES = [
    { type: 'speed', color: '#00ffff', emoji: '⚡', duration: 5000 },
    { type: 'shield', color: '#ff69b4', emoji: '🛡️', duration: 8000 },
    { type: 'mega', color: '#ffd700', emoji: '⭐', duration: 0 }
];

class SnakeRoom {
    constructor(code, hostId) {
        this.code = code;
        this.hostId = hostId;
        this.players = new Map(); // clientId -> SnakePlayer
        this.status = 'waiting'; // 'waiting', 'countdown', 'playing', 'finished'
        this.gridSize = SNAKE_GRID_SIZE;
        this.food = null;
        this.powerUps = []; // Power-ups actifs
        this.gameInterval = null;
        this.tickRate = SNAKE_TICK_RATE;
        this.startTime = null;
        this.superFoodTimer = null;
        this.powerUpTimer = null;
    }
}

class SnakePlayer {
    constructor(id, username, ws, colorIndex) {
        this.id = id;
        this.username = username;
        this.ws = ws;
        this.isReady = false;
        this.color = PLAYER_COLORS[colorIndex % PLAYER_COLORS.length];
        this.snake = [];
        this.direction = 'right';
        this.nextDirection = 'right';
        this.score = 0;
        this.alive = true;
        this.speedBoost = false;
        this.shield = false;
        this.powerUpEndTime = 0;
        this.combo = 0;
        this.lastFoodTime = 0;
    }
}

// Positions de départ selon l'index du joueur
function getStartPosition(index, gridSize) {
    const center = Math.floor(gridSize / 2);
    const positions = [
        { x: 3, y: 3, dir: 'right' },
        { x: gridSize - 4, y: gridSize - 4, dir: 'left' },
        { x: 3, y: gridSize - 4, dir: 'right' },
        { x: gridSize - 4, y: 3, dir: 'left' },
        { x: center, y: 3, dir: 'down' },
        { x: center, y: gridSize - 4, dir: 'up' }
    ];
    return positions[index % positions.length];
}

// Initialiser le serpent d'un joueur
function initializeSnake(player, index, gridSize) {
    const startPos = getStartPosition(index, gridSize);
    player.direction = startPos.dir;
    player.nextDirection = startPos.dir;
    player.snake = [];
    
    for (let i = 0; i < SNAKE_INITIAL_LENGTH; i++) {
        let x = startPos.x;
        let y = startPos.y;
        
        switch (startPos.dir) {
            case 'right': x -= i; break;
            case 'left': x += i; break;
            case 'up': y += i; break;
            case 'down': y -= i; break;
        }
        
        // Vérifier que le segment est dans la grille
        x = Math.max(0, Math.min(gridSize - 1, x));
        y = Math.max(0, Math.min(gridSize - 1, y));
        
        player.snake.push({ x, y });
    }
    
    player.alive = true;
    player.score = 0;
    
    console.log(`🐍 Init ${player.username} à (${player.snake[0].x}, ${player.snake[0].y}) direction: ${player.direction}`);
}

// Générer de la nourriture
function spawnFood(room, isSuper = false) {
    const occupiedCells = new Set();
    
    room.players.forEach(player => {
        player.snake.forEach(segment => {
            occupiedCells.add(`${segment.x},${segment.y}`);
        });
    });
    
    let x, y;
    let attempts = 0;
    do {
        x = Math.floor(Math.random() * room.gridSize);
        y = Math.floor(Math.random() * room.gridSize);
        attempts++;
    } while (occupiedCells.has(`${x},${y}`) && attempts < 1000);
    
    room.food = { x, y, isSuper };
    return room.food;
}

// Générer un power-up
function spawnPowerUp(room) {
    const occupiedCells = new Set();
    
    room.players.forEach(player => {
        player.snake.forEach(segment => {
            occupiedCells.add(`${segment.x},${segment.y}`);
        });
    });
    
    if (room.food) {
        occupiedCells.add(`${room.food.x},${room.food.y}`);
    }
    
    let x, y;
    let attempts = 0;
    do {
        x = Math.floor(Math.random() * room.gridSize);
        y = Math.floor(Math.random() * room.gridSize);
        attempts++;
    } while (occupiedCells.has(`${x},${y}`) && attempts < 1000);
    
    const powerUp = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    room.powerUps.push({ x, y, ...powerUp, id: Date.now() });
    
    return room.powerUps[room.powerUps.length - 1];
}

// Broadcast à tous les joueurs d'une room Snake
function broadcastToSnakeRoom(room, message, excludeWs = null) {
    room.players.forEach(player => {
        if (player.ws !== excludeWs && player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(JSON.stringify(message));
        }
    });
}

// Envoyer le statut de la room Snake
function sendSnakeRoomStatus(room) {
    const playersData = Array.from(room.players.values()).map((p, index) => ({
        id: p.id,
        username: p.username,
        isReady: p.isReady,
        isHost: p.id === room.hostId,
        color: p.color,
        alive: p.alive,
        score: p.score
    }));

    const statusMessage = {
        type: 'snake-room-status',
        data: {
            code: room.code,
            status: room.status,
            players: playersData,
            hostId: room.hostId
        }
    };

    broadcastToSnakeRoom(room, statusMessage);
}

// Démarrer le compte à rebours
function startSnakeCountdown(room) {
    room.status = 'countdown';
    
    let count = 3;
    
    const countdownInterval = setInterval(() => {
        broadcastToSnakeRoom(room, {
            type: 'snake-countdown',
            data: { count }
        });
        
        count--;
        
        if (count < 0) {
            clearInterval(countdownInterval);
            startSnakeGame(room);
        }
    }, 1000);
}

// Démarrer le jeu Snake
function startSnakeGame(room) {
    room.status = 'playing';
    room.startTime = Date.now();
    room.tickRate = SNAKE_TICK_RATE;
    
    // Initialiser les serpents
    let index = 0;
    room.players.forEach(player => {
        initializeSnake(player, index, room.gridSize);
        index++;
    });
    
    // Générer la première nourriture
    spawnFood(room, false);
    
    // Notifier les joueurs
    broadcastToSnakeRoom(room, { type: 'snake-game-started' });
    
    // Envoyer l'état initial
    sendSnakeGameState(room);
    
    // Démarrer la boucle de jeu
    room.gameInterval = setInterval(() => {
        updateSnakeGame(room);
    }, room.tickRate);
    
    // Timer pour la super nourriture (toutes les 20 secondes)
    room.superFoodTimer = setInterval(() => {
        if (room.status === 'playing' && Math.random() < 0.5) {
            spawnFood(room, true);
            sendSnakeGameState(room);
        }
    }, 20000);
    
    // Timer pour les power-ups (toutes les 15 secondes)
    room.powerUpTimer = setInterval(() => {
        if (room.status === 'playing' && room.powerUps.length < 2) {
            spawnPowerUp(room);
            sendSnakeGameState(room);
        }
    }, 15000);
    
    console.log(`🐍 Snake: Partie démarrée dans la room ${room.code}`);
}

// Mettre à jour l'état du jeu
function updateSnakeGame(room) {
    if (room.status !== 'playing') return;
    
    const alivePlayers = Array.from(room.players.values()).filter(p => p.alive);
    
    // Vérifier s'il reste assez de joueurs
    if (alivePlayers.length <= 1) {
        endSnakeGame(room);
        return;
    }
    
    // Calculer d'abord toutes les nouvelles positions
    const moves = [];
    
    for (const player of alivePlayers) {
        // Appliquer la direction
        player.direction = player.nextDirection;
        
        // Calculer la nouvelle position de la tête
        const head = { ...player.snake[0] };
        
        switch (player.direction) {
            case 'up': head.y--; break;
            case 'down': head.y++; break;
            case 'left': head.x--; break;
            case 'right': head.x++; break;
        }
        
        moves.push({ player, head });
    }
    
    // Vérifier les collisions et appliquer les mouvements
    for (const { player, head } of moves) {
        // Vérifier si le joueur est toujours vivant
        if (!player.alive) continue;
        
        // Vérifier les collisions avec les murs
        if (head.x < 0 || head.x >= room.gridSize || head.y < 0 || head.y >= room.gridSize) {
            console.log(`💥 ${player.username} COLLISION MUR à (${head.x}, ${head.y}) - Grille valide: 0-${room.gridSize-1}`);
            player.alive = false;
            player.snake = [];
            broadcastToSnakeRoom(room, {
                type: 'snake-player-died',
                data: { playerId: player.id, username: player.username }
            });
            continue;
        }
        
        // Vérifier les collisions avec soi-même (exclure la dernière case qui va disparaître)
        let selfCollision = false;
        for (let i = 0; i < player.snake.length - 1; i++) {
            if (player.snake[i].x === head.x && player.snake[i].y === head.y) {
                console.log(`🐍 ${player.username} auto-collision`);
                player.alive = false;
                player.snake = [];
                broadcastToSnakeRoom(room, {
                    type: 'snake-player-died',
                    data: { playerId: player.id, username: player.username }
                });
                selfCollision = true;
                break;
            }
        }
        
        if (selfCollision || !player.alive) continue;
        
        // Vérifier les collisions avec les autres serpents
        let collision = false;
        for (const otherPlayer of room.players.values()) {
            if (otherPlayer.id !== player.id && otherPlayer.alive && otherPlayer.snake.length > 0) {
                for (const segment of otherPlayer.snake) {
                    if (segment.x === head.x && segment.y === head.y) {
                        collision = true;
                        otherPlayer.score += 100;
                        console.log(`⚔️ ${player.username} vs ${otherPlayer.username}`);
                        break;
                    }
                }
                if (collision) break;
            }
        }
        
        if (collision) {
            player.alive = false;
            player.snake = [];
            broadcastToSnakeRoom(room, {
                type: 'snake-player-died',
                data: { playerId: player.id, username: player.username }
            });
            continue;
        }
        
        // Déplacer le serpent
        player.snake.unshift(head);
        
        // Vérifier si on mange la nourriture
        if (room.food && head.x === room.food.x && head.y === room.food.y) {
            const now = Date.now();
            const timeSinceLastFood = now - player.lastFoodTime;
            
            // Système de combo (si mangé rapidement)
            if (timeSinceLastFood < 3000 && player.lastFoodTime > 0) {
                player.combo++;
            } else {
                player.combo = 1;
            }
            player.lastFoodTime = now;
            
            // Score avec bonus combo
            const baseScore = room.food.isSuper ? 50 : 10;
            const comboBonus = Math.min(player.combo - 1, 5) * 5;
            player.score += baseScore + comboBonus;
            
            // Grandir
            const growth = room.food.isSuper ? 3 : 1;
            for (let i = 1; i < growth; i++) {
                player.snake.push({ ...player.snake[player.snake.length - 1] });
            }
            
            // Nouvelle nourriture
            spawnFood(room, false);
        } else {
            // Retirer la queue si pas de nourriture mangée (sauf avec shield)
            if (!player.shield) {
                player.snake.pop();
            }
        }
        
        // Le joueur est vivant, continuer le mouvement
        
        // Vérifier les power-ups
        room.powerUps = room.powerUps.filter(powerUp => {
            if (head.x === powerUp.x && head.y === powerUp.y) {
                applyPowerUp(player, powerUp);
                return false;
            }
            return true;
        });
        
        // Gérer les power-ups actifs
        const now = Date.now();
        if (player.powerUpEndTime > 0 && now >= player.powerUpEndTime) {
            player.speedBoost = false;
            player.shield = false;
            player.powerUpEndTime = 0;
        }
        
        // Points de survie
        player.score += player.speedBoost ? 0.2 : 0.1;
    }
    
    // Vérifier s'il ne reste qu'un joueur vivant
    const stillAlive = Array.from(room.players.values()).filter(p => p.alive);
    if (stillAlive.length <= 1) {
        setTimeout(() => endSnakeGame(room), 500);
        return;
    }
    
    // Envoyer l'état du jeu
    sendSnakeGameState(room);
}

// Tuer un joueur
function killPlayer(room, player) {
    if (!player.alive) return; // Déjà mort
    
    player.alive = false;
    player.snake = [];
    
    console.log(`❌ ${player.username} éliminé`);
    
    broadcastToSnakeRoom(room, {
        type: 'snake-player-died',
        data: { playerId: player.id, username: player.username }
    });
}

// Appliquer un power-up
function applyPowerUp(player, powerUp) {
    const now = Date.now();
    
    switch (powerUp.type) {
        case 'speed':
            player.speedBoost = true;
            player.powerUpEndTime = now + powerUp.duration;
            player.score += 20;
            break;
        case 'shield':
            player.shield = true;
            player.powerUpEndTime = now + powerUp.duration;
            player.score += 30;
            break;
        case 'mega':
            // Mega donne instantanément +5 segments et 100 points
            for (let i = 0; i < 5; i++) {
                player.snake.push({ ...player.snake[player.snake.length - 1] });
            }
            player.score += 100;
            break;
    }
}

// Envoyer l'état du jeu
function sendSnakeGameState(room) {
    const playersData = Array.from(room.players.values()).map(p => ({
        id: p.id,
        username: p.username,
        snake: p.snake,
        score: Math.floor(p.score),
        alive: p.alive,
        color: p.color,
        speedBoost: p.speedBoost,
        shield: p.shield,
        combo: p.combo
    }));
    
    broadcastToSnakeRoom(room, {
        type: 'snake-game-state',
        data: {
            players: playersData,
            food: room.food,
            powerUps: room.powerUps,
            tickRate: room.tickRate
        }
    });
}

// Terminer la partie
function endSnakeGame(room) {
    if (room.status === 'finished') return;
    
    room.status = 'finished';
    
    // Arrêter les timers
    if (room.gameInterval) {
        clearInterval(room.gameInterval);
        room.gameInterval = null;
    }
    if (room.superFoodTimer) {
        clearInterval(room.superFoodTimer);
        room.superFoodTimer = null;
    }
    if (room.powerUpTimer) {
        clearInterval(room.powerUpTimer);
        room.powerUpTimer = null;
    }
    
    // Trouver le gagnant
    const results = Array.from(room.players.values()).map(p => ({
        id: p.id,
        username: p.username,
        score: Math.floor(p.score),
        length: p.snake.length,
        alive: p.alive
    })).sort((a, b) => b.score - a.score);
    
    const alivePlayers = results.filter(p => p.alive);
    const winner = alivePlayers.length === 1 
        ? alivePlayers[0] 
        : results[0];
    
    // Bonus de victoire
    if (winner) {
        const winnerPlayer = room.players.get(winner.id);
        if (winnerPlayer) {
            winnerPlayer.score += 200;
            winner.score = Math.floor(winnerPlayer.score);
        }
    }
    
    console.log(`🐍 Snake: Partie terminée dans la room ${room.code}. Gagnant: ${winner?.username || 'Personne'}`);
    
    broadcastToSnakeRoom(room, {
        type: 'snake-game-end',
        data: {
            winner: winner ? { id: winner.id, username: winner.username } : null,
            results: results.sort((a, b) => b.score - a.score),
            hostId: room.hostId
        }
    });
    
    // Attendre les actions des joueurs (rejouer ou quitter)
    console.log(`🐍 Snake: Room ${room.code} en attente d'action des joueurs`);
}

// Redémarrer une partie Snake (rejouer)
function restartSnakeGame(room) {
    if (room.status !== 'finished') return;
    
    console.log(`🐍 Snake: Redémarrage de la partie dans la room ${room.code}`);
    
    // Réinitialiser tous les joueurs
    room.players.forEach(player => {
        player.isReady = false;
        player.alive = true;
        player.score = 0;
        player.snake = [];
        player.speedBoost = false;
        player.shield = false;
        player.powerUpEndTime = 0;
        player.combo = 0;
        player.lastFoodTime = 0;
    });
    
    // Réinitialiser la room
    room.status = 'waiting';
    room.food = null;
    room.powerUps = [];
    room.tickRate = SNAKE_TICK_RATE;
    
    // Notifier tous les joueurs du retour au lobby
    broadcastToSnakeRoom(room, {
        type: 'snake-restart',
        data: { message: 'Retour au lobby - Prêtez-vous!' }
    });
    
    sendSnakeRoomStatus(room);
}

// Relancer instantanément la partie (sans attendre)
function quickRestartSnakeGame(room) {
    if (room.status !== 'finished') return;
    
    console.log(`⚡ Snake: Relance instantanée dans la room ${room.code}`);
    
    // Réinitialiser tous les joueurs
    room.players.forEach(player => {
        player.isReady = true; // Tous prêts automatiquement
        player.alive = true;
        player.score = 0;
        player.snake = [];
        player.speedBoost = false;
        player.shield = false;
        player.powerUpEndTime = 0;
        player.combo = 0;
        player.lastFoodTime = 0;
    });
    
    // Réinitialiser la room
    room.food = null;
    room.powerUps = [];
    room.tickRate = SNAKE_TICK_RATE;
    
    // Démarrer le compte à rebours directement
    startSnakeCountdown(room);
}

// Gérer la déconnexion d'un client Snake
function handleSnakeDisconnect(ws, client) {
    if (!client.snakeRoomCode) return;
    
    const room = snakeRooms.get(client.snakeRoomCode);
    if (!room) return;
    
    const player = room.players.get(client.id);
    if (player) {
        player.alive = false;
        room.players.delete(client.id);
        
        console.log(`🐍 Snake: ${client.username} a quitté la room ${room.code}`);
        
        // Transférer l'hôte si nécessaire
        if (room.hostId === client.id && room.players.size > 0) {
            room.hostId = Array.from(room.players.keys())[0];
        }
        
        if (room.players.size === 0) {
            if (room.gameInterval) clearInterval(room.gameInterval);
            if (room.superFoodTimer) clearInterval(room.superFoodTimer);
            snakeRooms.delete(room.code);
            console.log(`🐍 Snake: Room ${room.code} supprimée`);
        } else {
            broadcastToSnakeRoom(room, {
                type: 'snake-player-left',
                data: { playerId: client.id, username: client.username }
            });
            
            // Vérifier si la partie doit se terminer
            if (room.status === 'playing') {
                const alivePlayers = Array.from(room.players.values()).filter(p => p.alive);
                if (alivePlayers.length <= 1) {
                    endSnakeGame(room);
                }
            }
            
            sendSnakeRoomStatus(room);
        }
    }
    
    client.snakeRoomCode = null;
}

// ==========================================
// ======= FIN SNAKE MULTIPLAYER ============
// ==========================================

// Structure d'une Room
class Room {
    constructor(code, mode, hostId) {
        this.code = code;
        this.mode = mode; // 'essais' ou 'temps'
        this.hostId = hostId;
        this.players = new Map(); // clientId -> Player object
        this.status = 'waiting'; // 'waiting', 'playing', 'finished'
        this.currentWord = null;
        this.wordLength = 0;
        this.startTime = null;
        this.timerInterval = null;
        this.recentWords = []; // Pour éviter les répétitions
    }
}

// Structure d'un Player
class Player {
    constructor(id, username, ws) {
        this.id = id;
        this.username = username;
        this.ws = ws;
        this.isReady = false;
        this.attempts = [];
        this.finished = false;
        this.finishTime = null;
        this.score = 0;
        this.attemptCount = 0;
    }
}

// Vérifier et gérer le rate limiting
function checkRateLimit(ip) {
    const now = Date.now();
    
    // Vérifier si l'IP est bannie
    if (bannedIPs.has(ip)) {
        return false;
    }
    
    // Récupérer ou créer le tracker pour cette IP
    if (!connectionTracker.has(ip)) {
        connectionTracker.set(ip, { count: 1, lastReset: now });
        return true;
    }
    
    const tracker = connectionTracker.get(ip);
    
    // Réinitialiser le compteur toutes les 60 secondes
    if (now - tracker.lastReset > 60000) {
        tracker.count = 1;
        tracker.lastReset = now;
        return true;
    }
    
    // Incrémenter le compteur
    tracker.count++;
    
    // Si dépassement, bannir l'IP
    if (tracker.count > MAX_CONNECTIONS_PER_MINUTE) {
        bannedIPs.add(ip);
        console.log(`🚫 IP BANNIE: ${ip} (${tracker.count} connexions en 1 min)`);
        
        // Débannir après la durée
        setTimeout(() => {
            bannedIPs.delete(ip);
            connectionTracker.delete(ip);
            console.log(`✅ IP débannie: ${ip}`);
        }, BAN_DURATION);
        
        return false;
    }
    
    return true;
}

// Génération de code de salon (4 lettres majuscules)
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code;
    do {
        code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    } while (rooms.has(code));
    return code;
}

// Sélection d'un mot aléatoire
function getRandomWord(excludeWords = []) {
    if (FRENCH_WORDS.length === 0) {
        // Mots de secours si le dictionnaire n'est pas chargé
        const fallbackWords = [
            'MAISON', 'JARDIN', 'SOLEIL', 'FLEUR', 'ARBRE', 'OISEAU', 'NUAGE',
            'MONTAGNE', 'RIVIERE', 'FORET', 'CHEVAL', 'LAPIN', 'POISSON'
        ];
        const available = fallbackWords.filter(w => !excludeWords.includes(w));
        return available.length > 0 ? available[Math.floor(Math.random() * available.length)] : fallbackWords[0];
    }
    
    const available = FRENCH_WORDS.filter(w => !excludeWords.includes(w));
    return available.length > 0 
        ? available[Math.floor(Math.random() * available.length)]
        : FRENCH_WORDS[Math.floor(Math.random() * FRENCH_WORDS.length)];
}

// Broadcast à tous les joueurs d'une room
function broadcastToRoom(room, message, excludeWs = null) {
    room.players.forEach(player => {
        if (player.ws !== excludeWs && player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(JSON.stringify(message));
        }
    });
}

// Envoi du statut de la room à tous les joueurs
function sendRoomStatus(room) {
    const playersData = Array.from(room.players.values()).map(p => ({
        id: p.id,
        username: p.username,
        isReady: p.isReady,
        isHost: p.id === room.hostId,
        finished: p.finished,
        attemptCount: p.attemptCount,
        score: p.score
    }));

    const statusMessage = {
        type: 'room-status',
        data: {
            code: room.code,
            mode: room.mode,
            status: room.status,
            players: playersData,
            hostId: room.hostId,
            wordLength: room.wordLength
        }
    };

    broadcastToRoom(room, statusMessage);
}

// Démarrer une partie
function startGame(room) {
    if (room.status !== 'waiting') return;
    
    // Sélectionner un mot aléatoire
    room.currentWord = getRandomWord(room.recentWords);
    room.wordLength = room.currentWord.length;
    room.recentWords.push(room.currentWord);
    if (room.recentWords.length > 20) {
        room.recentWords.shift();
    }

    room.status = 'playing';
    room.startTime = Date.now();

    // Réinitialiser les joueurs
    room.players.forEach(player => {
        player.attempts = [];
        player.finished = false;
        player.finishTime = null;
        player.attemptCount = 0;
    });

    console.log(`🎮 Partie démarrée dans la room ${room.code} - Mot: ${room.currentWord} (${room.wordLength} lettres)`);

    // Notifier les joueurs
    const gameStartMessage = {
        type: 'game-start',
        data: {
            wordLength: room.wordLength,
            firstLetter: room.currentWord[0],
            mode: room.mode
        }
    };
    broadcastToRoom(room, gameStartMessage);

    // Démarrer le timer pour le mode "temps"
    if (room.mode === 'temps') {
        startRoomTimer(room);
    }
}

// Timer pour le mode "temps" (5 minutes max)
function startRoomTimer(room) {
    const GAME_DURATION = 5 * 60 * 1000; // 5 minutes
    const startTime = Date.now();

    room.timerInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, GAME_DURATION - elapsed);

        // Broadcast du temps restant
        broadcastToRoom(room, {
            type: 'timer-update',
            data: { remainingMs: remaining }
        });

        // Temps écoulé
        if (remaining === 0) {
            clearInterval(room.timerInterval);
            endGame(room, 'timeout');
        }
    }, 1000);
}

// Évaluer une tentative (comme dans le jeu solo)
function evaluateGuess(guess, word) {
    const result = [];
    const wordArray = word.split('');
    const guessArray = guess.split('');
    const used = new Array(word.length).fill(false);

    // Premier passage : lettres correctes
    for (let i = 0; i < guessArray.length; i++) {
        if (guessArray[i] === wordArray[i]) {
            result[i] = 'correct';
            used[i] = true;
        }
    }

    // Deuxième passage : lettres mal placées
    for (let i = 0; i < guessArray.length; i++) {
        if (result[i] !== 'correct') {
            const foundIndex = wordArray.findIndex((letter, index) => 
                letter === guessArray[i] && !used[index]
            );
            if (foundIndex !== -1) {
                result[i] = 'misplaced';
                used[foundIndex] = true;
            } else {
                result[i] = 'wrong';
            }
        }
    }

    return result;
}

// Gérer une tentative de joueur
function handleGuess(room, player, guess) {
    if (room.status !== 'playing' || player.finished) return;

    guess = guess.toUpperCase();
    
    // Vérifier que la longueur correspond
    if (guess.length !== room.wordLength) {
        player.ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'Longueur de mot incorrecte' }
        }));
        return;
    }

    // Évaluer la tentative
    const evaluation = evaluateGuess(guess, room.currentWord);
    player.attemptCount++;
    player.attempts.push({ guess, evaluation });

    // Envoyer le résultat au joueur
    player.ws.send(JSON.stringify({
        type: 'guess-result',
        data: {
            guess,
            evaluation,
            attemptNumber: player.attemptCount
        }
    }));

    // Vérifier si le joueur a trouvé
    const isCorrect = evaluation.every(e => e === 'correct');
    if (isCorrect) {
        handlePlayerFinished(room, player);
    }

    // Notifier les autres joueurs de la progression
    broadcastToRoom(room, {
        type: 'player-progress',
        data: {
            playerId: player.id,
            username: player.username,
            attemptCount: player.attemptCount,
            finished: player.finished
        }
    }, player.ws);
}

// Gérer la fin de partie d'un joueur
function handlePlayerFinished(room, player) {
    player.finished = true;
    player.finishTime = Date.now() - room.startTime;

    console.log(`✅ ${player.username} a trouvé le mot en ${player.attemptCount} essais`);

    // Vérifier si tous les joueurs ont fini
    const allFinished = Array.from(room.players.values()).every(p => p.finished);
    
    if (allFinished || room.mode === 'essais') {
        // En mode essais, on attend que tout le monde finisse ou abandonne
        if (allFinished) {
            endGame(room, 'completed');
        }
    } else if (room.mode === 'temps') {
        // En mode temps, on peut finir quand tout le monde a trouvé
        if (allFinished) {
            endGame(room, 'completed');
        }
    }
}

// Calculer les scores en mode "essais"
function calculateScoresEssais(room) {
    const players = Array.from(room.players.values()).filter(p => p.finished);
    
    if (players.length === 0) return;

    // Trouver le premier à avoir fini
    const firstFinisher = players.reduce((first, current) => 
        current.finishTime < first.finishTime ? current : first
    );

    // Trouver celui avec le moins d'essais
    const fewestAttempts = Math.min(...players.map(p => p.attemptCount));
    const winner = players.find(p => p.attemptCount === fewestAttempts);

    players.forEach(player => {
        // Score de base selon les essais (100, 80, 60, 40, 20, 10)
        const baseScores = [100, 80, 60, 40, 20, 10];
        player.score = baseScores[Math.min(player.attemptCount - 1, 5)] || 10;

        // Bonus de 25 points pour le premier à finir
        if (player.id === firstFinisher.id) {
            player.score += 25;
        }

        // Le gagnant est celui avec le moins d'essais
        player.isWinner = (player.id === winner.id);
    });
}

// Calculer les scores en mode "temps"
function calculateScoresTemps(room) {
    const players = Array.from(room.players.values())
        .filter(p => p.finished)
        .sort((a, b) => a.finishTime - b.finishTime);

    if (players.length === 0) return;

    // Attribution des scores : 100, 75, 50, 25, 10 selon l'ordre d'arrivée
    const scores = [100, 75, 50, 25, 10];
    
    players.forEach((player, index) => {
        player.score = scores[Math.min(index, scores.length - 1)];
        player.isWinner = (index === 0); // Le premier est le gagnant
    });
}

// Terminer une partie
function endGame(room, reason) {
    if (room.status !== 'playing') return;

    room.status = 'finished';

    // Arrêter le timer si actif
    if (room.timerInterval) {
        clearInterval(room.timerInterval);
        room.timerInterval = null;
    }

    // Calculer les scores selon le mode
    if (room.mode === 'essais') {
        calculateScoresEssais(room);
    } else if (room.mode === 'temps') {
        calculateScoresTemps(room);
    }

    console.log(`🏁 Partie terminée dans la room ${room.code} - Raison: ${reason}`);

    // Préparer les résultats
    const results = Array.from(room.players.values()).map(p => ({
        id: p.id,
        username: p.username,
        finished: p.finished,
        attemptCount: p.attemptCount,
        finishTime: p.finishTime,
        score: p.score,
        isWinner: p.isWinner || false
    }));

    // Envoyer les résultats à tous les joueurs
    broadcastToRoom(room, {
        type: 'game-end',
        data: {
            reason,
            word: room.currentWord,
            results: results.sort((a, b) => b.score - a.score)
        }
    });

    // Réinitialiser le statut de la room
    setTimeout(() => {
        room.status = 'waiting';
        room.currentWord = null;
        room.players.forEach(p => {
            p.isReady = false;
            p.finished = false;
            p.finishTime = null;
            p.attemptCount = 0;
        });
        sendRoomStatus(room);
    }, 2000);
}

// Gérer la déconnexion d'un client
function handleDisconnect(ws) {
    const client = clients.get(ws);
    if (!client) return;

    console.log(`👋 ${client.username} (${client.id}) s'est déconnecté`);

    // Gérer déconnexion Snake
    if (client.snakeRoomCode) {
        handleSnakeDisconnect(ws, client);
    }

    // Si le client est dans une room TUSMO
    if (client.roomCode) {
        const room = rooms.get(client.roomCode);
        if (room) {
            room.players.delete(client.id);

            // Si c'était l'hôte, transférer le rôle
            if (room.hostId === client.id && room.players.size > 0) {
                room.hostId = Array.from(room.players.keys())[0];
                console.log(`👑 Nouvel hôte: ${room.hostId}`);
            }

            // Si la room est vide, la supprimer
            if (room.players.size === 0) {
                if (room.timerInterval) {
                    clearInterval(room.timerInterval);
                }
                rooms.delete(client.roomCode);
                console.log(`🗑️ Room ${client.roomCode} supprimée (vide)`);
            } else {
                // Notifier les autres joueurs
                broadcastToRoom(room, {
                    type: 'player-left',
                    data: {
                        playerId: client.id,
                        username: client.username
                    }
                });
                sendRoomStatus(room);
            }
        }
    }

    clients.delete(ws);
}

// Gestion des connexions WebSocket
wss.on('connection', (ws, req) => {
    // Récupérer l'IP du client
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    
    // Vérifier le rate limit
    if (!checkRateLimit(ip)) {
        console.log(`❌ Connexion refusée pour IP bannie: ${ip}`);
        ws.close(1008, 'Trop de connexions. Vous êtes temporairement banni.');
        return;
    }
    
    const clientId = ++clientIdCounter;
    console.log(`🔌 Connexion ${clientId} depuis ${ip}`);

    // Initialiser le client
    clients.set(ws, {
        id: clientId,
        username: `Joueur${clientId}`,
        roomCode: null,
        snakeRoomCode: null,
        isReady: false,
        ip: ip
    });

    // Envoyer l'ID au client
    ws.send(JSON.stringify({
        type: 'connected',
        data: { clientId }
    }));

    // Gérer les messages
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            const client = clients.get(ws);

            switch (message.type) {
                case 'set-username':
                    client.username = message.data.username;
                    console.log(`👤 Client ${client.id} -> ${client.username}`);
                    ws.send(JSON.stringify({
                        type: 'username-set',
                        data: { username: client.username }
                    }));
                    break;

                case 'create-room':
                    const roomCode = generateRoomCode();
                    const mode = message.data.mode || 'essais';
                    const room = new Room(roomCode, mode, client.id);
                    
                    const player = new Player(client.id, client.username, ws);
                    room.players.set(client.id, player);
                    
                    rooms.set(roomCode, room);
                    client.roomCode = roomCode;

                    console.log(`🚪 ${client.username} a créé la room ${roomCode} (mode: ${mode})`);

                    ws.send(JSON.stringify({
                        type: 'room-created',
                        data: { code: roomCode, mode }
                    }));
                    sendRoomStatus(room);
                    break;

                case 'join-room':
                    if (!message.data || !message.data.code) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            data: { message: 'Code de salon invalide' }
                        }));
                        break;
                    }
                    const joinCode = message.data.code.toUpperCase();
                    const targetRoom = rooms.get(joinCode);

                    if (!targetRoom) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            data: { message: 'Salon introuvable' }
                        }));
                        break;
                    }

                    if (targetRoom.status === 'playing') {
                        // Vérifier si le joueur est déjà dans la room (reconnexion)
                        const existingPlayer = Array.from(targetRoom.players.values())
                            .find(p => p.username === client.username);
                        
                        if (existingPlayer) {
                            // Reconnexion : mettre à jour le WebSocket
                            existingPlayer.ws = ws;
                            client.roomCode = joinCode;
                            
                            console.log(`🔄 ${client.username} s'est reconnecté à la room ${joinCode}`);
                            
                            ws.send(JSON.stringify({
                                type: 'room-joined',
                                data: { code: joinCode, mode: targetRoom.mode }
                            }));
                            
                            sendRoomStatus(targetRoom);
                        } else {
                            ws.send(JSON.stringify({
                                type: 'error',
                                data: { message: 'Partie déjà en cours' }
                            }));
                        }
                        break;
                    }

                    const newPlayer = new Player(client.id, client.username, ws);
                    targetRoom.players.set(client.id, newPlayer);
                    client.roomCode = joinCode;

                    console.log(`🚪 ${client.username} a rejoint la room ${joinCode}`);

                    ws.send(JSON.stringify({
                        type: 'room-joined',
                        data: { code: joinCode, mode: targetRoom.mode }
                    }));

                    broadcastToRoom(targetRoom, {
                        type: 'player-joined',
                        data: {
                            playerId: client.id,
                            username: client.username
                        }
                    }, ws);

                    sendRoomStatus(targetRoom);
                    break;

                case 'toggle-ready':
                    if (!client.roomCode) break;
                    const currentRoom = rooms.get(client.roomCode);
                    if (!currentRoom) break;

                    const currentPlayer = currentRoom.players.get(client.id);
                    if (currentPlayer) {
                        currentPlayer.isReady = !currentPlayer.isReady;
                        client.isReady = currentPlayer.isReady;
                        console.log(`${client.username} est ${currentPlayer.isReady ? 'prêt' : 'pas prêt'}`);
                        sendRoomStatus(currentRoom);
                    }
                    break;

                case 'start-game':
                    if (!client.roomCode) break;
                    const gameRoom = rooms.get(client.roomCode);
                    if (!gameRoom || gameRoom.hostId !== client.id) break;

                    // Vérifier que tous les joueurs sont prêts
                    const allReady = Array.from(gameRoom.players.values()).every(p => p.isReady);
                    if (!allReady) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            data: { message: 'Tous les joueurs doivent être prêts' }
                        }));
                        break;
                    }

                    startGame(gameRoom);
                    break;

                case 'submit-guess':
                    if (!client.roomCode) break;
                    const playRoom = rooms.get(client.roomCode);
                    if (!playRoom) break;

                    const playingPlayer = playRoom.players.get(client.id);
                    if (playingPlayer) {
                        handleGuess(playRoom, playingPlayer, message.data.guess);
                    }
                    break;

                case 'leave-room':
                    if (!client.roomCode) break;
                    const leaveRoom = rooms.get(client.roomCode);
                    if (!leaveRoom) break;

                    leaveRoom.players.delete(client.id);
                    
                    // Si c'était l'hôte, transférer
                    if (leaveRoom.hostId === client.id && leaveRoom.players.size > 0) {
                        leaveRoom.hostId = Array.from(leaveRoom.players.keys())[0];
                    }

                    broadcastToRoom(leaveRoom, {
                        type: 'player-left',
                        data: {
                            playerId: client.id,
                            username: client.username
                        }
                    });

                    client.roomCode = null;
                    client.isReady = false;

                    ws.send(JSON.stringify({
                        type: 'room-left'
                    }));

                    if (leaveRoom.players.size === 0) {
                        if (leaveRoom.timerInterval) {
                            clearInterval(leaveRoom.timerInterval);
                        }
                        rooms.delete(leaveRoom.code);
                        console.log(`🗑️ Room ${leaveRoom.code} supprimée`);
                    } else {
                        sendRoomStatus(leaveRoom);
                    }
                    break;

                // ==========================================
                // ======= SNAKE MESSAGE HANDLERS ===========
                // ==========================================

                case 'create-snake-room':
                    const snakeRoomCode = generateRoomCode();
                    const snakeRoom = new SnakeRoom(snakeRoomCode, client.id);
                    
                    const snakePlayer = new SnakePlayer(client.id, client.username, ws, 0);
                    snakeRoom.players.set(client.id, snakePlayer);
                    
                    snakeRooms.set(snakeRoomCode, snakeRoom);
                    client.snakeRoomCode = snakeRoomCode;

                    console.log(`🐍 Snake: ${client.username} a créé la room ${snakeRoomCode}`);

                    ws.send(JSON.stringify({
                        type: 'snake-room-created',
                        data: { code: snakeRoomCode }
                    }));
                    sendSnakeRoomStatus(snakeRoom);
                    break;

                case 'join-snake-room':
                    if (!message.data || !message.data.code) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            data: { message: 'Code de salon invalide' }
                        }));
                        break;
                    }
                    const joinSnakeCode = message.data.code.toUpperCase();
                    const targetSnakeRoom = snakeRooms.get(joinSnakeCode);

                    if (!targetSnakeRoom) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            data: { message: 'Salon Snake introuvable' }
                        }));
                        break;
                    }

                    if (targetSnakeRoom.status !== 'waiting') {
                        ws.send(JSON.stringify({
                            type: 'error',
                            data: { message: 'Partie déjà en cours' }
                        }));
                        break;
                    }

                    if (targetSnakeRoom.players.size >= 6) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            data: { message: 'Salon plein (max 6 joueurs)' }
                        }));
                        break;
                    }

                    const newSnakePlayer = new SnakePlayer(
                        client.id, 
                        client.username, 
                        ws, 
                        targetSnakeRoom.players.size
                    );
                    targetSnakeRoom.players.set(client.id, newSnakePlayer);
                    client.snakeRoomCode = joinSnakeCode;

                    console.log(`🐍 Snake: ${client.username} a rejoint la room ${joinSnakeCode}`);

                    ws.send(JSON.stringify({
                        type: 'snake-room-joined',
                        data: { code: joinSnakeCode }
                    }));

                    broadcastToSnakeRoom(targetSnakeRoom, {
                        type: 'snake-player-joined',
                        data: { playerId: client.id, username: client.username }
                    }, ws);

                    sendSnakeRoomStatus(targetSnakeRoom);
                    break;

                case 'toggle-snake-ready':
                    if (!client.snakeRoomCode) break;
                    const readySnakeRoom = snakeRooms.get(client.snakeRoomCode);
                    if (!readySnakeRoom) break;

                    const readyPlayer = readySnakeRoom.players.get(client.id);
                    if (readyPlayer) {
                        readyPlayer.isReady = !readyPlayer.isReady;
                        console.log(`🐍 Snake: ${client.username} est ${readyPlayer.isReady ? 'prêt' : 'pas prêt'}`);
                        sendSnakeRoomStatus(readySnakeRoom);
                    }
                    break;

                case 'start-snake-game':
                    if (!client.snakeRoomCode) break;
                    const gameSnakeRoom = snakeRooms.get(client.snakeRoomCode);
                    if (!gameSnakeRoom || gameSnakeRoom.hostId !== client.id) break;

                    const allSnakeReady = Array.from(gameSnakeRoom.players.values()).every(p => p.isReady);
                    if (!allSnakeReady) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            data: { message: 'Tous les joueurs doivent être prêts' }
                        }));
                        break;
                    }

                    if (gameSnakeRoom.players.size < 2) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            data: { message: 'Il faut au moins 2 joueurs' }
                        }));
                        break;
                    }

                    // Envoyer l'ID à chaque joueur avant de démarrer
                    gameSnakeRoom.players.forEach(p => {
                        p.ws.send(JSON.stringify({
                            type: 'snake-your-id',
                            data: { id: p.id }
                        }));
                    });

                    startSnakeCountdown(gameSnakeRoom);
                    break;

                case 'snake-rejoin-game':
                    // Rejoint une partie en cours (après redirection de page)
                    const rejoinCode = message.data.roomCode;
                    const rejoinRoom = snakeRooms.get(rejoinCode);
                    
                    if (rejoinRoom) {
                        // Trouver le joueur par username
                        let foundPlayer = null;
                        let foundPlayerId = null;
                        rejoinRoom.players.forEach((p, id) => {
                            if (p.username === message.data.username) {
                                foundPlayer = p;
                                foundPlayerId = id;
                            }
                        });
                        
                        if (foundPlayer) {
                            foundPlayer.ws = ws;
                            client.id = foundPlayerId; // Mettre à jour l'ID du client
                            client.snakeRoomCode = rejoinCode;
                            client.username = message.data.username;
                            
                            // Envoyer l'ID au joueur
                            ws.send(JSON.stringify({
                                type: 'snake-your-id',
                                data: { id: foundPlayerId }
                            }));
                            
                            console.log(`🐍 Snake: ${message.data.username} (ID: ${foundPlayerId}) reconnecté à la room ${rejoinCode} - Status: ${rejoinRoom.status}`);
                            
                            // Envoyer l'état actuel du jeu si en cours
                            if (rejoinRoom.status === 'playing') {
                                ws.send(JSON.stringify({ type: 'snake-game-started' }));
                                sendSnakeGameState(rejoinRoom);
                            }
                        } else {
                            console.log(`⚠️ Snake: Joueur ${message.data.username} introuvable dans la room ${rejoinCode}`);
                            ws.send(JSON.stringify({
                                type: 'error',
                                data: { message: 'Session expirée, retournez au lobby' }
                            }));
                        }
                    } else {
                        console.log(`⚠️ Snake: Room ${rejoinCode} introuvable`);
                        ws.send(JSON.stringify({
                            type: 'error',
                            data: { message: 'Salon introuvable, retournez au lobby' }
                        }));
                    }
                    break;

                case 'snake-direction':
                    if (!client.snakeRoomCode) break;
                    const dirRoom = snakeRooms.get(client.snakeRoomCode);
                    if (!dirRoom || dirRoom.status !== 'playing') break;

                    // Trouver le joueur par username car l'ID peut avoir changé après reconnexion
                    let dirPlayer = null;
                    dirRoom.players.forEach(p => {
                        if (p.username === client.username) {
                            dirPlayer = p;
                        }
                    });
                    
                    if (dirPlayer && dirPlayer.alive) {
                        const newDir = message.data.direction;
                        const currentDir = dirPlayer.direction;
                        
                        // Empêcher de faire demi-tour
                        const opposites = {
                            'up': 'down', 'down': 'up',
                            'left': 'right', 'right': 'left'
                        };
                        
                        if (opposites[newDir] !== currentDir) {
                            dirPlayer.nextDirection = newDir;
                        }
                    }
                    break;

                case 'snake-restart-game':
                    if (!client.snakeRoomCode) break;
                    const restartRoom = snakeRooms.get(client.snakeRoomCode);
                    if (restartRoom && restartRoom.status === 'finished') {
                        restartSnakeGame(restartRoom);
                    }
                    break;
                
                case 'snake-quick-restart':
                    if (!client.snakeRoomCode) break;
                    const quickRoom = snakeRooms.get(client.snakeRoomCode);
                    if (quickRoom && quickRoom.status === 'finished' && quickRoom.hostId === client.id) {
                        quickRestartSnakeGame(quickRoom);
                    }
                    break;

                case 'leave-snake-room':
                    if (!client.snakeRoomCode) break;
                    const leaveSnakeRoom = snakeRooms.get(client.snakeRoomCode);
                    
                    if (leaveSnakeRoom) {
                        const leavingPlayer = leaveSnakeRoom.players.get(client.id);
                        if (leavingPlayer) {
                            leavingPlayer.alive = false;
                            leaveSnakeRoom.players.delete(client.id);
                            
                            console.log(`🐍 Snake: ${client.username} a quitté la room ${leaveSnakeRoom.code}`);
                            
                            // Transférer l'hôte si nécessaire
                            if (leaveSnakeRoom.hostId === client.id && leaveSnakeRoom.players.size > 0) {
                                leaveSnakeRoom.hostId = Array.from(leaveSnakeRoom.players.keys())[0];
                            }
                            
                            if (leaveSnakeRoom.players.size === 0) {
                                // Nettoyer la room
                                if (leaveSnakeRoom.gameInterval) clearInterval(leaveSnakeRoom.gameInterval);
                                if (leaveSnakeRoom.superFoodTimer) clearInterval(leaveSnakeRoom.superFoodTimer);
                                snakeRooms.delete(leaveSnakeRoom.code);
                                console.log(`🐍 Snake: Room ${leaveSnakeRoom.code} supprimée (vide)`);
                            } else {
                                // Réinitialiser la room si le jeu est terminé
                                if (leaveSnakeRoom.status === 'finished') {
                                    leaveSnakeRoom.status = 'waiting';
                                    leaveSnakeRoom.players.forEach(p => {
                                        p.isReady = false;
                                        p.alive = true;
                                        p.score = 0;
                                        p.snake = [];
                                    });
                                }
                                
                                broadcastToSnakeRoom(leaveSnakeRoom, {
                                    type: 'snake-player-left',
                                    data: { playerId: client.id, username: client.username }
                                });
                                
                                sendSnakeRoomStatus(leaveSnakeRoom);
                            }
                        }
                    }
                    
                    client.snakeRoomCode = null;
                    ws.send(JSON.stringify({ type: 'snake-room-left' }));
                    break;

                default:
                    console.log(`⚠️ Type de message inconnu: ${message.type}`);
            }
        } catch (error) {
            console.error('❌ Erreur lors du traitement du message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                data: { message: 'Erreur serveur' }
            }));
        }
    });

    // Gérer la déconnexion
    ws.on('close', () => handleDisconnect(ws));
    ws.on('error', (error) => {
        console.error('❌ Erreur WebSocket:', error);
        handleDisconnect(ws);
    });
});

console.log(`🚀 Serveur WebSocket démarré sur le port ${WS_PORT}`);
console.log(`📡 Les clients peuvent se connecter à ws://localhost:${WS_PORT}`);
