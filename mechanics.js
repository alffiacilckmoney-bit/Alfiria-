
 // ==========================================
// 3. MECHANICS PLUGIN CONTROLLER
// ==========================================

const MechanicsManager = {
  activeCard: null,
  currentStep: 0,
  revealIndex: 0,

  // ------------------------------------------
  // دوال التهيئة والمساعدة العامة
  // ------------------------------------------
  getPlayers() {
    return (Array.isArray(window.playersList) && window.playersList.length >= 3) 
      ? window.playersList 
      : ["Player 1", "Player 2", "Player 3"];
  },

  launch(cardObj) {
    if (!cardObj || !cardObj.activeMechanic) return;
    this.activeCard = cardObj;
    this.currentStep = 0;
    this.revealIndex = 0;

    const mech = cardObj.activeMechanic.toUpperCase();

    if (mech.includes("PREDICT")) {
      if (!this.activeCard.mechanicState) this.resetDraftState();
      this.openPredictFlow();
    } else if (mech.includes("WHO SAID")) {
      if (!this.activeCard.mechanicState) this.resetWhoSaidDraftState();
      this.openWhoSaidThatFlow();
    } else if (mech.includes("MOST LIKELY")) {
      if (!this.activeCard.mechanicState) this.resetMostLikelyDraftState();
      this.openMostLikelyToFlow();
    } else {
      alert(`${cardObj.activeMechanic} mechanic will be unlocked in the next update!`);
    }
  },

  resetDraftState() {
    if (!this.activeCard) return;
    this.activeCard.mechanicState = {
      targetPlayer: (typeof getNextFairPlayer === "function") ? getNextFairPlayer() : "Player",
      guesses: {},
      truth: "",
      revealedCount: 0,
      truthRevealed: false,
      isCompleted: false
    };
    this.currentStep = 0;
    this.revealIndex = 0;
  },

  resetWhoSaidDraftState() {
    if (!this.activeCard) return;
    this.activeCard.mechanicState = {
      answers: {},
      isCompleted: false
    };
    this.currentStep = 0;
    this.revealIndex = 0;
  },

  resetMostLikelyDraftState() {
    if (!this.activeCard) return;
    this.activeCard.mechanicState = {
      votes: {},
      selectedTarget: null,
      isCompleted: false
    };
    this.currentStep = 0;
    this.revealIndex = 0;
  },

  // ==========================================
  // [1] دوال وتدفق PREDICT
  // ==========================================
  openPredictFlow() {
    const modal = document.getElementById("predict-modal");
    if (!modal) return;
    modal.classList.add("active");
    this.renderCurrentPredictStep();
  },

  startInputPass() {
    this.currentStep = 1;
    this.revealIndex = 0;
    this.renderCurrentPredictStep();
  },

  renderCurrentPredictStep() {
    const container = document.getElementById("predict-content");
    if (!container || !this.activeCard) return;
    const state = this.activeCard.mechanicState;
    const allPlayers = this.getPlayers();
    
    if (!state.targetPlayer || !allPlayers.includes(state.targetPlayer)) {
      state.targetPlayer = allPlayers[0];
    }
    const guessers = allPlayers.filter(p => p !== state.targetPlayer);

    // الخطوة 0: السؤال
    if (this.currentStep === 0) {
      container.innerHTML = `
        <div class="card-header-row">
          <button class="card-header-btn" onclick="MechanicsManager.cancel()">✕</button>
          <div class="card-header-center">
            <span class="predict-badge">THE QUESTION</span>
          </div>
          <div style="width: 32px;"></div>
        </div>

        <div class="card-question">
          ${this.activeCard.text}
        </div>

        <div class="predict-nav-row">
          <span class="nav-arrow disabled">&lt;</span>
          <span class="nav-arrow" onclick="MechanicsManager.startInputPass()">&gt;</span>
        </div>
      `;
    }

    // الخطوة 1: إدخال التوقعات والحقيقة
    else if (this.currentStep === 1) {
      const inputPassIndex = this.revealIndex;
      const isTargetTurn = (inputPassIndex >= guessers.length);
      const currentPlayerName = isTargetTurn ? state.targetPlayer : guessers[inputPassIndex];
      const savedValue = isTargetTurn ? (state.truth || "") : (state.guesses[currentPlayerName] || "");
      const target = state.targetPlayer;

      const guessPrompts = [
        `Step into ${target}’s brain for a minute 🧠`,
        `Channel ${target} ,You’ve got this`,
        `Think like ${target} ,Try not to embarrass yourself😌`,
        `Become ${target} for a minute. Don’t disappoint us 😌`,
        `Think like them ,Try not to embarrass yourself😌`
      ];

      if (!Array.isArray(state.assignedPromptPlayers)) {
        const totalParty = allPlayers.length;
        let quota = 1;
        if (totalParty === 4 || totalParty === 5) {
          quota = 2;
        } else if (totalParty >= 6) {
          quota = 3;
        }

        const shuffledGuessers = [...guessers].sort(() => Math.random() - 0.5);
        state.assignedPromptPlayers = shuffledGuessers.slice(0, quota);
        state.passPhrases = {};

        const shuffledPrompts = [...guessPrompts].sort(() => Math.random() - 0.5);
        state.assignedPromptPlayers.forEach((player, idx) => {
          state.passPhrases[player] = shuffledPrompts[idx % shuffledPrompts.length];
        });
      }

      let bottomPrompt = "";
      if (!isTargetTurn && state.assignedPromptPlayers.includes(currentPlayerName)) {
        bottomPrompt = state.passPhrases[currentPlayerName] || "";
      }

      container.innerHTML = `
        <div class="card-header-row">
          <button class="card-header-btn" onclick="MechanicsManager.cancel()">✕</button>
          <div class="card-header-center">
            <span class="predict-badge">PASS THE PHONE</span>
          </div>
          <div style="width: 32px;"></div>
        </div>

        <div style="margin: auto 0; width: 100%; display: flex; flex-direction: column; align-items: center;">
          <div class="predict-title" style="margin-bottom: 2px;">Hand phone to ${currentPlayerName}</div>
          <div class="predict-subtitle" style="margin-bottom: 8px; font-size: 0.88rem;">
            ${isTargetTurn ? "Type your REAL truth secretly" : `Predict what ${state.targetPlayer} will say`}
          </div>
          
          <textarea id="predict-live-input" class="predict-input" placeholder="${isTargetTurn ? "Your real truth..." : "Your honest prediction..."}">${savedValue}</textarea>
          
          <div id="predict-empty-warn" style="font-size: 0.8rem; font-weight: 700; color: #c93b58; min-height: 18px; margin-top: 2px;"></div>
          
          <div style="font-size: 0.84rem; font-weight: 600; color: #825666; font-style: italic; margin-top: 4px; text-align: center; min-height: 20px;">
            ${bottomPrompt}
          </div>
        </div>

        <div class="predict-nav-row">
          <span class="nav-arrow" onclick="MechanicsManager.prevInputPass(${guessers.length})">&lt;</span>
          <span class="nav-arrow" onclick="MechanicsManager.nextInputPass(${guessers.length})">&gt;</span>
        </div>
      `;
    }

    // الخطوة 2: استعراض التوقعات
    else if (this.currentStep === 2) {
      if (typeof state.revealedCount === "undefined") {
        state.revealedCount = 0;
      }
      const allGuessesRevealed = state.revealedCount >= guessers.length;

      const visibleGuessesHtml = guessers.slice(0, state.revealedCount).map(guesser => {
        const guess = state.guesses[guesser] || "No prediction entered";
        return `
          <div class="prediction-bubble-light" style="width: 100%; margin-bottom: 8px; padding: 10px 14px; background: rgba(255,255,255,0.7); border-radius: 10px; text-align: left; box-sizing: border-box;">
            <p style="font-size: 0.9rem; font-style: italic; color: #2b1810; margin: 0 0 4px 0; line-height: 1.35; word-break: break-word;">
              “${guess}”
            </p>
            <div style="font-size: 0.78rem; font-weight: 700; color: #825666; text-align: left;">
              — ${guesser}
            </div>
          </div>
        `;
      }).join("");

      container.innerHTML = `
        <div class="card-header-row">
          <button class="card-header-btn" onclick="MechanicsManager.cancel()">✕</button>
          <div class="card-header-center">
            <span class="predict-badge">THE PREDICTION</span>
          </div>
          <div style="width: 32px;"></div>
        </div>

        <div id="reveal-tap-area" onclick="MechanicsManager.revealNextCard(${guessers.length})" 
             style="width: 100%; max-height: 62vh; min-height: 220px; overflow-y: auto; padding: 6px 8px; display: flex; flex-direction: column; align-items: center; box-sizing: border-box; cursor: pointer;">
          
          ${!allGuessesRevealed ? `
            <div style="font-size: 0.75rem; font-weight: 600; color: #a17887; letter-spacing: 0.5px; margin-bottom: 10px; text-transform: uppercase;">
              Tap anywhere to reveal
            </div>
          ` : `
            <div style="font-size: 0.75rem; font-weight: 600; color: #a17887; margin-bottom: 8px;">
              All predictions revealed
            </div>
          `}
          
          <div style="width: 100%;">
            ${visibleGuessesHtml}
          </div>
        </div>

        <div class="predict-nav-row" style="margin-top: 10px; width: 100%;">
          ${allGuessesRevealed ? `
            <button class="stone-btn" style="width: 100%;" onclick="MechanicsManager.goToTruthStep()">
              continue
            </button>
          ` : ""}
        </div>
      `;
    }

    // الخطوة 3: صفحة الحقيقة المستقلة
    else if (this.currentStep === 3) {
      const target = state.targetPlayer;

      const introPhrases = [
        "And now… the truth 🫢",
        "Enough guessin , Time for the truth 😏",
        `Okay… what did ${target} actually say? 👀`,
        "The moment of truth ✨"
      ];

      const outroPhrases = [
        "So… did anyone get it right, or are you basically strangers? 👀",
        "Did you nail it, or completely miss the plot? 😭",
        "So… psychic, or just confidently wrong? 😌",
        `Did anyone get ${target} right, or were we all delusional? 👀`,
        `And the verdict is in ,Did you know ${target} at all? 😏`
      ];

      if (!state.truthIntro) {
        state.truthIntro = introPhrases[Math.floor(Math.random() * introPhrases.length)];
      }
      if (!state.truthOutro) {
        state.truthOutro = outroPhrases[Math.floor(Math.random() * outroPhrases.length)];
      }

      container.innerHTML = `
        <style>
          @keyframes fadeInStep {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .truth-anim-1 { opacity: 0; animation: fadeInStep 0.6s ease forwards 0.8s; }
          .truth-anim-2 { opacity: 0; animation: fadeInStep 0.6s ease forwards 2.0s; }
          .truth-anim-3 { opacity: 0; animation: fadeInStep 0.6s ease forwards 3.4s; }
        </style>

        <div class="card-header-row">
          <button class="card-header-btn" onclick="MechanicsManager.cancel()">✕</button>
          <div class="card-header-center">
            <span class="predict-badge">${target}'s Answer</span>
          </div>
          <div style="width: 32px;"></div>
        </div>

        <div style="margin: auto 0; width: 100%; display: flex; flex-direction: column; align-items: center; text-align: center;">
          <div class="truth-anim-1" style="font-size: 0.95rem; font-weight: 700; color: #825666; margin-bottom: 12px;">
            ${state.truthIntro}
          </div>

          <div class="truth-anim-2 prediction-bubble-light" style="width: 100%; padding: 16px 14px; background: rgba(255,255,255,0.7); border: 1px solid rgba(130, 86, 102, 0.2); border-radius: 12px; box-sizing: border-box; text-align: center;">
            <p style="font-size: 1.05rem; font-weight: 700; font-family: 'Playfair Display', serif; font-style: italic; color: #2b1810; margin: 0; line-height: 1.4; word-break: break-word;">
              “${state.truth || "No truth submitted"}”
            </p>
          </div>

          <div class="truth-anim-3" style="font-size: 0.9rem; font-weight: 600; color: #6b4d57; font-style: italic; margin-top: 14px; line-height: 1.35;">
            ${state.truthOutro}
          </div>
        </div>

        <div class="predict-nav-row truth-anim-3" style="margin-top: 10px; width: 100%;">
          <button class="stone-btn" style="width: 100%;" onclick="MechanicsManager.finish()">
            DONE 
          </button>
        </div>
      `;
    }
  },

  revealNextCard(totalGuessers) {
    if (this._isRevealing) return;
    const state = this.activeCard.mechanicState;
    if (typeof state.revealedCount === "undefined") {
      state.revealedCount = 0;
    }
    
    if (state.revealedCount < totalGuessers) {
      this._isRevealing = true;
      state.revealedCount++;
      this.renderCurrentPredictStep();
      setTimeout(() => {
        this._isRevealing = false;
      }, 300);
    }
  },

  goToTruthStep() {
    this.currentStep = 3;
    this.renderCurrentPredictStep();
  },

  nextInputPass(totalGuessers) {
    const input = document.getElementById("predict-live-input");
    const warnEl = document.getElementById("predict-empty-warn");
    const val = input ? input.value.trim() : "";

    if (!val) {
      if (warnEl) warnEl.innerText = "Please write something before moving on!";
      if (input) {
        input.style.borderColor = "#c93b58";
        input.focus();
      }
      return;
    }

    const allPlayers = this.getPlayers();
    const guessers = allPlayers.filter(p => p !== this.activeCard.mechanicState.targetPlayer);
    const isTarget = (this.revealIndex >= totalGuessers);

    if (isTarget) {
      this.activeCard.mechanicState.truth = val;
      this.currentStep = 2;
      this.revealIndex = 0;
    } else {
      const currentGuesser = guessers[this.revealIndex];
      this.activeCard.mechanicState.guesses[currentGuesser] = val;
      this.revealIndex++;
    }

    this.renderCurrentPredictStep();
  },

  prevInputPass(totalGuessers) {
    const input = document.getElementById("predict-live-input");
    if (input && input.value.trim()) {
      const allPlayers = this.getPlayers();
      const guessers = allPlayers.filter(p => p !== this.activeCard.mechanicState.targetPlayer);
      if (this.revealIndex >= totalGuessers) {
        this.activeCard.mechanicState.truth = input.value.trim();
      } else {
        this.activeCard.mechanicState.guesses[guessers[this.revealIndex]] = input.value.trim();
      }
    }

    if (this.revealIndex > 0) {
      this.revealIndex--;
    } else {
      this.currentStep = 0;
      this.revealIndex = 0;
    }
    this.renderCurrentPredictStep();
  },

  // ==========================================
  // [2] دوال وتدفق WHO SAID THAT
  // ==========================================
  openWhoSaidThatFlow() {
    const modal = document.getElementById("predict-modal");
    if (!modal) return;
    modal.classList.add("active");
    this.renderCurrentWhoSaidStep();
  },

  startWhoSaidInputPass() {
    this.currentStep = 1;
    this.revealIndex = 0;
    this.renderCurrentWhoSaidStep();
  },

  renderCurrentWhoSaidStep() {
    const container = document.getElementById("predict-content");
    if (!container || !this.activeCard) return;
    const state = this.activeCard.mechanicState;
    const allPlayers = this.getPlayers();

    // الخطوة 0: السؤال
    if (this.currentStep === 0) {
      container.innerHTML = `
        <div class="card-header-row">
          <button class="card-header-btn" onclick="MechanicsManager.cancel()">✕</button>
          <div class="card-header-center">
            <span class="predict-badge">THE QUESTION</span>
          </div>
          <div style="width: 32px;"></div>
        </div>

        <div class="card-question">
          ${this.activeCard.text}
        </div>

        <div class="predict-nav-row">
          <span class="nav-arrow disabled">&lt;</span>
          <span class="nav-arrow" onclick="MechanicsManager.startWhoSaidInputPass()">&gt;</span>
        </div>
      `;
    }

    // الخطوة 1: تمرير الهاتف وإدخال الإجابات
    else if (this.currentStep === 1) {
      const currentPlayerName = allPlayers[this.revealIndex];
      const savedValue = state.answers[currentPlayerName] || "";

      const secretPrompts = [
        "Type it fast, no peeking 👀",
        "Your secret is safe with us… for now 🕵️",
        "Type first, explain later 😄",
        "Your answer is between you and the screen… for now 😁",
        "Nobody sees it… unless the game decides otherwise 👀"
      ];

      if (!Array.isArray(state.assignedPromptPlayers)) {
        const totalParty = allPlayers.length;
        let quota = 1;
        if (totalParty === 4 || totalParty === 5) {
          quota = 2;
        } else if (totalParty >= 6) {
          quota = 3;
        }

        const shuffledPlayers = [...allPlayers].sort(() => Math.random() - 0.5);
        state.assignedPromptPlayers = shuffledPlayers.slice(0, quota);
        state.passPhrases = {};

        const shuffledPrompts = [...secretPrompts].sort(() => Math.random() - 0.5);
        state.assignedPromptPlayers.forEach((player, idx) => {
          state.passPhrases[player] = shuffledPrompts[idx % shuffledPrompts.length];
        });
      }

      let bottomPrompt = "";
      if (state.assignedPromptPlayers.includes(currentPlayerName)) {
        bottomPrompt = state.passPhrases[currentPlayerName] || "";
      }

      container.innerHTML = `
        <div class="card-header-row">
          <button class="card-header-btn" onclick="MechanicsManager.cancel()">✕</button>
          <div class="card-header-center">
            <span class="predict-badge">PASS THE PHONE</span>
          </div>
          <div style="width: 32px;"></div>
        </div>

        <div style="margin: auto 0; width: 100%; display: flex; flex-direction: column; align-items: center;">
          <div class="predict-title" style="margin-bottom: 2px;">Hand phone to ${currentPlayerName}</div>
          <div class="predict-subtitle" style="margin-bottom: 8px; font-size: 0.88rem;">
            Type your answer
          </div>
          
          <textarea id="whosaid-live-input" class="predict-input" placeholder="Your answer...">${savedValue}</textarea>
          
          <div id="whosaid-empty-warn" style="font-size: 0.8rem; font-weight: 700; color: #c93b58; min-height: 18px; margin-top: 2px;"></div>
          
          <div style="font-size: 0.84rem; font-weight: 600; color: #825666; font-style: italic; margin-top: 4px; text-align: center; min-height: 20px;">
            ${bottomPrompt}
          </div>
        </div>

        <div class="predict-nav-row">
          <span class="nav-arrow" onclick="MechanicsManager.prevWhoSaidInputPass(${allPlayers.length})">&lt;</span>
          <span class="nav-arrow" onclick="MechanicsManager.nextWhoSaidInputPass(${allPlayers.length})">&gt;</span>
        </div>
      `;
    }

    // الخطوة 2: كشف الإجابات وانقلاب الكرت
    else if (this.currentStep === 2) {
      const deck = state.shuffledRevealDeck || [];
      const currentAnswerObj = deck[this.revealIndex];
      const isLastAnswer = this.revealIndex >= deck.length - 1;

      if (!currentAnswerObj) return;

      container.innerHTML = `
        <style>
          .who-flip-card {
            background-color: transparent;
            width: 100%;
            height: 220px;
            perspective: 1000px;
            margin: auto 0;
          }
          .who-flip-inner {
            position: relative;
            width: 100%;
            height: 100%;
            text-align: center;
            transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
            transform-style: preserve-3d;
          }
          .who-flip-inner.is-flipped {
            transform: rotateY(180deg);
          }
          .who-flip-front, .who-flip-back {
            position: absolute;
            width: 100%;
            height: 100%;
            -webkit-backface-visibility: hidden;
            backface-visibility: hidden;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 18px 14px;
            border-radius: 12px;
            box-sizing: border-box;
            background: rgba(255, 255, 255, 0.75);
            border: 1px solid rgba(130, 86, 102, 0.2);
          }
          .who-flip-back {
            transform: rotateY(180deg);
            background: rgba(255, 255, 255, 0.9);
          }
        </style>

        <div class="card-header-row">
          <button class="card-header-btn" onclick="MechanicsManager.cancel()">✕</button>
          <div class="card-header-center"></div>
          <div style="width: 32px;"></div>
        </div>

        <div class="who-flip-card">
          <div id="who-card-inner" class="who-flip-inner">
            <div class="who-flip-front">
              <p style="font-size: 1.1rem; font-family: 'Playfair Display', serif; font-style: italic; color: #2b1810; margin: 0; line-height: 1.45; word-break: break-word;">
                “${currentAnswerObj.text}”
              </p>
              <div style="font-size: 0.85rem; font-weight: 600; color: #825666; margin-top: 16px; font-style: italic;">
                Who do you think wrote this? 🤔
              </div>
            </div>
            <div class="who-flip-back">
              <div style="font-size: 1.6rem; font-weight: 800; color: #422933; font-family: 'Playfair Display', serif;">
                ${currentAnswerObj.author}
              </div>
            </div>
          </div>
        </div>

        <div class="predict-nav-row" style="margin-top: 15px; width: 100%;">
          <button id="who-reveal-btn" class="stone-btn" style="width: 100%;" onclick="MechanicsManager.flipWhoSaidCard()">
            REVEAL
          </button>
          <button id="who-next-btn" class="stone-btn" style="width: 100%; display: none;" onclick="${isLastAnswer ? 'MechanicsManager.finish()' : 'MechanicsManager.nextWhoSaidAnswer()'}">
            ${isLastAnswer ? 'DONE' : 'CONTINUE'}
          </button>
        </div>
      `;
    }
  },

  flipWhoSaidCard() {
    const innerCard = document.getElementById("who-card-inner");
    const revealBtn = document.getElementById("who-reveal-btn");
    const nextBtn = document.getElementById("who-next-btn");

    if (innerCard) innerCard.classList.add("is-flipped");
    if (revealBtn) revealBtn.style.display = "none";
    if (nextBtn) nextBtn.style.display = "block";
  },

  nextWhoSaidAnswer() {
    const deck = this.activeCard.mechanicState.shuffledRevealDeck;
    if (deck && this.revealIndex < deck.length - 1) {
      this.revealIndex++;
      this.renderCurrentWhoSaidStep();
    }
  },

  nextWhoSaidInputPass(totalPlayers) {
    const input = document.getElementById("whosaid-live-input");
    const warnEl = document.getElementById("whosaid-empty-warn");
    const val = input ? input.value.trim() : "";

    if (!val) {
      if (warnEl) warnEl.innerText = "Please write your answer !";
      if (input) {
        input.style.borderColor = "#c93b58";
        input.focus();
      }
      return;
    }

    const allPlayers = this.getPlayers();
    const currentPlayerName = allPlayers[this.revealIndex];
    this.activeCard.mechanicState.answers[currentPlayerName] = val;

    if (this.revealIndex >= totalPlayers - 1) {
      if (!this.activeCard.mechanicState.selectedPlayersToReveal) {
        this.activeCard.mechanicState.selectedPlayersToReveal = this.getFairWhoSaidSelectedPlayers(allPlayers);
      }

      const selected = this.activeCard.mechanicState.selectedPlayersToReveal;
      
      if (!this.activeCard.mechanicState.shuffledRevealDeck) {
        this.activeCard.mechanicState.shuffledRevealDeck = selected.map(playerName => ({
          author: playerName,
          text: this.activeCard.mechanicState.answers[playerName] || "No answer submitted",
          isUnmasked: false
        })).sort(() => Math.random() - 0.5);
      }

      this.currentStep = 2;
      this.revealIndex = 0;
    } else {
      this.revealIndex++;
    }

    this.renderCurrentWhoSaidStep();
  },

  getFairWhoSaidSelectedPlayers(allPlayers) {
    const total = allPlayers.length;
    let quota = 2;
    if (total >= 5) quota = 3;

    let historyCounts = JSON.parse(localStorage.getItem("alfiria_whosaid_history") || "{}");

    allPlayers.forEach(p => {
      if (typeof historyCounts[p] === "undefined") historyCounts[p] = 0;
    });

    const sortedPlayers = [...allPlayers].sort((a, b) => {
      const countA = historyCounts[a] || 0;
      const countB = historyCounts[b] || 0;
      if (countA !== countB) return countA - countB;
      return Math.random() - 0.5;
    });

    const chosen = sortedPlayers.slice(0, quota);

    chosen.forEach(p => {
      historyCounts[p] = (historyCounts[p] || 0) + 1;
    });
    localStorage.setItem("alfiria_whosaid_history", JSON.stringify(historyCounts));

    return chosen;
  },

  prevWhoSaidInputPass(totalPlayers) {
    const input = document.getElementById("whosaid-live-input");
    if (input && input.value.trim()) {
      const allPlayers = this.getPlayers();
      const currentPlayerName = allPlayers[this.revealIndex];
      this.activeCard.mechanicState.answers[currentPlayerName] = input.value.trim();
    }

    if (this.revealIndex > 0) {
      this.revealIndex--;
    } else {
      this.currentStep = 0;
      this.revealIndex = 0;
    }
    this.renderCurrentWhoSaidStep();
  },

  // ==========================================
  // [3] دوال وتدفق MOST LIKELY TO
  // ==========================================
  openMostLikelyToFlow() {
    const modal = document.getElementById("predict-modal");
    if (!modal) return;
    modal.classList.add("active");
    this.renderCurrentMostLikelyStep();
  },

  startMostLikelyVoting() {
    this.currentStep = 1;
    this.revealIndex = 0;
    this.renderCurrentMostLikelyStep();
  },

  renderCurrentMostLikelyStep() {
    const container = document.getElementById("predict-content");
    if (!container || !this.activeCard) return;
    const state = this.activeCard.mechanicState;
    const allPlayers = this.getPlayers();

    // ------------------------------------------
    // [3.0] الخطوة 0: شاشة السؤال
    // ------------------------------------------
    if (this.currentStep === 0) {
      container.innerHTML = `
        <div class="card-header-row">
          <button class="card-header-btn" onclick="MechanicsManager.cancel()">✕</button>
          <div class="card-header-center">
            <span class="predict-badge">THE QUESTION</span>
          </div>
          <div style="width: 32px;"></div>
        </div>

        <div class="card-question">
          ${this.activeCard.text}
        </div>

        <div class="predict-nav-row">
          <span class="nav-arrow disabled">&lt;</span>
          <span class="nav-arrow" onclick="MechanicsManager.startMostLikelyVoting()">&gt;</span>
        </div>
      `;
    }

    // ------------------------------------------
    // [3.1] الخطوة 1: تمرير الهاتف والتصويت السري
    // ------------------------------------------
    else if (this.currentStep === 1) {
      const voterName = allPlayers[this.revealIndex];
      const eligibleNominees = allPlayers.filter(p => p !== voterName);
      const currentVote = state.votes[voterName] || "";
      const totalNominees = eligibleNominees.length;

      // بنك العبارات الساخرة
      const sassyPhrases = [
        "We won’t tell them you picked them… for now 😏",
        "Choose with your chest, don't be shy 💅",
        "Somebody’s gotta take the hit 🤷‍♀️",
        "The truth hurts, but your vote doesn’t lie 😌",
        "Don’t look them in the eyes, they’ll know 💀",
        "Avoid eye contact, act natural 😌",
        "Look down and vote, don't let your eyes snitch 🤐"
      ];

      // توزيع الحصص العادلة وتثبيتها بالجلسة
      if (!Array.isArray(state.assignedPromptPlayers)) {
        const totalParty = allPlayers.length;
        let quota = 1;
        if (totalParty === 4 || totalParty === 5) quota = 2;
        else if (totalParty >= 6) quota = 3;

        const shuffledPlayers = [...allPlayers].sort(() => Math.random() - 0.5);
        state.assignedPromptPlayers = shuffledPlayers.slice(0, quota);
        state.passPhrases = {};

        const shuffledPrompts = [...sassyPhrases].sort(() => Math.random() - 0.5);
        state.assignedPromptPlayers.forEach((player, idx) => {
          state.passPhrases[player] = shuffledPrompts[idx % shuffledPrompts.length];
        });
      }

      let bottomPrompt = "";
      if (state.assignedPromptPlayers.includes(voterName)) {
        bottomPrompt = state.passPhrases[voterName] || "";
      }

      // شبكة أزرار المرشحين
      const nomineeButtonsHtml = eligibleNominees.map((name, index) => {
        const isSelected = (currentVote === name);
        const isOddLast = (totalNominees % 2 !== 0 && index === totalNominees - 1);

        return `
          <button 
            type="button"
            class="nominee-btn ${isSelected ? 'selected' : ''}" 
            onclick="MechanicsManager.selectMostLikelyVote('${name.replace(/'/g, "\\'")}')"
            style="
              width: 100%;
              padding: 9px 8px;
              border-radius: 10px;
              font-size: 0.88rem;
              font-weight: 700;
              font-family: inherit;
              cursor: pointer;
              transition: all 0.2s ease;
              box-sizing: border-box;
              background: ${isSelected ? '#e28599' : 'rgba(252, 246, 238, 0.85)'};
              color: ${isSelected ? '#ffffff' : '#422933'};
              border: ${isSelected ? 'none' : '1px solid rgba(180, 140, 150, 0.35)'};
              box-shadow: ${isSelected ? '0 3px 10px rgba(226, 133, 153, 0.45)' : 'none'};
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              ${isOddLast ? 'grid-column: 1 / -1; justify-self: center; width: 60%;' : ''}
            ">
            ${name}
          </button>
        `;
      }).join("");

      container.innerHTML = `
        <div class="card-header-row">
          <button class="card-header-btn" onclick="MechanicsManager.cancel()">✕</button>
          <div class="card-header-center">
            <span class="predict-badge">PASS THE PHONE</span>
          </div>
          <div style="width: 32px;"></div>
        </div>

        <div style="margin: auto 0; width: 100%; display: flex; flex-direction: column; align-items: center;">
          <div class="predict-title" style="margin-bottom: 2px;">Hand phone to ${voterName}</div>
          <div class="predict-subtitle" style="margin-bottom: 12px; font-size: 0.85rem; color: #825666;">
            Vote for who fits this best
          </div>
          
          <div id="mostlikely-options" style="
            width: 100%; 
            max-height: 40vh; 
            overflow-y: auto; 
            box-sizing: border-box; 
            padding: 2px 4px;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
          ">
            ${nomineeButtonsHtml}
          </div>

          <div id="mostlikely-warn" style="font-size: 0.78rem; font-weight: 700; color: #c93b58; min-height: 16px; margin-top: 4px;"></div>

          <div style="font-size: 0.82rem; font-weight: 600; color: #825666; font-style: italic; margin-top: 4px; text-align: center; min-height: 20px; line-height: 1.35;">
            ${bottomPrompt}
          </div>
        </div>

        <div class="predict-nav-row">
          <span class="nav-arrow" onclick="MechanicsManager.prevMostLikelyVote(${allPlayers.length})">&lt;</span>
          <span class="nav-arrow" onclick="MechanicsManager.nextMostLikelyVote(${allPlayers.length})">&gt;</span>
        </div>
      `;
    }

    // ------------------------------------------
    // [3.2] الخطوة 2: كشف النتيجة بتسلسل زمني تشويقي
    // ------------------------------------------
    else if (this.currentStep === 2) {
      // 1. حساب الأصوات
      const voteCounts = {};
      Object.values(state.votes || {}).forEach(candidate => {
        if (candidate) voteCounts[candidate] = (voteCounts[candidate] || 0) + 1;
      });

      let maxVotes = 0;
      Object.values(voteCounts).forEach(cnt => {
        if (cnt > maxVotes) maxVotes = cnt;
      });

      const winners = Object.keys(voteCounts).filter(name => voteCounts[name] === maxVotes);
      const isTie = winners.length > 1;

      // 2. قواميس العبارات
      const introPhrases = [
        "And the verdict is in… 🥁",
        "The moment of truth ✨",
        "Here’s what the group really thinks 👀",
        "The council has spoken 📜",
        "No hiding now… here’s the result 🫢"
      ];

      const soloOutroPhrases = [
        "The group has spoken… don’t take it personally 😌",
        "Well, that wasn't even close 👀",
        "Wear the title with pride, you earned it 💅",
        "Nobody is surprised, let’s be hones😄",
        "The votes are in, and your reputation precedes you ☺️"
      ];

      const tieOutroPhrases = [
        "It’s a tie, guess you’ll have to share the crown 👑",
        "The group couldn't separate you on this one ⚖️",
        "Same energy, same wavelength 👀",
        "Looks like the group sees both of you in this🤷 ",
        "Guilty in equal measure, don't look at each other 💅"
      ];

      if (!state.verdictIntro) {
        state.verdictIntro = introPhrases[Math.floor(Math.random() * introPhrases.length)];
      }
      if (!state.verdictOutro) {
        const list = isTie ? tieOutroPhrases : soloOutroPhrases;
        state.verdictOutro = list[Math.floor(Math.random() * list.length)];
      }

            const winnersDisplayHtml = isTie
        ? winners.join(", ")
        : (winners[0] || "No votes recorded");


      const voteLabel = maxVotes === 1 ? "1 vote" : `${maxVotes} votes`;
      const badgeText = isTie ? `${voteLabel} each` : voteLabel;

      container.innerHTML = `
        <style>
          @keyframes fadeInStep {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .verdict-anim-1 { opacity: 0; animation: fadeInStep 0.6s ease forwards 0.8s; }
          .verdict-anim-2 { opacity: 0; animation: fadeInStep 0.6s ease forwards 2.0s; }
          .verdict-anim-3 { opacity: 0; animation: fadeInStep 0.6s ease forwards 3.4s; }
        </style>

        <div class="card-header-row">
          <button class="card-header-btn" onclick="MechanicsManager.cancel()">✕</button>
          <div class="card-header-center">
            <span class="predict-badge">THE VERDICT</span>
          </div>
          <div style="width: 32px;"></div>
        </div>

        <div style="margin: auto 0; width: 100%; display: flex; flex-direction: column; align-items: center; text-align: center;">
          
          <!-- 1. العبارة التمهيدية -->
          <div class="verdict-anim-1" style="font-size: 0.95rem; font-weight: 700; color: #825666; margin-bottom: 14px;">
            ${state.verdictIntro}
          </div>

          <!-- 2. كشف الفائز والأصوات -->
          <div class="verdict-anim-2 prediction-bubble-light" style="
            width: 100%; 
            padding: 18px 14px; 
            background: rgba(252, 246, 238, 0.92); 
            border: 1px solid rgba(226, 133, 153, 0.4); 
            border-radius: 14px; 
            box-sizing: border-box; 
            box-shadow: 0 4px 16px rgba(226, 133, 153, 0.2);
            display: flex;
            flex-direction: column;
            align-items: center;
          ">
            <div style="font-size: 0.72rem; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #825666; margin-bottom: 8px;">
              ${isTie ? "TIED FOR THE LEAD" : "MOST VOTED"}
            </div>

            <div style="font-size: 1.55rem; font-weight: 800; font-family: 'Playfair Display', serif; color: #422933; margin-bottom: 10px; line-height: 1.25; word-break: break-word;">
              ${winnersDisplayHtml}
            </div>

            <div style="
              display: inline-block;
              font-size: 0.78rem;
              font-weight: 700;
              color: #ffffff;
              background: #e28599;
              padding: 4px 14px;
              border-radius: 20px;
              letter-spacing: 0.5px;
            ">
              ${badgeText}
            </div>
          </div>

          <!-- 3. العبارة الختامية الساخرة -->
          <div class="verdict-anim-3" style="font-size: 0.88rem; font-weight: 600; color: #6b4d57; font-style: italic; margin-top: 16px; line-height: 1.4; padding: 0 8px;">
            ${state.verdictOutro}
          </div>
        </div>

        <div class="predict-nav-row verdict-anim-3" style="margin-top: 16px; width: 100%;">
          <button class="stone-btn" style="width: 100%;" onclick="MechanicsManager.finish()">
            DONE
          </button>
        </div>
      `;
    }
  },

  selectMostLikelyVote(candidateName) {
    const allPlayers = this.getPlayers();
    const voterName = allPlayers[this.revealIndex];
    this.activeCard.mechanicState.votes[voterName] = candidateName;

    const warn = document.getElementById("mostlikely-warn");
    if (warn) warn.innerText = "";

    this.renderCurrentMostLikelyStep();
  },

  nextMostLikelyVote(totalPlayers) {
    const allPlayers = this.getPlayers();
    const voterName = allPlayers[this.revealIndex];
    const chosen = this.activeCard.mechanicState.votes[voterName];

    if (!chosen) {
      const warn = document.getElementById("mostlikely-warn");
      if (warn) warn.innerText = "Please pick someone before passing!";
      return;
    }

    if (this.revealIndex >= totalPlayers - 1) {
      this.currentStep = 2;
      this.revealIndex = 0;
    } else {
      this.revealIndex++;
    }

    this.renderCurrentMostLikelyStep();
  },

  prevMostLikelyVote(totalPlayers) {
    if (this.revealIndex > 0) {
      this.revealIndex--;
    } else {
      this.currentStep = 0;
      this.revealIndex = 0;
    }
    this.renderCurrentMostLikelyStep();
  },

    cancel() {
    const mech = (this.activeCard && this.activeCard.activeMechanic) ? this.activeCard.activeMechanic.toUpperCase() : "";
    if (mech.includes("WHO SAID")) {
      this.resetWhoSaidDraftState();
    } else if (mech.includes("MOST LIKELY")) {
      this.resetMostLikelyDraftState();
    } else {
      this.resetDraftState();
    }

    const modal = document.getElementById("predict-modal");
    if (modal) {
      modal.classList.remove("active");
    }

    setTimeout(() => {
      const cardModal = document.getElementById("card-modal");
      if (cardModal) {
        cardModal.classList.add("active");
        if (typeof renderCard === "function") {
          renderCard(false);
        }
      }
    }, 120);
  },

  finish() {
    if (this.activeCard) {
      this.activeCard.mechanicState = { isCompleted: true };
    }
    this.currentStep = 0;
    this.revealIndex = 0;

    const modal = document.getElementById("predict-modal");
    if (modal) {
      modal.classList.remove("active");
    }

    setTimeout(() => {
      const cardModal = document.getElementById("card-modal");
      if (cardModal) {
        cardModal.classList.add("active");
      }

      if (typeof nextCard === "function") {
        nextCard();
      }
    }, 70);
  }
};
