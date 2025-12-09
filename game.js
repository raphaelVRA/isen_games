// TUSMO Game Logic - Version améliorée

class TusmoGame {
    constructor() {
        this.maxAttempts = 6;
        this.currentAttempt = 0;
        this.currentPosition = 1;
        this.targetWord = '';
        this.wordLength = 0;
        this.gameOver = false;
        this.gameWon = false;
        this.isProcessing = false; // Pour bloquer pendant la vérification
        this.dictionaryLoaded = false;
        this.dictionarySet = new Set();
        this.validatedWords = new Set(); // Cache des mots validés par API
        this.invalidWords = new Set(); // Cache des mots invalides
        this.foundLetters = []; // Lettres trouvées à la bonne position
        this.recentWords = this.loadRecentWords(); // Les 20 derniers mots joués
        
        // Stats
        this.stats = this.loadStats();
        
        this.init();
    }

    async init() {
        this.updateStatsDisplay();
        this.showLoadingState(true);
        
        // Charger le dictionnaire
        await this.loadDictionary();
        
        this.showLoadingState(false);
        this.startNewGame();
        this.setupEventListeners();
    }

    showLoadingState(loading) {
        const messageEl = document.getElementById('message');
        if (loading) {
            messageEl.textContent = '⏳ Chargement du dictionnaire...';
            messageEl.style.color = '#f4a300';
        } else {
            messageEl.textContent = '';
            messageEl.style.color = '';
        }
    }

    async loadDictionary() {
        try {
            // Utiliser plusieurs sources CORS-friendly
            const sources = [
                {
                    url: 'https://raw.githubusercontent.com/words/an-array-of-french-words/master/index.json',
                    type: 'json'
                }
            ];

            for (const source of sources) {
                try {
                    const response = await fetch(source.url, { mode: 'cors' });
                    if (!response.ok) continue;

                    let words;
                    if (source.type === 'json') {
                        words = await response.json();
                    } else {
                        const text = await response.text();
                        words = text.split('\n');
                    }

                    const filteredWords = words
                        .map(word => this.normalizeWord(word))
                        .filter(word => word && word.length >= 5 && word.length <= 10);

                    if (filteredWords.length > 100) {
                        FRENCH_WORDS.length = 0;
                        FRENCH_WORDS.push(...filteredWords);
                        this.dictionarySet = new Set(filteredWords);
                        
                        console.log(`✅ Dictionnaire chargé: ${FRENCH_WORDS.length} mots`);
                        this.dictionaryLoaded = true;
                        return;
                    }
                } catch (e) {
                    console.warn(`Échec: ${source.url}`, e.message);
                }
            }

            // Fallback
            this.loadFallbackDictionary();
            
        } catch (error) {
            console.error('Erreur dictionnaire:', error);
            this.loadFallbackDictionary();
        }
    }

