/**
 * ============================================
 * ZEUS DASH - Full Game Engine
 * Sonic Dash Style 3-Lane Endless Runner
 * HTML5 Canvas 2.5D with Perspective
 * ============================================
 * Game by ZEUS & Danny
 * Contact: 09066760078 (ZEUS) | 08062285862 (Danny)
 * Version: 1.0
 * ============================================
 */

'use strict';

// ============================================
// 1. GAME CONFIGURATION
// ============================================
const CONFIG = {
    // 3-Lane System
    LANE_COUNT: 3,
    LANE_WIDTH: 130,

    // Physics
    GRAVITY: 0.55,
    JUMP_VEL: -11,
    DOUBLE_JUMP_VEL: -9.5,
    BASE_SPEED: 8,
    MAX_SPEED: 18,
    SPEED_INCREMENT: 0.0004,

    // Player
    PLAYER_W: 36,
    PLAYER_H: 54,
    MAX_LIVES: 3,
    MAX_HEALTH: 100,

    // Scoring
    SCORE_PER_DIST: 1,
    COIN_VALUE: 10,
    BOSS_BONUS: 1000,
    WIN_SCORE: 100000,

    // Boss Milestones
    BOSS_AT: [2000, 5000, 10000, 18000, 28000, 40000, 55000, 72000, 88000, 95000],

    // Power
    POWER_MAX: 100,
    POWER_REGEN: 0.04,
    DASH_COST: 30,
    SHIELD_COST: 0.15,
    STRIKE_COST: 35,

    // Rendering
    GROUND_RATIO: 0.78,

    // Audio
    SFX_VOLUME: 0.5,
    MUSIC_VOLUME: 0.25,
};

// ============================================
// 2. BOSS DEFINITIONS
// ============================================
const BOSSES = [
    { name: 'Medusa',     hp: 15, color: '#22c55e', icon: '🐍', atk: 1.5 },
    { name: 'Minotaur',   hp: 25, color: '#f59e0b', icon: '🐂', atk: 2.0 },
    { name: 'Hydra',      hp: 38, color: '#10b981', icon: '🐉', atk: 1.8 },
    { name: 'Cerberus',   hp: 50, color: '#ef4444', icon: '🐕', atk: 2.2 },
    { name: 'Cyclops',    hp: 65, color: '#8b5cf6', icon: '👁️', atk: 1.5 },
    { name: 'Titan Brontes', hp: 80, color: '#f97316', icon: '🗿', atk: 1.2 },
    { name: 'Typhon',     hp: 100, color: '#ec4899', icon: '🌪️', atk: 1.6 },
    { name: 'Kronos',     hp: 120, color: '#a855f7', icon: '⏳', atk: 1.4 },
    { name: 'Ares',       hp: 145, color: '#dc2626', icon: '⚔️', atk: 2.5 },
    { name: 'Daniel T',   hp: 200, color: '#fbbf24', icon: '👑', atk: 3.0 },
];

