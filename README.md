# 🎮 TUSMO - Jeu de lettres Solo et Multijoueur

Jeu de type Wordle/Motus en français avec mode solo et mode multijoueur compétitif en réseau local.

---

## 📋 Table des matières

- [Fonctionnalités](#-fonctionnalités)
- [Installation](#-installation)
- [Démarrage rapide](#-démarrage-rapide)
- [Modes de jeu](#-modes-de-jeu)
- [Architecture technique](#-architecture-technique)
- [Développement](#-développement)

---

## ✨ Fonctionnalités

### Mode Solo
- ✅ Jeu infini avec dictionnaire français complet
- ✅ Validation des mots via API Wiktionary
- ✅ Système de streak (série sans erreur)
- ✅ Score dégressif : 100/80/60/40/20/10 points
- ✅ Statistiques sauvegardées (meilleur score, meilleure série)
- ✅ 20 derniers mots mémorisés pour éviter les répétitions
- ✅ Animations fluides (flip, shake, bounce)
- ✅ Design glassmorphisme moderne

### Mode Multijoueur
- 🎯 **2 modes compétitifs** :
  - **Moins d'essais** : Le joueur avec le moins de tentatives gagne (bonus +25pts pour le premier à finir)
  - **Moins de temps** : Le premier à trouver le mot gagne (scoring dégressif 100/75/50/25/10)
- 🚀 Parties en temps réel via WebSocket
- 👥 Système de salons avec codes à 4 lettres
- 🏆 Classement en direct
- ⏱️ Timer de 5 minutes en mode "Temps"
- 📊 Statistiques détaillées par joueur

---

## 🔧 Installation

### Prérequis
- **Node.js** (v14 ou supérieur) - [Télécharger](https://nodejs.org/)
- **Python** (v3.7 ou supérieur) - [Télécharger](https://www.python.org/)

### Installation des dépendances

```bash
# Cloner ou télécharger le projet
cd TUSMO

# Installer les dépendances Node.js
npm install
```

Les dépendances nécessaires :
- `ws` - Bibliothèque WebSocket pour Node.js

---

## 🚀 Démarrage rapide

### Méthode 1 : Script automatique (Windows)

**Option A - Fichier batch (.bat)**
```bash
start.bat
```

**Option B - PowerShell (.ps1)**
```powershell
.\start.ps1
```

### Méthode 2 : Démarrage manuel

**Terminal 1 - Serveur WebSocket**
```bash
node server.js
```

**Terminal 2 - Serveur HTTP**
```bash
python -m http.server 8080
```

### Accès au jeu

- **Local** : http://localhost:8080
- **Réseau local** : http://[VOTRE_IP]:8080

Pour trouver votre IP locale :
```bash
# Windows
ipconfig

# Linux/Mac
ifconfig
```

---

## 🎯 Modes de jeu

### 🎲 Mode Solo

1. Depuis le menu principal, cliquer sur **"Tusmo Solo"**
2. Deviner le mot en 6 essais maximum
3. La première lettre est donnée en indice
4. Couleurs :
   - 🔴 **Rouge** : Lettre bien placée
   - 🟡 **Jaune** : Lettre mal placée
   - ⚪ **Gris** : Lettre absente
5. Score dégressif selon le nombre d'essais

### 👥 Mode Multijoueur

#### Créer un salon

1. Cliquer sur **"Tusmo Multijoueur"**
2. Entrer un pseudo
3. Choisir un mode :
   - **⏱️ Moins d'essais** : Gagne celui qui trouve avec le moins de tentatives
   - **⚡ Moins de temps** : Gagne le premier à trouver
4. Cliquer sur **"Créer un salon"**
5. Partager le code à 4 lettres avec vos amis
6. Attendre que tous soient prêts
7. Démarrer la partie

#### Rejoindre un salon

1. Cliquer sur **"Tusmo Multijoueur"**
2. Entrer un pseudo
3. Entrer le code du salon (4 lettres)
4. Cliquer sur **"Je suis prêt"**
5. Attendre que l'hôte démarre

#### Scoring

**Mode "Moins d'essais"**
- Score de base : 100, 80, 60, 40, 20, 10 points (selon le nombre d'essais)
- Bonus : +25 points pour le premier à finir
- Gagnant : Celui avec le moins d'essais

**Mode "Moins de temps"**
- Score par ordre d'arrivée : 100, 75, 50, 25, 10 points
- Timer : 5 minutes maximum
- Gagnant : Le premier à trouver

---

## 🏗️ Architecture technique

### Structure du projet

```
TUSMO/
├── index.html              # Menu principal
├── menu.css               # Styles du menu
├── motus.html             # Jeu solo
├── styles.css             # Styles du jeu solo
├── game.js                # Logique du jeu solo
├── words.js               # Dictionnaire de mots
├── lobby.html             # Lobby multijoueur
├── lobby.css              # Styles du lobby
├── lobby.js               # Logique du lobby
├── multiplayer.html       # Jeu multijoueur
├── multiplayer.css        # Styles du jeu multijoueur
├── multiplayer.js         # Logique du jeu multijoueur
├── server.js              # Serveur WebSocket (Node.js)
├── package.json           # Dépendances npm
├── start.bat              # Script de démarrage Windows
├── start.ps1              # Script PowerShell
└── README.md              # Documentation
```

### Technologies utilisées

**Frontend**
- HTML5, CSS3 (Glassmorphisme, animations)
- JavaScript ES6+ (async/await, classes)
- WebSocket API (client)
- localStorage (sauvegarde)

**Backend**
- Node.js avec bibliothèque `ws`
- Python http.server (serveur de fichiers)
- WebSocket (communication temps réel)

**API externes**
- Wiktionary API (validation des mots)

### Protocole WebSocket

#### Messages client → serveur

```javascript
// Connexion
{ type: 'set-username', data: { username: string } }

// Gestion des salons
{ type: 'create-room', data: { mode: 'essais' | 'temps' } }
{ type: 'join-room', data: { code: string } }
{ type: 'leave-room' }

// État du joueur
{ type: 'toggle-ready' }

// Jeu
{ type: 'start-game' }
{ type: 'submit-guess', data: { guess: string } }
```

#### Messages serveur → client

```javascript
// Connexion
{ type: 'connected', data: { clientId: number } }
{ type: 'username-set', data: { username: string } }

// Salons
{ type: 'room-created', data: { code: string, mode: string } }
{ type: 'room-joined', data: { code: string, mode: string } }
{ type: 'room-status', data: { players: Player[], ... } }

// Jeu
{ type: 'game-start', data: { wordLength: number, firstLetter: string } }
{ type: 'guess-result', data: { guess: string, evaluation: string[] } }
{ type: 'player-progress', data: { playerId: number, attemptCount: number } }
{ type: 'timer-update', data: { remainingMs: number } }
{ type: 'game-end', data: { word: string, results: Player[] } }

// Erreurs
{ type: 'error', data: { message: string } }
```

### Structures de données

**Room (serveur)**
```javascript
{
    code: string,              // Code à 4 lettres
    mode: 'essais' | 'temps',
    hostId: number,
    players: Map<id, Player>,
    status: 'waiting' | 'playing' | 'finished',
    currentWord: string,
    wordLength: number,
    startTime: number,
    recentWords: string[]      // 20 derniers mots
}
```

**Player (serveur)**
```javascript
{
    id: number,
    username: string,
    ws: WebSocket,
    isReady: boolean,
    attempts: Array,
    finished: boolean,
    finishTime: number,
    score: number,
    attemptCount: number
}
```

---

## 🛠️ Développement

### Ajouter des mots au dictionnaire

Éditer `words.js` :
```javascript
const FRENCH_WORDS = [
    'MAISON',
    'JARDIN',
    // ... ajouter vos mots ici
];
```

### Modifier les scores

Dans `server.js`, fonction `calculateScoresEssais()` ou `calculateScoresTemps()` :
```javascript
const baseScores = [100, 80, 60, 40, 20, 10]; // Modifier ici
```

### Changer la durée du timer

Dans `server.js`, fonction `startRoomTimer()` :
```javascript
const GAME_DURATION = 5 * 60 * 1000; // 5 minutes en ms
```

### Tester en local

1. Ouvrir plusieurs onglets/navigateurs
2. Se connecter avec des pseudos différents
3. Créer/rejoindre le même salon
4. Tester les deux modes

### Déploiement réseau local

1. Trouver votre IP locale (ex: `10.30.41.245`)
2. Partager `http://[VOTRE_IP]:8080` avec vos amis
3. Vérifier que le port 8080 et 8081 sont ouverts dans le pare-feu

**Windows Firewall**
```bash
# Autoriser Node.js
netsh advfirewall firewall add rule name="Node.js WebSocket" dir=in action=allow protocol=TCP localport=8081

# Autoriser Python HTTP
netsh advfirewall firewall add rule name="Python HTTP Server" dir=in action=allow protocol=TCP localport=8080
```

---

## 📝 Notes importantes

### Limitations connues

- Le dictionnaire par défaut est limité. Utilisez l'API Wiktionary pour une validation complète.
- Les parties multijoueur ne sont pas persistantes (rechargement = déconnexion).
- Le serveur WebSocket ne gère pas le SSL (wss://).

### Améliorations futures possibles

- [ ] Système de comptes utilisateurs
- [ ] Historique des parties
- [ ] Mode tournoi
- [ ] Chat intégré
- [ ] Personnalisation des thèmes
- [ ] Support mobile amélioré
- [ ] Déploiement cloud (Heroku, Vercel, etc.)

---

## 📄 Licence

Ce projet est un projet éducatif de la **Slither Team**.

---

## 👥 Auteurs

**Slither Team** - Collection de jeux pour passer le temps

---

## 🐛 Rapporter un bug

Si vous rencontrez un problème :
1. Vérifiez que les deux serveurs sont bien démarrés
2. Consultez la console du navigateur (F12)
3. Vérifiez les logs du serveur Node.js

**Problèmes courants**

| Problème | Solution |
|----------|----------|
| "Impossible de se connecter au serveur" | Vérifier que `node server.js` est lancé |
| "Salon introuvable" | Le code est sensible à la casse (4 lettres majuscules) |
| "Tous les joueurs doivent être prêts" | Vérifier que chaque joueur a cliqué sur "Je suis prêt" |
| Pas d'animation | Vider le cache du navigateur (Ctrl+F5) |

---

🎉 **Bon jeu !** 🎉
