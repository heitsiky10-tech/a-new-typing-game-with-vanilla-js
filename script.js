
//   VARIABLES GLOBALES (la "mémoire" du jeu)


let startTime       = null;   // Heure de début de la partie
let currentWordIndex = 0;     // Numéro du mot actuel (0 = premier mot)
let correctCharacters = 0;    // Nombre de caractères correctement tapés
let typedCharacters  = 0;     // Nombre total de caractères tapés
let timerInterval   = null;   // Référence au minuteur (pour pouvoir l'arrêter)
let timerValue      = 60;     // Secondes restantes
let initialTimer    = 60;     // Durée initiale choisie
let streak          = 0;      // Série de mots corrects d'affilée
let bestStreak      = 0;      // Meilleure série de la partie
let gameStarted     = false;  // Est-ce que la partie a commencé ?
let wpmHistory      = [];     // Historique du WPM (pour le graphique)
let wpmChartInterval = null;  // Référence au timer du graphique
let audioCtx        = null;   // Contexte audio (pour les sons)

const wordsToType = [];       // Liste des mots à taper pendant la partie



//  RÉCUPÉRATION DES ÉLÉMENTS HTML (liaison JS <-> HTML)

// Menus de configuration
const modeSelect       = document.getElementById("mode");
const languageSelect   = document.getElementById("language-select");
const wordCountSelect  = document.getElementById("word-count");
const timerSelect      = document.getElementById("timer-select");

// Éléments du jeu
const wordDisplay      = document.getElementById("word-display");   // Zone des mots
const inputField       = document.getElementById("input-field");    // Champ de saisie
const results          = document.getElementById("results");        // Zone de résultats
const progressBar      = document.getElementById("progress-bar");   // Barre de progression

// Affichages en temps réel
const wpmDisplay       = document.getElementById("wpm");            // Vitesse (mots/min)
const accuracyDisplay  = document.getElementById("accuracy");       // Précision
const timerDisplay     = document.getElementById("timer");          // Chronomètre
const streakDisplay    = document.getElementById("streak");         // Série actuelle
const comboDisplay     = document.getElementById("combo-display");  // Message de combo

// Boutons
const restartBtn       = document.getElementById("restart-btn");
const startGameBtn     = document.getElementById("start-game-btn");
const homeBtn          = document.getElementById("home-btn");
const leaderboardBtn   = document.getElementById("leaderboard-btn");
const closeModalBtn    = document.getElementById("close-modal-btn");

// Écrans (home = accueil, game = jeu)
const homeScreen       = document.getElementById("home-screen");
const gameScreen       = document.getElementById("game-screen");

// Classement (leaderboard)
const leaderboardModal = document.getElementById("leaderboard-modal");
const leaderboardList  = document.getElementById("leaderboard-list");
const bestWpmDisplay   = document.getElementById("best-wpm-display");
const totalPlayersDisp = document.getElementById("total-players-display");
const playerNameInput  = document.getElementById("player-name");

// Graphique WPM
const canvas           = document.getElementById("wpm-chart");
const ctx2d            = canvas ? canvas.getContext("2d") : null;



//  BANQUES DE MOTS (les mots disponibles par langue/niveau)


const englishWords = {
  easy:   ["apple","grape","chair","table","smile","light","green","bread","water","house","cloud","flame","stone","river","horse","above","dream","night","plant","world"],
  medium: ["tiger","dream","plane","storm","clock","brain","music","flame","sword","world","black","space","power","ghost","steel","sharp","magic","brave","crisp","swift"],
  hard:   ["crypt","jazzy","frost","quark","pixel","shock","blitz","nymph","flash","globe","sphinx","glyph","tryst","vinyl","waltz","proxy","bytes","jumpy","squad","fixed"]
};

const frenchWords = {
  easy:   ["avion","table","fleur","pomme","sucre","route","train","livre","plage","danse","arbre","soleil","nuage","chien","maison","ecole","riviere","jardin","enfant","ville"],
  medium: ["tigre","stylo","image","radio","chaud","plume","brume","piano","rires","valse","vague","calme","forte","noire","glace","belle","froid","douce","haute","verte"],
  hard:   ["fjord","glace","quark","crash","flash","pixel","zebre","bruit","chocs","vieux","sphinx","gruyere","bronze","crypte","proxy","fuyez","boxeur","waltz","lycee","jazzy"]
};


