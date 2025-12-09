# Plan de Développement - TUSMO Multijoueur

## 📋 Vue d'ensemble

Transformation du jeu TUSMO solo en version multijoueur compétitif en réseau local avec deux modes de jeu distincts.

---

## 🎯 Objectifs principaux

1. Permettre à plusieurs joueurs sur le même WiFi de s'affronter sur le même mot
2. Implémenter deux modes de jeu compétitifs
3. Créer un système de lobby/salle d'attente
4. Synchroniser l'état du jeu entre tous les joueurs en temps réel
5. Afficher un classement en direct pendant la partie

---

## 🏗️ Architecture technique

### Backend (Serveur WebSocket)

**Fichier : `server.js` (Node.js)**
- Serveur WebSocket avec `ws` ou `socket.io`
- Port : 8081 (ou configurable)
- Gestion des salles de jeu (rooms)
- Synchronisation de l'état du jeu
- Timer pour le mode "Temps"
- Calcul et distribution des scores

**Structure des données côté serveur :**
```javascript
{
  rooms: {
    [roomId]: {
      id: string,
      name: string,
      mode: 'essais' | 'temps',
      status: 'waiting' | 'playing' | 'finished',
      word: string,
      wordLength: number,
      players: [
        {
          id: string,
          name: string,
          status: 'alive' | 'dead' | 'finished',
          attempts: number,
          score: number,
          finishTime: timestamp | null,
          grid: [][]
        }
      ],
      firstFinisher: { playerId, attempts, time },
      maxAttempts: 6,
      startTime: timestamp,
      timeLimit: 300000 // 5 minutes
    }
  }
}
```

### Frontend

**Nouveaux fichiers :**
- `multiplayer.html` - Page du jeu multijoueur
- `multiplayer.css` - Styles pour le mode multi
- `multiplayer.js` - Logique client multijoueur
- `lobby.html` - Sélection/création de salle
- `lobby.css` - Styles du lobby
- `lobby.js` - Logique du lobby

**Fichiers existants à modifier :**
- `index.html` - Ajouter lien vers le mode multijoueur
- `menu.css` - Ajouter carte pour mode multijoueur

---

## 📦 Fonctionnalités détaillées

### 1. Lobby / Salle d'attente

**lobby.html - Structure :**
```
- Header avec "← Accueil"
- Section "Créer une salle"
  * Input : Nom de la salle
  * Select : Mode de jeu (Essais / Temps)
  * Input : Pseudo du joueur
  * Bouton : "Créer"
  
- Section "Rejoindre une salle"
  * Liste des salles disponibles (refresh auto)
  * Pour chaque salle :
    - Nom de la salle
    - Mode de jeu
    - Nombre de joueurs (X/8 max)
    - Statut (En attente / En cours)
    - Bouton "Rejoindre" (si pas pleine et en attente)
  
- Section "Ma salle" (si dans une salle)
  * Nom de la salle
  * Mode sélectionné
  * Liste des joueurs connectés
  * Bouton "Lancer la partie" (seulement créateur)
  * Bouton "Quitter la salle"
```

**lobby.js - Logique :**
- Connexion WebSocket au serveur
- Événements :
  * `room-list-update` : Mise à jour liste des salles
  * `room-joined` : Confirmation d'entrée dans salle
  * `player-joined` : Nouveau joueur dans ma salle
  * `player-left` : Joueur quitté
  * `game-starting` : Redirection vers multiplayer.html
- Actions :
  * `create-room` : Créer nouvelle salle
  * `join-room` : Rejoindre salle existante
  * `leave-room` : Quitter la salle
  * `start-game` : Démarrer (créateur uniquement)

---

### 2. Interface de jeu multijoueur

