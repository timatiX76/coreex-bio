(() => {
  'use strict';

  const startScreen = document.getElementById('start-screen');
  const mainContent = document.getElementById('main-content');
  const soundToggle = document.getElementById('sound-toggle');
  const video = document.getElementById('bg-video');

  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  let started = false;
  let soundOn = false;

  const MUSIC_VOLUME = 0.3;
  video.volume = MUSIC_VOLUME;

  const debug = new URLSearchParams(location.search).has('debug');
  let panel;

  function markVideoFailed() {
    document.body.classList.add('video-failed');
  }

  function log(line) {
    if (!panel) {
      return;
    }
    const row = document.createElement('div');
    row.textContent = line;
    panel.appendChild(row);
  }

  if (debug) {
    panel = document.createElement('pre');
    panel.className = 'debug-panel';
    document.body.appendChild(panel);

    const probe = document.createElement('video');
    log('canPlay webm : ' + probe.canPlayType('video/webm; codecs="vp9,opus"'));
    log('canPlay mp4  : ' + probe.canPlayType('video/mp4; codecs="avc1.640028,mp4a.40.2"'));
    log('reducedMotion: ' + window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    log('iOS          : ' + isIOS);
    log('userAgent    : ' + navigator.userAgent);
  }

  video.querySelectorAll('source').forEach((s) => {
    s.addEventListener('error', () => {
      log('source error: ' + s.getAttribute('src'));
      if (video.networkState === video.NETWORK_NO_SOURCE) {
        markVideoFailed();
      }
    });
  });

  video.addEventListener('loadeddata', () => log('loadeddata ' + video.videoWidth + 'x' + video.videoHeight));
  video.addEventListener('playing', () => log('playing t=' + video.currentTime.toFixed(2)));
  video.addEventListener('waiting', () => log('waiting'));
  video.addEventListener('stalled', () => log('stalled'));
  video.addEventListener('error', () => {
    log('video error code=' + (video.error && video.error.code) +
        ' msg=' + (video.error && video.error.message));
    markVideoFailed();
  });

  function setSound(on) {
    soundOn = on;
    video.volume = MUSIC_VOLUME;
    video.muted = !on;
    soundToggle.setAttribute('aria-pressed', String(on));
    soundToggle.setAttribute('aria-label', on ? 'Выключить звук' : 'Включить звук');
    log('sound=' + (on ? 'on' : 'off'));
  }

  function enter() {
    if (started) {
      return;
    }
    started = true;

    startScreen.style.opacity = '0';
    window.setTimeout(() => startScreen.remove(), 400);

    mainContent.hidden = false;
    void mainContent.offsetWidth;
    mainContent.classList.add('is-visible');

    video.play()
      .then(() => {
        log('play() resolved, muted=' + video.muted);
        setSound(!isIOS);
      })
      .catch((e) => {
        log('play() rejected: ' + e.name + ' ' + e.message);
        markVideoFailed();
      });

    log('state readyState=' + video.readyState + ' networkState=' + video.networkState);
  }

  startScreen.addEventListener('click', enter);

  soundToggle.addEventListener('click', () => {
    setSound(!soundOn);
    if (!video.paused) {
      video.muted = !soundOn;
    } else {
      video.play().catch(() => {});
    }
  });

  setSound(false);

  const viewsEl = document.getElementById('views');
  const FALLBACK_VIEWS = 623;
  const VIEWS_URL = '/api/count';

  function visitorId() {
    const KEY = 'bv-id';
    try {
      let id = localStorage.getItem(KEY);
      if (!id) {
        id = typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : String(Date.now()) + Math.random().toString(36).slice(2);
        localStorage.setItem(KEY, id);
      }
      return id;
    } catch (e) {
      return 'anon-' + Date.now();
    }
  }

  function formatViews(n) {
    try {
      return n.toLocaleString('ru-RU');
    } catch (e) {
      return String(n);
    }
  }

  async function loadViews() {
    if (!viewsEl) {
      return;
    }
    try {
      const res = await fetch(VIEWS_URL + '?v=' + encodeURIComponent(visitorId()), { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('HTTP ' + res.status);
      }
      const data = await res.json();
      if (typeof data.count !== 'number' || !isFinite(data.count)) {
        throw new Error('плохой ответ');
      }
      viewsEl.textContent = formatViews(data.count);
      log('views=' + data.count);
    } catch (e) {
      
      viewsEl.textContent = formatViews(FALLBACK_VIEWS);
      log('views error: ' + e.message);
    }
  }

  const card = mainContent.querySelector('.card');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  let entered = false;
  let tiltRaf = 0;

  if (card && !reduceMotion.matches && finePointer.matches) {
    card.addEventListener('animationend', (e) => {
      if (e.animationName === 'slide-up') {
        entered = true;
        card.style.animationName = 'none';
      }
    });
    mainContent.addEventListener('pointermove', (e) => {
      if (!started || !entered) {
        return;
      }
      cancelAnimationFrame(tiltRaf);
      tiltRaf = requestAnimationFrame(() => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform =
          'perspective(900px) rotateX(' + (-py * 6).toFixed(2) +
          'deg) rotateY(' + (px * 8).toFixed(2) + 'deg)';
      });
    });
    mainContent.addEventListener('pointerleave', () => {
      cancelAnimationFrame(tiltRaf);
      card.style.transform = '';
    });
  }

  loadViews();
})();
