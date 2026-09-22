// ==========================================
// 0. UNIFIED STORAGE LAYER (آمن ومعزول - LocalStorage مستمر)
// ==========================================
const GameStorage = {
  KEYS: {
    HISTORY: "alfiria_game_history",
    SESSION: "alfiria_active_session",
    PLAYERS: "alfiria_players_list",
    CURRENT_LEVEL: "alfiria_current_level_key",
    HIGHEST_UNLOCKED: "alfiria_highest_unlocked",
    STAGE_POINTERS: "alfiria_stage_pointers"
  },

  getHistory() {
    try {
      const data = localStorage.getItem(this.KEYS.HISTORY);
      if (!data) return typeof getInitialGameState === "function" ? getInitialGameState() : {};
      const parsed = JSON.parse(data);
      const base = typeof getInitialGameState === "function" ? getInitialGameState() : {};
      return {
        ...base,
        ...parsed,
        viewedCardIds: Array.isArray(parsed.viewedCardIds) ? parsed.viewedCardIds : []
      };
    } catch (e) {
      console.warn("Storage read error (History):", e);
      return typeof getInitialGameState === "function" ? getInitialGameState() : {};
    }
  },

  saveHistory(history) {
    try {
      localStorage.setItem(this.KEYS.HISTORY, JSON.stringify(history));
    } catch (e) {
      console.warn("Storage write error (History):", e);
    }
  },

  getActiveSession() {
    try {
      const data = localStorage.getItem(this.KEYS.SESSION);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.warn("Storage read error (Session):", e);
      return null;
    }
  },

  saveActiveSession(session) {
    try {
      localStorage.setItem(this.KEYS.SESSION, JSON.stringify(session));
    } catch (e) {
      console.warn("Storage write error (Session):", e);
    }
  },

  clearActiveSession() {
    localStorage.removeItem(this.KEYS.SESSION);
  },

  getPlayers() {
    try {
      const data = localStorage.getItem(this.KEYS.PLAYERS);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  savePlayers(players) {
    try {
      localStorage.setItem(this.KEYS.PLAYERS, JSON.stringify(players));
    } catch (e) {}
  },

  getCurrentLevelKey() {
    return localStorage.getItem(this.KEYS.CURRENT_LEVEL) || "dew";
  },

  saveCurrentLevelKey(key) {
    localStorage.setItem(this.KEYS.CURRENT_LEVEL, key);
  },

  getHighestUnlocked() {
    return parseInt(localStorage.getItem(this.KEYS.HIGHEST_UNLOCKED) || "0", 10);
  },

  saveHighestUnlocked(idx) {
    localStorage.setItem(this.KEYS.HIGHEST_UNLOCKED, idx.toString());
  },

  getStagePointers() {
    try {
      const data = localStorage.getItem(this.KEYS.STAGE_POINTERS);
      return data ? JSON.parse(data) : { dew: 0, sunny: 0, gentle: 0, sprouting: 0, bloom: 0 };
    } catch (e) {
      return { dew: 0, sunny: 0, gentle: 0, sprouting: 0, bloom: 0 };
    }
  },

  saveStagePointers(pointers) {
    try {
      localStorage.setItem(this.KEYS.STAGE_POINTERS, JSON.stringify(pointers));
    } catch (e) {}
  },

  clearAll() {
    localStorage.clear();
    sessionStorage.clear();
  }
};

// ==========================================
// 4. CORE CONTROLLER (MAP, CARDS & FLOW)
// ==========================================

// Global State
window.playersList = [];
let sessionData = null;
let currentLevelKey = GameStorage.getCurrentLevelKey();
let levelCurrentCard = 0;
let sessionPlayerQueue = [];
let isAnimatingCard = false;

const LEVEL_KEYS = ["dew", "sunny", "gentle", "sprouting", "bloom"];

let highestUnlockedIdx = GameStorage.getHighestUnlocked();
let stageCardPointers = GameStorage.getStagePointers();

// ==========================================
// [SECTION 1] تشغيل الخريطة والتهيئة الأولية
// ==========================================
function initBlossomIsland() {
  const savedPlayers = GameStorage.getPlayers();

  if (savedPlayers && Array.isArray(savedPlayers) && savedPlayers.length >= 3) {
    window.playersList = [...savedPlayers];
    initPlayerQueue();
  } else {
    setTimeout(() => {
      openPlayersModal(true);
    }, 300);
  }

  // فحص أمان: إذا وصل اللاعب للصخرة 5 وأنهى الجولة السابقة ثم خرج دون متابعة
  if (highestUnlockedIdx >= 5) {
    startNewReplayRound();
  }

  sessionData = GameStorage.getActiveSession();

  if (!sessionData) {
    const savedHistory = GameStorage.getHistory();
    sessionData = generateSessionCards(savedHistory);
    GameStorage.saveActiveSession(sessionData);
    
    const finalHistory = sessionData.updatedHistory || savedHistory;
    GameStorage.saveHistory(finalHistory);
  }

  updateProgressBar();
  updateNodeStatuses();

  const mapImg = document.getElementById("blossom-map-img");
  if (mapImg) {
    mapImg.classList.add("loaded");
  }
}

// ==========================================
// [SECTION 2] تحديث شريط التقدم والنسبة المئوية (مع رمز اللانهاية ∞)
// ==========================================
function updateProgressBar() {
  const history = GameStorage.getHistory();
  const total = history.viewedCardIds ? history.viewedCardIds.length : 0;
  const fill = document.getElementById("progress-bar-fill");
  const text = document.getElementById("progress-percent-text");

  if (!fill || !text) return;

  if (total >= 100) {
    text.innerText = "∞";
    text.style.fontSize = "1.2rem";
    text.style.lineHeight = "1";
    fill.style.width = "100%";
    return;
  }

  const pct = Math.min(100, Math.max(0, total));
  text.innerText = `${pct}%`;
  text.style.fontSize = "";
  fill.style.width = `${pct}%`;
}

// ==========================================
// [SECTION 3] إدارة مسار الصخور ومستويات الفتح
// ==========================================
function updateNodeStatuses() {
  for (let i = 1; i <= 5; i++) {
    const node = document.getElementById(`rock-step-${i}`);
    if (!node) continue;
    const stageIdx = i - 1;

    node.className = "rock-node";
    if (stageIdx < highestUnlockedIdx) {
      node.classList.add("completed");
    } else if (stageIdx === highestUnlockedIdx) {
      node.classList.add("active");
    } else {
      node.classList.add("locked");
    }
  }
}

function handleNodeClick(levelNum) {
  syncCurrentInputs();
  const validNames = (window.playersList || []).map(n => (n || "").trim()).filter(Boolean);

  if (validNames.length < 3) {
    openPlayersModal(true);
    return;
  }

  const targetIdx = levelNum - 1;

  if (targetIdx > highestUnlockedIdx) {
    const lockModal = document.getElementById("level-intro-modal");
    if (lockModal) lockModal.classList.add("active");
    return;
  }

  currentLevelKey = LEVEL_KEYS[targetIdx];
  GameStorage.saveCurrentLevelKey(currentLevelKey);
  startLevelCards();
}

function closeLevelIntroModal() {
  const lockModal = document.getElementById("level-intro-modal");
  if (lockModal) lockModal.classList.remove("active");
}

// ==========================================
// [SECTION 4] عرض الكروت والإنترو والتنقل
// ==========================================
const levelIntros = {  
  dew: { visualClass: "card-lvl-dew", description: "Let’s start easy, get comfortable, and discover the little things about each other" },  
  sunny: { visualClass: "card-lvl-sunny", description: "Now, let’s go beyond preferences and share a few stories along the way" },  
  gentle: { visualClass: "card-lvl-gentle", description: "A little deeper now — the things you value, feel, and carry with you" },  
  sprouting: { visualClass: "card-lvl-sprouting", description: "Let’s see how you think, what catches your curiosity, and where your perspectives meet" },  
  bloom: { visualClass: "card-lvl-bloom", description: "You’ve gotten to know a little. Now let’s see what surprises are still hiding underneath" }  
};

function startLevelCards() {
  levelCurrentCard = stageCardPointers[currentLevelKey] || 0;
  const cardModal = document.getElementById("card-modal");
  if (cardModal) cardModal.classList.add("active");
  renderCard(false);
}

function saveStageProgress(key, cardNum) {
  stageCardPointers[key] = cardNum;
  GameStorage.saveStagePointers(stageCardPointers);
}

function getCardRenderData(levelKey, cardNum) {
  const currentIntro = levelIntros[levelKey];

  if (cardNum === 0) {
    return {
      isIntro: true,
      stageId: levelKey,
      cardId: "intro",
      visualClass: currentIntro ? currentIntro.visualClass : `card-lvl-${levelKey}`,
      numberTag: "",
      headerBadge: { text: "INTRO", className: "card-mechanic-badge", color: "#422933" },
      contentHtml: `
        <div style="margin: auto 0; display: flex; align-items: center; justify-content: center; width: 100%; padding: 0 10px;">
          <div style="font-size: inherit; font-family: inherit; line-height: inherit; color: #422933; text-align: center;">
            ${currentIntro.description}
          </div>
        </div>
      `,
      isSpecial: false,
      cardRef: null
    };
  }

  const questionIndex = cardNum - 1;
  const card = sessionData && sessionData.levels && sessionData.levels[levelKey] 
    ? sessionData.levels[levelKey][questionIndex] 
    : null;

  const activeMech = card ? (card.specialMechanic || card.activeMechanic || (card.mechanic !== "NATURAL" ? card.mechanic : null)) : null;
  const isSpecial = !!activeMech;
  let contentHtml = "";

  if (isSpecial) {
    const mechType = activeMech.toUpperCase();

    if (mechType.includes("PREDICT")) {
      const currentPlayers = window.playersList || [];
      if (!card.mechanicState || !currentPlayers.includes(card.mechanicState.targetPlayer)) {
        card.mechanicState = {
          targetPlayer: getNextFairPlayer(),
          guesses: {},
          truth: "",
          isCompleted: false
        };
      }

      const target = card.mechanicState.targetPlayer;
      const introHeadlines = [
        `${target}, you’re in the hot seat 🔥`,
        `${target}, you’re the main character now ✨`,
        `${target}, your moment has arrived 😁`,
        `${target}, you’ve got the spotlight ✨`
      ];

      const outroPhrases = [
        "Things are about to get messy 🫢",
        "Oh, this could get interesting 👀",
        "Let’s stir the pot a little 😝",
        "This one might cause some trouble 😈",
        "Well… this should be fun 👀"
      ];

      if (!card.mechanicState.selectedIntro) {
        card.mechanicState.selectedIntro = introHeadlines[Math.floor(Math.random() * introHeadlines.length)];
      }
      if (!card.mechanicState.selectedOutro) {
        card.mechanicState.selectedOutro = outroPhrases[Math.floor(Math.random() * outroPhrases.length)];
      }

      contentHtml = `
        <div class="special-intro-title">${card.mechanicState.selectedIntro}</div>
        <div class="special-intro-sub">Everyone else gets to guess your answer. No peeking!</div>
        <div class="special-intro-tag">${card.mechanicState.selectedOutro}</div>
        <button class="stone-btn" style="margin-top: 10px;" onclick="launchSpecialMechanic(${questionIndex})">
          REVEAL THE QUESTION
        </button>
      `;
    } else if (mechType.includes("WHO SAID THAT") || mechType.includes("WHO SAID")) {
      const whoSaidOutros = [
        "Time to put those instincts to work 💅",
        "Trust your gut… maybe 😬",
        "Time to crack the case 🔎",
        "Your investigation starts now 🕵️"
      ];

      if (!card.mechanicState) {
        card.mechanicState = {
          answers: {},
          selectedOutro: whoSaidOutros[Math.floor(Math.random() * whoSaidOutros.length)],
          isCompleted: false
        };
      }

      contentHtml = `
        <div class="special-intro-title">Answer the question quietly</div>
        <div class="special-intro-sub">We’ll reveal a few answers, and you’ll have to match them to the right person</div>
        <div class="special-intro-tag">${card.mechanicState.selectedOutro}</div>
        <button class="stone-btn" style="margin-top: 10px;" onclick="launchSpecialMechanic(${questionIndex})">
          REVEAL THE QUESTION
        </button>
      `;
    } else if (mechType.includes("MOST LIKELY")) {
      const mostLikelyOutros = [
        "Let’s see where those fingers point 😜",
        "Well, someone’s getting nominated 😏",
        "This should reveal a few things 😚",
        "Choose carefully… or don’t 😏"
      ];

      if (!card.mechanicState) {
        card.mechanicState = {
          votes: {},
          selectedOutro: mostLikelyOutros[Math.floor(Math.random() * mostLikelyOutros.length)],
          isCompleted: false
        };
      }

      contentHtml = `
        <div class="special-intro-title">Time to point some fingers 👀</div>
        <div class="special-intro-sub">Read the question and choose the person who fits it best.<br>Everyone gets one vote!</div>
        <div class="special-intro-tag">${card.mechanicState.selectedOutro}</div>
        <button class="stone-btn" style="margin-top: 10px;" onclick="launchSpecialMechanic(${questionIndex})">
          REVEAL THE QUESTION
        </button>
      `;
    }
  } else {
    contentHtml = `<div style="margin: auto 0; padding: 10px;">${card ? card.text : ""}</div>`;
  }

  return {
    isIntro: false,
    stageId: levelKey,
    cardId: card ? card.id : "unknown",
    visualClass: currentIntro ? currentIntro.visualClass : `card-lvl-${levelKey}`,
    numberTag: String(cardNum).padStart(2, "0"),
    headerBadge: isSpecial 
      ? { text: "SPECIAL CARD", className: "special-card-badge", color: "" } 
      : null,
    contentHtml: contentHtml,
    isSpecial: isSpecial,
    cardRef: card
  };
}

function renderCard(animate = false, direction = "next") {
  const cardEl = document.getElementById("active-card");
  const questionEl = document.getElementById("card-question-text");
  const numTag = document.getElementById("card-number-tag");
  const prevBtn = document.getElementById("prev-arrow");
  const headerTag = document.getElementById("card-mechanic-tag");

  if (!cardEl || !questionEl) return;

  const data = getCardRenderData(currentLevelKey, levelCurrentCard);

  cardEl.className = `game-card ${data.visualClass}`;
  if (data.isSpecial) cardEl.classList.add("card-special-mechanic");

  cardEl.dataset.stageId = data.stageId;
  cardEl.dataset.cardId = data.cardId;

  if (prevBtn) {
    if (levelCurrentCard === 0) prevBtn.classList.add("disabled");
    else prevBtn.classList.remove("disabled");
  }

  if (numTag) numTag.innerText = data.numberTag;

  if (headerTag) {
    if (data.headerBadge) {
      headerTag.className = data.headerBadge.className;
      headerTag.innerText = data.headerBadge.text;
      headerTag.style.color = data.headerBadge.color;
      headerTag.style.display = "inline-block";
    } else {
      headerTag.style.display = "none";
    }
  }

    questionEl.innerHTML = data.contentHtml;

  if (data.cardRef) {
    recordCardProgress(data.cardRef.id);
  }

  // تشغيل الصوت حسب نوع البطاقة
  if (animate && typeof SoundManager !== "undefined") {
    if (data.isSpecial) {
      SoundManager.play('specialCard');
    }
  }

  if (animate) {
    let flipClass = (direction === "prev") ? "flipping-prev" : "flipping";
    if (data.isSpecial) flipClass = "flipping-spin";

    cardEl.classList.add(flipClass);
    setTimeout(() => {
      cardEl.classList.remove(flipClass);
      isAnimatingCard = false;
    }, data.isSpecial ? 800 : 400);

    if (data.isSpecial) {
      setTimeout(() => {
        const modal = document.getElementById("card-modal");
        if (modal && modal.classList.contains("active")) {
          triggerSparkles();
        }
      }, 250);
    }
  } else {
    isAnimatingCard = false;
  }
}

function launchSpecialMechanic(cardIndex) {
  const card = sessionData?.levels?.[currentLevelKey]?.[cardIndex];
  
  if (!card) {
    console.error("Card data not found for stage:", currentLevelKey, "index:", cardIndex);
    return;
  }

  if (typeof MechanicsManager !== "undefined" && typeof MechanicsManager.launch === "function") {
    closeCardModal();
    MechanicsManager.launch(card);
  } else {
    console.error("MechanicsManager is not defined or launch() is missing in mechanics.js");
  }
}

function nextCard() {
  
  if (isAnimatingCard) return;
  
  if (levelCurrentCard < 5) {
    isAnimatingCard = true;
    levelCurrentCard++;
    saveStageProgress(currentLevelKey, levelCurrentCard);
    renderCard(true, "next");
  } else {
    isAnimatingCard = true;
    const cardEl = document.getElementById("active-card");
    if (cardEl) {
      cardEl.style.transition = "opacity 0.35s ease, transform 0.35s ease";
      cardEl.style.opacity = "0";
      cardEl.style.transform = "scale(0.92)";
    }

    setTimeout(() => {
      saveStageProgress(currentLevelKey, 0);
      closeCardModal();
      markStageCompleted();

      if (cardEl) {
        cardEl.style.opacity = "";
        cardEl.style.transform = "";
        cardEl.style.transition = "";
      }
      isAnimatingCard = false;
    }, 350);
  }
}

function prevCard() {
  if (isAnimatingCard || levelCurrentCard <= 0) return;
  isAnimatingCard = true;
  levelCurrentCard--;
  saveStageProgress(currentLevelKey, levelCurrentCard);
  renderCard(true, "prev");
}

function closeCardModal() {
  const cardModal = document.getElementById("card-modal");
  if (cardModal) cardModal.classList.remove("active");
}

function recordCardProgress(cardId) {
  if (levelCurrentCard === 0 || !cardId) return;

  const history = GameStorage.getHistory();
  if (!history.viewedCardIds.includes(cardId)) {
    history.viewedCardIds.push(cardId);
    history.totalCardsViewed = history.viewedCardIds.length;
    GameStorage.saveHistory(history);
    updateProgressBar();
  }
}

function markStageCompleted() {
  const currentIdx = LEVEL_KEYS.indexOf(currentLevelKey);

  if (currentIdx === highestUnlockedIdx && highestUnlockedIdx < 4) {
    highestUnlockedIdx++;
    GameStorage.saveHighestUnlocked(highestUnlockedIdx);
    updateNodeStatuses();
  }

  if (currentLevelKey === "bloom") {
    highestUnlockedIdx = 5;
    GameStorage.saveHighestUnlocked(5);
    updateNodeStatuses();

    const history = GameStorage.getHistory();
    const total = history.viewedCardIds ? history.viewedCardIds.length : (history.totalCardsViewed || 0);

    const reachedInfinity = localStorage.getItem("alfiria_endless_infinity_reached") === "true";

    if (reachedInfinity) {
      setTimeout(() => {
        startNewReplayRound();
      }, 500);
    } else {
      setTimeout(() => {
        triggerBloomCompletion(total);
      }, 500);
    }
  }
} // <--- تم إضافة هذا القوس الذي كان مفقوداً وكسر الكود بالكامل

function triggerBloomCompletion(total) {
  const modal = document.getElementById("island-completion-modal");
  const textEl = document.getElementById("completion-text");
  const actionsContainer = document.getElementById("completion-actions-container");
  const titleEl = modal ? modal.querySelector(".scroll-title") : null;

  if (!modal || !textEl) return;

  let isFinalMilestone = total >= 100;

  if (isFinalMilestone) {
    localStorage.setItem("alfiria_endless_infinity_reached", "true");
  }

  let title = "";
  let body = "";

  if (isFinalMilestone) {
    title = "You’ve reached full bloom 🌸";
    body = "You’ve made it through every chapter of Blossom Island, but there’s always room for another conversation";
  } else if (total >= 75) {  
    title = "You’re getting closer 🌸";
    body = "You’ve come a long way together, and there’s only one more chapter before the journey reaches its final bloom";
  } else if (total >= 50) {  
    title = "HALFWAY THROUGH 🌸";
    body = "You’re getting more comfortable, sharing more, and discovering sides of each other you may not have seen before";
  } else {
    title = "You’re just getting started 🌸";
    body = "The conversation is beginning to open up and there’s still plenty more to discover about each other";
  }

  if (titleEl) {
    titleEl.innerText = title;
    titleEl.className = "scroll-title completion-main-title";
  }

  textEl.innerHTML = `
    <p class="completion-sub-desc">${body}</p>
  `;

  if (actionsContainer) {
    actionsContainer.innerHTML = `
      <button class="stone-btn" id="completion-continue-btn">
        ${isFinalMilestone ? "ENTER ENDLESS" : "CONTINUE"}
      </button>
      <button class="exit-btn" id="completion-exit-btn">
        EXIT
      </button>
    `;

       document.getElementById("completion-exit-btn").onclick = () => {
      startNewReplayRound();
      window.location.href = "index.html?from=game";
    };
  } // <--- هذا القوس كان مفقوداً وكسر الكود بالكامل
  // تأكد من وجود هذا السطر لتشغيل الصوت فوراً عند فتح رسالة النهاية
  if (typeof SoundManager !== "undefined") {
    SoundManager.play('celebration');
  }

  modal.classList.add("active");
  createConfetti();
}


function startNewReplayRound() {
  const modal = document.getElementById("island-completion-modal");
  if (modal) modal.classList.remove("active");

  highestUnlockedIdx = 0;
  currentLevelKey = "dew";
  stageCardPointers = { dew: 0, sunny: 0, gentle: 0, sprouting: 0, bloom: 0 };

  GameStorage.saveHighestUnlocked(0);
  GameStorage.saveCurrentLevelKey("dew");
  GameStorage.saveStagePointers(stageCardPointers);
  GameStorage.clearActiveSession();

  const history = GameStorage.getHistory();
  sessionData = generateSessionCards(history);
  GameStorage.saveActiveSession(sessionData);

  const finalHistory = sessionData.updatedHistory || history;
  GameStorage.saveHistory(finalHistory);

  updateNodeStatuses();
}

// ==========================================
// [SECTION 6] إدارة قائمة اللاعبين
// ==========================================
function initPlayerQueue() {
  sessionPlayerQueue = [...window.playersList];
  for (let i = sessionPlayerQueue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [sessionPlayerQueue[i], sessionPlayerQueue[j]] = [sessionPlayerQueue[j], sessionPlayerQueue[i]];
  }
}

function getNextFairPlayer() {
  if (!sessionPlayerQueue || sessionPlayerQueue.length === 0) {
    initPlayerQueue();
  }
  return sessionPlayerQueue.shift() || (window.playersList[0] || "Player");
}

function openPlayersModal(isMandatory = false) {
  const modal = document.getElementById("players-modal");
  if (!modal) return;
  modal.classList.add("active");

  const closeBtn = modal.querySelector(".modal-close-corner-btn");
  if (closeBtn) {
    closeBtn.style.display = isMandatory ? "none" : "block";
  }

  const err = document.getElementById("players-error-msg");
  if (err) err.innerText = "";

  const saved = GameStorage.getPlayers();
  if (saved && saved.length >= 3) {
    window.playersList = [...saved];
  } else if (!window.playersList || window.playersList.length < 3) {
    window.playersList = ["", "", ""];
  }

  renderPlayerInputs();
}

function closePlayersModal() {
  syncCurrentInputs();
  const validNames = (window.playersList || []).map(n => (n || "").trim()).filter(Boolean);

  if (validNames.length < 3) {
    const err = document.getElementById("players-error-msg");
    if (err) err.innerText = "Please fill in at least 3 names to begin.";
    return;
  }
  const modal = document.getElementById("players-modal");
  if (modal) modal.classList.remove("active");
}

function syncCurrentInputs() {
  const inputs = document.querySelectorAll(".player-input");
  inputs.forEach((input, i) => {
    if (i < window.playersList.length) {
      window.playersList[i] = input.value;
    }
  });
}

function renderPlayerInputs() {
  const container = document.getElementById("players-list-container");
  if (!container) return;

  container.innerHTML = "";
  window.playersList.forEach((name, idx) => {
    container.innerHTML += `
      <div class="player-row">
        <input 
          type="text" 
          class="player-input" 
          value="${name}" 
          placeholder="Player ${idx + 1}" 
          oninput="updatePlayerName(${idx}, this.value)">
      </div>
    `;
  });
}

function addPlayerField() {
  const err = document.getElementById("players-error-msg");
  syncCurrentInputs();

  if (window.playersList.length >= 6) {
    if (err) err.innerText = "Maximum limit reached";
    return;
  }

  if (err) err.innerText = "";
  window.playersList.push("");
  renderPlayerInputs();
}

function removePlayerField() {
  const err = document.getElementById("players-error-msg");
  syncCurrentInputs();

  if (window.playersList.length <= 3) {
    if (err) err.innerText = "Minimum 3 players required";
    return;
  }

  if (err) err.innerText = "";
  window.playersList.pop();
  renderPlayerInputs();
}

function updatePlayerName(idx, val) {
  window.playersList[idx] = val;
  const err = document.getElementById("players-error-msg");
  if (err) err.innerText = "";
}

function savePlayersAndContinue() {
  syncCurrentInputs();

  const rawNames = window.playersList.map(n => (n || "").trim());
  const validNames = rawNames.filter(Boolean);
  const err = document.getElementById("players-error-msg");

  if (validNames.length < 3) {
    if (err) err.innerText = "Please fill in at least 3 names.";
    return;
  }

  const uniqueNames = new Set(validNames);
  if (uniqueNames.size !== validNames.length) {
    if (err) err.innerText = "Each player must have a unique name ";
    return;
  }

  window.playersList = validNames;
  GameStorage.savePlayers(validNames);
  initPlayerQueue();
  
  const modal = document.getElementById("players-modal");
  if (modal) modal.classList.remove("active");
}

// ==========================================
// [SECTION 7] القائمة وخيارات التصفير والتنقل
// ==========================================
function toggleIslandMenu(e) {
  const evt = e || window.event;
  if (evt) {
    evt.stopPropagation();
    if (evt.stopImmediatePropagation) evt.stopImmediatePropagation();
  }
  const menu = document.getElementById("island-menu-dropdown");
  if (menu) {
    menu.classList.toggle("active");
  }
}

function closeIslandMenu() {
  const menu = document.getElementById("island-menu-dropdown");
  if (menu) menu.classList.remove("active");
}

function confirmResetIsland() {
  closeIslandMenu();
  const modal = document.getElementById("reset-confirm-modal");
  if (modal) modal.classList.add("active");
}

function closeResetConfirm() {
  const modal = document.getElementById("reset-confirm-modal");
  if (modal) modal.classList.remove("active");
}

function resetIslandProgress() {
  GameStorage.clearAll();
  window.playersList = [];
  window.location.reload();
}

function returnToWorldMap() {
  if (typeof saveStageProgress === "function") {
    saveStageProgress(currentLevelKey, levelCurrentCard);
  }
  closeCardModal();
  closeIslandMenu();
  window.location.href = "index.html?from=game";
}

// ==========================================
// [SECTION 8] المؤثرات البصرية والمشاركة
// ==========================================
function triggerSparkles() {  
  const symbols = ["✨", "🌸", "⭐", "💫"];
  const screenWidth = window.innerWidth;  
  const screenHeight = window.innerHeight;  

  for (let i = 0; i < 35; i++) {  
    const sparkle = document.createElement('div');  
    sparkle.className = 'magic-sparkle';  
    sparkle.innerText = symbols[Math.floor(Math.random() * symbols.length)];  
      
    const startX = Math.random() * screenWidth;  
    const startY = Math.random() * screenHeight;  
    sparkle.style.left = `${startX}px`;  
    sparkle.style.top = `${startY}px`;  

    const angle = Math.random() * Math.PI * 2;  
    const distance = 40 + Math.random() * 80;  
    const tx = Math.cos(angle) * distance;  
    const ty = Math.sin(angle) * distance;  

    sparkle.style.setProperty('--tx', `${tx}px`);  
    sparkle.style.setProperty('--ty', `${ty}px`);  
    sparkle.style.color = '#fff3c2';  

    document.body.appendChild(sparkle);  
    setTimeout(() => sparkle.remove(), 1200);  
  }  
}

function createConfetti() {
  const container = document.getElementById("confetti-container");
  if (!container) return;
  container.innerHTML = "";

  const colors = ["#ff758c", "#e2c08d", "#ffffff", "#f2a6b6", "#d88a9e"];
  for (let i = 0; i < 65; i++) {
    const c = document.createElement("div");
    c.className = "confetti";
    c.style.left = `${Math.random() * 100}%`;
    c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    c.style.animationDelay = `${Math.random() * 1.5}s`;
    container.appendChild(c);
    setTimeout(() => c.remove(), 3200);
  }
}

function showCopyToast(message = "Copied!") {
  let toast = document.getElementById("game-copy-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "game-copy-toast";
    document.body.appendChild(toast);
  }
  toast.innerText = message;
  toast.className = "toast-visible";

  if (window.toastTimer) clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => {
    toast.className = "";
  }, 1200);
}

function fallbackCopy() {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(window.location.href);
  }
  showCopyToast("Copied!");
}