//   AUDIO — Sons du jeu


// Crée le contexte audio au premier besoin (règle browser autoplay)
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

// Joue un son selon le type : "correct", "wrong" ou "finish"
function playSound(type) {
  try {
    initAudio();

    const osc  = audioCtx.createOscillator(); // Génère la fréquence
    const gain = audioCtx.createGain();       // Contrôle le volume
    osc.connect(gain);
    gain.connect(audioCtx.destination);       // Branche sur les haut-parleurs

    if (type === "correct") {
      // Son montant = succès
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);

    } else if (type === "wrong") {
      // Son descendant = erreur
      osc.frequency.setValueAtTime(200, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);

    } else if (type === "finish") {
      // Petite mélodie de fin (4 notes jouées en cascade)
      [440, 550, 660, 880].forEach((freq, i) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.connect(g);
        g.connect(audioCtx.destination);
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.1, audioCtx.currentTime + i * 0.08);
        g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.08 + 0.2);
        o.start(audioCtx.currentTime + i * 0.08);
        o.stop(audioCtx.currentTime + i * 0.08 + 0.2);
      });
    }

  } catch(e) {
    // Si le son échoue (navigateur bloqué etc.), on ignore silencieusement
  }
}



//   CLASSEMENT — Sauvegarde dans le navigateur (localStorage)


// Lit le classement sauvegardé (renvoie un tableau vide si rien)
function getLeaderboard() {
  try {
    return JSON.parse(localStorage.getItem("neontype_lb") || "[]");
  } catch(e) {
    return [];
  }
}

// Ajoute un score, trie, et garde uniquement le top 10
function saveScore(name, wpm, accuracy) {
  const lb = getLeaderboard();

  lb.push({
    name: name || "Anonymous",
    wpm,
    accuracy,
    date: new Date().toLocaleDateString()
  });

  lb.sort((a, b) => b.wpm - a.wpm); // Tri décroissant par WPM
  const top10 = lb.slice(0, 10);    // Garde seulement les 10 meilleurs
  localStorage.setItem("neontype_lb", JSON.stringify(top10));
  return top10;
}

// Affiche le classement dans la modale
function renderLeaderboard() {
  const lb     = getLeaderboard();
  const medals = ["🥇", "🥈", "🥉"];
  const rankClass = ["gold", "silver", "bronze"];

  if (lb.length === 0) {
    leaderboardList.innerHTML = '<p class="empty-lb">No scores yet. Be the first!</p>';
    return;
  }

  leaderboardList.innerHTML = lb.map((entry, i) => `
    <div class="lb-entry">
      <span class="lb-rank ${rankClass[i] || ''}">${medals[i] || (i + 1)}</span>
      <span class="lb-name">${entry.name}</span>
      <span class="lb-wpm">${entry.wpm} WPM</span>
      <span class="lb-acc">${entry.accuracy}</span>
    </div>
  `).join("");
}

// Met à jour le meilleur WPM et le nombre de joueurs sur l'écran d'accueil
function updateHomeStats() {
  const lb = getLeaderboard();
  if (bestWpmDisplay)   bestWpmDisplay.textContent  = lb.length > 0 ? lb[0].wpm : 0;
  if (totalPlayersDisp) totalPlayersDisp.textContent = lb.length;
}



//  AFFICHAGE DES MOTS — Construction lettre par lettre


// Choisit un mot aléatoire selon la langue et le mode de difficulté
function getRandomWord(mode) {
  const language = languageSelect.value;
  const source   = language === "french" ? frenchWords : englishWords;
  const wordList = source[mode];
  return wordList[Math.floor(Math.random() * wordList.length)];
}

// Construit l'affichage HTML des mots (chaque lettre dans son propre <span>)
function buildWordDisplay() {
  wordDisplay.innerHTML = ""; // Vide l'affichage précédent

  wordsToType.forEach((word, index) => {
    const wordSpan = document.createElement("span");
    wordSpan.classList.add("word");
    wordSpan.dataset.index = index;

    // Le premier mot est mis en surbrillance
    if (index === 0) wordSpan.classList.add("current-word");

    // Chaque lettre du mot devient un <span> avec la classe "pending"
    [...word].forEach(char => {
      const charSpan = document.createElement("span");
      charSpan.classList.add("char", "pending");
      charSpan.textContent = char;
      wordSpan.appendChild(charSpan);
    });

    wordDisplay.appendChild(wordSpan);
  });
}