**multiplayer.html - Structure :**
```
- Top bar
  * Bouton "Quitter la partie" (retour lobby)
  * Nom de la salle
  * Mode de jeu
  * Timer (mode Temps uniquement)
  
- Section principale (2 colonnes sur desktop, stack sur mobile)
  
  Colonne gauche - MON JEU :
  * Grille de jeu (identique au solo)
  * Clavier virtuel
  * Message d'état
  * Mes stats :
    - Essais utilisés : X/6
    - Temps écoulé (mode Temps)
    - Essais restants (mode Essais, si premier a fini)
  
  Colonne droite - CLASSEMENT EN DIRECT :
  * Liste des joueurs triée par :
    - Mode Essais : par nombre d'essais (asc)
    - Mode Temps : par temps de résolution (asc)
  * Pour chaque joueur :
    - Avatar/Icône
    - Pseudo
    - Statut : 🎮 En cours / ✅ Terminé / ❌ Éliminé
    - Nombre d'essais utilisés
    - Temps écoulé (mode Temps)
    - Score temporaire/final
  * Badges spéciaux :
    - 👑 Premier à terminer (mode Essais)
    - 🥇🥈🥉 Top 3 (mode Temps)

- Modal de fin de partie :
  * Podium (top 3)
  * Tableau complet des scores
  * Le mot était : [MOT]
  * Bouton "Retour au lobby"
  * Bouton "Relancer" (créateur uniquement)
```

**multiplayer.js - Logique :**

**Connexion & Initialisation :**
- Récupération roomId et playerId depuis URL ou sessionStorage
- Connexion WebSocket
- Chargement dictionnaire (comme solo)
- Récupération de l'état du jeu

**Événements WebSocket reçus :**
- `game-state` : État complet du jeu (initial + updates)
- `player-updated` : Mise à jour d'un joueur spécifique
- `player-finished` : Un joueur a terminé
- `player-eliminated` : Un joueur est éliminé (mode Essais)
- `first-finisher` : Premier joueur terminé (mode Essais)
- `remaining-attempts-update` : Mise à jour compteur essais restants
- `game-ended` : Fin de partie, scores finaux
- `timer-update` : Mise à jour du timer (mode Temps)

**Événements WebSocket envoyés :**
- `submit-guess` : Soumission d'une tentative
  * Payload : { guess: string, attempt: number }
- `player-finished` : J'ai trouvé le mot
  * Payload : { attempts: number, time: number }
- `leave-game` : Quitter la partie en cours

**Logique spécifique Mode Essais :**
```javascript
onPlayerFinished(data) {
  if (data.isFirst) {
    // C'est le premier finisher
    // Afficher alerte "Premier à terminer ! +25 points bonus"
    
    // Pour les autres joueurs encore en vie :
    if (!myPlayer.finished) {
      const remainingAttempts = data.attempts - myPlayer.currentAttempt;
      
      if (remainingAttempts <= 0) {
        // Je suis éliminé
        myPlayer.status = 'dead';
        showMessage("❌ Éliminé ! Le premier a terminé en moins d'essais");
        disableGame();
      } else {
        // J'ai encore des essais
        myPlayer.maxAttemptsLeft = remainingAttempts;
        showMessage(`⏱️ ${remainingAttempts} essai(s) restant(s) !`);
        updateAttemptsDisplay();
      }
    }
  } else {
    // Pas le premier, vérifier si j'ai le même nombre d'essais
    if (!myPlayer.finished && myPlayer.currentAttempt === data.attempts) {
      // Match parfait, je partage la victoire
      calculateMyScore(); // 100 points partagés
    }
  }
}

calculateScoreEssais() {
  const winners = players.filter(p => 
    p.finished && 
    p.attempts === minAttempts
  );
  
  if (winners.includes(me)) {
    myScore = 100; // Seul gagnant ou égalité
  }
  
  if (firstFinisher === me) {
    myScore += 25; // Bonus premier
  }
}
```

**Logique spécifique Mode Temps :**
```javascript
onPlayerFinished(data) {
  // Ajouter au classement avec timestamp
  rankings.push({
    playerId: data.playerId,
    finishTime: data.time,
    attempts: data.attempts
  });
  
  // Trier par temps
  rankings.sort((a, b) => a.finishTime - b.finishTime);
  
  // Recalculer scores
  updateScores();
}

calculateScoreTemps() {
  const rank = rankings.findIndex(r => r.playerId === myId) + 1;
  
  // Système de points dégressif
  const scoreTable = {
    1: 100,
    2: 80,
    3: 60,
    4: 40,
    5: 20,
    6: 10
  };
  
  myScore = scoreTable[rank] || 5;
}

// Timer synchronisé
let timerInterval;
function startTimer(startTime) {
  timerInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const remaining = TIME_LIMIT - elapsed;
    
    if (remaining <= 0) {
      // Temps écoulé
      endGame();
    }
    
    updateTimerDisplay(remaining);
  }, 100);
}
```

