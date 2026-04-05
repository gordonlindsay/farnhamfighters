// ============================================================
// FARNHAM FIGHTERS — Stage 1 Skeleton
// ============================================================

// Global error handler — shows init errors on canvas
window.onerror = function(msg, src, line) {
    const c = document.getElementById('gameCanvas');
    if (c) {
        const x = c.getContext('2d');
        x.fillStyle = '#000'; x.fillRect(0, 0, 960, 540);
        x.fillStyle = 'red'; x.font = '14px monospace';
        x.fillText('INIT ERROR: ' + msg, 10, 30);
        x.fillText('Line: ' + line, 10, 50);
    }
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Constants ---
const GRAVITY = 0.6;
const FRICTION = 0.8;
const GROUND_Y = 480;
const LEVEL_WIDTH = 14400; // 4 stages, ~3600px each
const STAGE_WIDTH = 3600;
const SCREEN_W = canvas.width;
const SCREEN_H = canvas.height;

// --- Cached Gradients (created once, reused every frame) ---
function makeVertGrad(c1, c2) {
    const g = ctx.createLinearGradient(0, 0, 0, SCREEN_H);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    return g;
}
const GRAD_LEVEL_SELECT = makeVertGrad('#1a1a2e', '#0f3460');
const GRAD_VS_SELECT = makeVertGrad('#1a0a2e', '#2e1a0a');
const GRAD_CHAR_SELECT = makeVertGrad('#1a1a2e', '#16213e');
const GRAD_SHOP = makeVertGrad('#1a1a3e', '#0d0d2b');
const GRAD_LOSE_VIGNETTE = (() => {
    const g = ctx.createRadialGradient(SCREEN_W / 2, SCREEN_H / 2, 100, SCREEN_W / 2, SCREEN_H / 2, 400);
    g.addColorStop(0, 'rgba(150,0,0,0)'); g.addColorStop(1, 'rgba(100,0,0,0.3)');
    return g;
})();
const GRAD_TITLE_UI = (() => {
    const g = ctx.createLinearGradient(0, SCREEN_H * 0.55, 0, SCREEN_H);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.4, 'rgba(0,0,0,0.7)'); g.addColorStop(1, 'rgba(0,0,0,0.9)');
    return g;
})();
const GRAD_TITLE_FALLBACK = makeVertGrad('#0a0a2e', '#0a0a1e');

// --- Parallax scroll factors ---
const PARALLAX = {
    SKY: 0.0,
    FAR: 0.15,
    CLOUDS: 0.2,
    MID_BUILDINGS: 0.4,
    MID_TREES: 0.5,
    SIGNS: 0.6,
    NEAR_DETAIL: 0.7,
    GAMEPLAY: 1.0,
    FOREGROUND: 1.3,
};

// --- Ambient particles (foreground parallax layer) ---
let ambientParticles = [];

function initAmbientParticles() {
    ambientParticles = [];
    const bgType = getCurrentLevel().bgType;
    const count = bgType === 'london' ? 35 : 20;
    for (let i = 0; i < count; i++) {
        ambientParticles.push(createAmbientParticle(bgType, true));
    }
}

function createAmbientParticle(bgType, randomY) {
    const p = {
        x: Math.random() * (SCREEN_W + 200) - 100 + cameraX * PARALLAX.FOREGROUND,
        y: randomY ? Math.random() * SCREEN_H : -10 - Math.random() * 40,
        size: 2 + Math.random() * 3,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.05,
        alpha: 0.3 + Math.random() * 0.4,
    };
    if (bgType === 'forest') {
        // Falling leaves
        p.vx = -0.3 + Math.random() * 0.2;
        p.vy = 0.5 + Math.random() * 0.8;
        p.color = ['#c0392b','#e67e22','#f39c12','#d35400','#e74c3c'][Math.floor(Math.random() * 5)];
        p.type = 'leaf';
        p.sway = Math.random() * Math.PI * 2;
    } else if (bgType === 'london') {
        // Rain streaks
        p.vx = -1;
        p.vy = 6 + Math.random() * 3;
        p.color = 'rgba(200,210,230,0.35)';
        p.type = 'rain';
        p.size = 1;
    } else if (bgType === 'castle') {
        // Dust motes
        p.vx = (Math.random() - 0.5) * 0.3;
        p.vy = -0.1 + Math.random() * 0.3;
        p.color = '#d4c5a9';
        p.type = 'dust';
        p.alpha = 0.15 + Math.random() * 0.2;
    } else if (bgType === 'stadium') {
        // Confetti
        p.vx = (Math.random() - 0.5) * 0.5;
        p.vy = 0.8 + Math.random() * 1.2;
        p.color = ['#e74c3c','#3498db','#f1c40f','#2ecc71','#9b59b6'][Math.floor(Math.random() * 5)];
        p.type = 'confetti';
    } else {
        // School: dandelion seeds / pollen
        p.vx = 0.2 + Math.random() * 0.3;
        p.vy = -0.1 + Math.random() * 0.2;
        p.color = '#fff';
        p.type = 'pollen';
        p.size = 1.5;
        p.alpha = 0.3 + Math.random() * 0.3;
    }
    return p;
}

function updateAmbientParticles() {
    const bgType = getCurrentLevel().bgType;
    for (const p of ambientParticles) {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        if (p.type === 'leaf') {
            p.sway += 0.03;
            p.x += Math.sin(p.sway) * 0.5;
        }
        // Recycle when off-screen
        const sx = p.x - cameraX * PARALLAX.FOREGROUND;
        if (sx < -50 || sx > SCREEN_W + 50 || p.y > SCREEN_H + 20 || p.y < -60) {
            const newP = createAmbientParticle(bgType, false);
            // Spawn at top or side
            if (p.vy > 0) {
                newP.y = -10 - Math.random() * 30;
                newP.x = Math.random() * (SCREEN_W + 100) - 50 + cameraX * PARALLAX.FOREGROUND;
            } else {
                newP.x = (p.vx > 0 ? -20 : SCREEN_W + 20) + cameraX * PARALLAX.FOREGROUND;
                newP.y = Math.random() * SCREEN_H;
            }
            Object.assign(p, newP);
        }
    }
}

function drawForegroundLayer() {
    for (const p of ambientParticles) {
        const sx = p.x - cameraX * PARALLAX.FOREGROUND;
        if (sx < -20 || sx > SCREEN_W + 20) continue;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(sx, p.y);
        ctx.rotate(p.rotation);
        if (p.type === 'leaf') {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size * 1.5, p.size, 0, 0, Math.PI * 2);
            ctx.fill();
        } else if (p.type === 'rain') {
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.size;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(2, 12);
            ctx.stroke();
        } else if (p.type === 'dust') {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(0, 0, p.size, 0, Math.PI * 2);
            ctx.fill();
        } else if (p.type === 'confetti') {
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.5);
        } else {
            // Pollen / dandelion seed
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(0, 0, p.size, 0, Math.PI * 2);
            ctx.fill();
            // Tiny radiating lines
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 0.5;
            for (let i = 0; i < 4; i++) {
                const a = (i * Math.PI) / 2;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(a) * 4, Math.sin(a) * 4);
                ctx.stroke();
            }
        }
        ctx.restore();
    }
}

// --- Input ---
const keys = {};
window.addEventListener('keydown', e => {
    keys[e.code] = true;
    // Map Shift/Ctrl variants to a single key and prevent browser defaults
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys['Shift'] = true;
    if (e.code === 'ControlLeft' || e.code === 'ControlRight') { keys['Control'] = true; e.preventDefault(); }
    // Prevent scrolling/browser defaults for game keys
    if (e.code.startsWith('Arrow') || e.code.startsWith('Numpad') || e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', e => {
    keys[e.code] = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys['Shift'] = false;
    if (e.code === 'ControlLeft' || e.code === 'ControlRight') keys['Control'] = false;
});

// --- Mobile Touch Controls ---
const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
let touchControlsActive = false;
let touchOverlay = null;

// Convert a screen touch point to game canvas coordinates (0-960, 0-540)
function touchToCanvas(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: ((clientX - rect.left) / rect.width) * 960,
        y: ((clientY - rect.top) / rect.height) * 540,
    };
}

// Tap key briefly (for menu interactions)
function tapKey(keyCode, duration) {
    keys[keyCode] = true;
    setTimeout(() => { keys[keyCode] = false; }, duration || 80);
}

function initTouchControls() {
    if (!isTouchDevice) return;
    touchControlsActive = true;

    // Prevent default touch behaviours
    canvas.style.touchAction = 'none';
    document.body.style.touchAction = 'none';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';

    const meta = document.querySelector('meta[name="viewport"]');
    if (meta) meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';

    // === CANVAS TAP HANDLER (for menus) ===
    // Reset all confirm-held guards so the next frame sees a fresh keypress
    function resetHeldGuards() {
        titleConfirmHeld = false;
        selectConfirmHeld = false;
        vsConfirmHeld = false;
        levelSelectKeyHeld = false;
    }

    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const t = e.touches[0];
        const p = touchToCanvas(t.clientX, t.clientY);
        const inMenu = (gameState === 'title' || gameState === 'select' || gameState === 'vs_select' ||
                        gameState === 'level_select' || gameState === 'stage_complete' || gameState === 'won' ||
                        gameState === 'lost' || gameState === 'vs_results' || gameState === 'shop');

        if (inMenu) {
            if (gameState === 'title') {
                // Adventure button: roughly y 400-455, centered
                if (p.y >= 390 && p.y <= 460 && p.x >= 300 && p.x <= 660) {
                    titleCursor = 0;
                    resetHeldGuards();
                    tapKey('Enter', 120);
                }
                // VS Mode button: roughly y 455-510
                if (p.y >= 460 && p.y <= 520 && p.x >= 300 && p.x <= 660) {
                    titleCursor = 1;
                    resetHeldGuards();
                    tapKey('Enter', 120);
                }
            } else if (gameState === 'select' || gameState === 'vs_select') {
                // Left third = prev character
                if (p.x < 350) { tapKey('ArrowLeft', 80); return; }
                // Right third = next character
                if (p.x > 610) { tapKey('ArrowRight', 80); return; }
                // Bottom area = confirm
                if (p.y > 420) { resetHeldGuards(); tapKey('Enter', 120); return; }
                // Top area = difficulty toggle
                if (p.y < 100) { tapKey('ArrowUp', 80); return; }
            } else if (gameState === 'level_select') {
                if (p.x < 350) { tapKey('ArrowLeft', 80); return; }
                if (p.x > 610) { tapKey('ArrowRight', 80); return; }
                if (p.y > 350) { resetHeldGuards(); tapKey('Enter', 120); return; }
            } else if (gameState === 'stage_complete') {
                resetHeldGuards();
                tapKey('Enter', 120);
            } else if (gameState === 'shop') {
                // Bottom strip = continue to next stage
                if (p.y > 490) {
                    shopContinueHeld = false;
                    tapKey('KeyC', 120);
                    return;
                }
                // Top half of items area = navigate up, bottom half = navigate down
                if (p.y < 270) { tapKey('ArrowUp', 80); return; }
                if (p.y > 350 && p.y <= 490) { tapKey('ArrowDown', 80); return; }
                // Middle = buy selected item
                resetHeldGuards();
                tapKey('Enter', 120);
            } else if (gameState === 'won' || gameState === 'lost' || gameState === 'vs_results') {
                resetHeldGuards();
                tapKey('Enter', 120);
            }
        }
    }, { passive: false });

    // === GAMEPLAY TOUCH BUTTONS (overlay) ===
    const overlay = document.createElement('div');
    overlay.id = 'touchControls';
    touchOverlay = overlay;
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        pointer-events: none; z-index: 1000; user-select: none; -webkit-user-select: none;
    `;
    document.body.appendChild(overlay);

    // === VIRTUAL JOYSTICK (bottom-left) ===
    const joystickBase = document.createElement('div');
    joystickBase.id = 'joystickBase';
    const joyRadius = 56; // base radius
    const thumbRadius = 24; // thumb radius
    const joyDeadzone = 0.2; // ignore tiny movements
    joystickBase.style.cssText = `
        position: absolute; left: 16px; bottom: 30px;
        width: ${joyRadius * 2}px; height: ${joyRadius * 2}px;
        border-radius: 50%;
        background: rgba(255,255,255,0.08);
        border: 2px solid rgba(255,255,255,0.25);
        pointer-events: auto; user-select: none; -webkit-user-select: none;
    `;
    const joystickThumb = document.createElement('div');
    joystickThumb.id = 'joystickThumb';
    joystickThumb.style.cssText = `
        position: absolute;
        left: ${joyRadius - thumbRadius}px; top: ${joyRadius - thumbRadius}px;
        width: ${thumbRadius * 2}px; height: ${thumbRadius * 2}px;
        border-radius: 50%;
        background: rgba(255,255,255,0.35);
        border: 2px solid rgba(255,255,255,0.5);
        pointer-events: none;
    `;
    joystickBase.appendChild(joystickThumb);
    overlay.appendChild(joystickBase);

    let joystickTouchId = null;

    function updateJoystick(touchX, touchY) {
        const rect = joystickBase.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let dx = touchX - cx;
        let dy = touchY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = joyRadius - 4;
        if (dist > maxDist) { dx = (dx / dist) * maxDist; dy = (dy / dist) * maxDist; }
        joystickThumb.style.left = (joyRadius - thumbRadius + dx) + 'px';
        joystickThumb.style.top = (joyRadius - thumbRadius + dy) + 'px';
        const nx = dx / maxDist; // normalised -1 to 1
        const ny = dy / maxDist;
        keys['KeyA'] = nx < -joyDeadzone;
        keys['KeyD'] = nx > joyDeadzone;
        keys['ArrowUp'] = ny < -joyDeadzone;
        keys['ArrowDown'] = ny > joyDeadzone;
    }

    function resetJoystick() {
        joystickThumb.style.left = (joyRadius - thumbRadius) + 'px';
        joystickThumb.style.top = (joyRadius - thumbRadius) + 'px';
        keys['KeyA'] = false;
        keys['KeyD'] = false;
        keys['ArrowUp'] = false;
        keys['ArrowDown'] = false;
        joystickTouchId = null;
    }

    joystickBase.addEventListener('touchstart', (e) => {
        e.preventDefault(); e.stopPropagation();
        const t = e.changedTouches[0];
        joystickTouchId = t.identifier;
        updateJoystick(t.clientX, t.clientY);
    }, { passive: false });

    // Joystick move/end listeners on document so dragging outside the base still works
    document.addEventListener('touchmove', (e) => {
        if (joystickTouchId === null) return;
        for (const t of e.changedTouches) {
            if (t.identifier === joystickTouchId) {
                e.preventDefault();
                updateJoystick(t.clientX, t.clientY);
                return;
            }
        }
    }, { passive: false });

    document.addEventListener('touchend', (e) => {
        for (const t of e.changedTouches) {
            if (t.identifier === joystickTouchId) { resetJoystick(); return; }
        }
    }, { passive: false });

    document.addEventListener('touchcancel', (e) => {
        for (const t of e.changedTouches) {
            if (t.identifier === joystickTouchId) { resetJoystick(); return; }
        }
    }, { passive: false });

    const buttons = [
        // Action buttons (bottom-right) — controller diamond: JUMP top, ATK left, THROW/SPL right, BLK bottom
        { id: 'tb_jump',    label: 'JUMP',  key: 'KeyW',     side: 'right', bottom: 140, right: 70,  w: 64, h: 64, round: true },
        { id: 'tb_attack',  label: 'ATK',   key: 'Space',    side: 'right', bottom: 80,  right: 135, w: 56, h: 56, round: true },
        { id: 'tb_throw',   label: 'SPL',   key: 'Control',  side: 'right', bottom: 80,  right: 10,  w: 56, h: 56, round: true },
        { id: 'tb_block',   label: 'BLK',   key: 'Shift',    side: 'right', bottom: 20,  right: 70,  w: 56, h: 56, round: true },
        // Companion abilities (bottom-left, above joystick)
        { id: 'tb_compQ',   label: '🐕',   key: 'KeyQ',     side: 'left',  bottom: 165, left: 10,  w: 50, h: 50, round: true },
        { id: 'tb_compE',   label: '🐟',   key: 'KeyE',     side: 'left',  bottom: 165, left: 80,  w: 50, h: 50, round: true },
        // Top bar: pause + OK + fullscreen
        { id: 'tb_pause',  label: '⏸',  key: 'Escape', side: 'right', bottom: -1, top: 6, right: 8,  w: 40, h: 32 },
        { id: 'tb_enter',  label: 'OK',  key: 'Enter',  side: 'right', bottom: -1, top: 6, right: 56, w: 48, h: 32 },
    ];

    buttons.forEach(b => {
        const btn = document.createElement('div');
        btn.id = b.id;
        btn.textContent = b.label;
        const isRound = b.round;
        let posStyle = '';
        if (b.side === 'left') {
            posStyle = `left: ${b.left}px; bottom: ${b.bottom}px;`;
        } else {
            posStyle = `right: ${b.right}px;`;
            posStyle += b.top !== undefined ? `top: ${b.top}px;` : `bottom: ${b.bottom}px;`;
        }
        btn.style.cssText = `
            position: absolute; ${posStyle}
            width: ${b.w}px; height: ${b.h}px;
            background: rgba(255,255,255,0.12);
            border: 2px solid rgba(255,255,255,0.35);
            ${isRound ? 'border-radius: 50%;' : 'border-radius: 8px;'}
            color: rgba(255,255,255,0.65);
            font: bold ${b.h > 50 ? 13 : 11}px sans-serif;
            display: flex; align-items: center; justify-content: center;
            pointer-events: auto; user-select: none; -webkit-user-select: none;
        `;

        const press = (e) => { e.preventDefault(); e.stopPropagation(); keys[b.key] = true; btn.style.background = 'rgba(255,255,255,0.35)'; };
        const release = (e) => { e.preventDefault(); e.stopPropagation(); keys[b.key] = false; btn.style.background = 'rgba(255,255,255,0.12)'; };
        btn.addEventListener('touchstart', press, { passive: false });
        btn.addEventListener('touchend', release, { passive: false });
        btn.addEventListener('touchcancel', release, { passive: false });
        btn.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = btn.getBoundingClientRect();
            if (touch.clientX < rect.left || touch.clientX > rect.right ||
                touch.clientY < rect.top || touch.clientY > rect.bottom) {
                keys[b.key] = false;
                btn.style.background = 'rgba(255,255,255,0.12)';
            }
        }, { passive: false });
        overlay.appendChild(btn);
    });

    // === FULLSCREEN BUTTON ===
    const fsBtn = document.createElement('div');
    fsBtn.id = 'tb_fullscreen';
    fsBtn.textContent = '⛶';
    fsBtn.style.cssText = `
        position: absolute; top: 6px; right: 112px;
        width: 40px; height: 32px;
        background: rgba(255,255,255,0.12);
        border: 2px solid rgba(255,255,255,0.35);
        border-radius: 8px;
        color: rgba(255,255,255,0.65);
        font: bold 16px sans-serif;
        display: flex; align-items: center; justify-content: center;
        pointer-events: auto; user-select: none; -webkit-user-select: none;
    `;
    fsBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        } else {
            const el = document.documentElement;
            (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
        }
    }, { passive: false });
    overlay.appendChild(fsBtn);

    // === SOUND/MUSIC TOGGLE BUTTONS ===
    const sndBtn = document.createElement('div');
    sndBtn.id = 'tb_sound';
    sndBtn.textContent = '🔊';
    sndBtn.style.cssText = `
        position: absolute; top: 6px; left: 8px;
        width: 40px; height: 32px;
        background: rgba(255,255,255,0.12);
        border: 2px solid rgba(255,255,255,0.35);
        border-radius: 8px;
        color: rgba(255,255,255,0.65);
        font: 16px sans-serif;
        display: flex; align-items: center; justify-content: center;
        pointer-events: auto; user-select: none; -webkit-user-select: none;
    `;
    sndBtn.addEventListener('touchstart', (e) => {
        e.preventDefault(); e.stopPropagation();
        toggleSound();
        sndBtn.textContent = soundEnabled ? '🔊' : '🔇';
    }, { passive: false });
    overlay.appendChild(sndBtn);

    const musBtn = document.createElement('div');
    musBtn.id = 'tb_music';
    musBtn.textContent = '🎵';
    musBtn.style.cssText = `
        position: absolute; top: 6px; left: 56px;
        width: 40px; height: 32px;
        background: rgba(255,255,255,0.12);
        border: 2px solid rgba(255,255,255,0.35);
        border-radius: 8px;
        color: rgba(255,255,255,0.65);
        font: 16px sans-serif;
        display: flex; align-items: center; justify-content: center;
        pointer-events: auto; user-select: none; -webkit-user-select: none;
    `;
    musBtn.addEventListener('touchstart', (e) => {
        e.preventDefault(); e.stopPropagation();
        toggleMusic();
        musBtn.style.opacity = musicEnabled ? '1' : '0.4';
    }, { passive: false });
    overlay.appendChild(musBtn);

    // === PORTRAIT MODE WARNING ===
    const rotateMsg = document.createElement('div');
    rotateMsg.id = 'rotatePrompt';
    rotateMsg.innerHTML = '<div style="font-size:48px;margin-bottom:16px">📱</div>Rotate to landscape';
    rotateMsg.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: #1a1a2e; color: #fff; font: bold 20px sans-serif;
        display: none; flex-direction: column; align-items: center; justify-content: center;
        text-align: center; z-index: 2000; padding: 40px;
    `;
    document.body.appendChild(rotateMsg);

    // === RESIZE HANDLER ===
    function resizeCanvas() {
        const aspect = 960 / 540;
        const border = 6; // 3px border on each side
        const w = window.innerWidth - border;
        const h = window.innerHeight - border;
        const canvasEl = document.getElementById('gameCanvas');

        if (h > w * 1.2) {
            rotateMsg.style.display = 'flex';
            overlay.style.display = 'none';
        } else {
            rotateMsg.style.display = 'none';
            overlay.style.display = 'block';
        }

        if (w / h > aspect) {
            canvasEl.style.height = (h + border) + 'px';
            canvasEl.style.width = (h * aspect + border) + 'px';
        } else {
            canvasEl.style.width = (w + border) + 'px';
            canvasEl.style.height = (w / aspect + border) + 'px';
        }
        canvasEl.style.display = 'block';
        canvasEl.style.margin = '0 auto';
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    // Also resize on orientation change and fullscreen change
    window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 200));
    document.addEventListener('fullscreenchange', () => setTimeout(resizeCanvas, 200));
    document.addEventListener('webkitfullscreenchange', () => setTimeout(resizeCanvas, 200));
}

// Auto-init touch controls
initTouchControls();

// --- Gamepad Support (PS4 / Xbox / generic controllers) ---
// PS4: X=0, O=1, Square=2, Triangle=3, L1=4, R1=5, Share=8, Options=9, L3=10, R3=11
// D-pad: Up=12, Down=13, Left=14, Right=15
// Left stick: axes[0]=LR, axes[1]=UD (deadzone 0.3)
const GAMEPAD_DEADZONE = 0.3;
const gpPrev = {}; // track previous frame button states for edge detection
// Separate gamepad stick state so it doesn't overwrite keyboard input
const gpStick = { left: false, right: false, up: false, down: false };
const gp2Stick = { left: false, right: false, up: false, down: false };
// Track which keys were set by each gamepad (for input isolation in VS mode)
const gp1Keys = {};
const gp2Keys = {};
let gamepadConnected = false;
let gamepad2Connected = false;

window.addEventListener('gamepadconnected', () => {
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    gamepadConnected = !!gps[0];
    gamepad2Connected = !!gps[1];
});
window.addEventListener('gamepaddisconnected', () => {
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    gamepadConnected = !!gps[0];
    gamepad2Connected = !!gps[1];
});

let gpDebugInfo = ''; // shows which buttons are pressed (toggle with Select+L1)
let gpDebugEnabled = false;
const gp2Prev = {}; // previous frame button states for gamepad 2

function pollGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gamepads[0]; // first controller
    const gp2 = gamepads[1]; // second controller
    if (!gp) return;
    gamepadConnected = true;
    gamepad2Connected = !!gp2;

    const inVs = (gameState === 'vs_playing' || gameState === 'vs_select');
    const twoControllers = inVs && gp2;

    // Is the game on a menu screen?
    const inMenu = (gameState === 'title' || gameState === 'select' || gameState === 'level_select'
        || gameState === 'stage_complete' || gameState === 'shop' || gameState === 'won' || gameState === 'lost'
        || gameState === 'vs_select' || gameState === 'vs_results');

    // --- Gamepad 1: always P1 when two controllers, else uses p1ControlType ---
    const lx = gp.axes[0] || 0;
    const ly = gp.axes[1] || 0;
    const stickLeft  = lx < -GAMEPAD_DEADZONE || (gp.buttons[14] && gp.buttons[14].pressed);
    const stickRight = lx > GAMEPAD_DEADZONE  || (gp.buttons[15] && gp.buttons[15].pressed);
    const stickUp    = ly < -GAMEPAD_DEADZONE || (gp.buttons[12] && gp.buttons[12].pressed);
    const stickDown  = ly > GAMEPAD_DEADZONE  || (gp.buttons[13] && gp.buttons[13].pressed);

    // For menus, merge gamepad stick with keyboard (don't stomp keyboard presses)
    // Clear only when gamepad stick was previously active and is now released
    // In VS select: GP1 stick → WASD (P1 keys) when assigned to P1, else → arrows (P2 keys)
    if (inMenu) {
        const gp1IsP1 = gameState === 'vs_select' && (twoControllers || p1ControlType === 'controller');
        if (gp1IsP1) {
            // GP1 stick controls P1's character select (WASD)
            if (stickLeft)  keys['KeyA'] = true;
            if (stickRight) keys['KeyD'] = true;
            if (stickUp)    keys['KeyW'] = true;
            if (stickDown)  keys['KeyS'] = true;
            if (!stickLeft  && gpStick.left)  keys['KeyA'] = false;
            if (!stickRight && gpStick.right) keys['KeyD'] = false;
            if (!stickUp    && gpStick.up)    keys['KeyW'] = false;
            if (!stickDown  && gpStick.down)  keys['KeyS'] = false;
        } else {
            // Regular menus or GP1 assigned to P2: stick → arrow keys
            if (stickLeft)  keys['ArrowLeft'] = true;
            if (stickRight) keys['ArrowRight'] = true;
            if (stickUp)    keys['ArrowUp'] = true;
            if (stickDown)  keys['ArrowDown'] = true;
            if (!stickLeft  && gpStick.left)  keys['ArrowLeft'] = false;
            if (!stickRight && gpStick.right) keys['ArrowRight'] = false;
            if (!stickUp    && gpStick.up)    keys['ArrowUp'] = false;
            if (!stickDown  && gpStick.down)  keys['ArrowDown'] = false;
        }
    }

    // Store gamepad stick state separately — merged with keyboard in movement checks
    gpStick.left = stickLeft;
    gpStick.right = stickRight;
    gpStick.up = stickUp;
    gpStick.down = stickDown;

    // Context-aware button mapping for gamepad 1
    const btnMap = {};
    if (gameState === 'vs_select' && (twoControllers || p1ControlType === 'controller')) {
        btnMap[0] = 'Space';     // X = P1 ready (Space) in VS select
        btnMap[1] = 'Escape';    // O = back
    } else if (gameState === 'vs_select' && p1ControlType === 'keyboard') {
        btnMap[0] = 'Numpad0';   // X = P2 ready when gamepad is P2
        btnMap[1] = 'Escape';    // O = back
    } else if (gameState === 'paused' || gameState === 'won' || gameState === 'lost' || gameState === 'vs_results') {
        btnMap[0] = 'Enter';     // X = confirm / next level / rematch
        btnMap[1] = 'KeyQ';      // O = exit to main menu
    } else if (inMenu) {
        btnMap[0] = 'Enter';     // X = confirm on menus
        btnMap[1] = 'Escape';    // O = back on menus
    } else if (twoControllers || (inVs && p1ControlType === 'controller')) {
        btnMap[0] = 'Space';     // X = melee (P1)
        btnMap[1] = 'Control';   // O = ranged (P1)
        btnMap[2] = 'Shift';     // Square = block (P1)
    } else {
        btnMap[0] = 'Space';     // X = melee attack
        btnMap[1] = 'Control';   // O = ranged attack
        btnMap[2] = 'Shift';     // Square = block
    }
    btnMap[3] = 'GamepadJump';   // Triangle = jump
    btnMap[4] = 'KeyQ';          // L1 = companion ability Q
    btnMap[5] = 'KeyE';          // R1 = companion ability E
    btnMap[8] = 'KeyR';          // Share = restart
    btnMap[9] = 'Escape';        // Options = pause
    btnMap[10] = 'KeyC';         // L3 = continue from shop
    btnMap[11] = 'KeyN';         // R3 = next level
    btnMap[6] = 'KeyM';          // L2 = mute
    btnMap[7] = 'Control';        // R2 = combined ranged/special
    if (inMenu) btnMap[5] = 'Enter'; // R1 = confirm on menus too

    for (const [btnIdx, keyCode] of Object.entries(btnMap)) {
        const btn = gp.buttons[btnIdx];
        if (btn) {
            if (btn.pressed) {
                keys[keyCode] = true;
                gp1Keys[keyCode] = true;
            } else if (gpPrev[btnIdx]) {
                keys[keyCode] = false;
                gp1Keys[keyCode] = false;
            }
            gpPrev[btnIdx] = btn.pressed;
        }
    }

    // --- Gamepad 1: Share button toggles P1 control type in VS select ---
    if (inVs && gp.buttons[8] && gp.buttons[8].pressed && !gpPrev['shareToggle']) {
        p1ControlType = p1ControlType === 'controller' ? 'keyboard' : 'controller';
        gpPrev['shareToggle'] = true;
    }
    if (gp.buttons[8] && !gp.buttons[8].pressed) gpPrev['shareToggle'] = false;

    // --- Gamepad 2: controls P2 in VS mode (when p2ControlType is controller) ---
    if (gp2 && inVs) {
        const lx2 = gp2.axes[0] || 0;
        const ly2 = gp2.axes[1] || 0;

        // Options button (9) toggles P2 control type
        if (gp2.buttons[9] && gp2.buttons[9].pressed && !gp2Prev['optToggle']) {
            p2ControlType = p2ControlType === 'controller' ? 'keyboard' : 'controller';
            gp2Prev['optToggle'] = true;
        }
        if (gp2.buttons[9] && !gp2.buttons[9].pressed) gp2Prev['optToggle'] = false;

        if (p2ControlType === 'controller') {
            gp2Stick.left  = lx2 < -GAMEPAD_DEADZONE || (gp2.buttons[14] && gp2.buttons[14].pressed);
            gp2Stick.right = lx2 > GAMEPAD_DEADZONE  || (gp2.buttons[15] && gp2.buttons[15].pressed);
            gp2Stick.up    = ly2 < -GAMEPAD_DEADZONE || (gp2.buttons[12] && gp2.buttons[12].pressed);
            gp2Stick.down  = ly2 > GAMEPAD_DEADZONE  || (gp2.buttons[13] && gp2.buttons[13].pressed);

            // VS select: GP2 stick controls P2 character select (arrow keys)
            if (gameState === 'vs_select') {
                if (gp2Stick.left)  keys['ArrowLeft'] = true;
                if (gp2Stick.right) keys['ArrowRight'] = true;
                if (gp2Stick.up)    keys['ArrowUp'] = true;
                if (gp2Stick.down)  keys['ArrowDown'] = true;
                // Clear on release (using previous frame stored before this update)
                if (!gp2Stick.left  && gp2Prev['stickLeft'])  keys['ArrowLeft'] = false;
                if (!gp2Stick.right && gp2Prev['stickRight']) keys['ArrowRight'] = false;
                if (!gp2Stick.up    && gp2Prev['stickUp'])    keys['ArrowUp'] = false;
                if (!gp2Stick.down  && gp2Prev['stickDown'])  keys['ArrowDown'] = false;
                gp2Prev['stickLeft'] = gp2Stick.left;
                gp2Prev['stickRight'] = gp2Stick.right;
                gp2Prev['stickUp'] = gp2Stick.up;
                gp2Prev['stickDown'] = gp2Stick.down;
            }

            // P2 button mapping
            const p2BtnMap = {};
            if (gameState === 'vs_select') {
                p2BtnMap[0] = 'NumpadEnter'; // X = P2 ready
                p2BtnMap[1] = 'Escape';      // O = back
            } else {
                p2BtnMap[0] = P2_KEYS.attack;   // X = melee
                p2BtnMap[1] = P2_KEYS.ranged;   // O = ranged
                p2BtnMap[2] = P2_KEYS.block;    // Square = block
            }
            p2BtnMap[3] = 'ArrowUp';            // Triangle = jump (ArrowUp is P2 jump)
            p2BtnMap[4] = P2_KEYS.compQ;        // L1 = companion Q
            p2BtnMap[5] = P2_KEYS.compE;        // R1 = companion E
            p2BtnMap[7] = P2_KEYS.ranged;       // R2 = combined ranged/special

            for (const [btnIdx, keyCode] of Object.entries(p2BtnMap)) {
                const btn = gp2.buttons[btnIdx];
                if (btn) {
                    if (btn.pressed) {
                        keys[keyCode] = true;
                        gp2Keys[keyCode] = true;
                    } else if (gp2Prev[btnIdx]) {
                        keys[keyCode] = false;
                        gp2Keys[keyCode] = false;
                    }
                    gp2Prev[btnIdx] = btn.pressed;
                }
            }
        } else {
            // P2 chose keyboard — clear gp2Stick so it doesn't interfere
            gp2Stick.left = false;
            gp2Stick.right = false;
            gp2Stick.up = false;
            gp2Stick.down = false;
        }
    }

    // Debug overlay — shows pressed buttons (toggle: Share + L1)
    if (gp.buttons[8] && gp.buttons[8].pressed && gp.buttons[4] && gp.buttons[4].pressed) {
        if (!gpPrev['debugToggle']) gpDebugEnabled = !gpDebugEnabled;
        gpPrev['debugToggle'] = true;
    } else {
        gpPrev['debugToggle'] = false;
    }
    if (gpDebugEnabled) {
        const pressed = [];
        const names = ['X','O','□','△','L1','R1','L2','R2','Share','Options','L3','R3','Up','Down','Left','Right'];
        for (let i = 0; i < gp.buttons.length && i < 16; i++) {
            if (gp.buttons[i] && gp.buttons[i].pressed) pressed.push(i + ':' + (names[i] || '?'));
        }
        const stickStr = `Stick: ${lx.toFixed(2)},${ly.toFixed(2)}`;
        gpDebugInfo = pressed.length ? pressed.join(' ') + ' | ' + stickStr : stickStr;
    } else {
        gpDebugInfo = '';
    }
}

// ============================================================
// AUDIO SYSTEM — Web Audio API (no files needed)
// ============================================================
let audioCtx = null;
let masterGain = null;
let musicGain = null;
let sfxGain = null;
let soundEnabled = true;
let musicEnabled = true;
let currentMusic = null;
let musicIntervalId = null;

function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(audioCtx.destination);
    musicGain = audioCtx.createGain();
    musicGain.gain.value = 0.25;
    musicGain.connect(masterGain);
    sfxGain = audioCtx.createGain();
    sfxGain.gain.value = 0.6;
    sfxGain.connect(masterGain);
}

// Ensure audio starts on first user interaction (browser policy)
let titleMusicStarted = false;
function ensureAudio() {
    if (!audioCtx) initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    // Start title music on first interaction if on title screen
    if (!titleMusicStarted && gameState === 'title' && musicEnabled) {
        titleMusicStarted = true;
        startMusic('title');
    }
}
window.addEventListener('keydown', ensureAudio, { once: false });
window.addEventListener('click', ensureAudio, { once: false });
window.addEventListener('touchstart', ensureAudio, { once: false });

// --- Sound Effect Helpers ---
function playTone(freq, duration, type, gainNode, volume) {
    if (!audioCtx || !soundEnabled) return;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    g.gain.setValueAtTime((volume || 0.3), audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(g);
    g.connect(gainNode || sfxGain);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function playNoise(duration, gainNode, volume) {
    if (!audioCtx || !soundEnabled) return;
    const bufferSize = audioCtx.sampleRate * duration;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(volume || 0.15, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    src.connect(g);
    g.connect(gainNode || sfxGain);
    src.start();
}

// --- Sound Effects ---
function sfxJump() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(250, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.12);
    g.gain.setValueAtTime(0.2, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    osc.connect(g); g.connect(sfxGain);
    osc.start(); osc.stop(audioCtx.currentTime + 0.15);
}

function sfxTackle() {
    if (!audioCtx) return;
    playNoise(0.15, sfxGain, 0.25);
    playTone(120, 0.12, 'sawtooth', sfxGain, 0.3);
}

function sfxKick() {
    if (!audioCtx) return;
    playTone(400, 0.08, 'square', sfxGain, 0.2);
    playTone(300, 0.06, 'triangle', sfxGain, 0.15);
}

function sfxHit() {
    if (!audioCtx) return;
    playNoise(0.1, sfxGain, 0.2);
    playTone(200, 0.1, 'sawtooth', sfxGain, 0.25);
}

function sfxEnemyDeath() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.3);
    g.gain.setValueAtTime(0.25, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    osc.connect(g); g.connect(sfxGain);
    osc.start(); osc.stop(audioCtx.currentTime + 0.3);
}

function sfxCollect() {
    if (!audioCtx) return;
    playTone(523, 0.08, 'square', sfxGain, 0.2);
    setTimeout(() => playTone(659, 0.08, 'square', sfxGain, 0.2), 60);
    setTimeout(() => playTone(784, 0.1, 'square', sfxGain, 0.2), 120);
}

function sfxWeapon() {
    if (!audioCtx) return;
    playTone(440, 0.06, 'square', sfxGain, 0.2);
    setTimeout(() => playTone(554, 0.06, 'square', sfxGain, 0.2), 50);
    setTimeout(() => playTone(659, 0.06, 'square', sfxGain, 0.2), 100);
    setTimeout(() => playTone(880, 0.12, 'square', sfxGain, 0.25), 150);
}

function sfxCompanion() {
    if (!audioCtx) return;
    playTone(330, 0.1, 'triangle', sfxGain, 0.2);
    setTimeout(() => playTone(440, 0.1, 'triangle', sfxGain, 0.2), 80);
    setTimeout(() => playTone(660, 0.15, 'triangle', sfxGain, 0.25), 160);
}

function sfxClawScratch() {
    if (!audioCtx) return;
    // Quick scratchy swipe sound
    playNoise(0.08, sfxGain, 0.2);
    playTone(800, 0.06, 'sawtooth', sfxGain, 0.15);
    setTimeout(() => { playNoise(0.06, sfxGain, 0.15); playTone(600, 0.05, 'sawtooth', sfxGain, 0.12); }, 50);
    setTimeout(() => { playNoise(0.06, sfxGain, 0.12); playTone(400, 0.05, 'sawtooth', sfxGain, 0.1); }, 100);
}

function sfxMegaBark() {
    if (!audioCtx) return;
    // Deep bark then echo ring
    playTone(150, 0.12, 'square', sfxGain, 0.3);
    playTone(100, 0.15, 'sawtooth', sfxGain, 0.2);
    setTimeout(() => playTone(180, 0.1, 'square', sfxGain, 0.25), 80);
    setTimeout(() => playTone(120, 0.2, 'triangle', sfxGain, 0.15), 150);
}

function sfxFishtailKick() {
    if (!audioCtx) return;
    // Watery splash whoosh
    playNoise(0.12, sfxGain, 0.15);
    playTone(300, 0.1, 'triangle', sfxGain, 0.2);
    setTimeout(() => { playNoise(0.08, sfxGain, 0.1); playTone(500, 0.08, 'sine', sfxGain, 0.15); }, 60);
}

function sfxFishMunch() {
    if (!audioCtx) return;
    // Bubbly heal sound
    playTone(400, 0.06, 'sine', sfxGain, 0.2);
    setTimeout(() => playTone(500, 0.06, 'sine', sfxGain, 0.2), 60);
    setTimeout(() => playTone(600, 0.06, 'sine', sfxGain, 0.2), 120);
    setTimeout(() => playTone(800, 0.1, 'sine', sfxGain, 0.25), 180);
    // Bubbles
    setTimeout(() => playTone(1200, 0.04, 'sine', sfxGain, 0.1), 100);
    setTimeout(() => playTone(1400, 0.04, 'sine', sfxGain, 0.1), 160);
}

function sfxLaser() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.15);
    g.gain.setValueAtTime(0.1, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    osc.connect(g); g.connect(sfxGain);
    osc.start(); osc.stop(audioCtx.currentTime + 0.15);
}

function sfxPlayerHurt() {
    if (!audioCtx) return;
    playTone(300, 0.08, 'square', sfxGain, 0.25);
    setTimeout(() => playTone(200, 0.12, 'square', sfxGain, 0.2), 80);
}

function sfxBossHit() {
    if (!audioCtx) return;
    playNoise(0.12, sfxGain, 0.2);
    playTone(150, 0.15, 'sawtooth', sfxGain, 0.3);
    playTone(100, 0.2, 'square', sfxGain, 0.15);
}

function sfxBossSlam() {
    if (!audioCtx) return;
    playNoise(0.3, sfxGain, 0.3);
    playTone(60, 0.4, 'sawtooth', sfxGain, 0.35);
}

// --- Victory Jingle ---
function sfxVictory() {
    if (!audioCtx) return;
    const notes = [523, 587, 659, 784, 659, 784, 1047];
    const times = [0, 120, 240, 360, 480, 560, 680];
    notes.forEach((n, i) => {
        setTimeout(() => playTone(n, 0.18, 'square', sfxGain, 0.25), times[i]);
    });
}

// --- Defeat Jingle ---
function sfxDefeat() {
    if (!audioCtx) return;
    const notes = [400, 350, 300, 250, 200];
    notes.forEach((n, i) => {
        setTimeout(() => playTone(n, 0.25, 'square', sfxGain, 0.2), i * 180);
    });
}

// ============================================================
// MUSIC SYSTEM — MP3 tracks
// ============================================================
const musicTracks = {
    'Fight The Lightning': new Audio('Fight The Lightning.mp3'),
    'Busted': new Audio('Busted.mp3'),
    'The Wad': new Audio('The Wad (Heath Edit).mp3'),
};
// Pre-configure all tracks
for (const key in musicTracks) {
    musicTracks[key].loop = true;
    musicTracks[key].volume = 0.3;
}
// Victory track plays once
musicTracks['The Wad'].loop = false;

// All songs available for random gameplay/title rotation
const allSongs = ['Fight The Lightning', 'Busted', 'The Wad'];

function stopMusic() {
    for (const key in musicTracks) {
        musicTracks[key].pause();
        musicTracks[key].currentTime = 0;
    }
    currentMusic = null;
}

// Pause/resume music when tab loses/gains focus
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        for (const key in musicTracks) musicTracks[key].pause();
    } else if (currentMusic && musicEnabled) {
        musicTracks[currentMusic].play().catch(() => {});
    }
});

function startMusic(stage, forceNew) {
    if (!musicEnabled) { stopMusic(); return; }
    let trackKey;
    if (stage === 'victory') {
        trackKey = 'The Wad';
        musicTracks[trackKey].loop = false; // plays once for victory
    } else if (stage === 'boss') {
        trackKey = 'Fight The Lightning';
    } else {
        // Title and gameplay stages — pick a random song
        trackKey = allSongs[Math.floor(Math.random() * allSongs.length)];
        musicTracks[trackKey].loop = true;
    }
    // If this track is already playing, don't restart it (unless forced)
    if (!forceNew && currentMusic === trackKey && !musicTracks[trackKey].paused) return;
    // Stop all OTHER tracks, then start the new one
    for (const key in musicTracks) {
        if (key !== trackKey) {
            musicTracks[key].pause();
            musicTracks[key].currentTime = 0;
        }
    }
    currentMusic = trackKey;
    musicTracks[trackKey].currentTime = 0;
    musicTracks[trackKey].play().catch(() => {}); // catch autoplay block
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    if (!soundEnabled) {
        musicEnabled = false;
        stopMusic();
    } else {
        musicEnabled = true;
    }
}

function toggleMusic() {
    musicEnabled = !musicEnabled;
    if (!musicEnabled) {
        for (const key in musicTracks) musicTracks[key].pause();
    } else if (currentMusic) {
        musicTracks[currentMusic].play().catch(() => {});
    } else if (gameState === 'title' || gameState === 'select' || gameState === 'level_select') {
        startMusic('title');
    } else if (gameState === 'playing' || gameState === 'stage_intro' || gameState === 'stage_complete' || gameState === 'shop') {
        startMusic(currentStage, true);
    } else if (gameState === 'boss') {
        startMusic('boss', true);
    }
}

// --- Camera ---
let cameraX = 0;

// --- Game Mode ---
let gameMode = 'solo'; // 'solo' or 'vs'
let titleCursor = 0; // 0 = Adventure, 1 = VS Mode, 2 = Daddy Mode
let titleConfirmHeld = false;

// --- Daddy Mode — rename characters based on who's playing ---
const DADDY_MODES = ['Gordon', 'Ollie', 'Drew', 'Freddie', 'Phil'];
let daddyModeIndex = 0; // 0 = Gordon (default)
const DADDY_NAME_OVERRIDES = {
    'Gordon':  {},
    'Ollie':   { emilia: 'EVIE' },
    'Drew':    { jessica: 'EVELYN', emilia: 'SAVANNAH' },
    'Freddie': { heath: 'FINLEY', jessica: 'GEORGIA' },
    'Phil':    { charlie: 'RIVER', emilia: 'REMY' },
};
// Hair color overrides (Drew's Jessica/Evelyn has brown hair)
const DADDY_HAIR_OVERRIDES = {
    'Drew': { jessica: '#6B4226' },
};
function getCharName(charKey) {
    const daddy = DADDY_MODES[daddyModeIndex];
    const overrides = DADDY_NAME_OVERRIDES[daddy];
    return (overrides && overrides[charKey]) || CHAR_INFO[charKey].name;
}
function getHairColor(charKey) {
    const daddy = DADDY_MODES[daddyModeIndex];
    const overrides = DADDY_HAIR_OVERRIDES[daddy];
    return (overrides && overrides[charKey]) || null;
}
let selectConfirmHeld = false;
let vsConfirmHeld = false;
let vsP2ConfirmHeld = false;
let pauseExitHeld = false;
let titleKeyHeld = false;
let daddyKeyHeld = false;

// --- Game State ---
let gameState = 'title'; // 'title', 'select', 'vs_select', 'level_select', 'playing', 'stage_intro', 'stage_complete', 'shop', 'paused', 'boss', 'level_complete', 'won', 'lost', 'vs_playing', 'vs_results'
let selectedCharacter = 'heath';
const CHARACTERS = ['heath', 'charlie', 'rupert', 'jessica', 'emilia', 'mummy', 'daddy'];
const CHAR_INFO = {
    heath:   { name: 'HEATH',   ability: 'Rugby Tackle', quote: '"Let\'s move on!"', color: '#1a1a1a', attackName: 'Tackle', isTackle: true,  projectile: 'rugby',    ballIcon: '🏉',
               special: { name: 'Bulldozer', cooldown: 480, duration: 40, icon: '🐂' } },
    charlie: { name: 'CHARLIE', ability: 'Football Kick', quote: 'Cool & chilled',   color: '#a50044', attackName: 'Kick',   isTackle: false, projectile: 'football', ballIcon: '⚽',
               special: { name: 'Skill Move', cooldown: 360, duration: 25, icon: '💨' } },
    rupert:  { name: 'RUPERT',  ability: 'Power Kick',    quote: 'Up the Boro!',     color: '#e74c3c', attackName: 'Kick',   isTackle: false, projectile: 'football', ballIcon: '⚽',
               special: { name: 'Power Stomp', cooldown: 420, duration: 30, icon: '💥' } },
    jessica: { name: 'JESSICA', ability: 'Precision Kick', quote: 'Come on Oxford!', color: '#f1c40f', attackName: 'Kick', isTackle: false, projectile: 'football', ballIcon: '⚽',
               special: { name: 'Homing Shot', cooldown: 300, duration: 1, icon: '🎯' } },
    emilia:  { name: 'EMILIA',  ability: 'Ballet Spin',   quote: 'Teddy attack!',    color: '#ff69b4', attackName: 'Spin',   isTackle: false, projectile: 'teddy',    ballIcon: '🧸',
               special: { name: 'Pirouette', cooldown: 400, duration: 45, icon: '🩰' } },
    mummy:   { name: 'MUMMY',   ability: 'Handbag Hit',   quote: 'Not my carpet!',   color: '#d4a574', attackName: 'Bag',    isTackle: false, projectile: 'coffee',   ballIcon: '☕',
               special: { name: 'Handbag Slam', cooldown: 380, duration: 30, icon: '👜' }, locked: true, unlockWith: ['heath', 'emilia'] },
    daddy:   { name: 'DADDY',   ability: 'Power Punch',   quote: 'Hold my drink!',   color: '#4a6741', attackName: 'Punch',  isTackle: false, projectile: 'bottle',   ballIcon: '🍺',
               special: { name: 'Power Watch', cooldown: 420, duration: 20, icon: '⌚' }, locked: true, unlockWith: ['heath', 'emilia'] },
};
let unlockedCharacters = ['heath', 'charlie', 'rupert', 'jessica', 'emilia', 'mummy', 'daddy']; // TODO: remove mummy/daddy after testing — normally unlocked by beating game
function charIsTackle(c) { return CHAR_INFO[c].isTackle; }
function isCharUnlocked(c) { return unlockedCharacters.includes(c); }
function nextChar(c) {
    let i = CHARACTERS.indexOf(c);
    for (let n = 0; n < CHARACTERS.length; n++) {
        i = (i + 1) % CHARACTERS.length;
        if (isCharUnlocked(CHARACTERS[i])) return CHARACTERS[i];
    }
    return c;
}
function prevChar(c) {
    let i = CHARACTERS.indexOf(c);
    for (let n = 0; n < CHARACTERS.length; n++) {
        i = (i - 1 + CHARACTERS.length) % CHARACTERS.length;
        if (isCharUnlocked(CHARACTERS[i])) return CHARACTERS[i];
    }
    return c;
}
let currentLevel = 1; // which level (location)
let currentStage = 1; // tracks which stage the player is in (1-4)
let previousStage = 1; // for detecting stage changes
let difficulty = 'child'; // 'child' or 'adult'
let p1Difficulty = 'child';
let p2Difficulty = 'child';
let levelsUnlocked = 1; // how many levels the player has unlocked
let levelSelectCursor = 0;
let levelSelectKeyHeld = false;

// ============================================================
// LEVEL DEFINITIONS — each level is a Farnham location
// ============================================================
const LEVELS = {
    1: {
        name: 'South Farnham School',
        stages: ['The Playground', 'The Sports Field', 'The Car Park', 'The Classrooms'],
        stageDescs: ['Spike monsters have overrun the playground!', 'Giant aliens patrol the sports field!', 'Sneaky aliens hide behind the cars...', 'Red lasers crackle down the corridors!'],
        bossName: 'The Bombarder',
        sky: [
            ['#87CEEB', '#c8e6f5', '#a8d8a8'],  // bright school morning
            ['#7db8d4', '#b8d0d8', '#a8c8a0'],
            ['#6a9ab5', '#a0b8c0', '#98b898'],
            ['#5a7a90', '#8a98a0', '#7a9878'],
        ],
        groundColor: '#888',
        groundTopColor: '#6a6',
        signs: ['School Lane →', 'Sports Field', 'Staff Parking', 'Main Building →', 'Assembly Hall', 'Watch Out!'],
        bgType: 'school', // determines which decorations to draw
    },
    2: {
        name: 'Farnham Castle',
        stages: ['The Gatehouse', 'The Courtyard', 'The Keep', 'The Dungeon'],
        stageDescs: ['Spike monsters guard the castle entrance!', 'Giant aliens roam the courtyard!', 'Sneaky aliens lurk in the ancient keep...', 'Red lasers light up the dark dungeon!'],
        bossName: 'The Dark Knight',
        sky: [
            ['#8899aa', '#aab0c0', '#908878'],  // overcast medieval
            ['#7a8899', '#9aa0b0', '#887868'],
            ['#6a7889', '#8a90a0', '#786858'],
            ['#3a2838', '#5a3850', '#2a1828'],  // dark dungeon
        ],
        groundColor: '#776655',
        groundTopColor: '#665544',
        signs: ['Castle Gate →', 'Beware!', 'The Keep', 'Dungeon Ahead', 'No Escape!', 'Turn Back!'],
        bgType: 'castle',
    },
    3: {
        name: 'Farnham Town FC',
        stages: ['The Car Park', 'The Stands', 'The Pitch', 'The Tunnel'],
        stageDescs: ['Spike monsters block the stadium entrance!', 'Giant aliens have taken the stands!', 'Sneaky aliens hide across the pitch...', 'Red lasers fill the players tunnel!'],
        bossName: 'The Goalkeeper',
        sky: [
            ['#5588bb', '#88aad0', '#70a070'],  // matchday sky
            ['#4477aa', '#7799c0', '#609060'],
            ['#3a6699', '#6688b0', '#508050'],
            ['#2a3a50', '#4a5a70', '#3a4a40'],  // floodlit tunnel
        ],
        groundColor: '#4a8a4a',
        groundTopColor: '#3a7a3a',
        signs: ['Stadium →', 'Home End', 'Away End', 'Pitch Side', 'Tunnel →', 'Final Whistle!'],
        bgType: 'stadium',
    },
    4: {
        name: 'Bourne Woods',
        stages: ['The Trail', 'The Clearing', 'The Dark Path', 'The Ancient Grove'],
        stageDescs: ['Spike monsters hide in the undergrowth!', 'Giant aliens stomp through the clearing!', 'Sneaky aliens blend into the shadows...', 'Red lasers pierce through ancient trees!'],
        bossName: 'The Forest Guardian',
        sky: [
            ['#4a6a3a', '#6a8a5a', '#3a5a2a'],  // dense forest canopy
            ['#3a5a2a', '#5a7a4a', '#2a4a1a'],
            ['#2a3a1a', '#4a5a3a', '#1a3a0a'],
            ['#1a2a10', '#2a3a20', '#0a1a00'],  // very dark ancient grove
        ],
        groundColor: '#5a4a30',
        groundTopColor: '#4a6a2a',
        signs: ['Footpath →', 'The Clearing', 'Stay On Path', 'Beware!', 'Ancient Grove', 'No Return!'],
        bgType: 'forest',
    },
    5: {
        name: 'London',
        stages: ['The Suburbs', 'The High Street', 'Westminster', 'The Shard'],
        stageDescs: ['Spike monsters invade the suburbs!', 'Giant aliens march down the high street!', 'Sneaky aliens infiltrate Westminster...', 'Red lasers fire from The Shard!'],
        bossName: 'The Prime Monster',
        sky: [
            ['#8899aa', '#b0b8c8', '#a0a098'],  // grey London
            ['#7a8899', '#a0a8b8', '#909088'],
            ['#6a7889', '#9098a8', '#808078'],
            ['#2a1a2a', '#4a2a4a', '#3a2a3a'],  // dark Shard level
        ],
        groundColor: '#777',
        groundTopColor: '#666',
        signs: ['Zone 5', 'High Street', 'Westminster →', 'The Shard', 'Mind The Gap', 'Final Battle!'],
        bgType: 'london',
    },
};

const TOTAL_LEVELS = Object.keys(LEVELS).length;

function getCurrentLevel() {
    return LEVELS[currentLevel] || LEVELS[1];
}

// Title screen animation
let titleTimer = 0;

// Stage intro
let stageIntroTimer = 0;
const STAGE_INTRO_DURATION = 120; // 2 seconds

// Pause
let pauseKeyHeld = false;
let pausedFromState = 'playing';

// Game timer (for stats)
let gameStartTime = 0;
let gameEndTime = 0;
let lostScreenDelay = 0;
let lostInputHeld = false;
let lostMessage = '';
let diedInBoss = false;
let wonScreenDelay = undefined;
let wonInputHeld = false;
let enemiesDefeated = 0;
let stageKillCounts = [0, 0, 0, 0]; // kills per stage (1-4)
let stageEnemyCounts = [0, 0, 0, 0]; // total enemies per stage (1-4)
const KILL_GATE_PCT = 0.6; // must kill 60% of enemies in stage to advance

// ============================================================
// UPGRADE SYSTEM — spend stickers to power up between stages
// ============================================================
const UPGRADE_COSTS_CHILD = [3, 5, 8];
const UPGRADE_COSTS_ADULT = [6, 10, 15];
function getUpgradeCosts() { return difficulty === 'child' ? UPGRADE_COSTS_CHILD : UPGRADE_COSTS_ADULT; }

const upgradeDefinitions = {
    health:      { name: 'Max Health',     icon: '❤️', maxLevel: 3, desc: ['+1 Heart (6 total)', '+1 Heart (7 total)', '+1 Heart (8 total)'] },
    tackle:      { name: 'Rugby Tackle',   icon: '💪', maxLevel: 3, desc: ['More damage', 'Longer lunge', 'Multi-hit (both sides)'], character: 'heath' },
    kick:        { name: 'Football Kick',  icon: '⚽', maxLevel: 3, desc: ['More damage', 'Faster shot', 'Triple ball'], character: 'charlie' },
    handbag:     { name: 'Handbag Hit',    icon: '👜', maxLevel: 3, desc: ['More damage', 'Wider swing', 'Stun enemies'], character: 'mummy' },
    bottle:      { name: 'Bottle Throw',   icon: '🍺', maxLevel: 3, desc: ['More damage', 'Explodes on hit', 'Bouncing bottles'], character: 'daddy' },
    speed:       { name: 'Speed',          icon: '⚡', maxLevel: 2, desc: ['Faster movement', 'Even faster'] },
    jules:       { name: 'Jules (Dog)',     icon: '🐕', maxLevel: 2, desc: ['Stronger claws', 'Wider bark wave'] },
    fishies:     { name: 'The Fishies',    icon: '🐟', maxLevel: 2, desc: ['Stronger wave', 'Full heal on munch'] },
};

let upgrades = {};
let shopCursor = 0;
let shopKeyHeld = false;
let stageCompleteTimer = 0;
const STAGE_COMPLETE_DURATION = 120; // 2 seconds before shop opens

function resetUpgrades() {
    upgrades = {};
    for (const key of Object.keys(upgradeDefinitions)) {
        upgrades[key] = 0; // level 0 = no upgrade
    }
}
resetUpgrades();

function getUpgradeCost(key) {
    const level = upgrades[key];
    const def = upgradeDefinitions[key];
    if (level >= def.maxLevel) return null; // maxed out
    return getUpgradeCosts()[level];
}

function canAffordUpgrade(key) {
    const cost = getUpgradeCost(key);
    if (cost === null) return false;
    return stickersCollected >= cost;
}

function purchaseUpgrade(key) {
    const cost = getUpgradeCost(key);
    if (cost === null || stickersCollected < cost) return false;
    stickersCollected -= cost;
    upgrades[key]++;
    applyUpgrades();
    sfxWeapon();
    return true;
}

function applyUpgrades() {
    // Health upgrade: +1 max heart per level
    const baseHealth = getDifficulty().playerHealth;
    player.maxHealth = baseHealth + upgrades.health;
    player.health = player.maxHealth; // health upgrade also fully heals

    // Speed upgrade: +0.5 per level
    player.speed = 4 + upgrades.speed * 0.5;
}

function getShopItems() {
    // Filter to show relevant upgrades for the selected character
    const items = [];
    for (const [key, def] of Object.entries(upgradeDefinitions)) {
        // Skip character-specific upgrades that don't match
        if (def.character && def.character !== selectedCharacter) continue;
        items.push(key);
    }
    return items;
}

// Difficulty multipliers
function getDifficulty() {
    if (difficulty === 'child') {
        return { shootCooldownMult: 1.6, laserSpeedMult: 0.65, enemyHealthMult: 0.7, enemySpeedMult: 0.75, playerHealth: 5 };
    } else {
        return { shootCooldownMult: 0.5, laserSpeedMult: 1.5, enemyHealthMult: 1.5, enemySpeedMult: 1.3, playerHealth: 5 };
    }
}

// --- Projectiles (for Charlie's football kick) ---
let projectiles = [];

// ============================================================
// HEATH — Player Character
// ============================================================
const player = {
    x: 80,
    y: 300,
    width: 36,
    height: 52,
    vx: 0,
    vy: 0,
    speed: 4.5,
    jumpForce: -12,
    onGround: false,
    jumps: 0,
    maxJumps: 2, // double jump
    jumpKeyHeld: false,
    facing: 1, // 1 = right, -1 = left
    health: 5,
    maxHealth: 5,
    isAttacking: false,
    attackTimer: 0,
    attackCooldown: 0,
    attackDuration: 20,
    invincible: 0, // invincibility frames after getting hit
    isBlocking: false, // block: halves incoming damage, slows movement
    blockTimer: 0,     // how long current block has been held
    animFrame: 0,
    animTimer: 0,
    rangedAmmo: 0, // ranged ammo — earned from weapon pickups
    _rangedHeld: false,
    // Special ability state
    specialCooldown: 0,  // frames until special is available again
    specialActive: 0,    // frames remaining of active special
    specialType: null,   // which special is active (set on activation)
    _specialHeld: false, // edge detection for key
};

// ============================================================
// VS MODE — Player 2 & split-screen data
// ============================================================
let p1Character = 'heath';
let p2Character = 'charlie';
let vsSelectCursor = 0; // 0 = P1 choosing, 1 = P2 choosing (controller handles P2)
let vsP1Ready = false;
let vsP2Ready = false;
let p1DiffKeyHeld = false;
let p2DiffKeyHeld = false;
let vsBackKeyHeld = false;
let p1ControlType = 'controller'; // 'controller' or 'keyboard'
let p2ControlType = 'controller'; // 'controller' or 'keyboard' (when 2 gamepads connected)
let controlToggleHeld = false;
let p2ControlToggleHeld = false;

const player2 = {
    x: 80, y: 300, width: 36, height: 52,
    vx: 0, vy: 0, speed: 4.5, jumpForce: -12,
    onGround: false, jumps: 0, maxJumps: 2, jumpKeyHeld: false,
    facing: 1, health: 5, maxHealth: 5,
    isAttacking: false, attackTimer: 0, attackCooldown: 0, attackDuration: 20,
    invincible: 0, isBlocking: false, blockTimer: 0,
    animFrame: 0, animTimer: 0,
    rangedAmmo: 3,
    compQHeld: false, compEHeld: false,
    _rangedHeld: false,
    specialCooldown: 0, specialActive: 0, specialType: null, _specialHeld: false,
};

let cameraX2 = 0; // P2's camera
let p1Score = 0;
let p2Score = 0;
let p1Finished = false; // reached end of level
let p2Finished = false;
let vsEndDelay = 0;
let p1FinishTime = 0;
let p2FinishTime = 0;
let p1Enemies = [];  // separate enemy lists
let p2Enemies = [];
let p1Stickers = [];
let p2Stickers = [];
let p1StickersCollected = 0;
let p2StickersCollected = 0;
let p1EnemiesDefeated = 0;
let p2EnemiesDefeated = 0;
let p1Projectiles = [];
let p2Projectiles = [];
let p1WeaponPickups = [];
let p2WeaponPickups = [];
let p1Hearts = [];
let p2Hearts = [];
let p1CompanionPickups = [];
let p2CompanionPickups = [];
let p1ActiveCompanion = null;
let p2ActiveCompanion = null;
let vsEnemyLasers = [];
let p1Stage = 1;
let p2Stage = 1;
let vsStartTime = 0;
let vsResultsShown = false;

// P2 keyboard controls (arrow keys + nearby right-hand keys)
const P2_KEYS = {
    left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown',
    attack: 'NumpadDecimal', ranged: 'NumpadEnter', jump: 'ArrowUp', block: 'Numpad0',
    special: 'NumpadEnter', compQ: 'Numpad7', compE: 'Numpad9',
};
// P1 uses WASD + Space(melee) + F(ranged) + B(block) + G(special)
const P1_KEYS = {
    left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS',
    attack: 'Space', ranged: 'Control', jump: 'KeyW', jump2: 'GamepadJump', block: 'Shift',
    special: 'KeyG', compQ: 'KeyQ', compE: 'KeyE',
};

// ============================================================
// PLATFORMS
// ============================================================
function createPlatforms() {
    const platforms = [];
    const S = 1.5; // stage scale factor

    // === STAGE 1 (0–3600): The Park — pavement, benches, fences ===
    const ground1 = [
        { x: 0, w: 1050 }, { x: 1140, w: 750 }, { x: 2010, w: 750 }, { x: 2880, w: 720 },
    ];
    for (const g of ground1) platforms.push({ x: g.x, y: GROUND_Y, width: g.w, height: 60, type: 'ground', stage: 1 });

    const benches = [
        { x: 375, y: 400 }, { x: 900, y: 360 }, { x: 1500, y: 380 },
        { x: 2250, y: 350 }, { x: 2850, y: 390 }, { x: 1800, y: 400 },
        { x: 3200, y: 370 },
    ];
    for (const b of benches) platforms.push({ x: b.x, y: b.y, width: 100, height: 16, type: 'bench', stage: 1 });

    const fences1 = [{ x: 675, y: 440 }, { x: 1800, y: 440 }, { x: 2625, y: 440 }, { x: 3300, y: 440 }];
    for (const f of fences1) platforms.push({ x: f.x, y: f.y, width: 12, height: 40, type: 'fence', stage: 1 });

    const floating1 = [{ x: 600, y: 340 }, { x: 1275, y: 320 }, { x: 2000, y: 310 }, { x: 2600, y: 330 }, { x: 3150, y: 310 }, { x: 3400, y: 340 }];
    for (const f of floating1) platforms.push({ x: f.x, y: f.y, width: 90, height: 14, type: 'floating', stage: 1 });

    // === STAGE 2 (3600–7200): The High Street — wider gaps, rooftops ===
    const ground2 = [
        { x: 3600, w: 900 }, { x: 4650, w: 675 }, { x: 5475, w: 750 }, { x: 6375, w: 825 },
    ];
    for (const g of ground2) platforms.push({ x: g.x, y: GROUND_Y, width: g.w, height: 60, type: 'ground', stage: 2 });

    const rooftops = [
        { x: 3750, y: 350 }, { x: 4350, y: 310 }, { x: 4950, y: 340 },
        { x: 5550, y: 300 }, { x: 6150, y: 330 }, { x: 6750, y: 310 },
        { x: 4050, y: 290 }, { x: 5250, y: 320 }, { x: 6450, y: 300 },
    ];
    for (const r of rooftops) platforms.push({ x: r.x, y: r.y, width: 110, height: 14, type: 'floating', stage: 2 });

    const benches2 = [{ x: 4050, y: 400 }, { x: 5100, y: 380 }, { x: 6000, y: 390 }, { x: 6900, y: 380 }];
    for (const b of benches2) platforms.push({ x: b.x, y: b.y, width: 100, height: 16, type: 'bench', stage: 2 });

    // === STAGE 3 (7200–10800): The School — climbing frames, narrow platforms ===
    const ground3 = [
        { x: 7200, w: 750 }, { x: 8100, w: 600 }, { x: 8850, w: 675 }, { x: 9675, w: 600 }, { x: 10425, w: 375 },
    ];
    for (const g of ground3) platforms.push({ x: g.x, y: GROUND_Y, width: g.w, height: 60, type: 'ground', stage: 3 });

    const climbing = [
        { x: 7350, y: 390 }, { x: 7575, y: 340 }, { x: 7800, y: 290 },
        { x: 8250, y: 360 }, { x: 8550, y: 310 }, { x: 8775, y: 350 },
        { x: 9150, y: 300 }, { x: 9450, y: 340 }, { x: 9750, y: 280 },
        { x: 10050, y: 330 }, { x: 10350, y: 300 },
        { x: 7950, y: 310 }, { x: 8400, y: 280 }, { x: 9900, y: 350 },
    ];
    for (const c of climbing) platforms.push({ x: c.x, y: c.y, width: 70, height: 12, type: 'floating', stage: 3 });

    // === STAGE 4 (10800–14400): The Danger Zone — sparse, treacherous ===
    const ground4 = [
        { x: 10800, w: 600 }, { x: 11625, w: 450 }, { x: 12300, w: 525 }, { x: 13050, w: 450 }, { x: 13725, w: 675 },
    ];
    for (const g of ground4) platforms.push({ x: g.x, y: GROUND_Y, width: g.w, height: 60, type: 'ground', stage: 4 });

    const danger = [
        { x: 11025, y: 370 }, { x: 11400, y: 320 }, { x: 11850, y: 350 },
        { x: 12150, y: 290 }, { x: 12600, y: 340 }, { x: 12900, y: 300 },
        { x: 13275, y: 350 }, { x: 13575, y: 310 }, { x: 13950, y: 340 },
        { x: 11700, y: 300 }, { x: 12450, y: 280 }, { x: 13800, y: 330 },
    ];
    for (const d of danger) platforms.push({ x: d.x, y: d.y, width: 75, height: 12, type: 'floating', stage: 4 });

    return platforms;
}

const platforms = createPlatforms();

// ============================================================
// ENEMIES — All 4 Stages
// ============================================================

// Enemy laser projectiles (for Stage 2, 3, 4 enemies)
let enemyLasers = [];

function createEnemies() {
    const allEnemies = [];
    const d = getDifficulty();
    const lvlScale = 1 + (currentLevel - 1) * 0.3; // each level: +30% health/speed

    // STAGE 1: Purple Spike Monsters — low health, easy to beat
    const stage1 = [
        { x: 450, pl: 300, pr: 900 }, { x: 1200, pl: 1140, pr: 1650 },
        { x: 1800, pl: 1650, pr: 2250 }, { x: 2550, pl: 2400, pr: 2925 },
        { x: 3150, pl: 2880, pr: 3525 }, { x: 750, pl: 400, pr: 1100 },
        { x: 2100, pl: 2010, pr: 2500 },
    ];
    for (const s of stage1) {
        const hp = Math.ceil(2 * d.enemyHealthMult * lvlScale);
        allEnemies.push({
            type: 'spike', x: s.x, y: GROUND_Y - 44, width: 40, height: 44,
            vx: 1.5 * d.enemySpeedMult, patrolLeft: s.pl, patrolRight: s.pr,
            health: hp, maxHealth: hp, alive: true, hitFlash: 0, facing: 1,
            shootTimer: 0, shootCooldown: 0,
        });
    }

    // STAGE 2: Giant Aliens — green/purple/orange, laser blasters
    const stage2 = [
        { x: 3900, pl: 3600, pr: 4350, color: 'green' },
        { x: 4500, pl: 4350, pr: 4950, color: 'purple' },
        { x: 5100, pl: 4950, pr: 5475, color: 'orange' },
        { x: 5700, pl: 5475, pr: 6150, color: 'green' },
        { x: 6300, pl: 6150, pr: 6750, color: 'purple' },
        { x: 6825, pl: 6600, pr: 7125, color: 'orange' },
        { x: 4200, pl: 3900, pr: 4650, color: 'green' },
        { x: 5400, pl: 5100, pr: 5700, color: 'purple' },
    ];
    for (const s of stage2) {
        const hp = Math.ceil(3 * d.enemyHealthMult * lvlScale);
        allEnemies.push({
            type: 'alien_giant', x: s.x, y: GROUND_Y - 60, width: 48, height: 60,
            vx: 1.0 * d.enemySpeedMult, vy: 0, patrolLeft: s.pl, patrolRight: s.pr,
            health: hp, maxHealth: hp, alive: true, hitFlash: 0, facing: 1,
            alienColor: s.color, shootTimer: 0, shootCooldown: Math.floor(200 * d.shootCooldownMult),
            onGround: true, jumpCooldown: 0, canJump: true,
        });
    }

    // STAGE 3: Small Big-Nosed Aliens — hidden lasers, harder
    const stage3 = [
        { x: 7425, pl: 7200, pr: 7800 }, { x: 8025, pl: 7800, pr: 8400 },
        { x: 8625, pl: 8400, pr: 8925 }, { x: 9150, pl: 8850, pr: 9525 },
        { x: 9675, pl: 9525, pr: 10050 }, { x: 10200, pl: 10050, pr: 10500 },
        { x: 10575, pl: 10425, pr: 10800 }, { x: 7800, pl: 7500, pr: 8100 },
        { x: 9900, pl: 9675, pr: 10200 },
    ];
    for (const s of stage3) {
        const hp = Math.ceil(5 * d.enemyHealthMult * lvlScale);
        allEnemies.push({
            type: 'alien_small', x: s.x, y: GROUND_Y - 32, width: 28, height: 32,
            vx: 2.0 * d.enemySpeedMult, vy: 0, patrolLeft: s.pl, patrolRight: s.pr,
            health: hp, maxHealth: hp, alive: true, hitFlash: 0, facing: 1,
            shootTimer: 0, shootCooldown: Math.floor(140 * d.shootCooldownMult), hidden: true, revealTimer: 0,
            onGround: true, jumpCooldown: 0, canJump: true,
        });
    }

    // STAGE 4: Red Laser Lines — shoot from angles, acid
    const stage4 = [
        { x: 11100, pl: 10800, pr: 11400 }, { x: 11700, pl: 11550, pr: 12075 },
        { x: 12450, pl: 12300, pr: 12825 }, { x: 13050, pl: 12825, pr: 13350 },
        { x: 13650, pl: 13425, pr: 13950 }, { x: 11400, pl: 11100, pr: 11700 },
        { x: 12750, pl: 12450, pr: 13050 },
    ];
    for (const s of stage4) {
        const hp = Math.ceil(5 * d.enemyHealthMult * lvlScale);
        allEnemies.push({
            type: 'laser_line', x: s.x, y: GROUND_Y - 20, width: 60, height: 8,
            vx: 2.5 * d.enemySpeedMult, patrolLeft: s.pl, patrolRight: s.pr,
            health: hp, maxHealth: hp, alive: true, hitFlash: 0, facing: 1,
            shootTimer: 0, shootCooldown: Math.floor(120 * d.shootCooldownMult), angle: 0, acidTimer: 0,
        });
    }

    // STAGES 3-4: Flying Shoes — hover and drop poo (level 3+ only)
    if (currentLevel >= 3) {
    const shoeColors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'];
    const flyingShoes3 = [
        { x: 7800, pl: 7400, pr: 8400 },
        { x: 9000, pl: 8600, pr: 9600 },
        { x: 10200, pl: 9800, pr: 10600 },
    ];
    for (const s of flyingShoes3) {
        const hp = Math.ceil(3 * d.enemyHealthMult * lvlScale);
        const baseY3 = 140 + Math.random() * 80;
        allEnemies.push({
            type: 'flying_shoe', x: s.x, y: baseY3, width: 36, height: 20,
            vx: 1.2 * d.enemySpeedMult, patrolLeft: s.pl, patrolRight: s.pr,
            health: hp, maxHealth: hp, alive: true, hitFlash: 0, facing: 1,
            shootTimer: 0, shootCooldown: Math.floor(160 * d.shootCooldownMult),
            flyBaseY: baseY3,
            shoeColor: shoeColors[Math.floor(Math.random() * shoeColors.length)],
        });
    }

    const flyingShoes4 = [
        { x: 11200, pl: 10900, pr: 11800 },
        { x: 12200, pl: 11800, pr: 12800 },
        { x: 13200, pl: 12800, pr: 13800 },
        { x: 13800, pl: 13400, pr: 14200 },
    ];
    for (const s of flyingShoes4) {
        const hp = Math.ceil(4 * d.enemyHealthMult * lvlScale);
        const baseY4 = 120 + Math.random() * 60;
        allEnemies.push({
            type: 'flying_shoe', x: s.x, y: baseY4, width: 36, height: 20,
            vx: 1.5 * d.enemySpeedMult, patrolLeft: s.pl, patrolRight: s.pr,
            health: hp, maxHealth: hp, alive: true, hitFlash: 0, facing: 1,
            shootTimer: 0, shootCooldown: Math.floor(120 * d.shootCooldownMult),
            flyBaseY: baseY4,
            shoeColor: shoeColors[Math.floor(Math.random() * shoeColors.length)],
        });
    }
    } // end currentLevel >= 3 check

    // Tag each enemy with its stage and count per stage for kill gate
    stageEnemyCounts = [0, 0, 0, 0];
    for (const e of allEnemies) {
        e.stage = Math.min(3, Math.floor(e.x / STAGE_WIDTH));
        stageEnemyCounts[e.stage]++;
    }
    stageKillCounts = [0, 0, 0, 0];

    return allEnemies;
}

let enemies = createEnemies();

// ============================================================
// COLLECTIBLES — Football Stickers
// ============================================================
let stickersCollected = 0;

function createStickers() {
    const stickers = [];
    // Spread across all 4 stages — some easy, some on platforms
    const positions = [
        // Stage 1 — South Farnham School (12 stickers)
        { x: 300, y: GROUND_Y - 30 }, { x: 600, y: 360 }, { x: 900, y: GROUND_Y - 30 },
        { x: 1200, y: 310 }, { x: 1500, y: GROUND_Y - 30 }, { x: 1800, y: 340 },
        { x: 2100, y: GROUND_Y - 30 }, { x: 2400, y: 320 }, { x: 2700, y: 370 },
        { x: 3000, y: GROUND_Y - 30 }, { x: 3300, y: 330 }, { x: 1050, y: 350 },
        // Stage 2 — Farnham Castle (12 stickers)
        { x: 3750, y: GROUND_Y - 30 }, { x: 4050, y: 340 }, { x: 4350, y: 300 },
        { x: 4650, y: GROUND_Y - 30 }, { x: 5025, y: 330 }, { x: 5400, y: 290 },
        { x: 5775, y: GROUND_Y - 30 }, { x: 6075, y: 320 }, { x: 6375, y: 360 },
        { x: 6750, y: GROUND_Y - 30 }, { x: 4800, y: 310 }, { x: 6000, y: 340 },
        // Stage 3 — Farnham Town FC (12 stickers)
        { x: 7350, y: 380 }, { x: 7575, y: 330 }, { x: 7875, y: GROUND_Y - 30 },
        { x: 8175, y: 300 }, { x: 8475, y: 340 }, { x: 8850, y: 290 },
        { x: 9225, y: GROUND_Y - 30 }, { x: 9600, y: 320 }, { x: 9975, y: 360 },
        { x: 10350, y: GROUND_Y - 30 }, { x: 8700, y: 310 }, { x: 10050, y: 340 },
        // Stage 4 — Bourne Woods (12 stickers)
        { x: 10950, y: GROUND_Y - 30 }, { x: 11250, y: 360 }, { x: 11550, y: 310 },
        { x: 11850, y: GROUND_Y - 30 }, { x: 12225, y: 330 }, { x: 12600, y: 290 },
        { x: 12900, y: GROUND_Y - 30 }, { x: 13200, y: 340 }, { x: 13575, y: 370 },
        { x: 13950, y: GROUND_Y - 30 }, { x: 12000, y: 300 }, { x: 13350, y: 320 },
    ];
    for (const p of positions) {
        stickers.push({ x: p.x, y: p.y, width: 20, height: 20, collected: false, bobOffset: Math.random() * Math.PI * 2 });
    }
    return stickers;
}

let stickers = createStickers();

// ============================================================
// WEAPON PICKUPS — for The Bombarder fight
// ============================================================
let weaponsCollected = 0;

function createWeaponPickups() {
    // Rarer than stickers — one per stage, hidden on harder-to-reach platforms
    return [
        { x: 1305, y: 310, width: 24, height: 24, collected: false, type: 'shield', bobOffset: 0 },
        { x: 4395, y: 300, width: 24, height: 24, collected: false, type: 'power', bobOffset: 1 },
        { x: 8580, y: 300, width: 24, height: 24, collected: false, type: 'blast', bobOffset: 2 },
        { x: 12180, y: 280, width: 24, height: 24, collected: false, type: 'mega', bobOffset: 3 },
    ];
}

let weaponPickups = createWeaponPickups();

// ============================================================
// HEALTH HEARTS — red hearts that restore 1 HP
// ============================================================
function createHearts() {
    // 2 per stage — rarer than stickers, placed on platforms
    return [
        // Stage 1
        { x: 825, y: 340, width: 18, height: 18, collected: false, bobOffset: 0.5 },
        { x: 2700, y: 310, width: 18, height: 18, collected: false, bobOffset: 1.2 },
        // Stage 2
        { x: 4500, y: 310, width: 18, height: 18, collected: false, bobOffset: 2.0 },
        { x: 6150, y: 330, width: 18, height: 18, collected: false, bobOffset: 2.8 },
        // Stage 3
        { x: 8025, y: 320, width: 18, height: 18, collected: false, bobOffset: 3.5 },
        { x: 9750, y: 300, width: 18, height: 18, collected: false, bobOffset: 4.1 },
        // Stage 4
        { x: 11475, y: 340, width: 18, height: 18, collected: false, bobOffset: 5.0 },
        { x: 13350, y: 310, width: 18, height: 18, collected: false, bobOffset: 5.7 },
    ];
}

let hearts = createHearts();

// ============================================================
// COMPANION POWER-UPS — Jules & The Fishies
// ============================================================
let activeCompanion = null; // { type: 'jules' or 'fishies', timer: N, ability: string }
let companionCooldown = 0;

// Visual effects (claw slashes, sound waves, etc.)
let visualEffects = [];

// Particles system (dust, sparks, death puffs)
let particles = [];

// Screen shake
let screenShake = { x: 0, y: 0, intensity: 0, timer: 0 };

function addScreenShake(intensity, duration) {
    screenShake.intensity = intensity;
    screenShake.timer = duration;
}

function updateScreenShake() {
    if (screenShake.timer > 0) {
        screenShake.x = (Math.random() - 0.5) * screenShake.intensity * 2;
        screenShake.y = (Math.random() - 0.5) * screenShake.intensity * 2;
        screenShake.timer--;
        screenShake.intensity *= 0.92;
    } else {
        screenShake.x = 0;
        screenShake.y = 0;
    }
}

function spawnParticles(x, y, color, count, spread, speed) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x + (Math.random() - 0.5) * spread,
            y: y + (Math.random() - 0.5) * spread,
            vx: (Math.random() - 0.5) * speed,
            vy: -Math.random() * speed * 0.8 - 1,
            life: 30 + Math.random() * 30,
            maxLife: 60,
            size: 2 + Math.random() * 3,
            color: color,
            gravity: 0.08,
        });
    }
}

function updateParticles() {
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.life--;
    }
    particles = particles.filter(p => p.life > 0);
}

function spawnEnemyDeathEffect(e) {
    // Big burst of coloured particles matching enemy type
    const colors = {
        'spike': ['#8e44ad', '#9b59b6', '#c39bd3'],
        'alien_giant': ['#27ae60', '#8e44ad', '#e67e22'],
        'alien_small': ['#2ecc71', '#f39c12', '#e74c3c'],
        'laser_line': ['#e74c3c', '#ff6b6b', '#c0392b'],
    };
    const cols = colors[e.type] || ['#fff', '#ddd', '#aaa'];
    const cx = e.x + e.width / 2;
    const cy = e.y + e.height / 2;
    for (let i = 0; i < 15; i++) {
        const col = cols[Math.floor(Math.random() * cols.length)];
        particles.push({
            x: cx + (Math.random() - 0.5) * e.width,
            y: cy + (Math.random() - 0.5) * e.height,
            vx: (Math.random() - 0.5) * 6,
            vy: -Math.random() * 5 - 2,
            life: 40 + Math.random() * 30,
            maxLife: 70,
            size: 3 + Math.random() * 4,
            color: col,
            gravity: 0.12,
        });
    }
    addScreenShake(4, 10);
}

function spawnLandingDust() {
    for (let i = 0; i < 4; i++) {
        particles.push({
            x: player.x + player.width / 2 + (Math.random() - 0.5) * 20,
            y: player.y + player.height,
            vx: (Math.random() - 0.5) * 2,
            vy: -Math.random() * 1.5,
            life: 15 + Math.random() * 10,
            maxLife: 25,
            size: 2 + Math.random() * 2,
            color: '#b0a090',
            gravity: 0.02,
        });
    }
}

function drawParticles() {
    for (const p of particles) {
        const sx = p.x - cameraX;
        if (sx < -20 || sx > SCREEN_W + 20) continue;
        const alpha = Math.min(1, p.life / (p.maxLife * 0.3));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(sx, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function createCompanionPickups() {
    // Alternate Jules and Fishies through the level
    return [
        { x: 900, y: GROUND_Y - 30, width: 28, height: 28, collected: false, companion: 'jules', bobOffset: 0.5 },
        { x: 2850, y: 340, width: 28, height: 28, collected: false, companion: 'fishies', bobOffset: 1.5 },
        { x: 4800, y: GROUND_Y - 30, width: 28, height: 28, collected: false, companion: 'jules', bobOffset: 2.5 },
        { x: 6750, y: 310, width: 28, height: 28, collected: false, companion: 'fishies', bobOffset: 3.5 },
        { x: 8250, y: GROUND_Y - 30, width: 28, height: 28, collected: false, companion: 'jules', bobOffset: 4.5 },
        { x: 10050, y: 310, width: 28, height: 28, collected: false, companion: 'fishies', bobOffset: 5.5 },
        { x: 11850, y: GROUND_Y - 30, width: 28, height: 28, collected: false, companion: 'jules', bobOffset: 6.5 },
        { x: 13350, y: 340, width: 28, height: 28, collected: false, companion: 'fishies', bobOffset: 7.5 },
    ];
}

let companionPickups = createCompanionPickups();

// ============================================================
// WIN FLAG — end of level
// ============================================================
const winFlag = {
    x: LEVEL_WIDTH - 100,
    y: GROUND_Y - 80,
    width: 40,
    height: 80,
};

// ============================================================
// DRAWING FUNCTIONS
// ============================================================

function drawBackground() {
    // Sky gradient — themed per level, darkens per stage
    const level = getCurrentLevel();
    const sky = level.sky[currentStage - 1] || level.sky[0];
    const grad = ctx.createLinearGradient(0, 0, 0, SCREEN_H);
    grad.addColorStop(0, sky[0]);
    grad.addColorStop(0.7, sky[1]);
    grad.addColorStop(1, sky[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    // Themed per level
    const bgType = getCurrentLevel().bgType;

    // === FAR HORIZON LAYER (parallax 0.15) ===
    drawDistantHorizon(bgType);

    // Parallax clouds
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 8; i++) {
        const cx = ((i * 600 + 100) - cameraX * PARALLAX.CLOUDS) % (LEVEL_WIDTH + 400) - 100;
        const cy = 40 + (i % 3) * 50;
        drawCloud(cx, cy);
    }

    if (bgType === 'castle') {
        // Castle turrets and walls
        for (let i = 0; i < 8; i++) {
            const hx = ((i * 500) - cameraX * 0.4);
            if (hx > -120 && hx < SCREEN_W + 120) {
                drawCastleTower(hx, 280 + (i % 2) * 40, i);
            }
        }
    } else if (bgType === 'stadium') {
        // Stadium stands
        for (let i = 0; i < 6; i++) {
            const hx = ((i * 600 + 100) - cameraX * 0.4);
            if (hx > -200 && hx < SCREEN_W + 200) {
                drawStadiumStand(hx, 300 + (i % 2) * 20, i);
            }
        }
    } else if (bgType === 'forest') {
        // Dense forest trees (more and taller)
        for (let i = 0; i < 20; i++) {
            const tx = ((i * 250 + 30) - cameraX * 0.35);
            if (tx > -80 && tx < SCREEN_W + 80) {
                drawForestTree(tx, 260 + (i % 3) * 40, i);
            }
        }
    } else if (bgType === 'london') {
        // London skyline — Big Ben, Gherkin, Shard silhouettes
        for (let i = 0; i < 10; i++) {
            const hx = ((i * 450) - cameraX * 0.4);
            if (hx > -120 && hx < SCREEN_W + 120) {
                drawLondonBuilding(hx, 300 + (i % 2) * 20, i);
            }
        }
    } else {
        // Default: houses (school level)
        for (let i = 0; i < 12; i++) {
            const hx = ((i * 400) - cameraX * 0.4);
            if (hx > -120 && hx < SCREEN_W + 120) {
                drawHouse(hx, 320 + (i % 2) * 30, i);
            }
        }
    }

    // Trees (fewer in stadium/london, more in forest)
    const treeCount = bgType === 'forest' ? 0 : (bgType === 'stadium' || bgType === 'london') ? 6 : 15;
    for (let i = 0; i < treeCount; i++) {
        const tx = ((i * 350 + 50) - cameraX * 0.5);
        if (tx > -60 && tx < SCREEN_W + 60) {
            drawTree(tx, 360 + (i % 3) * 20);
        }
    }

    // Foreground detail layer (parallax 0.7) — themed per level
    for (let i = 0; i < 20; i++) {
        const dx = ((i * 480 + 200) - cameraX * 0.7);
        if (dx > -60 && dx < SCREEN_W + 60) {
            const type = i % 4;
            if (bgType === 'forest') {
                // Forest: mushrooms, logs, bushes
                if (type === 0 || type === 2) drawBushes(dx, GROUND_Y - 18);
                else drawLampPost(dx, GROUND_Y - 80); // repurpose as dead tree
            } else if (bgType === 'castle') {
                if (type === 0) drawLampPost(dx, GROUND_Y - 80); // torch
                else if (type === 1) drawBushes(dx, GROUND_Y - 18);
                else drawPostBox(dx, GROUND_Y - 40); // barrel
            } else if (bgType === 'stadium') {
                if (type === 0) drawLampPost(dx, GROUND_Y - 80); // floodlight
                else drawBushes(dx, GROUND_Y - 18);
            } else if (bgType === 'london') {
                if (type === 0) drawPostBox(dx, GROUND_Y - 40);
                else if (type === 1) drawLampPost(dx, GROUND_Y - 80);
                else if (type === 2) drawPhoneBox(dx, GROUND_Y - 55);
                else drawBushes(dx, GROUND_Y - 18);
            } else {
                // School default
                if (type === 0) drawPostBox(dx, GROUND_Y - 40);
                else if (type === 1) drawLampPost(dx, GROUND_Y - 80);
                else if (type === 2) drawPhoneBox(dx, GROUND_Y - 55);
                else drawBushes(dx, GROUND_Y - 18);
            }
        }
    }

    // Easter egg signs (parallax 0.6) — themed per level
    const levelSigns = getCurrentLevel().signs;
    const signs = [
        { x: 800, text: levelSigns[0] || '' },
        { x: 2600, text: levelSigns[1] || '' },
        { x: 4200, text: levelSigns[2] || '' },
        { x: 5800, text: levelSigns[3] || '' },
        { x: 7400, text: levelSigns[4] || '' },
        { x: 9000, text: levelSigns[5] || '' },
    ];
    for (const sign of signs) {
        const sx = sign.x - cameraX * 0.6;
        if (sx > -80 && sx < SCREEN_W + 80) {
            drawStreetSign(sx, 350, sign.text);
        }
    }
}

function drawCloud(x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 25, 0, Math.PI * 2);
    ctx.arc(x + 25, y - 10, 30, 0, Math.PI * 2);
    ctx.arc(x + 50, y, 25, 0, Math.PI * 2);
    ctx.fill();
}

function drawDistantHorizon(bgType) {
    const horizonY = 320;  // where the distant layer sits
    ctx.save();

    if (bgType === 'forest') {
        // Rolling green hills
        const hillColors = ['#2d5a27','#3a7a33','#4a8a43'];
        for (let layer = 0; layer < 3; layer++) {
            ctx.fillStyle = hillColors[layer];
            ctx.beginPath();
            ctx.moveTo(0, SCREEN_H);
            for (let i = -1; i < 14; i++) {
                const hx = i * 180 - (cameraX * (PARALLAX.FAR + layer * 0.03)) % 180;
                const hy = horizonY - 20 + layer * 30 + Math.sin(i * 0.8 + layer) * 25;
                ctx.quadraticCurveTo(hx + 60, hy - 30, hx + 120, hy);
            }
            ctx.lineTo(SCREEN_W + 100, SCREEN_H);
            ctx.closePath();
            ctx.fill();
        }
    } else if (bgType === 'london') {
        // City skyline silhouette
        ctx.fillStyle = 'rgba(60,70,90,0.4)';
        ctx.beginPath();
        ctx.moveTo(0, SCREEN_H);
        const buildings = [80,120,60,180,70,140,200,90,110,160,65,130,150,85,170,100];
        for (let i = 0; i < buildings.length; i++) {
            const bx = i * 120 - (cameraX * PARALLAX.FAR) % 120;
            const bh = buildings[i] * 0.6;
            ctx.lineTo(bx, horizonY - bh);
            ctx.lineTo(bx + 40, horizonY - bh);
            ctx.lineTo(bx + 40, horizonY - bh + 15);
            ctx.lineTo(bx + 80, horizonY - bh + 15);
        }
        ctx.lineTo(SCREEN_W + 200, SCREEN_H);
        ctx.closePath();
        ctx.fill();
        // Shard-like spire
        const spireX = 600 - (cameraX * PARALLAX.FAR) % 1200;
        ctx.fillStyle = 'rgba(80,90,110,0.3)';
        ctx.beginPath();
        ctx.moveTo(spireX, horizonY - 140);
        ctx.lineTo(spireX - 15, horizonY);
        ctx.lineTo(spireX + 15, horizonY);
        ctx.closePath();
        ctx.fill();
    } else if (bgType === 'castle') {
        // Distant castle walls and battlements
        ctx.fillStyle = 'rgba(100,95,85,0.35)';
        for (let i = -1; i < 10; i++) {
            const wx = i * 250 - (cameraX * PARALLAX.FAR) % 250;
            // Wall segment
            ctx.fillRect(wx, horizonY - 60, 200, 60);
            // Battlements
            for (let b = 0; b < 8; b++) {
                ctx.fillRect(wx + b * 25, horizonY - 72, 15, 12);
            }
        }
        // Distant tower
        const towerX = 400 - (cameraX * PARALLAX.FAR) % 800;
        ctx.fillStyle = 'rgba(90,85,75,0.4)';
        ctx.fillRect(towerX, horizonY - 110, 30, 110);
        ctx.beginPath();
        ctx.moveTo(towerX - 5, horizonY - 110);
        ctx.lineTo(towerX + 15, horizonY - 130);
        ctx.lineTo(towerX + 35, horizonY - 110);
        ctx.closePath();
        ctx.fill();
    } else if (bgType === 'stadium') {
        // Distant grandstand arc
        ctx.fillStyle = 'rgba(70,80,100,0.3)';
        ctx.beginPath();
        ctx.moveTo(-50, horizonY + 20);
        for (let i = 0; i <= 20; i++) {
            const sx = (i / 20) * (SCREEN_W + 100) - 50;
            const sy = horizonY - Math.sin((i / 20) * Math.PI) * 60;
            ctx.lineTo(sx - (cameraX * PARALLAX.FAR) % 50, sy);
        }
        ctx.lineTo(SCREEN_W + 50, horizonY + 20);
        ctx.closePath();
        ctx.fill();
    } else {
        // School: gentle green hills with church spire
        const hillColors = ['#5a8a4a','#6a9a5a'];
        for (let layer = 0; layer < 2; layer++) {
            ctx.fillStyle = hillColors[layer];
            ctx.beginPath();
            ctx.moveTo(0, SCREEN_H);
            for (let i = -1; i < 14; i++) {
                const hx = i * 200 - (cameraX * (PARALLAX.FAR + layer * 0.04)) % 200;
                const hy = horizonY + layer * 25 + Math.sin(i * 0.7 + layer * 2) * 20;
                ctx.quadraticCurveTo(hx + 70, hy - 20, hx + 140, hy);
            }
            ctx.lineTo(SCREEN_W + 100, SCREEN_H);
            ctx.closePath();
            ctx.fill();
        }
        // Church spire
        const spireX = 800 - (cameraX * PARALLAX.FAR) % 1000;
        ctx.fillStyle = 'rgba(80,80,80,0.35)';
        ctx.fillRect(spireX - 8, horizonY - 60, 16, 60);
        ctx.beginPath();
        ctx.moveTo(spireX, horizonY - 80);
        ctx.lineTo(spireX - 10, horizonY - 60);
        ctx.lineTo(spireX + 10, horizonY - 60);
        ctx.closePath();
        ctx.fill();
    }

    ctx.restore();
}

function drawHouse(x, y, index) {
    const brickColors = ['#c0392b', '#b03a2e', '#d35400', '#a04030', '#c0392b', '#b85c38'];
    const doorColors = ['#1a5276', '#8B4513', '#1a5276', '#6c3483', '#c0392b', '#2c3e50'];
    // House body — brick
    ctx.fillStyle = brickColors[index % brickColors.length];
    ctx.fillRect(x, y, 80, 60);
    // Brick detail
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.5;
    for (let by = y + 8; by < y + 60; by += 8) {
        const offset = (Math.floor((by - y) / 8) % 2) * 10;
        for (let bx = x + offset; bx < x + 80; bx += 20) {
            ctx.strokeRect(bx, by, 20, 8);
        }
    }
    // Roof — slate grey tiles
    ctx.fillStyle = '#34495e';
    ctx.beginPath();
    ctx.moveTo(x - 10, y);
    ctx.lineTo(x + 40, y - 35);
    ctx.lineTo(x + 90, y);
    ctx.closePath();
    ctx.fill();
    // Roof ridge line
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 10, y); ctx.lineTo(x + 40, y - 35); ctx.lineTo(x + 90, y);
    ctx.stroke();
    // Chimney
    if (index % 3 !== 1) {
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(x + 60, y - 30, 12, 20);
        ctx.fillStyle = '#95a5a6';
        ctx.fillRect(x + 58, y - 32, 16, 4);
        // Smoke wisps
        ctx.fillStyle = 'rgba(200,200,200,0.3)';
        const smokeT = frameTime * 0.001;
        ctx.beginPath();
        ctx.arc(x + 66 + Math.sin(smokeT + index) * 3, y - 38, 4, 0, Math.PI * 2);
        ctx.arc(x + 64 + Math.sin(smokeT + index + 1) * 4, y - 46, 3, 0, Math.PI * 2);
        ctx.fill();
    }
    // Door
    ctx.fillStyle = doorColors[index % doorColors.length];
    ctx.fillRect(x + 30, y + 22, 20, 38);
    // Door knob
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath(); ctx.arc(x + 44, y + 42, 2, 0, Math.PI * 2); ctx.fill();
    // Door number
    ctx.fillStyle = '#fff';
    ctx.font = '7px serif';
    ctx.textAlign = 'center';
    ctx.fillText('' + (index * 2 + 1), x + 40, y + 32);
    ctx.textAlign = 'left';
    // Windows with curtains
    const winGlow = currentStage >= 3 ? '#f9e784' : 'rgba(249,231,132,0.6)';
    ctx.fillStyle = winGlow;
    ctx.fillRect(x + 8, y + 10, 16, 16);
    ctx.fillRect(x + 56, y + 10, 16, 16);
    // Window frames
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 8, y + 10, 16, 16);
    ctx.strokeRect(x + 56, y + 10, 16, 16);
    // Window cross dividers
    ctx.beginPath();
    ctx.moveTo(x + 16, y + 10); ctx.lineTo(x + 16, y + 26);
    ctx.moveTo(x + 8, y + 18); ctx.lineTo(x + 24, y + 18);
    ctx.moveTo(x + 64, y + 10); ctx.lineTo(x + 64, y + 26);
    ctx.moveTo(x + 56, y + 18); ctx.lineTo(x + 72, y + 18);
    ctx.stroke();
    // Curtains
    ctx.fillStyle = 'rgba(155, 89, 182, 0.3)';
    ctx.fillRect(x + 8, y + 10, 4, 16);
    ctx.fillRect(x + 20, y + 10, 4, 16);
    ctx.fillRect(x + 56, y + 10, 4, 16);
    ctx.fillRect(x + 68, y + 10, 4, 16);
}

function drawTree(x, y) {
    // Trunk
    ctx.fillStyle = '#8B5E3C';
    ctx.fillRect(x - 5, y, 10, 40);
    // Leaves
    ctx.fillStyle = '#27ae60';
    ctx.beginPath();
    ctx.arc(x, y - 10, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.arc(x + 10, y - 5, 20, 0, Math.PI * 2);
    ctx.fill();
}

// --- LEVEL-THEMED BACKGROUND DRAWINGS ---

function drawCastleTower(x, y, index) {
    const w = 80 + (index % 3) * 20;
    const h = 120 + (index % 2) * 40;
    // Stone wall
    ctx.fillStyle = '#8a7a6a';
    ctx.fillRect(x, y, w, h);
    // Battlements
    ctx.fillStyle = '#7a6a5a';
    for (let b = 0; b < Math.floor(w / 16); b++) {
        ctx.fillRect(x + b * 16, y - 12, 10, 12);
    }
    // Arrow slits
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(x + w * 0.3, y + h * 0.3, 4, 16);
    ctx.fillRect(x + w * 0.6, y + h * 0.3, 4, 16);
    // Tower top (on some)
    if (index % 3 === 0) {
        ctx.fillStyle = '#6a5a4a';
        ctx.beginPath();
        ctx.moveTo(x - 5, y);
        ctx.lineTo(x + w / 2, y - 30);
        ctx.lineTo(x + w + 5, y);
        ctx.fill();
    }
    // Stone lines
    ctx.strokeStyle = '#6a5a4a';
    ctx.lineWidth = 1;
    for (let row = 0; row < Math.floor(h / 20); row++) {
        const ry = y + row * 20;
        ctx.beginPath();
        ctx.moveTo(x, ry);
        ctx.lineTo(x + w, ry);
        ctx.stroke();
    }
}

function drawStadiumStand(x, y, index) {
    const w = 160;
    const h = 100 + (index % 2) * 20;
    // Stand structure
    ctx.fillStyle = '#445566';
    ctx.fillRect(x, y, w, h);
    // Seats (rows of colored dots)
    const seatColors = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71'];
    for (let row = 0; row < 4; row++) {
        for (let seat = 0; seat < 10; seat++) {
            ctx.fillStyle = seatColors[(row + seat + index) % 4];
            ctx.beginPath();
            ctx.arc(x + 10 + seat * 15, y + 15 + row * 20, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    // Roof
    ctx.fillStyle = '#334455';
    ctx.fillRect(x - 10, y - 8, w + 20, 8);
    // Floodlight on some
    if (index % 2 === 0) {
        ctx.fillStyle = '#555';
        ctx.fillRect(x + w / 2 - 3, y - 50, 6, 42);
        ctx.fillStyle = '#ff8';
        ctx.beginPath();
        ctx.arc(x + w / 2, y - 52, 8, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawForestTree(x, y, index) {
    const h = 100 + (index % 3) * 30;
    const trunkW = 8 + (index % 2) * 4;
    // Trunk
    ctx.fillStyle = index % 4 === 0 ? '#5a4030' : '#6a5040';
    ctx.fillRect(x - trunkW / 2, y, trunkW, h);
    // Canopy (multiple layers)
    const colors = ['#1a5a1a', '#2a6a2a', '#1a4a0a'];
    for (let c = 0; c < 3; c++) {
        ctx.fillStyle = colors[c];
        ctx.beginPath();
        ctx.arc(x + (c - 1) * 12, y - 10 - c * 8, 28 + c * 5, 0, Math.PI * 2);
        ctx.fill();
    }
    // Some trees have exposed roots
    if (index % 3 === 0) {
        ctx.strokeStyle = '#5a4030';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - trunkW, y + h);
        ctx.quadraticCurveTo(x - 20, y + h + 5, x - 25, y + h + 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + trunkW, y + h);
        ctx.quadraticCurveTo(x + 20, y + h + 5, x + 25, y + h + 10);
        ctx.stroke();
    }
}

function drawLondonBuilding(x, y, index) {
    const type = index % 5;
    if (type === 0) {
        // Big Ben silhouette
        ctx.fillStyle = '#556677';
        ctx.fillRect(x, y - 60, 30, 160);
        ctx.fillRect(x - 5, y - 70, 40, 15);
        // Clock face
        ctx.fillStyle = '#ddd';
        ctx.beginPath();
        ctx.arc(x + 15, y - 50, 10, 0, Math.PI * 2);
        ctx.fill();
        // Spire
        ctx.fillStyle = '#445566';
        ctx.beginPath();
        ctx.moveTo(x + 5, y - 70);
        ctx.lineTo(x + 15, y - 100);
        ctx.lineTo(x + 25, y - 70);
        ctx.fill();
    } else if (type === 1) {
        // The Gherkin
        ctx.fillStyle = '#5577aa';
        ctx.beginPath();
        ctx.ellipse(x + 20, y + 20, 22, 80, 0, 0, Math.PI * 2);
        ctx.fill();
        // Glass panels
        ctx.strokeStyle = '#4466aa';
        ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
            ctx.beginPath();
            ctx.moveTo(x + 20, y - 50 + i * 24);
            ctx.lineTo(x + 42, y - 38 + i * 24);
            ctx.stroke();
        }
    } else if (type === 2) {
        // The Shard
        ctx.fillStyle = '#667788';
        ctx.beginPath();
        ctx.moveTo(x, y + 100);
        ctx.lineTo(x + 20, y - 80);
        ctx.lineTo(x + 40, y + 100);
        ctx.fill();
        ctx.strokeStyle = '#556677';
        ctx.lineWidth = 1;
        for (let i = 0; i < 8; i++) {
            const ly = y - 60 + i * 20;
            ctx.beginPath();
            ctx.moveTo(x + 5, ly);
            ctx.lineTo(x + 35, ly);
            ctx.stroke();
        }
    } else {
        // Generic London building
        const w = 50 + (index % 3) * 20;
        const h = 80 + (index % 2) * 40;
        ctx.fillStyle = '#667';
        ctx.fillRect(x, y, w, h);
        // Windows
        ctx.fillStyle = '#ffd';
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                ctx.fillRect(x + 8 + c * (w / 3 - 2), y + 10 + r * 25, 8, 12);
            }
        }
    }
}

function drawPostBox(x, y) {
    // Classic red Royal Mail post box
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.roundRect(x - 10, y, 20, 40, [4, 4, 0, 0]);
    ctx.fill();
    // Top dome
    ctx.beginPath();
    ctx.arc(x, y, 10, Math.PI, 0);
    ctx.fill();
    // Gold cap
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(x, y, 10, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(x, y, 7, Math.PI, 0);
    ctx.fill();
    // Letter slot
    ctx.fillStyle = '#1a0000';
    ctx.fillRect(x - 6, y + 12, 12, 3);
    // ER emblem
    ctx.fillStyle = '#f1c40f';
    ctx.font = '6px serif';
    ctx.textAlign = 'center';
    ctx.fillText('ER', x, y + 26);
    ctx.textAlign = 'left';
}

function drawLampPost(x, y) {
    // Victorian-style street lamp
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(x - 2, y, 4, 80);
    // Base
    ctx.fillRect(x - 8, y + 75, 16, 5);
    // Lamp housing
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(x - 10, y - 5, 20, 12);
    // Lamp glow
    const glowAlpha = currentStage >= 3 ? 0.6 : 0.2;
    ctx.fillStyle = `rgba(241, 196, 15, ${glowAlpha})`;
    ctx.beginPath();
    ctx.arc(x, y + 2, 6, 0, Math.PI * 2);
    ctx.fill();
    if (currentStage >= 3) {
        ctx.fillStyle = 'rgba(241, 196, 15, 0.1)';
        ctx.beginPath();
        ctx.arc(x, y + 15, 20, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawPhoneBox(x, y) {
    // Classic red telephone box
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(x - 10, y, 20, 55);
    // Top
    ctx.fillStyle = '#a93226';
    ctx.fillRect(x - 12, y - 3, 24, 6);
    // Crown on top
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(x - 3, y - 6, 6, 4);
    // Window panes
    ctx.fillStyle = 'rgba(135, 206, 235, 0.5)';
    ctx.fillRect(x - 6, y + 6, 12, 18);
    ctx.fillRect(x - 6, y + 28, 12, 18);
    // Window dividers
    ctx.strokeStyle = '#a93226';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + 6); ctx.lineTo(x, y + 24);
    ctx.moveTo(x, y + 28); ctx.lineTo(x, y + 46);
    ctx.stroke();
    // TELEPHONE text
    ctx.fillStyle = '#fff';
    ctx.font = '4px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TELEPHONE', x, y + 53);
    ctx.textAlign = 'left';
}

function drawBushes(x, y) {
    // Low hedgerow — very English
    ctx.fillStyle = '#1e8449';
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.arc(x + 15, y - 2, 10, 0, Math.PI * 2);
    ctx.arc(x - 12, y + 2, 9, 0, Math.PI * 2);
    ctx.fill();
    // Lighter highlights
    ctx.fillStyle = '#27ae60';
    ctx.beginPath();
    ctx.arc(x + 5, y - 5, 6, 0, Math.PI * 2);
    ctx.fill();
}

function drawStreetSign(x, y, text) {
    // Metal pole
    ctx.fillStyle = '#7f8c8d';
    ctx.fillRect(x - 1, y, 2, 30);
    // Sign plate
    ctx.fillStyle = '#2c3e50';
    const w = text.length * 5.5 + 12;
    ctx.fillRect(x - w / 2, y - 4, w, 14);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x - w / 2 + 1, y - 3, w - 2, 12);
    // Text
    ctx.fillStyle = '#fff';
    ctx.font = '8px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y + 6);
    ctx.textAlign = 'left';
}

function drawPlatforms() {
    for (const p of platforms) {
        const sx = p.x - cameraX;
        if (sx > SCREEN_W + 20 || sx + p.width < -20) continue;

        if (p.type === 'ground') {
            // Pavement — grey paving slabs
            ctx.fillStyle = '#858585';
            ctx.fillRect(sx, p.y, p.width, p.height);
            // Paving slab grid
            ctx.strokeStyle = 'rgba(160,160,160,0.5)';
            ctx.lineWidth = 1;
            for (let lx = sx; lx < sx + p.width; lx += 40) {
                ctx.beginPath();
                ctx.moveTo(lx, p.y);
                ctx.lineTo(lx, p.y + p.height);
                ctx.stroke();
            }
            for (let ly = p.y; ly < p.y + p.height; ly += 20) {
                ctx.beginPath();
                ctx.moveTo(sx, ly);
                ctx.lineTo(sx + p.width, ly);
                ctx.stroke();
            }
            // Kerb — raised edge
            ctx.fillStyle = '#999';
            ctx.fillRect(sx, p.y, p.width, 4);
            ctx.fillStyle = '#6a6a6a';
            ctx.fillRect(sx, p.y + 4, p.width, 2);
            // Grass strip below kerb
            ctx.fillStyle = '#2d6b2d';
            ctx.fillRect(sx, p.y + p.height - 4, p.width, 4);
        } else if (p.type === 'bench') {
            // Bench seat
            ctx.fillStyle = '#8B5A2B';
            ctx.fillRect(sx, p.y, p.width, p.height);
            // Legs
            ctx.fillStyle = '#5C3A1E';
            ctx.fillRect(sx + 5, p.y + p.height, 6, 12);
            ctx.fillRect(sx + p.width - 11, p.y + p.height, 6, 12);
        } else if (p.type === 'fence') {
            // Fence post
            ctx.fillStyle = '#4a4a4a';
            ctx.fillRect(sx, p.y, p.width, p.height);
            // Pointed top
            ctx.beginPath();
            ctx.moveTo(sx, p.y);
            ctx.lineTo(sx + p.width / 2, p.y - 8);
            ctx.lineTo(sx + p.width, p.y);
            ctx.closePath();
            ctx.fillStyle = '#3a3a3a';
            ctx.fill();
        } else if (p.type === 'floating') {
            // Floating brick platform
            ctx.fillStyle = '#c0392b';
            ctx.fillRect(sx, p.y, p.width, p.height);
            ctx.strokeStyle = '#922B21';
            ctx.lineWidth = 1;
            ctx.strokeRect(sx, p.y, p.width, p.height);
            // Brick lines
            for (let bx = sx + 18; bx < sx + p.width; bx += 18) {
                ctx.beginPath();
                ctx.moveTo(bx, p.y);
                ctx.lineTo(bx, p.y + p.height);
                ctx.stroke();
            }
        }
    }
}

function drawHeath(p) {
    const sx = p.x - cameraX;
    const flash = p.invincible > 0 && Math.floor(p.invincible / 4) % 2 === 0;
    if (flash) ctx.globalAlpha = 0.4;

    ctx.save();
    const idleBob = (Math.abs(p.vx) < 0.5 && p.onGround) ? Math.sin(frameTime * 0.004) * 1.5 : 0;
    // Lean forward when running
    const runTilt = Math.abs(p.vx) > 2 ? 0.06 * p.facing : 0;
    ctx.translate(sx + p.width / 2, p.y + p.height / 2 + idleBob);
    ctx.rotate(runTilt);
    if (p.facing === -1) ctx.scale(-1, 1);

    const armSwing = Math.sin(p.animFrame * 0.3) * 6;
    const legSwing = Math.sin(p.animFrame * 0.3) * 5;

    // Shadow on ground
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(0, 40, 14, 4, 0, 0, Math.PI * 2); ctx.fill();

    // -- BACK ARM (behind body) --
    ctx.fillStyle = '#222';
    if (!p.isAttacking) {
        ctx.save();
        ctx.translate(-13, 2);
        ctx.rotate(armSwing * 0.04);
        ctx.fillRect(-3, 0, 7, 16);
        // Hand
        ctx.fillStyle = '#FFD5B8';
        ctx.beginPath(); ctx.arc(0, 16, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    // -- BACK LEG --
    ctx.save();
    ctx.translate(-6, 28);
    ctx.rotate(-legSwing * 0.04);
    ctx.fillStyle = '#FFD5B8';
    ctx.fillRect(-4, 0, 8, 11);
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath(); ctx.roundRect(-5, 9, 10, 6, 2); ctx.fill();
    // Shoe sole
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-5, 14, 10, 2);
    ctx.restore();

    // -- BODY — black hoodie --
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.roundRect(-14, -6, 28, 26, 3);
    ctx.fill();
    // Hoodie shading — lighter on chest
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(-10, -2, 20, 16);
    // Hoodie pocket
    ctx.fillStyle = '#151515';
    ctx.beginPath(); ctx.roundRect(-8, 10, 16, 7, 2); ctx.fill();
    // Hoodie zip line
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, 18); ctx.stroke();
    // Hood shape (shoulders)
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(0, -8, 16, Math.PI, 0); ctx.fill();
    // Hood rim
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, -8, 15, Math.PI + 0.3, -0.3); ctx.stroke();

    // Red shorts with white stripe
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath(); ctx.roundRect(-12, 18, 24, 12, [0,0,3,3]); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(-12, 18, 24, 2);

    // -- FRONT LEG --
    ctx.save();
    ctx.translate(6, 28);
    ctx.rotate(legSwing * 0.04);
    ctx.fillStyle = '#FFD5B8';
    ctx.fillRect(-4, 0, 8, 11);
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath(); ctx.roundRect(-5, 9, 10, 6, 2); ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-5, 14, 10, 2);
    ctx.restore();

    // -- HEAD / FACE --
    // Neck
    ctx.fillStyle = '#EDCBAA';
    ctx.fillRect(-3, -10, 6, 5);
    // Head shape
    ctx.fillStyle = '#FFD5B8';
    ctx.beginPath(); ctx.arc(0, -16, 13, 0, Math.PI * 2); ctx.fill();
    // Cheek blush
    ctx.fillStyle = 'rgba(255,180,150,0.3)';
    ctx.beginPath(); ctx.arc(-8, -12, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(8, -12, 4, 0, Math.PI * 2); ctx.fill();
    // Ears
    ctx.fillStyle = '#EDCBAA';
    ctx.beginPath(); ctx.arc(-12, -15, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(12, -15, 3, 0, Math.PI * 2); ctx.fill();

    // Blonde hair — fuller, layered
    ctx.fillStyle = '#F5D76E';
    ctx.beginPath(); ctx.arc(0, -20, 13, Math.PI + 0.2, -0.2); ctx.fill();
    ctx.fillRect(-11, -28, 22, 7);
    // Hair highlights
    ctx.fillStyle = '#FADE82';
    ctx.beginPath(); ctx.arc(-4, -26, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, -24, 4, 0, Math.PI * 2); ctx.fill();
    // Fringe detail
    ctx.fillStyle = '#F5D76E';
    ctx.beginPath();
    ctx.moveTo(-10, -22); ctx.quadraticCurveTo(-6, -18, -2, -22);
    ctx.quadraticCurveTo(2, -18, 6, -22); ctx.quadraticCurveTo(10, -18, 12, -22);
    ctx.lineTo(12, -26); ctx.lineTo(-10, -26); ctx.closePath(); ctx.fill();

    // Blue eyes — larger with detail
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(-5, -16, 4, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(5, -16, 4, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    // Iris
    ctx.fillStyle = '#2980b9';
    ctx.beginPath(); ctx.arc(-4, -15.5, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -15.5, 3, 0, Math.PI * 2); ctx.fill();
    // Pupil
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath(); ctx.arc(-4, -15.5, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -15.5, 1.5, 0, Math.PI * 2); ctx.fill();
    // Eye shine
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-5, -17, 1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, -17, 1, 0, Math.PI * 2); ctx.fill();
    // Eyebrows
    ctx.strokeStyle = '#D4B840';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-8, -21); ctx.quadraticCurveTo(-5, -22.5, -1, -21); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2, -21); ctx.quadraticCurveTo(5, -22.5, 9, -21); ctx.stroke();

    // Mouth — smile
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(1, -10, 4, 0.2, Math.PI - 0.2); ctx.stroke();

    // -- FRONT ARM --
    ctx.fillStyle = '#222';
    if (p.isAttacking) {
        // Tackle — arms thrust forward with motion lines
        ctx.save();
        ctx.translate(10, -2);
        ctx.fillRect(0, 0, 22, 8);
        ctx.fillStyle = '#FFD5B8';
        ctx.beginPath(); ctx.arc(22, 4, 4, 0, Math.PI * 2); ctx.fill();
        // Tackle energy burst
        ctx.fillStyle = 'rgba(231, 76, 60, 0.6)';
        ctx.beginPath(); ctx.arc(28, 4, 8 + (Math.sin(frameTime * 0.02) + 1) * 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(241, 196, 15, 0.4)';
        ctx.beginPath(); ctx.arc(30, 4, 5 + (Math.sin(frameTime * 0.03) + 1) * 1.5, 0, Math.PI * 2); ctx.fill();
        // Motion lines
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1;
        for (let ml = 0; ml < 3; ml++) {
            const my = -2 + ml * 4;
            ctx.beginPath(); ctx.moveTo(-8, my); ctx.lineTo(-18, my); ctx.stroke();
        }
        ctx.restore();
    } else {
        ctx.save();
        ctx.translate(13, 2);
        ctx.rotate(-armSwing * 0.04);
        ctx.fillRect(-3, 0, 7, 16);
        ctx.fillStyle = '#FFD5B8';
        ctx.beginPath(); ctx.arc(0, 16, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    // Character outline for readability
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, -16, 13.5, 0, Math.PI * 2); ctx.stroke();

    ctx.restore();
    ctx.globalAlpha = 1;
}

function drawCharlie(p) {
    const sx = p.x - cameraX;
    const flash = p.invincible > 0 && Math.floor(p.invincible / 4) % 2 === 0;
    if (flash) ctx.globalAlpha = 0.4;

    ctx.save();
    const idleBob2 = (Math.abs(p.vx) < 0.5 && p.onGround) ? Math.sin(frameTime * 0.004) * 1.5 : 0;
    const runTilt = Math.abs(p.vx) > 2 ? 0.05 * p.facing : 0;
    ctx.translate(sx + p.width / 2, p.y + p.height / 2 + idleBob2);
    ctx.rotate(runTilt);
    if (p.facing === -1) ctx.scale(-1, 1);

    const armSwing = Math.sin(p.animFrame * 0.3) * 6;
    const legSwing = Math.sin(p.animFrame * 0.3) * 5;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(0, 40, 14, 4, 0, 0, Math.PI * 2); ctx.fill();

    // -- BACK ARM --
    if (!p.isAttacking) {
        ctx.save();
        ctx.translate(-13, 2);
        ctx.rotate(armSwing * 0.04);
        ctx.fillStyle = '#a50044';
        ctx.fillRect(-3, 0, 7, 14);
        ctx.fillStyle = '#FFD5B8';
        ctx.beginPath(); ctx.arc(0, 14, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    // -- BACK LEG --
    ctx.save();
    ctx.translate(-6, 28);
    ctx.rotate(-legSwing * 0.04);
    ctx.fillStyle = '#FFD5B8';
    ctx.fillRect(-4, 0, 8, 8);
    // Barca sock
    ctx.fillStyle = '#a50044';
    ctx.fillRect(-4, 6, 8, 5);
    // Boot
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.roundRect(-5, 10, 10, 6, 2); ctx.fill();
    // Studs
    ctx.fillStyle = '#666';
    ctx.fillRect(-3, 15, 2, 2); ctx.fillRect(3, 15, 2, 2);
    ctx.restore();

    // -- BODY — Barcelona kit --
    ctx.fillStyle = '#a50044';
    ctx.beginPath(); ctx.roundRect(-14, -6, 28, 26, 3); ctx.fill();
    // Blue stripes (classic Barca)
    ctx.fillStyle = '#004d98';
    ctx.fillRect(-14, -6, 7, 26);
    ctx.fillRect(-1, -6, 7, 26);
    ctx.fillRect(12, -6, 2, 26);
    // Kit shading
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(-14, 10, 28, 16);
    // Collar — gold V-neck
    ctx.strokeStyle = '#edbb00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, -6); ctx.lineTo(0, -1); ctx.lineTo(10, -6);
    ctx.stroke();
    // Nike-style swoosh (small)
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(4, 2); ctx.quadraticCurveTo(8, 0, 10, 3); ctx.stroke();
    // Kit number on back (small 10)
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '8px sans-serif';
    ctx.fillText('10', -5, 14);

    // Barcelona shorts
    ctx.fillStyle = '#004d98';
    ctx.beginPath(); ctx.roundRect(-12, 18, 24, 12, [0,0,3,3]); ctx.fill();
    // Shorts stripe
    ctx.fillStyle = '#a50044';
    ctx.fillRect(-12, 18, 24, 2);

    // -- FRONT LEG --
    ctx.save();
    ctx.translate(6, 28);
    ctx.rotate(legSwing * 0.04);
    if (p.isAttacking) {
        // Kicking leg swings forward
        ctx.rotate(-0.5);
    }
    ctx.fillStyle = '#FFD5B8';
    ctx.fillRect(-4, 0, 8, 8);
    ctx.fillStyle = '#a50044';
    ctx.fillRect(-4, 6, 8, 5);
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.roundRect(-5, 10, 10, 6, 2); ctx.fill();
    ctx.fillStyle = '#666';
    ctx.fillRect(-3, 15, 2, 2); ctx.fillRect(3, 15, 2, 2);
    ctx.restore();

    // -- HEAD / FACE --
    ctx.fillStyle = '#EDCBAA';
    ctx.fillRect(-3, -10, 6, 5);
    // Head
    ctx.fillStyle = '#FFD5B8';
    ctx.beginPath(); ctx.arc(0, -16, 13, 0, Math.PI * 2); ctx.fill();
    // Ears
    ctx.fillStyle = '#EDCBAA';
    ctx.beginPath(); ctx.arc(-12, -15, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(12, -15, 3, 0, Math.PI * 2); ctx.fill();

    // Scruffy black hair — messy and layered
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(0, -20, 13, Math.PI + 0.15, -0.15); ctx.fill();
    // Messy chunks
    ctx.beginPath();
    ctx.moveTo(-12, -22); ctx.quadraticCurveTo(-8, -30, -4, -24);
    ctx.quadraticCurveTo(-1, -32, 3, -24);
    ctx.quadraticCurveTo(6, -30, 10, -23);
    ctx.quadraticCurveTo(13, -28, 13, -20);
    ctx.lineTo(-12, -20); ctx.closePath(); ctx.fill();
    // Side tufts
    ctx.fillRect(-14, -20, 4, 7);
    ctx.fillRect(10, -20, 4, 7);
    // Hair shine
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(-3, -26, 3, 0, Math.PI * 2); ctx.fill();

    // Dark brown eyes — detailed
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(-5, -16, 4, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(5, -16, 4, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5D3A1A';
    ctx.beginPath(); ctx.arc(-4, -15.5, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -15.5, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath(); ctx.arc(-4, -15.5, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -15.5, 1.5, 0, Math.PI * 2); ctx.fill();
    // Eye shine
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-5, -17, 1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, -17, 1, 0, Math.PI * 2); ctx.fill();
    // Relaxed eyebrows
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-8, -21); ctx.lineTo(-1, -20.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2, -20.5); ctx.lineTo(9, -21); ctx.stroke();

    // Chill smirk
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-2, -10); ctx.quadraticCurveTo(3, -7, 6, -9.5);
    ctx.stroke();

    // -- FRONT ARM --
    if (p.isAttacking) {
        // Kicking pose — back arm pumped, front arm balanced
        ctx.fillStyle = '#a50044';
        ctx.save();
        ctx.translate(-14, 0);
        ctx.rotate(0.3);
        ctx.fillRect(-3, 0, 7, 14);
        ctx.fillStyle = '#FFD5B8';
        ctx.beginPath(); ctx.arc(0, 14, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.translate(13, 0);
        ctx.rotate(-0.4);
        ctx.fillStyle = '#a50044';
        ctx.fillRect(-3, 0, 7, 12);
        ctx.fillStyle = '#FFD5B8';
        ctx.beginPath(); ctx.arc(0, 12, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    } else {
        ctx.save();
        ctx.translate(13, 2);
        ctx.rotate(-armSwing * 0.04);
        ctx.fillStyle = '#a50044';
        ctx.fillRect(-3, 0, 7, 14);
        ctx.fillStyle = '#FFD5B8';
        ctx.beginPath(); ctx.arc(0, 14, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    // Outline
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, -16, 13.5, 0, Math.PI * 2); ctx.stroke();

    ctx.restore();
    ctx.globalAlpha = 1;
}

function drawRupert(p) {
    const sx = p.x - cameraX;
    const flash = p.invincible > 0 && Math.floor(p.invincible / 4) % 2 === 0;
    if (flash) ctx.globalAlpha = 0.4;
    ctx.save();
    const idleBob = (Math.abs(p.vx) < 0.5 && p.onGround) ? Math.sin(frameTime * 0.004) * 1.5 : 0;
    const runTilt = Math.abs(p.vx) > 2 ? 0.06 * p.facing : 0;
    ctx.translate(sx + p.width / 2, p.y + p.height / 2 + idleBob);
    ctx.rotate(runTilt);
    if (p.facing === -1) ctx.scale(-1, 1);
    const armSwing = Math.sin(p.animFrame * 0.3) * 6;
    const legSwing = Math.sin(p.animFrame * 0.3) * 5;
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(0, 40, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
    if (!p.isAttacking) {
        ctx.save(); ctx.translate(-13, 2); ctx.rotate(armSwing * 0.04);
        ctx.fillStyle = '#e74c3c'; ctx.fillRect(-3, 0, 7, 14);
        ctx.fillStyle = '#FFD5B8'; ctx.beginPath(); ctx.arc(0, 14, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
    ctx.save(); ctx.translate(-6, 28); ctx.rotate(-legSwing * 0.04);
    ctx.fillStyle = '#FFD5B8'; ctx.fillRect(-4, 0, 8, 8);
    ctx.fillStyle = '#e74c3c'; ctx.fillRect(-4, 6, 8, 5);
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.roundRect(-5, 10, 10, 6, 2); ctx.fill();
    ctx.restore();
    // Body — Middlesbrough red kit
    ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.roundRect(-14, -6, 28, 26, 3); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(-14, 10, 28, 16);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-8, -6); ctx.lineTo(0, -2); ctx.lineTo(8, -6); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(-14, -6, 3, 26); ctx.fillRect(11, -6, 3, 26);
    // White shorts
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(-12, 18, 24, 12, [0,0,3,3]); ctx.fill();
    ctx.fillStyle = '#e74c3c'; ctx.fillRect(-12, 18, 24, 2);
    // Front leg
    ctx.save(); ctx.translate(6, 28); ctx.rotate(legSwing * 0.04);
    if (p.isAttacking) ctx.rotate(-0.6);
    ctx.fillStyle = '#FFD5B8'; ctx.fillRect(-4, 0, 8, 8);
    ctx.fillStyle = '#e74c3c'; ctx.fillRect(-4, 6, 8, 5);
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.roundRect(-5, 10, 10, 6, 2); ctx.fill();
    ctx.restore();
    // Head
    ctx.fillStyle = '#EDCBAA'; ctx.fillRect(-3, -10, 6, 5);
    ctx.fillStyle = '#FFD5B8'; ctx.beginPath(); ctx.arc(0, -16, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#EDCBAA';
    ctx.beginPath(); ctx.arc(-12, -15, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(12, -15, 3, 0, Math.PI * 2); ctx.fill();
    // Brown hair
    ctx.fillStyle = '#6B3A2A';
    ctx.beginPath(); ctx.arc(0, -20, 13, Math.PI + 0.2, -0.2); ctx.fill();
    ctx.fillRect(-11, -28, 22, 8);
    ctx.fillStyle = '#7d4a35'; ctx.beginPath(); ctx.arc(-2, -25, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6B3A2A';
    ctx.beginPath(); ctx.moveTo(-11, -22); ctx.quadraticCurveTo(-5, -20, 0, -22);
    ctx.quadraticCurveTo(5, -20, 11, -22); ctx.lineTo(11, -26); ctx.lineTo(-11, -26); ctx.closePath(); ctx.fill();
    // Brown eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(-5, -16, 4, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(5, -16, 4, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5D3A1A';
    ctx.beginPath(); ctx.arc(-4, -15.5, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -15.5, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath(); ctx.arc(-4, -15.5, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -15.5, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-5, -17, 1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, -17, 1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#4a2515'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-8, -21); ctx.quadraticCurveTo(-5, -22.5, -1, -21); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2, -21); ctx.quadraticCurveTo(5, -22.5, 9, -21); ctx.stroke();
    ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(1, -11, 4, 0.2, Math.PI - 0.2); ctx.stroke();
    // Front arm
    if (p.isAttacking) {
        ctx.fillStyle = '#e74c3c';
        ctx.save(); ctx.translate(13, 0); ctx.rotate(-0.35);
        ctx.fillRect(-3, 0, 7, 12);
        ctx.fillStyle = '#FFD5B8'; ctx.beginPath(); ctx.arc(0, 12, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.fillStyle = 'rgba(231,76,60,0.6)';
        ctx.beginPath(); ctx.arc(14, 36, 9 + (Math.sin(frameTime * 0.02) + 1) * 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.arc(14, 36, 5 + (Math.sin(frameTime * 0.03) + 1) * 1.5, 0, Math.PI * 2); ctx.fill();
    } else {
        ctx.save(); ctx.translate(13, 2); ctx.rotate(-armSwing * 0.04);
        ctx.fillStyle = '#e74c3c'; ctx.fillRect(-3, 0, 7, 14);
        ctx.fillStyle = '#FFD5B8'; ctx.beginPath(); ctx.arc(0, 14, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, -16, 13.5, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
}

function drawJessica(p) {
    const sx = p.x - cameraX;
    const flash = p.invincible > 0 && Math.floor(p.invincible / 4) % 2 === 0;
    if (flash) ctx.globalAlpha = 0.4;
    ctx.save();
    const idleBob = (Math.abs(p.vx) < 0.5 && p.onGround) ? Math.sin(frameTime * 0.004) * 1.5 : 0;
    const runTilt = Math.abs(p.vx) > 2 ? 0.06 * p.facing : 0;
    ctx.translate(sx + p.width / 2, p.y + p.height / 2 + idleBob);
    ctx.rotate(runTilt);
    if (p.facing === -1) ctx.scale(-1, 1);
    const armSwing = Math.sin(p.animFrame * 0.3) * 6;
    const legSwing = Math.sin(p.animFrame * 0.3) * 5;
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(0, 40, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
    if (!p.isAttacking) {
        ctx.save(); ctx.translate(-13, 2); ctx.rotate(armSwing * 0.04);
        ctx.fillStyle = '#f1c40f'; ctx.fillRect(-3, 0, 7, 14);
        ctx.fillStyle = '#FFD5B8'; ctx.beginPath(); ctx.arc(0, 14, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
    ctx.save(); ctx.translate(-6, 28); ctx.rotate(-legSwing * 0.04);
    ctx.fillStyle = '#FFD5B8'; ctx.fillRect(-4, 0, 8, 8);
    ctx.fillStyle = '#f1c40f'; ctx.fillRect(-4, 6, 8, 5);
    ctx.fillStyle = '#1a1a4e'; ctx.beginPath(); ctx.roundRect(-5, 10, 10, 6, 2); ctx.fill();
    ctx.restore();
    // Body — Oxford United yellow kit
    ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.roundRect(-14, -6, 28, 26, 3); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.07)'; ctx.fillRect(-14, 10, 28, 16);
    ctx.strokeStyle = '#1a1a4e'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-8, -6); ctx.lineTo(0, -2); ctx.lineTo(8, -6); ctx.stroke();
    ctx.fillStyle = '#1a1a4e'; ctx.fillRect(-14, -6, 3, 26); ctx.fillRect(11, -6, 3, 26);
    // Navy shorts
    ctx.fillStyle = '#1a1a4e'; ctx.beginPath(); ctx.roundRect(-12, 18, 24, 12, [0,0,3,3]); ctx.fill();
    ctx.fillStyle = '#f1c40f'; ctx.fillRect(-12, 18, 24, 2);
    // Front leg
    ctx.save(); ctx.translate(6, 28); ctx.rotate(legSwing * 0.04);
    if (p.isAttacking) ctx.rotate(-0.6);
    ctx.fillStyle = '#FFD5B8'; ctx.fillRect(-4, 0, 8, 8);
    ctx.fillStyle = '#f1c40f'; ctx.fillRect(-4, 6, 8, 5);
    ctx.fillStyle = '#1a1a4e'; ctx.beginPath(); ctx.roundRect(-5, 10, 10, 6, 2); ctx.fill();
    ctx.restore();
    // Head
    ctx.fillStyle = '#EDCBAA'; ctx.fillRect(-3, -10, 6, 5);
    ctx.fillStyle = '#FFD5B8'; ctx.beginPath(); ctx.arc(0, -16, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#EDCBAA';
    ctx.beginPath(); ctx.arc(-12, -15, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(12, -15, 3, 0, Math.PI * 2); ctx.fill();
    // Long blonde hair
    ctx.fillStyle = '#F5D76E';
    ctx.beginPath(); ctx.moveTo(-11, -22); ctx.quadraticCurveTo(-16, 0, -14, 20);
    ctx.quadraticCurveTo(-12, 26, -10, 26); ctx.quadraticCurveTo(-8, 26, -9, 18);
    ctx.quadraticCurveTo(-11, 2, -8, -10); ctx.lineTo(-8, -22); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(11, -22); ctx.quadraticCurveTo(16, 0, 15, 20);
    ctx.quadraticCurveTo(13, 26, 11, 26); ctx.quadraticCurveTo(9, 26, 10, 18);
    ctx.quadraticCurveTo(12, 2, 9, -10); ctx.lineTo(9, -22); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -20, 13, Math.PI + 0.15, -0.15); ctx.fill();
    ctx.fillRect(-11, -28, 22, 8);
    ctx.fillStyle = '#FADE82';
    ctx.beginPath(); ctx.arc(-3, -25, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, -23, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#F5D76E';
    ctx.beginPath(); ctx.moveTo(-10, -22); ctx.quadraticCurveTo(-5, -18, 0, -22);
    ctx.quadraticCurveTo(5, -18, 10, -22); ctx.lineTo(10, -26); ctx.lineTo(-10, -26); ctx.closePath(); ctx.fill();
    // Green eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(-5, -16, 4, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(5, -16, 4, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#27ae60';
    ctx.beginPath(); ctx.arc(-4, -15.5, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -15.5, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath(); ctx.arc(-4, -15.5, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -15.5, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-5, -17, 1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, -17, 1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#D4B840'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-8, -21); ctx.quadraticCurveTo(-5, -22.5, -1, -21); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2, -21); ctx.quadraticCurveTo(5, -22.5, 9, -21); ctx.stroke();
    ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-4, -10); ctx.quadraticCurveTo(1, -6, 6, -10); ctx.stroke();
    // Front arm
    if (p.isAttacking) {
        ctx.fillStyle = '#f1c40f';
        ctx.save(); ctx.translate(13, 0); ctx.rotate(-0.35);
        ctx.fillRect(-3, 0, 7, 12);
        ctx.fillStyle = '#FFD5B8'; ctx.beginPath(); ctx.arc(0, 12, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.fillStyle = 'rgba(241,196,15,0.65)';
        ctx.beginPath(); ctx.arc(14, 36, 9 + (Math.sin(frameTime * 0.02) + 1) * 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath(); ctx.arc(14, 36, 5 + (Math.sin(frameTime * 0.03) + 1) * 1.5, 0, Math.PI * 2); ctx.fill();
    } else {
        ctx.save(); ctx.translate(13, 2); ctx.rotate(-armSwing * 0.04);
        ctx.fillStyle = '#f1c40f'; ctx.fillRect(-3, 0, 7, 14);
        ctx.fillStyle = '#FFD5B8'; ctx.beginPath(); ctx.arc(0, 14, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, -16, 13.5, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
}

function drawEmilia(p) {
    const sx = p.x - cameraX;
    const flash = p.invincible > 0 && Math.floor(p.invincible / 4) % 2 === 0;
    if (flash) ctx.globalAlpha = 0.4;
    ctx.save();
    const idleBob = (Math.abs(p.vx) < 0.5 && p.onGround) ? Math.sin(frameTime * 0.004) * 1.5 : 0;
    const runTilt = Math.abs(p.vx) > 2 ? 0.05 * p.facing : 0;
    ctx.translate(sx + p.width / 2, p.y + p.height / 2 + idleBob);
    ctx.rotate(runTilt);
    if (p.facing === -1) ctx.scale(-1, 1);
    const armSwing = Math.sin(p.animFrame * 0.3) * 6;
    const legSwing = Math.sin(p.animFrame * 0.3) * 5;
    const tutuFlutter = Math.sin(frameTime * 0.006) * 2;
    const spinAngle = p.isAttacking ? (p.attackTimer / p.attackDuration) * Math.PI * 4 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(0, 40, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
    // Back arm
    if (!p.isAttacking) {
        ctx.save(); ctx.translate(-13, 2); ctx.rotate(armSwing * 0.04);
        ctx.fillStyle = '#ff69b4'; ctx.fillRect(-3, 0, 7, 14);
        ctx.fillStyle = '#FFD5B8'; ctx.beginPath(); ctx.arc(0, 14, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    } else {
        ctx.save(); ctx.translate(-13, 2); ctx.rotate(-0.8 + spinAngle);
        ctx.fillStyle = '#ff69b4'; ctx.fillRect(-3, -14, 7, 14);
        ctx.fillStyle = '#FFD5B8'; ctx.beginPath(); ctx.arc(0, -14, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
    // Back leg
    ctx.save(); ctx.translate(-6, 28); ctx.rotate(-legSwing * 0.04);
    ctx.fillStyle = '#FFD5B8'; ctx.fillRect(-4, 0, 8, 14);
    ctx.fillStyle = '#ffb6c1'; ctx.beginPath(); ctx.roundRect(-5, 12, 10, 5, 2); ctx.fill();
    ctx.strokeStyle = '#ff69b4'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-4, 12); ctx.lineTo(-2, 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, 12); ctx.lineTo(2, 8); ctx.stroke();
    ctx.restore();
    // Body — pink leotard
    ctx.fillStyle = '#ff69b4'; ctx.beginPath(); ctx.roundRect(-12, -6, 24, 24, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(-8, -4, 16, 14);
    ctx.strokeStyle = '#ff85c2'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-7, -6); ctx.quadraticCurveTo(0, -2, 7, -6); ctx.stroke();
    // Tutu skirt
    const tutuY = 17 + tutuFlutter * 0.5;
    ctx.fillStyle = 'rgba(255,182,193,0.7)';
    ctx.beginPath(); ctx.moveTo(-16, tutuY);
    ctx.quadraticCurveTo(-18, tutuY + 6 + tutuFlutter, -14, tutuY + 10);
    ctx.quadraticCurveTo(-8, tutuY + 14, 0, tutuY + 12);
    ctx.quadraticCurveTo(8, tutuY + 14, 14, tutuY + 10);
    ctx.quadraticCurveTo(18, tutuY + 6 - tutuFlutter, 16, tutuY);
    ctx.lineTo(-16, tutuY); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,105,180,0.55)';
    ctx.beginPath(); ctx.moveTo(-15, tutuY + 1);
    ctx.quadraticCurveTo(-17, tutuY + 7 - tutuFlutter, -12, tutuY + 11);
    ctx.quadraticCurveTo(-5, tutuY + 15 + tutuFlutter, 0, tutuY + 13);
    ctx.quadraticCurveTo(5, tutuY + 15 - tutuFlutter, 12, tutuY + 11);
    ctx.quadraticCurveTo(17, tutuY + 7 + tutuFlutter, 15, tutuY + 1);
    ctx.lineTo(-15, tutuY + 1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff69b4'; ctx.fillRect(-12, tutuY - 1, 24, 4);
    // Front leg
    ctx.save(); ctx.translate(6, 28);
    if (p.isAttacking) { ctx.rotate(-0.7); } else { ctx.rotate(legSwing * 0.04); }
    ctx.fillStyle = '#FFD5B8'; ctx.fillRect(-4, 0, 8, 14);
    ctx.fillStyle = '#ffb6c1'; ctx.beginPath(); ctx.roundRect(-5, 12, 10, 5, 2); ctx.fill();
    ctx.strokeStyle = '#ff69b4'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-4, 12); ctx.lineTo(-2, 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, 12); ctx.lineTo(2, 8); ctx.stroke();
    ctx.restore();
    // Head
    ctx.fillStyle = '#EDCBAA'; ctx.fillRect(-3, -10, 6, 5);
    ctx.fillStyle = '#FFD5B8'; ctx.beginPath(); ctx.arc(0, -16, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,150,150,0.25)';
    ctx.beginPath(); ctx.arc(-7, -13, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(7, -13, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#EDCBAA';
    ctx.beginPath(); ctx.arc(-12, -15, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(12, -15, 3, 0, Math.PI * 2); ctx.fill();
    // Long wavy brown hair with bun
    ctx.fillStyle = '#5C3317';
    ctx.beginPath(); ctx.moveTo(-11, -22); ctx.quadraticCurveTo(-18, -4, -16, 14);
    ctx.quadraticCurveTo(-15, 22, -13, 22); ctx.quadraticCurveTo(-11, 22, -12, 14);
    ctx.quadraticCurveTo(-13, 0, -8, -10); ctx.lineTo(-8, -22); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(11, -22); ctx.quadraticCurveTo(18, -4, 16, 14);
    ctx.quadraticCurveTo(15, 22, 13, 22); ctx.quadraticCurveTo(11, 22, 12, 14);
    ctx.quadraticCurveTo(13, 0, 8, -10); ctx.lineTo(8, -22); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -20, 13, Math.PI + 0.15, -0.15); ctx.fill();
    ctx.fillRect(-11, -28, 22, 8);
    ctx.fillStyle = '#7a4528';
    ctx.beginPath(); ctx.arc(-2, -25, 5, 0, Math.PI * 2); ctx.fill();
    // Hair bun
    ctx.fillStyle = '#5C3317'; ctx.beginPath(); ctx.arc(0, -27, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff69b4'; ctx.beginPath(); ctx.arc(0, -27, 3, 0, Math.PI * 2); ctx.fill();
    // Brown eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(-5, -16, 4, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(5, -16, 4, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5D3A1A';
    ctx.beginPath(); ctx.arc(-4, -15.5, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -15.5, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath(); ctx.arc(-4, -15.5, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -15.5, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-5, -17, 1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, -17, 1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#4a2515'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-8, -21); ctx.quadraticCurveTo(-5, -22.5, -1, -21); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2, -21); ctx.quadraticCurveTo(5, -22.5, 9, -21); ctx.stroke();
    ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(1, -11, 4, 0.2, Math.PI - 0.2); ctx.stroke();
    // Front arm
    if (p.isAttacking) {
        ctx.save(); ctx.translate(13, 2); ctx.rotate(0.8 - spinAngle);
        ctx.fillStyle = '#ff69b4'; ctx.fillRect(-3, -14, 7, 14);
        ctx.fillStyle = '#FFD5B8'; ctx.beginPath(); ctx.arc(0, -14, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        // Pink sparkles
        for (let s = 0; s < 6; s++) {
            const a = (s / 6) * Math.PI * 2 + spinAngle;
            const d = 18 + Math.sin(spinAngle * 2 + s) * 4;
            ctx.fillStyle = `rgba(255,105,180,${0.5 + (Math.sin(frameTime * 0.015 + s * 1.5) + 1) * 0.25})`;
            ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d - 6, 2 + (Math.sin(frameTime * 0.02 + s) + 1), 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,182,193,0.4)';
        ctx.beginPath(); ctx.arc(0, -6, 20 + (Math.sin(frameTime * 0.015) + 1) * 2.5, 0, Math.PI * 2); ctx.fill();
    } else {
        ctx.save(); ctx.translate(13, 2); ctx.rotate(-armSwing * 0.04);
        ctx.fillStyle = '#ff69b4'; ctx.fillRect(-3, 0, 7, 14);
        ctx.fillStyle = '#FFD5B8'; ctx.beginPath(); ctx.arc(0, 14, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, -16, 13.5, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
}

// --- MUMMY — Glamorous mum with blonde hair, nice clothes ---
function drawMummy(p) {
    const flash = p.invincible > 0 && Math.floor(p.invincible / 4) % 2 === 0;
    if (flash) ctx.globalAlpha = 0.4;
    ctx.save();
    const sx = p.x - cameraX;
    ctx.translate(sx + p.width / 2, p.y + p.height);
    if (p.facing === -1) ctx.scale(-1, 1);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(0, -2, 14, 4, 0, 0, Math.PI * 2); ctx.fill();

    // Legs — slim, dark jeans
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(-8, -18, 5, 16); // left leg
    ctx.fillRect(3, -18, 5, 16);  // right leg
    // Heeled boots
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-9, -4, 6, 4);
    ctx.fillRect(2, -4, 6, 4);
    // Heel
    ctx.fillRect(-9, -2, 2, 3);
    ctx.fillRect(6, -2, 2, 3);

    // Body — nice blouse (dusty pink)
    ctx.fillStyle = '#d4a0a0';
    ctx.fillRect(-10, -36, 20, 20);
    // Neckline V
    ctx.fillStyle = '#e8c4c4';
    ctx.beginPath();
    ctx.moveTo(-4, -36); ctx.lineTo(0, -30); ctx.lineTo(4, -36);
    ctx.closePath(); ctx.fill();
    // Belt
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(-10, -18, 20, 3);
    ctx.fillStyle = '#d4af37'; // gold buckle
    ctx.fillRect(-2, -18, 4, 3);

    // Arms — slim
    ctx.fillStyle = '#fce4c8'; // skin tone
    const armSwing = p.isAttacking ? 6 : Math.sin(frameTime * 0.005) * 2;
    // Sleeve on back arm
    ctx.fillStyle = '#d4a0a0';
    ctx.fillRect(-13, -34 + armSwing, 4, 5);
    ctx.fillStyle = '#fce4c8';
    ctx.fillRect(-13, -29 + armSwing, 4, 10);
    // Front arm (holds handbag when attacking)
    if (p.isAttacking) {
        ctx.fillStyle = '#d4a0a0'; // sleeve
        ctx.fillRect(9, -38, 4, 5);
        ctx.fillStyle = '#fce4c8';
        ctx.fillRect(9, -33, 4, 10);
        // Handbag swinging forward
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(14, -34, 12, 10);
        // Handbag flap
        ctx.fillStyle = '#6B3410';
        ctx.fillRect(14, -34, 12, 3);
        // Gold clasp
        ctx.fillStyle = '#d4af37';
        ctx.fillRect(18, -35, 4, 2);
        // Strap
        ctx.strokeStyle = '#6B3410'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(14, -30); ctx.quadraticCurveTo(12, -34, 13, -38); ctx.stroke();
    } else {
        ctx.fillStyle = '#d4a0a0'; // sleeve
        ctx.fillRect(9, -34, 4, 5);
        ctx.fillStyle = '#fce4c8';
        ctx.fillRect(9, -29, 4, 10);
        // Handbag at side
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(10, -22, 10, 8);
        // Flap
        ctx.fillStyle = '#6B3410';
        ctx.fillRect(10, -22, 10, 2);
        // Handle
        ctx.strokeStyle = '#6B3410'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(12, -22); ctx.quadraticCurveTo(15, -27, 18, -22);
        ctx.stroke();
        // Gold clasp
        ctx.fillStyle = '#d4af37';
        ctx.fillRect(14, -22, 3, 2);
    }

    // Neck
    ctx.fillStyle = '#fce4c8';
    ctx.fillRect(-3, -40, 6, 5);

    // Head
    ctx.fillStyle = '#fce4c8';
    ctx.beginPath(); ctx.arc(0, -46, 10, 0, Math.PI * 2); ctx.fill();

    // Long blonde hair
    ctx.fillStyle = '#f0d060';
    // Hair top
    ctx.beginPath(); ctx.arc(0, -48, 11, Math.PI, 0); ctx.fill();
    // Hair sides (long, flowing)
    ctx.fillRect(-11, -48, 4, 22);
    ctx.fillRect(7, -48, 4, 22);
    // Hair tips (tapered)
    ctx.beginPath();
    ctx.moveTo(-11, -26); ctx.lineTo(-9, -20); ctx.lineTo(-7, -26);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(7, -26); ctx.lineTo(9, -20); ctx.lineTo(11, -26);
    ctx.fill();
    // Fringe
    ctx.fillRect(-8, -54, 16, 5);

    // Eyes — glamorous with lashes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(-4, -47, 3, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(4, -47, 3, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3498db'; // blue eyes
    ctx.beginPath(); ctx.arc(-4, -47, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(4, -47, 1.5, 0, Math.PI * 2); ctx.fill();
    // Eyelashes
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-7, -49); ctx.lineTo(-5, -48); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5, -48); ctx.lineTo(7, -49); ctx.stroke();
    // Lipstick
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.ellipse(0, -42, 3, 1.5, 0, 0, Math.PI * 2); ctx.fill();

    // Necklace
    ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-5, -37); ctx.quadraticCurveTo(0, -34, 5, -37);
    ctx.stroke();
    ctx.fillStyle = '#d4af37';
    ctx.beginPath(); ctx.arc(0, -34, 2, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
    ctx.globalAlpha = 1;
}

// --- DADDY — Muscular dad, grey hair, jeans, nice watch ---
function drawDaddy(p) {
    const flash = p.invincible > 0 && Math.floor(p.invincible / 4) % 2 === 0;
    if (flash) ctx.globalAlpha = 0.4;
    ctx.save();
    const sx = p.x - cameraX;
    ctx.translate(sx + p.width / 2, p.y + p.height);
    if (p.facing === -1) ctx.scale(-1, 1);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(0, -2, 16, 5, 0, 0, Math.PI * 2); ctx.fill();

    // Legs — blue jeans
    ctx.fillStyle = '#34495e';
    ctx.fillRect(-9, -20, 7, 18); // left leg
    ctx.fillRect(2, -20, 7, 18);  // right leg
    // Trainers
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(-10, -4, 8, 5);
    ctx.fillRect(1, -4, 8, 5);
    ctx.fillStyle = '#fff'; // white sole line
    ctx.fillRect(-10, -1, 8, 1);
    ctx.fillRect(1, -1, 8, 1);

    // Body — muscular, dark green top
    ctx.fillStyle = '#4a6741';
    ctx.fillRect(-12, -40, 24, 22);
    // Chest definition (subtle)
    ctx.strokeStyle = '#3d5636'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -38); ctx.lineTo(0, -28); ctx.stroke();
    // Collar
    ctx.fillStyle = '#3d5636';
    ctx.beginPath();
    ctx.moveTo(-5, -40); ctx.lineTo(0, -36); ctx.lineTo(5, -40);
    ctx.closePath(); ctx.fill();

    // Arms — muscular (thicker than other characters)
    const armSwing = p.isAttacking ? 8 : Math.sin(frameTime * 0.004) * 2;
    // Back arm — sleeve then muscular forearm
    ctx.fillStyle = '#4a6741';
    ctx.fillRect(-17, -38 + armSwing, 6, 8);
    ctx.fillStyle = '#e8c4a0';
    ctx.fillRect(-17, -30 + armSwing, 6, 10);
    // Muscle definition on back arm
    ctx.fillStyle = 'rgba(200,160,130,0.3)';
    ctx.fillRect(-16, -28 + armSwing, 1, 6);
    // Front arm
    if (p.isAttacking) {
        // Throwing arm extended forward
        ctx.fillStyle = '#4a6741';
        ctx.fillRect(11, -42, 6, 8);
        ctx.fillStyle = '#e8c4a0';
        ctx.fillRect(11, -34, 6, 10);
        // Bottle in hand (about to throw)
        ctx.fillStyle = '#2d5a1e';
        ctx.fillRect(14, -28, 4, 10);
        ctx.fillRect(15, -30, 2, 4); // neck
        ctx.fillStyle = '#d4af37'; // cap
        ctx.fillRect(14.5, -31, 3, 2);
    } else {
        ctx.fillStyle = '#4a6741';
        ctx.fillRect(11, -38, 6, 8);
        ctx.fillStyle = '#e8c4a0';
        ctx.fillRect(11, -30, 6, 10);
        // Muscle definition on front arm
        ctx.fillStyle = 'rgba(200,160,130,0.3)';
        ctx.fillRect(12, -28, 1, 6);
    }

    // Watch on front wrist (always visible)
    ctx.fillStyle = '#333'; // strap
    ctx.fillRect(11, -22, 6, 4);
    ctx.fillStyle = '#c0c0c0'; // silver case
    ctx.fillRect(12, -22, 4, 3);
    ctx.fillStyle = '#d4af37'; // gold face
    ctx.fillRect(13, -22, 2, 2);

    // Neck
    ctx.fillStyle = '#e8c4a0';
    ctx.fillRect(-4, -44, 8, 5);

    // Head (slightly larger — dad proportions)
    ctx.fillStyle = '#e8c4a0';
    ctx.beginPath(); ctx.arc(0, -50, 11, 0, Math.PI * 2); ctx.fill();

    // Grey hair — short, neat
    ctx.fillStyle = '#888';
    ctx.beginPath(); ctx.arc(0, -52, 11, Math.PI, 0); ctx.fill();
    // Sides
    ctx.fillRect(-11, -52, 3, 6);
    ctx.fillRect(8, -52, 3, 6);
    // Slight receding hairline
    ctx.fillStyle = '#e8c4a0';
    ctx.beginPath(); ctx.arc(-6, -56, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -56, 4, 0, Math.PI * 2); ctx.fill();

    // Stubble
    ctx.fillStyle = 'rgba(100,100,100,0.2)';
    ctx.fillRect(-6, -44, 12, 4);

    // Eyes — determined
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(-4, -51, 3, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(4, -51, 3, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5d4037'; // brown eyes
    ctx.beginPath(); ctx.arc(-4, -51, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(4, -51, 1.5, 0, Math.PI * 2); ctx.fill();
    // Strong brows
    ctx.strokeStyle = '#555'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-7, -54); ctx.lineTo(-2, -53); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2, -53); ctx.lineTo(7, -54); ctx.stroke();
    // Mouth — confident smirk
    ctx.strokeStyle = '#8B4513'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-3, -45); ctx.quadraticCurveTo(0, -43, 3, -45); ctx.stroke();

    ctx.restore();
    ctx.globalAlpha = 1;
}

function drawProjectiles() {
    for (const ball of projectiles) {
        const sx = ball.x - cameraX;
        if (sx < -20 || sx > SCREEN_W + 20) continue;

        if (ball.isWave) {
            // Fishies wave — blue water splash
            ctx.fillStyle = 'rgba(52, 152, 219, 0.7)';
            ctx.beginPath();
            ctx.ellipse(sx, ball.y, 14, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(41, 128, 185, 0.5)';
            ctx.beginPath();
            ctx.ellipse(sx + (ball.vx > 0 ? -6 : 6), ball.y, 10, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            // Splash droplets
            ctx.fillStyle = 'rgba(52, 152, 219, 0.5)';
            const t = ball.spin;
            ctx.beginPath(); ctx.arc(sx + Math.sin(t) * 8, ball.y - 6, 2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(sx - Math.sin(t + 1) * 6, ball.y + 5, 2, 0, Math.PI * 2); ctx.fill();
        } else if (ball.charType === 'emilia') {
            // Teddy bear projectile
            ctx.save();
            ctx.translate(sx, ball.y);
            ctx.rotate(ball.spin);
            // Body
            ctx.fillStyle = '#C4956A';
            ctx.beginPath(); ctx.ellipse(0, 2, 7, 9, 0, 0, Math.PI * 2); ctx.fill();
            // Head
            ctx.beginPath(); ctx.arc(0, -8, 6, 0, Math.PI * 2); ctx.fill();
            // Ears
            ctx.beginPath(); ctx.arc(-5, -13, 3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(5, -13, 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#A07850';
            ctx.beginPath(); ctx.arc(-5, -13, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(5, -13, 1.5, 0, Math.PI * 2); ctx.fill();
            // Eyes
            ctx.fillStyle = '#222';
            ctx.beginPath(); ctx.arc(-2, -9, 1, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(2, -9, 1, 0, Math.PI * 2); ctx.fill();
            // Nose
            ctx.fillStyle = '#333';
            ctx.beginPath(); ctx.arc(0, -7, 1, 0, Math.PI * 2); ctx.fill();
            // Belly patch
            ctx.fillStyle = '#D4A574';
            ctx.beginPath(); ctx.ellipse(0, 3, 4, 5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            // Sparkle trail
            ctx.fillStyle = 'rgba(255,105,180,0.3)';
            ctx.beginPath(); ctx.arc(sx - ball.vx * 2, ball.y - 2, 4, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(sx - ball.vx * 3, ball.y + 2, 3, 0, Math.PI * 2); ctx.fill();
        } else if (ball.charType === 'mummy') {
            // Coffee cup projectile
            ctx.save();
            ctx.translate(sx, ball.y);
            ctx.rotate(ball.spin);
            // Cup body
            ctx.fillStyle = '#f5f5f0';
            ctx.beginPath();
            ctx.moveTo(-5, -8); ctx.lineTo(-7, 8); ctx.lineTo(7, 8); ctx.lineTo(5, -8);
            ctx.closePath(); ctx.fill();
            // Coffee inside
            ctx.fillStyle = '#6F4E37';
            ctx.beginPath();
            ctx.moveTo(-4, -4); ctx.lineTo(-6, 7); ctx.lineTo(6, 7); ctx.lineTo(4, -4);
            ctx.closePath(); ctx.fill();
            // Handle
            ctx.strokeStyle = '#f5f5f0'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(7, 0, 4, -Math.PI / 2, Math.PI / 2); ctx.stroke();
            // Steam
            ctx.strokeStyle = 'rgba(200,200,200,0.6)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(-2, -8); ctx.quadraticCurveTo(-3, -14, -1, -16); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(2, -8); ctx.quadraticCurveTo(3, -13, 1, -16); ctx.stroke();
            ctx.restore();
            // Trail
            ctx.fillStyle = 'rgba(111,78,55,0.3)';
            ctx.beginPath(); ctx.arc(sx - ball.vx * 2, ball.y, 3, 0, Math.PI * 2); ctx.fill();
        } else if (ball.charType === 'daddy') {
            // Beer/rum bottle projectile
            ctx.save();
            ctx.translate(sx, ball.y);
            ctx.rotate(ball.spin);
            // Bottle body (dark green glass)
            ctx.fillStyle = '#2d5a1e';
            ctx.fillRect(-5, -4, 10, 14);
            // Rounded bottom
            ctx.beginPath(); ctx.arc(0, 10, 5, 0, Math.PI); ctx.fill();
            // Bottle neck
            ctx.fillRect(-2.5, -12, 5, 9);
            // Cap (gold)
            ctx.fillStyle = '#d4af37';
            ctx.fillRect(-3, -14, 6, 3);
            // Label (cream)
            ctx.fillStyle = '#f5e6c8';
            ctx.fillRect(-4, 0, 8, 6);
            // Label text
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(-3, 2, 6, 1.5);
            ctx.fillRect(-2, 4, 4, 1);
            // Glass shine
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.fillRect(-4, -3, 2, 10);
            // Liquid visible through glass
            ctx.fillStyle = 'rgba(180,120,30,0.4)';
            ctx.fillRect(-3, 2, 6, 8);
            ctx.restore();
            // Trail — bubbly fizz
            ctx.fillStyle = 'rgba(200,180,100,0.4)';
            ctx.beginPath(); ctx.arc(sx - ball.vx * 2, ball.y - 1, 3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(sx - ball.vx * 3, ball.y + 2, 2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,220,100,0.2)';
            ctx.beginPath(); ctx.arc(sx - ball.vx * 4, ball.y - 3, 1.5, 0, Math.PI * 2); ctx.fill();
        } else if (ball.charType === 'heath' || (!ball.charType && charIsTackle(selectedCharacter))) {
            // Rugby ball
            ctx.save();
            ctx.translate(sx, ball.y);
            ctx.rotate(ball.spin);
            ctx.fillStyle = '#8B4513';
            ctx.beginPath(); ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
            // Lace stitching
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(4, 6); ctx.stroke();
            ctx.beginPath(); for (let st = -3; st <= 3; st += 2) { ctx.moveTo(st - 1, st * 1.5 - 1); ctx.lineTo(st + 1, st * 1.5 + 1); } ctx.stroke();
            // Shine
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.beginPath(); ctx.ellipse(-2, -3, 4, 2, -0.3, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            // Motion trail
            ctx.fillStyle = 'rgba(139,69,19,0.2)';
            ctx.beginPath(); ctx.ellipse(sx - ball.vx * 2, ball.y - ball.vy * 2, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
        } else {
            // Football — proper pentagon pattern
            ctx.save();
            ctx.translate(sx, ball.y);
            ctx.rotate(ball.spin);
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#222';
            for (let pp = 0; pp < 5; pp++) {
                const pa = (pp / 5) * Math.PI * 2;
                ctx.beginPath(); ctx.arc(Math.cos(pa) * 4, Math.sin(pa) * 4, 2.5, 0, Math.PI * 2); ctx.fill();
            }
            ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#999'; ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.beginPath(); ctx.arc(-2, -3, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            // Motion trail
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.beginPath(); ctx.arc(sx - ball.vx * 2, ball.y - ball.vy * 2, 5, 0, Math.PI * 2); ctx.fill();
        }
    }
}

// ===== LEVEL SELECT SCREEN =====
function drawLevelSelect() {
    ctx.fillStyle = GRAD_LEVEL_SELECT;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    ctx.textAlign = 'center';

    // Title
    ctx.fillStyle = '#e94560';
    ctx.font = 'bold 36px Segoe UI, sans-serif';
    ctx.fillText('SELECT LEVEL', SCREEN_W / 2, 60);

    // Level cards
    const totalLevels = TOTAL_LEVELS;
    const cardW = 150;
    const cardH = 120;
    const gap = 20;
    const totalW = totalLevels * cardW + (totalLevels - 1) * gap;
    const startX = (SCREEN_W - totalW) / 2;
    const cardY = SCREEN_H / 2 - cardH / 2 - 10;

    for (let i = 1; i <= totalLevels; i++) {
        const lvl = LEVELS[i];
        const x = startX + (i - 1) * (cardW + gap);
        const unlocked = i <= levelsUnlocked;
        const selected = (levelSelectCursor + 1) === i;

        // Card background
        if (selected) {
            ctx.fillStyle = unlocked ? '#e94560' : '#4a2030';
            ctx.fillRect(x - 4, cardY - 4, cardW + 8, cardH + 8);
        }
        ctx.fillStyle = unlocked ? '#16213e' : '#111';
        ctx.fillRect(x, cardY, cardW, cardH);

        // Level number
        ctx.fillStyle = unlocked ? '#f1c40f' : '#555';
        ctx.font = 'bold 28px Segoe UI, sans-serif';
        ctx.fillText(i, x + cardW / 2, cardY + 35);

        // Level name (two lines if needed)
        ctx.font = '12px Segoe UI, sans-serif';
        ctx.fillStyle = unlocked ? '#eee' : '#555';
        const words = lvl.name.split(' ');
        if (words.length <= 2) {
            ctx.fillText(lvl.name, x + cardW / 2, cardY + 60);
        } else {
            ctx.fillText(words.slice(0, 2).join(' '), x + cardW / 2, cardY + 55);
            ctx.fillText(words.slice(2).join(' '), x + cardW / 2, cardY + 70);
        }

        // Boss name or locked
        ctx.font = '10px Segoe UI, sans-serif';
        if (unlocked) {
            ctx.fillStyle = '#e94560';
            ctx.fillText('Boss: ' + lvl.bossName, x + cardW / 2, cardY + 90);
        } else {
            ctx.fillStyle = '#555';
            ctx.fillText('🔒 LOCKED', x + cardW / 2, cardY + 90);
        }

        // Stages indicator
        ctx.fillStyle = unlocked ? '#aaa' : '#444';
        ctx.font = '10px Segoe UI, sans-serif';
        ctx.fillText('4 Stages + Boss', x + cardW / 2, cardY + 108);
    }

    // Instructions
    const flashAlpha = 0.5 + Math.sin(frameTime * 0.004) * 0.5;
    ctx.globalAlpha = flashAlpha;
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 16px Segoe UI, sans-serif';
    if (touchControlsActive) {
        ctx.fillText('Tap left / right to choose', SCREEN_W / 2, SCREEN_H - 60);
    } else if (gamepadConnected) {
        ctx.fillText('D-pad ← → to choose — ✕ to start', SCREEN_W / 2, SCREEN_H - 60);
    } else {
        ctx.fillText('← → to choose — ENTER to start', SCREEN_W / 2, SCREEN_H - 60);
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#888';
    ctx.font = '12px Segoe UI, sans-serif';
    ctx.fillText('Press ESC to go back', SCREEN_W / 2, SCREEN_H - 35);

    ctx.textAlign = 'left';
}

// ===== VS MODE — CHARACTER SELECT =====
function drawVsSelect() {
    ctx.fillStyle = GRAD_VS_SELECT;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    ctx.textAlign = 'center';

    // Title
    ctx.fillStyle = '#e94560';
    ctx.font = 'bold 26px Segoe UI, sans-serif';
    ctx.fillText('VS MODE', SCREEN_W / 2, 32);

    // Dividing line
    ctx.strokeStyle = 'rgba(233,69,96,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(SCREEN_W / 2, 45); ctx.lineTo(SCREEN_W / 2, SCREEN_H - 30); ctx.stroke();

    // --- Per-player control type (shown above each player side) ---
    const ctrlY = 48;
    const dualPads = gamepadConnected && gamepad2Connected;
    const p1IsCtrl = p1ControlType === 'controller';
    const p2IsCtrl = dualPads ? p2ControlType === 'controller' : !p1IsCtrl;

    // P1 control type indicator
    const p1cx = SCREEN_W / 4;
    const p1Icon = p1IsCtrl ? '🎮' : '⌨️';
    const p1Label = p1IsCtrl ? 'Controller' : 'Keyboard';
    ctx.fillStyle = 'rgba(52,152,219,0.15)';
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(p1cx - 55, ctrlY, 110, 22, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3498db';
    ctx.font = '11px Segoe UI, sans-serif';
    ctx.fillText(p1Icon + ' ' + p1Label, p1cx, ctrlY + 16);
    ctx.fillStyle = '#666';
    ctx.font = '8px Segoe UI, sans-serif';
    ctx.fillText('TAB to swap', p1cx, ctrlY + 32);

    // P2 control type indicator
    const p2cx = SCREEN_W * 3 / 4;
    const p2Icon = p2IsCtrl ? '🎮' : '⌨️';
    const p2Label = p2IsCtrl ? 'Controller' : 'Keyboard';
    ctx.fillStyle = 'rgba(231,76,60,0.15)';
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(p2cx - 55, ctrlY, 110, 22, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e74c3c';
    ctx.font = '11px Segoe UI, sans-serif';
    ctx.fillText(p2Icon + ' ' + p2Label, p2cx, ctrlY + 16);
    if (dualPads) {
        ctx.fillStyle = '#666';
        ctx.font = '8px Segoe UI, sans-serif';
        ctx.fillText('OPTIONS to swap', p2cx, ctrlY + 32);
    }

    // --- Draw a player side ---
    function drawSide(px, pChar, pDiff, pReady, pNum) {
        const info = CHAR_INFO[pChar];
        const color = pNum === 1 ? '#3498db' : '#e74c3c';

        // Player label + control icon
        ctx.fillStyle = color;
        ctx.font = 'bold 16px Segoe UI, sans-serif';
        const pCtrl = pNum === 1 ? p1IsCtrl : p2IsCtrl;
        const pIcon = pCtrl ? '🎮' : '⌨️';
        ctx.fillText('P' + pNum + ' ' + pIcon, px, 102);

        // Character card
        const cardX = px - 85, cardY = 110, cardW = 170, cardH = 200;
        ctx.fillStyle = pReady ? 'rgba(46,204,113,0.15)' : 'rgba(255,255,255,0.04)';
        ctx.strokeStyle = pReady ? '#2ecc71' : '#444';
        ctx.lineWidth = pReady ? 3 : 1;
        ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, cardH, 10); ctx.fill(); ctx.stroke();

        // Arrows for cycling
        if (!pReady) {
            ctx.fillStyle = '#f1c40f';
            ctx.font = 'bold 22px Segoe UI, sans-serif';
            ctx.fillText('◀', cardX - 16, cardY + cardH / 2 + 5);
            ctx.fillText('▶', cardX + cardW + 16, cardY + cardH / 2 + 5);
        }

        // Character name + ability
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 20px Segoe UI, sans-serif';
        ctx.fillText(getCharName(pChar), px, cardY + 28);
        ctx.fillStyle = '#e94560';
        ctx.font = '12px Segoe UI, sans-serif';
        ctx.fillText(info.ability, px, cardY + 46);

        // Mini character sprite
        drawMiniCharacter(px - 18, cardY + 75, pChar);

        // Projectile icon + quote
        ctx.font = '16px Segoe UI, sans-serif';
        ctx.fillText(info.ballIcon, px, cardY + 165);
        ctx.fillStyle = '#888';
        ctx.font = '10px Segoe UI, sans-serif';
        ctx.fillText(info.quote, px, cardY + 185);

        // Difficulty + Ready row (below card)
        const rowY = cardY + cardH + 10;
        const cSel = pDiff === 'child';
        const aSel = pDiff === 'adult';
        ctx.strokeStyle = cSel ? '#2ecc71' : '#444';
        ctx.lineWidth = cSel ? 2 : 1;
        ctx.fillStyle = cSel ? 'rgba(46,204,113,0.2)' : 'rgba(255,255,255,0.04)';
        ctx.beginPath(); ctx.roundRect(px - 72, rowY, 65, 24, 5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = cSel ? '#2ecc71' : '#666';
        ctx.font = 'bold 12px Segoe UI, sans-serif';
        ctx.fillText('CHILD', px - 40, rowY + 16);

        ctx.strokeStyle = aSel ? '#e74c3c' : '#444';
        ctx.lineWidth = aSel ? 2 : 1;
        ctx.fillStyle = aSel ? 'rgba(231,76,60,0.2)' : 'rgba(255,255,255,0.04)';
        ctx.beginPath(); ctx.roundRect(px + 7, rowY, 65, 24, 5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = aSel ? '#e74c3c' : '#666';
        ctx.font = 'bold 12px Segoe UI, sans-serif';
        ctx.fillText('ADULT', px + 40, rowY + 16);

        // Ready / controls hint
        const hintY = rowY + 38;
        if (pReady) {
            ctx.fillStyle = '#2ecc71';
            ctx.font = 'bold 16px Segoe UI, sans-serif';
            ctx.fillText('✓ READY', px, hintY);
        } else {
            ctx.fillStyle = '#888';
            ctx.font = '11px Segoe UI, sans-serif';
            if (pNum === 1) {
                const txt = p1IsCtrl ? '← → char  ↑↓ diff  ✕ ready' : 'A/D char  W/S diff  SPACE ready';
                ctx.fillText(txt, px, hintY);
            } else {
                const txt = p2IsCtrl ? '← → char  ↑↓ diff  ✕ ready' : '← → char  ↑↓ diff  ENTER ready';
                ctx.fillText(txt, px, hintY);
            }
        }
    }

    drawSide(SCREEN_W / 4, p1Character, p1Difficulty, vsP1Ready, 1);
    drawSide(SCREEN_W * 3 / 4, p2Character, p2Difficulty, vsP2Ready, 2);

    // Bottom prompt
    if (vsP1Ready && vsP2Ready) {
        const flash = 0.5 + Math.sin(frameTime * 0.006) * 0.5;
        ctx.globalAlpha = flash;
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 18px Segoe UI, sans-serif';
        ctx.fillText(touchControlsActive ? 'TAP TO FIGHT!' : gamepadConnected ? '✕ TO FIGHT!' : 'ENTER TO FIGHT!', SCREEN_W / 2, SCREEN_H - 14);
        ctx.globalAlpha = 1;
    } else if (!touchControlsActive) {
        ctx.fillStyle = '#555';
        ctx.font = '10px Segoe UI, sans-serif';
        ctx.fillText(gamepadConnected ? '○ to go back' : 'ESC to go back', SCREEN_W / 2, SCREEN_H - 14);
    }
    ctx.textAlign = 'left';
}

function drawMiniCharacter(x, y, character) {
    // Use PNG sprite if loaded
    const img = charImages[character];
    if (img && img.complete && img.naturalWidth > 0) {
        // Draw 96x128 image scaled to fit mini card (~36x60)
        const dw = 50, dh = 67;
        ctx.drawImage(img, x + 18 - dw / 2, y - 4, dw, dh);
        return;
    }
    // Fallback: code-drawn sprite
    const cx = x + 18;
    const headY = y + 2;
    // Head (same skin for all)
    ctx.fillStyle = '#FFD3B5';
    ctx.beginPath(); ctx.arc(cx, headY, 12, 0, Math.PI * 2); ctx.fill();

    if (character === 'heath') {
        // Blonde hair
        ctx.fillStyle = '#F5D76E';
        ctx.beginPath(); ctx.arc(cx, y - 5, 14, Math.PI + 0.2, -0.2); ctx.fill();
        // Black hoodie
        ctx.fillStyle = '#333';
        ctx.fillRect(x + 4, y + 14, 28, 30);
        // Red shorts
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(x + 6, y + 36, 24, 12);
    } else if (character === 'charlie') {
        // Black scruffy hair
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath(); ctx.arc(cx, y - 5, 14, Math.PI + 0.15, -0.15); ctx.fill();
        // Barca top
        ctx.fillStyle = '#a50044';
        ctx.fillRect(x + 4, y + 14, 28, 30);
        ctx.fillStyle = '#004d98';
        ctx.fillRect(x + 4, y + 14, 7, 30); ctx.fillRect(x + 17, y + 14, 7, 30);
        // Blue shorts
        ctx.fillStyle = '#004d98';
        ctx.fillRect(x + 6, y + 36, 24, 12);
    } else if (character === 'rupert') {
        // Brown hair
        ctx.fillStyle = '#8B5E3C';
        ctx.beginPath(); ctx.arc(cx, y - 5, 14, Math.PI + 0.2, -0.2); ctx.fill();
        // Red Middlesbrough kit
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(x + 4, y + 14, 28, 30);
        // White shorts
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + 6, y + 36, 24, 12);
    } else if (character === 'jessica') {
        // Long blonde hair — full coverage, no gap
        ctx.fillStyle = '#F5D76E';
        ctx.beginPath(); ctx.arc(cx, y - 3, 14, Math.PI, 0); ctx.fill(); // top of head
        ctx.fillRect(cx - 14, y - 3, 28, 8); // fill gap between arc and sides
        // Long hair sides flowing down
        ctx.fillRect(x + 2, y - 3, 6, 30);
        ctx.fillRect(x + 28, y - 3, 6, 30);
        // Yellow Oxford kit
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(x + 4, y + 14, 28, 30);
        // Navy shorts
        ctx.fillStyle = '#1a1a4e';
        ctx.fillRect(x + 6, y + 36, 24, 12);
    } else if (character === 'emilia') {
        // Long brown hair
        ctx.fillStyle = '#6B3A2A';
        ctx.beginPath(); ctx.arc(cx, y - 3, 14, Math.PI, 0); ctx.fill(); // top of head
        ctx.fillRect(cx - 14, y - 3, 28, 8); // fill gap
        // Long hair sides flowing down
        ctx.fillRect(x + 2, y - 3, 6, 30);
        ctx.fillRect(x + 28, y - 3, 6, 30);
        // Hair bun on top
        ctx.beginPath(); ctx.arc(cx, y - 16, 6, 0, Math.PI * 2); ctx.fill();
        // Pink leotard
        ctx.fillStyle = '#ff69b4';
        ctx.fillRect(x + 4, y + 14, 28, 22);
        // Pink tutu (triangle/skirt shape)
        ctx.fillStyle = '#ffb6d9';
        ctx.beginPath();
        ctx.moveTo(x + 2, y + 34);
        ctx.lineTo(x + 34, y + 34);
        ctx.lineTo(x + 30, y + 46);
        ctx.lineTo(x + 6, y + 46);
        ctx.closePath();
        ctx.fill();
    } else if (character === 'mummy') {
        // Long blonde hair — flowing and glamorous
        ctx.fillStyle = '#f0d060';
        ctx.beginPath(); ctx.arc(cx, y - 3, 14, Math.PI, 0); ctx.fill();
        ctx.fillRect(cx - 14, y - 3, 28, 8);
        // Long flowing sides
        ctx.fillRect(x + 1, y - 3, 7, 34);
        ctx.fillRect(x + 28, y - 3, 7, 34);
        // Tapered ends
        ctx.beginPath(); ctx.moveTo(x + 1, y + 31); ctx.lineTo(x + 4, y + 36); ctx.lineTo(x + 8, y + 31); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + 28, y + 31); ctx.lineTo(x + 32, y + 36); ctx.lineTo(x + 35, y + 31); ctx.fill();
        // Fringe
        ctx.fillRect(cx - 9, y - 10, 18, 5);
        // Blue eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(cx - 4, headY, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 4, headY, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3498db';
        ctx.beginPath(); ctx.arc(cx - 4, headY, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 4, headY, 1.5, 0, Math.PI * 2); ctx.fill();
        // Eyelashes
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx - 7, headY - 2); ctx.lineTo(cx - 5, headY - 1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + 5, headY - 1); ctx.lineTo(cx + 7, headY - 2); ctx.stroke();
        // Lipstick
        ctx.fillStyle = '#c0392b';
        ctx.beginPath(); ctx.ellipse(cx, headY + 5, 3, 1.5, 0, 0, Math.PI * 2); ctx.fill();
        // Dusty pink blouse with V neckline
        ctx.fillStyle = '#d4a0a0';
        ctx.fillRect(x + 4, y + 14, 28, 22);
        ctx.fillStyle = '#e8c4c4';
        ctx.beginPath(); ctx.moveTo(cx - 4, y + 14); ctx.lineTo(cx, y + 20); ctx.lineTo(cx + 4, y + 14); ctx.closePath(); ctx.fill();
        // Belt with gold buckle
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(x + 4, y + 34, 28, 3);
        ctx.fillStyle = '#d4af37';
        ctx.fillRect(cx - 3, y + 34, 6, 3);
        // Dark slim jeans
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(x + 7, y + 37, 10, 10);
        ctx.fillRect(x + 19, y + 37, 10, 10);
        // Necklace
        ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx - 5, y + 14); ctx.quadraticCurveTo(cx, y + 18, cx + 5, y + 14); ctx.stroke();
        ctx.fillStyle = '#d4af37';
        ctx.beginPath(); ctx.arc(cx, y + 17, 1.5, 0, Math.PI * 2); ctx.fill();
        // Handbag at side
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(x + 30, y + 26, 8, 7);
        ctx.fillStyle = '#6B3410';
        ctx.fillRect(x + 30, y + 26, 8, 2);
        ctx.fillStyle = '#d4af37';
        ctx.fillRect(x + 33, y + 26, 3, 2);
        // Heeled boots
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(x + 7, y + 54, 10, 5);
        ctx.fillRect(x + 19, y + 54, 10, 5);
        ctx.fillRect(x + 7, y + 56, 3, 3);
        ctx.fillRect(x + 26, y + 56, 3, 3);
    } else if (character === 'daddy') {
        // Grey short hair — neat
        ctx.fillStyle = '#888';
        ctx.beginPath(); ctx.arc(cx, y - 5, 14, Math.PI + 0.3, -0.3); ctx.fill();
        // Sideburns
        ctx.fillRect(cx - 13, y - 5, 3, 6);
        ctx.fillRect(cx + 10, y - 5, 3, 6);
        // Stubble
        ctx.fillStyle = 'rgba(100,100,100,0.25)';
        ctx.fillRect(cx - 6, headY + 4, 12, 4);
        // Brown eyes — determined
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(cx - 4, headY, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 4, headY, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5d4037';
        ctx.beginPath(); ctx.arc(cx - 4, headY, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 4, headY, 1.5, 0, Math.PI * 2); ctx.fill();
        // Strong brows
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(cx - 7, headY - 3); ctx.lineTo(cx - 2, headY - 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + 2, headY - 2); ctx.lineTo(cx + 7, headY - 3); ctx.stroke();
        // Confident smirk
        ctx.strokeStyle = '#8B4513'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx - 3, headY + 6); ctx.quadraticCurveTo(cx, headY + 8, cx + 3, headY + 6); ctx.stroke();
        // Muscular dark green top — wider shoulders
        ctx.fillStyle = '#4a6741';
        ctx.fillRect(x, y + 14, 36, 8);
        ctx.fillRect(x + 3, y + 14, 30, 22);
        // Chest line
        ctx.strokeStyle = '#3d5636'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx, y + 16); ctx.lineTo(cx, y + 26); ctx.stroke();
        // V-neck collar
        ctx.fillStyle = '#3d5636';
        ctx.beginPath(); ctx.moveTo(cx - 4, y + 14); ctx.lineTo(cx, y + 18); ctx.lineTo(cx + 4, y + 14); ctx.closePath(); ctx.fill();
        // Blue jeans
        ctx.fillStyle = '#34495e';
        ctx.fillRect(x + 6, y + 36, 11, 12);
        ctx.fillRect(x + 19, y + 36, 11, 12);
        // Watch on wrist
        ctx.fillStyle = '#333';
        ctx.fillRect(x + 30, y + 28, 5, 4);
        ctx.fillStyle = '#c0c0c0';
        ctx.fillRect(x + 31, y + 29, 3, 2);
        ctx.fillStyle = '#d4af37';
        ctx.fillRect(x + 31.5, y + 29, 2, 1.5);
        // Trainers with white sole
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(x + 6, y + 54, 11, 5);
        ctx.fillRect(x + 19, y + 54, 11, 5);
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + 6, y + 57, 11, 1);
        ctx.fillRect(x + 19, y + 57, 11, 1);
    }

    // Legs & shoes (characters without custom legs)
    if (character !== 'mummy' && character !== 'daddy') {
        ctx.fillStyle = '#FFD3B5';
        ctx.fillRect(x + 8, y + 46, 8, 10);
        ctx.fillRect(x + 20, y + 46, 8, 10);
        ctx.fillStyle = '#333';
        ctx.fillRect(x + 7, y + 54, 10, 5);
        ctx.fillRect(x + 19, y + 54, 10, 5);
    }

    // Lock icon for locked characters
    if (!isCharUnlocked(character)) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(x - 2, y - 10, 40, 72);
        ctx.fillStyle = '#888';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🔒', cx, y + 30);
        ctx.font = '8px sans-serif';
        ctx.fillStyle = '#aaa';
        ctx.fillText('Beat game as', cx, y + 44);
        ctx.fillText('Heath/Emilia', cx, y + 53);
    }
}

// ===== VS MODE — SPLIT-SCREEN GAMEPLAY HELPERS =====
function getDifficultyFor(diff) {
    if (diff === 'child') {
        return { shootCooldownMult: 1.6, laserSpeedMult: 0.65, enemyHealthMult: 0.7, enemySpeedMult: 0.75, playerHealth: 5 };
    } else {
        return { shootCooldownMult: 0.5, laserSpeedMult: 1.5, enemyHealthMult: 1.5, enemySpeedMult: 1.3, playerHealth: 5 };
    }
}

function initVsMode() {
    const d1 = getDifficultyFor(p1Difficulty);
    const d2 = getDifficultyFor(p2Difficulty);

    // Reset P1
    player.x = 80; player.y = 300; player.vx = 0; player.vy = 0;
    player.health = d1.playerHealth; player.maxHealth = d1.playerHealth;
    player.isAttacking = false; player.attackTimer = 0; player.attackCooldown = 0;
    player.invincible = 60; player.onGround = false; player.jumps = 0;
    player.rangedAmmo = 3;
    player.specialCooldown = 0; player.specialActive = 0; player.specialType = null; player._specialHeld = false;

    // Reset P2
    player2.x = 80; player2.y = 300; player2.vx = 0; player2.vy = 0;
    player2.health = d2.playerHealth; player2.maxHealth = d2.playerHealth;
    player2.isAttacking = false; player2.attackTimer = 0; player2.attackCooldown = 0;
    player2.invincible = 60; player2.onGround = false; player2.jumps = 0;
    player2.rangedAmmo = 3;
    player2.specialCooldown = 0; player2.specialActive = 0; player2.specialType = null; player2._specialHeld = false;

    cameraX = 0; cameraX2 = 0;
    p1Score = 0; p2Score = 0;
    p1Finished = false; p2Finished = false; vsEndDelay = 0;
    p1FinishTime = 0; p2FinishTime = 0;
    p1StickersCollected = 0; p2StickersCollected = 0;
    p1EnemiesDefeated = 0; p2EnemiesDefeated = 0;
    // VS mode always starts at stage 1
    p1Stage = 1; p2Stage = 1;
    p1Projectiles = []; p2Projectiles = [];
    vsStartTime = Date.now();
    vsResultsShown = false;
    initAmbientParticles();

    // Each player gets their own copy of enemies, stickers, pickups, hearts
    p1Enemies = createEnemies();
    p2Enemies = createEnemies();
    p1Stickers = createStickers();
    p2Stickers = createStickers();
    p1WeaponPickups = createWeaponPickups();
    p2WeaponPickups = createWeaponPickups();
    p1Hearts = createHearts();
    p2Hearts = createHearts();
    p1CompanionPickups = createCompanionPickups();
    p2CompanionPickups = createCompanionPickups();
    p1ActiveCompanion = null;
    p2ActiveCompanion = null;
    vsEnemyLasers = [];

    // Reset upgrades for VS mode (no shop upgrades in VS)
    resetUpgrades();
}

function updateVsPlayer(p, pKeys, isP2) {
    // Determine input source — only accept the right type for this player
    const ctrlType = isP2 ? (gamepad2Connected ? p2ControlType : (p1ControlType === 'controller' ? 'keyboard' : 'controller')) : p1ControlType;
    const stick = isP2 ? gp2Stick : gpStick;
    const gpk = isP2 ? gp2Keys : gp1Keys;
    const usePad = ctrlType === 'controller';

    // Helper: check a key only from the allowed input source
    // Controller players only respond to gamepad buttons (tracked in gp1Keys/gp2Keys) + stick
    // Keyboard players only respond to keyboard (keys minus gamepad-set keys)
    function k(keyCode) {
        if (usePad) return !!gpk[keyCode]; // controller: only accept gamepad-pressed keys
        return keys[keyCode]; // keyboard: accept all keys
    }

    // Movement
    p.vx = 0;
    if (k(pKeys.left) || (usePad && stick.left)) p.vx = -p.speed;
    else if (k(pKeys.right) || (usePad && stick.right)) p.vx = p.speed;
    if (p.vx !== 0) p.facing = p.vx > 0 ? 1 : -1;

    // Jump (supports secondary jump key for gamepad)
    const jumpPressed = k(pKeys.jump) || (pKeys.jump2 && k(pKeys.jump2));
    if (jumpPressed && !p.jumpKeyHeld && p.jumps < p.maxJumps) {
        p.vy = p.jumpForce;
        p.jumps++;
        p.jumpKeyHeld = true;
        p.onGround = false;
    }
    if (!jumpPressed) p.jumpKeyHeld = false;

    // Melee attack (unlimited)
    if (k(pKeys.attack) && !p.isAttacking && p.attackCooldown <= 0) {
        p.isAttacking = true;
        p.attackTimer = p.attackDuration;
        p.attackCooldown = 25;
        // Charlie's homing ball in VS mode
        const charType = isP2 ? p2Character : p1Character;
        if (charType === 'charlie') {
            const enemyList = isP2 ? p2Enemies : p1Enemies;
            let nearest = null, bestDist = Infinity;
            for (const e of enemyList) {
                if (!e.alive) continue;
                const dx = (e.x + e.width / 2) - (p.x + p.width / 2);
                const dy = (e.y + e.height / 2) - (p.y + p.height / 2);
                const dist = dx * dx + dy * dy;
                if (dist < bestDist) { bestDist = dist; nearest = e; }
            }
            if (nearest) {
                const projList = isP2 ? p2Projectiles : p1Projectiles;
                projList.push({
                    x: p.x + (p.facing === 1 ? p.width + 5 : -10),
                    y: p.y + p.height / 2,
                    vx: p.facing * 8, vy: -2, spin: 0, alive: true,
                    damage: 2, isHoming: true, homingTarget: nearest, charType: 'charlie',
                });
            }
        }
    }
    if (p.isAttacking) {
        p.attackTimer--;
        if (p.attackTimer <= 0) p.isAttacking = false;
    }
    if (p.attackCooldown > 0) p.attackCooldown--;

    // Block
    if (k(pKeys.block) && !p.isAttacking) {
        p.isBlocking = true;
        p.blockTimer++;
        p.vx *= 0.3;
    } else {
        p.isBlocking = false;
        p.blockTimer = 0;
    }

    // Combined ranged/special — special takes priority when ready
    const rangedKey = pKeys.ranged;
    const charType = isP2 ? p2Character : p1Character;
    const enemyList = isP2 ? p2Enemies : p1Enemies;
    const projList = isP2 ? p2Projectiles : p1Projectiles;
    if (k(rangedKey) && !p._rangedHeld && !p.isAttacking) {
        if (p.specialCooldown <= 0 && p.specialActive <= 0) {
            // Fire special ability
            const spec = CHAR_INFO[charType].special;
            p.specialActive = spec.duration;
            p.specialCooldown = spec.cooldown;
            p.specialType = charType;
            sfxSpecial();
            if (charType === 'heath') { p.vx = p.facing * 14; p.invincible = spec.duration + 5; }
            else if (charType === 'charlie') { p.vx = p.facing * 16; p.invincible = spec.duration + 5; }
            else if (charType === 'rupert') { p.vy = -10; p.invincible = spec.duration + 5; }
            else if (charType === 'emilia') { p.invincible = spec.duration + 5; p.vy = -6; }
            else if (charType === 'mummy') { p.vy = -8; p.invincible = spec.duration + 5; }
            else if (charType === 'daddy') { p.invincible = spec.duration + 5; }
            spawnParticles(p.x + p.width / 2, p.y + p.height / 2, CHAR_INFO[charType].color, 16, 20, 4);
            p._specialHeld = true;
        } else if (p.rangedAmmo > 0) {
            // Fire ranged throw
            p.rangedAmmo--;
            projList.push({
                x: p.x + (p.facing === 1 ? p.width + 5 : -10),
                y: p.y + p.height / 2,
                vx: p.facing * 10,
                vy: -1.5,
                spin: 0,
                alive: true,
                damage: 3,
                isRanged: true,
                charType: charType,
            });
        }
        p._rangedHeld = true;
    }
    if (!k(rangedKey)) { p._rangedHeld = false; p._specialHeld = false; }
    updateSpecialAbility(p, charType, enemyList, projList);

    // Companion abilities (L1/R1) — VS-aware version
    const vsComp = isP2 ? p2ActiveCompanion : p1ActiveCompanion;
    if (!p.compCooldown) p.compCooldown = 0;
    if (p.compCooldown > 0) p.compCooldown--;
    if (vsComp && p.compCooldown <= 0) {
        const vsEnemies = isP2 ? p2Enemies : p1Enemies;
        const vsProj = isP2 ? p2Projectiles : p1Projectiles;
        if (pKeys.compQ && k(pKeys.compQ) && !p.compQHeld) {
            if (vsComp.type === 'jules') {
                for (const dir of [-1, 1]) {
                    visualEffects.push({ type: 'claw', x: p.x + p.width / 2, y: p.y + p.height / 3, vx: dir * 8, timer: 30, maxTimer: 30, dir: dir });
                }
                for (const e of vsEnemies) {
                    if (!e.alive) continue;
                    if (Math.abs((e.x + e.width / 2) - (p.x + p.width / 2)) < 200) {
                        e.health -= 3; e.hitFlash = 15;
                        if (e.health <= 0) e.alive = false;
                    }
                }
                sfxClawScratch();
                p.compCooldown = 90;
            } else if (vsComp.type === 'fishies') {
                vsProj.push({ x: p.x + (p.facing === 1 ? p.width + 5 : -10), y: p.y + p.height / 2, vx: p.facing * 7, vy: 0, spin: 0, alive: true, isWave: true, damage: 2, waveLife: 60 });
                sfxFishtailKick();
                p.compCooldown = 90;
            }
            p.compQHeld = true;
        }
        if (pKeys.compE && k(pKeys.compE) && !p.compEHeld) {
            if (vsComp.type === 'jules') {
                visualEffects.push({ type: 'soundwave', x: p.x + p.width / 2, y: p.y + p.height / 2, radius: 10, maxRadius: SCREEN_W * 0.6, timer: 45, maxTimer: 45, damaged: new Set(), vsEnemies: vsEnemies });
                sfxMegaBark();
                p.compCooldown = 150;
            } else if (vsComp.type === 'fishies') {
                for (const e of vsEnemies) {
                    if (!e.alive) continue;
                    if (Math.abs((e.x + e.width / 2) - (p.x + p.width / 2)) < 150) {
                        e.health -= 4; e.hitFlash = 15;
                        if (e.health <= 0) e.alive = false;
                    }
                }
                sfxFishMunch();
                p.compCooldown = 120;
            }
            p.compEHeld = true;
        }
    }
    if (pKeys.compQ && !k(pKeys.compQ)) p.compQHeld = false;
    if (pKeys.compE && !k(pKeys.compE)) p.compEHeld = false;

    // Gravity
    p.vy += GRAVITY;
    p.x += p.vx;
    p.y += p.vy;

    // Boundaries
    if (p.x < 0) p.x = 0;
    if (p.x + p.width > LEVEL_WIDTH) p.x = LEVEL_WIDTH - p.width;

    // Platform collisions (same as solo mode — ground segments are platforms)
    p.onGround = false;
    for (const pl of platforms) {
        if (rectCollision(p, pl)) {
            // Landing on top
            if (p.vy > 0 && p.y + p.height - p.vy <= pl.y + 4) {
                p.y = pl.y - p.height;
                p.vy = 0;
                p.onGround = true;
                p.jumps = 0;
            }
            // Hitting bottom
            else if (p.vy < 0 && p.y - p.vy >= pl.y + pl.height - 4) {
                p.y = pl.y + pl.height;
                p.vy = 0;
            }
            // Side collision
            else if (p.vx > 0) {
                p.x = pl.x - p.width;
            } else if (p.vx < 0) {
                p.x = pl.x + pl.width;
            }
        }
    }

    // Fall off screen = death
    if (p.y > SCREEN_H + 50) {
        p.health = 0;
    }

    if (p.invincible > 0) p.invincible--;

    // Animation timer — always ticks for sprite sheet support
    p.animTimer++;
    if (Math.abs(p.vx) > 0.5) {
        if (p.animTimer > 8) { p.animTimer = 0; p.animFrame = (p.animFrame + 1) % 4; }
    } else if (p.onGround && !p.isAttacking && p.specialActive <= 0) {
        p.animFrame = 0; p.animTimer = 0;
    }
}

function updateVsEnemies(enemyList, p, projList, isP2) {
    let defeated = 0;
    for (const e of enemyList) {
        if (!e.alive) continue;
        // Simple patrol movement
        e.x += e.vx;
        if (e.x <= e.patrolLeft || e.x >= e.patrolRight) e.vx *= -1;
        e.facing = e.vx > 0 ? 1 : -1;
        if (e.hitFlash > 0) e.hitFlash--;

        // Melee damage to enemy
        if (p.isAttacking) {
            const meleeRange = 28;
            const meleeBox = { x: p.facing === 1 ? p.x + p.width : p.x - meleeRange, y: p.y + 4, width: meleeRange, height: p.height - 8 };
            if (rectCollision(meleeBox, e)) {
                if (!e._hitThisSwing) {
                    e.health -= 2;
                    e.hitFlash = 10;
                    e._hitThisSwing = true;
                    if (e.health <= 0) { e.alive = false; defeated++; spawnEnemyDeathEffect(e); sfxEnemyDeath(); }
                }
            }
        } else {
            e._hitThisSwing = false;
        }

        // Enemy AI — shooting at player (stage 2+ enemies)
        const distToP = Math.abs((e.x + e.width / 2) - (p.x + p.width / 2));
        if (e.type === 'alien_giant' || e.type === 'alien_small' || e.type === 'laser_line') {
            if (distToP < 300) e.facing = p.x > e.x ? 1 : -1;
            e.shootTimer++;
            if (e.shootTimer >= e.shootCooldown && distToP < 300) {
                const origin = { x: e.x + (e.facing === 1 ? e.width + 5 : -5), y: e.y + e.height / 2 };
                const dx = (p.x + p.width / 2) - origin.x;
                const dy = (p.y + p.height / 2) - origin.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const spd = e.type === 'laser_line' ? 4 : 3;
                if (!vsEnemyLasers) vsEnemyLasers = [];
                vsEnemyLasers.push({ x: origin.x, y: origin.y, vx: dx / dist * spd, vy: dy / dist * spd, color: e.type === 'alien_giant' ? '#2ecc71' : '#e74c3c', owner: isP2 ? 2 : 1 });
                e.shootTimer = 0;
                sfxLaser();
            }
        }
        if (e.type === 'flying_shoe') {
            e.y = e.flyBaseY + Math.sin(frameTime * 0.003 + e.x * 0.01) * 25;
            if (distToP < 400) e.facing = p.x > e.x ? 1 : -1;
            e.shootTimer++;
            if (e.shootTimer >= e.shootCooldown && distToP < 350) {
                if (!vsEnemyLasers) vsEnemyLasers = [];
                vsEnemyLasers.push({ x: e.x + e.width / 2, y: e.y + e.height, vx: e.facing * 0.3, vy: 2.5, color: 'poo', isPoo: true, pooGravity: 0.12, owner: isP2 ? 2 : 1 });
                e.shootTimer = 0;
            }
        }

        // Enemy damage to player
        if (p.invincible <= 0 && rectCollision(p, e)) {
            if (!p.isBlocking) p.health--;
            p.invincible = p.isBlocking ? 30 : 60;
            sfxPlayerHurt();
        }
    }

    // Ranged projectile updates
    for (let i = 0; i < projList.length; i++) {
        const pr = projList[i];
        if (pr.isHoming) updateHomingProjectile(pr);
        pr.x += pr.vx; pr.y += pr.vy;
        if (!pr.isHoming && !pr.isWave) pr.vy += 0.15;
        if (pr.isWave) { pr.waveLife--; if (pr.waveLife <= 0) pr.alive = false; }
        pr.spin += 0.3;
        // Hit enemies
        for (const e of enemyList) {
            if (!e.alive) continue;
            if (rectCollision({ x: pr.x - 8, y: pr.y - 8, width: 16, height: 16 }, e)) {
                e.health -= pr.damage;
                e.hitFlash = 10;
                if (e.health <= 0) { e.alive = false; defeated++; spawnEnemyDeathEffect(e); sfxEnemyDeath(); }
                if (!pr.isWave) { pr.alive = false; break; } // waves pass through
            }
        }
        if (!pr.alive || pr.x < -50 || pr.x > LEVEL_WIDTH + 50 || pr.y > SCREEN_H + 50) {
            pr._remove = true;
        }
    }
    // Remove dead projectiles (modifies array in place since projList is a reference)
    for (let i = projList.length - 1; i >= 0; i--) {
        if (projList[i]._remove) projList.splice(i, 1);
    }

    return defeated;
}

function updateVsCollectibles(stickerList, p) {
    let collected = 0;
    for (const s of stickerList) {
        if (s.collected) continue;
        if (rectCollision(p, s)) {
            s.collected = true;
            collected++;
        }
    }
    return collected;
}

function updateVsPickups(p, wpList, heartList, compList, isP2) {
    // Weapon pickups — refill ranged ammo
    for (const w of wpList) {
        if (w.collected) continue;
        if (rectCollision(p, w)) {
            w.collected = true;
            p.rangedAmmo = Math.min(p.rangedAmmo + 3, 9);
        }
    }
    // Hearts — restore 1 HP
    for (const h of heartList) {
        if (h.collected) continue;
        if (rectCollision(p, h)) {
            h.collected = true;
            if (p.health < p.maxHealth) p.health++;
        }
    }
    // Companion pickups — activate companion for this player
    for (const c of compList) {
        if (c.collected) continue;
        if (rectCollision(p, c)) {
            c.collected = true;
            if (isP2) {
                p2ActiveCompanion = { type: c.companion, timer: 900 };
            } else {
                p1ActiveCompanion = { type: c.companion, timer: 900 };
            }
        }
    }
    // Update companion timers
    if (!isP2 && p1ActiveCompanion) {
        p1ActiveCompanion.timer--;
        if (p1ActiveCompanion.timer <= 0) p1ActiveCompanion = null;
    }
    if (isP2 && p2ActiveCompanion) {
        p2ActiveCompanion.timer--;
        if (p2ActiveCompanion.timer <= 0) p2ActiveCompanion = null;
    }
}

function drawVsHalf(p, cam, enemyList, stickerList, projList, pChar, pNum, stickersCol, enemiesDef, pStage, ammo, wpList, heartList, compList) {
    // Draw one half of the split screen (vertical: P1 left, P2 right)
    const halfW = Math.floor(SCREEN_W / 2);
    const offsetX = pNum === 1 ? 0 : halfW;
    ctx.save();
    ctx.beginPath();
    ctx.rect(offsetX, 0, halfW, SCREEN_H);
    ctx.clip();
    ctx.translate(offsetX, 0);

    // Draw background for this player's camera position
    const savedCameraX = cameraX;
    cameraX = cam;

    // Draw full background and platforms (these use global cameraX)
    drawBackground();
    drawPlatforms();

    // Draw stickers (swap global stickers temporarily to reuse drawStickers)
    const savedStickers = stickers;
    stickers = stickerList;
    drawStickers();
    stickers = savedStickers;

    // Draw weapon pickups
    const savedWP = weaponPickups;
    weaponPickups = wpList || [];
    drawWeaponPickups();
    weaponPickups = savedWP;

    // Draw hearts
    const savedHearts = hearts;
    hearts = heartList || [];
    drawHearts();
    hearts = savedHearts;

    // Draw companion pickups
    const savedCP = companionPickups;
    companionPickups = compList || [];
    drawCompanionPickups();
    companionPickups = savedCP;

    // Draw enemies (use the full drawEnemy which reads cameraX)
    for (const e of enemyList) {
        drawEnemy(e);
    }

    // Draw projectiles
    for (const pr of projList) {
        const prx = pr.x - cam;
        ctx.save();
        ctx.translate(prx, pr.y);
        if (pr.isWave) {
            // Fishies wave — blue water splash
            ctx.fillStyle = 'rgba(52, 152, 219, 0.7)';
            ctx.beginPath();
            ctx.moveTo(-12, 0);
            ctx.quadraticCurveTo(-6, -10, 0, 0);
            ctx.quadraticCurveTo(6, 10, 12, 0);
            ctx.quadraticCurveTo(6, -8, 0, 0);
            ctx.quadraticCurveTo(-6, 8, -12, 0);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.beginPath(); ctx.arc(-3, -3, 2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(4, 2, 1.5, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.rotate(pr.spin);
            if (pr.charType === 'emilia') {
                ctx.fillStyle = '#C4956A';
                ctx.beginPath(); ctx.ellipse(0, 2, 6, 7, 0, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(0, -6, 5, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(-4, -10, 2.5, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(4, -10, 2.5, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#222';
                ctx.beginPath(); ctx.arc(-2, -7, 0.8, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(2, -7, 0.8, 0, Math.PI * 2); ctx.fill();
            } else if (pr.charType === 'heath') {
                ctx.fillStyle = '#8B4513';
                ctx.beginPath(); ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(4, 6); ctx.stroke();
            } else {
                ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#333';
                ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const a = (i * Math.PI * 2 / 5) - Math.PI / 2;
                    ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * 4, Math.sin(a) * 4);
                }
                ctx.closePath(); ctx.fill();
            }
        }
        ctx.restore();
    }

    // Draw VS enemy lasers for this player's half
    for (const l of vsEnemyLasers) {
        if (l.owner !== pNum) continue;
        const lx = l.x - cam;
        if (l.isPoo) {
            ctx.fillStyle = '#8B4513';
            ctx.beginPath(); ctx.ellipse(lx, l.y, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#6B3410';
            ctx.beginPath(); ctx.arc(lx - 1, l.y - 2, 2, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.fillStyle = l.color;
            ctx.shadowColor = l.color;
            ctx.shadowBlur = 8;
            ctx.beginPath(); ctx.arc(lx, l.y, 4, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
        }
    }

    // Draw win flag
    const flagX = LEVEL_WIDTH - 80 - cam;
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(flagX, GROUND_Y - 50, 5, 50);
    ctx.fillStyle = '#e94560';
    ctx.beginPath();
    ctx.moveTo(flagX + 5, GROUND_Y - 50);
    ctx.lineTo(flagX + 30, GROUND_Y - 40);
    ctx.lineTo(flagX + 5, GROUND_Y - 30);
    ctx.closePath(); ctx.fill();

    // Draw player using sprite image or fallback
    const pSaved = selectedCharacter;
    selectedCharacter = pChar;
    const px = p.x - cam;
    const vsPlayerCopy = { ...p, x: p.x - cam + cameraX };
    if (!drawPlayerSprite(vsPlayerCopy, pChar)) {
        if (p.invincible > 0 && p.invincible % 4 < 2) ctx.globalAlpha = 0.4;
        drawMiniCharacter(px - 2, p.y - 8, pChar);
        ctx.globalAlpha = 1;
        if (p.isAttacking) {
            ctx.fillStyle = 'rgba(255,255,0,0.4)';
            const ax = p.facing === 1 ? px + p.width : px - 25;
            ctx.fillRect(ax, p.y + 5, 25, p.height - 10);
        }
    }
    if (p.isBlocking) {
        const bcx = px + p.width / 2;
        const bcy = p.y + p.height / 2;
        const pulse = 0.8 + Math.sin(frameTime * 0.008) * 0.2;
        ctx.save();
        ctx.globalAlpha = 0.35 * pulse;
        ctx.strokeStyle = '#4fc3f7';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(bcx, bcy, p.width * 0.8, p.height * 0.6, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#4fc3f7';
        ctx.globalAlpha = 0.1 * pulse;
        ctx.fill();
        ctx.restore();
    }
    selectedCharacter = pSaved;

    // Draw visual effects (claw marks, sound waves)
    drawVisualEffects();

    // Draw active companion following the player
    const vsComp = pNum === 1 ? p1ActiveCompanion : p2ActiveCompanion;
    if (vsComp) {
        const time = frameTime * 0.005;
        const ccx = px + p.width / 2 - p.facing * 25;
        const ccy = p.y - 15 + Math.sin(time) * 5;
        ctx.save();
        ctx.translate(ccx, ccy);
        if (vsComp.type === 'jules') {
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath(); ctx.ellipse(0, 2, 8, 6, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(0, -4, 5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#8B7355';
            ctx.beginPath(); ctx.ellipse(0, -2, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(-2, -5, 1.5, 0, Math.PI * 2); ctx.arc(2, -5, 1.5, 0, Math.PI * 2); ctx.fill();
            if (p.compCooldown <= 0) {
                ctx.fillStyle = 'rgba(241,196,15,0.6)';
                ctx.font = '9px Segoe UI'; ctx.textAlign = 'center';
                ctx.fillText(pNum === 1 ? 'Q/E' : '7/9', 0, -14);
                ctx.textAlign = 'left';
            }
        } else {
            ctx.fillStyle = '#e67e22';
            ctx.beginPath(); ctx.ellipse(0, 0, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-10, -3); ctx.lineTo(-10, 3); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(3, -1, 1.5, 0, Math.PI * 2); ctx.fill();
            if (p.compCooldown <= 0) {
                ctx.fillStyle = 'rgba(52,152,219,0.6)';
                ctx.font = '9px Segoe UI'; ctx.textAlign = 'center';
                ctx.fillText(pNum === 1 ? 'Q/E' : '7/9', 0, -10);
                ctx.textAlign = 'left';
            }
        }
        ctx.restore();
    }

    // Foreground ambient particles
    drawForegroundLayer();

    // HUD overlay for this half
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, halfW, 32);

    // Player label with control type icon
    ctx.fillStyle = pNum === 1 ? '#3498db' : '#e74c3c';
    ctx.font = 'bold 11px Segoe UI, sans-serif';
    const isCtrlPlayer = pNum === 1 ? p1ControlType === 'controller' : (gamepad2Connected ? p2ControlType === 'controller' : p1ControlType !== 'controller');
    const ctrlIcon = isCtrlPlayer ? '🎮' : '⌨️';
    ctx.fillText('P' + pNum + ' ' + ctrlIcon + ' ' + getCharName(pChar), 6, 12);

    // Hearts
    for (let i = 0; i < p.maxHealth; i++) {
        ctx.fillStyle = i < p.health ? '#e74c3c' : '#444';
        ctx.font = '12px Segoe UI';
        ctx.fillText('♥', 6 + i * 14, 28);
    }

    // Stage indicator
    const lvl = getCurrentLevel();
    ctx.fillStyle = '#fff';
    ctx.font = '10px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Stage ' + pStage, halfW / 2, 28);
    ctx.textAlign = 'left';

    // Stickers + ammo
    ctx.fillStyle = '#f1c40f';
    ctx.font = '10px Segoe UI, sans-serif';
    ctx.fillText('★' + stickersCol, halfW - 70, 12);
    ctx.fillStyle = '#e74c3c';
    ctx.fillText('⚔' + enemiesDef, halfW - 35, 12);
    ctx.fillStyle = ammo > 0 ? '#3498db' : '#555';
    ctx.fillText(CHAR_INFO[pChar].ballIcon + '×' + ammo, halfW - 70, 28);

    // Special ability mini-indicator
    const spec = CHAR_INFO[pChar].special;
    if (p.specialActive > 0) {
        ctx.fillStyle = '#f1c40f';
        ctx.font = '9px Segoe UI, sans-serif';
        ctx.fillText(spec.icon + ' GO!', halfW - 35, 28);
    } else if (p.specialCooldown <= 0) {
        ctx.fillStyle = '#2ecc71';
        ctx.font = '9px Segoe UI, sans-serif';
        ctx.fillText(spec.icon + '✓', halfW - 35, 28);
    } else {
        ctx.fillStyle = '#666';
        ctx.font = '9px Segoe UI, sans-serif';
        ctx.fillText(spec.icon + Math.ceil(p.specialCooldown / 60), halfW - 35, 28);
    }

    // Controls hint bar (compact, per-player)
    const isCtrlP = pNum === 1 ? p1ControlType === 'controller' : (gamepad2Connected ? p2ControlType === 'controller' : p1ControlType !== 'controller');
    const atkName = CHAR_INFO[pChar].attackName;
    const specN = CHAR_INFO[pChar].special.name;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, SCREEN_H - 14, halfW, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '8px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    if (isCtrlP) {
        ctx.fillText('Stick Move  △ Jump  ✕ ' + atkName + '  ○ Throw/' + specN + '  □ Block', halfW / 2, SCREEN_H - 4);
    } else if (pNum === 1) {
        ctx.fillText('WASD Move  W Jump  SPACE ' + atkName + '  CTRL Throw  SHIFT Block  G ' + specN, halfW / 2, SCREEN_H - 4);
    } else {
        ctx.fillText('← → Move  ↑ Jump  . ' + atkName + '  Enter Throw/' + specN + '  0 Block', halfW / 2, SCREEN_H - 4);
    }
    ctx.textAlign = 'left';

    cameraX = savedCameraX;

    ctx.restore();
}

// VS MODE — Results screen
function drawVsResults() {
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    ctx.textAlign = 'center';

    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 36px Segoe UI, sans-serif';
    ctx.fillText('RESULTS', SCREEN_W / 2, 60);

    // Calculate scores (finishTime=0 means died, not reached flag)
    const p1Died = p1FinishTime === 0;
    const p2Died = p2FinishTime === 0;
    const p1Completed = p1Finished && !p1Died;
    const p2Completed = p2Finished && !p2Died;
    const p1Time = p1Completed ? Math.floor((p1FinishTime - vsStartTime) / 1000) : 999;
    const p2Time = p2Completed ? Math.floor((p2FinishTime - vsStartTime) / 1000) : 999;
    const timeBonus1 = p1Completed ? Math.max(0, 150 - p1Time * 1) : 0;
    const timeBonus2 = p2Completed ? Math.max(0, 150 - p2Time * 1) : 0;
    const firstBonus1 = (p1Completed && (!p2Completed || p1FinishTime <= p2FinishTime)) ? 100 : 0;
    const firstBonus2 = (p2Completed && (!p1Completed || p2FinishTime < p1FinishTime)) ? 100 : 0;
    const total1 = p1StickersCollected * 10 + p1EnemiesDefeated * 50 + timeBonus1 + firstBonus1 + (p1Completed ? 100 : 0);
    const total2 = p2StickersCollected * 10 + p2EnemiesDefeated * 50 + timeBonus2 + firstBonus2 + (p2Completed ? 100 : 0);

    // P1 column
    const col1 = SCREEN_W / 4;
    const col2 = SCREEN_W * 3 / 4;

    ctx.fillStyle = '#3498db';
    ctx.font = 'bold 22px Segoe UI, sans-serif';
    ctx.fillText('P1 — ' + getCharName(p1Character), col1, 110);

    ctx.fillStyle = '#e74c3c';
    ctx.fillText('P2 — ' + getCharName(p2Character), col2, 110);

    // Stats
    const stats = [
        ['Stickers', p1StickersCollected, p2StickersCollected, '×10'],
        ['Enemies', p1EnemiesDefeated, p2EnemiesDefeated, '×50'],
        ['Finished', p1Died ? 'Died' : p1Completed ? 'Yes (+100)' : 'No', p2Died ? 'Died' : p2Completed ? 'Yes (+100)' : 'No', ''],
        ['Time', p1Completed ? p1Time + 's' : '—', p2Completed ? p2Time + 's' : '—', ''],
        ['Time Bonus', '+' + timeBonus1, '+' + timeBonus2, ''],
        ['First Bonus', firstBonus1 > 0 ? '+100' : '—', firstBonus2 > 0 ? '+100' : '—', ''],
    ];

    ctx.font = '14px Segoe UI, sans-serif';
    for (let i = 0; i < stats.length; i++) {
        const y = 155 + i * 30;
        ctx.fillStyle = '#888';
        ctx.fillText(stats[i][0], SCREEN_W / 2, y);
        ctx.fillStyle = '#fff';
        ctx.fillText(String(stats[i][1]), col1, y);
        ctx.fillText(String(stats[i][2]), col2, y);
    }

    // Divider
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(SCREEN_W / 2 - 200, 340); ctx.lineTo(SCREEN_W / 2 + 200, 340); ctx.stroke();

    // Totals
    ctx.font = 'bold 28px Segoe UI, sans-serif';
    ctx.fillStyle = total1 >= total2 ? '#f1c40f' : '#aaa';
    ctx.fillText(total1, col1, 380);
    ctx.fillStyle = total2 >= total1 ? '#f1c40f' : '#aaa';
    ctx.fillText(total2, col2, 380);

    // Winner
    ctx.font = 'bold 32px Segoe UI, sans-serif';
    if (total1 > total2) {
        ctx.fillStyle = '#3498db';
        ctx.fillText('PLAYER 1 WINS!', SCREEN_W / 2, 430);
    } else if (total2 > total1) {
        ctx.fillStyle = '#e74c3c';
        ctx.fillText('PLAYER 2 WINS!', SCREEN_W / 2, 430);
    } else {
        ctx.fillStyle = '#f1c40f';
        ctx.fillText("IT'S A DRAW!", SCREEN_W / 2, 430);
    }

    const flash = 0.5 + Math.sin(frameTime * 0.004) * 0.5;
    ctx.globalAlpha = flash;
    ctx.fillStyle = '#fff';
    ctx.font = '16px Segoe UI, sans-serif';
    ctx.fillText(touchControlsActive ? 'Tap to continue' : gamepadConnected ? '✕ Rematch — ○ Menu' : 'ENTER Rematch — ESC Menu', SCREEN_W / 2, 475);
    ctx.globalAlpha = 1;

    ctx.textAlign = 'left';
}

function drawCharacterSelect() {
    // Background
    ctx.fillStyle = GRAD_CHAR_SELECT;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    // Title
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 32px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FARNHAM FIGHTERS', SCREEN_W / 2, 55);

    ctx.fillStyle = '#fff';
    ctx.font = '16px Segoe UI, sans-serif';
    ctx.fillText('Choose your character', SCREEN_W / 2, 82);

    // Draw character cards in a row — sized dynamically to fill the canvas
    const margin = 20, gap = 10;
    const cardW = Math.floor((SCREEN_W - 2 * margin - (CHARACTERS.length - 1) * gap) / CHARACTERS.length);
    const cardH = 230;
    const totalW = CHARACTERS.length * cardW + (CHARACTERS.length - 1) * gap;
    const startX = (SCREEN_W - totalW) / 2;
    const cardY = 100;

    for (let i = 0; i < CHARACTERS.length; i++) {
        const c = CHARACTERS[i];
        const info = CHAR_INFO[c];
        const isSel = selectedCharacter === c;
        const cx = startX + i * (cardW + gap);
        const midX = cx + cardW / 2;

        // Card background
        ctx.strokeStyle = isSel ? '#f1c40f' : '#555';
        ctx.lineWidth = isSel ? 4 : 2;
        ctx.fillStyle = isSel ? 'rgba(241,196,15,0.1)' : 'rgba(255,255,255,0.05)';
        ctx.beginPath();
        ctx.roundRect(cx, cardY, cardW, cardH, 10);
        ctx.fill();
        ctx.stroke();

        // Selection arrow
        if (isSel) {
            ctx.fillStyle = '#f1c40f';
            ctx.beginPath();
            ctx.moveTo(midX - 8, cardY - 8);
            ctx.lineTo(midX + 8, cardY - 8);
            ctx.lineTo(midX, cardY - 1);
            ctx.closePath();
            ctx.fill();
        }

        // Draw mini character sprite
        drawMiniCharacter(midX - 18, cardY + 30, c);

        // Name
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Segoe UI, sans-serif';
        ctx.fillText(getCharName(c), midX, cardY + 145);
        // Ability
        ctx.fillStyle = isSel ? '#f1c40f' : '#aaa';
        ctx.font = '11px Segoe UI, sans-serif';
        ctx.fillText(info.ability, midX, cardY + 165);
        // Quote
        ctx.fillStyle = '#888';
        ctx.font = '10px Segoe UI, sans-serif';
        ctx.fillText(info.quote, midX, cardY + 183);
        // Projectile icon
        ctx.font = '18px Segoe UI, sans-serif';
        ctx.fillText(info.ballIcon, midX, cardY + 212);
    }

    // Bottom options — lay out Difficulty and Controls side by side
    const optY = cardY + cardH + 18;

    // --- Difficulty (left side) ---
    ctx.font = '12px Segoe UI, sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Difficulty', SCREEN_W / 2 - 120, optY);

    const childSel = difficulty === 'child';
    const adultSel = difficulty === 'adult';
    const diffBtnY = optY + 6;

    ctx.strokeStyle = childSel ? '#2ecc71' : '#555';
    ctx.lineWidth = childSel ? 3 : 1;
    ctx.fillStyle = childSel ? 'rgba(46,204,113,0.2)' : 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.roundRect(SCREEN_W / 2 - 175, diffBtnY, 90, 30, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = childSel ? '#2ecc71' : '#888';
    ctx.font = 'bold 14px Segoe UI, sans-serif';
    ctx.fillText('CHILD', SCREEN_W / 2 - 130, diffBtnY + 20);

    ctx.strokeStyle = adultSel ? '#e74c3c' : '#555';
    ctx.lineWidth = adultSel ? 3 : 1;
    ctx.fillStyle = adultSel ? 'rgba(231,76,60,0.2)' : 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.roundRect(SCREEN_W / 2 - 78, diffBtnY, 90, 30, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = adultSel ? '#e74c3c' : '#888';
    ctx.font = 'bold 14px Segoe UI, sans-serif';
    ctx.fillText('ADULT', SCREEN_W / 2 - 33, diffBtnY + 20);

    // --- Controls (right side) ---
    ctx.font = '12px Segoe UI, sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Controls', SCREEN_W / 2 + 120, optY);

    const isCtrl = p1ControlType === 'controller';
    const isKbd = p1ControlType === 'keyboard';

    ctx.strokeStyle = isCtrl ? '#3498db' : '#555';
    ctx.lineWidth = isCtrl ? 3 : 1;
    ctx.fillStyle = isCtrl ? 'rgba(52,152,219,0.2)' : 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.roundRect(SCREEN_W / 2 + 18, diffBtnY, 100, 30, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = isCtrl ? '#3498db' : '#888';
    ctx.font = '13px Segoe UI, sans-serif';
    ctx.fillText('🎮 Controller', SCREEN_W / 2 + 68, diffBtnY + 20);

    ctx.strokeStyle = isKbd ? '#3498db' : '#555';
    ctx.lineWidth = isKbd ? 3 : 1;
    ctx.fillStyle = isKbd ? 'rgba(52,152,219,0.2)' : 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.roundRect(SCREEN_W / 2 + 125, diffBtnY, 100, 30, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = isKbd ? '#3498db' : '#888';
    ctx.font = '13px Segoe UI, sans-serif';
    ctx.fillText('⌨️ Keyboard', SCREEN_W / 2 + 175, diffBtnY + 20);

    // Instructions
    if (!touchControlsActive) {
        ctx.fillStyle = '#f1c40f';
        ctx.font = '13px Segoe UI, sans-serif';
        if (gamepadConnected) {
            ctx.fillText('← → char    ↑↓ diff    SHARE controls    ✕ start    ○ back', SCREEN_W / 2, SCREEN_H - 14);
        } else {
            ctx.fillText('← → char    ↑↓ diff    TAB controls    ENTER start    ESC back', SCREEN_W / 2, SCREEN_H - 14);
        }
    }
    ctx.textAlign = 'left';
}

// ============================================================
// SPECIAL ABILITIES — unique per character
// ============================================================
function sfxSpecial() {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.type = 'square';
    o.frequency.setValueAtTime(600, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
    o.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.3);
    g.gain.setValueAtTime(0.15, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
    o.start(); o.stop(audioCtx.currentTime + 0.35);
}

function activateSpecialAbility(p, triggerKey, charType) {
    const spec = CHAR_INFO[charType].special;
    if (keys[triggerKey] && !p._specialHeld && p.specialCooldown <= 0 && p.specialActive <= 0) {
        p.specialActive = spec.duration;
        p.specialCooldown = spec.cooldown;
        p.specialType = charType;
        sfxSpecial();
        if (charType === 'heath') {
            p.vx = p.facing * 14; p.invincible = spec.duration + 5;
        } else if (charType === 'charlie') {
            p.vx = p.facing * 16; p.invincible = spec.duration + 5;
        } else if (charType === 'rupert') {
            p.vy = -10; p.invincible = spec.duration + 5;
        } else if (charType === 'emilia') {
            p.invincible = spec.duration + 5; p.vy = -6;
        } else if (charType === 'mummy') {
            // Handbag Slam — ground pound with wide area damage
            p.vy = -8; p.invincible = spec.duration + 5;
        } else if (charType === 'daddy') {
            // Power Watch — energy blast in all directions
            p.invincible = spec.duration + 5;
        }
        spawnParticles(p.x + p.width / 2, p.y + p.height / 2, CHAR_INFO[charType].color, 16, 20, 4);
        p._specialHeld = true;
    }
    if (!keys[triggerKey]) p._specialHeld = false;
}

function updateSpecialAbility(p, charType, enemyList, projList) {
    if (p.specialActive > 0) {
        p.specialActive--;
        if (p.specialType === 'heath') {
            p.vx = p.facing * 14;
            for (const e of enemyList) {
                if (!e.alive) continue;
                if (rectCollision(p, e)) {
                    e.health -= 4; e.hitFlash = 10; e.x += p.facing * 40;
                    spawnParticles(e.x + e.width / 2, e.y + e.height / 2, '#ffaa00', 8, 15, 3);
                    if (e.health <= 0) { e.alive = false; sfxEnemyDeath(); }
                }
            }
        } else if (p.specialType === 'charlie') {
            p.vx = p.facing * 16;
            for (const e of enemyList) {
                if (!e.alive) continue;
                if (rectCollision(p, e)) {
                    e.health -= 3; e.hitFlash = 10;
                    spawnParticles(e.x + e.width / 2, e.y + e.height / 2, '#a50044', 6, 12, 2);
                    if (e.health <= 0) { e.alive = false; sfxEnemyDeath(); }
                }
            }
        } else if (p.specialType === 'rupert') {
            if (p.onGround && p.specialActive < CHAR_INFO.rupert.special.duration - 5) {
                const stompRange = 120;
                for (const e of enemyList) {
                    if (!e.alive) continue;
                    const dist = Math.abs((e.x + e.width / 2) - (p.x + p.width / 2));
                    if (dist < stompRange && Math.abs(e.y - p.y) < 60) {
                        e.health -= 5; e.hitFlash = 15;
                        e.x += (e.x > p.x ? 1 : -1) * 30;
                        spawnParticles(e.x + e.width / 2, e.y + e.height / 2, '#e74c3c', 10, 18, 3);
                        if (e.health <= 0) { e.alive = false; sfxEnemyDeath(); }
                    }
                }
                addScreenShake(8, 15);
                spawnParticles(p.x + p.width / 2, p.y + p.height, '#8B4513', 20, 25, 4);
                p.specialActive = 0;
            }
        } else if (p.specialType === 'jessica') {
            // Homing Shot — fires once (duration=1)
            let nearest = null, minDist = 600;
            for (const e of enemyList) {
                if (!e.alive) continue;
                const dx = (e.x + e.width / 2) - (p.x + p.width / 2);
                const dy = (e.y + e.height / 2) - (p.y + p.height / 2);
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < minDist) { minDist = d; nearest = e; }
            }
            if (nearest) {
                const dx = (nearest.x + nearest.width / 2) - (p.x + p.width / 2);
                const dy = (nearest.y + nearest.height / 2) - (p.y + p.height / 2);
                const ang = Math.atan2(dy, dx);
                projList.push({
                    x: p.x + p.width / 2, y: p.y + p.height / 2,
                    vx: Math.cos(ang) * 14, vy: Math.sin(ang) * 14,
                    spin: 0, alive: true, damage: 6, isRanged: true,
                    isHoming: true, homingTarget: nearest, charType: 'jessica',
                });
            } else {
                projList.push({
                    x: p.x + (p.facing === 1 ? p.width + 5 : -10), y: p.y + p.height / 2,
                    vx: p.facing * 14, vy: 0, spin: 0, alive: true, damage: 6,
                    isRanged: true, charType: 'jessica',
                });
            }
        } else if (p.specialType === 'emilia') {
            p.vy = Math.min(p.vy, -1);
            const spinRange = 60;
            for (const e of enemyList) {
                if (!e.alive) continue;
                const dx = (e.x + e.width / 2) - (p.x + p.width / 2);
                const dy = (e.y + e.height / 2) - (p.y + p.height / 2);
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < spinRange && p.specialActive % 8 === 0) {
                    e.health -= 2; e.hitFlash = 8;
                    spawnParticles(e.x + e.width / 2, e.y + e.height / 2, '#ff69b4', 4, 10, 2);
                    if (e.health <= 0) { e.alive = false; sfxEnemyDeath(); }
                }
            }
            if (p.specialActive % 3 === 0) {
                spawnParticles(p.x + p.width / 2 + (Math.random() - 0.5) * 40,
                               p.y + p.height / 2 + (Math.random() - 0.5) * 40, '#ff69b4', 2, 8, 1);
            }
        } else if (p.specialType === 'mummy') {
            // Handbag Slam — on the way down, smash ground for area damage
            if (p.specialActive < 15 && p.onGround) {
                // Ground slam! Wide area damage
                const slamRange = 120;
                addScreenShake(6, 12);
                for (const e of enemyList) {
                    if (!e.alive) continue;
                    const dx = Math.abs((e.x + e.width / 2) - (p.x + p.width / 2));
                    if (dx < slamRange) {
                        e.health -= 4; e.hitFlash = 12;
                        e.x += (e.x > p.x ? 30 : -30); // knockback
                        spawnParticles(e.x + e.width / 2, e.y + e.height / 2, '#8B4513', 6, 12, 3);
                        sfxHit();
                        if (e.health <= 0) { e.alive = false; sfxEnemyDeath(); }
                    }
                }
                // Handbag impact particles
                spawnParticles(p.x + p.width / 2, p.y + p.height, '#d4af37', 12, 15, 4);
                spawnParticles(p.x + p.width / 2, p.y + p.height, '#8B4513', 8, 12, 3);
                p.specialActive = 0; // end immediately after slam
            }
        } else if (p.specialType === 'daddy') {
            // Power Watch — energy blast expanding outward
            if (p.specialActive === 18) {
                // Initial blast — damages all nearby enemies
                const blastRange = 160;
                addScreenShake(5, 10);
                for (const e of enemyList) {
                    if (!e.alive) continue;
                    const dx = (e.x + e.width / 2) - (p.x + p.width / 2);
                    const dy = (e.y + e.height / 2) - (p.y + p.height / 2);
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < blastRange) {
                        e.health -= 3; e.hitFlash = 10;
                        const pushDir = Math.atan2(dy, dx);
                        e.x += Math.cos(pushDir) * 25;
                        spawnParticles(e.x + e.width / 2, e.y + e.height / 2, '#d4af37', 5, 10, 3);
                        sfxHit();
                        if (e.health <= 0) { e.alive = false; sfxEnemyDeath(); }
                    }
                }
            }
            // Golden energy ring expanding
            if (p.specialActive % 2 === 0) {
                const angle = Math.random() * Math.PI * 2;
                const radius = (20 - p.specialActive) * 8;
                spawnParticles(p.x + p.width / 2 + Math.cos(angle) * radius,
                               p.y + p.height / 2 + Math.sin(angle) * radius, '#d4af37', 2, 6, 2);
            }
        }
    }
    if (p.specialCooldown > 0) p.specialCooldown--;
}

function findNearestEnemy(p) {
    let nearest = null;
    let bestDist = Infinity;
    for (const e of enemies) {
        if (!e.alive) continue;
        const dx = (e.x + e.width / 2) - (p.x + p.width / 2);
        const dy = (e.y + e.height / 2) - (p.y + p.height / 2);
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) { bestDist = dist; nearest = e; }
    }
    return nearest;
}

function updateHomingProjectile(proj) {
    if (!proj.isHoming || !proj.homingTarget) return;
    const t = proj.homingTarget;
    if (!t.alive) { proj.isHoming = false; return; }
    const dx = (t.x + t.width / 2) - proj.x;
    const dy = (t.y + t.height / 2) - proj.y;
    const ang = Math.atan2(dy, dx);
    proj.vx = proj.vx * 0.85 + Math.cos(ang) * 14 * 0.15;
    proj.vy = proj.vy * 0.85 + Math.sin(ang) * 14 * 0.15;
}

// ============================================================
// ANIMATED SPRITE SYSTEM
// ============================================================
// Sprite sheets: if a file like "heath_sheet.png" exists, it's used as a
// sprite sheet (grid of frames). Otherwise the static PNG gets animated
// using transform-based effects (squash, stretch, lean, bob, shake).
//
// Sprite sheet format (if used): horizontal strip, each frame = 96×128px
// Row 0: idle (4 frames), Row 1: walk (6 frames), Row 2: jump (2 frames),
// Row 3: attack (4 frames), Row 4: block (2 frames), Row 5: special (4 frames)

const ANIM_STATES = {
    idle:    { row: 0, frames: 4, speed: 10 },
    walk:    { row: 1, frames: 6, speed: 5 },
    jump:    { row: 2, frames: 2, speed: 8 },
    fall:    { row: 2, frames: 2, speed: 8, startFrame: 1 }, // second frame of jump row
    attack:  { row: 3, frames: 4, speed: 4 },
    block:   { row: 4, frames: 2, speed: 12 },
    special: { row: 5, frames: 4, speed: 4 },
};

const SPRITE_FRAME_W = 96;
const SPRITE_FRAME_H = 128;

// Load sprite sheets (optional — game works without them)
const charSheets = {};
let charSheetsLoaded = 0;
for (const c of CHARACTERS) {
    charSheets[c] = new Image();
    charSheets[c].src = c + '_sheet.png';
    charSheets[c].onload = () => { charSheetsLoaded++; };
    charSheets[c].onerror = () => { charSheets[c] = null; }; // no sheet, use static
}

function getAnimState(p) {
    if (p.specialActive > 0) return 'special';
    if (p.isAttacking) return 'attack';
    if (p.isBlocking) return 'block';
    if (!p.onGround && p.vy < 0) return 'jump';
    if (!p.onGround && p.vy >= 0) return 'fall';
    if (Math.abs(p.vx) > 0.5) return 'walk';
    return 'idle';
}

function drawPlayerSprite(p, character) {
    const img = charImages[character];
    if (!img || !img.complete || img.naturalWidth === 0) return false;

    const sx = p.x - cameraX;
    const flash = p.invincible > 0 && Math.floor(p.invincible / 4) % 2 === 0;
    if (flash) ctx.globalAlpha = 0.4;

    const animState = getAnimState(p);
    const sheet = charSheets[character];
    const hasSheet = sheet && sheet.complete && sheet.naturalWidth > 0;

    ctx.save();

    if (hasSheet) {
        // ---- SPRITE SHEET MODE ----
        const anim = ANIM_STATES[animState];
        const startFrame = anim.startFrame || 0;
        const frameIndex = startFrame + (Math.floor(p.animTimer / anim.speed) % anim.frames);
        const srcX = frameIndex * SPRITE_FRAME_W;
        const srcY = anim.row * SPRITE_FRAME_H;
        const dw = 48, dh = 64;

        ctx.translate(sx + p.width / 2, p.y + p.height / 2);
        if (p.facing === -1) ctx.scale(-1, 1);
        ctx.drawImage(sheet, srcX, srcY, SPRITE_FRAME_W, SPRITE_FRAME_H, -dw / 2, -dh / 2 - 4, dw, dh);

    } else {
        // ---- TRANSFORM ANIMATION MODE (static PNG) ----
        // Animate the single sprite using transforms based on state
        const t = frameTime * 0.001;
        let offY = 0, scaleX = 1, scaleY = 1, rotation = 0;

        if (animState === 'idle') {
            // Gentle breathing bob
            offY = Math.sin(t * 2.5) * 1.5;
            scaleX = 1 + Math.sin(t * 2.5) * 0.015;
            scaleY = 1 - Math.sin(t * 2.5) * 0.015;
        } else if (animState === 'walk') {
            // Bouncy walk cycle + lean
            const walkCycle = Math.sin(p.animFrame * 0.6);
            offY = -Math.abs(walkCycle) * 3;
            rotation = walkCycle * 0.04 * p.facing;
            scaleX = 1 + Math.abs(walkCycle) * 0.03;
            scaleY = 1 - Math.abs(walkCycle) * 0.02;
        } else if (animState === 'jump') {
            // Stretch upward
            scaleX = 0.9;
            scaleY = 1.12;
            offY = -2;
        } else if (animState === 'fall') {
            // Slight squash, arms up feel
            scaleX = 1.08;
            scaleY = 0.92;
            offY = 1;
        } else if (animState === 'attack') {
            // Lunge forward + squash
            const attackProg = p.attackTimer / p.attackDuration;
            rotation = (CHAR_INFO[character].isTackle ? 0.15 : 0.1) * p.facing * attackProg;
            scaleX = 1 + attackProg * 0.1;
            scaleY = 1 - attackProg * 0.05;
            offY = -attackProg * 3;
        } else if (animState === 'block') {
            // Hunker down — squash
            scaleX = 1.1;
            scaleY = 0.9;
            offY = 3;
        } else if (animState === 'special') {
            // Per-character special animation
            const specPulse = Math.sin(t * 12);
            if (character === 'heath') {
                // Bulldozer — lean forward hard
                rotation = 0.2 * p.facing;
                scaleX = 1.15; scaleY = 0.9;
            } else if (character === 'charlie') {
                // Skill Move — streaky blur
                scaleX = 1.2; scaleY = 0.85;
                rotation = 0.05 * p.facing;
            } else if (character === 'rupert') {
                // Power Stomp — big squash on ground, stretch in air
                if (p.onGround) { scaleX = 1.3; scaleY = 0.7; offY = 5; }
                else { scaleX = 0.8; scaleY = 1.2; offY = -3; }
            } else if (character === 'jessica') {
                // Homing Shot — aim pose
                scaleX = 1.05; rotation = -0.1 * p.facing;
            } else if (character === 'emilia') {
                // Pirouette — spin!
                rotation = t * 15; // fast spin
                scaleX = 1 + specPulse * 0.05;
                scaleY = 1 - specPulse * 0.05;
                offY = -4;
            }
        }

        const dw = 48, dh = 64;
        ctx.translate(sx + p.width / 2, p.y + p.height / 2 + offY);
        ctx.rotate(rotation);
        ctx.scale(p.facing === -1 ? -scaleX : scaleX, scaleY);
        ctx.drawImage(img, -dw / 2, -dh / 2 - 4, dw, dh);

        // Attack hit effect
        if (p.isAttacking) {
            const info = CHAR_INFO[character];
            if (info.isTackle) {
                ctx.fillStyle = 'rgba(255,255,255,0.4)';
                ctx.beginPath(); ctx.arc(18, 10, 10 + (Math.sin(frameTime * 0.02) + 1) * 2, 0, Math.PI * 2); ctx.fill();
            } else {
                ctx.fillStyle = 'rgba(241,196,15,0.5)';
                ctx.beginPath(); ctx.arc(18, 20, 9 + (Math.sin(frameTime * 0.02) + 1) * 2, 0, Math.PI * 2); ctx.fill();
            }
        }
    }

    ctx.restore();
    ctx.globalAlpha = 1;

    // Shadow — squishes when jumping, stretches when landing
    const shadowScale = p.onGround ? 1 : 0.7;
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(sx + p.width / 2, p.y + p.height + 2, 14 * shadowScale, 4 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    return true;
}

function drawPlayer(p) {
    // Try sprite image first, fall back to code-drawn
    if (!drawPlayerSprite(p, selectedCharacter)) {
        const charDrawFn = { heath: drawHeath, charlie: drawCharlie, rupert: drawRupert, jessica: drawJessica, emilia: drawEmilia, mummy: drawMummy, daddy: drawDaddy };
        (charDrawFn[selectedCharacter] || drawHeath)(p);
    }
    // Shield visual when blocking
    if (p.isBlocking) {
        const sx = p.x - cameraX;
        const cx = sx + p.width / 2;
        const cy = p.y + p.height / 2;
        const pulse = 0.8 + Math.sin(frameTime * 0.008) * 0.2;
        ctx.save();
        ctx.globalAlpha = 0.35 * pulse;
        ctx.strokeStyle = '#4fc3f7';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(cx, cy, p.width * 0.8, p.height * 0.6, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#4fc3f7';
        ctx.globalAlpha = 0.1 * pulse;
        ctx.fill();
        ctx.restore();
    }
    // Special ability visual effects
    if (p.specialActive > 0) {
        drawSpecialEffect(p, p.specialType);
    }
}

function drawSpecialEffect(p, charType) {
    const sx = p.x - cameraX;
    const cx = sx + p.width / 2;
    const cy = p.y + p.height / 2;
    const t = frameTime * 0.01;
    ctx.save();
    if (charType === 'heath') {
        ctx.globalAlpha = 0.4; ctx.fillStyle = '#ff6600';
        ctx.beginPath(); ctx.ellipse(cx, cy, p.width + 10, p.height * 0.7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffaa00'; ctx.lineWidth = 2; ctx.globalAlpha = 0.6;
        for (let i = 0; i < 5; i++) {
            const ly = cy - 15 + i * 8;
            const lx = sx + (p.facing === 1 ? -10 : p.width + 10);
            ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx - p.facing * (20 + (Math.sin(frameTime * 0.025 + i * 1.3) + 1) * 7.5), ly); ctx.stroke();
        }
    } else if (charType === 'charlie') {
        ctx.globalAlpha = 0.25; ctx.fillStyle = '#3498db';
        for (let i = 1; i <= 3; i++) { ctx.fillRect(sx - p.facing * i * 12, p.y, p.width, p.height); ctx.globalAlpha *= 0.5; }
    } else if (charType === 'rupert') {
        if (p.onGround) {
            ctx.globalAlpha = 0.5; ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 3;
            const ringR = 120 * (1 - p.specialActive / 30);
            ctx.beginPath(); ctx.ellipse(cx, p.y + p.height, ringR, 8, 0, 0, Math.PI * 2); ctx.stroke();
        } else {
            ctx.globalAlpha = 0.5; ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('⬇', cx, p.y + p.height + 20); ctx.textAlign = 'left';
        }
    } else if (charType === 'jessica') {
        ctx.globalAlpha = 0.6; ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, 25, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - 30, cy); ctx.lineTo(cx + 30, cy);
        ctx.moveTo(cx, cy - 30); ctx.lineTo(cx, cy + 30); ctx.stroke();
    } else if (charType === 'emilia') {
        ctx.globalAlpha = 0.4; ctx.strokeStyle = '#ff69b4'; ctx.lineWidth = 3;
        const spinAngle = t * 3;
        ctx.beginPath(); ctx.ellipse(cx, cy, 35 + Math.sin(spinAngle) * 5, 35 + Math.cos(spinAngle) * 5, spinAngle, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.15; ctx.fillStyle = '#ff69b4';
        ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
}

function drawEnemy(e) {
    if (!e.alive) return;
    const sx = e.x - cameraX;
    if (sx > SCREEN_W + 60 || sx + e.width < -60) return;

    if (e.type === 'spike') drawSpikeMonster(e, sx);
    else if (e.type === 'alien_giant') drawGiantAlien(e, sx);
    else if (e.type === 'alien_small') drawSmallAlien(e, sx);
    else if (e.type === 'laser_line') drawLaserLine(e, sx);
    else if (e.type === 'flying_shoe') drawFlyingShoe(e, sx);
}

// --- STAGES 3-4: Flying Shoe (drops poo) ---
function drawFlyingShoe(e, sx) {
    ctx.save();
    ctx.translate(sx + e.width / 2, e.y + e.height / 2);
    if (e.facing === -1) ctx.scale(-1, 1);
    const isHit = e.hitFlash > 0;
    const bob = Math.sin(frameTime * 0.005 + e.x) * 3;
    const flapAngle = Math.sin(frameTime * 0.015 + e.x) * 0.15;
    ctx.rotate(flapAngle);

    // Shadow on ground
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.ellipse(0, GROUND_Y - e.y, 14, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sole (bottom of shoe)
    ctx.fillStyle = isHit ? '#ff4444' : '#333';
    ctx.beginPath();
    ctx.roundRect(-18, 2 + bob, 36, 6, 3);
    ctx.fill();

    // Shoe body
    ctx.fillStyle = isHit ? '#ff6666' : (e.shoeColor || '#e74c3c');
    ctx.beginPath();
    ctx.roundRect(-16, -8 + bob, 32, 12, 4);
    ctx.fill();

    // Toe cap — raised front
    ctx.fillStyle = isHit ? '#ff8888' : '#fff';
    ctx.beginPath();
    ctx.roundRect(10, -10 + bob, 10, 10, [4, 4, 0, 0]);
    ctx.fill();

    // Tongue
    ctx.fillStyle = isHit ? '#ff8888' : '#ddd';
    ctx.beginPath();
    ctx.roundRect(-4, -14 + bob, 10, 8, [3, 3, 0, 0]);
    ctx.fill();

    // Laces
    ctx.strokeStyle = isHit ? '#ffaaaa' : '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-6, -6 + bob); ctx.lineTo(2, -8 + bob);
    ctx.moveTo(-4, -3 + bob); ctx.lineTo(4, -5 + bob);
    ctx.stroke();

    // Swoosh / stripe
    ctx.strokeStyle = isHit ? '#ffcccc' : '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-12, -2 + bob);
    ctx.quadraticCurveTo(0, 4 + bob, 10, -4 + bob);
    ctx.stroke();

    // Evil eyes on the toe
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(12, -4 + bob, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(17, -4 + bob, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(12, -3 + bob, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(17, -3 + bob, 1.5, 0, Math.PI * 2); ctx.fill();
    // Angry brows
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(9, -7 + bob); ctx.lineTo(13, -6 + bob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(20, -7 + bob); ctx.lineTo(16, -6 + bob); ctx.stroke();

    // Wings (little flapping wings on sides)
    const wingY = -6 + bob + Math.sin(frameTime * 0.02) * 4;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    // Left wing
    ctx.beginPath();
    ctx.moveTo(-14, -4 + bob);
    ctx.quadraticCurveTo(-24, wingY - 8, -18, wingY);
    ctx.quadraticCurveTo(-14, wingY + 2, -14, -2 + bob);
    ctx.fill();
    // Right wing
    ctx.beginPath();
    ctx.moveTo(-10, -4 + bob);
    ctx.quadraticCurveTo(-20, wingY - 10, -14, wingY - 2);
    ctx.quadraticCurveTo(-10, wingY, -10, -2 + bob);
    ctx.fill();

    // Health bar
    if (e.health < e.maxHealth) {
        ctx.fillStyle = '#333';
        ctx.fillRect(-15, -20 + bob, 30, 4);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(-15, -20 + bob, 30 * (e.health / e.maxHealth), 4);
    }

    ctx.restore();
}

// --- STAGE 1: Purple Spike Monster ---
function drawSpikeMonster(e, sx) {
    ctx.save();
    ctx.translate(sx + e.width / 2, e.y + e.height / 2);
    if (e.facing === -1) ctx.scale(-1, 1);
    const isHit = e.hitFlash > 0;
    const bob = Math.sin(frameTime * 0.006 + e.x) * 2;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(0, 22, 16, 4, 0, 0, Math.PI * 2); ctx.fill();

    // Body — rounder, with gradient feel
    ctx.fillStyle = isHit ? '#ff4444' : '#8e44ad';
    ctx.beginPath(); ctx.ellipse(0, 4 + bob, 22, 20, 0, 0, Math.PI * 2); ctx.fill();
    // Belly highlight
    ctx.fillStyle = isHit ? '#ff6666' : '#a569bd';
    ctx.beginPath(); ctx.ellipse(-3, 2 + bob, 12, 10, -0.2, 0, Math.PI * 2); ctx.fill();
    // Dark underside
    ctx.fillStyle = isHit ? '#cc3333' : '#6c3483';
    ctx.beginPath(); ctx.ellipse(0, 12 + bob, 20, 10, 0, 0, Math.PI); ctx.fill();

    // Spikes — with shading
    for (const sp of [-14, -6, 2, 10]) {
        ctx.fillStyle = isHit ? '#ff6666' : '#bb8fce';
        ctx.beginPath(); ctx.moveTo(sp - 5, -10 + bob); ctx.lineTo(sp, -26 + bob); ctx.lineTo(sp + 5, -10 + bob); ctx.closePath(); ctx.fill();
        // Spike highlight
        ctx.fillStyle = isHit ? '#ff8888' : '#d7bde2';
        ctx.beginPath(); ctx.moveTo(sp - 2, -10 + bob); ctx.lineTo(sp, -26 + bob); ctx.lineTo(sp + 1, -10 + bob); ctx.closePath(); ctx.fill();
    }

    // Eyes — bigger, more expressive
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(-7, -3 + bob, 6, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(7, -3 + bob, 6, 7, 0, 0, Math.PI * 2); ctx.fill();
    // Iris
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath(); ctx.arc(-6, -2 + bob, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(8, -2 + bob, 3.5, 0, Math.PI * 2); ctx.fill();
    // Pupil
    ctx.fillStyle = '#1a0000';
    ctx.beginPath(); ctx.arc(-6, -2 + bob, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(8, -2 + bob, 1.5, 0, Math.PI * 2); ctx.fill();
    // Eye shine
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-8, -4 + bob, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -4 + bob, 1.5, 0, Math.PI * 2); ctx.fill();

    // Angry brows — thicker
    ctx.strokeStyle = '#2c0040'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-14, -10 + bob); ctx.lineTo(-4, -6 + bob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(14, -10 + bob); ctx.lineTo(4, -6 + bob); ctx.stroke();

    // Jagged mouth with teeth
    ctx.fillStyle = '#1a0000';
    ctx.beginPath();
    ctx.moveTo(-8, 8 + bob);
    for (let t = -8; t <= 8; t += 4) { ctx.lineTo(t, (t / 4) % 2 === 0 ? 6 + bob : 12 + bob); }
    ctx.closePath(); ctx.fill();
    // Teeth
    ctx.fillStyle = '#fff';
    ctx.fillRect(-4, 7 + bob, 2, 3); ctx.fillRect(2, 7 + bob, 2, 3);

    // Outline
    ctx.strokeStyle = 'rgba(60,0,80,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, 4 + bob, 22, 20, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
}

// --- STAGE 2: Giant Alien with Laser Blaster ---
const ALIEN_COLORS = { green: '#27ae60', purple: '#8e44ad', orange: '#e67e22' };
const ALIEN_LIGHT_COLORS = { green: '#2ecc71', purple: '#a569bd', orange: '#f39c12' };
const ALIEN_DARK_COLORS = { green: '#1e8449', purple: '#6c3483', orange: '#ca6f1e' };

function drawGiantAlien(e, sx) {
    ctx.save();
    ctx.translate(sx + e.width / 2, e.y + e.height / 2);
    if (e.facing === -1) ctx.scale(-1, 1);
    const isHit = e.hitFlash > 0;
    const bob = Math.sin(frameTime * 0.004 + e.x) * 1.5;
    const baseColor = isHit ? '#ff4444' : (ALIEN_COLORS[e.alienColor] || '#27ae60');
    const lightColor = isHit ? '#ff6666' : (ALIEN_LIGHT_COLORS[e.alienColor] || '#2ecc71');
    const darkColor = isHit ? '#cc3333' : (ALIEN_DARK_COLORS[e.alienColor] || '#1e8449');

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(0, 36, 20, 5, 0, 0, Math.PI * 2); ctx.fill();

    // Big body
    ctx.fillStyle = baseColor;
    ctx.beginPath(); ctx.ellipse(0, 5 + bob, 24, 30, 0, 0, Math.PI * 2); ctx.fill();
    // Body highlight
    ctx.fillStyle = lightColor;
    ctx.beginPath(); ctx.ellipse(-5, 0 + bob, 12, 16, -0.2, 0, Math.PI * 2); ctx.fill();
    // Dark belly
    ctx.fillStyle = darkColor;
    ctx.beginPath(); ctx.ellipse(0, 14 + bob, 18, 16, 0, 0, Math.PI); ctx.fill();
    // Belly spots
    ctx.fillStyle = lightColor;
    ctx.beginPath(); ctx.arc(-6, 10 + bob, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(4, 14 + bob, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(8, 6 + bob, 2, 0, Math.PI * 2); ctx.fill();

    // Head dome
    ctx.fillStyle = baseColor;
    ctx.beginPath(); ctx.arc(0, -22 + bob, 18, 0, Math.PI * 2); ctx.fill();
    // Head highlight
    ctx.fillStyle = lightColor;
    ctx.beginPath(); ctx.arc(-5, -26 + bob, 8, 0, Math.PI * 2); ctx.fill();

    // Big eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(-8, -24 + bob, 7, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(8, -24 + bob, 7, 9, 0, 0, Math.PI * 2); ctx.fill();
    // Iris
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(-7, -23 + bob, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(9, -23 + bob, 4, 0, Math.PI * 2); ctx.fill();
    // Pupil glow
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath(); ctx.arc(-7, -23 + bob, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(9, -23 + bob, 2, 0, Math.PI * 2); ctx.fill();
    // Eye shine
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-10, -26 + bob, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -26 + bob, 2, 0, Math.PI * 2); ctx.fill();

    // Antenna — bouncy
    const antBob = Math.sin(frameTime * 0.008 + e.x) * 3;
    ctx.strokeStyle = baseColor; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(0, -40 + bob); ctx.quadraticCurveTo(antBob, -44 + bob, antBob * 0.5, -48 + bob); ctx.stroke();
    ctx.fillStyle = '#f1c40f';
    ctx.shadowColor = '#f1c40f'; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(antBob * 0.5, -48 + bob, 5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // Blaster arm — more detailed
    ctx.fillStyle = '#555';
    ctx.beginPath(); ctx.roundRect(18, -6 + bob, 16, 10, 3); ctx.fill();
    ctx.fillStyle = '#444';
    ctx.fillRect(20, -4 + bob, 12, 6);
    // Barrel
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath(); ctx.roundRect(32, -4 + bob, 8, 6, [0,2,2,0]); ctx.fill();
    // Barrel glow
    if (e.shootTimer > e.shootCooldown - 30) {
        ctx.fillStyle = 'rgba(231,76,60,0.5)';
        ctx.beginPath(); ctx.arc(40, -1 + bob, 4, 0, Math.PI * 2); ctx.fill();
    }

    // Legs — stumpy
    ctx.fillStyle = darkColor;
    ctx.beginPath(); ctx.roundRect(-15, 28 + bob, 12, 12, [0,0,3,3]); ctx.fill();
    ctx.beginPath(); ctx.roundRect(3, 28 + bob, 12, 12, [0,0,3,3]); ctx.fill();
    // Feet
    ctx.fillStyle = baseColor;
    ctx.beginPath(); ctx.ellipse(-9, 40 + bob, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(9, 40 + bob, 8, 3, 0, 0, Math.PI * 2); ctx.fill();

    // Outline
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, 5 + bob, 24, 30, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
}

// --- STAGE 3: Small Big-Nosed Alien ---
function drawSmallAlien(e, sx) {
    ctx.save();
    ctx.translate(sx + e.width / 2, e.y + e.height / 2);
    if (e.facing === -1) ctx.scale(-1, 1);
    const isHit = e.hitFlash > 0;
    const bob = Math.sin(frameTime * 0.007 + e.x * 0.5) * 1.5;

    // Semi-transparent when hidden
    if (e.hidden && e.revealTimer <= 0) ctx.globalAlpha = 0.3;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath(); ctx.ellipse(0, 22, 10, 3, 0, 0, Math.PI * 2); ctx.fill();

    // Body — round and sneaky
    ctx.fillStyle = isHit ? '#ff4444' : '#95a5a6';
    ctx.beginPath(); ctx.ellipse(0, 4 + bob, 14, 16, 0, 0, Math.PI * 2); ctx.fill();
    // Body highlight
    ctx.fillStyle = isHit ? '#ff6666' : '#aab7b8';
    ctx.beginPath(); ctx.ellipse(-3, 1 + bob, 7, 8, -0.2, 0, Math.PI * 2); ctx.fill();
    // Dark underside
    ctx.fillStyle = isHit ? '#cc3333' : '#7f8c8d';
    ctx.beginPath(); ctx.ellipse(0, 12 + bob, 12, 8, 0, 0, Math.PI); ctx.fill();

    // Head — round and smooth
    ctx.fillStyle = isHit ? '#ff6666' : '#bdc3c7';
    ctx.beginPath(); ctx.arc(0, -10 + bob, 12, 0, Math.PI * 2); ctx.fill();
    // Head highlight
    ctx.fillStyle = isHit ? '#ff8888' : '#d5dbdb';
    ctx.beginPath(); ctx.arc(-3, -14 + bob, 5, 0, Math.PI * 2); ctx.fill();

    // BIG nose — the defining feature
    ctx.fillStyle = isHit ? '#ff8888' : '#e74c3c';
    ctx.beginPath(); ctx.ellipse(10, -8 + bob, 9, 6, 0.3, 0, Math.PI * 2); ctx.fill();
    // Nose highlight
    ctx.fillStyle = isHit ? '#ffaaaa' : '#ec7063';
    ctx.beginPath(); ctx.arc(8, -10 + bob, 3, 0, Math.PI * 2); ctx.fill();
    // Nostril
    ctx.fillStyle = '#8B0000';
    ctx.beginPath(); ctx.ellipse(12, -7 + bob, 2, 1.5, 0.3, 0, Math.PI * 2); ctx.fill();

    // Eyes — beady and shifty
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(-4, -12 + bob, 4, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(4, -12 + bob, 4, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    // Pupils — look around sneakily
    const lookX = Math.sin(frameTime * 0.003) * 1;
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(-4 + lookX, -12 + bob, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(4 + lookX, -12 + bob, 2, 0, Math.PI * 2); ctx.fill();
    // Eye shine
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-5, -13 + bob, 1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(3, -13 + bob, 1, 0, Math.PI * 2); ctx.fill();
    // Devious eyebrows
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-7, -17 + bob); ctx.lineTo(-1, -16 + bob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1, -16 + bob); ctx.lineTo(7, -17 + bob); ctx.stroke();

    // Sneaky grin with teeth
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath();
    ctx.moveTo(-5, -4 + bob); ctx.quadraticCurveTo(0, 1 + bob, 5, -4 + bob);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(-3, -4 + bob, 2, 2); ctx.fillRect(1, -4 + bob, 2, 2);

    // Tiny legs with shoes
    ctx.fillStyle = isHit ? '#cc3333' : '#7f8c8d';
    ctx.fillRect(-8, 17 + bob, 6, 6);
    ctx.fillRect(2, 17 + bob, 6, 6);
    ctx.fillStyle = isHit ? '#aa2222' : '#566573';
    ctx.fillRect(-9, 22 + bob, 8, 3);
    ctx.fillRect(1, 22 + bob, 8, 3);

    // Hidden laser glow when charging
    if (e.shootTimer > e.shootCooldown - 25) {
        const chargeAlpha = (e.shootTimer - (e.shootCooldown - 25)) / 25;
        ctx.fillStyle = `rgba(231, 76, 60, ${chargeAlpha * 0.8})`;
        ctx.shadowColor = '#e74c3c'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(16, -6 + bob, 3 + chargeAlpha * 2, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
    }

    // Outline
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, 4 + bob, 14, 16, 0, 0, Math.PI * 2); ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.restore();
}

// --- STAGE 4: Red Laser Line ---
function drawLaserLine(e, sx) {
    ctx.save();
    ctx.translate(sx + e.width / 2, e.y + e.height / 2);
    const isHit = e.hitFlash > 0;
    const pulse = 0.7 + Math.sin(frameTime * 0.01) * 0.3;
    const flicker = Math.sin(frameTime * 0.05) * 0.1;

    // Outer glow halo
    ctx.fillStyle = `rgba(231, 76, 60, ${0.1 + flicker})`;
    ctx.beginPath(); ctx.ellipse(0, 0, 40, 14, 0, 0, Math.PI * 2); ctx.fill();

    ctx.globalAlpha = pulse;

    // Main laser body — energy beam
    const grad = ctx.createLinearGradient(-30, 0, 30, 0);
    grad.addColorStop(0, isHit ? '#ff6666' : '#c0392b');
    grad.addColorStop(0.5, isHit ? '#ff8888' : '#e74c3c');
    grad.addColorStop(1, isHit ? '#ff6666' : '#c0392b');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.roundRect(-30, -5, 60, 10, 5); ctx.fill();

    // Inner core — bright white/yellow
    ctx.fillStyle = isHit ? '#ffcccc' : '#f5b041';
    ctx.beginPath(); ctx.roundRect(-26, -2, 52, 4, 2); ctx.fill();

    // Glow
    ctx.shadowColor = '#e74c3c';
    ctx.shadowBlur = 20;
    ctx.fillStyle = 'rgba(231,76,60,0.3)';
    ctx.fillRect(-28, -3, 56, 6);
    ctx.shadowBlur = 0;

    // Energy nodes — pulsing orbs
    const nodePhase = frameTime * 0.005;
    for (let n = -1; n <= 1; n++) {
        const nx = n * 20;
        const nSize = 4 + Math.sin(nodePhase + n * 2) * 1.5;
        ctx.fillStyle = isHit ? '#ffaaaa' : '#f39c12';
        ctx.shadowColor = '#f39c12'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(nx, 0, nSize, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        // Node inner
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(nx, 0, nSize * 0.4, 0, Math.PI * 2); ctx.fill();
    }

    // Blaster housings — more mechanical
    for (const side of [-1, 1]) {
        const bx = side * 30;
        ctx.fillStyle = '#555';
        ctx.beginPath(); ctx.roundRect(bx - 5, -8, 10, 16, 2); ctx.fill();
        ctx.fillStyle = '#444';
        ctx.fillRect(bx - 3, -6, 6, 12);
        // Barrel tip
        ctx.fillStyle = isHit ? '#ff6666' : '#c0392b';
        ctx.beginPath(); ctx.arc(bx, 0, 3, 0, Math.PI * 2); ctx.fill();
        // Rivets
        ctx.fillStyle = '#777';
        ctx.beginPath(); ctx.arc(bx - 2, -5, 1, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(bx + 2, 5, 1, 0, Math.PI * 2); ctx.fill();
    }

    // Acid drip — glowing green
    if (e.acidTimer > 0) {
        const dripPhase = e.acidTimer % 40;
        ctx.fillStyle = 'rgba(46, 204, 113, 0.9)';
        ctx.shadowColor = '#2ecc71'; ctx.shadowBlur = 6;
        const dripY = dripPhase * 1.5;
        ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(-3, 4 + dripY); ctx.lineTo(0, 8 + dripY); ctx.lineTo(3, 4 + dripY); ctx.closePath(); ctx.fill();
        // Secondary drip
        ctx.beginPath(); ctx.moveTo(-15, 4); ctx.lineTo(-17, 4 + dripY * 0.6); ctx.lineTo(-15, 6 + dripY * 0.6); ctx.lineTo(-13, 4 + dripY * 0.6); ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0;
    }

    // Crackling electricity along the beam
    ctx.strokeStyle = `rgba(255,255,200,${0.3 + flicker})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-25, 0);
    for (let ex = -20; ex <= 20; ex += 5) {
        ctx.lineTo(ex, Math.sin(frameTime * 0.05 + ex * 0.7) * 3);
    }
    ctx.lineTo(25, 0);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.restore();
}

// --- Draw enemy laser projectiles ---
function drawEnemyLasers() {
    for (const l of enemyLasers) {
        const sx = l.x - cameraX;
        if (sx < -20 || sx > SCREEN_W + 20) continue;

        if (l.isPoo) {
            // Draw poo dropping
            ctx.save();
            ctx.translate(sx, l.y);
            const rot = Math.sin(frameTime * 0.01 + l.x) * 0.2;
            ctx.rotate(rot);
            // Poo swirl - three stacked blobs
            ctx.fillStyle = '#6B3410';
            ctx.beginPath(); ctx.ellipse(0, 2, 5, 3, 0, 0, Math.PI * 2); ctx.fill(); // base
            ctx.fillStyle = '#8B4513';
            ctx.beginPath(); ctx.ellipse(0, -2, 4, 3, 0, 0, Math.PI * 2); ctx.fill(); // middle
            ctx.fillStyle = '#A0522D';
            ctx.beginPath(); ctx.ellipse(0, -5, 2.5, 2, 0, 0, Math.PI * 2); ctx.fill(); // top
            // Stink lines
            ctx.strokeStyle = 'rgba(120,180,60,0.5)';
            ctx.lineWidth = 1;
            const stinkT = frameTime * 0.008;
            ctx.beginPath(); ctx.moveTo(-4, -7); ctx.quadraticCurveTo(-6, -12 + Math.sin(stinkT) * 2, -3, -14); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(2, -7); ctx.quadraticCurveTo(4, -13 + Math.sin(stinkT + 1) * 2, 5, -15); ctx.stroke();
            ctx.restore();
        } else {
            const col = l.color || '#e74c3c';
            // Outer glow
            ctx.fillStyle = col;
            ctx.shadowColor = col;
            ctx.shadowBlur = 12;
            // Elongated bolt shape based on direction
            ctx.save();
            ctx.translate(sx, l.y);
            if (l.vy) ctx.rotate(Math.atan2(l.vy, l.vx || 1));
            ctx.fillRect(-10, -2.5, 20, 5);
            // Bright core
            ctx.fillStyle = '#fff';
            ctx.fillRect(-6, -1, 12, 2);
            ctx.restore();
            ctx.shadowBlur = 0;
        }
    }
}

// --- Draw Stickers ---
function drawStickers() {
    const time = frameTime * 0.003;
    for (const s of stickers) {
        if (s.collected) continue;
        const sx = s.x - cameraX;
        if (sx < -30 || sx > SCREEN_W + 30) continue;
        const bob = Math.sin(time + s.bobOffset) * 4;
        const tilt = Math.sin(time * 0.5 + s.bobOffset) * 0.1;

        ctx.save();
        ctx.translate(sx + s.width / 2, s.y + bob);
        ctx.rotate(tilt);

        // Glow behind card
        ctx.fillStyle = 'rgba(241, 196, 15, 0.2)';
        ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();

        // Card background — holographic
        const hue = (frameTime * 0.1 + s.x) % 360;
        ctx.fillStyle = '#f1c40f';
        ctx.shadowColor = `hsl(${hue}, 80%, 60%)`;
        ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.roundRect(-11, -11, 22, 22, 3); ctx.fill();
        ctx.shadowBlur = 0;
        // Holographic shimmer
        ctx.fillStyle = `hsla(${hue}, 80%, 80%, 0.3)`;
        ctx.fillRect(-8, -11, 6, 22);
        // Border
        ctx.strokeStyle = '#e67e22';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(-11, -11, 22, 22, 3); ctx.stroke();

        // Football icon — better
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
        // Pentagon pattern
        for (let pp = 0; pp < 5; pp++) {
            const pa = (pp / 5) * Math.PI * 2 - Math.PI / 2;
            ctx.beginPath(); ctx.arc(Math.cos(pa) * 3.5, Math.sin(pa) * 3.5, 1.5, 0, Math.PI * 2); ctx.fill();
        }

        // Sparkle star
        const sparkle = 0.5 + Math.sin(time * 3 + s.bobOffset) * 0.5;
        ctx.fillStyle = `rgba(255,255,255,${sparkle})`;
        drawStar(-6, -7, 3, 4);
        drawStar(7, -6, 2, 3);

        ctx.restore();
    }
}

function drawStar(x, y, inner, outer) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? outer : inner;
        if (i === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
}

// --- Draw Weapon Pickups ---
function drawWeaponPickups() {
    const time = frameTime * 0.003;
    for (const w of weaponPickups) {
        if (w.collected) continue;
        const sx = w.x - cameraX;
        if (sx < -30 || sx > SCREEN_W + 30) continue;
        const bob = Math.sin(time + w.bobOffset) * 5;

        ctx.save();
        ctx.translate(sx + w.width / 2, w.y + bob);

        // Glowing orb
        ctx.shadowColor = '#e74c3c';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        // Inner glow
        ctx.fillStyle = '#f39c12';
        ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();

        // Icon based on type
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Segoe UI';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const ballEmoji = CHAR_INFO[selectedCharacter].ballIcon;
        ctx.fillText(ballEmoji + '×3', 0, 0);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';

        ctx.restore();
    }
}

// --- Draw Health Hearts ---
function drawHearts() {
    const time = frameTime * 0.003;
    for (const h of hearts) {
        if (h.collected) continue;
        const sx = h.x - cameraX;
        if (sx < -30 || sx > SCREEN_W + 30) continue;
        const bob = Math.sin(time + h.bobOffset) * 4;
        const pulse = 1 + Math.sin(time * 2 + h.bobOffset) * 0.1;

        ctx.save();
        ctx.translate(sx + h.width / 2, h.y + bob);
        ctx.scale(pulse, pulse);

        // Glow
        ctx.fillStyle = 'rgba(231, 76, 60, 0.25)';
        ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();

        // Heart shape
        ctx.fillStyle = '#e74c3c';
        ctx.shadowColor = '#e74c3c';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(0, 4);
        ctx.bezierCurveTo(-8, -2, -8, -8, -4, -8);
        ctx.bezierCurveTo(-2, -8, 0, -6, 0, -4);
        ctx.bezierCurveTo(0, -6, 2, -8, 4, -8);
        ctx.bezierCurveTo(8, -8, 8, -2, 0, 4);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.arc(-3, -5, 2.5, 0, Math.PI * 2); ctx.fill();

        // + symbol
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px Segoe UI';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+', 0, -1);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';

        ctx.restore();
    }
}

// --- Draw Companion Pickups ---
function drawCompanionPickups() {
    const time = frameTime * 0.003;
    for (const c of companionPickups) {
        if (c.collected) continue;
        const sx = c.x - cameraX;
        if (sx < -30 || sx > SCREEN_W + 30) continue;
        const bob = Math.sin(time + c.bobOffset) * 4;

        ctx.save();
        ctx.translate(sx + c.width / 2, c.y + bob);

        if (c.companion === 'jules') {
            // Jules — small black pug dog
            // Body
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath(); ctx.ellipse(0, 2, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
            // Head
            ctx.beginPath(); ctx.arc(0, -6, 7, 0, Math.PI * 2); ctx.fill();
            // Snout
            ctx.fillStyle = '#8B7355';
            ctx.beginPath(); ctx.ellipse(0, -3, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
            // Eyes
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(-3, -7, 2, 0, Math.PI * 2); ctx.arc(3, -7, 2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#111';
            ctx.beginPath(); ctx.arc(-3, -7, 1, 0, Math.PI * 2); ctx.arc(3, -7, 1, 0, Math.PI * 2); ctx.fill();
            // Nose
            ctx.fillStyle = '#333';
            ctx.beginPath(); ctx.arc(0, -4, 1.5, 0, Math.PI * 2); ctx.fill();
            // Pulsing glow
            ctx.strokeStyle = 'rgba(241,196,15,0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, 14 + Math.sin(time * 2) * 2, 0, Math.PI * 2); ctx.stroke();
        } else {
            // The Fishies — orange goldfish
            ctx.fillStyle = '#e67e22';
            ctx.beginPath(); ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
            // Tail
            ctx.beginPath();
            ctx.moveTo(-8, 0); ctx.lineTo(-14, -5); ctx.lineTo(-14, 5); ctx.closePath();
            ctx.fill();
            // Fin on top
            ctx.beginPath();
            ctx.moveTo(-2, -6); ctx.lineTo(2, -10); ctx.lineTo(5, -6); ctx.closePath();
            ctx.fill();
            // Eye
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(4, -1, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#111';
            ctx.beginPath(); ctx.arc(4.5, -1, 1, 0, Math.PI * 2); ctx.fill();
            // Mouth
            ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(8, 1, 2, -0.5, 0.5); ctx.stroke();
            // Pulsing glow
            ctx.strokeStyle = 'rgba(52,152,219,0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, 14 + Math.sin(time * 2) * 2, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
    }
}

// --- Draw Active Companion ---
function drawActiveCompanion() {
    if (!activeCompanion) return;
    const sx = player.x - cameraX;
    const time = frameTime * 0.005;

    ctx.save();
    // Companion floats above and behind the player
    const cx = sx + player.width / 2 - player.facing * 25;
    const cy = player.y - 15 + Math.sin(time) * 5;
    ctx.translate(cx, cy);

    if (activeCompanion.type === 'jules') {
        // Jules following the player
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath(); ctx.ellipse(0, 2, 8, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -4, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#8B7355';
        ctx.beginPath(); ctx.ellipse(0, -2, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-2, -5, 1.5, 0, Math.PI * 2); ctx.arc(2, -5, 1.5, 0, Math.PI * 2); ctx.fill();

        // Show ability ready indicator
        if (companionCooldown <= 0) {
            ctx.fillStyle = 'rgba(241,196,15,0.6)';
            ctx.font = '9px Segoe UI';
            ctx.textAlign = 'center';
            ctx.fillText('Q/E', 0, -14);
            ctx.textAlign = 'left';
        }
    } else {
        // Fishies following the player
        ctx.fillStyle = '#e67e22';
        ctx.beginPath(); ctx.ellipse(0, 0, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-10, -3); ctx.lineTo(-10, 3); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(3, -1, 1.5, 0, Math.PI * 2); ctx.fill();

        if (companionCooldown <= 0) {
            ctx.fillStyle = 'rgba(52,152,219,0.6)';
            ctx.font = '9px Segoe UI';
            ctx.textAlign = 'center';
            ctx.fillText('Q/E', 0, -10);
            ctx.textAlign = 'left';
        }
    }

    ctx.restore();
}

function drawHUDHearts() {
    for (let i = 0; i < player.maxHealth; i++) {
        const hx = 15 + i * 32;
        const hy = 15;
        if (i < player.health) {
            // Full heart
            ctx.fillStyle = '#e74c3c';
        } else {
            // Empty heart
            ctx.fillStyle = '#555';
        }
        drawHeart(hx, hy, 12);
    }
}

function drawHeart(x, y, size) {
    ctx.beginPath();
    ctx.moveTo(x, y + size / 4);
    ctx.bezierCurveTo(x, y, x - size / 2, y, x - size / 2, y + size / 4);
    ctx.bezierCurveTo(x - size / 2, y + size / 2, x, y + size * 0.75, x, y + size);
    ctx.bezierCurveTo(x, y + size * 0.75, x + size / 2, y + size / 2, x + size / 2, y + size / 4);
    ctx.bezierCurveTo(x + size / 2, y, x, y, x, y + size / 4);
    ctx.fill();
}

function drawWinFlag() {
    const sx = winFlag.x - cameraX;
    if (sx > SCREEN_W + 20 || sx < -60) return;

    // Pole
    ctx.fillStyle = '#bdc3c7';
    ctx.fillRect(sx + 18, winFlag.y, 4, winFlag.height);

    // Flag
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.moveTo(sx + 22, winFlag.y);
    ctx.lineTo(sx + 55, winFlag.y + 12);
    ctx.lineTo(sx + 22, winFlag.y + 24);
    ctx.closePath();
    ctx.fill();

    // Star on flag
    ctx.fillStyle = '#f1c40f';
    ctx.font = '14px Arial';
    ctx.fillText('★', sx + 28, winFlag.y + 18);
}

function drawSpecialCooldownHUD(p, charType, hudX, hudY) {
    const spec = CHAR_INFO[charType].special;
    const isReady = p.specialCooldown <= 0 && p.specialActive <= 0;
    const isActive = p.specialActive > 0;
    const cdPct = isActive ? 1 : (p.specialCooldown / spec.cooldown);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.roundRect(hudX, hudY, 98, 22, 4); ctx.fill();
    ctx.font = '11px Segoe UI, sans-serif';
    if (isActive) {
        const pulse = 0.7 + Math.sin(frameTime * 0.01) * 0.3;
        ctx.fillStyle = `rgba(241,196,15,${pulse})`;
        ctx.fillText(spec.icon + ' ACTIVE!', hudX + 5, hudY + 15);
    } else if (isReady) {
        ctx.fillStyle = '#2ecc71';
        ctx.fillText(spec.icon + ' [G] READY', hudX + 5, hudY + 15);
    } else {
        const cdSec = Math.ceil(p.specialCooldown / 60);
        ctx.fillStyle = '#888';
        ctx.fillText(spec.icon + ' ' + spec.name + ' ' + cdSec + 's', hudX + 5, hudY + 15);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(hudX + 3, hudY + 18, 92, 3);
        ctx.fillStyle = CHAR_INFO[charType].color;
        ctx.fillRect(hudX + 3, hudY + 18, 92 * (1 - cdPct), 3);
    }
}

function drawHUD() {
    // Top-left panel: hearts
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.roundRect(8, 6, player.maxHealth * 32 + 8, 30, 6);
    ctx.fill();
    drawHUDHearts();

    // Top-right panel: collectibles + kill gate
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.roundRect(SCREEN_W - 105, 6, 98, 70, 6);
    ctx.fill();

    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 14px Segoe UI, sans-serif';
    const totalStickers = stickers.length;
    ctx.fillText('⚽ ' + stickersCollected + '/' + totalStickers, SCREEN_W - 95, 26);
    ctx.fillStyle = player.rangedAmmo > 0 ? '#3498db' : '#555';
    const ballIcon = CHAR_INFO[selectedCharacter].ballIcon;
    ctx.fillText(ballIcon + ' ×' + player.rangedAmmo, SCREEN_W - 95, 48);

    // Kill gate progress
    const stageIdx = currentStage - 1;
    const killReq = Math.ceil(stageEnemyCounts[stageIdx] * KILL_GATE_PCT);
    const kills = stageKillCounts[stageIdx];
    const gateOpen = kills >= killReq;
    ctx.fillStyle = gateOpen ? '#2ecc71' : '#e74c3c';
    ctx.font = 'bold 12px Segoe UI, sans-serif';
    ctx.fillText('💀 ' + kills + '/' + killReq + (gateOpen ? ' ✓' : ''), SCREEN_W - 95, 68);

    // Special ability cooldown indicator
    drawSpecialCooldownHUD(player, selectedCharacter, SCREEN_W - 105, 76);

    // Active companion indicator — show what Q and E do
    if (activeCompanion) {
        const isJules = activeCompanion.type === 'jules';
        const compColor = isJules ? '#f1c40f' : '#3498db';
        const compName = isJules ? 'Jules' : 'Fishies';
        const qAbility = isJules ? 'Claw' : 'Wave';
        const eAbility = isJules ? 'Bark' : 'Heal';
        const timerSec = Math.ceil(activeCompanion.timer / 60);
        const cdSec = companionCooldown > 0 ? Math.ceil(companionCooldown / 60) : 0;

        // Background panel
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.roundRect(SCREEN_W - 230, 58, 224, 38, 6);
        ctx.fill();

        // Companion name + timer
        ctx.fillStyle = compColor;
        ctx.font = 'bold 12px Segoe UI, sans-serif';
        ctx.fillText(compName + ' (' + timerSec + 's)', SCREEN_W - 224, 73);

        // Ability buttons
        const qReady = companionCooldown <= 0;
        ctx.fillStyle = qReady ? '#2ecc71' : '#666';
        ctx.font = '11px Segoe UI, sans-serif';
        ctx.fillText('[Q] ' + qAbility, SCREEN_W - 148, 73);
        ctx.fillStyle = qReady ? '#2ecc71' : '#666';
        ctx.fillText('[E] ' + eAbility, SCREEN_W - 88, 73);

        // Cooldown bar
        if (cdSec > 0) {
            ctx.fillStyle = '#e74c3c';
            ctx.font = '10px Segoe UI, sans-serif';
            ctx.fillText('CD: ' + cdSec + 's', SCREEN_W - 224, 90);
            // Visual cooldown bar
            ctx.fillStyle = 'rgba(231,76,60,0.3)';
            ctx.fillRect(SCREEN_W - 185, 82, 170, 8);
            ctx.fillStyle = '#e74c3c';
            const cdPct = companionCooldown / 180; // max cooldown is 180 (munch)
            ctx.fillRect(SCREEN_W - 185, 82, 170 * cdPct, 8);
        } else {
            ctx.fillStyle = '#2ecc71';
            ctx.font = '10px Segoe UI, sans-serif';
            ctx.fillText('READY!', SCREEN_W - 224, 90);
        }
    }

    // Stage banner (top centre)
    const lvl = getCurrentLevel();
    const stageName = 'Stage ' + currentStage + ' — ' + (lvl.stages[currentStage - 1] || '');
    const stageColors = ['', '#2ecc71', '#3498db', '#e67e22', '#e74c3c'];
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.roundRect(SCREEN_W / 2 - 120, 4, 240, 26, 6);
    ctx.fill();
    ctx.fillStyle = stageColors[currentStage] || '#fff';
    ctx.font = 'bold 15px Segoe UI, sans-serif';
    ctx.fillText(stageName, SCREEN_W / 2, 22);
    // Stage progress dots
    for (let s = 1; s <= 4; s++) {
        const dx = SCREEN_W / 2 - 25 + s * 12;
        ctx.fillStyle = s <= currentStage ? stageColors[s] : '#555';
        ctx.beginPath();
        ctx.arc(dx, 35, 3, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.textAlign = 'left';

    // Controls hint (bottom)
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.roundRect(SCREEN_W / 2 - 240, SCREEN_H - 22, 480, 18, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '11px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    const attackName = CHAR_INFO[selectedCharacter].attackName;
    const specName = CHAR_INFO[selectedCharacter].special.name;
    const compHint = activeCompanion ? '   Q/E Companion' : '';
    if (touchControlsActive) {
        // Don't show keyboard hints on mobile — touch buttons are on screen
    } else if (gamepadConnected) {
        ctx.fillText('Stick Move   △ Jump   ✕ ' + attackName + '   ○ Throw   □ Block   R2 ' + specName + (activeCompanion ? '   L1/R1 Companion' : ''), SCREEN_W / 2, SCREEN_H - 9);
    } else {
        ctx.fillText('← → Move   ↑/W Jump (×2)   SPACE ' + attackName + '   CTRL Throw   SHIFT Block   G ' + specName + compHint, SCREEN_W / 2, SCREEN_H - 9);
    }
    ctx.textAlign = 'left';

    // Sound/Music indicator (bottom-right, above controls hint) — hide on mobile (has touch buttons)
    if (!touchControlsActive) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.roundRect(SCREEN_W - 75, SCREEN_H - 50, 68, 26, 4);
        ctx.fill();
        ctx.font = '9px Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = soundEnabled ? 'rgba(255,255,255,0.6)' : 'rgba(255,100,100,0.6)';
        ctx.fillText('M SFX ' + (soundEnabled ? 'ON' : 'OFF'), SCREEN_W - 41, SCREEN_H - 40);
        ctx.fillStyle = musicEnabled ? 'rgba(255,255,255,0.6)' : 'rgba(255,100,100,0.6)';
        ctx.fillText('N Music ' + (musicEnabled ? 'ON' : 'OFF'), SCREEN_W - 41, SCREEN_H - 29);
        ctx.textAlign = 'left';
    }

    // Gamepad debug overlay (toggle: Share + L1)
    if (gpDebugEnabled && gpDebugInfo) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, SCREEN_H - 50, SCREEN_W, 22);
        ctx.fillStyle = '#0f0';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GAMEPAD: ' + gpDebugInfo, SCREEN_W / 2, SCREEN_H - 35);
        ctx.textAlign = 'left';
    }
}

// ============================================================
// TITLE SCREEN
// ============================================================
// Load title image
const titleImage = new Image();
titleImage.src = 'title.png';
let titleImageLoaded = false;
titleImage.onload = () => { titleImageLoaded = true; };

// Character sprite images (96x128 pixel art)
const charImages = {};
let charImagesLoaded = 0;
for (const c of CHARACTERS) {
    charImages[c] = new Image();
    charImages[c].src = c + '.png';
    charImages[c].onload = () => { charImagesLoaded++; };
}

function drawTitleScreen() {
    titleTimer++;

    // Draw title image as background (covers full canvas, maintaining aspect ratio)
    if (titleImageLoaded) {
        const imgAspect = titleImage.width / titleImage.height;
        const canAspect = SCREEN_W / SCREEN_H;
        let drawW, drawH, drawX, drawY;
        if (canAspect > imgAspect) {
            drawW = SCREEN_W;
            drawH = SCREEN_W / imgAspect;
            drawX = 0;
            drawY = (SCREEN_H - drawH) / 2;
        } else {
            drawH = SCREEN_H;
            drawW = SCREEN_H * imgAspect;
            drawX = (SCREEN_W - drawW) / 2;
            drawY = 0;
        }
        ctx.drawImage(titleImage, drawX, drawY, drawW, drawH);

        // Dark overlay at bottom for UI readability
        ctx.fillStyle = GRAD_TITLE_UI;
        ctx.fillRect(0, SCREEN_H * 0.55, SCREEN_W, SCREEN_H * 0.45);
    } else {
        // Fallback while image loads
        ctx.fillStyle = GRAD_TITLE_FALLBACK;
        ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 56px Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('FARNHAM FIGHTERS', SCREEN_W / 2, SCREEN_H / 2 - 40);
    }

    ctx.textAlign = 'center';

    // Mode selection buttons (positioned in lower portion)
    const modes = ['Adventure', 'VS Mode (Split-Screen)', '👨 Daddy Selection: ' + DADDY_MODES[daddyModeIndex]];
    for (let i = 0; i < modes.length; i++) {
        const my = SCREEN_H - 155 + i * 34;
        const selected = titleCursor === i;
        // Button background
        ctx.fillStyle = selected ? 'rgba(233, 69, 96, 0.85)' : 'rgba(0,0,0,0.5)';
        ctx.beginPath(); ctx.roundRect(SCREEN_W / 2 - 140, my - 15, 280, 32, 8); ctx.fill();
        // Button border
        if (selected) {
            ctx.strokeStyle = '#f1c40f';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.roundRect(SCREEN_W / 2 - 140, my - 15, 280, 32, 8); ctx.stroke();
        }
        // Text
        ctx.fillStyle = selected ? '#fff' : (i === 2 ? '#aaa' : '#ccc');
        ctx.font = selected ? 'bold 18px Segoe UI, sans-serif' : '16px Segoe UI, sans-serif';
        ctx.fillText(modes[i], SCREEN_W / 2, my + 5);
        // Daddy Mode arrows
        if (i === 2 && selected) {
            ctx.fillStyle = '#f1c40f';
            ctx.font = 'bold 18px Segoe UI, sans-serif';
            ctx.fillText('◀', SCREEN_W / 2 - 130, my + 5);
            ctx.fillText('▶', SCREEN_W / 2 + 130, my + 5);
        }
    }

    // Sound/music toggle hint — hide on mobile (has touch buttons)
    if (!touchControlsActive) {
        ctx.fillStyle = '#777';
        ctx.font = '11px Segoe UI, sans-serif';
        ctx.fillText('M = Sound ' + (soundEnabled ? 'ON' : 'OFF') + '    N = Music ' + (musicEnabled ? 'ON' : 'OFF'), SCREEN_W / 2, SCREEN_H - 42);
    }

    // Prompt
    const flashAlpha = 0.5 + Math.sin(titleTimer * 0.06) * 0.5;
    ctx.globalAlpha = flashAlpha;
    ctx.fillStyle = '#ccc';
    ctx.font = '14px Segoe UI, sans-serif';
    const menuHint = touchControlsActive ? 'Tap to select' : gamepadConnected ? '↑↓ select — ✕ to start' : '↑↓ select — ENTER to start';
    ctx.fillText(menuHint, SCREEN_W / 2, SCREEN_H - 27);
    ctx.globalAlpha = 1;

    ctx.textAlign = 'left';
}

// ============================================================
// STAGE COMPLETE SCREEN
// ============================================================
function drawStageComplete() {
    // Dark overlay
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    // Animate in
    const progress = Math.min(1, (STAGE_COMPLETE_DURATION - stageCompleteTimer) / 30);

    ctx.save();
    ctx.globalAlpha = progress;

    // Title
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 36px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Stage ' + (currentStage - 1) + ' Complete!', SCREEN_W / 2, 160);

    // Stats
    ctx.fillStyle = '#fff';
    ctx.font = '18px Segoe UI, sans-serif';
    ctx.fillText('Stickers: ' + stickersCollected, SCREEN_W / 2, 220);
    ctx.fillText('Enemies Defeated: ' + enemiesDefeated, SCREEN_W / 2, 250);

    // Prompt
    if (stageCompleteTimer <= 60) {
        const blink = Math.sin(frameTime * 0.005) > 0;
        if (blink) {
            ctx.fillStyle = '#2ecc71';
            ctx.font = 'bold 20px Segoe UI, sans-serif';
            ctx.fillText(touchControlsActive ? 'Tap for Upgrade Shop' : gamepadConnected ? 'Press ✕ for Upgrade Shop' : 'Press ENTER for Upgrade Shop', SCREEN_W / 2, 340);
        }
    }

    ctx.restore();
    ctx.textAlign = 'left';
}

// ============================================================
// UPGRADE SHOP
// ============================================================
function drawUpgradeShop() {
    // Background
    ctx.fillStyle = GRAD_SHOP;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    // Title
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 28px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Upgrade Shop', SCREEN_W / 2, 40);

    // Sticker balance
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px Segoe UI, sans-serif';
    ctx.fillText('Stickers: ' + stickersCollected, SCREEN_W / 2, 64);

    const items = getShopItems();
    const itemH = 72;
    const startY = 82;
    const leftX = 140; // left margin for content
    const rightX = SCREEN_W - 140; // right margin for costs

    for (let i = 0; i < items.length; i++) {
        const key = items[i];
        const def = upgradeDefinitions[key];
        const level = upgrades[key];
        const cost = getUpgradeCost(key);
        const isSelected = i === shopCursor;
        const isMaxed = level >= def.maxLevel;
        const canBuy = !isMaxed && stickersCollected >= cost;

        const y = startY + i * itemH;

        // Selection highlight
        if (isSelected) {
            ctx.fillStyle = 'rgba(241, 196, 15, 0.15)';
            ctx.beginPath();
            ctx.roundRect(leftX - 20, y, SCREEN_W - 2 * (leftX - 20), itemH - 6, 8);
            ctx.fill();
            ctx.strokeStyle = '#f1c40f';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Name
        ctx.fillStyle = isSelected ? '#f1c40f' : '#ccc';
        ctx.font = 'bold 15px Segoe UI, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(def.name, leftX, y + 20);

        // Level pips + description on second line
        const pipY = y + 32;
        for (let l = 0; l < def.maxLevel; l++) {
            ctx.beginPath();
            ctx.arc(leftX + l * 22, pipY + 6, 6, 0, Math.PI * 2);
            if (l < level) {
                ctx.fillStyle = '#2ecc71';
                ctx.fill();
            } else {
                ctx.strokeStyle = '#555';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }

        // Description of next level (after pips)
        const descX = leftX + def.maxLevel * 22 + 12;
        if (isMaxed) {
            ctx.fillStyle = '#2ecc71';
            ctx.font = '12px Segoe UI, sans-serif';
            ctx.fillText('MAX', descX, pipY + 10);
        } else {
            ctx.fillStyle = '#aaa';
            ctx.font = '12px Segoe UI, sans-serif';
            ctx.fillText('Next: ' + def.desc[level], descX, pipY + 10);
        }

        // Cost (right side, vertically centered)
        if (!isMaxed) {
            ctx.textAlign = 'right';
            ctx.fillStyle = canBuy ? '#f1c40f' : '#e74c3c';
            ctx.font = 'bold 15px Segoe UI, sans-serif';
            ctx.fillText(cost + ' stickers', rightX, y + 28);
        }
        ctx.textAlign = 'left';
    }

    // Controls hint
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '12px Segoe UI, sans-serif';
    if (touchControlsActive) {
        ctx.fillText('Tap item to buy — Tap here to continue ▶', SCREEN_W / 2, SCREEN_H - 12);
    } else if (gamepadConnected) {
        ctx.fillText('D-pad ↑↓ Select   ✕ Buy   L3 Continue to next stage', SCREEN_W / 2, SCREEN_H - 12);
    } else {
        ctx.fillText('↑↓ Select   ENTER Buy   C Continue to next stage', SCREEN_W / 2, SCREEN_H - 12);
    }

    ctx.textAlign = 'left';
}

// ============================================================
// PAUSE MENU
// ============================================================
function drawPauseScreen() {
    // Dim overlay
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    // Pause panel
    ctx.fillStyle = 'rgba(20,20,40,0.9)';
    ctx.beginPath(); ctx.roundRect(SCREEN_W / 2 - 150, SCREEN_H / 2 - 100, 300, 200, 12); ctx.fill();
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(SCREEN_W / 2 - 150, SCREEN_H / 2 - 100, 300, 200, 12); ctx.stroke();

    ctx.textAlign = 'center';
    // Pause bars icon
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(SCREEN_W / 2 - 15, SCREEN_H / 2 - 80, 10, 30);
    ctx.fillRect(SCREEN_W / 2 + 5, SCREEN_H / 2 - 80, 10, 30);

    ctx.font = 'bold 28px Segoe UI, sans-serif';
    ctx.fillText('PAUSED', SCREEN_W / 2, SCREEN_H / 2 - 30);

    ctx.fillStyle = '#aaa';
    ctx.font = '16px Segoe UI, sans-serif';
    if (touchControlsActive) {
        ctx.fillText('Tap ⏸ to resume', SCREEN_W / 2, SCREEN_H / 2 + 5);
    } else if (gamepadConnected) {
        ctx.fillText('OPTIONS to resume', SCREEN_W / 2, SCREEN_H / 2 + 5);
        ctx.fillText('SHARE to restart', SCREEN_W / 2, SCREEN_H / 2 + 30);
        ctx.fillText('○ exit to main menu', SCREEN_W / 2, SCREEN_H / 2 + 55);
    } else {
        ctx.fillText('ESC to resume', SCREEN_W / 2, SCREEN_H / 2 + 5);
        ctx.fillText('R to restart', SCREEN_W / 2, SCREEN_H / 2 + 30);
        ctx.fillText('Q to exit to main menu', SCREEN_W / 2, SCREEN_H / 2 + 55);
    }

    // Current stats
    ctx.fillStyle = '#888';
    ctx.font = '13px Segoe UI, sans-serif';
    const elapsed = Math.floor((frameTime - gameStartTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    ctx.fillText('Time: ' + mins + ':' + (secs < 10 ? '0' : '') + secs + '   Enemies: ' + enemiesDefeated + '   Stickers: ' + stickersCollected, SCREEN_W / 2, SCREEN_H / 2 + 80);
    ctx.textAlign = 'left';
}

// ============================================================
// STAGE INTRO
// ============================================================
function drawStageIntro() {
    // Draw the game behind
    drawBackground();
    drawPlatforms();

    // Overlay
    const progress = 1 - (stageIntroTimer / STAGE_INTRO_DURATION);
    const fadeIn = Math.min(1, progress * 3); // fade in quickly
    const fadeOut = stageIntroTimer < 30 ? stageIntroTimer / 30 : 1; // fade out at end
    const alpha = Math.min(fadeIn, fadeOut) * 0.8;

    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    const textAlpha = Math.min(fadeIn, fadeOut);
    ctx.globalAlpha = textAlpha;

    ctx.textAlign = 'center';

    // Stage info from level data
    const introLevel = getCurrentLevel();
    const introStageName = introLevel.stages[currentStage - 1] || '';
    const introStageDesc = introLevel.stageDescs[currentStage - 1] || '';
    const stageColors = ['', '#2ecc71', '#3498db', '#e67e22', '#e74c3c'];

    // Level name (small, above stage number)
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 16px Segoe UI, sans-serif';
    ctx.fillText(introLevel.name, SCREEN_W / 2, SCREEN_H / 2 - 70);

    // Big stage number
    ctx.fillStyle = stageColors[currentStage] || '#fff';
    ctx.font = 'bold 60px Segoe UI, sans-serif';
    const slideIn = Math.min(1, progress * 4);
    const textX = SCREEN_W / 2 + (1 - slideIn) * 200;
    ctx.fillText('STAGE ' + currentStage, textX, SCREEN_H / 2 - 30);

    // Stage name
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px Segoe UI, sans-serif';
    ctx.fillText(introStageName, SCREEN_W / 2, SCREEN_H / 2 + 15);

    // Description
    ctx.fillStyle = '#bbb';
    ctx.font = '16px Segoe UI, sans-serif';
    ctx.fillText(introStageDesc, SCREEN_W / 2, SCREEN_H / 2 + 50);

    // Stage dots
    for (let s = 1; s <= 4; s++) {
        const dx = SCREEN_W / 2 - 30 + s * 15;
        ctx.fillStyle = s <= currentStage ? stageColors[s] : '#555';
        ctx.beginPath(); ctx.arc(dx, SCREEN_H / 2 + 80, 5, 0, Math.PI * 2); ctx.fill();
    }

    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
}

// ============================================================
// WIN SCREEN — with stats
// ============================================================
function drawWinScreen() {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    ctx.textAlign = 'center';

    // Victory particles (golden)
    const t = frameTime * 0.002;
    ctx.fillStyle = 'rgba(241, 196, 15, 0.3)';
    for (let i = 0; i < 20; i++) {
        const px = (Math.sin(t + i * 1.3) * 0.5 + 0.5) * SCREEN_W;
        const py = (t * 30 + i * 50) % (SCREEN_H + 20) - 10;
        ctx.beginPath(); ctx.arc(px, py, 2 + (i % 3), 0, Math.PI * 2); ctx.fill();
    }

    // Trophy icon
    ctx.fillStyle = '#f1c40f';
    ctx.shadowColor = '#f1c40f'; ctx.shadowBlur = 15;
    ctx.font = '50px Segoe UI';
    ctx.fillText('🏆', SCREEN_W / 2, SCREEN_H / 2 - 80);
    ctx.shadowBlur = 0;

    // Title
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 40px Segoe UI, sans-serif';
    const winQuote = selectedCharacter === 'heath' ? "LET'S MOVE ON!" : 'NICE ONE.';
    ctx.fillText(winQuote, SCREEN_W / 2, SCREEN_H / 2 - 30);

    // Subtitle
    ctx.fillStyle = '#fff';
    ctx.font = '20px Segoe UI, sans-serif';
    const name = getCharName(selectedCharacter);
    const winLevel = getCurrentLevel();
    ctx.fillText(name + ' defeated ' + winLevel.bossName + '!', SCREEN_W / 2, SCREEN_H / 2 + 10);

    // Stats panel
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.roundRect(SCREEN_W / 2 - 160, SCREEN_H / 2 + 30, 320, 80, 8); ctx.fill();

    ctx.fillStyle = '#aaa';
    ctx.font = '14px Segoe UI, sans-serif';
    const elapsed = Math.floor((gameEndTime - gameStartTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const totalStickers = stickers.length;
    ctx.fillText('Time: ' + mins + ':' + (secs < 10 ? '0' : '') + secs, SCREEN_W / 2, SCREEN_H / 2 + 55);
    ctx.fillText('Enemies defeated: ' + enemiesDefeated, SCREEN_W / 2, SCREEN_H / 2 + 75);
    ctx.fillText('Stickers: ' + stickersCollected + '/' + totalStickers + '   Weapons: ' + weaponsCollected + '/4', SCREEN_W / 2, SCREEN_H / 2 + 95);

    // Next level / restart
    const flashAlpha = 0.5 + Math.sin(frameTime * 0.004) * 0.5;
    ctx.globalAlpha = flashAlpha;
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 18px Segoe UI, sans-serif';
    if (touchControlsActive) {
        ctx.fillText(currentLevel < TOTAL_LEVELS ? 'Tap to continue' : 'You beat them all! Tap to play again', SCREEN_W / 2, SCREEN_H / 2 + 130);
    } else if (currentLevel < TOTAL_LEVELS) {
        ctx.fillText(gamepadConnected ? '✕ next level — △ replay — ○ menu' : 'ENTER next level — R replay — ESC menu', SCREEN_W / 2, SCREEN_H / 2 + 130);
    } else {
        ctx.fillText(gamepadConnected ? 'You beat them all! ✕ play again — ○ menu' : 'You beat them all! ENTER play again — ESC menu', SCREEN_W / 2, SCREEN_H / 2 + 130);
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'left';
}

// ============================================================
// LOSE SCREEN — with stats
// ============================================================
function drawLoseScreen() {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    ctx.textAlign = 'center';

    // Red vignette
    ctx.fillStyle = GRAD_LOSE_VIGNETTE;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 44px Segoe UI, sans-serif';
    ctx.fillText('GAME OVER', SCREEN_W / 2, SCREEN_H / 2 - 40);

    // Encouragement
    ctx.fillStyle = '#bbb';
    ctx.font = '16px Segoe UI, sans-serif';
    ctx.fillText(lostMessage || 'Try again?', SCREEN_W / 2, SCREEN_H / 2);

    // Stats
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.roundRect(SCREEN_W / 2 - 140, SCREEN_H / 2 + 15, 280, 55, 8); ctx.fill();

    ctx.fillStyle = '#888';
    ctx.font = '13px Segoe UI, sans-serif';
    const loseLevel = getCurrentLevel();
    const reachedStage = gameState === 'lost' && boss.charmBroken ? loseLevel.bossName : (loseLevel.stages[currentStage - 1] || 'Stage ' + currentStage);
    ctx.fillText('Reached: ' + reachedStage + '   Enemies: ' + enemiesDefeated, SCREEN_W / 2, SCREEN_H / 2 + 38);
    ctx.fillText('Stickers: ' + stickersCollected + '   Weapons: ' + weaponsCollected, SCREEN_W / 2, SCREEN_H / 2 + 56);

    // Restart
    const flashAlpha = 0.5 + Math.sin(frameTime * 0.004) * 0.5;
    ctx.globalAlpha = flashAlpha;
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 18px Segoe UI, sans-serif';
    ctx.fillText(gamepadConnected ? '✕ try again — ○ menu' : 'R try again — ESC menu', SCREEN_W / 2, SCREEN_H / 2 + 95);
    ctx.globalAlpha = 1;

    ctx.textAlign = 'left';
}

// ============================================================
// PHYSICS & COLLISION
// ============================================================

function rectCollision(a, b) {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
}

function updatePlayer() {
    const wasInAir = !player.onGround;
    // Horizontal movement (keyboard + gamepad stick)
    if (keys['ArrowLeft'] || keys['KeyA'] || gpStick.left) {
        player.vx = -player.speed;
        player.facing = -1;
    } else if (keys['ArrowRight'] || keys['KeyD'] || gpStick.right) {
        player.vx = player.speed;
        player.facing = 1;
    } else {
        player.vx *= FRICTION;
        if (Math.abs(player.vx) < 0.3) player.vx = 0;
    }

    // Jump (with double jump)
    if ((keys['ArrowUp'] || keys['KeyW'] || keys['GamepadJump']) && !player.jumpKeyHeld && player.jumps < player.maxJumps) {
        player.vy = player.jumps === 0 ? player.jumpForce : player.jumpForce * 0.85;
        player.jumps++;
        player.onGround = false;
        player.jumpKeyHeld = true;
        sfxJump();
    }
    if (!(keys['ArrowUp'] || keys['KeyW'] || keys['GamepadJump'])) {
        player.jumpKeyHeld = false;
    }

    // Melee Attack (Space) — close-range only, no projectile
    if (keys['Space'] && !player.isAttacking && player.attackCooldown <= 0) {
        player.isAttacking = true;
        player.attackTimer = player.attackDuration;
        player.attackCooldown = 30;
        if (charIsTackle(selectedCharacter)) {
            // Rugby tackle — lunge forward (longer with upgrade)
            player.vx = player.facing * (10 + (upgrades.tackle >= 2 ? 3 : 0));
            sfxTackle();
        } else if (selectedCharacter === 'mummy') {
            // Mummy's handbag hit — wider melee swing, uses handbag upgrade
            sfxHit();
        } else if (selectedCharacter === 'daddy') {
            // Daddy's melee — powerful punch
            sfxHit();
        } else {
            sfxKick();
            // Charlie's ability: kick spawns a homing football that always hits nearest enemy
            if (selectedCharacter === 'charlie') {
                const nearest = findNearestEnemy(player);
                if (nearest) {
                    projectiles.push({
                        x: player.x + (player.facing === 1 ? player.width + 5 : -10),
                        y: player.y + player.height / 2,
                        vx: player.facing * 8,
                        vy: -2,
                        spin: 0,
                        alive: true,
                        damage: 2 + (upgrades.kick >= 1 ? 1 : 0),
                        isHoming: true,
                        homingTarget: nearest,
                        charType: 'charlie',
                    });
                }
            }
        }
    }

    if (player.isAttacking) {
        player.attackTimer--;
        if (player.attackTimer <= 0) {
            player.isAttacking = false;
        }
    }
    if (player.attackCooldown > 0) player.attackCooldown--;

    // Block (B key / Square on controller) — halves damage, slows movement
    if (keys['Shift'] && !player.isAttacking) {
        player.isBlocking = true;
        player.blockTimer++;
        player.vx *= 0.3; // heavily slowed while blocking
    } else {
        player.isBlocking = false;
        player.blockTimer = 0;
    }

    // Combined ranged/special (Control key / O on controller)
    // Special takes priority when ready; otherwise fires ranged throw
    if (keys['Control'] && !player._rangedHeld && !player.isAttacking && !player.isBlocking) {
        if (player.specialCooldown <= 0 && player.specialActive <= 0) {
            // Fire special ability
            activateSpecialAbility(player, 'Control', selectedCharacter);
        } else if (player.rangedAmmo > 0) {
            // Fire ranged throw
            player.rangedAmmo--;
            projectiles.push({
                x: player.x + (player.facing === 1 ? player.width + 5 : -10),
                y: player.y + player.height / 2,
                vx: player.facing * 10,
                vy: -1.5,
                spin: 0,
                alive: true,
                damage: 3,
                isRanged: true,
                charType: selectedCharacter,
            });
            sfxHit();
        }
        player._rangedHeld = true;
    }
    if (!keys['Control']) player._rangedHeld = false;
    updateSpecialAbility(player, selectedCharacter, enemies, projectiles);

    // Companion abilities
    if (keys['KeyQ'] && !player.compQHeld) {
        useCompanionAbility('Q');
        player.compQHeld = true;
    }
    if (!keys['KeyQ']) player.compQHeld = false;

    if (keys['KeyE'] && !player.compEHeld) {
        useCompanionAbility('E');
        player.compEHeld = true;
    }
    if (!keys['KeyE']) player.compEHeld = false;

    // Gravity
    player.vy += GRAVITY;

    // Move
    player.x += player.vx;
    player.y += player.vy;

    // Clamp to level bounds
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > LEVEL_WIDTH) player.x = LEVEL_WIDTH - player.width;

    // Platform collision
    player.onGround = false;
    for (const p of platforms) {
        if (rectCollision(player, p)) {
            // Landing on top
            if (player.vy > 0 && player.y + player.height - player.vy <= p.y + 4) {
                player.y = p.y - player.height;
                player.vy = 0;
                player.onGround = true;
                player.jumps = 0;
            }
            // Hitting bottom
            else if (player.vy < 0 && player.y - player.vy >= p.y + p.height - 4) {
                player.y = p.y + p.height;
                player.vy = 0;
            }
            // Side collision
            else if (player.vx > 0) {
                player.x = p.x - player.width;
            } else if (player.vx < 0) {
                player.x = p.x + p.width;
            }
        }
    }

    // Landing dust
    if (wasInAir && player.onGround) spawnLandingDust();

    // Fall off screen — lose health but respawn (not instant death)
    if (player.y > SCREEN_H + 50) {
        const fallDmg = difficulty === 'child' ? 2 : 3;
        player.health = Math.max(0, player.health - fallDmg);
        if (player.health > 0) {
            // Respawn on last safe ground near current camera position
            player.x = cameraX + SCREEN_W / 2;
            player.y = GROUND_Y - player.height - 20;
            player.vy = 0;
            player.vx = 0;
            player.invincible = 90;
            player.jumps = 0;
            player.onGround = false;
            addScreenShake(4, 8);
            sfxPlayerHurt();
        }
    }

    // Invincibility timer
    if (player.invincible > 0) player.invincible--;

    // Animation timer — always ticks for sprite sheet support
    player.animTimer++;
    if (Math.abs(player.vx) > 0.5) {
        if (player.animTimer > 6) {
            player.animFrame++;
            player.animTimer = 0;
        }
    } else if (player.onGround && !player.isAttacking && player.specialActive <= 0) {
        player.animFrame = 0;
    }

    // Update current stage based on player position (never go backwards)
    const newStage = Math.min(4, Math.floor(player.x / STAGE_WIDTH) + 1);
    if (newStage > currentStage && newStage <= 4) {
        // Kill gate — must defeat enough enemies in current stage to advance
        const stageIdx = currentStage - 1;
        const required = Math.ceil(stageEnemyCounts[stageIdx] * KILL_GATE_PCT);
        if (stageKillCounts[stageIdx] < required) {
            // Push player back — can't advance yet
            player.x = currentStage * STAGE_WIDTH - 10;
            player.vx = -3;
        } else {
            previousStage = currentStage;
            currentStage = newStage;
            stageCompleteTimer = STAGE_COMPLETE_DURATION;
            gameState = 'stage_complete';
            stopMusic();
            return;
        }
    }
    // Only update if moving forward — prevents stage going backwards when player drifts
    if (newStage >= currentStage) currentStage = newStage;

    // Reach end of level — trigger boss fight
    if (rectCollision(player, winFlag)) {
        initBossFight();
    }

    // Check lose
    if (player.health <= 0) {
        gameState = 'lost';
        diedInBoss = false;
        sfxDefeat();
        stopMusic();
    }
}

function aimAtPlayer(ex, ey, speed) {
    // Calculate direction vector from enemy to player
    const dx = (player.x + player.width / 2) - ex;
    const dy = (player.y + player.height / 2) - ey;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return { vx: speed, vy: 0 };
    return { vx: (dx / dist) * speed, vy: (dy / dist) * speed };
}

function updateEnemies() {
    for (const e of enemies) {
        if (!e.alive) continue;

        // --- Gravity & platform collision for jumping enemies ---
        if (e.canJump) {
            e.vy += GRAVITY * 0.8;
            e.y += e.vy;
            e.onGround = false;

            for (const p of platforms) {
                if (rectCollision(e, p)) {
                    if (e.vy > 0 && e.y + e.height - e.vy <= p.y + 4) {
                        e.y = p.y - e.height;
                        e.vy = 0;
                        e.onGround = true;
                    }
                }
            }
            // Fall off screen — reset to ground
            if (e.y > SCREEN_H + 100) {
                e.y = GROUND_Y - e.height;
                e.vy = 0;
                e.onGround = true;
            }

            // Jump cooldown
            if (e.jumpCooldown > 0) e.jumpCooldown--;
        }

        // Patrol movement
        e.x += e.vx * e.facing;
        if (e.x <= e.patrolLeft) e.facing = 1;
        else if (e.x + e.width >= e.patrolRight) e.facing = -1;

        // Hit flash
        if (e.hitFlash > 0) e.hitFlash--;

        // --- Enemy-specific AI ---
        const distToPlayer = Math.abs((e.x + e.width / 2) - (player.x + player.width / 2));
        const playerAbove = player.y < e.y - 30;

        // Jump toward player — when above OR randomly when nearby
        if (e.canJump && e.onGround && e.jumpCooldown <= 0) {
            if (playerAbove && distToPlayer < 400) {
                e.vy = -13; // big jump to chase player on platforms
                e.onGround = false;
                e.jumpCooldown = 100;
            } else if (distToPlayer < 250 && Math.random() < 0.02) {
                e.vy = -10; // aggressive hop when nearby
                e.onGround = false;
                e.jumpCooldown = 110;
            }
        }

        if (e.type === 'alien_giant') {
            // Face the player when in range
            if (distToPlayer < 300) e.facing = player.x > e.x ? 1 : -1;

            e.shootTimer++;
            if (e.shootTimer >= e.shootCooldown && distToPlayer < 300) {
                // Directional laser aimed at player
                const origin = { x: e.x + (e.facing === 1 ? e.width + 5 : -5), y: e.y + e.height / 2 - 2 };
                const aim = aimAtPlayer(origin.x, origin.y, 3 * getDifficulty().laserSpeedMult);
                enemyLasers.push({ x: origin.x, y: origin.y, vx: aim.vx, vy: aim.vy, color: '#2ecc71' });
                e.shootTimer = 0;
                sfxLaser();
            }
        }

        if (e.type === 'alien_small') {
            if (distToPlayer < 300) {
                e.hidden = false;
                e.revealTimer = 60;
                e.facing = player.x > e.x ? 1 : -1;
            } else if (e.revealTimer > 0) {
                e.revealTimer--;
                if (e.revealTimer <= 0) e.hidden = true;
            }
            e.shootTimer++;
            if (e.shootTimer >= e.shootCooldown && distToPlayer < 250 && !e.hidden) {
                const origin = { x: e.x + (e.facing === 1 ? e.width + 5 : -5), y: e.y + e.height / 3 };
                const aim = aimAtPlayer(origin.x, origin.y, 3.5 * getDifficulty().laserSpeedMult);
                enemyLasers.push({ x: origin.x, y: origin.y, vx: aim.vx, vy: aim.vy, color: '#e74c3c' });
                e.shootTimer = 0;
                sfxLaser();
            }
        }

        if (e.type === 'flying_shoe') {
            // Hover up and down
            e.y = e.flyBaseY + Math.sin(frameTime * 0.003 + e.x * 0.01) * 25;
            // Face the player when nearby
            if (distToPlayer < 400) e.facing = player.x > e.x ? 1 : -1;
            // Drop poo when above or near the player
            e.shootTimer++;
            if (e.shootTimer >= e.shootCooldown && distToPlayer < 350) {
                // Poo drops straight down with slight drift
                enemyLasers.push({
                    x: e.x + e.width / 2,
                    y: e.y + e.height,
                    vx: e.facing * 0.3,
                    vy: 2.5,
                    color: 'poo',
                    isPoo: true,
                    pooGravity: 0.12,
                });
                e.shootTimer = 0;
            }
        }

        if (e.type === 'laser_line') {
            e.shootTimer++;
            e.angle += 0.02;
            e.acidTimer++;
            if (e.shootTimer >= e.shootCooldown && distToPlayer < 300) {
                // Directional laser aimed at player
                const origin = { x: e.x + e.width / 2, y: e.y };
                const aim = aimAtPlayer(origin.x, origin.y, 4 * getDifficulty().laserSpeedMult);
                enemyLasers.push({ x: origin.x, y: origin.y, vx: aim.vx, vy: aim.vy, color: '#e74c3c' });
                e.shootTimer = 0;
                sfxLaser();
            }
            // Acid drip damages player if close and below
            if (e.acidTimer % 90 < 20 && distToPlayer < 40 && player.y > e.y && player.invincible <= 0) {
                if (!player.isBlocking) player.health--;
                player.invincible = 40;
                player.vy = -4;
                sfxPlayerHurt();
            }
        }

        // Melee hit detection (all characters)
        if (player.isAttacking) {
            let meleeDmg, meleeRange;
            if (charIsTackle(selectedCharacter)) {
                meleeDmg = 2 + upgrades.tackle;
                meleeRange = 24 + (upgrades.tackle >= 2 ? 12 : 0);
            } else if (selectedCharacter === 'mummy') {
                meleeDmg = 3 + (upgrades.handbag >= 1 ? 1 : 0);
                meleeRange = 32 + (upgrades.handbag >= 2 ? 10 : 0);
            } else if (selectedCharacter === 'daddy') {
                meleeDmg = 3 + (upgrades.bottle >= 1 ? 1 : 0);
                meleeRange = 30 + (upgrades.bottle >= 2 ? 8 : 0);
            } else {
                meleeDmg = 2 + (upgrades.kick >= 1 ? 1 : 0);
                meleeRange = 28;
            }
            const meleeBoxes = [{ x: player.facing === 1 ? player.x + player.width : player.x - meleeRange, y: player.y + 4, width: meleeRange, height: player.height - 8 }];
            if (charIsTackle(selectedCharacter) && upgrades.tackle >= 3) {
                meleeBoxes.push({ x: player.facing === -1 ? player.x + player.width : player.x - meleeRange, y: player.y + 4, width: meleeRange, height: player.height - 8 });
            }
            for (const meleeBox of meleeBoxes) {
                if (rectCollision(meleeBox, e)) {
                    e.health -= meleeDmg;
                    e.hitFlash = 10;
                    e.x += player.facing * 15;
                    spawnParticles(e.x + e.width / 2, e.y + e.height / 2, '#fff', 4, 10, 3);
                    addScreenShake(2, 5);
                    sfxHit();
                    if (e.health <= 0) { e.alive = false; enemiesDefeated++; if (e.stage !== undefined) stageKillCounts[e.stage]++; stickersCollected++; spawnEnemyDeathEffect(e); sfxEnemyDeath(); }
                    break;
                }
            }
        }

        // Enemy damages player on contact
        if (player.invincible <= 0 && !player.isAttacking && rectCollision(player, e)) {
            if (!player.isBlocking) player.health--;
            player.invincible = player.isBlocking ? 30 : 60;
            player.vx = -player.facing * (player.isBlocking ? 2 : 6);
            player.vy = player.isBlocking ? -2 : -5;
            addScreenShake(4, 8);
            spawnParticles(player.x + player.width / 2, player.y + player.height / 2, '#e74c3c', 6, 8, 4);
            sfxPlayerHurt();
        }
    }
}

function updateEnemyLasers() {
    for (let i = 0; i < enemyLasers.length; i++) {
        const l = enemyLasers[i];
        l.x += l.vx;
        if (l.vy) l.y += l.vy;
        // Poo has gravity — accelerates downward
        if (l.isPoo && l.pooGravity) l.vy += l.pooGravity;
        // Poo splats on ground
        if (l.isPoo && l.y >= GROUND_Y - 4) {
            spawnParticles(l.x, GROUND_Y, '#8B4513', 4, 5, 2);
            l._remove = true;
            continue;
        }

        // Hit player?
        if (player.invincible <= 0 && Math.abs(l.x - player.x - player.width / 2) < 20 && Math.abs(l.y - player.y - player.height / 2) < 20) {
            if (!player.isBlocking) player.health--;
            player.invincible = player.isBlocking ? 20 : 40;
            player.vx = (l.vx > 0 ? 4 : -4) * (player.isBlocking ? 0.3 : 1);
            player.vy = player.isBlocking ? -1 : -3;
            addScreenShake(3, 6);
            spawnParticles(l.x, l.y, l.isPoo ? '#8B4513' : (l.color || '#e74c3c'), 5, 6, 3);
            sfxPlayerHurt();
            l._remove = true;
            continue;
        }

        // Off screen?
        if (l.x < cameraX - 100 || l.x > cameraX + SCREEN_W + 100 || l.y < -50 || l.y > SCREEN_H + 50) {
            l._remove = true;
        }
    }
    enemyLasers = enemyLasers.filter(l => !l._remove);
}

function updateProjectiles() {
    for (let i = 0; i < projectiles.length; i++) {
        const ball = projectiles[i];
        if (ball.isHoming) updateHomingProjectile(ball);
        ball.x += ball.vx;
        ball.y += ball.vy;
        if (!ball.isWave && !ball.isHoming) ball.vy += 0.18; // noticeable arc trajectory
        if (ball.isWave) { ball.waveLife--; if (ball.waveLife <= 0) ball.alive = false; }
        ball.spin += 0.3;

        // Check if ball hits an enemy
        for (const e of enemies) {
            if (!e.alive) continue;
            if (rectCollision({ x: ball.x - 8, y: ball.y - 8, width: 16, height: 16 }, e)) {
                const dmg = ball.damage || 1;
                e.health -= dmg;
                e.hitFlash = 10;
                e.x += ball.vx > 0 ? 20 : -20;
                spawnParticles(e.x + e.width / 2, e.y + e.height / 2, '#fff', 3, 8, 3);
                sfxHit();
                if (e.health <= 0) { e.alive = false; enemiesDefeated++; if (e.stage !== undefined) stageKillCounts[e.stage]++; stickersCollected++; spawnEnemyDeathEffect(e); sfxEnemyDeath(); }
                if (!ball.isWave) { // waves pass through
                    ball.alive = false;
                    break;
                }
            }
        }

        // Mark if off screen or hit something
        if (!ball.alive || ball.x < cameraX - 50 || ball.x > cameraX + SCREEN_W + 50 || ball.y > SCREEN_H + 50) {
            ball._remove = true;
        }
    }
    projectiles = projectiles.filter(b => !b._remove);
}

function updateCollectibles() {
    // Collect stickers
    for (const s of stickers) {
        if (s.collected) continue;
        if (rectCollision(player, s)) {
            s.collected = true;
            stickersCollected++;
            spawnParticles(s.x + s.width / 2, s.y + s.height / 2, '#f1c40f', 8, 12, 3);
            sfxCollect();
        }
    }

    // Collect weapons — gives ranged ammo (rugby ball / football)
    for (const w of weaponPickups) {
        if (w.collected) continue;
        if (rectCollision(player, w)) {
            w.collected = true;
            weaponsCollected++;
            player.rangedAmmo += 3; // each pickup gives 3 shots
            spawnParticles(w.x + w.width / 2, w.y + w.height / 2, '#e74c3c', 10, 14, 4);
            addScreenShake(2, 4);
            sfxWeapon();
        }
    }

    // Collect health hearts
    for (const h of hearts) {
        if (h.collected) continue;
        if (rectCollision(player, h)) {
            if (player.health < player.maxHealth) {
                h.collected = true;
                const healAmt = difficulty === 'child' ? 2 : 1;
                player.health = Math.min(player.health + healAmt, player.maxHealth);
                spawnParticles(h.x + h.width / 2, h.y + h.height / 2, '#e74c3c', 8, 12, 3);
                sfxCollect();
            }
        }
    }

    // Collect companion pickups
    for (const c of companionPickups) {
        if (c.collected) continue;
        if (rectCollision(player, c)) {
            c.collected = true;
            activeCompanion = {
                type: c.companion,
                timer: 900, // 15 seconds at 60fps
            };
            companionCooldown = 0;
            sfxCompanion();
        }
    }

    // Update active companion timer
    if (activeCompanion) {
        activeCompanion.timer--;
        if (activeCompanion.timer <= 0) {
            activeCompanion = null;
        }
    }

    // Companion cooldown
    if (companionCooldown > 0) companionCooldown--;
}

// Companion abilities
function useCompanionAbility(abilityKey) {
    if (!activeCompanion || companionCooldown > 0) return;

    if (activeCompanion.type === 'jules') {
        if (abilityKey === 'Q') {
            // Claw scratch — visible claw marks fly out both directions from Jules
            // Spawn claw effects going left and right
            for (const dir of [-1, 1]) {
                visualEffects.push({
                    type: 'claw',
                    x: player.x + player.width / 2,
                    y: player.y + player.height / 3,
                    vx: dir * 8,
                    timer: 30,
                    maxTimer: 30,
                    dir: dir,
                });
            }
            // Damage enemies in a wider range (both sides)
            const clawDmg = 3 + (upgrades.jules >= 1 ? 2 : 0); // level 1: stronger claws
            for (const e of enemies) {
                if (!e.alive) continue;
                const dist = Math.abs((e.x + e.width / 2) - (player.x + player.width / 2));
                if (dist < 200) {
                    e.health -= clawDmg;
                    e.hitFlash = 15;
                    if (e.health <= 0) e.alive = false;
                }
            }
            sfxClawScratch();
            companionCooldown = 90;
        } else if (abilityKey === 'E') {
            // Mega bark — expanding sound wave ring that damages/kills enemies on screen
            const barkRadius = upgrades.jules >= 2 ? SCREEN_W * 0.85 : SCREEN_W * 0.6; // level 2: wider bark
            visualEffects.push({
                type: 'soundwave',
                x: player.x + player.width / 2,
                y: player.y + player.height / 2,
                radius: 10,
                maxRadius: barkRadius,
                timer: 45,
                maxTimer: 45,
                damaged: new Set(), // track which enemies already hit
            });
            sfxMegaBark();
            companionCooldown = 150;
        }
    } else if (activeCompanion.type === 'fishies') {
        if (abilityKey === 'Q') {
            // Fishtail kick — sends a wave projectile
            const waveDmg = 2 + (upgrades.fishies >= 1 ? 2 : 0); // level 1: stronger wave
            projectiles.push({
                x: player.x + (player.facing === 1 ? player.width + 5 : -10),
                y: player.y + player.height / 2,
                vx: player.facing * 7,
                vy: 0,
                spin: 0,
                alive: true,
                isWave: true, // special — passes through enemies
                damage: waveDmg,
                waveLife: 60,
            });
            sfxFishtailKick();
            companionCooldown = 60;
        } else if (abilityKey === 'E') {
            // Fish food munch — level 2 fishies: always full heal, otherwise child=full, adult=+2
            if (upgrades.fishies >= 2 || difficulty === 'child') {
                player.health = player.maxHealth;
            } else {
                player.health = Math.min(player.maxHealth, player.health + 2);
            }
            sfxFishMunch();
            companionCooldown = 180;
        }
    }
}

function updateVisualEffects() {
    for (let i = 0; i < visualEffects.length; i++) {
        const fx = visualEffects[i];
        fx.timer--;

        if (fx.type === 'claw') {
            fx.x += fx.vx;
        }

        if (fx.type === 'soundwave') {
            // Expand the ring
            const progress = 1 - (fx.timer / fx.maxTimer);
            fx.radius = 10 + (fx.maxRadius - 10) * progress;

            // Damage enemies as the wave reaches them
            const targetEnemies = fx.vsEnemies || enemies;
            for (const e of targetEnemies) {
                if (!e.alive || fx.damaged.has(e)) continue;
                const dist = Math.sqrt(
                    Math.pow((e.x + e.width / 2) - fx.x, 2) +
                    Math.pow((e.y + e.height / 2) - fx.y, 2)
                );
                if (dist < fx.radius && dist > fx.radius - 40) {
                    e.health -= 4;
                    e.hitFlash = 20;
                    sfxHit();
                    if (e.health <= 0) {
                        e.alive = false;
                        spawnEnemyDeathEffect(e); sfxEnemyDeath();
                        if (!fx.vsEnemies) { enemiesDefeated++; if (e.stage !== undefined) stageKillCounts[e.stage]++; stickersCollected++; }
                    }
                    fx.damaged.add(e);
                }
            }
        }

    }
    visualEffects = visualEffects.filter(fx => fx.timer > 0);
}

function drawVisualEffects() {
    for (const fx of visualEffects) {
        if (fx.type === 'claw') {
            const sx = fx.x - cameraX;
            const alpha = fx.timer / fx.maxTimer;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(sx, fx.y);
            if (fx.dir === -1) ctx.scale(-1, 1);

            // Three claw slash marks
            ctx.strokeStyle = '#f1c40f';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            for (let c = -1; c <= 1; c++) {
                ctx.beginPath();
                ctx.moveTo(-5, -12 + c * 8);
                ctx.lineTo(15, -6 + c * 8);
                ctx.stroke();
            }

            // Claw tip sparks
            ctx.fillStyle = '#e74c3c';
            for (let s = 0; s < 3; s++) {
                ctx.beginPath();
                ctx.arc(15 + (Math.sin(frameTime * 0.03 + s * 2.1) + 1) * 4, -6 + (s - 1) * 8 + (Math.sin(frameTime * 0.04 + s * 1.7) + 1) * 2, 2, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }

        if (fx.type === 'soundwave') {
            const sx = fx.x - cameraX;
            const alpha = fx.timer / fx.maxTimer;
            ctx.save();
            ctx.globalAlpha = alpha * 0.6;

            // Multiple expanding rings
            for (let ring = 0; ring < 3; ring++) {
                const r = fx.radius - ring * 15;
                if (r < 0) continue;
                ctx.strokeStyle = ring === 0 ? '#f1c40f' : (ring === 1 ? '#e67e22' : '#e74c3c');
                ctx.lineWidth = 4 - ring;
                ctx.beginPath();
                ctx.arc(sx, fx.y, r, 0, Math.PI * 2);
                ctx.stroke();
            }

            // Inner flash
            if (fx.timer > fx.maxTimer - 5) {
                ctx.fillStyle = 'rgba(241, 196, 15, 0.3)';
                ctx.beginPath();
                ctx.arc(sx, fx.y, fx.radius * 0.3, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
    }
}

function updateCamera() {
    // Smooth camera follow
    const targetX = player.x - SCREEN_W / 3;
    cameraX += (targetX - cameraX) * 0.1;
    if (cameraX < 0) cameraX = 0;
    if (cameraX > LEVEL_WIDTH - SCREEN_W) cameraX = LEVEL_WIDTH - SCREEN_W;
}

// ============================================================
// THE BOMBARDER — Boss Fight
// ============================================================
const boss = {
    x: 0, y: 0, width: 200, height: 400,
    health: 0, maxHealth: 0,
    phase: 1,         // 1 = shielded (charm), 2 = vulnerable, 3 = enraged
    charmHealth: 0, maxCharmHealth: 0,
    charmBroken: false,
    attackTimer: 0,
    attackCooldown: 120,
    currentAttack: null,
    laserTimer: 0,
    alive: true,
    hitFlash: 0,
    eyeGlow: 0,
};

let bossLasers = [];
let bossArenaX = 0; // fixed camera for boss fight
const BOSS_ARENA_W = SCREEN_W; // single screen arena

function initBossFight() {
    const d = getDifficulty();
    gameState = 'boss';
    stopMusic();
    startMusic('boss', true);

    // Position boss on right side of arena
    boss.x = SCREEN_W - 250;
    boss.y = SCREEN_H - 460;
    boss.width = 200;
    boss.height = 400;
    const bossLvlScale = 1 + (currentLevel - 1) * 0.25; // bosses scale 25% per level
    boss.maxHealth = difficulty === 'child' ? Math.ceil(60 * bossLvlScale) : Math.ceil(80 * d.enemyHealthMult * bossLvlScale);
    boss.health = boss.maxHealth;
    boss.maxCharmHealth = difficulty === 'child' ? Math.ceil(20 * bossLvlScale) : Math.ceil(30 * d.enemyHealthMult * bossLvlScale);
    boss.charmHealth = boss.maxCharmHealth;
    boss.charmBroken = false;
    boss.hitCooldown = 0; // prevents multi-frame damage from single attack
    boss.phase = 1;
    boss.attackTimer = 0;
    boss.attackCooldown = difficulty === 'child' ? Math.max(60, 100 - (currentLevel - 1) * 10) : Math.max(40, 70 - (currentLevel - 1) * 8);
    boss.currentAttack = null;
    boss.alive = true;
    boss.hitFlash = 0;
    boss.eyeGlow = 0;
    boss.laserTimer = 0;

    bossLasers = [];

    // Reset player position for arena
    player.x = 80;
    player.y = GROUND_Y - player.height;
    player.vx = 0;
    player.vy = 0;
    player.invincible = 60;
    cameraX = 0; // Reset camera — boss arena uses screen coordinates

    // Give extra health boost based on weapons collected
    if (weaponsCollected > 0) {
        player.health = Math.min(player.maxHealth, player.health + weaponsCollected);
    }
}

// Boss arena platforms
const bossplatforms = [
    { x: 0, y: GROUND_Y, width: SCREEN_W, height: 60, type: 'ground' },
    { x: 50, y: 360, width: 100, height: 14, type: 'floating' },
    { x: 250, y: 300, width: 100, height: 14, type: 'floating' },
    { x: 450, y: 250, width: 100, height: 14, type: 'floating' },
    { x: 150, y: 200, width: 100, height: 14, type: 'floating' },
    { x: 350, y: 380, width: 100, height: 14, type: 'floating' },
];

function updateBossFight() {
    // Player movement (reuse same controls)
    if (keys['ArrowLeft'] || keys['KeyA'] || gpStick.left) { player.vx = -player.speed; player.facing = -1; }
    else if (keys['ArrowRight'] || keys['KeyD'] || gpStick.right) { player.vx = player.speed; player.facing = 1; }
    else { player.vx *= FRICTION; if (Math.abs(player.vx) < 0.3) player.vx = 0; }

    if ((keys['ArrowUp'] || keys['KeyW'] || keys['GamepadJump'] || gpStick.up) && !player.jumpKeyHeld && player.jumps < player.maxJumps) {
        player.vy = player.jumps === 0 ? player.jumpForce : player.jumpForce * 0.85;
        player.jumps++; player.onGround = false; player.jumpKeyHeld = true;
        sfxJump();
    }
    if (!(keys['ArrowUp'] || keys['KeyW'] || keys['GamepadJump'] || gpStick.up)) player.jumpKeyHeld = false;

    // Attack
    if (keys['Space'] && !player.isAttacking && player.attackCooldown <= 0) {
        player.isAttacking = true;
        player.attackTimer = player.attackDuration;
        player.attackCooldown = 30;
        if (charIsTackle(selectedCharacter)) {
            player.vx = player.facing * (10 + (upgrades.tackle >= 2 ? 3 : 0));
            sfxTackle();
        } else if (selectedCharacter === 'mummy') {
            sfxHit();
        } else if (selectedCharacter === 'daddy') {
            // Daddy's melee — powerful punch
            sfxHit();
        } else {
            sfxKick();
            // Charlie's homing ball in boss fight — targets the boss directly
            if (selectedCharacter === 'charlie' && boss.alive) {
                projectiles.push({
                    x: player.x + (player.facing === 1 ? player.width + 5 : -10),
                    y: player.y + player.height / 2,
                    vx: player.facing * 8,
                    vy: -2,
                    spin: 0,
                    alive: true,
                    damage: 2 + (upgrades.kick >= 1 ? 1 : 0),
                    isHoming: true,
                    homingTarget: boss,
                    charType: 'charlie',
                });
            }
        }
    }
    if (player.isAttacking) { player.attackTimer--; if (player.attackTimer <= 0) player.isAttacking = false; }
    if (player.attackCooldown > 0) player.attackCooldown--;

    // Block in boss fight
    if (keys['Shift'] && !player.isAttacking) {
        player.isBlocking = true;
        player.blockTimer++;
        player.vx *= 0.3;
    } else {
        player.isBlocking = false;
        player.blockTimer = 0;
    }

    // Combined ranged/special in boss fight
    if (keys['Control'] && !player._rangedHeld && !player.isAttacking && !player.isBlocking) {
        if (player.specialCooldown <= 0 && player.specialActive <= 0) {
            activateSpecialAbility(player, 'Control', selectedCharacter);
        } else if (player.rangedAmmo > 0) {
            player.rangedAmmo--;
            projectiles.push({
                x: player.x + (player.facing === 1 ? player.width + 5 : -10),
                y: player.y + player.height / 2,
                vx: player.facing * 10,
                vy: -1.5,
                spin: 0,
                alive: true,
                damage: 3,
                isRanged: true,
                charType: selectedCharacter,
            });
            sfxHit();
        }
        player._rangedHeld = true;
    }
    if (!keys['Control']) player._rangedHeld = false;
    updateSpecialAbility(player, selectedCharacter, [], projectiles);

    // Companion abilities in boss fight
    if (keys['KeyQ'] && !player.compQHeld) { useCompanionAbility('Q'); player.compQHeld = true; }
    if (!keys['KeyQ']) player.compQHeld = false;
    if (keys['KeyE'] && !player.compEHeld) { useCompanionAbility('E'); player.compEHeld = true; }
    if (!keys['KeyE']) player.compEHeld = false;

    // Gravity
    player.vy += GRAVITY;
    player.x += player.vx;
    player.y += player.vy;

    // Clamp to arena
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > SCREEN_W) player.x = SCREEN_W - player.width;

    // Platform collision
    player.onGround = false;
    for (const p of bossplatforms) {
        if (rectCollision(player, p)) {
            if (player.vy > 0 && player.y + player.height - player.vy <= p.y + 4) {
                player.y = p.y - player.height; player.vy = 0;
                player.onGround = true; player.jumps = 0;
            } else if (player.vy < 0 && player.y - player.vy >= p.y + p.height - 4) {
                player.y = p.y + p.height; player.vy = 0;
            }
        }
    }

    // If player falls below ground, snap back onto it
    if (player.y + player.height > GROUND_Y && player.vy >= 0) {
        player.y = GROUND_Y - player.height;
        player.vy = 0;
        player.onGround = true;
        player.jumps = 0;
    }
    // Fall off screen in boss fight — lose health but respawn
    if (player.y > SCREEN_H + 50) {
        const fallDmg = difficulty === 'child' ? 2 : 3;
        player.health = Math.max(0, player.health - fallDmg);
        if (player.health > 0) {
            player.x = SCREEN_W / 2 - player.width / 2;
            player.y = GROUND_Y - player.height - 20;
            player.vy = 0; player.vx = 0;
            player.invincible = 90;
            player.jumps = 0; player.onGround = false;
            addScreenShake(4, 8);
            sfxPlayerHurt();
        }
    }
    if (player.invincible > 0) player.invincible--;
    player.animTimer++;
    if (Math.abs(player.vx) > 0.5) { if (player.animTimer > 6) { player.animFrame++; player.animTimer = 0; } }
    else if (!player.isAttacking) player.animFrame = 0;

    // --- Boss AI ---
    boss.eyeGlow = 0.5 + Math.sin(frameTime * 0.005) * 0.3;
    boss.attackTimer++;
    if (boss.hitFlash > 0) boss.hitFlash--;

    // Phase 3 enrage: faster attacks and boss slowly advances toward player
    const effectiveCooldown = boss.phase === 3 ? Math.floor(boss.attackCooldown * 0.55) : boss.attackCooldown;
    if (boss.phase === 3 && boss.alive) {
        // Boss slowly stomps toward the player
        const dir = player.x < boss.x ? -0.4 : 0.3;
        boss.x += dir;
        // Clamp boss to arena
        if (boss.x < SCREEN_W * 0.3) boss.x = SCREEN_W * 0.3;
        if (boss.x + boss.width > SCREEN_W) boss.x = SCREEN_W - boss.width;
    }

    // Boss attacks — themed per level
    if (boss.attackTimer >= effectiveCooldown && boss.alive) {
        // Each level has different attack pools
        let attacks;
        if (currentLevel === 1) {
            // The Bombarder — lasers and bombs
            attacks = boss.phase === 1 ? ['laser_sweep', 'blaster']
                : boss.phase === 2 ? ['laser_sweep', 'blaster', 'rain']
                : ['laser_sweep', 'blaster', 'rain', 'beam', 'slam'];
        } else if (currentLevel === 2) {
            // The Dark Knight — swords and shields
            attacks = boss.phase === 1 ? ['sword_sweep', 'sword_throw']
                : boss.phase === 2 ? ['sword_sweep', 'sword_throw', 'shield_rain']
                : ['sword_sweep', 'sword_throw', 'shield_rain', 'lance_charge', 'slam'];
        } else if (currentLevel === 3) {
            // The Goalkeeper — footballs and glove saves
            attacks = boss.phase === 1 ? ['ball_sweep', 'ball_throw']
                : boss.phase === 2 ? ['ball_sweep', 'ball_throw', 'ball_rain']
                : ['ball_sweep', 'ball_throw', 'ball_rain', 'dive_beam', 'slam'];
        } else if (currentLevel === 4) {
            // The Forest Guardian — branches, leaves, roots
            attacks = boss.phase === 1 ? ['branch_sweep', 'thorn_throw']
                : boss.phase === 2 ? ['branch_sweep', 'thorn_throw', 'leaf_rain']
                : ['branch_sweep', 'thorn_throw', 'leaf_rain', 'root_beam', 'slam'];
        } else {
            // The Prime Monster — briefcases, money, papers
            attacks = boss.phase === 1 ? ['paper_sweep', 'briefcase_throw']
                : boss.phase === 2 ? ['paper_sweep', 'briefcase_throw', 'money_rain']
                : ['paper_sweep', 'briefcase_throw', 'money_rain', 'red_tape', 'slam'];
        }
        boss.currentAttack = attacks[Math.floor(Math.random() * attacks.length)];

        const spdMult = getDifficulty().laserSpeedMult * (boss.phase === 3 ? 1.3 : 1);

        // Projectile type tag for themed drawing
        const projType = currentLevel === 1 ? 'laser' : currentLevel === 2 ? 'sword' : currentLevel === 3 ? 'ball' : currentLevel === 4 ? 'nature' : 'office';

        // SWEEP attacks (fan pattern from boss)
        if (boss.currentAttack.endsWith('_sweep')) {
            const count = boss.phase === 3 ? 8 : 5;
            const colors = { 1: '#e74c3c', 2: '#8888cc', 3: '#fff', 4: '#5a8a2a', 5: '#f5f5dc' };
            const enrColors = { 1: '#ff4444', 2: '#aaaaff', 3: '#ffff00', 4: '#88ff44', 5: '#ffcc00' };
            for (let i = 0; i < count; i++) {
                const angle = -0.8 + (i * (1.6 / (count - 1)));
                bossLasers.push({
                    x: boss.x + 60, y: boss.y + 80,
                    vx: Math.cos(angle) * -4 * spdMult,
                    vy: Math.sin(angle) * 4 * spdMult,
                    timer: 90,
                    color: boss.phase === 3 ? (enrColors[currentLevel] || '#ff4444') : (colors[currentLevel] || '#e74c3c'),
                    projType: projType,
                    spin: Math.random() * 6.28,
                });
            }

        // AIMED THROW attacks (single/double shot at player)
        } else if (boss.currentAttack.endsWith('_throw') || boss.currentAttack === 'blaster') {
            const colors = { 1: '#f39c12', 2: '#6666bb', 3: '#fff', 4: '#8B4513', 5: '#8B6914' };
            const aim = aimAtPlayer(boss.x + 30, boss.y + 200, 3.5 * spdMult);
            bossLasers.push({
                x: boss.x + 30, y: boss.y + 200, vx: aim.vx, vy: aim.vy,
                timer: 120, color: colors[currentLevel] || '#f39c12',
                projType: projType, spin: 0, isBig: true,
            });
            if (boss.phase === 3) {
                const aim2 = aimAtPlayer(boss.x + 30, boss.y + 250, 3.2 * spdMult);
                bossLasers.push({
                    x: boss.x + 30, y: boss.y + 250, vx: aim2.vx, vy: aim2.vy,
                    timer: 120, color: colors[currentLevel] || '#f39c12',
                    projType: projType, spin: 0, isBig: true,
                });
            }

        // RAIN attacks (fall from above)
        } else if (boss.currentAttack.endsWith('_rain') || boss.currentAttack === 'rain') {
            const count = boss.phase === 3 ? 7 : 4;
            const colors = { 1: '#9b59b6', 2: '#aaa', 3: '#fff', 4: '#2ecc71', 5: '#85bb65' };
            for (let i = 0; i < count; i++) {
                bossLasers.push({
                    x: 50 + Math.random() * (SCREEN_W - 200), y: -20 - Math.random() * 40,
                    vx: 0, vy: 3 * spdMult,
                    timer: 100, color: colors[currentLevel] || '#9b59b6',
                    projType: projType, spin: Math.random() * 6.28,
                });
            }

        // BEAM attacks (horizontal charge across arena)
        } else if (boss.currentAttack === 'beam' || boss.currentAttack === 'lance_charge' || boss.currentAttack === 'dive_beam' || boss.currentAttack === 'root_beam' || boss.currentAttack === 'red_tape') {
            const colors = { 1: '#e74c3c', 2: '#6666cc', 3: '#2ecc71', 4: '#8B4513', 5: '#cc0000' };
            bossLasers.push({
                x: boss.x, y: boss.y + 150 + Math.random() * 150,
                vx: -6 * spdMult, vy: 0,
                timer: 80, color: colors[currentLevel] || '#e74c3c',
                isBeam: true, projType: projType,
            });
            if (boss.phase === 3) {
                bossLasers.push({
                    x: boss.x, y: boss.y + 100 + Math.random() * 100,
                    vx: -5 * spdMult, vy: 0,
                    timer: 80, color: colors[currentLevel] || '#ff4444',
                    isBeam: true, projType: projType,
                });
            }

        // SLAM attacks (ground shockwave — all bosses share this)
        } else if (boss.currentAttack === 'slam') {
            addScreenShake(6, 15);
            sfxBossSlam();
            const slamColors = { 1: '#ff6600', 2: '#6666cc', 3: '#2ecc71', 4: '#5a3a1a', 5: '#333' };
            for (let i = 0; i < 6; i++) {
                bossLasers.push({
                    x: boss.x - 20, y: GROUND_Y - 15,
                    vx: -3.5 * spdMult - i * 0.5, vy: -0.3 * i,
                    timer: 70, color: slamColors[currentLevel] || '#ff6600',
                    isSlam: true, projType: projType,
                });
            }
        }

        boss.attackTimer = 0;
        if (boss.currentAttack !== 'slam') sfxLaser();
    }

    // Update boss lasers
    for (let i = 0; i < bossLasers.length; i++) {
        const l = bossLasers[i];
        l.x += l.vx; l.y += l.vy; l.timer--;

        // Hit player
        if (player.invincible <= 0) {
            const hitSize = l.isBeam ? 30 : (l.isSlam ? 20 : 12);
            if (Math.abs(l.x - player.x - player.width / 2) < hitSize && Math.abs(l.y - player.y - player.height / 2) < hitSize) {
                if (!player.isBlocking) player.health--;
                player.invincible = player.isBlocking ? 20 : 40;
                player.vy = player.isBlocking ? -1 : -4;
                sfxPlayerHurt();
                l._remove = true;
                continue;
            }
        }

        if (l.timer <= 0 || l.x < -50 || l.x > SCREEN_W + 50 || l.y > SCREEN_H + 50) {
            l._remove = true;
        }
    }
    bossLasers = bossLasers.filter(l => !l._remove);

    // --- Boss contact damage (player takes damage when too close) ---
    if (boss.alive && player.invincible <= 0 && !player.isAttacking) {
        const bossBody = { x: boss.x + 20, y: boss.y + 40, width: boss.width - 40, height: boss.height - 40 };
        if (rectCollision(player, bossBody)) {
            if (!player.isBlocking) player.health--;
            player.invincible = player.isBlocking ? 25 : 50;
            player.vx = (player.x < boss.x + boss.width / 2 ? -1 : 1) * (player.isBlocking ? 3 : 8);
            player.vy = player.isBlocking ? -2 : -5;
            addScreenShake(3, 6);
            sfxPlayerHurt();
        }
    }

    // --- Damage the boss ---
    if (boss.hitCooldown > 0) boss.hitCooldown--;
    let bossMeleeDmg, bossMeleeRange;
    if (charIsTackle(selectedCharacter)) {
        bossMeleeDmg = (weaponsCollected > 0 ? 3 : 2) + upgrades.tackle;
        bossMeleeRange = 24 + (upgrades.tackle >= 2 ? 12 : 0);
    } else {
        bossMeleeDmg = (weaponsCollected > 0 ? 3 : 2) + (upgrades.kick >= 1 ? 1 : 0);
        bossMeleeRange = 28;
    }
    // Phase 1: must break the charm first
    if (boss.phase === 1 && !boss.charmBroken) {
        if (player.isAttacking && boss.hitCooldown <= 0) {
            const meleeBox = { x: player.facing === 1 ? player.x + player.width : player.x - bossMeleeRange, y: player.y + 4, width: bossMeleeRange, height: player.height - 8 };
            if (rectCollision(meleeBox, boss)) {
                boss.charmHealth -= bossMeleeDmg;
                boss.hitFlash = 10;
                boss.hitCooldown = 30;
                sfxBossHit();
                if (boss.charmHealth <= 0) { boss.charmBroken = true; boss.phase = 2; }
            }
        }
    } else {
        // Phase 2+: direct damage to boss
        if (player.isAttacking && boss.hitCooldown <= 0) {
            const meleeBox = { x: player.facing === 1 ? player.x + player.width : player.x - bossMeleeRange, y: player.y + 4, width: bossMeleeRange, height: player.height - 8 };
            if (rectCollision(meleeBox, boss)) {
                boss.health -= bossMeleeDmg;
                boss.hitFlash = 10;
                boss.hitCooldown = 30;
                sfxBossHit();
                if (boss.health <= boss.maxHealth * 0.3 && boss.phase === 2) boss.phase = 3;
                if (boss.health <= 0) { boss.alive = false; gameState = 'won'; wonScreenDelay = 90; sfxVictory(); startMusic('victory'); }
            }
        }
    }

    // Projectiles (Charlie's football, fishies wave) hit boss
    for (let i = 0; i < projectiles.length; i++) {
        const ball = projectiles[i];
        ball.x += ball.vx; ball.y += ball.vy;
        if (!ball.isWave) ball.vy += 0.18;
        ball.spin += 0.3;

        if (rectCollision({ x: ball.x - 8, y: ball.y - 8, width: 16, height: 16 }, boss)) {
            // Waves only hit boss once (otherwise they deal damage every frame while passing through)
            if (ball.isWave && ball.hitBoss) continue;
            const dmg = (ball.damage || 1) * (weaponsCollected > 0 ? 2 : 1);
            if (boss.phase === 1 && !boss.charmBroken) {
                boss.charmHealth -= dmg;
                if (boss.charmHealth <= 0) { boss.charmBroken = true; boss.phase = 2; }
            } else {
                boss.health -= dmg;
                if (boss.health <= boss.maxHealth * 0.3 && boss.phase === 2) boss.phase = 3;
                if (boss.health <= 0) { boss.alive = false; gameState = 'won'; wonScreenDelay = 90; sfxVictory(); startMusic('victory'); }
            }
            boss.hitFlash = 10;
            sfxBossHit();
            if (ball.isWave) { ball.hitBoss = true; } else { ball._remove = true; continue; }
        }

        if (!ball.alive || ball.x < -50 || ball.x > SCREEN_W + 50 || ball.y > SCREEN_H + 50) {
            ball._remove = true;
        }
    }
    projectiles = projectiles.filter(b => !b._remove);

    // Visual effects (companion abilities work in boss fight)
    updateVisualEffects();
    // Sound wave / claw damage to boss
    for (const fx of visualEffects) {
        if (fx.type === 'soundwave' && !fx.hitBoss) {
            const dist = Math.sqrt(Math.pow(boss.x + boss.width / 2 - fx.x, 2) + Math.pow(boss.y + boss.height / 2 - fx.y, 2));
            if (dist < fx.radius) {
                const dmg = weaponsCollected > 0 ? 3 : 2; // capped vs boss
                if (boss.phase === 1) { boss.charmHealth -= dmg; if (boss.charmHealth <= 0) { boss.charmBroken = true; boss.phase = 2; } }
                else { boss.health -= dmg; if (boss.health <= boss.maxHealth * 0.3 && boss.phase === 2) boss.phase = 3; if (boss.health <= 0) { boss.alive = false; gameState = 'won'; wonScreenDelay = 90; sfxVictory(); startMusic('victory'); } }
                boss.hitFlash = 15;
                sfxBossHit();
                fx.hitBoss = true;
            }
        }
    }

    // Special ability damage to boss (reduced vs boss — 2 damage instead of 3-4)
    if (player.specialActive > 0 && boss.alive && boss.hitCooldown <= 0) {
        const sType = player.specialType;
        let specialHitBoss = false;
        if (sType === 'mummy' && player.specialActive < 15 && player.onGround) {
            // Handbag slam — check range to boss
            const dx = Math.abs((boss.x + boss.width / 2) - (player.x + player.width / 2));
            if (dx < 140) specialHitBoss = true;
        } else if (sType === 'daddy' && player.specialActive === 18) {
            // Power watch blast
            const dx = (boss.x + boss.width / 2) - (player.x + player.width / 2);
            const dy = (boss.y + boss.height / 2) - (player.y + player.height / 2);
            if (Math.sqrt(dx * dx + dy * dy) < 180) specialHitBoss = true;
        } else if ((sType === 'heath' || sType === 'charlie') && rectCollision(player, boss)) {
            specialHitBoss = true;
        } else if (sType === 'rupert' && player.onGround && player.specialActive < CHAR_INFO.rupert.special.duration - 5) {
            const dx = Math.abs((boss.x + boss.width / 2) - (player.x + player.width / 2));
            if (dx < 130) specialHitBoss = true;
        } else if (sType === 'emilia') {
            const dx = (boss.x + boss.width / 2) - (player.x + player.width / 2);
            const dy = (boss.y + boss.height / 2) - (player.y + player.height / 2);
            if (Math.sqrt(dx * dx + dy * dy) < 70 && player.specialActive % 10 === 0) specialHitBoss = true;
        }
        if (specialHitBoss) {
            const specDmg = 2; // reduced damage vs boss
            if (boss.phase === 1 && !boss.charmBroken) {
                boss.charmHealth -= specDmg;
                if (boss.charmHealth <= 0) { boss.charmBroken = true; boss.phase = 2; }
            } else {
                boss.health -= specDmg;
                if (boss.health <= boss.maxHealth * 0.3 && boss.phase === 2) boss.phase = 3;
                if (boss.health <= 0) { boss.alive = false; gameState = 'won'; wonScreenDelay = 90; sfxVictory(); startMusic('victory'); }
            }
            boss.hitFlash = 10;
            boss.hitCooldown = 30;
            sfxBossHit();
        }
    }

    // Companion timer
    if (activeCompanion) { activeCompanion.timer--; if (activeCompanion.timer <= 0) activeCompanion = null; }
    if (companionCooldown > 0) companionCooldown--;

    // Player dies
    if (player.health <= 0) { gameState = 'lost'; diedInBoss = true; sfxDefeat(); stopMusic(); }
}

// Boss visual themes per level
const BOSS_THEMES = {
    1: { // The Bombarder — dark red war machine
        bg: ['#1a0a2e', '#2d1b4e', '#1a0a1e'],
        body: '#4a0e0e', bodyHit: '#ff6666', bodyEnraged: '#8B0000',
        head: '#3a0808', headHit: '#ff4444',
        armour: '#2c2c3e', arms: '#5a1a1a',
        eyeColor: '#ff4444', eyeEnraged: '#ff0000',
        platform: '#4a3060', ground: '#2c2c3e',
        feature: 'bombarder', // default spiky boss
    },
    2: { // The Dark Knight — grey stone armor, blue glow
        bg: ['#0a0a1a', '#1a1a2e', '#0a0a10'],
        body: '#3a3a4a', bodyHit: '#8888ff', bodyEnraged: '#2a2a6a',
        head: '#2a2a3a', headHit: '#6666ff',
        armour: '#555566', arms: '#4a4a5a',
        eyeColor: '#4488ff', eyeEnraged: '#0044ff',
        platform: '#3a3a50', ground: '#2a2a3a',
        feature: 'knight', // helmet visor, shield
    },
    3: { // The Goalkeeper — green/white kit, gloves
        bg: ['#0a1a0a', '#1a2e1a', '#0a1a0a'],
        body: '#1a6a1a', bodyHit: '#88ff88', bodyEnraged: '#0a4a0a',
        head: '#2a5a2a', headHit: '#66ff66',
        armour: '#fff', arms: '#1a5a1a',
        eyeColor: '#44ff44', eyeEnraged: '#00ff00',
        platform: '#2a4a2a', ground: '#1a3a1a',
        feature: 'goalkeeper', // gloves, goalposts
    },
    4: { // The Forest Guardian — brown/green ancient tree spirit
        bg: ['#0a1a08', '#1a2e10', '#0a1208'],
        body: '#4a3018', bodyHit: '#aa8844', bodyEnraged: '#2a1808',
        head: '#3a2810', headHit: '#886633',
        armour: '#2a5a1a', arms: '#3a2010',
        eyeColor: '#88ff44', eyeEnraged: '#44ff00',
        platform: '#3a4a20', ground: '#2a3a1a',
        feature: 'guardian', // bark texture, leaves
    },
    5: { // The Prime Monster — dark suit, red tie, Big Ben backdrop
        bg: ['#1a1a2e', '#2a2a3e', '#1a1a20'],
        body: '#1a1a2a', bodyHit: '#ff4444', bodyEnraged: '#0a0a1a',
        head: '#3a2a2a', headHit: '#ff6666',
        armour: '#333344', arms: '#1a1a2a',
        eyeColor: '#ff0000', eyeEnraged: '#ff0044',
        platform: '#3a3a4a', ground: '#2a2a3a',
        feature: 'prime', // suit, red tie, crown
    },
};

function getBossTheme() {
    return BOSS_THEMES[currentLevel] || BOSS_THEMES[1];
}

function drawBossFight() {
    const theme = getBossTheme();
    // Dark arena background
    const grad = ctx.createLinearGradient(0, 0, 0, SCREEN_H);
    grad.addColorStop(0, theme.bg[0]);
    grad.addColorStop(0.5, theme.bg[1]);
    grad.addColorStop(1, theme.bg[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    // Lightning flashes during phase 3
    if (boss.phase === 3 && Math.random() < 0.03) {
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    }

    // Arena platforms
    for (const p of bossplatforms) {
        if (p.type === 'ground') {
            ctx.fillStyle = theme.ground;
            ctx.fillRect(p.x, p.y, p.width, p.height);
            ctx.fillStyle = '#444';
            ctx.fillRect(p.x, p.y, p.width, 3);
        } else {
            ctx.fillStyle = theme.platform;
            ctx.fillRect(p.x, p.y, p.width, p.height);
        }
    }

    // THE BOMBARDER
    if (boss.alive) {
        const bx = boss.x;
        const by = boss.y;
        const isHit = boss.hitFlash > 0;

        ctx.save();

        // Massive body
        const bodyColor = isHit ? theme.bodyHit : (boss.phase === 3 ? theme.bodyEnraged : theme.body);
        ctx.fillStyle = bodyColor;
        ctx.fillRect(bx + 20, by + 80, 160, 320);

        // Armour plating
        ctx.fillStyle = isHit ? theme.bodyHit : theme.armour;
        for (let ay = by + 100; ay < by + 380; ay += 40) {
            ctx.fillRect(bx + 25, ay, 150, 5);
        }

        // Theme-specific body decorations
        if (theme.feature === 'knight') {
            // Shield emblem on chest
            ctx.fillStyle = '#4466aa';
            ctx.beginPath(); ctx.moveTo(bx + 80, by + 130); ctx.lineTo(bx + 120, by + 130); ctx.lineTo(bx + 100, by + 180); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#ffcc00';
            ctx.font = '16px Segoe UI'; ctx.textAlign = 'center'; ctx.fillText('⚔', bx + 100, by + 160); ctx.textAlign = 'left';
        } else if (theme.feature === 'goalkeeper') {
            // Number on back, stripe
            ctx.fillStyle = '#fff';
            ctx.fillRect(bx + 30, by + 160, 140, 4);
            ctx.font = 'bold 40px Segoe UI'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText('1', bx + 100, by + 230); ctx.textAlign = 'left';
        } else if (theme.feature === 'guardian') {
            // Bark texture
            ctx.strokeStyle = '#2a1a08';
            ctx.lineWidth = 2;
            for (let by2 = by + 100; by2 < by + 380; by2 += 25) {
                ctx.beginPath(); ctx.moveTo(bx + 30, by2); ctx.bezierCurveTo(bx + 60, by2 - 5, bx + 140, by2 + 5, bx + 170, by2); ctx.stroke();
            }
            // Leaves on shoulders
            ctx.fillStyle = '#3a8a2a';
            ctx.beginPath(); ctx.ellipse(bx + 30, by + 90, 20, 10, -0.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(bx + 170, by + 90, 20, 10, 0.5, 0, Math.PI * 2); ctx.fill();
        } else if (theme.feature === 'prime') {
            // Suit jacket, red tie
            ctx.fillStyle = '#aa1111';
            ctx.fillRect(bx + 92, by + 100, 16, 120); // tie
            ctx.beginPath(); ctx.moveTo(bx + 85, by + 220); ctx.lineTo(bx + 100, by + 240); ctx.lineTo(bx + 115, by + 220); ctx.closePath(); ctx.fill();
            // Lapels
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(bx + 60, by + 90); ctx.lineTo(bx + 92, by + 170); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bx + 140, by + 90); ctx.lineTo(bx + 108, by + 170); ctx.stroke();
        }

        // Head
        ctx.fillStyle = isHit ? theme.headHit : theme.head;
        ctx.beginPath();
        ctx.arc(bx + 100, by + 50, 55, 0, Math.PI * 2);
        ctx.fill();

        // Theme-specific head features
        if (theme.feature === 'knight') {
            // Helmet visor
            ctx.fillStyle = '#555566';
            ctx.fillRect(bx + 65, by + 30, 70, 15);
            ctx.fillStyle = '#333';
            for (let vx = bx + 70; vx < bx + 130; vx += 10) ctx.fillRect(vx, by + 32, 3, 11);
        } else if (theme.feature === 'guardian') {
            // Antlers/branches on head
            ctx.strokeStyle = '#5a3018';
            ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(bx + 60, by + 15); ctx.lineTo(bx + 40, by - 15); ctx.lineTo(bx + 30, by - 25); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bx + 140, by + 15); ctx.lineTo(bx + 160, by - 15); ctx.lineTo(bx + 170, by - 25); ctx.stroke();
        } else if (theme.feature === 'prime') {
            // Slicked-back hair
            ctx.fillStyle = '#222';
            ctx.beginPath(); ctx.ellipse(bx + 100, by + 20, 50, 20, 0, Math.PI, Math.PI * 2); ctx.fill();
        }

        // FIERCE EYES — glowing
        const eyeIntensity = boss.eyeGlow;
        ctx.shadowColor = boss.phase === 3 ? theme.eyeEnraged : theme.eyeColor;
        ctx.shadowBlur = 20 * eyeIntensity;
        ctx.fillStyle = `rgba(255, ${boss.phase === 3 ? 0 : 50}, 0, ${eyeIntensity})`;
        // Left eye
        ctx.beginPath(); ctx.ellipse(bx + 78, by + 42, 14, 8, -0.2, 0, Math.PI * 2); ctx.fill();
        // Right eye
        ctx.beginPath(); ctx.ellipse(bx + 122, by + 42, 14, 8, 0.2, 0, Math.PI * 2); ctx.fill();
        // Pupils
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(bx + 78, by + 42, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(bx + 122, by + 42, 4, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        // Angry brows
        ctx.strokeStyle = isHit ? '#ff0000' : '#1a0000';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(bx + 60, by + 28); ctx.lineTo(bx + 88, by + 35); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bx + 140, by + 28); ctx.lineTo(bx + 112, by + 35); ctx.stroke();

        // Mouth — snarling
        ctx.strokeStyle = '#ff2222';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(bx + 75, by + 65);
        for (let t = 0; t < 8; t++) { ctx.lineTo(bx + 75 + t * 7, by + 65 + (t % 2 === 0 ? 5 : -3)); }
        ctx.stroke();

        // SEALED GOOD LUCK CHARM (Phase 1)
        if (!boss.charmBroken) {
            const charmX = bx + 100;
            const charmY = by + 200;
            const pulse = 0.8 + Math.sin(frameTime * 0.005) * 0.2;

            // Shield glow
            ctx.strokeStyle = `rgba(241, 196, 15, ${pulse})`;
            ctx.lineWidth = 3;
            ctx.shadowColor = '#f1c40f';
            ctx.shadowBlur = 20;
            ctx.beginPath(); ctx.arc(charmX, charmY, 35, 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0;

            // Charm body
            ctx.fillStyle = '#f1c40f';
            ctx.beginPath();
            ctx.moveTo(charmX, charmY - 25);
            ctx.lineTo(charmX + 20, charmY - 5);
            ctx.lineTo(charmX + 12, charmY + 20);
            ctx.lineTo(charmX - 12, charmY + 20);
            ctx.lineTo(charmX - 20, charmY - 5);
            ctx.closePath();
            ctx.fill();

            // Charm symbol
            ctx.fillStyle = '#e67e22';
            ctx.font = 'bold 18px Segoe UI';
            ctx.textAlign = 'center';
            ctx.fillText('★', charmX, charmY + 7);
            ctx.textAlign = 'left';

            // Charm health bar
            ctx.fillStyle = '#333';
            ctx.fillRect(charmX - 30, charmY + 30, 60, 6);
            ctx.fillStyle = '#f1c40f';
            ctx.fillRect(charmX - 30, charmY + 30, 60 * (boss.charmHealth / boss.maxCharmHealth), 6);
        } else {
            // Broken charm fragments
            ctx.fillStyle = 'rgba(241, 196, 15, 0.3)';
            ctx.fillRect(bx + 85, by + 190, 8, 8);
            ctx.fillRect(bx + 105, by + 195, 6, 6);
            ctx.fillRect(bx + 95, by + 210, 7, 7);
        }

        // Arms / blasters
        ctx.fillStyle = isHit ? theme.bodyHit : theme.arms;
        ctx.fillRect(bx - 20, by + 120, 30, 80);
        ctx.fillRect(bx + 190, by + 120, 30, 80);
        // Blaster tips
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(bx - 25, by + 140, 10, 20);
        ctx.fillRect(bx + 215, by + 140, 10, 20);

        // Goalkeeper gloves
        if (theme.feature === 'goalkeeper') {
            ctx.fillStyle = '#f1c40f';
            ctx.fillRect(bx - 28, by + 130, 18, 30);
            ctx.fillRect(bx + 210, by + 130, 18, 30);
        }

        // Legs
        ctx.fillStyle = isHit ? theme.headHit : theme.head;
        ctx.fillRect(bx + 30, by + 390, 50, 60);
        ctx.fillRect(bx + 120, by + 390, 50, 60);

        ctx.restore();
    }

    // Boss projectiles — themed per level
    for (const l of bossLasers) {
        const pt = l.projType || 'laser';
        if (l.spin !== undefined) l.spin += 0.15; // rotate spinning projectiles

        if (l.isBeam) {
            // Horizontal beam/charge attacks
            ctx.save();
            ctx.shadowColor = l.color;
            ctx.shadowBlur = 15;
            if (pt === 'sword') {
                // Lance — long silver bar with pointed tip
                ctx.fillStyle = '#aaa';
                ctx.fillRect(l.x - 180, l.y - 3, 180, 6);
                ctx.fillStyle = l.color;
                ctx.beginPath(); ctx.moveTo(l.x - 180, l.y - 8); ctx.lineTo(l.x - 195, l.y); ctx.lineTo(l.x - 180, l.y + 8); ctx.fill();
            } else if (pt === 'ball') {
                // Diving goalkeeper — green streak
                ctx.fillStyle = '#2ecc71';
                ctx.fillRect(l.x - 150, l.y - 8, 150, 16);
                ctx.fillStyle = '#f1c40f';
                ctx.beginPath(); ctx.arc(l.x - 150, l.y, 10, 0, Math.PI * 2); ctx.fill(); // glove
            } else if (pt === 'nature') {
                // Root — brown jagged line
                ctx.strokeStyle = l.color;
                ctx.lineWidth = 6;
                ctx.beginPath(); ctx.moveTo(l.x, l.y);
                for (let rx = l.x; rx > l.x - 180; rx -= 20) ctx.lineTo(rx, l.y + Math.sin(frameTime * 0.01 + rx * 0.3) * 6);
                ctx.stroke();
            } else if (pt === 'office') {
                // Red tape — literally red tape ribbon
                ctx.fillStyle = '#cc0000';
                ctx.fillRect(l.x - 200, l.y - 4, 200, 8);
                ctx.fillStyle = '#fff';
                ctx.font = '8px Segoe UI'; ctx.textAlign = 'center';
                ctx.fillText('RED TAPE', l.x - 100, l.y + 3);
                ctx.textAlign = 'left';
            } else {
                // Default laser beam
                ctx.fillStyle = l.color;
                ctx.fillRect(l.x - 200, l.y - 5, 200, 10);
            }
            ctx.shadowBlur = 0;
            ctx.restore();

        } else if (l.isSlam) {
            // Ground shockwave — themed
            ctx.fillStyle = l.color;
            ctx.shadowColor = l.color;
            ctx.shadowBlur = 10;
            if (pt === 'nature') {
                // Root erupting from ground
                ctx.fillRect(l.x - 4, l.y - 15, 8, 20);
                ctx.fillStyle = '#3a8a2a';
                ctx.beginPath(); ctx.ellipse(l.x, l.y - 18, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
            } else if (pt === 'office') {
                // Papers flying up from ground
                ctx.fillStyle = '#f5f5dc';
                ctx.save();
                ctx.translate(l.x, l.y);
                ctx.rotate((l.spin || 0));
                ctx.fillRect(-6, -8, 12, 16);
                ctx.strokeStyle = '#888'; ctx.lineWidth = 0.5;
                for (let ty = -5; ty < 6; ty += 3) ctx.strokeRect(-4, ty, 8, 1);
                ctx.restore();
            } else {
                // Default jagged flame
                ctx.beginPath();
                ctx.moveTo(l.x - 8, l.y + 10);
                ctx.lineTo(l.x - 3, l.y - 8);
                ctx.lineTo(l.x + 3, l.y - 4);
                ctx.lineTo(l.x + 8, l.y - 12);
                ctx.lineTo(l.x + 12, l.y + 10);
                ctx.closePath();
                ctx.fill();
            }
            ctx.shadowBlur = 0;

        } else {
            // Regular projectiles — themed shapes
            ctx.save();
            ctx.shadowColor = l.color;
            ctx.shadowBlur = 8;
            const sz = l.isBig ? 10 : 6;

            if (pt === 'sword') {
                // Spinning sword / dagger
                ctx.translate(l.x, l.y);
                ctx.rotate(l.spin || 0);
                ctx.fillStyle = '#aaa'; // blade
                ctx.fillRect(-sz, -2, sz * 2, 4);
                ctx.fillStyle = '#8B4513'; // handle
                ctx.fillRect(-3, -4, 6, 8);
                ctx.fillStyle = l.color; // crossguard
                ctx.fillRect(-sz * 0.6, -1, sz * 1.2, 2);

            } else if (pt === 'ball') {
                // Football (soccer ball)
                ctx.translate(l.x, l.y);
                ctx.rotate(l.spin || 0);
                ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.arc(0, 0, sz, 0, Math.PI * 2); ctx.fill();
                // Pentagon pattern
                ctx.fillStyle = '#333';
                ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const a = (i * Math.PI * 2 / 5) - Math.PI / 2;
                    const method = i === 0 ? 'moveTo' : 'lineTo';
                    ctx[method](Math.cos(a) * sz * 0.5, Math.sin(a) * sz * 0.5);
                }
                ctx.closePath(); ctx.fill();

            } else if (pt === 'nature') {
                // Leaf / thorn / acorn
                ctx.translate(l.x, l.y);
                ctx.rotate(l.spin || 0);
                if (l.isBig) {
                    // Thorny branch chunk
                    ctx.fillStyle = '#5a3a1a';
                    ctx.fillRect(-sz, -3, sz * 2, 6);
                    ctx.fillStyle = '#3a8a2a';
                    ctx.beginPath(); ctx.ellipse(sz * 0.5, -4, 5, 3, 0.3, 0, Math.PI * 2); ctx.fill();
                } else {
                    // Spinning leaf
                    ctx.fillStyle = l.color;
                    ctx.beginPath();
                    ctx.ellipse(0, 0, sz, sz * 0.4, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#2a5a1a'; ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.moveTo(-sz, 0); ctx.lineTo(sz, 0); ctx.stroke();
                }

            } else if (pt === 'office') {
                // Briefcase / money / paper
                ctx.translate(l.x, l.y);
                ctx.rotate(l.spin || 0);
                if (l.isBig) {
                    // Briefcase
                    ctx.fillStyle = '#5a3a1a';
                    ctx.fillRect(-sz, -sz * 0.7, sz * 2, sz * 1.4);
                    ctx.fillStyle = '#f1c40f'; // gold clasp
                    ctx.fillRect(-2, -sz * 0.7 - 1, 4, 3);
                    ctx.fillStyle = '#333'; // handle
                    ctx.fillRect(-4, -sz * 0.7 - 4, 8, 3);
                } else {
                    // Spinning money / paper (use position as stable seed)
                    if ((Math.floor(l.x * 7 + l.y * 13) % 2) === 0) {
                        // Green banknote
                        ctx.fillStyle = '#85bb65';
                        ctx.fillRect(-sz, -sz * 0.5, sz * 2, sz);
                        ctx.fillStyle = '#4a7a3a';
                        ctx.font = (sz) + 'px Segoe UI'; ctx.textAlign = 'center';
                        ctx.fillText('£', 0, sz * 0.3);
                        ctx.textAlign = 'left';
                    } else {
                        // White paper sheet
                        ctx.fillStyle = '#f5f5dc';
                        ctx.fillRect(-sz, -sz * 0.7, sz * 2, sz * 1.4);
                        ctx.strokeStyle = '#999'; ctx.lineWidth = 0.5;
                        for (let ty = -sz * 0.4; ty < sz * 0.5; ty += 3) ctx.strokeRect(-sz * 0.7, ty, sz * 1.4, 1);
                    }
                }

            } else {
                // Default laser orb
                ctx.fillStyle = l.color;
                ctx.beginPath(); ctx.arc(l.x, l.y, sz, 0, Math.PI * 2); ctx.fill();
            }

            ctx.shadowBlur = 0;
            ctx.restore();
        }
    }

    // Player projectiles
    drawProjectiles();

    // Visual effects
    drawVisualEffects();

    // Active companion
    drawActiveCompanion();

    // Player
    drawPlayer(player);

    // Boss HUD
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    const bossDisplayName = getCurrentLevel().bossName.toUpperCase();
    ctx.fillText(bossDisplayName, SCREEN_W / 2, 25);

    // Boss health bar
    const barW = 300;
    const barX = (SCREEN_W - barW) / 2;
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, 35, barW, 12);
    if (boss.charmBroken) {
        const hpRatio = boss.health / boss.maxHealth;
        ctx.fillStyle = hpRatio > 0.5 ? '#e74c3c' : (hpRatio > 0.3 ? '#e67e22' : '#c0392b');
        ctx.fillRect(barX, 35, barW * hpRatio, 12);
    } else {
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(barX, 35, barW * (boss.charmHealth / boss.maxCharmHealth), 12);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '10px Segoe UI';
        ctx.fillText('BREAK THE CHARM!', SCREEN_W / 2, 44);
    }

    // Phase indicator
    ctx.fillStyle = '#aaa';
    ctx.font = '12px Segoe UI, sans-serif';
    const phaseText = boss.phase === 1 ? 'Phase 1 — Sealed' : (boss.phase === 2 ? 'Phase 2 — Vulnerable' : 'Phase 3 — ENRAGED');
    ctx.fillText(phaseText, SCREEN_W / 2, 62);
    ctx.textAlign = 'left';

    // Player hearts
    drawHUDHearts();

    // Weapons collected indicator
    if (weaponsCollected > 0) {
        ctx.fillStyle = '#f39c12';
        ctx.font = '12px Segoe UI, sans-serif';
        ctx.fillText('🔥 ×' + weaponsCollected + ' damage boost', 15, 50);
    }
}

// ============================================================
// RESTART
// ============================================================
function startLevel(levelNum) {
    currentLevel = levelNum;
    player.x = 80;
    player.y = 300;
    player.vx = 0;
    player.vy = 0;
    player.health = player.maxHealth; // keep upgraded health
    player.isAttacking = false;
    player.attackTimer = 0;
    player.attackCooldown = 0;
    player.invincible = 60;
    player.onGround = false;
    player.jumps = 0;
    player.jumpKeyHeld = false;
    player.specialCooldown = 0; player.specialActive = 0; player.specialType = null; player._specialHeld = false;
    cameraX = 0;
    // Recreate enemies/collectibles (same layout, scaled by level difficulty)
    enemies = createEnemies();
    projectiles = [];
    enemyLasers = [];
    bossLasers = [];
    stickers = createStickers();
    hearts = createHearts();
    // Keep stickersCollected from previous levels (RPG progression)
    weaponPickups = createWeaponPickups();
    weaponsCollected = 0;
    player.rangedAmmo = 0;
    companionPickups = createCompanionPickups();
    activeCompanion = null;
    companionCooldown = 0;
    visualEffects = [];
    particles = [];
    ambientParticles = [];
    screenShake = { x: 0, y: 0, intensity: 0, timer: 0 };
    currentStage = 1;
    previousStage = 1;
    enemiesDefeated = 0; stageKillCounts = [0, 0, 0, 0];
    gameEndTime = 0;
    gameStartTime = Date.now();
    initAmbientParticles();
    stageIntroTimer = STAGE_INTRO_DURATION;
    gameState = 'stage_intro';
}

function restart() {
    player.x = 80;
    player.y = 300;
    player.vx = 0;
    player.vy = 0;
    player.health = player.maxHealth;
    player.isAttacking = false;
    player.attackTimer = 0;
    player.attackCooldown = 0;
    player.invincible = 0;
    player.onGround = false;
    player.jumps = 0;
    player.jumpKeyHeld = false;
    player.specialCooldown = 0; player.specialActive = 0; player.specialType = null; player._specialHeld = false;
    cameraX = 0;
    enemies = createEnemies();
    projectiles = [];
    enemyLasers = [];
    bossLasers = [];
    stickers = createStickers();
    hearts = createHearts();
    stickersCollected = 0;
    weaponPickups = createWeaponPickups();
    weaponsCollected = 0;
    player.rangedAmmo = 0;
    companionPickups = createCompanionPickups();
    activeCompanion = null;
    companionCooldown = 0;
    visualEffects = [];
    particles = [];
    ambientParticles = [];
    screenShake = { x: 0, y: 0, intensity: 0, timer: 0 };
    currentStage = 1;
    previousStage = 1;
    enemiesDefeated = 0; stageKillCounts = [0, 0, 0, 0];
    resetUpgrades();
    player.speed = 4;
    currentLevel = 1;
    gameEndTime = 0;
    wonScreenDelay = undefined;
    lostMessage = '';
    titleTimer = 0;
    gameState = 'title';
    startMusic('title');
}

// ============================================================
// GAME LOOP
// ============================================================
// Character select input
let selectKeyHeld = false;
let diffKeyHeld = false;
let muteKeyHeld = false;
let musicKeyHeld = false;
let shopEnterHeld = false;
let shopContinueHeld = false;

let frameTime = Date.now(); // updated once per frame for consistent timing

function gameLoop() {
  try {
    frameTime = Date.now();
    pollGamepad(); // check controller input each frame
    ctx.clearRect(0, 0, SCREEN_W, SCREEN_H);
    updateScreenShake();
    updateParticles();

    // Apply screen shake offset
    ctx.save();
    ctx.translate(screenShake.x, screenShake.y);

    // --- PAUSE toggle (works during playing and boss) ---
    if (keys['Escape'] && !pauseKeyHeld) {
        pauseKeyHeld = true;
        if (gameState === 'playing' || gameState === 'boss' || gameState === 'vs_playing') {
            pausedFromState = gameState;
            gameState = 'paused';
            stopMusic();
        } else if (gameState === 'paused') {
            gameState = pausedFromState;
            if (pausedFromState === 'vs_playing') { /* no music in vs for now */ }
            else if (pausedFromState === 'boss') startMusic('boss');
            else startMusic(currentStage);
        }
    }
    if (!keys['Escape']) pauseKeyHeld = false;

    // --- Mute toggle (M = all sound, N = music only) ---
    if (keys['KeyM'] && !muteKeyHeld) {
        muteKeyHeld = true;
        toggleSound();
    }
    if (!keys['KeyM']) muteKeyHeld = false;
    if (keys['KeyN'] && !musicKeyHeld) {
        musicKeyHeld = true;
        toggleMusic();
    }
    if (!keys['KeyN']) musicKeyHeld = false;

    // ===== TITLE SCREEN =====
    if (gameState === 'title') {
        drawTitleScreen();
        // Navigate mode selection
        if ((keys['ArrowUp'] || keys['KeyW']) && !titleKeyHeld) {
            titleCursor = (titleCursor - 1 + 3) % 3;
            titleKeyHeld = true;
        } else if ((keys['ArrowDown'] || keys['KeyS']) && !titleKeyHeld) {
            titleCursor = (titleCursor + 1) % 3;
            titleKeyHeld = true;
        }
        if (!(keys['ArrowUp'] || keys['KeyW'] || keys['ArrowDown'] || keys['KeyS'])) titleKeyHeld = false;
        // Daddy Mode: left/right to cycle daddies
        if (titleCursor === 2) {
            if ((keys['ArrowLeft'] || keys['KeyA']) && !daddyKeyHeld) {
                daddyModeIndex = (daddyModeIndex - 1 + DADDY_MODES.length) % DADDY_MODES.length;
                daddyKeyHeld = true;
            } else if ((keys['ArrowRight'] || keys['KeyD']) && !daddyKeyHeld) {
                daddyModeIndex = (daddyModeIndex + 1) % DADDY_MODES.length;
                daddyKeyHeld = true;
            }
            if (!(keys['ArrowLeft'] || keys['KeyA'] || keys['ArrowRight'] || keys['KeyD'])) daddyKeyHeld = false;
        }
        if (keys['Enter'] && !titleConfirmHeld) {
            titleConfirmHeld = true;
            if (titleCursor === 2) {
                // Daddy Selection — no action on Enter/X, use ←/→ to cycle
            } else if (titleCursor === 0) {
                gameMode = 'solo';
                selectConfirmHeld = true; // prevent Enter carrying over to select screen
                gameState = 'select';
            } else {
                gameMode = 'vs';
                vsP1Ready = false;
                vsP2Ready = false;
                vsConfirmHeld = true; // prevent X/Space carrying over
                vsP2ConfirmHeld = true; // prevent Enter carrying over to P2
                p1DiffKeyHeld = false;
                p2DiffKeyHeld = false;
                p1Difficulty = 'child';
                p2Difficulty = 'child';
                p1Character = 'heath';
                p2Character = 'charlie';
                gameState = 'vs_select';
            }
        }
        if (!keys['Enter']) titleConfirmHeld = false;

    // ===== CHARACTER SELECT =====
    } else if (gameState === 'select') {
        drawCharacterSelect();
        // Navigate character selection (left/right cycles through all characters)
        if ((keys['ArrowLeft'] || keys['KeyA']) && !selectKeyHeld) {
            selectedCharacter = prevChar(selectedCharacter);
            selectKeyHeld = true;
        } else if ((keys['ArrowRight'] || keys['KeyD']) && !selectKeyHeld) {
            selectedCharacter = nextChar(selectedCharacter);
            selectKeyHeld = true;
        }
        if (!(keys['ArrowLeft'] || keys['KeyA'] || keys['ArrowRight'] || keys['KeyD'])) {
            selectKeyHeld = false;
        }
        // Navigate difficulty (up/down)
        if ((keys['ArrowUp'] || keys['KeyW']) && !diffKeyHeld) {
            difficulty = 'child';
            diffKeyHeld = true;
        } else if ((keys['ArrowDown'] || keys['KeyS']) && !diffKeyHeld) {
            difficulty = 'adult';
            diffKeyHeld = true;
        }
        if (!(keys['ArrowUp'] || keys['KeyW'] || keys['ArrowDown'] || keys['KeyS'])) {
            diffKeyHeld = false;
        }
        // Control type toggle (Tab or Share/Options on controller)
        if ((keys['Tab'] || keys['KeyR']) && !controlToggleHeld) {
            p1ControlType = p1ControlType === 'controller' ? 'keyboard' : 'controller';
            controlToggleHeld = true;
        }
        if (!(keys['Tab'] || keys['KeyR'])) controlToggleHeld = false;
        // Release guard — wait for Enter/X to be released before accepting
        if (!keys['Enter']) selectConfirmHeld = false;
        // Start game — go to level select if multiple levels unlocked
        if (keys['Enter'] && !selectConfirmHeld) {
            resetUpgrades();
            const d = getDifficulty();
            player.health = d.playerHealth;
            player.maxHealth = d.playerHealth;
            if (levelsUnlocked > 1) {
                levelSelectCursor = 0;
                levelSelectKeyHeld = true; // prevent immediate input
                gameState = 'level_select';
            } else {
                currentLevel = 1;
                enemies = createEnemies();
                stickers = createStickers();
                hearts = createHearts();
                stickersCollected = 0;
                weaponsCollected = 0;
                player.rangedAmmo = 0;
                enemiesDefeated = 0; stageKillCounts = [0, 0, 0, 0];
                gameStartTime = Date.now();
                previousStage = 1;
                currentStage = 1;
                stageIntroTimer = STAGE_INTRO_DURATION;
                gameState = 'stage_intro';
            }
        }
        // Back to title
        if (keys['Escape'] && !vsBackKeyHeld) { vsBackKeyHeld = true; startMusic('title'); gameState = 'title'; }
        if (!keys['Escape']) vsBackKeyHeld = false;

    // ===== LEVEL SELECT =====
    } else if (gameState === 'level_select') {
        drawLevelSelect();
        // Navigate levels
        if ((keys['ArrowLeft'] || keys['KeyA']) && !levelSelectKeyHeld) {
            levelSelectCursor = Math.max(0, levelSelectCursor - 1);
            levelSelectKeyHeld = true;
        } else if ((keys['ArrowRight'] || keys['KeyD']) && !levelSelectKeyHeld) {
            levelSelectCursor = Math.min(TOTAL_LEVELS - 1, levelSelectCursor + 1);
            levelSelectKeyHeld = true;
        }
        if (!(keys['ArrowLeft'] || keys['KeyA'] || keys['ArrowRight'] || keys['KeyD'])) {
            levelSelectKeyHeld = false;
        }
        // Select level (must be unlocked)
        if (keys['Enter'] && !levelSelectKeyHeld) {
            const chosen = levelSelectCursor + 1;
            if (chosen <= levelsUnlocked) {
                currentLevel = chosen;
                startLevel(currentLevel);
            }
        }
        // Go back
        if (keys['Escape']) {
            gameState = 'select';
        }

    // ===== STAGE COMPLETE =====
    } else if (gameState === 'stage_complete') {
        // Draw frozen game behind
        drawBackground();
        drawPlatforms();
        drawStickers();
        drawWeaponPickups();
        drawCompanionPickups();
        drawHearts();
        for (const e of enemies) drawEnemy(e);
        drawPlayer(player);
        drawForegroundLayer();
        drawHUD();
        drawStageComplete();
        stageCompleteTimer--;
        if (stageCompleteTimer <= 0 && keys['Enter']) {
            shopCursor = 0;
            gameState = 'shop';
        }

    // ===== UPGRADE SHOP =====
    } else if (gameState === 'shop') {
        drawUpgradeShop();
        const items = getShopItems();

        // Navigate
        if ((keys['ArrowUp'] || keys['KeyW']) && !shopKeyHeld) {
            shopCursor = (shopCursor - 1 + items.length) % items.length;
            shopKeyHeld = true;
        } else if ((keys['ArrowDown'] || keys['KeyS']) && !shopKeyHeld) {
            shopCursor = (shopCursor + 1) % items.length;
            shopKeyHeld = true;
        }
        if (!(keys['ArrowUp'] || keys['KeyW'] || keys['ArrowDown'] || keys['KeyS'])) {
            shopKeyHeld = false;
        }

        // Purchase
        if (keys['Enter'] && !shopEnterHeld) {
            shopEnterHeld = true;
            const key = items[shopCursor];
            purchaseUpgrade(key);
        }
        if (!keys['Enter']) shopEnterHeld = false;

        // Continue to next stage
        if (keys['KeyC'] && !shopContinueHeld) {
            shopContinueHeld = true;
            stageIntroTimer = STAGE_INTRO_DURATION;
            gameState = 'stage_intro';
        }
        if (!keys['KeyC']) shopContinueHeld = false;

    // ===== STAGE INTRO =====
    } else if (gameState === 'stage_intro') {
        stageIntroTimer--;
        drawStageIntro();
        drawPlayer(player);
        if (stageIntroTimer <= 0) {
            gameState = 'playing';
            // Reset player state for clean start on new stage
            player.jumpKeyHeld = false;
            player.jumps = 0;
            player.onGround = true;
            player.isAttacking = false;
            player.attackCooldown = 0;
            player._specialHeld = false;
            player._rangedHeld = false;
            player.vy = 0;
            startMusic(currentStage, currentStage === 1);
        }

    // ===== PLAYING =====
    } else if (gameState === 'playing') {
        updatePlayer();
        updateEnemies();
        updateEnemyLasers();
        updateProjectiles();
        updateCollectibles();
        updateVisualEffects();
        updateAmbientParticles();
        updateCamera();

        drawBackground();
        drawPlatforms();
        drawStickers();
        drawWeaponPickups();
        drawCompanionPickups();
        drawHearts();
        for (const e of enemies) drawEnemy(e);
        drawEnemyLasers();
        drawProjectiles();
        drawVisualEffects();
        drawWinFlag();
        drawActiveCompanion();
        drawPlayer(player);
        drawForegroundLayer();
        drawParticles();
        drawHUD();

    // ===== PAUSED =====
    } else if (gameState === 'paused') {
        // Draw the game frozen behind the pause overlay
        if (pausedFromState === 'boss') {
            drawBossFight();
        } else {
            drawBackground();
            drawPlatforms();
            drawStickers();
            drawWeaponPickups();
            drawCompanionPickups();
            drawHearts();
            for (const e of enemies) drawEnemy(e);
            drawEnemyLasers();
            drawProjectiles();
            drawVisualEffects();
            drawWinFlag();
            drawActiveCompanion();
            drawPlayer(player);
            drawForegroundLayer();
            drawHUD();
        }
        drawPauseScreen();
        if (keys['KeyR']) restart();
        // Exit to main menu (Q on keyboard, Circle/O on controller maps to Escape but ESC toggles pause)
        if (keys['KeyQ'] && !pauseExitHeld) { pauseExitHeld = true; startMusic('title'); gameState = 'title'; }
        if (!keys['KeyQ']) pauseExitHeld = false;

    // ===== BOSS FIGHT =====
    } else if (gameState === 'boss') {
        updateBossFight();
        drawBossFight();
        drawParticles();

    // ===== WON =====
    } else if (gameState === 'won') {
        if (gameEndTime === 0) {
            gameEndTime = Date.now();
            // Unlock next level
            if (currentLevel < TOTAL_LEVELS) {
                levelsUnlocked = Math.max(levelsUnlocked, currentLevel + 1);
            }
            // Unlock mummy & daddy if beaten with Heath or Emilia
            if (selectedCharacter === 'heath' || selectedCharacter === 'emilia') {
                if (!unlockedCharacters.includes('mummy')) unlockedCharacters.push('mummy');
                if (!unlockedCharacters.includes('daddy')) unlockedCharacters.push('daddy');
            }
        }
        drawBossFight();
        drawWinScreen();
        if (wonScreenDelay === undefined) wonScreenDelay = 90;
        if (wonScreenDelay > 0) { wonScreenDelay--; }
        else {
            // ✕ / Enter / Space = next level, △ / R = replay, ○ / ESC = menu
            if ((keys['KeyR'] || keys['GamepadJump']) && !wonInputHeld) { wonInputHeld = true; restart(); }
            if ((keys['Enter'] || keys['Space']) && !wonInputHeld) {
                wonInputHeld = true;
                if (currentLevel < TOTAL_LEVELS) { currentLevel++; startLevel(currentLevel); }
            }
            if (!(keys['KeyR'] || keys['GamepadJump'] || keys['Enter'] || keys['Space'])) wonInputHeld = false;
            if ((keys['Escape'] || keys['KeyQ']) && !pauseExitHeld) { pauseExitHeld = true; startMusic('title'); gameState = 'title'; }
            if (!(keys['Escape'] || keys['KeyQ'])) pauseExitHeld = false;
        }

    // ===== LOST =====
    } else if (gameState === 'lost') {
        if (gameEndTime === 0) {
            gameEndTime = Date.now();
            lostScreenDelay = 90; // ~1.5s before accepting input
            const lostMsgs = ['Not bad! Try again?', 'You got this!', 'The Bombarder awaits...', 'One more go?', 'Nearly there!'];
            lostMessage = lostMsgs[Math.floor(Math.random() * lostMsgs.length)];
        }
        if (diedInBoss) {
            drawBossFight();
        } else {
            drawBackground();
            drawPlatforms();
            drawPlayer(player);
            drawForegroundLayer();
        }
        drawLoseScreen();
        if (lostScreenDelay > 0) { lostScreenDelay--; }
        else {
            // Only accept input after delay AND key must be freshly pressed
            if ((keys['KeyR'] || keys['Enter'] || keys['Space']) && !lostInputHeld) { lostInputHeld = true; restart(); }
            if (!(keys['KeyR'] || keys['Enter'] || keys['Space'])) lostInputHeld = false;
            if ((keys['Escape'] || keys['KeyQ']) && !pauseExitHeld) { pauseExitHeld = true; startMusic('title'); gameState = 'title'; }
            if (!(keys['Escape'] || keys['KeyQ'])) pauseExitHeld = false;
        }

    // ===== VS CHARACTER SELECT =====
    } else if (gameState === 'vs_select') {
        drawVsSelect();

        // P1 control type toggle (Tab)
        if (keys['Tab'] && !controlToggleHeld) {
            p1ControlType = p1ControlType === 'controller' ? 'keyboard' : 'controller';
            controlToggleHeld = true;
        }
        if (!keys['Tab']) controlToggleHeld = false;

        // P2 control type toggle (only when 2 controllers connected — Options on controller 2)
        // Handled in pollGamepad() via gp2 button 9

        // Release guards — wait for keys to be released before accepting
        if (!(keys['Space'] || keys['Enter'])) vsConfirmHeld = false;
        if (!(keys['Numpad0'] || keys['NumpadEnter'] || keys['Enter'] || keys['Space'])) vsP2ConfirmHeld = false;

        // P1 controls (WASD / controller D-pad → maps to WASD via gamepad code)
        if (!vsP1Ready) {
            if ((keys['KeyA']) && !selectKeyHeld) {
                p1Character = prevChar(p1Character);
                selectKeyHeld = true;
            } else if ((keys['KeyD']) && !selectKeyHeld) {
                p1Character = nextChar(p1Character);
                selectKeyHeld = true;
            }
            // P1 difficulty: W = child, S = adult, GamepadJump (△) = toggle
            if (keys['KeyW'] && !p1DiffKeyHeld) { p1Difficulty = 'child'; p1DiffKeyHeld = true; }
            if (keys['KeyS'] && !p1DiffKeyHeld) { p1Difficulty = 'adult'; p1DiffKeyHeld = true; }
            if (keys['GamepadJump'] && !p1DiffKeyHeld) { p1Difficulty = p1Difficulty === 'child' ? 'adult' : 'child'; p1DiffKeyHeld = true; }
            if (!(keys['KeyW'] || keys['KeyS'] || keys['GamepadJump'])) p1DiffKeyHeld = false;
            if ((keys['Space'] || keys['Enter']) && !vsConfirmHeld) { vsP1Ready = true; vsConfirmHeld = true; }
        } else {
            // P1 can un-ready with Circle/Escape/Backspace
            if (keys['Escape'] || keys['Backspace']) { vsP1Ready = false; vsBackKeyHeld = true; }
        }
        if (!(keys['KeyA'] || keys['KeyD'])) selectKeyHeld = false;

        // P2 controls (arrow keys + numpad/enter)
        if (!vsP2Ready) {
            if ((keys['ArrowLeft']) && !levelSelectKeyHeld) {
                p2Character = prevChar(p2Character);
                levelSelectKeyHeld = true;
            } else if ((keys['ArrowRight']) && !levelSelectKeyHeld) {
                p2Character = nextChar(p2Character);
                levelSelectKeyHeld = true;
            }
            if (!(keys['ArrowLeft'] || keys['ArrowRight'])) levelSelectKeyHeld = false;
            // P2 difficulty: ↑ = child, ↓ = adult
            if (keys['ArrowUp'] && !p2DiffKeyHeld) { p2Difficulty = 'child'; p2DiffKeyHeld = true; }
            if (keys['ArrowDown'] && !p2DiffKeyHeld) { p2Difficulty = 'adult'; p2DiffKeyHeld = true; }
            if (!(keys['ArrowUp'] || keys['ArrowDown'])) p2DiffKeyHeld = false;
            // P2 ready: NumpadEnter or Numpad0, or Enter/Space once P1 is already ready
            const p2ReadyKey = keys['NumpadEnter'] || keys['Numpad0'] || (vsP1Ready && (keys['Enter'] || keys['Space']));
            if (p2ReadyKey && !vsP2ConfirmHeld) { vsP2Ready = true; vsP2ConfirmHeld = true; }
        } else {
            // P2 can un-ready with Delete or NumpadDecimal or Backspace
            if (keys['Delete'] || keys['NumpadDecimal'] || keys['Backspace']) vsP2Ready = false;
        }

        // Both ready — start! (needs a fresh press after both are ready)
        if (vsP1Ready && vsP2Ready && (keys['Enter'] || keys['Space']) && !vsConfirmHeld && !vsP2ConfirmHeld) {
            selectedCharacter = p1Character; // for solo mode compatibility
            currentLevel = 1;
            initVsMode();
            gameState = 'vs_playing';
        }

        // Back — only if neither player is ready (Escape also un-readies P1)
        if (keys['Escape'] && !vsBackKeyHeld && !vsP1Ready && !vsP2Ready) { vsBackKeyHeld = true; startMusic('title'); gameState = 'title'; }
        if (!keys['Escape']) vsBackKeyHeld = false;

    // ===== VS PLAYING =====
    } else if (gameState === 'vs_playing') {
        // Update both players (skip dead players)
        if (player.health > 0) {
            updateVsPlayer(player, P1_KEYS, false);
            p1EnemiesDefeated += updateVsEnemies(p1Enemies, player, p1Projectiles, false);
            p1StickersCollected += updateVsCollectibles(p1Stickers, player);
            updateVsPickups(player, p1WeaponPickups, p1Hearts, p1CompanionPickups, false);
        }
        if (player2.health > 0) {
            updateVsPlayer(player2, P2_KEYS, true);
            p2EnemiesDefeated += updateVsEnemies(p2Enemies, player2, p2Projectiles, true);
            p2StickersCollected += updateVsCollectibles(p2Stickers, player2);
            updateVsPickups(player2, p2WeaponPickups, p2Hearts, p2CompanionPickups, true);
        }

        // Update stages based on position
        const newP1Stage = Math.min(4, Math.floor(player.x / STAGE_WIDTH) + 1);
        const newP2Stage = Math.min(4, Math.floor(player2.x / STAGE_WIDTH) + 1);

        // Ranged ammo refill on stage change (must check before updating stage vars)
        if (newP1Stage > p1Stage) player.rangedAmmo = 3;
        if (newP2Stage > p2Stage) player2.rangedAmmo = 3;

        if (newP1Stage >= p1Stage) p1Stage = newP1Stage;
        if (newP2Stage >= p2Stage) p2Stage = newP2Stage;

        // Update visual effects (claw marks, sound waves, etc.)
        updateVisualEffects();

        // Update VS enemy lasers
        for (let i = vsEnemyLasers.length - 1; i >= 0; i--) {
            const l = vsEnemyLasers[i];
            l.x += l.vx; l.y += l.vy;
            if (l.isPoo) l.vy += l.pooGravity;
            const target = l.owner === 2 ? player2 : player;
            if (target.invincible <= 0 && rectCollision({ x: l.x - 4, y: l.y - 4, width: 8, height: 8 }, target)) {
                if (!target.isBlocking) target.health--;
                target.invincible = target.isBlocking ? 30 : 60;
                sfxPlayerHurt();
                vsEnemyLasers.splice(i, 1);
                continue;
            }
            if (l.x < -50 || l.x > LEVEL_WIDTH + 50 || l.y > SCREEN_H + 50 || l.y < -50) {
                vsEnemyLasers.splice(i, 1);
            }
        }

        // Check if players reach the end flag
        const flagZone = { x: LEVEL_WIDTH - 100, y: 0, width: 100, height: SCREEN_H };
        if (!p1Finished && rectCollision(player, flagZone)) {
            p1Finished = true;
            p1FinishTime = Date.now();
        }
        if (!p2Finished && rectCollision(player2, flagZone)) {
            p2Finished = true;
            p2FinishTime = Date.now();
        }

        // Player death
        if (player.health <= 0 && !p1Finished) { p1Finished = true; p1FinishTime = 0; } // died = no time bonus
        if (player2.health <= 0 && !p2Finished) { p2Finished = true; p2FinishTime = 0; }

        // Update cameras (each half is halfW wide, centre player in view)
        const halfW = Math.floor(SCREEN_W / 2);
        const targetCam1 = player.x - halfW / 3;
        cameraX += (targetCam1 - cameraX) * 0.1;
        if (cameraX < 0) cameraX = 0;
        if (cameraX > LEVEL_WIDTH - halfW) cameraX = LEVEL_WIDTH - halfW;

        const targetCam2 = player2.x - halfW / 3;
        cameraX2 += (targetCam2 - cameraX2) * 0.1;
        if (cameraX2 < 0) cameraX2 = 0;
        if (cameraX2 > LEVEL_WIDTH - halfW) cameraX2 = LEVEL_WIDTH - halfW;

        // Update ambient particles
        updateAmbientParticles();

        // Draw split screen
        drawVsHalf(player, cameraX, p1Enemies, p1Stickers, p1Projectiles, p1Character, 1, p1StickersCollected, p1EnemiesDefeated, p1Stage, player.rangedAmmo, p1WeaponPickups, p1Hearts, p1CompanionPickups);
        drawVsHalf(player2, cameraX2, p2Enemies, p2Stickers, p2Projectiles, p2Character, 2, p2StickersCollected, p2EnemiesDefeated, p2Stage, player2.rangedAmmo, p2WeaponPickups, p2Hearts, p2CompanionPickups);

        // Centre divider (vertical)
        ctx.fillStyle = '#e94560';
        const divX = Math.floor(SCREEN_W / 2);
        ctx.fillRect(divX - 1, 0, 3, SCREEN_H);

        // Timer at top centre
        const elapsed = Math.floor((frameTime - vsStartTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.beginPath(); ctx.roundRect(divX - 28, 34, 56, 20, 6); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(mins + ':' + (secs < 10 ? '0' : '') + secs, divX, 49);
        ctx.textAlign = 'left';

        // Pause
        if (keys['Escape'] && !pauseKeyHeld) {
            pauseKeyHeld = true;
            gameState = 'paused';
            pausedFromState = 'vs_playing';
        }

        // Both finished — delay then go to results
        if (p1Finished && p2Finished) {
            if (!vsEndDelay) vsEndDelay = 120; // ~2 second delay
            vsEndDelay--;
            // Show "GAME OVER" overlay during delay
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fillRect(0, SCREEN_H / 2 - 20, SCREEN_W, 40);
            ctx.fillStyle = '#f1c40f';
            ctx.font = 'bold 24px Segoe UI, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('MATCH COMPLETE!', SCREEN_W / 2, SCREEN_H / 2 + 8);
            ctx.textAlign = 'left';
            if (vsEndDelay <= 0) {
                vsEndDelay = 0;
                vsConfirmHeld = true; // prevent immediate restart
                pauseExitHeld = true; // prevent immediate exit
                gameState = 'vs_results';
            }
        }

    // ===== VS RESULTS =====
    } else if (gameState === 'vs_results') {
        drawVsResults();
        if ((keys['Enter'] || keys['Space']) && !vsConfirmHeld) {
            vsConfirmHeld = true;
            initVsMode();
            gameState = 'vs_playing';
        }
        if (!(keys['Enter'] || keys['Space'])) vsConfirmHeld = false;
        if ((keys['Escape'] || keys['KeyQ']) && !pauseExitHeld) {
            pauseExitHeld = true;
            startMusic('title');
            gameState = 'title';
        }
        if (!(keys['Escape'] || keys['KeyQ'])) pauseExitHeld = false;
    }

    ctx.restore(); // end screen shake transform
  } catch (err) {
    // Show error on screen for mobile debugging
    ctx.restore();
    ctx.fillStyle = 'red';
    ctx.font = '14px monospace';
    ctx.fillText('ERROR: ' + err.message, 10, 30);
    ctx.fillText('at: ' + (err.stack || '').split('\n')[1], 10, 50);
    console.error('Game loop error:', err);
  }
    requestAnimationFrame(gameLoop);
}

// Start the game
gameLoop();