//  7. DÉMARRAGE / RÉINITIALISATION DU JEU


function startTest() {
  // --- Remise à zéro de toutes les variables ---
  wordsToType.length = 0;
  currentWordIndex   = 0;
  correctCharacters  = 0;
  typedCharacters    = 0;
  streak             = 0;
  bestStreak         = 0;
  gameStarted        = false;
  wpmHistory         = [];
  startTime          = null;

  // Arrêt des timers précédents
  clearInterval(timerInterval);
  clearInterval(wpmChartInterval);

  // Lecture des paramètres choisis par le joueur
  timerValue   = parseInt(timerSelect.value);
  initialTimer = timerValue;
  timerDisplay.textContent = timerValue + "s";
  timerDisplay.className   = "";

  // Génération des mots aléatoires
  const wordCount = parseInt(wordCountSelect.value);
  for (let i = 0; i < wordCount; i++) {
    wordsToType.push(getRandomWord(modeSelect.value));
  }

  // Mise à jour de l'interface
  buildWordDisplay();
  progressBar.style.width      = "0%";
  wpmDisplay.textContent       = "0";
  accuracyDisplay.textContent  = "100%";
  streakDisplay.textContent    = "0";
  comboDisplay.textContent     = "";
  results.innerHTML            = "";

  if (ctx2d) clearCanvas();

  // Activation du champ de saisie
  inputField.disabled = false;
  inputField.value    = "";
  inputField.className = "";
  inputField.focus();
}


//   MINUTEUR — Démarre quand le joueur tape la première lettre


function startTimer() {
  if (gameStarted) return; // Déjà démarré, on ne repart pas
  gameStarted = true;
  startTime   = Date.now();

  // Décompte toutes les secondes
  timerInterval = setInterval(() => {
    timerValue--;
    timerDisplay.textContent = timerValue + "s";

    // Couleurs d'alerte selon le temps restant
    if (timerValue <= 10)      timerDisplay.className = "timer-danger";
    else if (timerValue <= 20) timerDisplay.className = "timer-warn";

    if (timerValue <= 0) finishGame(); // Temps écoulé !
  }, 1000);

  // Enregistre le WPM toutes les secondes pour le graphique
  wpmChartInterval = setInterval(() => {
    const elapsedMinutes = (Date.now() - startTime) / 1000 / 60;
    if (elapsedMinutes > 0) {
      const wpm = Math.round((correctCharacters / 5) / elapsedMinutes);
      wpmHistory.push(isNaN(wpm) ? 0 : wpm);
      drawChart();
    }
  }, 1000);
}


//   STATISTIQUES EN TEMPS RÉEL (WPM + précision)

function updateStats() {
  if (!startTime) return; // Pas encore commencé

  const elapsedMinutes = (Date.now() - startTime) / 1000 / 60;
  if (elapsedMinutes <= 0) return;

  // WPM = (caractères corrects / 5) / minutes écoulées
  // On divise par 5 car un "mot standard" = 5 caractères
  const wpm = Math.round((correctCharacters / 5) / elapsedMinutes);

  // Précision = (bons caractères / total tapé) × 100
  const accuracy = typedCharacters > 0
    ? Math.round((correctCharacters / typedCharacters) * 100)
    : 100;

  wpmDisplay.textContent      = isNaN(wpm) || !isFinite(wpm) ? 0 : wpm;
  accuracyDisplay.textContent = accuracy + "%";
}

// Met à jour la barre de progression
function updateProgress() {
  const percent = (currentWordIndex / wordsToType.length) * 100;
  progressBar.style.width = percent + "%";
}

// Met à jour l'affichage de la série et déclenche le message de combo
function updateStreakDisplay() {
  streakDisplay.textContent = streak;

  // Tous les 5 mots corrects d'affilée → message de combo
  if (streak > 0 && streak % 5 === 0) {
    comboDisplay.textContent = `🔥 ${streak} COMBO!`;
    comboDisplay.style.animation = "none";
    requestAnimationFrame(() => {
      comboDisplay.style.animation = "comboPulse 0.5s ease";
    });
    setTimeout(() => { comboDisplay.textContent = ""; }, 1500);
  }
}



//   COLORISATION EN DIRECT (lettre par lettre pendant la frappe)