**Gestion de la grille :**
- Identique au mode solo
- Chaque saisie/validation reste locale
- Envoyer seulement les tentatives validées au serveur
- Pas de synchronisation de chaque lettre tapée

**Validation de mot :**
```javascript
async submitGuess() {
  // 1. Validation locale (même logique que solo)
  const guess = getCurrentGuess();
  
  if (!await isValidWord(guess)) {
    showError("Mot invalide");
    return;
  }
  
  // 2. Évaluer localement (rouge/jaune/gris)
  const evaluation = evaluateGuess(guess, targetWord);
  updateGrid(evaluation);
  
  // 3. Vérifier si victoire
  const isWin = guess === targetWord;
  
  if (isWin) {
    const finishTime = Date.now() - gameStartTime;
    socket.emit('player-finished', {
      attempts: currentAttempt + 1,
      time: finishTime
    });
  }
  
  // 4. Envoyer au serveur pour sync
  socket.emit('submit-guess', {
    guess: guess,
    attempt: currentAttempt,
    isCorrect: isWin,
    evaluation: evaluation
  });
  
  currentAttempt++;
  
  // 5. Vérifier élimination (mode Essais)
  if (mode === 'essais' && maxAttemptsLeft !== null) {
    if (currentAttempt >= maxAttemptsLeft) {
      eliminateMe();
    }
  }
}
```

---

### 3. Backend WebSocket (server.js)

**Initialisation :**
```javascript
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8081 });

const rooms = new Map();
const clients = new Map(); // Map<wsConnection, { playerId, roomId }>

wss.on('connection', (ws) => {
  const clientId = generateId();
  clients.set(ws, { playerId: clientId });
  
  ws.on('message', (data) => handleMessage(ws, data));
  ws.on('close', () => handleDisconnect(ws));
});
```

**Gestion des salles :**
```javascript
function createRoom(data, ws) {
  const roomId = generateRoomId();
  const room = {
    id: roomId,
    name: data.roomName,
    mode: data.mode, // 'essais' | 'temps'
    status: 'waiting',
    creatorId: clients.get(ws).playerId,
    players: [],
    word: null,
    startTime: null,
    firstFinisher: null,
    maxAttempts: 6
  };
  
  rooms.set(roomId, room);
  
  // Ajouter le créateur comme joueur
  joinRoom({ roomId, playerName: data.playerName }, ws);
  
  // Broadcast room list update
  broadcastRoomList();
}

function joinRoom(data, ws) {
  const room = rooms.get(data.roomId);
  if (!room || room.status !== 'waiting' || room.players.length >= 8) {
    ws.send(JSON.stringify({ type: 'error', message: 'Cannot join room' }));
    return;
  }
  
  const player = {
    id: clients.get(ws).playerId,
    name: data.playerName,
    ws: ws,
    status: 'alive',
    attempts: 0,
    currentAttempt: 0,
    score: 0,
    finishTime: null,
    finished: false,
    grid: []
  };
  
  room.players.push(player);
  clients.get(ws).roomId = data.roomId;
  
  // Confirmer au joueur
  ws.send(JSON.stringify({ 
    type: 'room-joined', 
    roomId: data.roomId,
    playerId: player.id 
  }));
  
  // Notifier tous les joueurs de la salle
  broadcastToRoom(data.roomId, {
    type: 'player-joined',
    player: sanitizePlayer(player)
  });
  
  broadcastRoomList();
}

function startGame(data, ws) {
  const roomId = clients.get(ws).roomId;
  const room = rooms.get(roomId);
  
  if (room.creatorId !== clients.get(ws).playerId) {
    ws.send(JSON.stringify({ type: 'error', message: 'Only creator can start' }));
    return;
  }
  
  // Choisir un mot aléatoire
  room.word = getRandomWord();
  room.wordLength = room.word.length;
  room.status = 'playing';
  room.startTime = Date.now();
  
  // Notifier tous les joueurs
  broadcastToRoom(roomId, {
    type: 'game-starting',
    wordLength: room.wordLength,
    mode: room.mode,
    startTime: room.startTime
  });
  
  // Démarrer timer pour mode Temps
  if (room.mode === 'temps') {
    startRoomTimer(roomId);
  }
}
```

