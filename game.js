/* ===================================================================
   JEN RUSH - 2D Neon Arcade Browser Game v2.0
   Created by: JEN
   =================================================================== */

// Wait for the HTML document to fully load before initializing
window.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. CANVAS & CONTEXT INITIALIZATION ---
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // Virtual Game Resolution (Logical canvas dimensions)
    const CANVAS_WIDTH = 800;
    const CANVAS_HEIGHT = 600;

    // --- 2. DOM ELEMENTS (UI Overlays & Buttons) ---
    const soundBtn = document.getElementById('sound-btn');
    const soundIcon = document.getElementById('sound-icon');
    
    const hudOverlay = document.getElementById('hud-overlay');
    const hudScoreCard = document.getElementById('hud-score-card');
    const hudCoinCard = document.getElementById('hud-coin-card');
    const scoreVal = document.getElementById('score-val');
    const coinVal = document.getElementById('coin-val');
    const bestVal = document.getElementById('best-val');
    const pauseBtn = document.getElementById('pause-btn');

    const startScreen = document.getElementById('start-screen');
    const startBestScore = document.getElementById('start-best-score');
    const playBtn = document.getElementById('play-btn');
    const howToBtn = document.getElementById('how-to-btn');

    const pauseScreen = document.getElementById('pause-screen');
    const resumeBtn = document.getElementById('resume-btn');
    const restartPauseBtn = document.getElementById('restart-pause-btn');

    const gameoverScreen = document.getElementById('gameover-screen');
    const finalScore = document.getElementById('final-score');
    const finalCoins = document.getElementById('final-coins');
    const finalBest = document.getElementById('final-best');
    const newRecordBanner = document.getElementById('new-record-banner');
    const restartBtn = document.getElementById('restart-btn');
    const menuBtn = document.getElementById('menu-btn');

    const instructionsModal = document.getElementById('instructions-modal');
    const closeInstructionsBtn = document.getElementById('close-instructions-btn');

    // Mobile D-Pad Buttons
    const btnUp = document.getElementById('btn-up');
    const btnDown = document.getElementById('btn-down');
    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');

    // --- 3. AUDIO SYNTHESIZER ENGINE (Web Audio API) ---
    class SoundEngine {
        constructor() {
            this.ctx = null;
            this.isMuted = localStorage.getItem('jen_rush_muted') === 'true';
        }

        init() {
            if (!this.ctx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) {
                    this.ctx = new AudioCtx();
                }
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        }

        playTone(freq, type, duration, startVol = 0.2, endVol = 0.01) {
            if (this.isMuted) return;
            this.init();
            if (!this.ctx) return;
            try {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                
                osc.type = type;
                osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
                
                gain.gain.setValueAtTime(startVol, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(endVol, this.ctx.currentTime + duration);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start();
                osc.stop(this.ctx.currentTime + duration);
            } catch (e) {}
        }

        playCoin() {
            if (this.isMuted) return;
            this.init();
            this.playTone(987.77, 'sine', 0.08, 0.2, 0.01); // B5 note
            setTimeout(() => this.playTone(1318.51, 'sine', 0.14, 0.2, 0.01), 60); // E6 note
        }

        playPowerup() {
            if (this.isMuted) return;
            this.init();
            [440, 554, 659, 880].forEach((freq, idx) => {
                setTimeout(() => this.playTone(freq, 'triangle', 0.1, 0.18, 0.01), idx * 45);
            });
        }

        playExplosion() {
            if (this.isMuted) return;
            this.init();
            if (!this.ctx) return;
            try {
                const bufferSize = this.ctx.sampleRate * 0.35;
                const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }

                const noise = this.ctx.createBufferSource();
                noise.buffer = buffer;

                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(700, this.ctx.currentTime);
                filter.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.35);

                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(this.ctx.destination);

                noise.start();
            } catch (e) {}
        }

        playClick() {
            if (this.isMuted) return;
            this.init();
            this.playTone(580, 'square', 0.04, 0.12, 0.01);
        }

        toggleMute() {
            this.isMuted = !this.isMuted;
            localStorage.setItem('jen_rush_muted', this.isMuted.toString());
            return this.isMuted;
        }
    }

    const sound = new SoundEngine();
    soundIcon.textContent = sound.isMuted ? '🔇' : '🔊';

    // Auto-initialize audio context on first user click/touch anywhere
    function enableAudioOnGesture() {
        sound.init();
        window.removeEventListener('click', enableAudioOnGesture);
        window.removeEventListener('touchstart', enableAudioOnGesture);
        window.removeEventListener('keydown', enableAudioOnGesture);
    }
    window.addEventListener('click', enableAudioOnGesture);
    window.addEventListener('touchstart', enableAudioOnGesture);
    window.addEventListener('keydown', enableAudioOnGesture);

    // --- 4. GAME STATE VARIABLES ---
    const STATES = { MENU: 0, PLAYING: 1, PAUSED: 2, GAMEOVER: 3 };
    let gameState = STATES.MENU;

    let score = 0;
    let coinsCollected = 0;
    let highScore = parseInt(localStorage.getItem('jen_rush_highscore')) || 0;
    let gameTime = 0;
    let difficultyMultiplier = 1;

    // --- 5. INPUT HANDLING ENGINE ---
    const keys = {
        Up: false,
        Down: false,
        Left: false,
        Right: false
    };

    window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd'].includes(key)) {
            e.preventDefault();
        }

        if (key === 'arrowup' || key === 'w') keys.Up = true;
        if (key === 'arrowdown' || key === 's') keys.Down = true;
        if (key === 'arrowleft' || key === 'a') keys.Left = true;
        if (key === 'arrowright' || key === 'd') keys.Right = true;

        if ((key === 'p' || key === 'escape') && (gameState === STATES.PLAYING || gameState === STATES.PAUSED)) {
            togglePause();
        }
    });

    window.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        if (key === 'arrowup' || key === 'w') keys.Up = false;
        if (key === 'arrowdown' || key === 's') keys.Down = false;
        if (key === 'arrowleft' || key === 'a') keys.Left = false;
        if (key === 'arrowright' || key === 'd') keys.Right = false;
    });

    // Mobile / Pointer Touch Dragging
    let isDragging = false;
    let targetTouchPos = { x: 80, y: CANVAS_HEIGHT / 2 };

    function getCanvasCoordinates(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const scaleX = CANVAS_WIDTH / rect.width;
        const scaleY = CANVAS_HEIGHT / rect.height;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    canvas.addEventListener('mousedown', (e) => {
        if (gameState !== STATES.PLAYING) return;
        const pos = getCanvasCoordinates(e);
        isDragging = true;
        targetTouchPos = pos;
    });

    window.addEventListener('mousemove', (e) => {
        if (isDragging && gameState === STATES.PLAYING) {
            targetTouchPos = getCanvasCoordinates(e);
        }
    });

    window.addEventListener('mouseup', () => { isDragging = false; });

    canvas.addEventListener('touchstart', (e) => {
        if (gameState !== STATES.PLAYING) return;
        e.preventDefault();
        isDragging = true;
        targetTouchPos = getCanvasCoordinates(e);
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (isDragging && gameState === STATES.PLAYING) {
            e.preventDefault();
            targetTouchPos = getCanvasCoordinates(e);
        }
    }, { passive: false });

    canvas.addEventListener('touchend', () => { isDragging = false; });

    function setupTouchButton(buttonEl, keyName) {
        if (!buttonEl) return;
        const start = (e) => { e.preventDefault(); keys[keyName] = true; };
        const end = (e) => { e.preventDefault(); keys[keyName] = false; };
        buttonEl.addEventListener('touchstart', start, { passive: false });
        buttonEl.addEventListener('touchend', end, { passive: false });
        buttonEl.addEventListener('mousedown', start);
        buttonEl.addEventListener('mouseup', end);
        buttonEl.addEventListener('mouseleave', end);
    }

    setupTouchButton(btnUp, 'Up');
    setupTouchButton(btnDown, 'Down');
    setupTouchButton(btnLeft, 'Left');
    setupTouchButton(btnRight, 'Right');

    // --- 6. GAME OBJECT CLASSES ---

    // Parallax Starfield (Far, Mid, Near Layers)
    class Star {
        constructor(layer = 1) {
            this.layer = layer; // 1 = Far, 2 = Mid, 3 = Near
            this.reset(true);
        }

        reset(randomX = false) {
            this.x = randomX ? Math.random() * CANVAS_WIDTH : CANVAS_WIDTH + 10;
            this.y = Math.random() * CANVAS_HEIGHT;

            if (this.layer === 1) { // Far
                this.size = Math.random() * 1.2 + 0.5;
                this.speed = Math.random() * 0.8 + 0.4;
                this.alpha = Math.random() * 0.4 + 0.2;
                this.color = '#ffffff';
            } else if (this.layer === 2) { // Mid
                this.size = Math.random() * 1.8 + 1.0;
                this.speed = Math.random() * 1.8 + 1.2;
                this.alpha = Math.random() * 0.6 + 0.3;
                this.color = Math.random() > 0.5 ? '#00f3ff' : '#8a2be2';
            } else { // Near
                this.size = Math.random() * 2.5 + 1.8;
                this.speed = Math.random() * 3.5 + 2.5;
                this.alpha = Math.random() * 0.8 + 0.4;
                this.color = Math.random() > 0.3 ? '#00f3ff' : '#ff00ff';
            }
        }

        update(speedMultiplier, dt) {
            const deltaFactor = dt * 60;
            this.x -= this.speed * speedMultiplier * deltaFactor;
            if (this.x < -10) this.reset(false);
        }

        draw() {
            ctx.save();
            ctx.globalAlpha = this.alpha;
            ctx.fillStyle = this.color;
            ctx.shadowColor = this.color;
            ctx.shadowBlur = this.layer * 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // Space Dust / Ambient Particles
    class SpaceDust {
        constructor() {
            this.reset(true);
        }

        reset(randomX = false) {
            this.x = randomX ? Math.random() * CANVAS_WIDTH : CANVAS_WIDTH + 10;
            this.y = Math.random() * CANVAS_HEIGHT;
            this.vx = -(Math.random() * 1.2 + 0.5);
            this.vy = Math.sin(this.x * 0.01) * 0.4;
            this.size = Math.random() * 2 + 1;
            this.alpha = Math.random() * 0.3 + 0.1;
        }

        update(dt) {
            const deltaFactor = dt * 60;
            this.x += this.vx * deltaFactor;
            this.y += this.vy * deltaFactor;
            if (this.x < -20) this.reset(false);
        }

        draw() {
            ctx.save();
            ctx.globalAlpha = this.alpha;
            ctx.fillStyle = '#00f3ff';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // Player Spaceship with Smooth Physics & Delta Time Interpolation
    class Player {
        constructor() {
            this.width = 44;
            this.height = 30;
            this.x = 80;
            this.y = CANVAS_HEIGHT / 2;
            this.vx = 0;
            this.vy = 0;
            this.maxSpeed = 7.5;
            this.accel = 1.2;
            this.friction = 0.88;
            this.shieldActive = false;
            this.shieldTimer = 0;
            this.engineParticles = [];
        }

        reset() {
            this.x = 80;
            this.y = CANVAS_HEIGHT / 2;
            this.vx = 0;
            this.vy = 0;
            this.shieldActive = false;
            this.shieldTimer = 0;
            this.engineParticles = [];
        }

        update(dt) {
            const deltaFactor = dt * 60;

            // Keyboard Movement with Acceleration Physics
            if (keys.Up) this.vy -= this.accel * deltaFactor;
            if (keys.Down) this.vy += this.accel * deltaFactor;
            if (keys.Left) this.vx -= this.accel * deltaFactor;
            if (keys.Right) this.vx += this.accel * deltaFactor;

            // Apply Touch Drag Interpolation (Lerp)
            if (isDragging) {
                this.x += (targetTouchPos.x - this.x) * 0.25 * deltaFactor;
                this.y += (targetTouchPos.y - this.y) * 0.25 * deltaFactor;
            } else {
                // Apply Velocity & Friction
                this.vx *= Math.pow(this.friction, deltaFactor);
                this.vy *= Math.pow(this.friction, deltaFactor);
                this.x += this.vx * deltaFactor;
                this.y += this.vy * deltaFactor;
            }

            this.clampPosition();

            // Handle Shield Timer
            if (this.shieldActive) {
                this.shieldTimer -= dt;
                if (this.shieldTimer <= 0) {
                    this.shieldActive = false;
                }
            }

            // Spawn Engine Flame Trail Particles
            if (Math.random() < 0.95) {
                this.engineParticles.push({
                    x: this.x - 18,
                    y: this.y + (Math.random() * 8 - 4),
                    vx: -(Math.random() * 4 + 3),
                    vy: Math.random() * 2 - 1,
                    size: Math.random() * 4 + 2,
                    life: 1.0,
                    color: Math.random() > 0.35 ? '#00f3ff' : '#ff00ff'
                });
            }

            // Update Engine Particles
            for (let i = this.engineParticles.length - 1; i >= 0; i--) {
                const p = this.engineParticles[i];
                p.x += p.vx * deltaFactor;
                p.y += p.vy * deltaFactor;
                p.life -= 0.05 * deltaFactor;
                if (p.life <= 0) {
                    this.engineParticles.splice(i, 1);
                }
            }
        }

        clampPosition() {
            const halfW = this.width / 2;
            const halfH = this.height / 2;
            if (this.x - halfW < 12) { this.x = 12 + halfW; this.vx = 0; }
            if (this.x + halfW > CANVAS_WIDTH - 12) { this.x = CANVAS_WIDTH - 12 - halfW; this.vx = 0; }
            if (this.y - halfH < 12) { this.y = 12 + halfH; this.vy = 0; }
            if (this.y + halfH > CANVAS_HEIGHT - 12) { this.y = CANVAS_HEIGHT - 12 - halfH; this.vy = 0; }
        }

        draw() {
            ctx.save();

            // 1. Draw Engine Flame Trail
            this.engineParticles.forEach(p => {
                ctx.globalAlpha = Math.max(0, p.life);
                ctx.fillStyle = p.color;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
                ctx.fill();
            });

            ctx.globalAlpha = 1.0;

            // 2. Draw Sleek Futuristic Jet
            ctx.translate(this.x, this.y);

            // Glowing Jet Outline
            ctx.shadowColor = '#00f3ff';
            ctx.shadowBlur = 16;
            ctx.fillStyle = '#090d1f';
            ctx.strokeStyle = '#00f3ff';
            ctx.lineWidth = 2.5;

            ctx.beginPath();
            ctx.moveTo(22, 0);                 // Nose tip
            ctx.lineTo(-18, -14);               // Upper wing tip
            ctx.lineTo(-10, -5);                // Inner wing seam
            ctx.lineTo(-20, 0);                 // Engine exhaust core
            ctx.lineTo(-10, 5);                 // Inner wing seam
            ctx.lineTo(-18, 14);                // Lower wing tip
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Magenta Canopy Glow
            ctx.fillStyle = '#ff00ff';
            ctx.shadowColor = '#ff00ff';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.ellipse(3, 0, 8, 4, 0, 0, Math.PI * 2);
            ctx.fill();

            // 3. Draw Shield Bubble
            if (this.shieldActive) {
                const pulse = Math.sin(Date.now() * 0.012) * 2.5;
                ctx.strokeStyle = '#00f3ff';
                ctx.lineWidth = 3;
                ctx.shadowColor = '#00f3ff';
                ctx.shadowBlur = 22;
                ctx.beginPath();
                ctx.arc(0, 0, 29 + pulse, 0, Math.PI * 2);
                ctx.stroke();
            }

            ctx.restore();
        }
    }

    // Obstacle Hazard (Asteroids / Energy Mines)
    class Obstacle {
        constructor(speedMultiplier) {
            this.radius = Math.random() * 16 + 14;
            this.x = CANVAS_WIDTH + this.radius + 20;
            this.y = Math.random() * (CANVAS_HEIGHT - 60) + 30;
            this.speed = (Math.random() * 2.5 + 3.0) * speedMultiplier;
            this.vx = -this.speed;
            this.vy = (Math.random() * 1.4 - 0.7);
            this.rotation = Math.random() * Math.PI * 2;
            this.rotationSpeed = (Math.random() * 0.04 - 0.02);
            
            this.type = Math.random() > 0.4 ? 'asteroid' : 'mine';
            this.color = this.type === 'asteroid' ? '#ff2a5f' : '#8a2be2';

            this.vertexCount = 7;
            this.offsets = [];
            for (let i = 0; i < this.vertexCount; i++) {
                this.offsets.push(Math.random() * 6 - 3);
            }
        }

        update(dt) {
            const deltaFactor = dt * 60;
            this.x += this.vx * deltaFactor;
            this.y += this.vy * deltaFactor;
            this.rotation += this.rotationSpeed * deltaFactor;

            if (this.y - this.radius < 10 || this.y + this.radius > CANVAS_HEIGHT - 10) {
                this.vy = -this.vy;
            }
        }

        draw() {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation);

            ctx.shadowColor = this.color;
            ctx.shadowBlur = 14;
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2.5;
            ctx.fillStyle = '#0a0618';

            if (this.type === 'asteroid') {
                ctx.beginPath();
                for (let i = 0; i < this.vertexCount; i++) {
                    const angle = (i / this.vertexCount) * Math.PI * 2;
                    const r = this.radius + this.offsets[i];
                    const px = Math.cos(angle) * r;
                    const py = Math.sin(angle) * r;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, this.radius * 0.7, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * Math.PI * 2;
                    ctx.moveTo(Math.cos(angle) * (this.radius * 0.6), Math.sin(angle) * (this.radius * 0.6));
                    ctx.lineTo(Math.cos(angle) * (this.radius * 1.1), Math.sin(angle) * (this.radius * 1.1));
                }
                ctx.stroke();
            }

            ctx.restore();
        }
    }

    // Collectible Gold Coin & Power-up Orbs with Shimmer & Floating Motion
    class Collectible {
        constructor(isPowerup = false) {
            this.isPowerup = isPowerup;
            this.radius = isPowerup ? 14 : 11;
            this.x = CANVAS_WIDTH + 30;
            this.baseY = Math.random() * (CANVAS_HEIGHT - 100) + 50;
            this.y = this.baseY;
            this.speed = Math.random() * 1.5 + 2.5;
            this.pulse = Math.random() * Math.PI * 2;
            this.shimmerPhase = Math.random() * Math.PI * 2;
        }

        update(dt) {
            const deltaFactor = dt * 60;
            this.x -= this.speed * deltaFactor;
            this.pulse += 0.08 * deltaFactor;
            this.shimmerPhase += 0.1 * deltaFactor;
            // Gentle Sine-Wave Floating Motion
            this.y = this.baseY + Math.sin(this.pulse * 0.8) * 6;
        }

        draw() {
            ctx.save();
            ctx.translate(this.x, this.y);

            const scale = 1 + Math.sin(this.pulse) * 0.1;
            ctx.scale(scale, scale);

            if (this.isPowerup) {
                // Shield Power Orb
                ctx.shadowColor = '#00f3ff';
                ctx.shadowBlur = 18;
                ctx.fillStyle = '#00f3ff';
                ctx.beginPath();
                ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 12px Orbitron';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🛡️', 0, 1);
            } else {
                // Gold Coin with Shimmering 3D Rotation Line
                ctx.shadowColor = '#ffd700';
                ctx.shadowBlur = 16;
                ctx.fillStyle = '#ffd700';
                ctx.beginPath();
                ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
                ctx.fill();

                // Inner Coin Ring
                ctx.strokeStyle = '#b8860b';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, this.radius * 0.75, 0, Math.PI * 2);
                ctx.stroke();

                // Rotating Gold Shimmer Line
                const shimmerWidth = Math.cos(this.shimmerPhase) * (this.radius * 0.6);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(shimmerWidth, -this.radius * 0.6);
                ctx.lineTo(shimmerWidth, this.radius * 0.6);
                ctx.stroke();

                // Star Icon
                ctx.fillStyle = '#4a3300';
                ctx.font = 'bold 10px Orbitron';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('★', 0, 0);
            }

            ctx.restore();
        }
    }

    // Particle Burst Effects
    class Particle {
        constructor(x, y, color) {
            this.x = x;
            this.y = y;
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 6 + 1;
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed;
            this.size = Math.random() * 4 + 2;
            this.life = 1.0;
            this.decay = Math.random() * 0.03 + 0.02;
            this.color = color;
        }

        update(dt) {
            const deltaFactor = dt * 60;
            this.x += this.vx * deltaFactor;
            this.y += this.vy * deltaFactor;
            this.vx *= Math.pow(0.95, deltaFactor);
            this.vy *= Math.pow(0.95, deltaFactor);
            this.life -= this.decay * deltaFactor;
        }

        draw() {
            ctx.save();
            ctx.globalAlpha = Math.max(0, this.life);
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 10;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * this.life, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // Floating Score Popups (+50 Coin text animation)
    class FloatingText {
        constructor(text, x, y, color = '#ffd700') {
            this.text = text;
            this.x = x;
            this.y = y;
            this.color = color;
            this.life = 1.0;
            this.vy = -1.6;
        }

        update(dt) {
            const deltaFactor = dt * 60;
            this.y += this.vy * deltaFactor;
            this.life -= 0.025 * deltaFactor;
        }

        draw() {
            ctx.save();
            ctx.globalAlpha = Math.max(0, this.life);
            ctx.font = 'bold 16px Orbitron';
            ctx.fillStyle = this.color;
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 10;
            ctx.fillText(this.text, this.x, this.y);
            ctx.restore();
        }
    }

    // --- 7. INITIALIZE GAME ENTITIES ---
    const player = new Player();
    
    // Parallax Star Layers (3 Layers)
    const starsLayer1 = Array.from({ length: 30 }, () => new Star(1)); // Far
    const starsLayer2 = Array.from({ length: 25 }, () => new Star(2)); // Mid
    const starsLayer3 = Array.from({ length: 15 }, () => new Star(3)); // Near
    const spaceDust = Array.from({ length: 18 }, () => new SpaceDust());

    let obstacles = [];
    let collectibles = [];
    let particles = [];
    let floatingTexts = [];

    let obstacleSpawnTimer = 0;
    let collectibleSpawnTimer = 0;

    // --- 8. SPONSOR / SPAWN GENERATORS ---
    function spawnObstacles() {
        obstacleSpawnTimer++;
        const spawnInterval = Math.max(25, 75 - Math.floor(difficultyMultiplier * 6));
        if (obstacleSpawnTimer >= spawnInterval) {
            obstacleSpawnTimer = 0;
            obstacles.push(new Obstacle(difficultyMultiplier));
        }
    }

    function spawnCollectibles() {
        collectibleSpawnTimer++;
        if (collectibleSpawnTimer >= 110) {
            collectibleSpawnTimer = 0;
            const isPowerup = Math.random() < 0.2;
            collectibles.push(new Collectible(isPowerup));
        }
    }

    function triggerExplosion(x, y, color = '#ff2a5f', count = 25) {
        for (let i = 0; i < count; i++) {
            particles.push(new Particle(x, y, color));
        }
        // Cap active particles array to 120 max for optimal performance
        if (particles.length > 120) {
            particles.splice(0, particles.length - 120);
        }
    }

    function triggerHudBump(cardEl) {
        if (!cardEl) return;
        cardEl.classList.remove('bump');
        void cardEl.offsetWidth; // Trigger reflow for re-animation
        cardEl.classList.add('bump');
    }

    // --- 9. COLLISION DETECTION ENGINE ---
    function checkCollisions() {
        const pRadius = 16;

        // 1. Check Obstacle Collisions
        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obs = obstacles[i];
            const dx = player.x - obs.x;
            const dy = player.y - obs.y;
            const distance = Math.hypot(dx, dy);

            if (distance < pRadius + obs.radius) {
                if (player.shieldActive) {
                    triggerExplosion(obs.x, obs.y, '#00f3ff', 20);
                    sound.playExplosion();
                    floatingTexts.push(new FloatingText('SHIELD BLOCK!', obs.x, obs.y, '#00f3ff'));
                    obstacles.splice(i, 1);
                } else {
                    triggerExplosion(player.x, player.y, '#ff2a5f', 40);
                    sound.playExplosion();
                    triggerGameOver();
                    return;
                }
            }
        }

        // 2. Check Collectible Collisions
        for (let i = collectibles.length - 1; i >= 0; i--) {
            const item = collectibles[i];
            const dx = player.x - item.x;
            const dy = player.y - item.y;
            const distance = Math.hypot(dx, dy);

            if (distance < pRadius + item.radius) {
                if (item.isPowerup) {
                    player.shieldActive = true;
                    player.shieldTimer = 6;
                    sound.playPowerup();
                    triggerExplosion(item.x, item.y, '#00f3ff', 15);
                    floatingTexts.push(new FloatingText('SHIELD UP!', item.x, item.y, '#00f3ff'));
                } else {
                    coinsCollected++;
                    score += 50;
                    sound.playCoin();
                    triggerExplosion(item.x, item.y, '#ffd700', 14);
                    floatingTexts.push(new FloatingText('+50', item.x, item.y, '#ffd700'));
                    triggerHudBump(hudCoinCard);
                    triggerHudBump(hudScoreCard);
                }
                collectibles.splice(i, 1);
            }
        }
    }

    // --- 10. GAME LOOP & UPDATE FUNCTIONS ---
    let lastTime = performance.now();

    function gameLoop(now) {
        const deltaTime = Math.min((now - lastTime) / 1000, 0.1); // Cap delta time to avoid huge jumps
        lastTime = now;

        if (gameState === STATES.PLAYING) {
            updateGame(deltaTime);
        }

        renderGame(deltaTime);

        requestAnimationFrame(gameLoop);
    }

    function updateGame(dt) {
        gameTime += dt;
        score += Math.floor(dt * 15);

        difficultyMultiplier = 1 + (gameTime / 25);

        if (score > highScore) {
            highScore = score;
            localStorage.setItem('jen_rush_highscore', highScore.toString());
        }

        scoreVal.textContent = score;
        coinVal.textContent = coinsCollected;
        bestVal.textContent = highScore;

        // Update Parallax Stars & Space Dust
        starsLayer1.forEach(star => star.update(difficultyMultiplier, dt));
        starsLayer2.forEach(star => star.update(difficultyMultiplier, dt));
        starsLayer3.forEach(star => star.update(difficultyMultiplier, dt));
        spaceDust.forEach(dust => dust.update(dt));

        // Update Player
        player.update(dt);

        // Spawn & Update Obstacles
        spawnObstacles();
        for (let i = obstacles.length - 1; i >= 0; i--) {
            obstacles[i].update(dt);
            if (obstacles[i].x < -50) {
                obstacles.splice(i, 1);
            }
        }

        // Spawn & Update Collectibles
        spawnCollectibles();
        for (let i = collectibles.length - 1; i >= 0; i--) {
            collectibles[i].update(dt);
            if (collectibles[i].x < -50) {
                collectibles.splice(i, 1);
            }
        }

        // Update Particles
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update(dt);
            if (particles[i].life <= 0) {
                particles.splice(i, 1);
            }
        }

        // Update Floating Texts
        for (let i = floatingTexts.length - 1; i >= 0; i--) {
            floatingTexts[i].update(dt);
            if (floatingTexts[i].life <= 0) {
                floatingTexts.splice(i, 1);
            }
        }

        checkCollisions();
    }

    function renderGame(dt) {
        // Clear Canvas with sleek deep-space background gradient
        const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        bgGrad.addColorStop(0, '#02020a');
        bgGrad.addColorStop(1, '#050516');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Draw Ambient Parallax Layers
        starsLayer1.forEach(star => star.draw());
        spaceDust.forEach(dust => dust.draw());
        starsLayer2.forEach(star => star.draw());

        // Draw Collectibles & Hazards
        collectibles.forEach(item => item.draw());
        obstacles.forEach(obs => obs.draw());
        
        // Draw Near Parallax Star Layer
        starsLayer3.forEach(star => star.draw());

        // Draw Player Ship
        if (gameState === STATES.PLAYING || gameState === STATES.PAUSED) {
            player.draw();
        }

        // Draw Particles & Popups
        particles.forEach(p => p.draw());
        floatingTexts.forEach(ft => ft.draw());
    }

    // --- 11. GAME STATE CONTROL FUNCTIONS ---

    function resetGame() {
        score = 0;
        coinsCollected = 0;
        gameTime = 0;
        difficultyMultiplier = 1;
        obstacleSpawnTimer = 0;
        collectibleSpawnTimer = 0;

        obstacles = [];
        collectibles = [];
        particles = [];
        floatingTexts = [];

        player.reset();

        scoreVal.textContent = '0';
        coinVal.textContent = '0';
        bestVal.textContent = highScore;
    }

    function startGame() {
        sound.playClick();
        resetGame();
        gameState = STATES.PLAYING;

        startScreen.classList.add('hidden');
        pauseScreen.classList.add('hidden');
        gameoverScreen.classList.add('hidden');
        instructionsModal.classList.add('hidden');
        hudOverlay.classList.remove('hidden');
    }

    function togglePause() {
        sound.playClick();
        if (gameState === STATES.PLAYING) {
            gameState = STATES.PAUSED;
            pauseScreen.classList.remove('hidden');
        } else if (gameState === STATES.PAUSED) {
            gameState = STATES.PLAYING;
            pauseScreen.classList.add('hidden');
        }
    }

    function triggerGameOver() {
        gameState = STATES.GAMEOVER;

        finalScore.textContent = score;
        finalCoins.textContent = coinsCollected;
        finalBest.textContent = highScore;

        if (score >= highScore && score > 0) {
            newRecordBanner.classList.remove('hidden');
        } else {
            newRecordBanner.classList.add('hidden');
        }

        hudOverlay.classList.add('hidden');
        gameoverScreen.classList.remove('hidden');
    }

    function returnToMenu() {
        sound.playClick();
        gameState = STATES.MENU;
        startBestScore.textContent = highScore;

        hudOverlay.classList.add('hidden');
        pauseScreen.classList.add('hidden');
        gameoverScreen.classList.add('hidden');
        instructionsModal.classList.add('hidden');
        startScreen.classList.remove('hidden');
    }

    // --- 12. EVENT LISTENERS SETUP ---

    playBtn.addEventListener('click', startGame);
    
    howToBtn.addEventListener('click', () => {
        sound.playClick();
        instructionsModal.classList.remove('hidden');
    });

    closeInstructionsBtn.addEventListener('click', () => {
        sound.playClick();
        instructionsModal.classList.add('hidden');
    });

    pauseBtn.addEventListener('click', togglePause);
    resumeBtn.addEventListener('click', togglePause);
    
    restartPauseBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', startGame);
    menuBtn.addEventListener('click', returnToMenu);

    soundBtn.addEventListener('click', () => {
        const isMuted = sound.toggleMute();
        soundIcon.textContent = isMuted ? '🔇' : '🔊';
    });

    startBestScore.textContent = highScore;
    
    requestAnimationFrame(gameLoop);
});
