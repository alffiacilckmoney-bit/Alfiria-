// Alfiria - Smooth Audio Engine (Throttled & Soft Fade)
const SoundManager = {
  ctx: null,
  buffers: {},
  lastPlayed: {}, // لتتبع أوقات التشغيل ومنع التكرار المزعج

  // روابط Cloudinary الخفيفة
  files: {
    specialCard: 'https://res.cloudinary.com/qc0aowwf/video/upload/br_64k,q_auto/special-card.mp3',
    islandClick: 'https://res.cloudinary.com/qc0aowwf/video/upload/br_64k,q_auto/v1790065748/island-click.mp3',
    intro:       'https://res.cloudinary.com/qc0aowwf/video/upload/br_64k,q_auto/v1790065749/intro.mp3',
    celebration: 'https://res.cloudinary.com/qc0aowwf/video/upload/br_64k,q_auto/v1790065749/celebration.mp3',
    cardClick:   'https://res.cloudinary.com/qc0aowwf/video/upload/br_64k,q_auto/v1790065750/card-click.mp3'
  },

  // مستويات صوت هادئة جداً وناعمة
  volumes: {
    islandClick: 0.16,  // خافت ومريح جداً
    cardClick: 0.22,    // ناعم لتقليب الأوراق المتكرر
    specialCard: 0.25,  // مميز وهادئ بدون حدة
    intro: 0.50,        // مقدمة هادئة
    celebration: 0.15   // احتفال غير مزعج
  },

  // الحد الأدنى بين كل تشغيل لإنهاء الإزعاج عند الضغط السريع (بالميلي ثانية)
  cooldowns: {
    islandClick: 250,
    cardClick: 180,
    specialCard: 1000,
    intro: 1000,
    celebration: 1000
  },

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.preloadAll();
  },

  async loadSound(key, url) {
    try {
      const res = await fetch(url);
      const arrayBuffer = await res.arrayBuffer();
      this.buffers[key] = await this.ctx.decodeAudioData(arrayBuffer);
    } catch (err) {
      console.warn(`[SoundManager] Preload failed for ${key}:`, err);
    }
  },

  preloadAll() {
    for (const [key, url] of Object.entries(this.files)) {
      if (!this.buffers[key]) {
        this.loadSound(key, url);
      }
    }
  },

  async play(key, customVolume = null) {
    // فحص الضغط السريع (منع تكرار الصوت إن تم النقر متتالياً بسرعة)
    const nowMs = performance.now();
    const cooldown = this.cooldowns[key] || 200;
    if (this.lastPlayed[key] && (nowMs - this.lastPlayed[key] < cooldown)) {
      return; // تجاهل الصوت لحماية أذن اللاعب من التداخل والإزعاج
    }
    this.lastPlayed[key] = nowMs;

    if (!this.ctx) this.init();
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    if (!this.buffers[key]) {
      await this.loadSound(key, this.files[key]);
    }

    const volume = customVolume !== null ? customVolume : (this.volumes[key] || 0.3);
    const buffer = this.buffers[key];

    if (!buffer) {
      const fallback = new Audio(this.files[key]);
      fallback.volume = volume;
      fallback.play().catch(() => {});
      return;
    }

    const source = this.ctx.createBufferSource();
    const gainNode = this.ctx.createGain();
    source.buffer = buffer;

    const now = this.ctx.currentTime;
    const duration = buffer.duration;

    // مدة تلاشٍ أطول وأوضح لمنع أي قص فجائي
    let fadeDuration = 0.25;
    if (key === 'intro') {
      fadeDuration = Math.min(1.8, duration * 0.5); // تلاشٍ طويل وفخم للإنترو
    } else if (key === 'celebration' || key === 'specialCard') {
      fadeDuration = Math.min(0.9, duration * 0.90); // تلاشٍ ناعم ممتد
    } else {
      fadeDuration = Math.min(0.18, duration * 0.4); // تلاشٍ ناعم للنقرات والكروت
    }

    const fadeStartTime = Math.max(now, now + duration - fadeDuration);

    // تطبيق تلاشي الصوت بسلاسة
    gainNode.gain.setValueAtTime(volume, now);
    gainNode.gain.setValueAtTime(volume, fadeStartTime);
    gainNode.gain.linearRampToValueAtTime(0.0001, now + duration);

    source.connect(gainNode);
    gainNode.connect(this.ctx.destination);
    source.start(0);
  }
};

// تجهيز المحرك مسبقاً
window.addEventListener('DOMContentLoaded', () => {
  SoundManager.init();
});

// مستمع النقر المحصور بالمواضع الثلاثة المحددة فقط
document.addEventListener('pointerdown', (e) => {
  const target = e.target;

  // 1. ضغط دبابيس الجزر فقط
  if (target.closest('.island-pin')) {
    SoundManager.play('islandClick');
    return;
  }

  // 2. زر المينيو الرئيسي فقط (دون أزرار الداخل)
  if (target.closest('#menu-btn, .menu-trigger-btn, #island-menu-btn') && !target.closest('#island-menu-dropdown, #menu-overlay, .menu-modal, .menu-drawer, #settings-modal')) {
    SoundManager.play('islandClick');
    return;
  }

  // 3. زر Continue فقط في رسائل النهاية
  const endModal = target.closest('#end-modal, #island-completion-modal, .completion-modal, #victory-modal');
  if (endModal) {
    const actionBtn = target.closest('button, .stone-btn, .action-btn');
    if (actionBtn) {
      const text = actionBtn.innerText.trim().toLowerCase();
      if (text.includes('continue')) {
        SoundManager.play('islandClick');
        return;
      }
    }
  }
});