**Gestion des tentatives :**
```javascript
function handleGuess(data, ws) {
  const roomId = clients.get(ws).roomId;
  const room = rooms.get(roomId);
  const player = room.players.find(p => p.id === clients.get(ws).playerId);
  
  if (!player || player.status === 'dead' || player.finished) {
    return;
  }
  
  // Stocker la tentative
  player.grid.push(data.evaluation);
  player.currentAttempt = data.attempt + 1;
  
  // Si c'est correct
  if (data.isCorrect) {
    handlePlayerFinished(room, player);
  }
  
  // Broadcast mise à jour du joueur
  broadcastToRoom(roomId, {
    type: 'player-updated',
    player: sanitizePlayer(player)
  });
}

function handlePlayerFinished(room, player) {
  player.finished = true;
  player.finishTime = Date.now() - room.startTime;
  player.attempts = player.currentAttempt;
  
  if (room.mode === 'essais') {
    // Mode Essais
    if (!room.firstFinisher) {
      // Premier à terminer
      room.firstFinisher = {
        playerId: player.id,
        attempts: player.attempts
      };
      
      player.score = 25; // Bonus premier
      
      broadcastToRoom(room.id, {
        type: 'first-finisher',
        playerId: player.id,
        attempts: player.attempts
      });
      
      // Éliminer ou limiter les autres joueurs
      room.players.forEach(p => {
        if (p.id !== player.id && !p.finished) {
          const remaining = player.attempts - p.currentAttempt;
          
          if (remaining <= 0) {
            // Éliminé
            p.status = 'dead';
            p.ws.send(JSON.stringify({
              type: 'player-eliminated',
              reason: 'too-many-attempts'
            }));
          } else {
            // Limiter essais
            p.ws.send(JSON.stringify({
              type: 'remaining-attempts-update',
              remaining: remaining
            }));
          }
        }
      });
    }
    
    // Vérifier si la partie est terminée
    checkGameEndEssais(room);
    
  } else {
    // Mode Temps
    broadcastToRoom(room.id, {
      type: 'player-finished',
      playerId: player.id,
      finishTime: player.finishTime,
      attempts: player.attempts
    });
    
    // Vérifier si tous ont fini
    checkGameEndTemps(room);
  }
}

function checkGameEndEssais(room) {
  const alivePlayers = room.players.filter(p => p.status === 'alive' && !p.finished);
  
  if (alivePlayers.length === 0) {
    // Tous ont terminé ou sont morts
    calculateScoresEssais(room);
    endGame(room);
  }
}

function calculateScoresEssais(room) {
  // Trouver le minimum d'essais parmi les finishers
  const finishedPlayers = room.players.filter(p => p.finished);
  const minAttempts = Math.min(...finishedPlayers.map(p => p.attempts));
  
  // Donner 100 points à ceux qui ont le minimum
  finishedPlayers.forEach(p => {
    if (p.attempts === minAttempts) {
      p.score += 100;
    }
  });
}

function checkGameEndTemps(room) {
  const allFinished = room.players.every(p => p.finished || p.status === 'dead');
  
  if (allFinished) {
    calculateScoresTemps(room);
    endGame(room);
  }
}

function calculateScoresTemps(room) {
  // Trier par temps
  const rankings = room.players
    .filter(p => p.finished)
    .sort((a, b) => a.finishTime - b.finishTime);
  
  const scoreTable = [100, 80, 60, 40, 20, 10, 5, 5];
  
  rankings.forEach((player, index) => {
    player.score = scoreTable[index] || 5;
  });
}

function startRoomTimer(roomId) {
  const room = rooms.get(roomId);
  const TIME_LIMIT = 300000; // 5 minutes
  
  const interval = setInterval(() => {
    const elapsed = Date.now() - room.startTime;
    
    if (elapsed >= TIME_LIMIT || room.status === 'finished') {
      clearInterval(interval);
      
      if (room.status === 'playing') {
        // Temps écoulé, fin forcée
        endGame(room);
      }
      return;
    }
    
    // Broadcast timer update
    broadcastToRoom(roomId, {
      type: 'timer-update',
      remaining: TIME_LIMIT - elapsed
    });
  }, 1000);
}

function endGame(room) {
  room.status = 'finished';
  
  // Calculer classement final
  const rankings = room.players
    .sort((a, b) => b.score - a.score);
  
  broadcastToRoom(room.id, {
    type: 'game-ended',
    word: room.word,
    rankings: rankings.map(sanitizePlayer)
  });
}
```