inputField.addEventListener("input", () => {
  const typed      = inputField.value;
  const currentWordEl = wordDisplay.querySelector(".word.current-word");
  if (!currentWordEl) return;

  const chars       = currentWordEl.querySelectorAll(".char");
  const currentWord = wordsToType[currentWordIndex];

  // Pour chaque lettre, on compare ce qui a été tapé
  chars.forEach((charEl, i) => {
    charEl.classList.remove("correct", "wrong", "pending");

    if (i < typed.length) {
      // Lettre tapée → verte si correcte, rouge si fausse
      charEl.classList.add(typed[i] === currentWord[i] ? "correct" : "wrong");
    } else {
      // Lettre pas encore tapée → grise (pending)
      charEl.classList.add("pending");
    }
  });

  // Couleur du bord du champ de saisie selon la frappe en cours
  if (typed.length === 0) {
    inputField.className = "";
  } else if (currentWord.startsWith(typed)) {
    inputField.classList.remove("wrong-input");
    inputField.classList.add("correct-input");
  } else {
    inputField.classList.remove("correct-input");
    inputField.classList.add("wrong-input");
  }
});



//  VALIDATION DU MOT (quand on appuie sur Espace ou Échap)


function checkWord(event) {

  // --- Espace = valider le mot ---
  if (event.key === " ") {
    event.preventDefault(); // Empêche l'ajout d'un espace dans le champ

    const typedWord   = inputField.value.trim();
    if (typedWord.length === 0) return; // Rien tapé → on ignore

    const currentWord  = wordsToType[currentWordIndex];
    const wordElements = wordDisplay.querySelectorAll(".word");

    typedCharacters += typedWord.length; // Compte les caractères tapés

    if (typedWord === currentWord) {
      //  MOT CORRECT
      correctCharacters += currentWord.length;
      streak++;
      if (streak > bestStreak) bestStreak = streak;

      wordElements[currentWordIndex].classList.remove("current-word");
      wordElements[currentWordIndex].classList.add("correct-word");

      // Toutes les lettres passent au vert
      wordElements[currentWordIndex].querySelectorAll(".char").forEach(c => {
        c.className = "char correct";
      });

      playSound("correct");

    } else {
      //  MOT INCORRECT
      streak = 0;

      // Animation de secousse sur le champ
      inputField.classList.add("shake");
      setTimeout(() => inputField.classList.remove("shake"), 300);

      wordElements[currentWordIndex].classList.remove("current-word");
      wordElements[currentWordIndex].classList.add("wrong-word");

      // Toutes les lettres passent au rouge
      wordElements[currentWordIndex].querySelectorAll(".char").forEach(c => {
        c.className = "char wrong";
      });

      playSound("wrong");
    }

    // Passage au mot suivant
    currentWordIndex++;
    updateStreakDisplay();

    if (currentWordIndex < wordElements.length) {
      wordElements[currentWordIndex].classList.add("current-word");
      // Scroll pour garder le mot visible
      wordElements[currentWordIndex].scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    updateStats();
    updateProgress();

    // Vide le champ pour le mot suivant
    inputField.value    = "";
    inputField.className = "";

    // Tous les mots ont été tapés → fin de partie
    if (currentWordIndex >= wordsToType.length) finishGame();
  }

  // --- Échap = recommencer instantanément ---
  if (event.key === "Escape") startTest();
}



//   FIN DE PARTIE — Résultats + sauvegarde du score


function finishGame() {
  clearInterval(timerInterval);
  clearInterval(wpmChartInterval);
  inputField.disabled = true; // Désactive la saisie

  const finalWpm      = parseInt(wpmDisplay.textContent) || 0;
  const finalAccuracy = accuracyDisplay.textContent;
  const playerName    = playerNameInput ? playerNameInput.value.trim() : "";

  // Vérifie si c'est un nouveau record personnel
  const lb        = getLeaderboard();
  const prevBest  = lb.length > 0 ? lb[0].wpm : 0;
  const isNewBest = finalWpm > prevBest;

  saveScore(playerName, finalWpm, finalAccuracy);
  updateHomeStats();
  playSound("finish");

  // Affichage du résumé de la partie
  results.innerHTML = `
    <div class="finished">
      ${isNewBest && finalWpm > 0 ? '<div class="pb-badge">🏆 NEW PERSONAL BEST!</div>' : ""}
      <h2>GAME FINISHED 🚀</h2>
      <div class="result-grid">
        <div class="result-item">
          <div class="r-label">WPM</div>
          <div class="r-value">${finalWpm}</div>
        </div>
        <div class="result-item">
          <div class="r-label">ACCURACY</div>
          <div class="r-value">${finalAccuracy}</div>
        </div>
        <div class="result-item">
          <div class="r-label">BEST STREAK</div>
          <div class="r-value">${bestStreak}🔥</div>
        </div>
      </div>
      <button class="play-again-btn" onclick="startTest()">▶ PLAY AGAIN</button>
    </div>
  `;
}


//  GRAPHIQUE WPM — Dessin sur le <canvas>


// Efface le canvas
function clearCanvas() {
  if (!ctx2d) return;
  canvas.width = canvas.offsetWidth;
  ctx2d.clearRect(0, 0, canvas.width, canvas.height);
}

// Dessine la courbe WPM avec un dégradé de couleurs
function drawChart() {
  if (!ctx2d || wpmHistory.length < 2) return;

  canvas.width    = canvas.offsetWidth;
  const w         = canvas.width;
  const h         = canvas.height || 100;
  ctx2d.clearRect(0, 0, w, h);

  const max  = Math.max(...wpmHistory, 10); // Valeur max pour l'échelle
  const step = w / (wpmHistory.length - 1); // Espacement horizontal entre points

  // Lignes de grille horizontales (fond)
  ctx2d.strokeStyle = "rgba(255,255,255,0.05)";
  ctx2d.lineWidth   = 1;
  for (let i = 0; i <= 4; i++) {
    const y = (h / 4) * i;
    ctx2d.beginPath();
    ctx2d.moveTo(0, y);
    ctx2d.lineTo(w, y);
    ctx2d.stroke();
  }

  // Dégradé de couleur pour la ligne (bleu → violet)
  const grad = ctx2d.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, "rgba(56,189,248,0.6)");
  grad.addColorStop(1, "rgba(217,70,239,0.6)");

  // Tracé de la courbe
  ctx2d.beginPath();
  wpmHistory.forEach((val, i) => {
    const x = i * step;
    const y = h - (val / max) * (h - 10); // Inverse Y car le canvas part du haut
    if (i === 0) ctx2d.moveTo(x, y);
    else         ctx2d.lineTo(x, y);
  });
  ctx2d.strokeStyle = grad;
  ctx2d.lineWidth   = 2.5;
  ctx2d.lineJoin    = "round";
  ctx2d.stroke();

  // Zone colorée sous la courbe (effet remplissage)
  ctx2d.lineTo(w, h);
  ctx2d.lineTo(0, h);
  ctx2d.closePath();
  const fillGrad = ctx2d.createLinearGradient(0, 0, 0, h);
  fillGrad.addColorStop(0, "rgba(56,189,248,0.15)");
  fillGrad.addColorStop(1, "rgba(56,189,248,0)");
  ctx2d.fillStyle = fillGrad;
  ctx2d.fill();
}