// ============================================
// 3. UTILITY
// ============================================
const U = {
    rand: (min, max) => Math.random() * (max - min) + min,
    randInt: (min, max) => Math.floor(U.rand(min, max + 1)),
    clamp: (v, mn, mx) => Math.max(mn, Math.min(mx, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    dist: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
    rectHit: (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y,
};

// ============================================
// 4. AUDIO ENGINE (Web Audio API)
// ============================================
class AudioFX {
    constructor() {
        this.ctx = null;
        this.ready = false;
    }

    init() {
        if (this.ready) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.master = this.ctx.createGain();
            this.master.gain.value = CONFIG.SFX_VOLUME;
            this.master.connect(this.ctx.destination);
            this.ready = true;
        } catch(e) { console.warn('Audio unavailable'); }
    }

    /** Play a simple tone */
    tone(freq, dur, type='sine', vol=0.25) {
        if (!this.ready) return;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type;
        o.frequency.value = freq;
        g.gain.setValueAtTime(vol, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        o.connect(g);
        g.connect(this.master);
        o.start();
        o.stop(this.ctx.currentTime + dur);
    }

    /** Sound effects */
    jump()      { this.tone(420, 0.10, 'square', 0.20); }
    dblJump()   { this.tone(620, 0.12, 'square', 0.18); }
    coin()      { this.tone(900, 0.07, 'sine', 0.12); }
    hit()       { this.tone(140, 0.18, 'sawtooth', 0.22); }
    dash()      { this.tone(200, 0.25, 'sawtooth', 0.20); setTimeout(()=>this.tone(420,0.15,'sine',0.15), 80); }
    shield()    { this.tone(520, 0.15, 'sine', 0.15); setTimeout(()=>this.tone(720,0.15,'sine',0.12), 90); }
    strike()    { this.tone(90, 0.35, 'sawtooth', 0.30); setTimeout(()=>this.tone(800,0.20,'square',0.18), 120); }
    bossWarn()  { this.tone(320, 0.12, 'square', 0.18); setTimeout(()=>this.tone(210,0.15,'square',0.18), 180); }
    victory()   { [523,659,784,1047].forEach((f,i)=>setTimeout(()=>this.tone(f,0.18,'sine',0.18), i*140)); }
    gameOver()  { [400,350,300,200].forEach((f,i)=>setTimeout(()=>this.tone(f,0.25,'sawtooth',0.20), i*180)); }
}

// ============================================
// 5. PARTICLE SYSTEM
// ============================================
class Particle {
    constructor(x,y,vx,vy,life,color,size) {
        this.x = x; this.y = y;
        this.vx = vx; this.vy = vy;
        this.life = life; this.max = life;
        this.color = color; this.s = size || 4;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        this.vy += 0.04; this.life--;
        this.s *= 0.97;
    }
    get alive() { return this.life > 0 && this.s > 0.5; }
    get alpha() { return this.life / this.max; }
}

class Particles {
    constructor() { this.list = []; }
    emit(x,y,n,color,speed,life,size) {
        for (let i=0; i<n; i++) {
            const a = U.rand(0, Math.PI*2);
            const sp = U.rand(speed*0.4, speed);
            this.list.push(new Particle(
                x+U.rand(-8,8), y+U.rand(-8,8),
                Math.cos(a)*sp, Math.sin(a)*sp-0.5,
                U.randInt(life*0.5, life), color, U.rand(size*0.5, size)
            ));
        }
    }
    update() { this.list.forEach(p=>p.update()); this.list = this.list.filter(p=>p.alive); }
    draw(ctx) {
        this.list.forEach(p => {
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.s, 0, Math.PI*2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }
    clear() { this.list = []; }
}

// ============================================
// 6. GAME STATE
// ============================================
const G = {
    // Screens
    screen: 'welcome',

    // Player
    player: {
        lane: 1,          // 0,1,2
        targetLane: 1,
        laneX: 0,         // actual X interpolated
        y: 0,             // vertical offset from ground (negative = up)
        vy: 0,
        w: CONFIG.PLAYER_W,
        h: CONFIG.PLAYER_H,
        grounded: true,
        jumped: false,
        doubleJumped: false,
        canDblJump: true,
        sliding: false,
        slideTimer: 0,
        health: CONFIG.MAX_HEALTH,
        lives: CONFIG.MAX_LIVES,
        invincible: 0,
        shield: false,
        shieldTimer: 0,
        dashing: false,
        dashTimer: 0,
        speedMul: 1,
        animT: 0,
    },

    // World
    world: {
        speed: CONFIG.BASE_SPEED,
        dist: 0,
        time: 0,
    },

    // Stats
    score: 0,
    coins: 0,
    highScore: parseInt(localStorage.getItem('zd_high') || '0'),

    // Power
    power: 50,

    // Objects
    obstacles: [],
    coins: [],
    powerups: [],

    // Spawn timers
    obsTimer: 0,
    coinTimer: 0,
    puTimer: 0,

    // Boss
    boss: null,
    bossActive: false,
    bossIdx: -1,
    bossHP: 0,
    bossMaxHP: 0,
    bossAtkTimer: 0,
    bossProjs: [],
    bossDefeated: false,

    // Effects
    particles: new Particles(),
    shake: 0,
    flash: 0,

    // Clouds
    clouds: [],

    // Audio
    audio: new AudioFX(),

    // Controls
    keys: {},
    touch: { sx:0, sy:0, swiping:false },

    // Canvas reference
    canvas: null,
    ctx: null,
    W: 0, H: 0,
    groundY: 0,
    laneX: [],

    // Engine
    running: false,
    animId: null,
};

// ============================================
// 7. RENDERER
// ============================================
const Render = {
    /** Initialize canvas dimensions */
    resize() {
        G.W = window.innerWidth;
        G.H = window.innerHeight;
        G.canvas.width = G.W;
        G.canvas.height = G.H;
        G.groundY = G.H * CONFIG.GROUND_RATIO;

        // 3 lane positions
        const cx = G.W / 2;
        G.laneX = [
            cx - CONFIG.LANE_WIDTH,
            cx,
            cx + CONFIG.LANE_WIDTH,
        ];
        G.player.laneX = G.laneX[G.player.lane];
    },

    /** Init clouds */
    initClouds() {
        G.clouds = [];
        for (let i=0; i<10; i++) {
            G.clouds.push({
                x: U.rand(0, G.W),
                y: U.rand(0, G.H*0.35),
                w: U.rand(60, 160),
                h: U.rand(20, 50),
                sp: U.rand(0.08, 0.3),
                op: U.rand(0.08, 0.25),
            });
        }
    },

    /** Draw gradient sky with stars */
    sky(time) {
        const ctx = G.ctx;
        const grad = ctx.createLinearGradient(0, 0, 0, G.groundY);
        const tf = Math.sin(time*0.004)*0.04;
        grad.addColorStop(0, `rgb(${8+tf*15}, ${12+tf*8}, ${35+tf*18})`);
        grad.addColorStop(0.5, `rgb(${22+tf*15}, ${14+tf*8}, ${58+tf*18})`);
        grad.addColorStop(1, `rgb(${38+tf*15}, ${22+tf*8}, ${78+tf*18})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, G.W, G.groundY);

        // Stars
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        for (let i=0; i<40; i++) {
            const sx = (i*137.5 + 12345) % G.W;
            const sy = (i*89.3 + 6789) % (G.groundY*0.5);
            const sz = ((i*7+11)%3)+1;
            const tw = Math.sin(time*0.02+i)*0.5+0.5;
            ctx.globalAlpha = tw * 0.35;
            ctx.fillRect(sx, sy, sz, sz);
        }
        ctx.globalAlpha = 1;
    },

    /** Draw clouds */
    clouds(time) {
        const ctx = G.ctx;
        G.clouds.forEach(c => {
            c.x += c.sp;
            if (c.x > G.W + c.w) { c.x = -c.w; c.y = U.rand(0, G.H*0.3); }
            ctx.globalAlpha = c.op * (Math.sin(time*0.002+c.x*0.01)*0.3+0.7);
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.beginPath();
            ctx.ellipse(c.x, c.y, c.w*0.5, c.h*0.4, 0, 0, Math.PI*2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(c.x-c.w*0.3, c.y+c.h*0.1, c.w*0.35, c.h*0.35, 0, 0, Math.PI*2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(c.x+c.w*0.3, c.y+c.h*0.05, c.w*0.3, c.h*0.3, 0, 0, Math.PI*2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    },

    /** Ground and road with scrolling */
    ground(time) {
        const ctx = G.ctx;
        const gy = G.groundY;

        // Ground fill
        const gGrad = ctx.createLinearGradient(0, gy, 0, G.H);
        gGrad.addColorStop(0, '#3a2a1a');
        gGrad.addColorStop(0.2, '#2a1a0a');
        gGrad.addColorStop(1, '#0f0800');
        ctx.fillStyle = gGrad;
        ctx.fillRect(0, gy, G.W, G.H-gy);

        // Scrolling road markings (perspective lines)
        const scroll = time * 0.4;
        ctx.strokeStyle = 'rgba(255,215,0,0.1)';
        ctx.lineWidth = 1.5;
        for (let i=-3; i<12; i++) {
            const y = gy + ((i*35 - scroll%35) % (G.H-gy));
            if (y<gy || y>G.H) continue;
            const persp = 1 - (y-gy)/(G.H-gy);
            const lw = CONFIG.LANE_WIDTH * (0.2 + persp*0.8);
            ctx.globalAlpha = 0.06 + persp*0.18;
            for (let l=0; l<CONFIG.LANE_COUNT; l++) {
                const cx = G.laneX[l];
                ctx.beginPath();
                ctx.moveTo(cx - lw*0.4, y);
                ctx.lineTo(cx + lw*0.4, y);
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;

        // Temple pillars (decorative)
        ctx.fillStyle = 'rgba(180,150,100,0.06)';
        for (let i=0; i<6; i++) {
            const px = ((i*250 - scroll*0.5 % 1500 + 1500) % 1500) - 200;
            const ph = 60 + Math.sin(i*2.7)*15;
            ctx.fillRect(px, gy-ph, 24, ph);
            ctx.fillRect(G.W-px-24, gy-ph, 24, ph);
        }

        // Background mountains
        ctx.fillStyle = 'rgba(40,20,55,0.12)';
        for (let i=0; i<5; i++) {
            const mx = ((i*280 - scroll*0.08 % 1400 + 1400) % 1400) - 150;
            const mh = 80 + Math.sin(i*2.3)*40;
            ctx.beginPath();
            ctx.moveTo(mx-60, gy);
            ctx.lineTo(mx, gy-mh);
            ctx.lineTo(mx+60, gy);
            ctx.fill();
        }
    },

    /** Lightning flash */
    lightning(time) {
        if (G.flash <= 0) return;
        const ctx = G.ctx;
        ctx.fillStyle = `rgba(255,255,255,${G.flash*0.25})`;
        ctx.fillRect(0, 0, G.W, G.H);

        if (G.flash > 0.4) {
            ctx.shadowBlur = 25;
            ctx.shadowColor = '#FFD700';
            ctx.strokeStyle = `rgba(255,255,200,${G.flash*0.4})`;
            ctx.lineWidth = 2 + G.flash*4;
            const lx = U.rand(G.W*0.2, G.W*0.8);
            let ly = 0;
            ctx.beginPath();
            ctx.moveTo(lx, ly);
            for (let i=0; i<7; i++) {
                ly += U.rand(25, 70);
                ctx.lineTo(lx+U.rand(-50, 50), ly);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    },

    /** Young Zeus character */
    player() {
        const ctx = G.ctx;
        const p = G.player;
        const x = p.laneX;
        const y = G.groundY - p.h + p.y;

        ctx.save();
        ctx.translate(x, y + p.h/2);

        // Invincibility blink
        if (p.invincible > 0 && Math.floor(p.invincible/3)%2===0) ctx.globalAlpha = 0.4;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(0, p.h/2 + 4, p.w*0.55, p.w*0.12, 0, 0, Math.PI*2);
        ctx.fill();

        // Shield glow
        if (p.shield) {
            ctx.shadowBlur = 35;
            ctx.shadowColor = '#8B5CF6';
            ctx.strokeStyle = `rgba(139,92,246,${0.2+Math.sin(G.world.time*0.08)*0.08})`;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(0, 0, p.w*0.75+Math.sin(G.world.time*0.1)*4, 0, Math.PI*2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Dash trail
        if (p.dashing) {
            ctx.shadowBlur = 25;
            ctx.shadowColor = '#FFD700';
            for (let i=1; i<4; i++) {
                ctx.globalAlpha = 0.15/i;
                ctx.fillStyle = '#FFD700';
                ctx.beginPath();
                ctx.arc(-i*12, 0, p.w*0.35, 0, Math.PI*2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
        }

        ctx.translate(0, -p.h/2);

        // Body (Greek tunic)
        const bGrad = ctx.createLinearGradient(0,0,0,p.h);
        bGrad.addColorStop(0, '#f0e6d3');
        bGrad.addColorStop(0.25, '#e8dcc8');
        bGrad.addColorStop(1, '#1a3a5c');
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        ctx.roundRect(-p.w*0.33, p.h*0.18, p.w*0.66, p.h*0.5, 6);
        ctx.fill();

        // Head
        ctx.fillStyle = '#f0e6d3';
        ctx.beginPath();
        ctx.arc(0, p.h*0.1, p.w*0.28, 0, Math.PI*2);
        ctx.fill();

        // Hair
        ctx.fillStyle = '#4a3728';
        ctx.beginPath();
        ctx.ellipse(0, p.h*0.03, p.w*0.3, p.w*0.18, 0, Math.PI, Math.PI*2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#4a90d9';
        ctx.beginPath();
        ctx.arc(-p.w*0.1, p.h*0.1, 2.5, 0, Math.PI*2);
        ctx.arc(p.w*0.1, p.h*0.1, 2.5, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-p.w*0.1, p.h*0.09, 1.2, 0, Math.PI*2);
        ctx.arc(p.w*0.1, p.h*0.09, 1.2, 0, Math.PI*2);
        ctx.fill();

        // Laurel crown
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.ellipse(0, p.h*0.01, p.w*0.33, p.w*0.08, 0, Math.PI, Math.PI*2);
        ctx.fill();
        for (let i=0; i<3; i++) {
            const ang = -Math.PI + (i+0.5)*Math.PI/3;
            ctx.beginPath();
            ctx.moveTo(Math.cos(ang)*p.w*0.28, p.h*0.01+Math.sin(ang)*p.w*0.06);
            ctx.lineTo(Math.cos(ang)*p.w*0.33, p.h*0.01-p.w*0.1);
            ctx.lineTo(Math.cos(ang+0.25)*p.w*0.28, p.h*0.01+Math.sin(ang+0.25)*p.w*0.06);
            ctx.fill();
        }

        // Arms with swing anim
        const swing = Math.sin(p.animT*0.12)*0.25;
        ctx.fillStyle = '#f0e6d3';
        ctx.save();
        ctx.translate(-p.w*0.42, p.h*0.28);
        ctx.rotate(-0.4 + swing);
        ctx.fillRect(-2.5, 0, 5, p.h*0.22);
        ctx.restore();
        ctx.save();
        ctx.translate(p.w*0.42, p.h*0.28);
        ctx.rotate(0.4 - swing);
        ctx.fillRect(-2.5, 0, 5, p.h*0.22);
        ctx.restore();

        // Legs
        const lSwing = Math.sin(p.animT*0.12)*0.25;
        ctx.fillStyle = '#1a3a5c';
        ctx.save();
        ctx.translate(-p.w*0.13, p.h*0.68);
        ctx.rotate(-0.2 + lSwing);
        ctx.fillRect(-2.5, 0, 5, p.h*0.32);
        ctx.restore();
        ctx.save();
        ctx.translate(p.w*0.13, p.h*0.68);
        ctx.rotate(0.2 - lSwing);
        ctx.fillRect(-2.5, 0, 5, p.h*0.32);
        ctx.restore();

        // Lightning aura when powered up
        if (p.dashing || p.shield || G.power > 75) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#FFD700';
            ctx.strokeStyle = `rgba(255,215,0,${0.08+Math.sin(G.world.time*0.1)*0.04})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, p.h*0.3, p.w*0.48, 0, Math.PI*2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        ctx.restore();
        ctx.globalAlpha = 1;
    },

    /** Obstacles on the road */
    obstacles() {
        const ctx = G.ctx;
        G.obstacles.forEach(o => {
            const x = G.laneX[o.lane];
            const y = G.groundY - o.h;

            switch(o.type) {
                case 'rock':
                    ctx.fillStyle = '#6b5b4f';
                    ctx.beginPath();
                    ctx.ellipse(x, y+o.h, o.w*0.45, o.h*0.45, 0, 0, Math.PI*2);
                    ctx.fill();
                    ctx.fillStyle = '#5a4a3f';
                    ctx.beginPath();
                    ctx.ellipse(x-4, y+o.h-2, o.w*0.25, o.h*0.25, 0, 0, Math.PI*2);
                    ctx.fill();
                    break;
                case 'spike':
                    ctx.fillStyle = '#dc2626';
                    for (let i=-1; i<=1; i++) {
                        ctx.beginPath();
                        ctx.moveTo(x+i*10, y+o.h);
                        ctx.lineTo(x+i*10+7, y+o.h);
                        ctx.lineTo(x+i*10+3.5, y);
                        ctx.closePath();
                        ctx.fill();
                    }
                    ctx.shadowBlur = 8;
                    ctx.shadowColor = '#ef4444';
                    ctx.shadowBlur = 0;
                    break;
                case 'fire':
                    const fh = Math.sin(G.world.time*0.12+o.id)*8+16;
                    ctx.fillStyle = '#ef4444';
                    ctx.beginPath();
                    ctx.ellipse(x, y+o.h, o.w*0.35, fh, 0, Math.PI, Math.PI*2);
                    ctx.fill();
                    ctx.fillStyle = '#f97316';
                    ctx.beginPath();
                    ctx.ellipse(x, y+o.h*0.6+4, o.w*0.22, fh*0.55, 0, Math.PI, Math.PI*2);
                    ctx.fill();
                    ctx.fillStyle = '#fbbf24';
                    ctx.beginPath();
                    ctx.ellipse(x, y+o.h*0.4+6, o.w*0.13, fh*0.25, 0, Math.PI, Math.PI*2);
                    ctx.fill();
                    ctx.shadowBlur = 15;
                    ctx.shadowColor = '#ef4444';
                    ctx.shadowBlur = 0;
                    break;
                case 'monster':
                    ctx.fillStyle = '#7c3aed';
                    ctx.beginPath();
                    ctx.arc(x, y+o.h*0.25, o.w*0.38, Math.PI, 0);
                    ctx.lineTo(x+o.w*0.38, y+o.h);
                    ctx.lineTo(x-o.w*0.38, y+o.h);
                    ctx.closePath();
                    ctx.fill();
                    ctx.fillStyle = '#ef4444';
                    ctx.beginPath();
                    ctx.arc(x-6, y+o.h*0.15, 3.5, 0, Math.PI*2);
                    ctx.arc(x+6, y+o.h*0.15, 3.5, 0, Math.PI*2);
                    ctx.fill();
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = '#7c3aed';
                    ctx.shadowBlur = 0;
                    break;
            }
        });
    },

    /** Coins */
    coinObjects() {
        const ctx = G.ctx;
        G.coins.forEach(c => {
            const x = G.laneX[c.lane];
            const y = G.groundY - c.y - Math.sin(G.world.time*0.06+c.id)*4;

            ctx.shadowBlur = 10;
            ctx.shadowColor = '#FFD700';
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(x, y, c.r, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(x, y, c.r*0.6, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = '#FFD700';
            ctx.font = `${c.r*0.8}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⚡', x, y+1);
            ctx.shadowBlur = 0;
        });
    },

    /** Powerups */
    powerupObjects() {
        const ctx = G.ctx;
        G.powerups.forEach(pu => {
            const x = G.laneX[pu.lane];
            const y = G.groundY - 50 - Math.sin(G.world.time*0.05+pu.id)*6;

            ctx.shadowBlur = 18;
            ctx.shadowColor = pu.color;
            ctx.font = '26px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(pu.icon, x, y);
            ctx.shadowBlur = 0;
        });
    },

    /** Boss projectiles */
    bossProjs() {
        const ctx = G.ctx;
        G.bossProjs.forEach(b => {
            const x = G.laneX[b.lane];
            const y = G.groundY - b.y;

            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ef4444';
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(x, y, b.r, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(x, y, b.r*0.5, 0, Math.PI*2);
            ctx.fill();
            ctx.shadowBlur = 0;
        });
    },

    /** HUD overlay */
    hud() {
        if (G.screen !== 'playing') return;
        const ctx = G.ctx;
        const p = G.player;
        const pad = 12;

        // --- Score panel (top-left) ---
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.roundRect(pad, pad, 190, 40, 10);
        ctx.fill();

        ctx.font = 'bold 12px Orbitron, monospace';
        ctx.fillStyle = '#FFD700';
        ctx.textAlign = 'left';
        ctx.fillText('⚡ SCORE', pad+10, pad+16);
        ctx.font = 'bold 17px Orbitron, monospace';
        ctx.fillStyle = '#fff';
        ctx.fillText(`${Math.floor(G.score)}`, pad+10, pad+35);

        // --- Coins (next to score) ---
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.roundRect(pad+200, pad, 105, 40, 10);
        ctx.fill();
        ctx.font = 'bold 15px Orbitron, monospace';
        ctx.fillStyle = '#FFD700';
        ctx.textAlign = 'left';
        ctx.fillText(`🪙 ${G.coins}`, pad+210, pad+27);

        // --- Distance (top-right) ---
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.roundRect(G.W-pad-145, pad, 145, 40, 10);
        ctx.fill();
        ctx.font = '12px Orbitron, monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.textAlign = 'right';
        ctx.fillText('DISTANCE', G.W-pad-10, pad+16);
        ctx.font = 'bold 16px Orbitron, monospace';
        ctx.fillStyle = '#fff';
        ctx.fillText(`${Math.floor(G.world.dist)}m`, G.W-pad-10, pad+35);

        // --- Lives (bottom-left) ---
        ctx.textAlign = 'left';
        for (let i=0; i<p.lives; i++) {
            ctx.font = '22px serif';
            ctx.fillText('⚡', pad+i*26, G.H-pad-8);
        }

        // --- Health bar (bottom) ---
        const hx = pad;
        const hy = G.H-pad-36;
        const hw = 170;
        const hh = 14;
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.roundRect(hx, hy, hw, hh, 7);
        ctx.fill();
        const hpct = p.health / CONFIG.MAX_HEALTH;
        const hcol = hpct>0.5 ? '#22c55e' : hpct>0.25 ? '#f59e0b' : '#ef4444';
        ctx.fillStyle = hcol;
        ctx.beginPath();
        ctx.roundRect(hx+2, hy+2, (hw-4)*hpct, hh-4, 5);
        ctx.fill();
        ctx.font = '9px Orbitron, monospace';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(`HP ${Math.ceil(p.health)}`, hx+hw/2, hy+11);

        // --- Power meter (right side) ---
        const pmx = G.W-pad-26;
        const pmy = pad+52;
        const pmw = 20;
        const pmh = 160;
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.roundRect(pmx, pmy, pmw, pmh, 8);
        ctx.fill();
        const ppct = G.power / CONFIG.POWER_MAX;
        const pGrad = ctx.createLinearGradient(pmx, pmy+pmh, pmx, pmy);
        pGrad.addColorStop(0, '#8B5CF6');
        pGrad.addColorStop(0.5, '#FFD700');
        pGrad.addColorStop(1, '#EF4444');
        ctx.fillStyle = pGrad;
        ctx.beginPath();
        ctx.roundRect(pmx+3, pmy+pmh-3-(pmh-6)*ppct, pmw-6, (pmh-6)*ppct, 5);
        ctx.fill();

        ctx.save();
        ctx.translate(pmx+pmw/2, pmy-12);
        ctx.font = '8px Orbitron, monospace';
        ctx.fillStyle = '#FFD700';
        ctx.textAlign = 'center';
        ctx.fillText('PWR', 0, 0);
        ctx.restore();

        // --- Boss health bar ---
        if (G.bossActive && G.boss) {
            const bx = G.W/2-150;
            const by = 60;
            const bw = 300;
            const bh = 18;
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.beginPath();
            ctx.roundRect(bx-4, by-4, bw+8, bh+22, 12);
            ctx.fill();

            ctx.font = 'bold 13px Cinzel, serif';
            ctx.fillStyle = G.boss.color || '#EF4444';
            ctx.textAlign = 'center';
            ctx.fillText(`${G.boss.icon} ${G.boss.name}`, G.W/2, by-8);

            const bpct = G.bossHP / G.bossMaxHP;
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.beginPath();
            ctx.roundRect(bx, by, bw, bh, 7);
            ctx.fill();
            ctx.fillStyle = G.boss.color || '#EF4444';
            ctx.beginPath();
            ctx.roundRect(bx+2, by+2, (bw-4)*bpct, bh-4, 5);
            ctx.fill();
            ctx.font = 'bold 11px Orbitron, monospace';
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.fillText(`${Math.ceil(G.bossHP)}/${G.bossMaxHP}`, G.W/2, by+13);
        }

        // --- Abilities hints ---
        if (p.shield) {
            ctx.font = '16px serif';
            ctx.textAlign = 'left';
            ctx.fillText('🛡️', pad, G.H-pad-80);
        }
        if (p.dashing) {
            ctx.font = '16px serif';
            ctx.textAlign = 'left';
            ctx.fillText('💨', pad+28, G.H-pad-80);
        }
    },

    /** Main render call */
    render() {
        const ctx = G.ctx;
        ctx.save();

        // Screen shake
        if (G.shake > 0.5) {
            ctx.translate(U.rand(-G.shake,G.shake), U.rand(-G.shake,G.shake));
        }

        this.sky(G.world.time);
        this.clouds(G.world.time);
        this.ground(G.world.time);
        this.coinObjects();
        this.obstacles();
        this.powerupObjects();
        this.bossProjs();
        G.particles.draw(ctx);
        this.player();
        this.lightning(G.world.time);

        ctx.restore();

        // HUD drawn without shake
        this.hud();
    },

    /** RoundRect polyfill for canvas */
    setupRoundRect() {
        if (!CanvasRenderingContext2D.prototype.roundRect) {
            CanvasRenderingContext2D.prototype.roundRect = function(x,y,w,h,r) {
                if (r > w/2) r = w/2;
                if (r > h/2) r = h/2;
                this.moveTo(x+r, y);
                this.lineTo(x+w-r, y);
                this.arcTo(x+w, y, x+w, y+r, r);
                this.lineTo(x+w, y+h-r);
                this.arcTo(x+w, y+h, x+w-r, y+h, r);
                this.lineTo(x+r, y+h);
                this.arcTo(x, y+h, x, y+h-r, r);
                this.lineTo(x, y+r);
                this.arcTo(x, y, x+r, y, r);
                this.closePath();
                return this;
            };
        }
    }
};

// ============================================
// 8. GAME LOGIC
// ============================================
const GameLogic = {
    /** Initialize engine */
    init() {
        G.canvas = document.getElementById('gameCanvas');
        G.ctx = G.canvas.getContext('2d');
        Render.setupRoundRect();
        Render.resize();
        Render.initClouds();
        this.setupControls();
        G.running = true;
        this.loop();
    },

    /** Setup keyboard + touch */
    setupControls() {
        // Keyboard
        document.addEventListener('keydown', (e) => {
            G.keys[e.key] = true;
            const k = e.key;

            if (k === 'Enter' || k === ' ') {
                e.preventDefault();
                if (G.screen === 'welcome') Game.start();
                else if (G.screen === 'playing') this.jump();
            }

            if ((k === 'Escape' || k === 'p' || k === 'P')) {
                if (G.screen === 'playing') Game.pause();
                else if (G.screen === 'paused') Game.resume();
            }

            if (G.screen === 'playing') {
                if (k === 'ArrowUp' || k === 'w') { e.preventDefault(); this.jump(); }
                if (k === 'ArrowDown' || k === 's') { e.preventDefault(); this.slide(); }
                if (k === 'ArrowLeft' || k === 'a') { e.preventDefault(); this.moveLeft(); }
                if (k === 'ArrowRight' || k === 'd') { e.preventDefault(); this.moveRight(); }
                if (k === '1') this.dash();
                if (k === '2') this.shield();
                if (k === '3') this.strike();
            }
        });

        document.addEventListener('keyup', (e) => { G.keys[e.key] = false; });

        // Touch
        const c = G.canvas;
        let tx=0, ty=0, tt=0;

        c.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const t = e.touches[0];
            tx = t.clientX; ty = t.clientY; tt = Date.now();
            G.touch.sx = tx; G.touch.sy = ty; G.touch.swiping = true;

            if (G.screen === 'welcome') Game.start();
        }, { passive: false });

        c.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!G.touch.swiping || G.screen !== 'playing') return;
            const t = e.touches[0];
            const dx = t.clientX - G.touch.sx;
            const dy = t.clientY - G.touch.sy;

            if (Math.abs(dx) > 35) {
                if (dx > 0) this.moveRight();
                else this.moveLeft();
                G.touch.sx = t.clientX;
                G.touch.sy = t.clientY;
            }
        }, { passive: false });

        c.addEventListener('touchend', (e) => {
            e.preventDefault();
            G.touch.swiping = false;
            const t = e.changedTouches[0];
            const dx = t.clientX - tx;
            const dy = t.clientY - ty;
            const dt = Date.now() - tt;

            if (Math.abs(dx) < 25 && Math.abs(dy) < 25 && dt < 300 && G.screen === 'playing') {
                this.jump(); // tap = jump
            } else if (dy > 45 && G.screen === 'playing') {
                this.slide(); // swipe down = slide
            } else if (dy < -45 && G.screen === 'playing') {
                this.jump(); // swipe up = jump
            }
        }, { passive: false });

        c.addEventListener('touchcancel', () => { G.touch.swiping = false; });

        // D-pad buttons for mobile (onscreen tap zones)
        // We use the swipe system which works great for mobile

        // Resize
        window.addEventListener('resize', () => Render.resize());
    },

    // ----- Player Actions -----
    jump() {
        const p = G.player;
        if (p.grounded) {
            p.vy = CONFIG.JUMP_VEL;
            p.grounded = false;
            p.jumped = true;
            p.canDblJump = true;
            p.doubleJumped = false;
            G.audio.jump();
            G.particles.emit(G.laneX[p.lane], G.groundY, 4, 'rgba(255,215,0,0.5)', 2, 12, 3);
        } else if (p.canDblJump && !p.doubleJumped) {
            p.vy = CONFIG.DOUBLE_JUMP_VEL;
            p.doubleJumped = true;
            p.canDblJump = false;
            G.audio.dblJump();
            G.particles.emit(G.laneX[p.lane], G.groundY-25, 6, 'rgba(139,92,246,0.5)', 2.5, 16, 3.5);
        }
    },

    slide() {
        const p = G.player;
        if (!p.grounded) return;
        p.sliding = true;
        p.slideTimer = 28;
        p.h = CONFIG.PLAYER_H * 0.5;
    },

    moveLeft() {
        if (G.player.lane > 0) G.player.lane--;
    },

    moveRight() {
        if (G.player.lane < CONFIG.LANE_COUNT-1) G.player.lane++;
    },

    dash() {
        if (G.power >= CONFIG.DASH_COST && !G.player.dashing) {
            G.power -= CONFIG.DASH_COST;
            G.player.dashing = true;
            G.player.dashTimer = 35;
            G.player.speedMul = 2.0;
            G.world.speed *= 1.4;
            G.audio.dash();
            G.particles.emit(G.laneX[G.player.lane], G.groundY, 12, '#FFD700', 4, 20, 4);
        }
    },

    shield() {
        if (G.power >= 15 && !G.player.shield) {
            G.power -= 15;
            G.player.shield = true;
            G.player.shieldTimer = 300;
            G.audio.shield();
            G.particles.emit(G.laneX[G.player.lane], G.groundY-25, 8, '#8B5CF6', 2.5, 25, 3.5);
        }
    },

    strike() {
        if (G.power >= CONFIG.STRIKE_COST) {
            G.power -= CONFIG.STRIKE_COST;
            G.flash = 0.9;
            G.shake = 9;
            G.audio.strike();
            G.particles.emit(G.laneX[G.player.lane], G.groundY-80, 22, '#FFD700', 6, 22, 5);

            if (G.bossActive) {
                G.bossHP -= 12;
                // Extra particles on boss
                G.particles.emit(G.W/2, G.groundY-150, 20, '#ef4444', 5, 20, 5);
                if (G.bossHP <= 0) this.defeatBoss();
            } else {
                // Clear nearby obstacles
                G.obstacles = G.obstacles.filter(o => Math.abs(o.z-G.world.dist) > 150);
            }
        }
    },

    // ----- Spawning -----
    spawnObstacle() {
        const types = ['rock','spike','fire','monster'];
        const type = types[U.randInt(0,3)];
        const lane = U.randInt(0,2);
        // Avoid spawning on player lane too often
        if (lane === G.player.lane && Math.random()<0.55) return;

        G.obstacles.push({
            type,
            lane,
            z: G.world.dist + 550,
            w: 25+U.rand(0,18),
            h: 35+U.rand(0,25),
            id: G.world.time + Math.random(),
        });
    },

    spawnCoin() {
        const lane = U.randInt(0,2);
        G.coins.push({
            lane,
            y: 35+U.rand(0,50),
            z: G.world.dist + 480,
            r: CONFIG.COIN_VALUE*0.5+1,
            id: G.world.time + Math.random(),
        });
    },

    spawnCoinLine() {
        const lane = U.randInt(0,2);
        for (let i=0; i<4; i++) {
            G.coins.push({
                lane: Math.min(2, Math.max(0, lane + (i-1))),
                y: 35+U.rand(0,30),
                z: G.world.dist + 480 + i*35,
                r: 10,
                id: G.world.time + i + Math.random(),
            });
        }
    },

    spawnPowerup() {
        const types = [
            { icon: '⚡', color: '#FFD700', effect: 'power' },
            { icon: '🛡️', color: '#8B5CF6', effect: 'shield' },
            { icon: '💨', color: '#22c55e', effect: 'speed' },
        ];
        const t = types[U.randInt(0,2)];
        G.powerups.push({
            ...t,
            lane: U.randInt(0,2),
            z: G.world.dist + 480,
            id: G.world.time + Math.random(),
        });
    },

    // ----- Boss -----
    startBoss(idx) {
        if (idx >= BOSSES.length) return;
        G.bossIdx = idx;
        G.boss = BOSSES[idx];
        G.bossActive = true;
        G.bossHP = G.boss.hp;
        G.bossMaxHP = G.boss.hp;
        G.bossAtkTimer = 0;
        G.bossProjs = [];
        G.obstacles = [];
        G.coins = [];
        G.audio.bossWarn();

        // Show warning screen
        document.getElementById('bossWarningName').textContent = G.boss.name;
        document.getElementById('bossWarningCountdown').textContent = 'Battle in 3...';
        document.getElementById('bossWarningScreen').classList.add('active');
        G.screen = 'bosswarning';

        let count = 3;
        const iv = setInterval(() => {
            count--;
            const el = document.getElementById('bossWarningCountdown');
            if (el) el.textContent = `Battle in ${count}...`;
            if (count <= 0) {
                clearInterval(iv);
                document.getElementById('bossWarningScreen').classList.remove('active');
                if (G.screen === 'bosswarning') G.screen = 'playing';
            }
        }, 1000);
    },

    updateBoss() {
        if (!G.bossActive || !G.boss) return;

        G.bossAtkTimer++;

        // Boss fires projectiles
        if (G.bossAtkTimer > 100 - G.bossIdx*4) {
            G.bossAtkTimer = 0;
            const lane = U.randInt(0,2);
            G.bossProjs.push({
                lane, y: 50, vy: 2+G.bossIdx*0.15, r: 7+G.bossIdx,
            });

            // Multi-projectile for later bosses
            if (G.bossIdx > 4 && Math.random()<0.3) {
                const l2 = (lane+1) % 3;
                G.bossProjs.push({ lane:l2, y:50, vy:2+G.bossIdx*0.15, r:7+G.bossIdx });
            }
        }

        // Move projectiles
        G.bossProjs.forEach(b => b.y += b.vy);
        G.bossProjs = G.bossProjs.filter(b => b.y < 180);

        // Collision with player
        const px = G.laneX[G.player.lane];
        const py = G.groundY - G.player.h + G.player.y;
        G.bossProjs.forEach(b => {
            const bx = G.laneX[b.lane];
            const by = G.groundY - b.y;
            if (Math.abs(px-bx) < 28 && Math.abs(py-by) < 35) {
                if (!G.player.shield && G.player.invincible <= 0) {
                    this.hitPlayer(12);
                }
                b.y = 999; // mark for removal
            }
        });
        G.bossProjs = G.bossProjs.filter(b => b.y < 900);

        // Auto-hit boss if player dashes into it
        const bossDist = Math.abs(G.world.dist % 600);
        if (G.player.dashing && bossDist > 550) {
            G.bossHP -= 0.8;
            if (G.bossHP <= 0) this.defeatBoss();
        }
    },

    defeatBoss() {
        G.bossActive = false;
        G.bossDefeated = true;
        G.score += CONFIG.BOSS_BONUS + G.bossIdx * 300;
        G.audio.victory();
        G.particles.emit(G.W/2, G.groundY-100, 40, '#FFD700', 8, 35, 7);
        G.shake = 12;
        G.flash = 1.2;

        // Show victory
        document.getElementById('victoryBossName').textContent = G.boss ? G.boss.name : '???';
        document.getElementById('vScore').textContent = Math.floor(G.score);
        document.getElementById('vCoins').textContent = G.coins;
        document.getElementById('victoryScreen').classList.add('active');
        G.screen = 'victory';
    },

    // ----- Combat -----
    hitPlayer(dmg) {
        const p = G.player;
        if (p.invincible > 0 || p.shield) return;

        p.health -= dmg;
        p.invincible = 55;
        G.shake = 7;
        G.audio.hit();
        G.particles.emit(G.laneX[p.lane], G.groundY-p.h/2, 8, '#ef4444', 3.5, 16, 3.5);

        if (p.health <= 0) {
            p.health = CONFIG.MAX_HEALTH;
            p.lives--;
            if (p.lives <= 0) {
                Game.over();
            } else {
                p.invincible = 100;
            }
        }
    },

    checkCollisions() {
        const p = G.player;
        const px = G.laneX[p.lane];
        const py = G.groundY - p.h + p.y;
        const pw = p.w * 0.6;
        const ph = p.h * 0.8;

        // Obstacles
        G.obstacles.forEach(o => {
            const ox = G.laneX[o.lane];
            const oy = G.groundY - o.h;
            const zd = Math.abs(o.z - G.world.dist);
            if (zd < 45) {
                if (U.rectHit(
                    {x:px-pw/2, y:py, w:pw, h:ph},
                    {x:ox-o.w*0.4, y:oy, w:o.w*0.8, h:o.h}
                )) {
                    if (!p.dashing) this.hitPlayer(13);
                }
            }
        });

        // Coins
        G.coins.forEach(c => {
            if (c.collected) return;
            const cx = G.laneX[c.lane];
            const cy = G.groundY - c.y - Math.sin(G.world.time*0.06+c.id)*4;
            const zd = Math.abs(c.z - G.world.dist);
            if (zd < 35 && U.dist(px, py+ph/2, cx, cy) < c.r + 18) {
                c.collected = true;
                G.coins++;
                G.score += CONFIG.COIN_VALUE;
                G.power = Math.min(CONFIG.POWER_MAX, G.power + 2);
                G.audio.coin();
                G.particles.emit(cx, cy, 4, '#FFD700', 1.5, 12, 2.5);
            }
        });

        // Powerups
        G.powerups.forEach(pu => {
            if (pu.collected) return;
            const pux = G.laneX[pu.lane];
            const puy = G.groundY - 50 - Math.sin(G.world.time*0.05+pu.id)*6;
            const zd = Math.abs(pu.z - G.world.dist);
            if (zd < 35 && Math.abs(pux-px) < 25) {
                pu.collected = true;
                G.audio.tone(650, 0.12, 'sine', 0.12);
                G.particles.emit(pux, puy, 8, pu.color, 2.5, 16, 3.5);

                switch(pu.effect) {
                    case 'power': G.power = Math.min(CONFIG.POWER_MAX, G.power+25); break;
                    case 'shield':
                        G.player.shield = true;
                        G.player.shieldTimer = 280;
                        break;
                    case 'speed':
                        G.player.speedMul = 1.4;
                        G.world.speed *= 1.25;
                        setTimeout(() => {
                            G.player.speedMul = 1;
                            G.world.speed = CONFIG.BASE_SPEED + G.world.dist*CONFIG.SPEED_INCREMENT;
                        }, 3000);
                        break;
                }
            }
        });

        // Cleanup
        G.obstacles = G.obstacles.filter(o => o.z > G.world.dist - 180);
        G.coins = G.coins.filter(c => !c.collected && c.z > G.world.dist - 180);
        G.powerups = G.powerups.filter(pu => !pu.collected && pu.z > G.world.dist - 180);
    },

    // ----- Main Update -----
    update() {
        if (G.screen !== 'playing') return;

        const p = G.player;
        G.world.time++;

        // ---- Speed ---- increases over time
        G.world.speed = Math.min(CONFIG.MAX_SPEED,
            CONFIG.BASE_SPEED + G.world.dist * CONFIG.SPEED_INCREMENT
        ) * p.speedMul;

        // ---- Distance & Score ----
        G.world.dist += G.world.speed * 0.08;
        G.score += G.world.speed * 0.008;

        // ---- Lane interpolation ----
        const targetX = G.laneX[p.lane];
        p.laneX += (targetX - p.laneX) * 0.18;

        // ---- Physics ----
        if (!p.grounded) {
            p.vy += CONFIG.GRAVITY;
            if (p.vy > 0 && p.jumped) p.doubleJumped = false;
        }

        // Ground
        if (p.vy >= 0 && p.y + p.vy >= 0) {
            p.grounded = true;
            p.jumped = false;
            p.doubleJumped = false;
            p.canDblJump = true;
            p.vy = 0;
            p.y = 0;
        } else {
            p.y += p.vy;
        }

        // Slide
        if (p.sliding) {
            p.slideTimer--;
            if (p.slideTimer <= 0) {
                p.sliding = false;
                p.h = CONFIG.PLAYER_H;
            }
        }

        // Dash
        if (p.dashing) {
            p.dashTimer--;
            if (p.dashTimer <= 0) {
                p.dashing = false;
                p.speedMul = 1;
                G.world.speed = CONFIG.BASE_SPEED + G.world.dist*CONFIG.SPEED_INCREMENT;
            }
        }

        // Shield
        if (p.shield) {
            p.shieldTimer--;
            G.power -= CONFIG.SHIELD_COST;
            if (p.shieldTimer <= 0 || G.power <= 0) p.shield = false;
        }

        // Invincibility
        if (p.invincible > 0) p.invincible--;

        // Animation
        p.animT++;

        // ---- Power regen ----
        if (!p.dashing && !p.shield) {
            G.power = Math.min(CONFIG.POWER_MAX, G.power + CONFIG.POWER_REGEN);
        }

        // ---- Lightning flash (random) ----
        if (Math.random() < 0.0008) G.flash = 0.4 + Math.random()*0.5;
        if (G.flash > 0) G.flash -= 0.015;

        // ---- Screen shake decay ----
        if (G.shake > 0) G.shake *= 0.88;
        if (G.shake < 0.15) G.shake = 0;

        // ---- Spawn obstacles ----
        G.obsTimer++;
        const rate = Math.max(18, 50 - G.world.dist*0.0008);
        if (G.obsTimer > rate && !G.bossActive) {
            G.obsTimer = 0;
            this.spawnObstacle();
            if (Math.random()<0.15) this.spawnObstacle();
        }

        // ---- Spawn coins ----
        G.coinTimer++;
        if (G.coinTimer > 35 && !G.bossActive) {
            G.coinTimer = 0;
            if (Math.random()<0.35) this.spawnCoinLine();
            else this.spawnCoin();
        }

        // ---- Spawn powerups ----
        G.puTimer++;
        if (G.puTimer > 400 && !G.bossActive) {
            G.puTimer = 0;
            this.spawnPowerup();
        }

        // ---- Boss check ----
        if (!G.bossActive && G.bossIdx+1 < BOSSES.length) {
            const nextMilestone = CONFIG.BOSS_AT[G.bossIdx+1];
            if (G.score >= nextMilestone) {
                this.startBoss(G.bossIdx+1);
            }
        }

        // ---- Boss update ----
        if (G.bossActive) this.updateBoss();

        // ---- Collisions ----
        this.checkCollisions();

        // ---- Particles ----
        G.particles.update();

        // ---- Win check ----
        if (G.score >= CONFIG.WIN_SCORE) {
            G.screen = 'endstory';
            document.getElementById('endStoryScreen').classList.add('active');
        }
    },

    // ----- Game Loop -----
    loop() {
        if (!G.running) return;
        this.update();
        Render.render();
        G.animId = requestAnimationFrame(() => this.loop());
    },

    /** Reset game state */
    reset() {
        const p = G.player;
        p.lane = 1; p.targetLane = 1;
        p.laneX = G.laneX[1];
        p.y = 0; p.vy = 0;
        p.grounded = true; p.jumped = false;
        p.doubleJumped = false; p.canDblJump = true;
        p.sliding = false; p.slideTimer = 0;
        p.health = CONFIG.MAX_HEALTH;
        p.lives = CONFIG.MAX_LIVES;
        p.invincible = 0;
        p.shield = false; p.shieldTimer = 0;
        p.dashing = false; p.dashTimer = 0;
        p.speedMul = 1; p.animT = 0;
        p.h = CONFIG.PLAYER_H;

        G.world.speed = CONFIG.BASE_SPEED;
        G.world.dist = 0;
        G.world.time = 0;

        G.score = 0;
        G.coins = 0;
        G.power = 50;

        G.obstacles = [];
        G.coins = [];
        G.powerups = [];
        G.obsTimer = 0;
        G.coinTimer = 0;
        G.puTimer = 0;

        G.boss = null;
        G.bossActive = false;
        G.bossIdx = -1;
        G.bossHP = 0;
        G.bossMaxHP = 0;
        G.bossAtkTimer = 0;
        G.bossProjs = [];
        G.bossDefeated = false;

        G.particles.clear();
        G.shake = 0;
        G.flash = 0;

        G.screen = 'playing';
    },
};

// ============================================
// 9. GAME PUBLIC API (called from HTML)
// ============================================
const Game = {
    /** Start the game */
    start() {
        document.querySelectorAll('.overlay').forEach(s => s.classList.remove('active'));
        GameLogic.reset();
        G.audio.init();
    },

    /** Pause */
    pause() {
        if (G.screen !== 'playing') return;
        G.screen = 'paused';
        document.getElementById('pauseScreen').classList.add('active');
    },

    /** Resume */
    resume() {
        if (G.screen !== 'paused') return;
        G.screen = 'playing';
        document.getElementById('pauseScreen').classList.remove('active');
    },

    /** Restart */
    restart() {
        document.querySelectorAll('.overlay').forEach(s => s.classList.remove('active'));
        GameLogic.reset();
        G.screen = 'playing';
    },

    /** Game over */
    over() {
        G.screen = 'gameover';
        if (G.score > G.highScore) {
            G.highScore = Math.floor(G.score);
            localStorage.setItem('zd_high', G.highScore.toString());
        }
        document.getElementById('goScore').textContent = Math.floor(G.score);
        document.getElementById('goDistance').textContent = Math.floor(G.world.dist) + 'm';
        document.getElementById('goCoins').textContent = G.coins;
        document.getElementById('goHighScore').textContent = G.highScore;
        G.audio.gameOver();
        document.getElementById('gameOverScreen').classList.add('active');
    },

    /** Menu */
    menu() {
        document.querySelectorAll('.overlay').forEach(s => s.classList.remove('active'));
        G.screen = 'welcome';
        document.getElementById('welcomeScreen').classList.add('active');
    },

    /** Continue after victory */
    continueAfterVictory() {
        document.getElementById('victoryScreen').classList.remove('active');
        G.screen = 'playing';
        G.bossDefeated = false;
        G.bossActive = false;
        G.boss = null;
    },
};

// ============================================
// 10. BOOT
// ============================================
window.addEventListener('DOMContentLoaded', () => {
    GameLogic.init();
    console.log('⚡ ZEUS DASH v1.0 loaded!');
    console.log('© Zeus Dash | ZEUS: 09066760078 | Danny: 08062285862');
});