---

## 🎨 Design UI/UX

### Lobby
- Carte de salle : glassmorphism avec bordure colorée selon mode
- Liste des joueurs : avatars en cercle avec noms
- Animation : pulse sur bouton "Lancer" quand tous prêts

### Jeu multijoueur
- Grille personnelle : même style que solo
- Classement : 
  * Carte compacte par joueur
  * Couleur verte pour "finished"
  * Couleur rouge pour "dead"
  * Animation pulse sur changement de position
- Timer : grand affichage en haut, rouge quand < 1 min
- Notifications toast :
  * "🏆 Premier à terminer !"
  * "⚠️ X essais restants"
  * "❌ Éliminé"

### Podium fin de partie
- Animation entrée des joueurs sur le podium
- Confettis pour le gagnant
- Tableau scores : tri animé

---

## 📱 Responsive Design

**Desktop (> 1024px) :**
- 2 colonnes : Jeu 60% | Classement 40%

**Tablet (768px - 1024px) :**
- 2 colonnes : Jeu 50% | Classement 50%
- Clavier réduit

**Mobile (< 768px) :**
- 1 colonne stackée
- Classement en haut (collapsible)
- Jeu en bas
- Clavier pleine largeur

---

## 🔧 Installation & Configuration

### Prérequis
- Node.js v16+
- npm ou yarn

### Installation serveur
```bash
cd TUSMO
npm init -y
npm install ws
```

### Lancement
```bash
# Terminal 1 : Serveur WebSocket
node server.js

# Terminal 2 : Serveur HTTP (existant)
python -m http.server 8080
```

### Configuration réseau local
- Serveur WS : `ws://[IP_LOCAL]:8081`
- Serveur HTTP : `http://[IP_LOCAL]:8080`
- Ajouter IP locale dans `multiplayer.js`

---

## 🧪 Tests à effectuer

### Tests fonctionnels
1. ✅ Créer une salle
2. ✅ Rejoindre une salle
3. ✅ Lancer une partie
4. ✅ Soumettre des tentatives valides/invalides
5. ✅ Premier joueur termine (mode Essais)
6. ✅ Élimination automatique (mode Essais)
7. ✅ Compteur essais restants fonctionne
8. ✅ Calcul scores mode Essais correct
9. ✅ Calcul scores mode Temps correct
10. ✅ Timer synchronisé (mode Temps)
11. ✅ Fin de partie automatique
12. ✅ Déconnexion d'un joueur
13. ✅ Refresh page pendant partie
14. ✅ Créateur quitte avant lancement

### Tests multi-appareils
- 2 joueurs
- 4 joueurs
- 8 joueurs (max)
- Mix PC/Mobile/Tablette

---

## 📝 Structure des fichiers finaux

```
TUSMO/
├── index.html (modifié - lien mode multi)
├── motus.html
├── lobby.html (nouveau)
├── multiplayer.html (nouveau)
├── menu.css (modifié - carte mode multi)
├── lobby.css (nouveau)
├── styles.css
├── multiplayer.css (nouveau)
├── game.js
├── lobby.js (nouveau)
├── multiplayer.js (nouveau)
├── words.js
├── server.js (nouveau - Node.js)
├── package.json (nouveau)
├── PLAN_DEV_MULTIJOUEUR.md (ce fichier)
└── README.md (à créer - instructions)
```

---

## ⚡ Optimisations futures

1. Reconnexion automatique en cas de déconnexion
2. Système de chat entre joueurs
3. Statistiques multijoueur persistantes
4. Rooms privées avec code
5. Spectateur mode
6. Replay de partie
7. Tournois avec brackets
8. Émojis réactions en temps réel

---

## 🐛 Gestion d'erreurs

### Serveur
- ✅ Room inexistante
- ✅ Room pleine
- ✅ Partie déjà commencée
- ✅ Déconnexion brutale
- ✅ Tentative invalide
- ✅ Mot introuvable dans dico

### Client
- ✅ Connexion WS échouée
- ✅ Déconnexion serveur
- ✅ Timeout réseau
- ✅ État incohérent
- ✅ Refresh page

---

## 📊 Messages WebSocket