async function shareCardImage() {
  if (!navigator.share || typeof html2canvas === "undefined") {
    fallbackCopy();
    return;
  }

  try {
    const canvas = await html2canvas(document.body, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      scrollX: 0,
      scrollY: 0,
      windowWidth: document.documentElement.offsetWidth,
      windowHeight: document.documentElement.offsetHeight,
      ignoreElements: (element) => {
        return element.classList && (
          element.classList.contains("card-header-btn") || 
          element.classList.contains("island-menu-container")
        );
      }
    });

    canvas.toBlob(async (blob) => {
      if (!blob) {
        fallbackCopy();
        return;
      }

      const file = new File([blob], "alfiria-moment.png", { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            text: window.location.href
          });
        } catch (err) {}
      } else {
        try {
          await navigator.share({
            url: window.location.href
          });
        } catch (err) {
          fallbackCopy();
        }
      }
    }, "image/png");

  } catch (error) {
    console.error("Screenshot error:", error);
    fallbackCopy();
  }
}


// ============================================================================
// مستمع النقر بالخارج العام (إغلاق المنيو والنوافذ المنبثقة عند النقر بالخارج)
// ============================================================================
document.addEventListener("click", (e) => {
  // إغلاق المنيو إذا نقر اللاعب خارجها
  const menu = document.getElementById("island-menu-dropdown");
  const menuBtn = document.getElementById("island-menu-btn");
  if (menu && menu.classList.contains("active")) {
    if (!menu.contains(e.target) && (!menuBtn || !menuBtn.contains(e.target))) {
      menu.classList.remove("active");
    }
  }

  // إغلاق نافذة المسار المقفل عند النقر على الخلفية
  if (e.target.id === "level-intro-modal") {
    closeLevelIntroModal();
  }

  // إغلاق نافذة تأكيد التصفير (Reset) عند النقر على الخلفية
  if (e.target.id === "reset-confirm-modal") {
    closeResetConfirm();
  }
});

// تشغيل اللعبة عند اكتمال تحميل الصفحة
window.addEventListener("DOMContentLoaded", initBlossomIsland);
