// ==========================================
// 2. DETERMINISTIC ENGINE (PURE LOGIC)
// ==========================================

function getInitialGameState() {
  return {
    seenCardIds: [],
    viewedCardIds: [],
    lastSeenSession: {},
    consecutiveAppeared: {},
    cooldownUntilSession: {},
    currentSessionIndex: 0
  };
}

function generateSessionCards(userGameHistory) {
  // استنساخ نظيف لمنع التعديل على الكائن الأصلي مباشرة
  const history = userGameHistory ? JSON.parse(JSON.stringify(userGameHistory)) : getInitialGameState();
  history.currentSessionIndex = (history.currentSessionIndex || 0) + 1;
  const currentSessionIdx = history.currentSessionIndex;

  history.seenCardIds = history.seenCardIds || [];
  history.viewedCardIds = history.viewedCardIds || [];
  history.lastSeenSession = history.lastSeenSession || {};
  history.consecutiveAppeared = history.consecutiveAppeared || {};
  history.cooldownUntilSession = history.cooldownUntilSession || {};

  // الاعتماد على الكروت التي شاهدها اللاعب بالفعل على الشاشة
  const seenSet = new Set(history.viewedCardIds.length > 0 ? history.viewedCardIds : history.seenCardIds);
  const sessionUsedTags = new Set();

  // تنظيف الكروت التي انتهت فترة تبريدها
  for (const cardId in history.cooldownUntilSession) {
    if (currentSessionIdx >= history.cooldownUntilSession[cardId]) {
      delete history.cooldownUntilSession[cardId];
      history.consecutiveAppeared[cardId] = 0;
    }
  }

  // الترتيب الصارم للتوليد
  const generationOrder = ["sunny", "gentle", "bloom", "sprouting", "dew"];
  const stageMapKeys = {
    dew: "firstDew",
    sunny: "sunnyPaths",
    gentle: "gentleBreeze",
    sprouting: "sproutingIdeas",
    bloom: "fullBloom"
  };

  // الحصص الافتراضية للكروت المميزة لكل مرحلة
  const targetQuotas = {
    sunny: 1,
    gentle: 1,
    bloom: 2,
    sprouting: 2,
    dew: 2
  };

  // أنماط الخانات المتباعدة لكل مرحلة (حظر الخانة 0 دائماً لكرت الإنترو)
  const slotPatterns = {
    1: [[1], [2], [3], [4]],
    2: [[1, 3], [1, 4], [2, 4]]
  };

  // تهيئة مصفوفات الجلسة (5 خانات لكل مرحلة)
  const sessionStages = {
    dew: new Array(5).fill(null),
    sunny: new Array(5).fill(null),
    gentle: new Array(5).fill(null),
    sprouting: new Array(5).fill(null),
    bloom: new Array(5).fill(null)
  };

  const tagLookup = (typeof CARD_TAGS !== "undefined" && CARD_TAGS) ? CARD_TAGS : {};

  // نسخ بنك الأسئلة لكل مرحلة لحماية المصدر الأصلي
  const stagePools = {};
  for (const stg in stageMapKeys) {
    const key = stageMapKeys[stg];
    stagePools[stg] = (typeof QUESTIONS_DATABASE !== "undefined" && QUESTIONS_DATABASE[key]) 
      ? [...QUESTIONS_DATABASE[key]] 
      : [];
  }

  // عدادات ظهور الميكانيكيات في الجلسة لتحقيق التوازن
  const mechanicCounts = {
    "WHO SAID THAT": 0,
    "PREDICT": 0,
    "MOST LIKELY TO": 0
  };

  // ----------------------------------------------------
  // دالة الفحص والسحب بسلم طوارئ ذكي (7 مستويات أمان)
  // ----------------------------------------------------
  function pickBestCard(stg, requiredMechanic = null, allowAnyMechanicIfNotFound = false) {
    const pool = stagePools[stg];
    if (!pool || pool.length === 0) return null;

    const getCardMechanic = (card) => {
      if (card.specialMechanic) return card.specialMechanic;
      if (card.mechanic && card.mechanic !== "NATURAL") return card.mechanic;
      return "NATURAL";
    };

    const matchesMechanic = (card, req) => {
      const m = getCardMechanic(card);
      if (req === "NATURAL") return m === "NATURAL";
      if (req) return m === req;
      return true;
    };

    const isTagFree = (card) => {
      const cTags = tagLookup[card.id] || [];
      return cTags.every(tag => !sessionUsedTags.has(tag));
    };

    const isInCooldown = (card) => {
      return !!history.cooldownUntilSession[card.id];
    };

    // 1. كرت جديد كلياً + تاغ حر + الميكانيك المطلوب (المثالي)
    let candidates = pool.filter(c => !seenSet.has(c.id) && isTagFree(c) && matchesMechanic(c, requiredMechanic));

    // 2. كرت جديد كلياً + الميكانيك المطلوب (كسر شرط التاغ من أجل تقديم كرت جديد)
    if (candidates.length === 0) {
      candidates = pool.filter(c => !seenSet.has(c.id) && matchesMechanic(c, requiredMechanic));
    }

    // 3. كرت جديد كلياً + أي ميكانيك مميز متاح
    if (candidates.length === 0 && allowAnyMechanicIfNotFound && requiredMechanic !== "NATURAL") {
      candidates = pool.filter(c => !seenSet.has(c.id) && getCardMechanic(c) !== "NATURAL");
    }

    // 4. أي كرت جديد متبقٍ في هذه المرحلة
    if (candidates.length === 0) {
      candidates = pool.filter(c => !seenSet.has(c.id));
    }

    // 5. كرت قديم خارج التبريد + تاغ حر + الميكانيك المطلوب (لـ Endless Mode)
    if (candidates.length === 0) {
      candidates = pool.filter(c => seenSet.has(c.id) && !isInCooldown(c) && isTagFree(c) && matchesMechanic(c, requiredMechanic));
    }

    // 6. كرت قديم خارج التبريد + الميكانيك المطلوب
    if (candidates.length === 0) {
      candidates = pool.filter(c => seenSet.has(c.id) && !isInCooldown(c) && matchesMechanic(c, requiredMechanic));
    }

    // 7. صمام الأمان لأي كرت متاح لمنع الـ null نهائياً
    if (candidates.length === 0) {
      candidates = [...pool];
    }

    const rawChosen = candidates[Math.floor(Math.random() * candidates.length)];
    if (!rawChosen) return null;

    const chosen = { ...rawChosen };

    // حجز التاجات واستبعاد الكرت من الحوض لمنع تكراره بالجلسة
    const cTags = tagLookup[chosen.id] || [];
    cTags.forEach(tag => sessionUsedTags.add(tag));
    stagePools[stg] = stagePools[stg].filter(c => c.id !== rawChosen.id);

    return chosen;
  }

  // ----------------------------------------------------
  // مرحلة 1: توزيع الكروت المميزة
  // ----------------------------------------------------
  generationOrder.forEach(stg => {
    let quota = targetQuotas[stg];
    let patterns = slotPatterns[quota];
    let chosenSlots = [...patterns[Math.floor(Math.random() * patterns.length)]];

    for (let i = 0; i < chosenSlots.length; i++) {
      const slotIdx = chosenSlots[i];
      let targetMech = null;

      if (stg === "sunny") {
        targetMech = "WHO SAID THAT";
      } else if (stg === "gentle") {
        targetMech = (mechanicCounts["MOST LIKELY TO"] === 0) ? "MOST LIKELY TO" : "WHO SAID THAT";
      } else {
        const sortedMechs = Object.keys(mechanicCounts).sort((a, b) => mechanicCounts[a] - mechanicCounts[b]);
        targetMech = sortedMechs[0] || null;
      }

      let card = pickBestCard(stg, targetMech, true);
      const cardMech = card ? (card.specialMechanic || (card.mechanic !== "NATURAL" ? card.mechanic : null)) : null;

      if (card && cardMech) {
        card.activeMechanic = cardMech;
        sessionStages[stg][slotIdx] = card;
        mechanicCounts[cardMech] = (mechanicCounts[cardMech] || 0) + 1;
      }
    }
  });

  // ----------------------------------------------------
  // مرحلة 2: ملء الخانات المتبقية بالبطاقات الطبيعية (Natural)
  // ----------------------------------------------------
  const stagesKey = ["dew", "sunny", "gentle", "sprouting", "bloom"];
  stagesKey.forEach(stg => {
    for (let slot = 0; slot < 5; slot++) {
      if (!sessionStages[stg][slot]) {
        const nCard = pickBestCard(stg, "NATURAL", false);
        if (nCard) {
          nCard.activeMechanic = null;
          sessionStages[stg][slot] = nCard;
        }
      }
    }
  });

  // ----------------------------------------------------
  // مرحلة 3: تسجيل الذاكرة والتبريد بعد اكتمال الـ 25 كرتاً (حلقة واحدة نظيفة)
  // ----------------------------------------------------
  stagesKey.forEach(stg => {
    sessionStages[stg].forEach(card => {
      if (!card) return;

      if (!seenSet.has(card.id)) {
        history.seenCardIds.push(card.id);
        seenSet.add(card.id);
      }

      const lastSession = history.lastSeenSession[card.id] || 0;
      if (lastSession === currentSessionIdx - 1) {
        history.consecutiveAppeared[card.id] = (history.consecutiveAppeared[card.id] || 1) + 1;
      } else {
        history.consecutiveAppeared[card.id] = 1;
      }
      history.lastSeenSession[card.id] = currentSessionIdx;

      // إذا ظهر مرتين متتاليتين، يدخل التبريد للجلسة بعد القادمة
      if (history.consecutiveAppeared[card.id] >= 2) {
        history.cooldownUntilSession[card.id] = currentSessionIdx + 2;
      }
    });
  });

  // إرجاع النتيجة كنظام نقي (Pure Output) ليتولى GameStorage الحفظ
  return { 
    levels: sessionStages,
    updatedHistory: history 
  };
}