### Client → Serveur
```javascript
// Lobby
{ type: 'create-room', roomName: string, mode: string, playerName: string }
{ type: 'join-room', roomId: string, playerName: string }
{ type: 'leave-room' }
{ type: 'start-game' }
{ type: 'get-room-list' }

// Game
{ type: 'submit-guess', guess: string, attempt: number, isCorrect: boolean, evaluation: [] }
{ type: 'player-finished', attempts: number, time: number }
{ type: 'leave-game' }
```

### Serveur → Client
```javascript
// Lobby
{ type: 'room-list', rooms: [] }
{ type: 'room-joined', roomId: string, playerId: string }
{ type: 'player-joined', player: {} }
{ type: 'player-left', playerId: string }
{ type: 'game-starting', wordLength: number, mode: string, startTime: number }

// Game
{ type: 'game-state', room: {} }
{ type: 'player-updated', player: {} }
{ type: 'first-finisher', playerId: string, attempts: number }
{ type: 'player-finished', playerId: string, finishTime: number, attempts: number }
{ type: 'player-eliminated', playerId: string, reason: string }
{ type: 'remaining-attempts-update', remaining: number }
{ type: 'timer-update', remaining: number }
{ type: 'game-ended', word: string, rankings: [] }

// Erreurs
{ type: 'error', message: string, code: string }
```

---

## ✅ Checklist de développement

### Phase 1 : Backend (server.js)
- [ ] Initialiser projet Node.js
- [ ] Installer WebSocket library
- [ ] Implémenter gestion connexions
- [ ] Implémenter système de rooms
- [ ] Implémenter lobby (create/join/leave)
- [ ] Implémenter lancement de partie
- [ ] Implémenter synchronisation tentatives
- [ ] Implémenter logique mode Essais
- [ ] Implémenter logique mode Temps
- [ ] Implémenter calcul scores
- [ ] Implémenter fin de partie
- [ ] Gestion déconnexions
- [ ] Tests serveur isolé

### Phase 2 : Lobby Frontend
- [ ] Créer lobby.html structure
- [ ] Créer lobby.css design
- [ ] Créer lobby.js connexion WS
- [ ] Implémenter création salle
- [ ] Implémenter liste salles
- [ ] Implémenter rejoindre salle
- [ ] Afficher joueurs dans salle
- [ ] Bouton lancer partie (créateur)
- [ ] Redirection vers jeu
- [ ] Tests lobby

### Phase 3 : Jeu Multijoueur Frontend
- [ ] Créer multiplayer.html structure
- [ ] Créer multiplayer.css design
- [ ] Créer multiplayer.js base
- [ ] Connexion WS et récup état
- [ ] Affichage grille personnelle
- [ ] Clavier fonctionnel
- [ ] Validation mots (réutiliser solo)
- [ ] Affichage classement temps réel
- [ ] Gestion mode Essais
- [ ] Gestion mode Temps
- [ ] Timer synchronisé
- [ ] Notifications (toast/alerts)
- [ ] Modal fin de partie
- [ ] Podium et scores
- [ ] Bouton retour lobby
- [ ] Tests jeu multi

### Phase 4 : Intégration & Polish
- [ ] Ajouter lien dans index.html
- [ ] Ajouter carte mode multi dans menu
- [ ] Responsive design
- [ ] Animations et transitions
- [ ] Sons (optionnel)
- [ ] Gestion erreurs réseau
- [ ] Reconnexion auto
- [ ] Tests multi-appareils
- [ ] Tests de charge (8 joueurs)
- [ ] README avec instructions

### Phase 5 : Documentation
- [ ] Commenter code serveur
- [ ] Commenter code client
- [ ] Guide installation
- [ ] Guide utilisation
- [ ] Troubleshooting

---

## 🎯 Objectif final

Un mode multijoueur compétitif fluide et engageant où :
- ✅ Les joueurs s'affrontent sur le même mot en temps réel
- ✅ Deux modes de jeu distincts avec règles claires
- ✅ Interface intuitive et responsive
- ✅ Système de scores équitable
- ✅ Expérience stable même avec 8 joueurs
- ✅ Fun et rejouabilité élevée

---

**Document créé le :** 8 décembre 2025  
**Version :** 1.0  
**Dernière mise à jour :** 8 décembre 2025