    loadFallbackDictionary() {
        // Dictionnaire de base étendu avec des mots très courants
        const fallbackWords = [
            // Mots de 5 lettres
            "ABORD", "ACIER", "ADIEU", "AGILE", "AIDER", "AIMER", "ALBUM", "ANCRE", "ANGLE", "ANNEE",
            "APPEL", "ARBRE", "ARENE", "ARMER", "ASILE", "ATOME", "AUTRE", "AVANT", "AVION", "AVRIL",
            "BARIL", "BARON", "BASSE", "BATON", "BAZAR", "BERET", "BETON", "BICHE", "BIDON", "BILAN",
            "BILLE", "BOIRE", "BOITE", "BOMBE", "BONNE", "BONTE", "BORDE", "BOSSE", "BOTTE", "BOUEE",
            "BOULE", "BOURG", "BRAVE", "BRISE", "BRUME", "BULLE", "CABLE", "CACAO", "CACHE", "CADRE",
            "CALME", "CANAL", "CANIF", "CANNE", "CAPOT", "CARRE", "CARTE", "CAUSE", "CHAIR", "CHAMP",
            "CHANT", "CHAOS", "CHAUD", "CLASSE", "CLOWN", "COEUR", "COMME", "COMTE", "CONTE", "COPIE",
            "CORDE", "CORPS", "COTON", "COUDE", "COUPE", "COURS", "COURT", "CRABE", "CRANE", "CREME",
            "CRISE", "CROIX", "CRUEL", "CYCLE", "DANSE", "DEBUT", "DELTA", "DENSE", "DENTS", "DEPOT",
            "DEPUIS", "DOIGT", "DRAME", "DROIT", "DUREE", "ECART", "ECHEC", "ECOLE", "EFFET", "ELEVE",
            "EMAIL", "ENCRE", "ENFIN", "ENGIN", "ENJEU", "ENVIE", "EPAIS", "EPOUX", "ESSAI", "ETAGE",
            "ETANG", "ETAPE", "ETUDE", "EXACT", "EXCES", "FEMME", "FERME", "FETER", "FIBRE", "FICHE",
            "FIERE", "FILLE", "FILMS", "FINAL", "FLEUR", "FLORE", "FOIRE", "FOLIE", "FONCE", "FORCE",
            "FORET", "FORME", "FORTE", "FORUM", "FOSSE", "FOULE", "FRAIS", "FRANC", "FRERE", "FRONT",
            "FRUIT", "FUMEE", "FUSEE", "GARER", "GEANT", "GILET", "GLACE", "GLOBE", "GOMME", "GONFLE",
            "GORGE", "GOSSE", "GOUTE", "GRACE", "GRAIN", "GRAND", "GRAVE", "GREFFE", "GRILL", "GRIPPE",
            "GRISE", "GROTTE", "GROUPE", "GUIDE", "HACHE", "HAINE", "HAMAC", "HAPPE", "HARAS", "HARDI",
            "HARPE", "HAUTE", "HERBE", "HERON", "HEURE", "HIBOU", "HOMME", "HUILE", "HYGIENE", "ICONE",
            "IDEAL", "IDIOT", "IMAGE", "IMPUR", "INDEX", "INFINI", "INJUSTE", "INTRO", "IRISE", "ISSUE",
            "IVOIRE", "JALON", "JAMBE", "JAPPE", "JARDE", "JAUGE", "JAUNE", "JETON", "JEUDI", "JEUNE",
            "JOKER", "JOLIE", "JONGLE", "JOUER", "JOUET", "JOUIR", "JOURS", "JOYAU", "JUGER", "JUIVE",
            "JUMEAU", "JUPON", "JURER", "JUSTE", "KAYAK", "KEFIR", "KIMONO", "KIOSQUE", "KOALA", "LABEL",
            "LACET", "LAINE", "LAITE", "LAMER", "LAMPE", "LANCE", "LANDE", "LANGE", "LAPIN", "LAQUE",
            "LARGE", "LARME", "LASER", "LASSO", "LATIN", "LATTE", "LAURE", "LAVER", "LECON", "LEGAL",
            "LEGER", "LEMON", "LENTE", "LEONE", "LEPRE", "LESTE", "LETTRE", "LEVRE", "LIAGE", "LIANE",
            "LIBRE", "LICORNE", "LIEGE", "LIENS", "LIERRE", "LIEUE", "LIGNE", "LIGUE", "LILAS", "LIMACE",
            "LIME", "LINGE", "LIONS", "LIPPE", "LISSE", "LISTE", "LITRE", "LIVRE", "LOCAL", "LOCHE",
            "LODEN", "LOGER", "LOGIS", "LOISIR", "LONG", "LOQUE", "LORGNON", "LOSANGE", "LOTER", "LOTUS",
            "LOUER", "LOUP", "LOURD", "LOYAL", "LOYER", "LUBIE", "LUCIDE", "LUEUR", "LUGER", "LUIRE",
            "LUNDI", "LUPIN", "LURON", "LUSTRE", "LUTER", "LUTIN", "LUTTE", "LUXE", "LYCEE", "LYMPHE",
            // Mots de 6 lettres
            "MAISON", "JARDIN", "SOLEIL", "ENFANT", "VOYAGE", "NATURE", "ESPOIR", "BEAUTE", "JUSTICE",
            "TRAVAIL", "PROJET", "NUMERO", "SIMPLE", "DOUBLE", "TRIPLE", "NIVEAU", "MORALE", "RAISON",
            "SAISON", "NATION", "REGION", "ACTION", "OPTION", "VISION", "FUSION", "MOTION", "POTION",
            "ARGENT", "TALENT", "PARENT", "CLIENT", "MOMENT", "ACCENT", "URGENT", "ORANGE", "CHANGE",
            "CHATEAU", "BATEAU", "GATEAU", "PLATEAU", "MANTEAU", "RIDEAU", "CADEAU", "RESEAU",
            "ANIMAL", "CHEVAL", "GLOBAL", "MENTAL", "BRUTALE", "FRONTAL", "POSTAL", "NORMALE",
            "FAMILLE", "FEUILLE", "ABEILLE", "BOUTEILLE", "BATAILLE", "MURAILLE", "TAILLE", "PAILLE",
            "MUSIQUE", "ANIQUE", "UNIQUE", "PRATIQUE", "PLASTIQUE", "CRITIQUE", "MYSTIQUE",
            "LUMIERE", "RIVIERE", "MATIERE", "MANIERE", "PRIERE", "CARRIERE", "BARRIERE",
            "ETOILE", "PAROLE", "SYMBOLE", "CONSOLE", "CONTROLE", "PETROLE", "AUREOLE",
            "MACHINE", "RACINE", "CUISINE", "PISCINE", "MARINE", "FAMINE", "ROUTINE",
            "THEATRE", "CHAPITRE", "FILTRE", "CONTRE", "CENTRE", "FENETRE", "MAITRE",
            "POUVOIR", "SAVOIR", "DEVOIR", "ESPOIR", "MIROIR", "COULOIR", "TROTTOIR",
            "AVENIR", "PLAISIR", "LOISIR", "DESIR", "SOUVENIR", "DEVENIR", "SOUTENIR",
            // Mots de 7 lettres
            "ABANDON", "ABONNER", "ABOUTIR", "ABREGER", "ABSENCE", "ABSORBE", "ABSTENU", "ACCABLE",
            "ACCEDER", "ACCEPTE", "ACCLAME", "ACCOMPLI", "ACCORDE", "ACCUEIL", "ACHARNE", "ACHETER",
            "ACTIVER", "ADAPTER", "ADOPTER", "ADRESSE", "AFFAIRE", "AFFICHE", "AFFIRME", "AFFOLER",
            "AGENCER", "AJOUTER", "ALARMER", "ALERTER", "ALIGNER", "ALLEGER", "ALLONGE", "ALLUMER",
            "AMATEUR", "AMENAGE", "AMENDER", "AMORCER", "AMPLEUR", "ANCETRE", "ANGOISSE", "ANIMER",
            "ANNEXER", "ANNULER", "APLATIR", "APPELER", "APPRECIER", "APPORTER", "APPROCHE",
            "CHOCOLAT", "FROMAGE", "BAGUETTE", "CROISSANT", "CHAMPAGNE", "PROVENCE", "BRETAGNE",
            "NORMANDIE", "BOURGOGNE", "AUVERGNE", "FOOTBALL", "CYCLISME", "NATATION", "MARATHON",
            "CHAMPION", "VICTOIRE", "MEDAILLE", "TROPHEE", "CLASSEMENT", "EQUIPEMENT", "STRATEGIE",
            "POLITIQUE", "ECONOMIE", "REPUBLIQUE", "PARLEMENT", "MINISTRE", "PRESIDENT", "ELECTION",
            "CANDIDAT", "CAMPAGNE", "PROGRAMME", "DISCOURS", "HISTOIRE", "PHYSIQUE", "CHIMIE",
            "BIOLOGIE", "FRANCAIS", "ANGLAIS", "ESPAGNOL", "ALLEMAND", "ITALIEN", "PORTUGAIS",
            "PRINTEMPS", "AUTOMNE", "ATMOSPHERE", "POLLUTION", "RECYCLAGE", "ECOLOGIE", "CHANGEMENT",
            // Mots de 8+ lettres
            "LOGICIEL", "MATERIEL", "INTERNET", "NUMERIQUE", "TECHNOLOGIE", "INNOVATION",
            "ENTREPRISE", "COMMERCE", "INDUSTRIE", "PRODUCTION", "MARKETING", "PUBLICITE",
            "RESTAURANT", "UNIVERSITE", "PROFESSEUR", "ETUDIANT", "ORDINATEUR", "TELEPHONE",
            "TELEVISION", "APPARTEMENT", "IMMEUBLE", "QUARTIER", "BOULEVARD", "CARREFOUR",
            "AUTOROUTE", "AEROPORT", "PHARMACIE", "BOULANGERIE", "PATISSERIE", "SUPERMARCHE",
            "BIBLIOTHEQUE", "AGRICULTURE", "COMMUNICATION", "INVESTISSEMENT", "DEVELOPPEMENT"
        ];

        FRENCH_WORDS.length = 0;
        FRENCH_WORDS.push(...fallbackWords.map(w => this.normalizeWord(w)));
        this.dictionarySet = new Set(FRENCH_WORDS);
        
        console.log(`⚠️ Dictionnaire de secours: ${FRENCH_WORDS.length} mots`);
        this.dictionaryLoaded = true;
    }

