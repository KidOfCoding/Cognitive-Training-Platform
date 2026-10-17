/**
 * Cognitive Games Interactive Demo Engine with Audio & Voiceover
 * Features: Step Scroller, Progress Tracker, Animated Touch/Cursor Pointer, Audio Synthesizer & Speech Narration
 */

(function () {
  'use strict';

  // --- AUDIO SYNTHESIS & SPEECH VOICEOVER ENGINE ---
  class GameDemoAudio {
    constructor() {
      this.ctx = null;
      this.muted = localStorage.getItem('demo_audio_muted') === 'true';
      this.synth = window.speechSynthesis || null;
      this.currentUtterance = null;
      this.voices = [];

      if (this.synth) {
        this.voices = this.synth.getVoices();
        if (this.synth.onvoiceschanged !== undefined) {
          this.synth.onvoiceschanged = () => {
            this.voices = this.synth.getVoices();
          };
        }
      }
    }

    initContext() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }

    setMuted(muted) {
      this.muted = !!muted;
      localStorage.setItem('demo_audio_muted', this.muted ? 'true' : 'false');
      if (this.muted) {
        this.stopSpeaking();
      }
    }

    isMuted() {
      return this.muted;
    }

    speak(text, onEnd) {
      if (this.muted || !this.synth) {
        if (onEnd) setTimeout(onEnd, 100);
        return;
      }

      this.stopSpeaking();

      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.98;
        utterance.pitch = 1.02;
        utterance.lang = 'en-US';

        // Select the most natural English voice available
        if (this.voices.length > 0) {
          const naturalVoice = this.voices.find(v => 
            v.lang.startsWith('en') && (
              v.name.includes('Google') || 
              v.name.includes('Natural') || 
              v.name.includes('Samantha') || 
              v.name.includes('Victoria') ||
              v.name.includes('Karen') ||
              v.name.includes('Zira') ||
              v.name.includes('David')
            )
          ) || this.voices.find(v => v.lang.startsWith('en'));
          if (naturalVoice) utterance.voice = naturalVoice;
        }

        utterance.onend = () => {
          this.currentUtterance = null;
          if (onEnd) onEnd();
        };

        utterance.onerror = () => {
          this.currentUtterance = null;
          if (onEnd) onEnd();
        };

        this.currentUtterance = utterance;
        this.synth.speak(utterance);
      } catch (e) {
        console.warn('Speech synthesis error:', e);
        if (onEnd) setTimeout(onEnd, 100);
      }
    }

    stopSpeaking() {
      if (this.synth) {
        try {
          this.synth.cancel();
        } catch (e) {}
      }
      this.currentUtterance = null;
    }

    // Web Audio Sound Effects
    playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.25) {
      if (this.muted) return;
      try {
        this.initContext();
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {}
    }

    playChime() {
      if (this.muted) return;
      this.playTone(523.25, 'sine', 0.2, 0.2); // C5
      setTimeout(() => this.playTone(659.25, 'sine', 0.25, 0.25), 90); // E5
      setTimeout(() => this.playTone(783.99, 'sine', 0.35, 0.3), 180); // G5
    }

    playStep() {
      if (this.muted) return;
      this.playTone(330, 'triangle', 0.08, 0.18);
    }

    playWallHit() {
      if (this.muted) return;
      this.playTone(130, 'sawtooth', 0.35, 0.35);
      setTimeout(() => this.playTone(95, 'sawtooth', 0.4, 0.3), 100);
    }

    playKeyCollected() {
      if (this.muted) return;
      const notes = [587.33, 739.99, 880.00, 1174.66]; // D5, F#5, A5, D6
      notes.forEach((freq, idx) => {
        setTimeout(() => this.playTone(freq, 'sine', 0.2, 0.22), idx * 70);
      });
    }

    playBubblePop(pitchStep = 1) {
      if (this.muted) return;
      const baseFreq = 400 + (pitchStep * 180);
      this.playTone(baseFreq, 'sine', 0.12, 0.25);
      setTimeout(() => this.playTone(baseFreq * 1.5, 'triangle', 0.1, 0.2), 30);
    }

    playTileRotate() {
      if (this.muted) return;
      this.playTone(480, 'square', 0.06, 0.12);
      setTimeout(() => this.playTone(640, 'triangle', 0.08, 0.15), 40);
    }

    playPathConnect() {
      if (this.muted) return;
      this.playTone(523.25, 'sine', 0.15, 0.2);
      setTimeout(() => this.playTone(659.25, 'sine', 0.2, 0.22), 80);
    }

    playSuccess() {
      if (this.muted) return;
      const fanfare = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      fanfare.forEach((freq, idx) => {
        setTimeout(() => this.playTone(freq, 'triangle', 0.35, 0.3), idx * 110);
      });
    }
  }

  // --- CORE DEMO OVERLAY CONTROLLER ---
  class GameDemoController {
    constructor(config) {
      this.config = Object.assign({
        gameId: 'unknown',
        gameTitle: 'Cognitive Game',
        badge: 'Interactive Tutorial',
        steps: [],
        onSkip: () => {},
        onComplete: () => {}
      }, config);

      this.audio = new GameDemoAudio();
      this.currentStep = 0;
      this.isPlaying = false;
      this.stepTimer = null;
      this.overlayEl = null;
      this.stageEl = null;
      this.cursorEl = null;
      this.progressFillEl = null;
      this.stepTimeouts = [];
    }

    clearStepTimeouts() {
      this.stepTimeouts.forEach(t => clearTimeout(t));
      this.stepTimeouts = [];
    }

    registerTimeout(fn, delay) {
      const id = setTimeout(fn, delay);
      this.stepTimeouts.push(id);
      return id;
    }

    mount() {
      if (document.getElementById('demo-overlay-' + this.config.gameId)) {
        this.overlayEl = document.getElementById('demo-overlay-' + this.config.gameId);
        return;
      }

      const overlay = document.createElement('div');
      overlay.id = 'demo-overlay-' + this.config.gameId;
      overlay.className = 'demo-overlay';
      overlay.style.display = 'none';

      overlay.innerHTML = `
        <div class="demo-modal" role="dialog" aria-modal="true" aria-label="${this.config.gameTitle} Demo">
          <div class="demo-header">
            <div class="demo-title-group">
              <span class="demo-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                ${this.config.badge}
              </span>
              <h2 class="demo-game-name">${this.config.gameTitle}</h2>
            </div>
            <div class="demo-header-actions">
              <button type="button" class="demo-btn-icon" id="demo-audio-toggle" title="Toggle Voice & Sound Audio" aria-label="Toggle Audio">
                <span id="demo-audio-icon">🔊</span>
              </button>
              <button type="button" class="demo-btn-skip" id="demo-skip-btn">
                <span>Skip Demo</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
              </button>
            </div>
          </div>

          <!-- Enhanced Step Scroller & Progress Track -->
          <div class="demo-progress-track">
            <div class="demo-progress-fill" id="demo-progress-fill"></div>
          </div>
          <div class="demo-steps-bar" id="demo-steps-bar"></div>

          <!-- Interactive Animation Stage -->
          <div class="demo-stage" id="demo-stage">
            <div class="demo-cursor" id="demo-cursor" style="opacity: 0; left: 50%; top: 50%;">
              <div class="demo-cursor-inner">👆</div>
            </div>
            <div id="demo-stage-content" style="width: 100%; display: flex; justify-content: center; align-items: center;"></div>
          </div>

          <!-- Instruction & Caption Banner -->
          <div class="demo-instruction-card">
            <div class="demo-instruction-header">
              <span class="demo-step-badge" id="demo-step-badge">Step 1</span>
              <h3 class="demo-step-title" id="demo-step-title">Instruction</h3>
              <div class="demo-voice-indicator" id="demo-voice-indicator">
                <div class="demo-voice-wave"><span></span><span></span><span></span></div>
                <span>Audio Guide</span>
              </div>
            </div>
            <p class="demo-instruction-text" id="demo-instruction-text">Loading...</p>
          </div>

          <!-- Footer Navigation & Controls -->
          <div class="demo-footer">
            <div class="demo-nav-btns">
              <button type="button" class="demo-btn demo-btn-secondary" id="demo-prev-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                <span>Back</span>
              </button>
              <button type="button" class="demo-btn demo-btn-secondary" id="demo-play-pause-btn">
                <span id="demo-play-pause-icon">⏸️</span>
                <span id="demo-play-pause-text">Pause</span>
              </button>
              <button type="button" class="demo-btn demo-btn-replay" id="demo-replay-btn" title="Replay Walkthrough from Start">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                <span>Replay</span>
              </button>
              <button type="button" class="demo-btn demo-btn-primary" id="demo-next-btn">
                <span>Next Step</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
            <button type="button" class="demo-btn demo-btn-play-now" id="demo-finish-btn">
              <span>Start Playing Now</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      this.overlayEl = overlay;
      this.stageEl = overlay.querySelector('#demo-stage-content');
      this.cursorEl = overlay.querySelector('#demo-cursor');
      this.progressFillEl = overlay.querySelector('#demo-progress-fill');

      this.bindEvents();
    }

    bindEvents() {
      const skipBtn = this.overlayEl.querySelector('#demo-skip-btn');
      const finishBtn = this.overlayEl.querySelector('#demo-finish-btn');
      const audioToggle = this.overlayEl.querySelector('#demo-audio-toggle');
      const prevBtn = this.overlayEl.querySelector('#demo-prev-btn');
      const nextBtn = this.overlayEl.querySelector('#demo-next-btn');
      const playPauseBtn = this.overlayEl.querySelector('#demo-play-pause-btn');
      const replayBtn = this.overlayEl.querySelector('#demo-replay-btn');

      skipBtn.addEventListener('click', () => this.skip());
      finishBtn.addEventListener('click', () => this.complete());

      if (replayBtn) {
        replayBtn.addEventListener('click', () => {
          this.goToStep(0);
        });
      }

      audioToggle.addEventListener('click', () => {
        const nextMuted = !this.audio.isMuted();
        this.audio.setMuted(nextMuted);
        this.updateAudioButtonState();
      });

      prevBtn.addEventListener('click', () => {
        if (this.currentStep > 0) {
          this.goToStep(this.currentStep - 1);
        }
      });

      nextBtn.addEventListener('click', () => {
        if (this.currentStep < this.config.steps.length - 1) {
          this.goToStep(this.currentStep + 1);
        } else {
          this.complete();
        }
      });

      playPauseBtn.addEventListener('click', () => {
        this.togglePlayPause();
      });

      this.updateAudioButtonState();
    }

    updateAudioButtonState() {
      const icon = this.overlayEl.querySelector('#demo-audio-icon');
      const btn = this.overlayEl.querySelector('#demo-audio-toggle');
      if (this.audio.isMuted()) {
        icon.textContent = '🔇';
        btn.classList.remove('active');
        btn.title = 'Audio Muted — Click to Enable Voice';
      } else {
        icon.textContent = '🔊';
        btn.classList.add('active');
        btn.title = 'Audio On — Click to Mute';
      }
    }

    renderStepsBar() {
      const bar = this.overlayEl.querySelector('#demo-steps-bar');
      bar.innerHTML = '';

      // Update progress fill bar
      if (this.progressFillEl && this.config.steps.length > 0) {
        const pct = Math.round(((this.currentStep + 1) / this.config.steps.length) * 100);
        this.progressFillEl.style.width = pct + '%';
      }

      this.config.steps.forEach((step, idx) => {
        const pill = document.createElement('div');
        const isActive = idx === this.currentStep;
        const isCompleted = idx < this.currentStep;

        pill.className = `demo-step-pill ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`;
        pill.innerHTML = `
          <span class="demo-step-num">${isCompleted ? '✓' : idx + 1}</span>
          <span class="demo-step-label">${step.title}</span>
        `;
        pill.addEventListener('click', () => this.goToStep(idx));
        bar.appendChild(pill);

        // Auto scroll active pill smoothly into view
        if (isActive) {
          setTimeout(() => {
            pill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }, 50);
        }
      });
    }

    start() {
      this.mount();
      this.overlayEl.style.display = 'flex';
      this.currentStep = 0;
      this.isPlaying = true;
      this.audio.playChime();
      this.renderStepsBar();
      this.loadStep(0);
    }

    skip() {
      this.stop();
      if (typeof this.config.onSkip === 'function') {
        this.config.onSkip();
      }
    }

    complete() {
      this.stop();
      localStorage.setItem('watched_demo_' + this.config.gameId, 'true');
      if (typeof this.config.onComplete === 'function') {
        this.config.onComplete();
      }
    }

    stop() {
      this.isPlaying = false;
      clearTimeout(this.stepTimer);
      this.clearStepTimeouts();
      this.audio.stopSpeaking();
      if (this.overlayEl) {
        this.overlayEl.style.display = 'none';
      }
      const step = this.config.steps[this.currentStep];
      if (step && typeof step.onLeave === 'function') {
        step.onLeave(this.stageEl);
      }
    }

    togglePlayPause() {
      this.isPlaying = !this.isPlaying;
      const icon = this.overlayEl.querySelector('#demo-play-pause-icon');
      const text = this.overlayEl.querySelector('#demo-play-pause-text');
      if (this.isPlaying) {
        icon.textContent = '⏸️';
        text.textContent = 'Pause';
        this.goToStep(this.currentStep);
      } else {
        icon.textContent = '▶️';
        text.textContent = 'Resume';
        clearTimeout(this.stepTimer);
        this.clearStepTimeouts();
        this.audio.stopSpeaking();
      }
    }

    goToStep(index) {
      if (index < 0 || index >= this.config.steps.length) return;
      clearTimeout(this.stepTimer);
      this.clearStepTimeouts();
      this.audio.stopSpeaking();

      const prevStep = this.config.steps[this.currentStep];
      if (prevStep && typeof prevStep.onLeave === 'function') {
        prevStep.onLeave(this.stageEl);
      }

      this.currentStep = index;
      this.renderStepsBar();
      this.loadStep(index);
    }

    loadStep(index) {
      const step = this.config.steps[index];
      if (!step) return;

      const badge = this.overlayEl.querySelector('#demo-step-badge');
      const title = this.overlayEl.querySelector('#demo-step-title');
      const text = this.overlayEl.querySelector('#demo-instruction-text');
      const prevBtn = this.overlayEl.querySelector('#demo-prev-btn');
      const nextBtn = this.overlayEl.querySelector('#demo-next-btn');

      badge.textContent = `Step ${index + 1} of ${this.config.steps.length}`;
      title.textContent = step.title;
      text.innerHTML = step.captionText;

      prevBtn.style.visibility = index === 0 ? 'hidden' : 'visible';
      if (index === this.config.steps.length - 1) {
        nextBtn.innerHTML = `<span>Finish</span> <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
      } else {
        nextBtn.innerHTML = `<span>Next Step</span> <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`;
      }

      this.hideCursor();

      if (typeof step.onEnter === 'function') {
        step.onEnter(this.stageEl, this, this.audio);
      }

      if (this.isPlaying && step.voiceText) {
        this.audio.speak(step.voiceText, () => {
          if (this.isPlaying) {
            this.stepTimer = setTimeout(() => {
              if (this.isPlaying && this.currentStep < this.config.steps.length - 1) {
                this.goToStep(this.currentStep + 1);
              }
            }, step.autoAdvanceDelay || 2200);
          }
        });
      }
    }

    moveCursorTo(targetEl, options = {}) {
      if (!this.cursorEl || !targetEl) return;
      const stageRect = this.stageEl.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();

      const left = (targetRect.left - stageRect.left) + (targetRect.width / 2) - 16;
      const top = (targetRect.top - stageRect.top) + (targetRect.height / 2) - 16;

      this.cursorEl.style.opacity = '1';
      this.cursorEl.style.transform = `translate(${left}px, ${top}px)`;

      if (options.click) {
        setTimeout(() => {
          this.cursorEl.classList.add('clicking');
          if (options.clickSound && this.audio) {
            options.clickSound();
          }
          if (typeof options.onClick === 'function') {
            options.onClick();
          }
          setTimeout(() => {
            this.cursorEl.classList.remove('clicking');
          }, 300);
        }, options.delay || 400);
      }
    }

    hideCursor() {
      if (this.cursorEl) {
        this.cursorEl.style.opacity = '0';
        this.cursorEl.classList.remove('clicking');
      }
    }
  }

  // --- GAME 1: DYNAMIC MEMORY PATH DEMO BUILDER ---
  // Implements explicit button presses in sequence UP -> LEFT -> RIGHT -> DOWN
  window.initPathGameDemo = function (callbacks = {}) {
    const steps = [
      {
        title: "The Objective: Key & Goal",
        voiceText: "Welcome to Dynamic Memory Path! Your mission is to find the hidden key and navigate to the goal flag while avoiding invisible walls.",
        captionText: "Locate your Player <strong class='text-sky-400'>P</strong> at top-left. You must first find the <strong class='text-yellow-400'>Golden Key 🔑</strong> before reaching the <strong class='text-purple-400'>Exit Goal 🏁</strong>.",
        autoAdvanceDelay: 2200,
        onEnter: (stageEl, demo, audio) => {
          stageEl.innerHTML = `
            <div class="flex flex-col items-center">
              <div id="demo-path-grid" class="grid grid-cols-5 gap-2 bg-slate-900/90 p-3 rounded-2xl border border-slate-700/80 shadow-2xl"></div>
              <div id="demo-path-status" class="mt-3 text-sm text-cyan-300 font-semibold h-6">Find the key and reach the goal!</div>
            </div>
          `;
          renderDemoPathGrid(stageEl, { x: 0, y: 0 }, { x: 2, y: 2 }, { x: 4, y: 4 }, false, [[true, false, false, false, false]]);
          audio.playTone(440, 'sine', 0.2);
        }
      },
      {
        title: "Controls Sequence: UP → LEFT → RIGHT → DOWN",
        voiceText: "Watch the movement controls: Press UP to move up, LEFT to move left, RIGHT to move right, and DOWN to move down. Safe tiles light up green as you navigate.",
        captionText: "Simulating button presses in sequence: <strong class='text-cyan-400'>UP</strong> ➔ <strong class='text-cyan-400'>LEFT</strong> ➔ <strong class='text-cyan-400'>RIGHT</strong> ➔ <strong class='text-cyan-400'>DOWN</strong> with real player movement!",
        autoAdvanceDelay: 2600,
        onEnter: (stageEl, demo, audio) => {
          stageEl.innerHTML = `
            <div class="flex flex-col md:flex-row items-center justify-center gap-6 w-full max-w-xl">
              <!-- Grid Area -->
              <div class="flex flex-col items-center">
                <div id="demo-path-grid" class="grid grid-cols-5 gap-1.5 bg-slate-900/90 p-2.5 rounded-2xl border border-slate-700/80 shadow-2xl"></div>
                <div id="demo-path-status" class="mt-2 text-xs text-cyan-300 font-semibold h-5">Pressing controls...</div>
              </div>

              <!-- Visible D-Pad Controller with UP, LEFT, RIGHT, DOWN -->
              <div class="demo-dpad-container">
                <div class="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Directional Controls</div>
                <button type="button" id="demo-key-up" class="demo-key-btn">
                  <span class="key-arrow">▲</span>
                  <span class="key-sub">UP</span>
                </button>
                <div class="demo-dpad-row">
                  <button type="button" id="demo-key-left" class="demo-key-btn">
                    <span class="key-arrow">◀</span>
                    <span class="key-sub">LEFT</span>
                  </button>
                  <button type="button" id="demo-key-right" class="demo-key-btn">
                    <span class="key-arrow">▶</span>
                    <span class="key-sub">RIGHT</span>
                  </button>
                </div>
                <button type="button" id="demo-key-down" class="demo-key-btn">
                  <span class="key-arrow">▼</span>
                  <span class="key-sub">DOWN</span>
                </button>
              </div>
            </div>
          `;

          // Start player at (1, 1) so it has valid room for UP, LEFT, RIGHT, DOWN
          const visited = Array.from({ length: 5 }, () => Array(5).fill(false));
          visited[1][1] = true;
          renderDemoPathGrid(stageEl, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 4, y: 4 }, false, visited);

          const btnUp = stageEl.querySelector('#demo-key-up');
          const btnLeft = stageEl.querySelector('#demo-key-left');
          const btnRight = stageEl.querySelector('#demo-key-right');
          const btnDown = stageEl.querySelector('#demo-key-down');
          const status = stageEl.querySelector('#demo-path-status');

          // 1. Move UP: (1, 1) -> (1, 0)
          demo.registerTimeout(() => {
            demo.moveCursorTo(btnUp, {
              click: true,
              delay: 300,
              clickSound: () => audio.playStep(),
              onClick: () => {
                btnUp.classList.add('pressed');
                visited[0][1] = true;
                renderDemoPathGrid(stageEl, { x: 1, y: 0 }, { x: 2, y: 2 }, { x: 4, y: 4 }, false, visited);
                if (status) status.innerHTML = `<span class="text-cyan-400 font-bold">Pressed UP ⬆️ • Moved to (1, 0)</span>`;
                setTimeout(() => btnUp.classList.remove('pressed'), 250);
              }
            });
          }, 600);

          // 2. Move LEFT: (1, 0) -> (0, 0)
          demo.registerTimeout(() => {
            demo.moveCursorTo(btnLeft, {
              click: true,
              delay: 300,
              clickSound: () => audio.playStep(),
              onClick: () => {
                btnLeft.classList.add('pressed');
                visited[0][0] = true;
                renderDemoPathGrid(stageEl, { x: 0, y: 0 }, { x: 2, y: 2 }, { x: 4, y: 4 }, false, visited);
                if (status) status.innerHTML = `<span class="text-cyan-400 font-bold">Pressed LEFT ⬅️ • Moved to (0, 0)</span>`;
                setTimeout(() => btnLeft.classList.remove('pressed'), 250);
              }
            });
          }, 1600);

          // 3. Move RIGHT: (0, 0) -> (1, 0)
          demo.registerTimeout(() => {
            demo.moveCursorTo(btnRight, {
              click: true,
              delay: 300,
              clickSound: () => audio.playStep(),
              onClick: () => {
                btnRight.classList.add('pressed');
                renderDemoPathGrid(stageEl, { x: 1, y: 0 }, { x: 2, y: 2 }, { x: 4, y: 4 }, false, visited);
                if (status) status.innerHTML = `<span class="text-cyan-400 font-bold">Pressed RIGHT ➡️ • Moved to (1, 0)</span>`;
                setTimeout(() => btnRight.classList.remove('pressed'), 250);
              }
            });
          }, 2600);

          // 4. Move DOWN: (1, 0) -> (1, 1)
          demo.registerTimeout(() => {
            demo.moveCursorTo(btnDown, {
              click: true,
              delay: 300,
              clickSound: () => audio.playStep(),
              onClick: () => {
                btnDown.classList.add('pressed');
                renderDemoPathGrid(stageEl, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 4, y: 4 }, false, visited);
                if (status) status.innerHTML = `<span class="text-emerald-400 font-bold">Pressed DOWN ⬇️ • Returned to (1, 1)</span>`;
                setTimeout(() => btnDown.classList.remove('pressed'), 250);
              }
            });
          }, 3600);
        }
      },
      {
        title: "Beware of Hidden Walls!",
        voiceText: "Watch out! The maze has invisible hidden walls. Stepping on a wall flashes red and resets you to the start! Remember where the wall was so you do not hit it again.",
        captionText: "⚠️ <strong class='text-rose-400'>Invisible Walls:</strong> When you hit a hidden wall, the screen flashes red and you return to start. <strong class='text-yellow-300'>Memorize its position!</strong>",
        autoAdvanceDelay: 2800,
        onEnter: (stageEl, demo, audio) => {
          stageEl.innerHTML = `
            <div class="flex flex-col items-center">
              <div id="demo-path-grid" class="grid grid-cols-5 gap-2 bg-slate-900/90 p-3 rounded-2xl border border-slate-700/80 shadow-2xl"></div>
              <div id="demo-path-status" class="mt-3 text-sm text-cyan-300 font-semibold h-6">Attempting step...</div>
            </div>
          `;
          renderDemoPathGrid(stageEl, { x: 1, y: 0 }, { x: 2, y: 2 }, { x: 4, y: 4 }, false, [[true, true, false, false, false]]);
          const grid = stageEl.querySelector('#demo-path-grid');
          const status = stageEl.querySelector('#demo-path-status');
          if (!grid) return;

          demo.registerTimeout(() => {
            const wallCell = grid.children[2]; // (2, 0)
            demo.moveCursorTo(wallCell, {
              click: true,
              onClick: () => {
                wallCell.classList.add('bg-red-600', 'animate-pulse');
                wallCell.textContent = '❌';
                audio.playWallHit();
                if (status) status.innerHTML = `<span class="text-rose-400 font-bold">⚠️ Hit a hidden wall at (2, 0)! Resetting to start...</span>`;

                demo.registerTimeout(() => {
                  renderDemoPathGrid(stageEl, { x: 0, y: 0 }, { x: 2, y: 2 }, { x: 4, y: 4 }, false, [[true, false, false, false, false]]);
                  if (status) status.innerHTML = `<span class="text-amber-300">Remember: (2, 0) is blocked! Take a detour around it.</span>`;
                }, 1000);
              }
            });
          }, 700);
        }
      },
      {
        title: "Reroute & Collect the Key",
        voiceText: "Now take the open path around the wall. Step onto the golden key to unlock the exit goal.",
        captionText: "Take the detour down, navigate to <strong class='text-yellow-400'>Key 🔑</strong>. Once collected, <strong class='text-emerald-400'>Key Collected: Yes</strong> illuminates!",
        autoAdvanceDelay: 2600,
        onEnter: (stageEl, demo, audio) => {
          stageEl.innerHTML = `
            <div class="flex flex-col items-center">
              <div id="demo-path-grid" class="grid grid-cols-5 gap-2 bg-slate-900/90 p-3 rounded-2xl border border-slate-700/80 shadow-2xl"></div>
              <div id="demo-path-status" class="mt-3 text-sm text-cyan-300 font-semibold h-6">Navigating around wall...</div>
            </div>
          `;
          const grid = stageEl.querySelector('#demo-path-grid');
          const status = stageEl.querySelector('#demo-path-status');
          if (!grid) return;

          const visited = Array.from({ length: 5 }, () => Array(5).fill(false));
          visited[0][0] = true; visited[1][0] = true; visited[1][1] = true; visited[1][2] = true; visited[2][2] = true;

          demo.registerTimeout(() => {
            renderDemoPathGrid(stageEl, { x: 2, y: 2 }, { x: 2, y: 2 }, { x: 4, y: 4 }, true, visited);
            audio.playKeyCollected();
            if (status) status.innerHTML = `<span class="text-yellow-400 font-bold">🔑 You found the key! Now head to the goal flag!</span>`;
            const keyCell = grid.children[2 * 5 + 2];
            demo.moveCursorTo(keyCell);
          }, 800);
        }
      },
      {
        title: "Reach the Goal & Win!",
        voiceText: "With key in hand, follow the safe path to the goal flag. You are ready to play!",
        captionText: "Reach the <strong class='text-purple-400'>Goal 🏁</strong> with the key to complete the assessment. You can replay the walkthrough or start playing now!",
        autoAdvanceDelay: 2800,
        onEnter: (stageEl, demo, audio) => {
          stageEl.innerHTML = `
            <div class="flex flex-col items-center">
              <div id="demo-path-grid" class="grid grid-cols-5 gap-2 bg-slate-900/90 p-3 rounded-2xl border border-slate-700/80 shadow-2xl"></div>
              <div id="demo-path-status" class="mt-3 text-sm text-cyan-300 font-semibold h-6">Reaching goal flag...</div>
            </div>
          `;
          const grid = stageEl.querySelector('#demo-path-grid');
          const status = stageEl.querySelector('#demo-path-status');
          if (!grid) return;

          const visited = Array.from({ length: 5 }, () => Array(5).fill(false));
          visited[0][0] = true; visited[1][0] = true; visited[1][1] = true; visited[1][2] = true;
          visited[2][2] = true; visited[2][3] = true; visited[3][3] = true; visited[4][3] = true; visited[4][4] = true;

          demo.registerTimeout(() => {
            renderDemoPathGrid(stageEl, { x: 4, y: 4 }, { x: 2, y: 2 }, { x: 4, y: 4 }, true, visited);
            audio.playSuccess();
            if (status) status.innerHTML = `<span class="text-emerald-400 font-bold">🎉 Level Completed! Excellent memory!</span>`;
            const goalCell = grid.children[4 * 5 + 4];
            goalCell.classList.add('bg-emerald-500', 'animate-pulse');
            demo.moveCursorTo(goalCell);
          }, 800);
        }
      }
    ];

    function renderDemoPathGrid(stageEl, player, keyPos, goal, hasKey, visited) {
      const grid = stageEl.querySelector('#demo-path-grid');
      if (!grid) return;
      grid.innerHTML = '';
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          const cell = document.createElement('div');
          const isPlayer = player.x === x && player.y === y;
          const isKey = keyPos.x === x && keyPos.y === y && !hasKey;
          const isGoal = goal.x === x && goal.y === y;
          const isVisited = visited && visited[y] && visited[y][x];

          let bg = 'bg-slate-800/90 border border-slate-700/50';
          if (isPlayer) bg = 'bg-sky-500 ring-2 ring-cyan-300 animate-pulse shadow-lg shadow-sky-500/40';
          else if (isKey) bg = 'bg-amber-400 ring-2 ring-yellow-300 shadow-lg shadow-amber-400/30';
          else if (isGoal) bg = 'bg-purple-600 ring-2 ring-purple-400 shadow-lg shadow-purple-600/30';
          else if (isVisited) bg = 'bg-emerald-700/80 border border-emerald-600/40';

          cell.className = `w-11 h-11 rounded-xl flex items-center justify-center text-white text-base font-bold transition-all duration-200 ${bg}`;
          cell.textContent = isPlayer ? 'P' : isKey ? '🔑' : isGoal ? '🏁' : '';
          grid.appendChild(cell);
        }
      }
    }

    return new GameDemoController({
      gameId: 'path-finder',
      gameTitle: 'Dynamic Memory Path',
      badge: 'Interactive Navigation Guide',
      steps,
      onSkip: callbacks.onSkip || (() => {}),
      onComplete: callbacks.onComplete || (() => {})
    });
  };

  // --- GAME 2: MATH BUBBLE SORT DEMO BUILDER ---
  window.initBubbleGameDemo = function (callbacks = {}) {
    const steps = [
      {
        title: "Mental Math: Calculate Values",
        voiceText: "Welcome to Math Bubble Sort! Quick mental math is the secret. Calculate the numerical value of each bubble in your head.",
        captionText: "Evaluate each arithmetic expression: e.g. <strong class='text-cyan-400'>18 / 6 = 3</strong>, <strong class='text-cyan-400'>14 - 9 = 5</strong>, and <strong class='text-cyan-400'>4 * 2 = 8</strong>.",
        autoAdvanceDelay: 2500,
        onEnter: (stageEl, demo, audio) => {
          stageEl.innerHTML = `
            <div class="flex flex-col items-center gap-6">
              <div class="text-xs text-slate-400 font-medium">Question 1 of 25 • Timer: 10.0s</div>
              <div id="demo-bubbles-row" class="flex gap-6 justify-center min-h-[130px]"></div>
              <div id="demo-bubble-msg" class="text-base text-cyan-300 font-semibold h-6">Calculate each expression...</div>
            </div>
          `;
          renderDemoBubbles(stageEl, [
            { expr: '14 - 9', val: 5, state: 'initial' },
            { expr: '18 / 6', val: 3, state: 'initial' },
            { expr: '4 * 2', val: 8, state: 'initial' }
          ], true);
          audio.playTone(523.25, 'sine', 0.2);
        }
      },
      {
        title: "Ascending Order: Low to High",
        voiceText: "Your objective is to click the bubbles in ascending order: from lowest numerical value to highest, before time runs out.",
        captionText: "Sort in <strong class='text-cyan-400'>ascending order</strong> (smallest ➡️ largest): <span class='text-emerald-400 font-bold'>3</span> then <span class='text-cyan-400 font-bold'>5</span> then <span class='text-purple-400 font-bold'>8</span>.",
        autoAdvanceDelay: 2400,
        onEnter: (stageEl, demo, audio) => {
          const msg = stageEl.querySelector('#demo-bubble-msg');
          if (msg) msg.textContent = 'Correct sequence: (18 / 6 = 3) ➡️ (14 - 9 = 5) ➡️ (4 * 2 = 8)';
        }
      },
      {
        title: "The Hurdle: Out-of-Order Mistake!",
        voiceText: "Beware of clicking out of order! If you click a larger bubble before a smaller one, you get an error buzzer and lose precious seconds.",
        captionText: "⚠️ <strong class='text-rose-400'>The Hurdle:</strong> Clicking <strong class='text-purple-300'>4 * 2 (= 8)</strong> first triggers an error buzz and resets the question! Always begin with the lowest value.",
        autoAdvanceDelay: 2800,
        onEnter: (stageEl, demo, audio) => {
          const row = stageEl.querySelector('#demo-bubbles-row');
          const msg = stageEl.querySelector('#demo-bubble-msg');
          if (!row) return;
          const bubble2 = row.children[2]; // the "8" bubble

          demo.registerTimeout(() => {
            demo.moveCursorTo(bubble2, {
              click: true,
              delay: 350,
              onClick: () => {
                bubble2.classList.remove('bg-blue-600');
                bubble2.classList.add('bg-rose-600', 'animate-pulse');
                audio.playBuzzer();
                if (msg) msg.innerHTML = `<span class="text-rose-400 font-bold">❌ Error: 8 is not the smallest! Penalty applied.</span>`;

                demo.registerTimeout(() => {
                  bubble2.classList.remove('bg-rose-600', 'animate-pulse');
                  bubble2.classList.add('bg-blue-600');
                  if (msg) msg.innerHTML = `<span class="text-cyan-300">Start over: select the true smallest value (3).</span>`;
                }, 1200);
              }
            });
          }, 400);
        }
      },
      {
        title: "Clicking 1st: Smallest Value (3)",
        voiceText: "Now do it correctly: First select the smallest value: eighteen divided by six equals three.",
        captionText: "Click #1: <strong class='text-purple-400'>18 / 6 (= 3)</strong>. The bubble turns purple upon selection.",
        autoAdvanceDelay: 2000,
        onEnter: (stageEl, demo, audio) => {
          const row = stageEl.querySelector('#demo-bubbles-row');
          if (!row) return;
          const bubble1 = row.children[1];
          demo.registerTimeout(() => {
            demo.moveCursorTo(bubble1, {
              click: true,
              delay: 350,
              clickSound: () => audio.playBubblePop(1),
              onClick: () => {
                bubble1.classList.remove('bg-blue-600');
                bubble1.classList.add('bg-purple-600', 'scale-105');
              }
            });
          }, 300);
        }
      },
      {
        title: "Clicking 2nd & 3rd: Middle & Largest",
        voiceText: "Next select fourteen minus nine equals five, then four times two equals eight.",
        captionText: "Click #2: <strong class='text-purple-400'>14 - 9 (= 5)</strong>, then Click #3: <strong class='text-purple-400'>4 * 2 (= 8)</strong>.",
        autoAdvanceDelay: 2500,
        onEnter: (stageEl, demo, audio) => {
          const row = stageEl.querySelector('#demo-bubbles-row');
          if (!row) return;
          const bubble0 = row.children[0];
          const bubble2 = row.children[2];

          demo.registerTimeout(() => {
            demo.moveCursorTo(bubble0, {
              click: true,
              delay: 300,
              clickSound: () => audio.playBubblePop(2),
              onClick: () => {
                bubble0.classList.remove('bg-blue-600');
                bubble0.classList.add('bg-purple-600', 'scale-105');
              }
            });
          }, 300);

          demo.registerTimeout(() => {
            demo.moveCursorTo(bubble2, {
              click: true,
              delay: 300,
              clickSound: () => audio.playBubblePop(3),
              onClick: () => {
                bubble2.classList.remove('bg-blue-600');
                bubble2.classList.add('bg-purple-600', 'scale-105');
              }
            });
          }, 1100);
        }
      },
      {
        title: "Instant Feedback & Victory Score",
        voiceText: "When all three are in correct order, you earn a point and advance to the next level. Be quick — you have ten seconds per question!",
        captionText: "🎉 <strong class='text-emerald-400'>Correct!</strong> Bubbles flash green and you advance immediately. Watch the 10-second timer!",
        autoAdvanceDelay: 2600,
        onEnter: (stageEl, demo, audio) => {
          const row = stageEl.querySelector('#demo-bubbles-row');
          const msg = stageEl.querySelector('#demo-bubble-msg');
          if (!row) return;

          demo.registerTimeout(() => {
            Array.from(row.children).forEach(b => {
              b.className = 'w-24 h-24 rounded-full flex flex-col items-center justify-center font-bold text-white shadow-lg bg-emerald-500 scale-105 transition-all duration-300';
            });
            audio.playSuccess();
            if (msg) msg.innerHTML = `<span class="text-emerald-400 font-bold text-lg">✨ Correct! +1 Point. Next question loaded.</span>`;
          }, 500);
        }
      }
    ];

    function renderDemoBubbles(stageEl, bubblesData, showHints) {
      const row = stageEl.querySelector('#demo-bubbles-row');
      if (!row) return;
      row.innerHTML = '';
      bubblesData.forEach(b => {
        const div = document.createElement('div');
        div.className = 'w-24 h-24 rounded-full flex flex-col items-center justify-center font-bold text-white shadow-lg bg-blue-600 transition-all duration-300 cursor-pointer';
        div.innerHTML = `
          <div class="text-sm font-semibold">${b.expr}</div>
          ${showHints ? `<div class="text-[10px] text-cyan-200 mt-1 px-1.5 py-0.5 bg-black/40 rounded">= ${b.val}</div>` : ''}
        `;
        row.appendChild(div);
      });
    }

    return new GameDemoController({
      gameId: 'bubble-sort',
      gameTitle: 'Math Bubble Sort',
      badge: 'Speed Math Guide',
      steps,
      onSkip: callbacks.onSkip || (() => {}),
      onComplete: callbacks.onComplete || (() => {})
    });
  };

  // --- GAME 3: PATHFINDER MOUSE DEMO BUILDER ---
  window.initTileGameDemo = function (callbacks = {}) {
    const steps = [
      {
        title: "Objective: Guide Mouse to Cheese",
        voiceText: "Welcome to PathFinder Mouse! Your mission is to construct an unbroken, continuous track that allows the mouse to travel all the way to the cheese.",
        captionText: "Guide the <strong class='text-emerald-400'>Mouse 🐭</strong> at the entrance to the <strong class='text-amber-400'>Cheese 🧀</strong> at the exit by aligning tiles and arrow flow.",
        autoAdvanceDelay: 2500,
        onEnter: (stageEl, demo, audio) => {
          stageEl.innerHTML = `
            <div class="flex flex-col items-center">
              <div class="flex items-center gap-3 mb-2">
                <div class="px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-semibold text-xs flex items-center gap-1.5 shadow">
                  <span>🐭</span> Mouse Entrance
                </div>
                <div class="text-slate-500 text-xs">➡️ Continuous Route ➡️</div>
                <div class="px-2.5 py-1 rounded-lg bg-amber-950/80 border border-amber-500/50 text-amber-300 font-semibold text-xs flex items-center gap-1.5 shadow">
                  <span>🧀</span> Cheese Goal
                </div>
              </div>
              <div id="demo-tile-grid" class="grid grid-cols-3 gap-2 bg-slate-900/90 p-3 rounded-2xl border-2 border-cyan-500/30 shadow-2xl"></div>
              <div class="flex gap-2.5 mt-3">
                <button type="button" id="demo-rot-btn" class="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1 shadow">↻ Rotate [R]</button>
                <button type="button" id="demo-flow-btn" class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 shadow">⇄ Change Path [C]</button>
                <button type="button" id="demo-chk-btn" class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 shadow">✓ Check Path</button>
              </div>
              <div id="demo-tile-status" class="mt-2 text-xs text-cyan-300 h-5 font-medium">Click any tile to select it</div>
            </div>
          `;
          renderDemoTileGrid(stageEl, 'unaligned');
          audio.playTone(587.33, 'sine', 0.2);
        }
      },
      {
        title: "Rule 1: Rotate Tile Geometry [R]",
        voiceText: "Click on any tile to select it, then press Rotate or hit R on your keyboard to turn the tile 90 degrees.",
        captionText: "Click the middle tile, then click <strong class='text-sky-400'>Rotate [R]</strong> to turn the track geometry.",
        autoAdvanceDelay: 2500,
        onEnter: (stageEl, demo, audio) => {
          const grid = stageEl.querySelector('#demo-tile-grid');
          const rotBtn = stageEl.querySelector('#demo-rot-btn');
          const status = stageEl.querySelector('#demo-tile-status');
          if (!grid || !rotBtn) return;
          const centerTile = grid.children[4];

          demo.registerTimeout(() => {
            demo.moveCursorTo(centerTile, {
              click: true,
              delay: 350,
              clickSound: () => audio.playStep(),
              onClick: () => {
                centerTile.classList.add('ring-4', 'ring-cyan-400', 'scale-105');
                if (status) status.innerHTML = `<span class="text-cyan-300">Tile selected! Rotating...</span>`;

                demo.registerTimeout(() => {
                  demo.moveCursorTo(rotBtn, {
                    click: true,
                    delay: 350,
                    clickSound: () => audio.playTileRotate(),
                    onClick: () => {
                      // Aligns physically, but arrows face WRONG direction!
                      renderDemoTileGrid(stageEl, 'wrong_flow');
                      if (status) status.innerHTML = `<span class="text-amber-300">Physically touching, but notice the arrows!</span>`;
                    }
                  });
                }, 700);
              }
            });
          }, 300);
        }
      },
      {
        title: "The Critical Hurdle: Arrow Direction [C]!",
        voiceText: "Important rule! Look closely at the arrows inside the track. If the arrows point backward or against the mouse, the flow is blocked! You must click Change Path, or press C, to reverse the flow.",
        captionText: "⚠️ <strong class='text-rose-400'>The Critical Hurdle:</strong> Red junction ❌! Track lines touch, but <strong class='text-amber-300'>arrows point backwards</strong> against the mouse. Click <strong class='text-emerald-400'>Change Path [C]</strong> to flip flow direction!",
        autoAdvanceDelay: 3200,
        onEnter: (stageEl, demo, audio) => {
          const flowBtn = stageEl.querySelector('#demo-flow-btn');
          const status = stageEl.querySelector('#demo-tile-status');
          const grid = stageEl.querySelector('#demo-tile-grid');
          if (!flowBtn || !grid) return;

          demo.registerTimeout(() => {
            demo.moveCursorTo(flowBtn, {
              click: true,
              delay: 450,
              clickSound: () => audio.playTileRotate(),
              onClick: () => {
                // Flips arrow direction to point towards cheese!
                renderDemoTileGrid(stageEl, 'aligned_forward');
                audio.playPathConnect();
                if (status) status.innerHTML = `<span class="text-emerald-400 font-bold">✨ Flow Reversed! Arrows point towards the Cheese!</span>`;
              }
            });
          }, 800);
        }
      },
      {
        title: "Check Path & Win the Game!",
        voiceText: "When the entire route from mouse to cheese is connected with matching arrows, click Check Path! If you ever get stuck, click Show Answer to see the solution.",
        captionText: "Click <strong class='text-indigo-400'>Check Path</strong> to verify. The continuous route pulses with green victory lights! Need help? Use <strong class='text-cyan-400'>Show Answer 💡</strong>.",
        autoAdvanceDelay: 2800,
        onEnter: (stageEl, demo, audio) => {
          const chkBtn = stageEl.querySelector('#demo-chk-btn');
          const grid = stageEl.querySelector('#demo-tile-grid');
          const status = stageEl.querySelector('#demo-tile-status');
          if (!chkBtn || !grid) return;

          demo.registerTimeout(() => {
            demo.moveCursorTo(chkBtn, {
              click: true,
              delay: 400,
              onClick: () => {
                [0, 1, 4, 7, 8].forEach(idx => {
                  if (grid.children[idx]) {
                    grid.children[idx].classList.add('bg-emerald-500/80', 'animate-pulse');
                  }
                });
                audio.playSuccess();
                if (status) status.innerHTML = `<span class="text-emerald-300 font-bold text-sm">🎉 Path Verified! Mouse reached the Cheese!</span>`;
              }
            });
          }, 400);
        }
      }
    ];

    function renderDemoTileGrid(stageEl, state) {
      const grid = stageEl.querySelector('#demo-tile-grid');
      if (!grid) return;
      grid.innerHTML = '';

      for (let i = 0; i < 9; i++) {
        const tile = document.createElement('div');
        const isStart = i === 0;
        const isCenter = i === 4;
        const isEnd = i === 8;

        let bg = 'bg-slate-800/90 border border-slate-700/60';
        if (isStart) bg = 'bg-emerald-950/80 border border-emerald-500/50 shadow-emerald-500/20';
        else if (isEnd) bg = 'bg-amber-950/80 border border-amber-500/50 shadow-amber-500/20';
        else if (isCenter) bg = 'bg-slate-800 border-2 border-cyan-400/60 shadow-lg';

        tile.className = `w-14 h-14 rounded-xl flex items-center justify-center relative shadow-md transition-all duration-300 ${bg}`;

        if (isStart) {
          // Tile 0: Mouse Entrance with track exiting RIGHT (H100)
          tile.innerHTML = `
            <div class="flex items-center justify-center relative w-full h-full">
              <span class="text-lg absolute left-1 z-10">🐭</span>
              <svg class="w-full h-full" viewBox="0 0 100 100">
                <path d="M40 50 H100" stroke="#34d399" stroke-width="16" stroke-linecap="round" fill="none"/>
                <polygon points="85,50 70,42 70,58" fill="#ecfdf5" stroke="#10b981" stroke-width="2"/>
              </svg>
            </div>
          `;
        } else if (i === 1) {
          // Tile 1: Corner track from LEFT (0, 50) turning DOWN (50, 100) into Tile 4
          tile.innerHTML = `
            <svg class="w-full h-full" viewBox="0 0 100 100">
              <path d="M0 50 H50 V100" stroke="#38bdf8" stroke-width="16" stroke-linecap="round" fill="none"/>
              <polygon points="50,85 42,70 58,70" fill="#e0f2fe" stroke="#38bdf8" stroke-width="2"/>
            </svg>
          `;
        } else if (isCenter) {
          // Tile 4: Active test tile! Connects Tile 1 (top: 50, 0) to Tile 7 (bottom: 50, 100)
          if (state === 'unaligned') {
            // Horizontal: disconnected from top & bottom
            tile.innerHTML = `
              <svg class="w-full h-full" viewBox="0 0 100 100">
                <path d="M0 50 H100" stroke="#64748b" stroke-width="16" stroke-linecap="round" fill="none"/>
                <polygon points="65,50 50,42 50,58" fill="#94a3b8" stroke="#475569" stroke-width="2"/>
              </svg>
              <div class="absolute inset-0 border border-slate-600 rounded-xl pointer-events-none"></div>
            `;
          } else if (state === 'wrong_flow') {
            // Vertical, but arrow points UP ⬆️ towards mouse (WRONG FLOW ❌)
            tile.innerHTML = `
              <svg class="w-full h-full" viewBox="0 0 100 100">
                <path d="M50 0 V100" stroke="#f87171" stroke-width="16" stroke-linecap="round" fill="none"/>
                <polygon points="50,35 42,50 58,50" fill="#fecaca" stroke="#dc2626" stroke-width="2"/>
                <circle cx="50" cy="8" r="6" fill="#ef4444"/>
              </svg>
              <div class="absolute inset-0 border-2 border-rose-500 rounded-xl pointer-events-none animate-pulse"></div>
            `;
          } else {
            // Vertical, arrow points DOWN ⬇️ towards Tile 7 & Cheese (ALIGNED FORWARD ✅)
            tile.innerHTML = `
              <svg class="w-full h-full" viewBox="0 0 100 100">
                <path d="M50 0 V100" stroke="#34d399" stroke-width="16" stroke-linecap="round" fill="none"/>
                <polygon points="50,65 42,50 58,50" fill="#ecfdf5" stroke="#10b981" stroke-width="2"/>
                <circle cx="50" cy="92" r="6" fill="#34d399"/>
              </svg>
              <div class="absolute inset-0 border-2 border-emerald-400 rounded-xl pointer-events-none"></div>
            `;
          }
        } else if (i === 7) {
          // Tile 7: Corner track from TOP (50, 0) turning RIGHT (100, 50) into Tile 8
          tile.innerHTML = `
            <svg class="w-full h-full" viewBox="0 0 100 100">
              <path d="M50 0 V50 H100" stroke="#38bdf8" stroke-width="16" stroke-linecap="round" fill="none"/>
              <polygon points="85,50 70,42 70,58" fill="#e0f2fe" stroke="#38bdf8" stroke-width="2"/>
            </svg>
          `;
        } else if (isEnd) {
          // Tile 8: Cheese Goal, track enters from LEFT (0, 50) to Cheese
          tile.innerHTML = `
            <div class="flex items-center justify-center relative w-full h-full">
              <svg class="w-full h-full" viewBox="0 0 100 100">
                <path d="M0 50 H60" stroke="#fbbf24" stroke-width="16" stroke-linecap="round" fill="none"/>
                <polygon points="45,50 32,42 32,58" fill="#fef3c7" stroke="#d97706" stroke-width="2"/>
              </svg>
              <span class="text-lg absolute right-1 z-10">🧀</span>
            </div>
          `;
        } else {
          // Inactive background cells
          tile.innerHTML = `
            <svg class="w-full h-full" viewBox="0 0 100 100">
              <path d="M50 20 V80" stroke="#1e293b" stroke-width="10" stroke-linecap="round" fill="none"/>
            </svg>
          `;
        }

        grid.appendChild(tile);
      }
    }

    return new GameDemoController({
      gameId: 'tile-maze',
      gameTitle: 'PathFinder Mouse Game',
      badge: 'Directional Path Guide',
      steps,
      onSkip: callbacks.onSkip || (() => {}),
      onComplete: callbacks.onComplete || (() => {})
    });
  };

  // --- CROSS-FRAME / POPUP NEW GAME CHANCE BRIDGE ---
  window.requestNewGameSession = function (gameId, onGranted, onDenied) {
    const parentOrOpener = (window.parent && window.parent !== window) ? window.parent : ((window.opener && !window.opener.closed) ? window.opener : null);
    if (parentOrOpener) {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          window.removeEventListener('message', msgHandler);
          // Do not allow unauthenticated/unconnected play
          onDenied && onDenied({ message: 'Session connection timed out. Please play from your logged-in dashboard.' });
        }
      }, 2000);

      const msgHandler = (e) => {
        if (!e.data || typeof e.data !== 'object') return;
        if (e.data.type === 'NEW_GAME_AUTHORIZED') {
          resolved = true;
          clearTimeout(timeout);
          window.removeEventListener('message', msgHandler);
          onGranted && onGranted(e.data);
        } else if (e.data.type === 'NEW_GAME_DENIED') {
          resolved = true;
          clearTimeout(timeout);
          window.removeEventListener('message', msgHandler);
          onDenied && onDenied(e.data);
        }
      };

      window.addEventListener('message', msgHandler);
      parentOrOpener.postMessage({ type: 'REQUEST_NEW_GAME', gameId }, '*');
    } else {
      // Standalone mode: strictly require logged in parent dashboard
      onDenied && onDenied({ message: 'Please sign in and launch this assessment from your dashboard.' });
    }
  };

  // Check query param (?demo=1) on page load
  window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === '1' || params.get('demo') === 'true' || window.location.hash === '#demo') {
      setTimeout(() => {
        const demoBtn = document.getElementById('watch-demo-header-btn');
        if (demoBtn) demoBtn.click();
      }, 300);
    }
  });

})();