//  Boutons et interactions


// Bouton "Jouer" sur l'écran d'accueil → lance le jeu
startGameBtn.addEventListener("click", () => {
  homeScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  startTest();
});

// Bouton "Recommencer" dans le jeu
restartBtn.addEventListener("click", () => startTest());

// Bouton "Accueil" → retour à l'écran d'accueil
homeBtn.addEventListener("click", () => {
  clearInterval(timerInterval);
  clearInterval(wpmChartInterval);
  gameScreen.classList.add("hidden");
  homeScreen.classList.remove("hidden");
  updateHomeStats();
});

// Champ de saisie → démarre le timer + valide les mots
inputField.addEventListener("keydown", (event) => {
  startTimer(); // Démarre le chrono dès la première frappe
  checkWord(event);
});

// Bouton classement → ouvre la modale
leaderboardBtn.addEventListener("click", () => {
  renderLeaderboard();
  leaderboardModal.classList.remove("hidden");
});

// Bouton fermer la modale
closeModalBtn.addEventListener("click", () => {
  leaderboardModal.classList.add("hidden");
});

// Clic en dehors de la modale → la ferme aussi
leaderboardModal.addEventListener("click", (e) => {
  if (e.target === leaderboardModal) {
    leaderboardModal.classList.add("hidden");
  }
});



//   INITIALISATION — Chargement de la page


updateHomeStats(); // Affiche les stats du classement dès l'accueil