    normalizeWord(word) {
        if (!word || typeof word !== 'string') return '';
        return word
            .trim()
            .toUpperCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^A-Z]/g, "");
    }

    // Vérification de mot avec API Wiktionary comme backup
    async isValidWordAsync(word) {
        const normalized = this.normalizeWord(word);
        
        // Vérifier le cache d'abord
        if (this.validatedWords.has(normalized)) return true;
        if (this.invalidWords.has(normalized)) return false;
        
        // Vérifier dans le dictionnaire local
        if (this.dictionarySet.has(normalized)) {
            this.validatedWords.add(normalized);
            return true;
        }
        
        // Si pas dans le dictionnaire local, vérifier via l'API Wiktionary
        try {
            const response = await fetch(
                `https://fr.wiktionary.org/w/api.php?action=query&titles=${encodeURIComponent(word.toLowerCase())}&format=json&origin=*`,
                { method: 'GET' }
            );
            
            if (response.ok) {
                const data = await response.json();
                const pages = data.query.pages;
                const pageId = Object.keys(pages)[0];
                
                // Si pageId n'est pas -1, le mot existe
                if (pageId !== '-1') {
                    this.validatedWords.add(normalized);
                    this.dictionarySet.add(normalized); // Ajouter au dictionnaire local
                    console.log(`✅ Mot validé via Wiktionary: ${word}`);
                    return true;
                }
            }
        } catch (e) {
            console.warn('Erreur API Wiktionary:', e.message);
            // En cas d'erreur réseau, on accepte le mot pour ne pas bloquer le jeu
            return true;
        }
        
        // Mot non trouvé
        this.invalidWords.add(normalized);
        return false;
    }

    isValidWord(word) {
        const normalized = this.normalizeWord(word);
        // Vérification synchrone rapide
        if (this.validatedWords.has(normalized)) return true;
        if (this.dictionarySet.has(normalized)) return true;
        return false;
    }

    loadStats() {
        try {
            const saved = localStorage.getItem('tusmo-stats-v2');
            if (saved) {
                const stats = JSON.parse(saved);
                return {
                    currentStreak: stats.currentStreak || 0,
                    bestStreak: stats.bestStreak || 0,
                    currentScore: stats.currentScore || 0,
                    bestScore: stats.bestScore || 0,
                    totalWins: stats.totalWins || 0,
                    totalGames: stats.totalGames || 0
                };
            }
        } catch (e) {
            console.error('Erreur chargement stats:', e);
        }
        return {
            currentStreak: 0,
            bestStreak: 0,
            currentScore: 0,
            bestScore: 0,
            totalWins: 0,
            totalGames: 0
        };
    }

    loadRecentWords() {
        try {
            const saved = localStorage.getItem('tusmo-recent-words');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error('Erreur chargement mots récents:', e);
        }
        return [];
    }

    saveRecentWords() {
        try {
            localStorage.setItem('tusmo-recent-words', JSON.stringify(this.recentWords));
        } catch (e) {
            console.error('Erreur sauvegarde mots récents:', e);
        }
    }

    addToRecentWords(word) {
        // Ajouter le mot au début du tableau
        this.recentWords.unshift(word);
        
        // Garder seulement les 20 derniers
        if (this.recentWords.length > 20) {
            this.recentWords = this.recentWords.slice(0, 20);
        }
        
        this.saveRecentWords();
        console.log(`📝 Mot ajouté aux récents (${this.recentWords.length}/20):`, word);
    }

    resetStreak() {
        // Réinitialiser la série et le score (comme une défaite)
        const lostStreak = this.stats.currentStreak;
        const lostScore = this.stats.currentScore;
        
        if (lostStreak > 0) {
            console.log(`🔄 Série abandonnée : ${lostStreak} mot(s), ${lostScore} pts`);
        }
        
        this.stats.currentStreak = 0;
        this.stats.currentScore = 0;
        this.stats.totalGames++;
        
        this.saveStats();
        this.updateStatsDisplay();
    }

    calculateScore(attemptNumber) {
        // Barème dégressif sur 100 points
        // 1er essai: 100pts, 2e: 80pts, 3e: 60pts, 4e: 40pts, 5e: 20pts, 6e: 10pts
        const scoreTable = {
            0: 100,  // 1er essai
            1: 80,   // 2e essai
            2: 60,   // 3e essai
            3: 40,   // 4e essai
            4: 20,   // 5e essai
            5: 10    // 6e essai
        };
        return scoreTable[attemptNumber] || 10;
    }

    saveStats() {
        try {
            localStorage.setItem('tusmo-stats-v2', JSON.stringify(this.stats));
        } catch (e) {
            console.error('Erreur sauvegarde stats:', e);
        }
    }

    updateStatsDisplay() {
        document.getElementById('current-streak').textContent = this.stats.currentStreak;
        document.getElementById('best-streak').textContent = this.stats.bestStreak;
        document.getElementById('current-score').textContent = this.stats.currentScore;
        document.getElementById('best-score').textContent = this.stats.bestScore;
        document.getElementById('total-wins').textContent = this.stats.totalWins;
        document.getElementById('total-games').textContent = this.stats.totalGames;
    }

    startNewGame() {
        // Choisir un mot aléatoire
        this.targetWord = this.getRandomWord();
        this.wordLength = this.targetWord.length;
        this.currentAttempt = 0;
        this.currentPosition = 1;
        this.gameOver = false;
        this.gameWon = false;
        
        // Réinitialiser les lettres trouvées (null = pas encore trouvée)
        this.foundLetters = new Array(this.wordLength).fill(null);
        this.foundLetters[0] = this.targetWord[0]; // La première lettre est toujours connue

        // Mettre à jour l'interface
        document.getElementById('word-length').innerHTML = 
            `Le mot contient <strong>${this.wordLength}</strong> lettres`;
        
        this.createGrid();
        this.resetKeyboard();
        this.hideMessage();
        this.hideModal();

        console.log('🎯 Mot à trouver:', this.targetWord);
    }

    getRandomWord() {
        if (FRENCH_WORDS.length === 0) {
            console.error('Aucun mot disponible!');
            return 'ERREUR';
        }
        
        // Filtrer les mots de 5 à 9 lettres pour une meilleure jouabilité
        let validWords = FRENCH_WORDS.filter(word => word.length >= 5 && word.length <= 9);
        
        // Exclure les 20 derniers mots joués
        const recentWordsSet = new Set(this.recentWords);
        validWords = validWords.filter(word => !recentWordsSet.has(word));
        
        // Si pas assez de mots disponibles (très rare), autoriser les mots récents
        if (validWords.length < 10) {
            console.log('⚠️ Peu de mots disponibles, autorisation des mots récents');
            validWords = FRENCH_WORDS.filter(word => word.length >= 5 && word.length <= 9);
        }
        
        if (validWords.length === 0) {
            return FRENCH_WORDS[Math.floor(Math.random() * FRENCH_WORDS.length)];
        }
        
        const selectedWord = validWords[Math.floor(Math.random() * validWords.length)];
        this.addToRecentWords(selectedWord);
        
        return selectedWord;
    }

    createGrid() {
        const grid = document.getElementById('game-grid');
        grid.innerHTML = '';
        
        // Définir la variable CSS pour le calcul de la taille des cases
        grid.style.setProperty('--word-length', this.wordLength);

        for (let row = 0; row < this.maxAttempts; row++) {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'grid-row';
            rowDiv.id = `row-${row}`;

            for (let col = 0; col < this.wordLength; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.id = `cell-${row}-${col}`;

                // Première lettre toujours affichée sur la première ligne
                if (col === 0 && row === 0) {
                    cell.textContent = this.targetWord[0];
                    cell.classList.add('first-letter');
                }

                // Indicateur de position courante
                if (row === 0 && col === 1) {
                    cell.classList.add('current');
                }

                rowDiv.appendChild(cell);
            }

            grid.appendChild(rowDiv);
        }
    }

    resetKeyboard() {
        document.querySelectorAll('.key').forEach(key => {
            delete key.dataset.status;
        });
    }

    setupEventListeners() {
        // Clavier virtuel
        document.getElementById('keyboard').addEventListener('click', (e) => {
            const key = e.target.closest('.key');
            if (key && key.dataset.key) {
                this.handleKeyPress(key.dataset.key);
            }
        });

        // Clavier physique
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.altKey || e.metaKey) return;
            
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleKeyPress('ENTER');
            } else if (e.key === 'Backspace') {
                e.preventDefault();
                this.handleKeyPress('BACKSPACE');
            } else if (/^[a-zA-Z]$/.test(e.key)) {
                this.handleKeyPress(e.key.toUpperCase());
            }
        });

        // Boutons nouveau jeu
        document.getElementById('new-game-btn').addEventListener('click', () => {
            this.resetStreak();
            this.startNewGame();
        });

        document.getElementById('modal-btn').addEventListener('click', () => {
            this.startNewGame();
        });

        // Fermer modal en cliquant à l'extérieur
        document.getElementById('modal').addEventListener('click', (e) => {
            if (e.target.id === 'modal') {
                this.hideModal();
            }
        });
    }

    handleKeyPress(key) {
        if (this.gameOver || this.isProcessing) return;

        if (key === 'ENTER') {
            this.isProcessing = true;
            this.submitGuess().finally(() => {
                this.isProcessing = false;
            });
        } else if (key === 'BACKSPACE') {
            this.deleteLetter();
        } else if (/^[A-Z]$/.test(key)) {
            this.addLetter(key);
        }
    }

    addLetter(letter) {
        if (this.currentPosition >= this.wordLength) return;

        const cell = document.getElementById(`cell-${this.currentAttempt}-${this.currentPosition}`);
        if (!cell) return;

        cell.textContent = letter;
        cell.classList.add('filled');
        cell.classList.remove('current');
        cell.classList.remove('hint-letter');

        this.currentPosition++;

        // Passer à la prochaine position (on peut écrire partout sauf sur la première lettre)
        if (this.currentPosition < this.wordLength) {
            const nextCell = document.getElementById(`cell-${this.currentAttempt}-${this.currentPosition}`);
            if (nextCell) {
                nextCell.classList.add('current');
                nextCell.classList.remove('hint-letter');
            }
        }
    }

    deleteLetter() {
        if (this.currentPosition <= 1) return; // Ne pas supprimer la première lettre

        // Retirer l'indicateur courant
        if (this.currentPosition < this.wordLength) {
            const currentCell = document.getElementById(`cell-${this.currentAttempt}-${this.currentPosition}`);
            if (currentCell) {
                currentCell.classList.remove('current');
                // Remettre l'indice si il y en avait un
                if (this.foundLetters[this.currentPosition]) {
                    currentCell.textContent = this.foundLetters[this.currentPosition];
                    currentCell.classList.add('hint-letter');
                }
            }
        }

        this.currentPosition--;

        const cell = document.getElementById(`cell-${this.currentAttempt}-${this.currentPosition}`);
        if (cell) {
            // Remettre l'indice ou vider la case
            if (this.foundLetters[this.currentPosition]) {
                cell.textContent = this.foundLetters[this.currentPosition];
                cell.classList.add('hint-letter');
            } else {
                cell.textContent = '';
            }
            cell.classList.remove('filled');
            cell.classList.add('current');
        }
    }

    async submitGuess() {
        // Vérifier que le mot est complet
        if (this.currentPosition < this.wordLength) {
            this.showMessage('❌ Mot incomplet !');
            this.shakeRow();
            return;
        }

        // Construire le mot proposé
        let guess = '';
        for (let i = 0; i < this.wordLength; i++) {
            const cell = document.getElementById(`cell-${this.currentAttempt}-${i}`);
            guess += cell ? cell.textContent : '';
        }

        // Afficher un indicateur de chargement
        this.showMessage('🔍 Vérification...');

        // Vérifier que le mot existe (avec API comme backup)
        const isValid = await this.isValidWordAsync(guess);
        
        if (!isValid) {
            this.showMessage('❌ Ce mot n\'existe pas !');
            this.shakeRow();
            return;
        }

        this.hideMessage();
        
        // Évaluer la proposition
        this.evaluateGuess(guess);
    }

    evaluateGuess(guess) {
        const result = this.checkWord(guess);
        
        // Appliquer les couleurs avec animation
        for (let i = 0; i < this.wordLength; i++) {
            setTimeout(() => {
                const cell = document.getElementById(`cell-${this.currentAttempt}-${i}`);
                if (!cell) return;

                cell.classList.remove('current', 'filled', 'hint-letter');
                
                if (result[i] === 'correct') {
                    cell.classList.add('correct');
                    this.updateKeyboard(guess[i], 'correct');
                    // Mémoriser la lettre trouvée
                    this.foundLetters[i] = guess[i];
                } else if (result[i] === 'misplaced') {
                    cell.classList.add('misplaced');
                    this.updateKeyboard(guess[i], 'misplaced');
                } else {
                    cell.classList.add('wrong');
                    this.updateKeyboard(guess[i], 'wrong');
                }
            }, i * 100);
        }

        // Vérifier victoire ou défaite après les animations
        setTimeout(() => {
            if (guess === this.targetWord) {
                this.handleWin();
            } else {
                this.currentAttempt++;
                if (this.currentAttempt >= this.maxAttempts) {
                    this.handleLoss();
                } else {
                    this.prepareNextRow();
                }
            }
        }, this.wordLength * 100 + 300);
    }

    prepareNextRow() {
        this.currentPosition = 1;
        
        // Afficher toutes les lettres déjà trouvées en transparence (indices)
        for (let i = 0; i < this.wordLength; i++) {
            const cell = document.getElementById(`cell-${this.currentAttempt}-${i}`);
            if (cell && this.foundLetters[i]) {
                cell.textContent = this.foundLetters[i];
                if (i === 0) {
                    cell.classList.add('first-letter');
                } else {
                    cell.classList.add('hint-letter');
                }
            }
        }
        
        // Le curseur commence toujours à la position 1 (deuxième case)
        const currentCell = document.getElementById(`cell-${this.currentAttempt}-1`);
        if (currentCell) {
            currentCell.classList.add('current');
            // Si il y a un indice, on le garde visible mais on enlève le style hint
            // pour montrer qu'on peut écrire dessus
        }
    }

    checkWord(guess) {
        const result = new Array(this.wordLength).fill('wrong');
        const targetLetters = this.targetWord.split('');
        const guessLetters = guess.split('');
        const used = new Array(this.wordLength).fill(false);

        // Premier passage : lettres correctes (bonne position)
        for (let i = 0; i < this.wordLength; i++) {
            if (guessLetters[i] === targetLetters[i]) {
                result[i] = 'correct';
                used[i] = true;
            }
        }

        // Deuxième passage : lettres mal placées
        for (let i = 0; i < this.wordLength; i++) {
            if (result[i] === 'correct') continue;

            for (let j = 0; j < this.wordLength; j++) {
                if (!used[j] && guessLetters[i] === targetLetters[j]) {
                    result[i] = 'misplaced';
                    used[j] = true;
                    break;
                }
            }
        }

        return result;
    }

    updateKeyboard(letter, status) {
        const key = document.querySelector(`.key[data-key="${letter}"]`);
        if (!key) return;

        // Hiérarchie: wrong < misplaced < correct
        const currentStatus = key.dataset.status;
        
        if (status === 'correct') {
            key.dataset.status = 'correct';
        } else if (status === 'misplaced' && currentStatus !== 'correct') {
            key.dataset.status = 'misplaced';
        } else if (status === 'wrong' && currentStatus !== 'correct' && currentStatus !== 'misplaced') {
            key.dataset.status = 'wrong';
        }
    }

    handleWin() {
        this.gameOver = true;
        this.gameWon = true;

        // Calculer le score pour ce mot
        const wordScore = this.calculateScore(this.currentAttempt);
        
        // Mettre à jour les stats
        this.stats.currentStreak++;
        this.stats.currentScore += wordScore;
        this.stats.totalWins++;
        this.stats.totalGames++;
        
        // Vérifier si c'est un nouveau record de série
        const isNewStreakRecord = this.stats.currentStreak > this.stats.bestStreak;
        if (isNewStreakRecord) {
            this.stats.bestStreak = this.stats.currentStreak;
        }
        
        // Vérifier si c'est un nouveau record de score
        const isNewScoreRecord = this.stats.currentScore > this.stats.bestScore;
        if (isNewScoreRecord) {
            this.stats.bestScore = this.stats.currentScore;
        }
        
        this.saveStats();
        this.updateStatsDisplay();

        // Animation de victoire
        const row = document.getElementById(`row-${this.currentAttempt}`);
        if (row) row.classList.add('victory');

        // Afficher le modal
        setTimeout(() => {
            const attempts = this.currentAttempt + 1;
            let message = `Vous avez trouvé le mot en ${attempts} essai${attempts > 1 ? 's' : ''} !`;
            message += `\n\n💎 +${wordScore} points`;
            
            if (isNewStreakRecord && this.stats.bestStreak > 1) {
                message += `\n\n🏆 Nouveau record de série : ${this.stats.bestStreak} mots !`;
            }
            if (isNewScoreRecord) {
                message += `\n\n🌟 Nouveau meilleur score : ${this.stats.bestScore} pts !`;
            }
            if (this.stats.currentStreak > 1 && !isNewStreakRecord) {
                message += `\n\n🔥 Série : ${this.stats.currentStreak} mots | Score : ${this.stats.currentScore} pts`;
            }
            
            this.showModal('Bravo ! 🎉', message, this.targetWord, isNewStreakRecord || isNewScoreRecord);
        }, 1500);
    }

    handleLoss() {
        this.gameOver = true;
        this.gameWon = false;

        // Réinitialiser la série
        const lostStreak = this.stats.currentStreak;
        const lostScore = this.stats.currentScore;
        this.stats.currentStreak = 0;
        this.stats.currentScore = 0;
        this.stats.totalGames++;
        
        this.saveStats();
        this.updateStatsDisplay();

        // Afficher le modal
        setTimeout(() => {
            let message = 'Vous n\'avez pas trouvé le mot.';
            if (lostStreak > 0) {
                message += `\n\nSérie perdue : ${lostStreak} mot${lostStreak > 1 ? 's' : ''} (${lostScore} pts)`;
            }
            message += `\n\nRecord : ${this.stats.bestStreak}`;
            
            this.showModal('Dommage ! 😔', message, this.targetWord, false);
        }, 500);
    }

    showModal(title, message, word, isRecord = false) {
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modal-title');
        const modalMessage = document.getElementById('modal-message');
        const wordContainer = document.getElementById('modal-word');

        modalTitle.textContent = title;
        if (isRecord) {
            modalTitle.classList.add('record');
        } else {
            modalTitle.classList.remove('record');
        }

        // Supporter les sauts de ligne dans le message
        modalMessage.innerHTML = message.replace(/\n/g, '<br>');

        // Afficher le mot
        wordContainer.innerHTML = '';
        for (const letter of word) {
            const span = document.createElement('span');
            span.className = 'letter';
            span.textContent = letter;
            wordContainer.appendChild(span);
        }

        modal.classList.add('show');
    }

    hideModal() {
        document.getElementById('modal').classList.remove('show');
    }

    showMessage(msg) {
        const messageEl = document.getElementById('message');
        messageEl.textContent = msg;
        
        // Auto-hide après 2 secondes
        clearTimeout(this.messageTimeout);
        this.messageTimeout = setTimeout(() => {
            messageEl.textContent = '';
        }, 2000);
    }

    hideMessage() {
        clearTimeout(this.messageTimeout);
        document.getElementById('message').textContent = '';
    }

    shakeRow() {
        const row = document.getElementById(`row-${this.currentAttempt}`);
        if (!row) return;
        
        row.querySelectorAll('.cell').forEach(cell => {
            cell.classList.add('shake');
            setTimeout(() => cell.classList.remove('shake'), 500);
        });
    }
}

// Initialiser le jeu au chargement
document.addEventListener('DOMContentLoaded', () => {
    window.game = new TusmoGame();
});
