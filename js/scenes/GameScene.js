import GameState from '../game/state.js';
import { AudioManager } from '../game/audio.js';
import {
  GAME_WIDTH, GAME_HEIGHT, PANEL_WIDTH, HUD_HEIGHT,
  FIELD_WIDTH, CELL_SIZE, GRID_COLS, GRID_ROWS,
  PATH_CELL_SET, PATH_WAYPOINTS, BARRIER_X,
  HEROES, ARTIFACTS, ARTIFACT_BY_ID, ENEMY_TYPES,
  WAVES, MUTATIONS, MUTATION_AFTER_WAVES,
  BASE_MONEY, BASE_BARRIER_HP, BASE_BARRIER_REGEN,
  ARTIFACT_SELL_RATIO, WAVE_PREP_TIME,
} from '../game/constants.js';

// ─── Small helpers ────────────────────────────────────────────────────────────
const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;
const pick3  = (arr) => Phaser.Utils.Array.Shuffle([...arr]).slice(0, 3);

export default class GameScene extends Phaser.Scene {
  constructor() { super({ key: 'GameScene' }); }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  create(data) {
    this.audio = new AudioManager(this);

    // ── Hero ──────────────────────────────────────────────────────────────
    this.heroKey  = data?.heroKey || GameState.heroKey || 'borislava';
    this.hero     = HEROES[this.heroKey];
    GameState.score = 0;
    GameState.totalKills = 0;
    GameState.wavesCleared = 0;

    // ── Mutable state ─────────────────────────────────────────────────────
    this.money        = BASE_MONEY;
    this.barrierMaxHP = BASE_BARRIER_HP + (this.hero.barrierHPBonus || 0);
    this.barrierHP    = this.barrierMaxHP;
    this.barrierRegen = BASE_BARRIER_REGEN + (this.hero.barrierRegenBonus || 0);
    this.ecstasyMax   = this.hero.ecstasyMax;
    this.ecstasy      = 0;
    this.costMult     = this.hero.artifactCostMult;
    this.waveIndex    = 0;
    this.waveActive   = false;
    this.gameOver     = false;
    this.prepTimer    = 0;     // countdown ms during prep phase
    this.isPrepPhase  = true;

    // Mutation buffs (all multiplicative)
    this.muts = {
      fireRateMult:    1.0,
      darkDamageMult:  1.0,
      barrierMaxHPBonus: 0,
      ecstasyGainMult: 1.0,
      synergyBuff:     1.0,
      moneyGainMult:   1.0,
      rangeMult:       1.0,
      regenMult:       1.0,
    };

    // ── Data structures ───────────────────────────────────────────────────
    /** @type {Map<string, ArtifactObj>} key → 'col,row' */
    this.artifacts    = new Map();
    /** @type {EnemyObj[]} */
    this.enemies      = [];
    /** @type {ProjectileObj[]} */
    this.projectiles  = [];
    /** Spawn queue: [{type, remaining}] */
    this.spawnQueue   = [];

    // ── Scene objects ─────────────────────────────────────────────────────
    this._buildBackground();
    this._buildPathVisual();
    this._buildBarrierVisual();
    this._buildHUD();
    this._buildPanel();

    // Hover / selection state
    this.selectedArtifactId = null;
    this.hoverCell          = null;
    this._buildHoverGraphic();

    // Batch-draw graphics that get redrawn every frame
    this.hpBarGfx = this.add.graphics().setDepth(20);

    // ── Timers & events ───────────────────────────────────────────────────
    this._regenTimer = this.time.addEvent({
      delay: 1000, loop: true, callback: this._doRegen, callbackScope: this,
    });

    this.input.on('pointermove', this._onPointerMove, this);
    this.input.on('pointerdown', this._onPointerDown, this);
    this._onEscKey = () => this._clearSelection();
    this.input.keyboard?.on('keydown-ESC', this._onEscKey);

    this.events.on('shutdown', this._cleanup, this);

    // ── Tutorial ──────────────────────────────────────────────────────────
    if (!GameState.tutorialSeen) {
      this._showTutorial();
    } else {
      this._beginPrep();
    }

    this.cameras.main.fadeIn(600, 0, 0, 0);
  }

  update(time, delta) {
    if (this.gameOver) return;

    // Prep-phase countdown
    if (this.isPrepPhase) {
      this.prepTimer -= delta;
      this._updatePrepHUD();
      if (this.prepTimer <= 0) this._startWave();
      return;
    }

    this._processSpawnQueue(delta);
    this._updateEnemies(delta);
    this._updateProjectiles(delta);
    this._updateArtifactFire(delta);
    this._drawHPBars();
    this._updateHUD();
  }

  _cleanup() {
    this._regenTimer?.destroy();
    this._spawnTimerEvent?.destroy();
    this.input?.off('pointermove', this._onPointerMove, this);
    this.input?.off('pointerdown', this._onPointerDown, this);
    this.input?.keyboard?.off('keydown-ESC', this._onEscKey);
    this.enemies.forEach(e => e.sprite?.destroy());
    this.projectiles.forEach(p => p.sprite?.destroy());
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENE BUILDING
  // ═══════════════════════════════════════════════════════════════════════════

  _buildBackground() {
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'background_level_1')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setDepth(0).setAlpha(0.96);

    const fieldShade = this.add.graphics().setDepth(0);
    fieldShade.fillStyle(0x04070c, 0.28);
    fieldShade.fillRect(0, HUD_HEIGHT, FIELD_WIDTH, GAME_HEIGHT - HUD_HEIGHT);
    fieldShade.fillStyle(0x12070d, 0.18);
    fieldShade.fillRect(FIELD_WIDTH * 0.62, HUD_HEIGHT, FIELD_WIDTH * 0.38, GAME_HEIGHT - HUD_HEIGHT);

    // Cell grid overlay
    this.cellGfx = this.add.graphics().setDepth(1);
    for (let c = 0; c < GRID_COLS; c++) {
      for (let r = 0; r < GRID_ROWS; r++) {
        const cx = c * CELL_SIZE, cy = HUD_HEIGHT + r * CELL_SIZE;
        if (PATH_CELL_SET.has(`${c},${r}`)) {
          this.cellGfx.fillStyle(0x18080c, 0.38);
        } else {
          this.cellGfx.fillStyle(0x071108, 0.16);
        }
        this.cellGfx.fillRect(cx + 1, cy + 1, CELL_SIZE - 2, CELL_SIZE - 2);
        this.cellGfx.lineStyle(1, 0x48624c, 0.16);
        this.cellGfx.strokeRect(cx, cy, CELL_SIZE, CELL_SIZE);
      }
    }
  }

  _buildPathVisual() {
    const pg = this.add.graphics().setDepth(2).setAlpha(0.42);
    pg.fillStyle(0x3a1010, 0.85);
    PATH_WAYPOINTS.forEach((wp, i) => {
      if (i === 0) return;
      const prev = PATH_WAYPOINTS[i - 1];
      // Draw thick line segment as rect
      const dx = wp.x - prev.x, dy = wp.y - prev.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) return;
      const nx = -dy / len, ny = dx / len;
      const hw = 20;
      pg.fillPoints([
        { x: prev.x + nx * hw, y: prev.y + ny * hw },
        { x: prev.x - nx * hw, y: prev.y - ny * hw },
        { x: wp.x   - nx * hw, y: wp.y   - ny * hw },
        { x: wp.x   + nx * hw, y: wp.y   + ny * hw },
      ], true);
    });
    // Arrow direction indicators
    const ag = this.add.graphics().setDepth(3).setAlpha(0.75);
    ag.fillStyle(0x7cf0a7, 0.95);
    PATH_WAYPOINTS.forEach((wp, i) => {
      if (i === 0 || i === PATH_WAYPOINTS.length - 1) return;
      ag.fillCircle(wp.x, wp.y, 6);
    });
  }

  _buildBarrierVisual() {
    this.barrierGfx = this.add.graphics().setDepth(5);
    this.barrierRuneGfx = this.add.graphics().setDepth(6);
    this._drawBarrier();
  }

  _drawBarrier() {
    this.barrierGfx.clear();
    this.barrierRuneGfx.clear();
    const ratio = this.barrierHP / this.barrierMaxHP;
    const col = ratio > 0.5 ? 0x9966ff : ratio > 0.25 ? 0xff9900 : 0xff3300;
    this.barrierGfx.fillStyle(col, 0.2);
    this.barrierGfx.fillRect(BARRIER_X - 24, HUD_HEIGHT, 44, GAME_HEIGHT - HUD_HEIGHT);
    this.barrierGfx.fillStyle(col, 0.72);
    this.barrierGfx.fillRect(BARRIER_X - 8, HUD_HEIGHT, 12, GAME_HEIGHT - HUD_HEIGHT);
    this.barrierGfx.lineStyle(2, 0xffffff, 0.3);
    this.barrierGfx.strokeRect(BARRIER_X - 8, HUD_HEIGHT, 12, GAME_HEIGHT - HUD_HEIGHT);

    const runeY = HUD_HEIGHT + (GAME_HEIGHT - HUD_HEIGHT) / 2;
    this.barrierRuneGfx.lineStyle(2, col, 0.95);
    this.barrierRuneGfx.strokeCircle(BARRIER_X - 2, runeY, 42);
    this.barrierRuneGfx.strokeCircle(BARRIER_X - 2, runeY, 24);
    this.barrierRuneGfx.strokePoints([
      { x: BARRIER_X - 2, y: runeY - 28 },
      { x: BARRIER_X + 26, y: runeY },
      { x: BARRIER_X - 2, y: runeY + 28 },
      { x: BARRIER_X - 30, y: runeY },
    ], true);
    this.barrierRuneGfx.fillStyle(col, 0.22);
    this.barrierRuneGfx.fillCircle(BARRIER_X - 2, runeY, 16);
  }

  _buildHUD() {
    // Background bar
    const hg = this.add.graphics().setDepth(30);
    hg.fillStyle(0x06000f, 0.95);
    hg.fillRect(0, 0, GAME_WIDTH, HUD_HEIGHT);
    hg.lineStyle(1, 0x330055, 1);
    hg.lineBetween(0, HUD_HEIGHT, GAME_WIDTH, HUD_HEIGHT);

    // Wave label
    this.waveTxt = this.add.text(12, 14, 'Wave 0 / 12', {
      fontFamily: 'sans-serif', fontSize: '16px', color: '#aaaacc',
    }).setDepth(31);

    // Prep countdown / wave active indicator
    this.prepTxt = this.add.text(12, 36, '', {
      fontFamily: 'sans-serif', fontSize: '13px', color: '#557755',
    }).setDepth(31);

    // Barrier HP bar (center)
    const bx = GAME_WIDTH / 2 - 200;
    this.add.text(bx - 4, 9, '⬛ BARRIER', {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#8866aa',
    }).setDepth(31).setOrigin(1, 0);

    this.barrierHpTrack = this.add.graphics().setDepth(31);
    this.barrierHpFill  = this.add.graphics().setDepth(31);
    this.barrierHpTxt   = this.add.text(GAME_WIDTH / 2, 30, '', {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#ccaaff',
    }).setDepth(31).setOrigin(0.5);

    this.barrierHpTrack.fillStyle(0x1a0033); this.barrierHpTrack.fillRect(bx, 8, 400, 18);
    this.barrierHpTrack.lineStyle(1, 0x440066); this.barrierHpTrack.strokeRect(bx, 8, 400, 18);

    // Money
    this.moneyTxt = this.add.text(GAME_WIDTH - PANEL_WIDTH - 140, 14, '💰 0', {
      fontFamily: 'sans-serif', fontSize: '16px', color: '#ffdd55',
    }).setDepth(31);

    // Ecstasy bar
    const ex = GAME_WIDTH - PANEL_WIDTH - 130;
    this.add.text(ex - 4, 38, '⚡', {
      fontFamily: 'sans-serif', fontSize: '13px', color: '#44ddff',
    }).setDepth(31);
    this.ecstasyTrack = this.add.graphics().setDepth(31);
    this.ecstasyFill  = this.add.graphics().setDepth(31);
    this.ecstasyTrack.fillStyle(0x001a22, 0.85);
    this.ecstasyTrack.fillRect(ex + 19, 39, 114, 10);
    this.add.image(ex + 76, 43, 'faith_energy_bar')
      .setDisplaySize(158, 22)
      .setDepth(32);

    // Ultimate button
    this.ultBg  = this.add.graphics().setDepth(31);
    this.ultTxt = this.add.text(GAME_WIDTH - PANEL_WIDTH - 30, 30, 'ULTIMATE', {
      fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#888888',
    }).setDepth(32).setOrigin(0.5);
    this._drawUltButton(false);

    const ultZone = this.add.zone(GAME_WIDTH - PANEL_WIDTH - 30, 30, 80, 40).setInteractive({ useHandCursor: true }).setDepth(32);
    ultZone.on('pointerdown', () => this._activateUltimate());

    this._updateHUD();
  }

  _drawUltButton(ready) {
    this.ultBg.clear();
    this.ultBg.fillStyle(ready ? 0x004466 : 0x0a0a0a, 0.9);
    this.ultBg.fillRoundedRect(GAME_WIDTH - PANEL_WIDTH - 70, 10, 80, 40, 5);
    this.ultBg.lineStyle(2, ready ? 0x00ccff : 0x333333, 1);
    this.ultBg.strokeRoundedRect(GAME_WIDTH - PANEL_WIDTH - 70, 10, 80, 40, 5);
    this.ultTxt.setColor(ready ? '#00ccff' : '#555555');
  }

  _buildPanel() {
    const px = FIELD_WIDTH;
    const pg = this.add.graphics().setDepth(30);
    pg.fillStyle(0x05000f, 0.96);
    pg.fillRect(px, 0, PANEL_WIDTH, GAME_HEIGHT);
    pg.lineStyle(1, 0x2a0055, 1);
    pg.lineBetween(px, 0, px, GAME_HEIGHT);

    const portraitFrame = this.add.graphics().setDepth(31);
    portraitFrame.fillStyle(0x10071f, 0.88);
    portraitFrame.fillRoundedRect(px + 14, 56, PANEL_WIDTH - 28, 92, 10);
    portraitFrame.lineStyle(1, this.hero.color, 0.75);
    portraitFrame.strokeRoundedRect(px + 14, 56, PANEL_WIDTH - 28, 92, 10);

    this.add.text(px + 12, 8, 'ARTIFACTS', {
      fontFamily: 'serif', fontSize: '15px', color: '#8866cc',
    }).setDepth(31);

    // Hero portrait + name
    this.add.image(px + 58, 101, this.heroKey).setDisplaySize(74, 104).setDepth(31);
    this.add.text(px + 104, 74, this.hero.name, {
      fontFamily: 'serif', fontSize: '16px', color: '#' + this.hero.color.toString(16).padStart(6,'0'),
    }).setDepth(31);
    this.add.text(px + 104, 96, this.hero.title, {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#a28cb6',
      wordWrap: { width: PANEL_WIDTH - 122 },
    }).setDepth(31);
    this.add.text(px + 104, 122, `ULT: ${this.hero.ultimateName}`, {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#4488aa',
    }).setDepth(31);

    // Artifact shop buttons
    ARTIFACTS.forEach((art, i) => this._buildShopItem(art, px + 10, 170 + i * 110));

    // Sell / info label (shown when a placed artifact is selected)
    this.sellBtn  = this.add.graphics().setDepth(32).setVisible(false);
    this.sellTxt  = this.add.text(px + PANEL_WIDTH / 2, 640, '', {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#ffaa44',
    }).setOrigin(0.5).setDepth(33).setVisible(false);
    this.infoTxt  = this.add.text(px + PANEL_WIDTH / 2, 618, '', {
      fontFamily: 'sans-serif', fontSize: '13px', color: '#ccaaee',
      align: 'center', wordWrap: { width: PANEL_WIDTH - 20 },
    }).setOrigin(0.5).setDepth(33).setVisible(false);
  }

  _buildShopItem(art, x, y) {
    const W = PANEL_WIDTH - 20, H = 96;
    const bg = this.add.graphics().setDepth(31);
    const draw = (sel) => {
      bg.clear();
      bg.fillStyle(sel ? 0x1a0033 : 0x0a000f, 0.95);
      bg.fillRoundedRect(x, y, W, H, 6);
      bg.lineStyle(sel ? 2 : 1, art.color, sel ? 1 : 0.5);
      bg.strokeRoundedRect(x, y, W, H, 6);
    };
    draw(false);

    const colorHex = '#' + art.color.toString(16).padStart(6, '0');
    this.add.image(x + 34, y + 48, 'totem')
      .setDisplaySize(42, 42)
      .setTint(art.color)
      .setDepth(32);
    this.add.text(x + 66, y + 8,  art.name, { fontFamily: 'serif', fontSize: '15px', color: colorHex }).setDepth(32);
    this.add.text(x + 66, y + 30, `💰 ${art.cost}`, { fontFamily: 'sans-serif', fontSize: '13px', color: '#ffdd55' }).setDepth(32);
    this.add.text(x + 66, y + 50, art.description, {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#998aaa',
      wordWrap: { width: W - 76 },
    }).setDepth(32);

    const zone = this.add.zone(x + W / 2, y + H / 2, W, H).setInteractive({ useHandCursor: true }).setDepth(33);
    zone.on('pointerover',  () => { if (this.selectedArtifactId !== art.id) { draw(true); } });
    zone.on('pointerout',   () => { if (this.selectedArtifactId !== art.id) { draw(false); } });
    zone.on('pointerdown',  () => {
      this.selectedArtifactId = art.id;
      this.hoverGfx.setVisible(true);
    });

  }

  _buildHoverGraphic() {
    this.hoverGfx = this.add.graphics().setDepth(25).setVisible(false);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UPDATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  _updateHUD() {
    this.waveTxt.setText(`Wave ${this.waveIndex} / ${WAVES.length}`);
    this.moneyTxt.setText(`💰 ${this.money}`);

    // Barrier HP bar
    const ratio = Phaser.Math.Clamp(this.barrierHP / this.barrierMaxHP, 0, 1);
    const bx = GAME_WIDTH / 2 - 200;
    this.barrierHpFill.clear();
    const barColor = ratio > 0.5 ? 0x9966ff : ratio > 0.25 ? 0xff9900 : 0xff2200;
    this.barrierHpFill.fillStyle(barColor, 0.9);
    this.barrierHpFill.fillRect(bx, 8, 400 * ratio, 18);
    this.barrierHpTxt.setText(`${Math.ceil(this.barrierHP)} / ${this.barrierMaxHP}`);

    // Ecstasy bar
    const er = Phaser.Math.Clamp(this.ecstasy / this.ecstasyMax, 0, 1);
    const ex = GAME_WIDTH - PANEL_WIDTH - 111;
    this.ecstasyFill.clear();
    this.ecstasyFill.fillStyle(0x00aacc, 0.9);
    this.ecstasyFill.fillRect(ex, 39, 114 * er, 10);

    // Ultimate button glow when ready
    this._drawUltButton(er >= 1);
  }

  _updatePrepHUD() {
    const secs = Math.ceil(this.prepTimer / 1000);
    this.prepTxt.setText(this.waveIndex === 0
      ? `Preparation: ${secs}s`
      : `Next wave in ${secs}s …`);
    this._updateHUD();
  }

  _drawHPBars() {
    this.hpBarGfx.clear();
    this.enemies.forEach(e => {
      if (e.dead) return;
      const bw = 36, bh = 5;
      const bx = e.sprite.x - bw / 2;
      const by = e.sprite.y - e.sprite.displayHeight / 2 - 10;
      this.hpBarGfx.fillStyle(0x330000);
      this.hpBarGfx.fillRect(bx, by, bw, bh);
      this.hpBarGfx.fillStyle(e.type.id === 'boss' ? 0xff3300 : 0xdd2200);
      this.hpBarGfx.fillRect(bx, by, bw * Phaser.Math.Clamp(e.hp / e.maxHp, 0, 1), bh);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WAVE SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════

  _beginPrep() {
    this.isPrepPhase = true;
    this.prepTimer   = WAVE_PREP_TIME;
    this._updatePrepHUD();
  }

  _startWave() {
    if (this.waveIndex >= WAVES.length) { this._victory(); return; }
    this.isPrepPhase = false;
    this.waveActive  = true;
    this.prepTxt.setText('');

    const waveGroups = WAVES[this.waveIndex];
    this.waveIndex++;

    // Flatten wave groups into a spawn queue
    this.spawnQueue = [];
    waveGroups.forEach(group => {
      for (let i = 0; i < group.count; i++) {
        this.spawnQueue.push({ type: group.type, delay: group.interval * i });
      }
    });
    this.spawnQueue.sort((a, b) => a.delay - b.delay);

    // Convert delays to timestamps from now
    const now = this.time.now;
    this.spawnQueue = this.spawnQueue.map(s => ({ ...s, at: now + s.delay }));

    this._updateHUD();
  }

  _processSpawnQueue(delta) {
    if (!this.spawnQueue.length && !this.enemies.length && this.waveActive) {
      this._onWaveComplete();
      return;
    }
    const now = this.time.now;
    while (this.spawnQueue.length && this.spawnQueue[0].at <= now) {
      const entry = this.spawnQueue.shift();
      this._spawnEnemy(entry.type);
    }
  }

  _onWaveComplete() {
    this.waveActive = false;
    GameState.wavesCleared = this.waveIndex;

    if (this.waveIndex >= WAVES.length) {
      this.time.delayedCall(800, () => this._victory());
      return;
    }

    // Offer mutation every 3 waves
    if (MUTATION_AFTER_WAVES.has(this.waveIndex)) {
      this.time.delayedCall(600, () => this._showMutationChoice());
    } else {
      this._beginPrep();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENEMIES
  // ═══════════════════════════════════════════════════════════════════════════

  _spawnEnemy(typeId) {
    const typeDef = ENEMY_TYPES[typeId];
    const start   = PATH_WAYPOINTS[0];

    const sprite = this.add.image(start.x, start.y, typeDef.sprite)
      .setDisplaySize(CELL_SIZE * typeDef.scale, CELL_SIZE * typeDef.scale)
      .setDepth(15);

    const enemy = {
      sprite,
      type:          typeDef,
      hp:            typeDef.hp,
      maxHp:         typeDef.hp,
      speed:         typeDef.speed,
      damage:        typeDef.damage,
      reward:        typeDef.reward,
      ecstasyReward: typeDef.ecstasyReward,
      waypointIdx:   1,
      dead:          false,
      slowMult:      1.0,
      slowTimer:     0,
    };
    this.enemies.push(enemy);
  }

  _updateEnemies(delta) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead) { this.enemies.splice(i, 1); continue; }

      // Slow countdown
      if (e.slowTimer > 0) {
        e.slowTimer -= delta;
        if (e.slowTimer <= 0) { e.slowMult = 1.0; e.sprite.clearTint(); }
      }

      const wp = PATH_WAYPOINTS[e.waypointIdx];
      if (!wp) { this._enemyHitBarrier(e); continue; }

      const dx = wp.x - e.sprite.x;
      const dy = wp.y - e.sprite.y;
      const d  = Math.sqrt(dx * dx + dy * dy);
      const spd = e.speed * e.slowMult * (delta / 1000);

      if (d < 6) {
        e.waypointIdx++;
      } else {
        e.sprite.x += (dx / d) * spd;
        e.sprite.y += (dy / d) * spd;

        // Flip sprite to face direction
        e.sprite.setFlipX(dx < 0);
      }
    }
  }

  _enemyHitBarrier(enemy) {
    this.cameras.main.shake(150, 0.007);
    this._damageBarrier(enemy.damage);
    this._killEnemy(enemy, false);
    if (this.barrierHP <= 0) this._defeat();
  }

  _damageBarrier(amount) {
    this.barrierHP = Math.max(0, this.barrierHP - amount);
    this._drawBarrier();
  }

  _doRegen() {
    if (this.gameOver) return;
    const regen = this.barrierRegen * this.muts.regenMult;
    this.barrierHP = Math.min(this.barrierMaxHP, this.barrierHP + regen);
    this._drawBarrier();
  }

  _killEnemy(enemy, dropRewards = true) {
    enemy.dead = true;
    if (dropRewards) {
      const money = Math.round(enemy.reward * this.muts.moneyGainMult);
      this._gainMoney(money);
      this._gainEcstasy(enemy.ecstasyReward * this.muts.ecstasyGainMult);
      GameState.totalKills++;
      GameState.score += money;
      this._floatText(enemy.sprite.x, enemy.sprite.y, `+${money}`, '#ffdd55');
    }
    // Death puff
    this._deathPuff(enemy.sprite.x, enemy.sprite.y, enemy.type.tint);
    enemy.sprite.destroy();
  }

  _deathPuff(x, y, color) {
    for (let i = 0; i < 6; i++) {
      const p = this.add.graphics().setDepth(18);
      p.fillStyle(color, 0.8);
      p.fillCircle(0, 0, 4 + Math.random() * 4);
      p.setPosition(x, y);
      const ang = (i / 6) * Math.PI * 2;
      this.tweens.add({
        targets: p,
        x: x + Math.cos(ang) * 30,
        y: y + Math.sin(ang) * 30,
        alpha: 0,
        duration: 400,
        onComplete: () => p.destroy(),
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ARTIFACTS
  // ═══════════════════════════════════════════════════════════════════════════

  _placeArtifact(col, row) {
    const artDef = ARTIFACT_BY_ID[this.selectedArtifactId];
    if (!artDef) return;
    const cost = Math.round(artDef.cost * this.costMult);
    if (this.money < cost) { this._flashText('Not enough money!'); return; }
    if (PATH_CELL_SET.has(`${col},${row}`)) return;
    if (this.artifacts.has(`${col},${row}`)) return;

    this._spendMoney(cost);

    const cx = col * CELL_SIZE + CELL_SIZE / 2;
    const cy = HUD_HEIGHT + row * CELL_SIZE + CELL_SIZE / 2;

    const sprite = this.add.image(cx, cy, 'totem')
      .setDisplaySize(CELL_SIZE - 8, CELL_SIZE - 8)
      .setTint(artDef.color)
      .setDepth(10);

    const art = {
      col, row, cx, cy,
      def:       artDef,
      sprite,
      fireTimer: 0,
      synergy:   1.0,
    };
    this.artifacts.set(`${col},${row}`, art);
    this._recalcSynergies();

    // Placement animation
    sprite.setScale(0.1);
    this.tweens.add({ targets: sprite, scaleX: 1, scaleY: 1, duration: 200, ease: 'Back.easeOut' });
  }

  _removeArtifact(col, row) {
    const art = this.artifacts.get(`${col},${row}`);
    if (!art) return;
    const sell = Math.round(art.def.cost * this.costMult * ARTIFACT_SELL_RATIO);
    this._gainMoney(sell);
    this._floatText(art.cx, art.cy, `+${sell}`, '#55cc55');
    art.sprite.destroy();
    this.artifacts.delete(`${col},${row}`);
    this._recalcSynergies();
  }

  _recalcSynergies() {
    const neighborOffsets = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
    this.artifacts.forEach((art, key) => {
      let adjacentCount = 0;
      neighborOffsets.forEach(([dc, dr]) => {
        if (this.artifacts.has(`${art.col + dc},${art.row + dr}`)) adjacentCount++;
      });
      // Apply geometry combo: each neighbour adds 15% synergy, capped at 2×
      art.synergy = Math.min(2.0, 1.0 + adjacentCount * 0.15 * this.muts.synergyBuff);
    });
  }

  _updateArtifactFire(delta) {
    this.artifacts.forEach(art => {
      art.fireTimer -= delta;
      if (art.fireTimer > 0) return;

      const cd = art.def.fireRate * this.muts.fireRateMult;
      art.fireTimer = cd;

      const range  = art.def.range * this.muts.rangeMult;
      const target = this._nearestEnemy(art.cx, art.cy, range);
      if (target) this._fireProjectile(art, target);
    });
  }

  _nearestEnemy(ox, oy, range) {
    let best = null, bestD2 = range * range;
    this.enemies.forEach(e => {
      if (e.dead) return;
      const d2 = dist2(ox, oy, e.sprite.x, e.sprite.y);
      if (d2 < bestD2) { bestD2 = d2; best = e; }
    });
    return best;
  }

  _fireProjectile(art, target) {
    const proj = this.add.graphics().setDepth(18);
    proj.fillStyle(art.def.color, 1);
    proj.fillCircle(0, 0, 5);
    proj.setPosition(art.cx, art.cy);

    this.projectiles.push({
      gfx:    proj,
      target,
      art,
      speed:  320,
    });
  }

  _updateProjectiles(delta) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];

      if (!p.target || p.target.dead) {
        p.gfx.destroy();
        this.projectiles.splice(i, 1);
        continue;
      }

      const dx = p.target.sprite.x - p.gfx.x;
      const dy = p.target.sprite.y - p.gfx.y;
      const d  = Math.sqrt(dx * dx + dy * dy);

      if (d < 12) {
        this._applyHit(p);
        p.gfx.destroy();
        this.projectiles.splice(i, 1);
      } else {
        const spd = p.speed * (delta / 1000);
        p.gfx.x += (dx / d) * spd;
        p.gfx.y += (dy / d) * spd;
      }
    }
  }

  _applyHit(proj) {
    const { target, art } = proj;
    if (target.dead) return;

    let dmg = art.def.damage * art.synergy;
    if (art.def.id === 'dark_sigil') dmg *= this.muts.darkDamageMult;

    target.hp -= dmg;

    if (art.def.slow > 0) {
      target.slowMult  = art.def.slow;
      target.slowTimer = art.def.slowDuration;
      target.sprite.setTint(0x4488cc);
    }

    if (art.def.healBarrier > 0) {
      this.barrierHP = Math.min(this.barrierMaxHP, this.barrierHP + art.def.healBarrier);
      this._drawBarrier();
    }

    if (target.hp <= 0) this._killEnemy(target);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INPUT
  // ═══════════════════════════════════════════════════════════════════════════

  _onPointerMove(pointer) {
    if (pointer.x >= FIELD_WIDTH) { this.hoverGfx.setVisible(false); return; }
    const col = Math.floor(pointer.x / CELL_SIZE);
    const row = Math.floor((pointer.y - HUD_HEIGHT) / CELL_SIZE);
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) {
      this.hoverGfx.setVisible(false); return;
    }
    this.hoverCell = { col, row };

    if (this.selectedArtifactId) {
      const blocked = PATH_CELL_SET.has(`${col},${row}`) || this.artifacts.has(`${col},${row}`);
      this.hoverGfx.clear().setVisible(true);
      this.hoverGfx.lineStyle(2, blocked ? 0xff3300 : 0x55ff55, 0.9);
      this.hoverGfx.strokeRect(col * CELL_SIZE + 2, HUD_HEIGHT + row * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
    }
  }

  _onPointerDown(pointer) {
    if (this.gameOver) return;
    const col = Math.floor(pointer.x / CELL_SIZE);
    const row = Math.floor((pointer.y - HUD_HEIGHT) / CELL_SIZE);

    // Right click = clear selection or sell
    if (pointer.rightButtonDown()) {
      if (this.artifacts.has(`${col},${row}`)) {
        this._removeArtifact(col, row);
      } else {
        this._clearSelection();
      }
      return;
    }

    // Left click in field
    if (pointer.x < FIELD_WIDTH && row >= 0 && row < GRID_ROWS) {
      if (this.selectedArtifactId) {
        this._placeArtifact(col, row);
      } else if (this.artifacts.has(`${col},${row}`)) {
        this._showArtifactInfo(col, row);
      }
    }
  }

  _clearSelection() {
    this.selectedArtifactId = null;
    this.hoverGfx.setVisible(false);
  }

  _showArtifactInfo(col, row) {
    const art = this.artifacts.get(`${col},${row}`);
    if (!art) return;
    const sell = Math.round(art.def.cost * this.costMult * ARTIFACT_SELL_RATIO);
    // Show effective values after mutations are applied
    const effectiveDmg   = (art.def.damage * art.synergy *
      (art.def.id === 'dark_sigil' ? this.muts.darkDamageMult : 1)).toFixed(1);
    const effectiveRange = Math.round(art.def.range * this.muts.rangeMult);
    const effectiveRate  = Math.round(art.def.fireRate * this.muts.fireRateMult);
    this.infoTxt.setText(
      `${art.def.name}\n` +
      `DMG: ${effectiveDmg}  Range: ${effectiveRange}  Rate: ${effectiveRate}ms\n` +
      `Synergy: ×${art.synergy.toFixed(1)}`
    );
    this.sellTxt.setText(`Right-click to sell for 💰${sell}`);
    this.infoTxt.setVisible(true);
    this.sellTxt.setVisible(true);
    // Hide after 3s
    this.time.delayedCall(3000, () => { this.infoTxt.setVisible(false); this.sellTxt.setVisible(false); });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RESOURCES
  // ═══════════════════════════════════════════════════════════════════════════

  _gainMoney(amount) {
    this.money += amount;
    this._updateHUD();
  }

  _spendMoney(amount) {
    this.money -= amount;
    this._updateHUD();
  }

  _gainEcstasy(amount) {
    this.ecstasy = Math.min(this.ecstasyMax, this.ecstasy + amount);
    this._updateHUD();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HERO ULTIMATE
  // ═══════════════════════════════════════════════════════════════════════════

  _activateUltimate() {
    if (this.ecstasy < this.ecstasyMax) return;
    this.ecstasy = 0;

    const key = this.hero.key || this.heroKey;

    if (key === 'borislava') {
      // Sacred Pulse: stun all + heal barrier
      this.enemies.forEach(e => {
        if (!e.dead) { e.slowMult = 0; e.slowTimer = 2000; e.sprite.setTint(0xaa55ff); }
      });
      this.barrierHP = Math.min(this.barrierMaxHP, this.barrierHP + 30);
      this._drawBarrier();
      this._screenFlash(0x9966ff);
      this._floatText(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'SACRED PULSE!', '#cc88ff', 24);

    } else if (key === 'nazar') {
      // Void Storm: 60 dmg + slow all
      this.enemies.forEach(e => {
        if (e.dead) return;
        e.hp -= 60;
        e.slowMult  = 0.5;
        e.slowTimer = 3000;
        e.sprite.setTint(0x004466);
        if (e.hp <= 0) this._killEnemy(e);
      });
      this._screenFlash(0x00ccff);
      this._floatText(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'VOID STORM!', '#44ddff', 24);

    } else if (key === 'mar_ta') {
      // Iron Rage: 100 dmg to all
      this.enemies.forEach(e => {
        if (e.dead) return;
        e.hp -= 100;
        if (e.hp <= 0) this._killEnemy(e);
      });
      this.cameras.main.shake(300, 0.012);
      this._screenFlash(0xff6633);
      this._floatText(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'IRON RAGE!', '#ff8855', 24);
    }

    this._updateHUD();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MUTATION SELECTION
  // ═══════════════════════════════════════════════════════════════════════════

  _showMutationChoice() {
    const offered = pick3(MUTATIONS);
    const { width, height } = this.scale;

    // Dark overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75).setDepth(50);

    const panel = this.add.graphics().setDepth(51);
    panel.fillStyle(0x08001a, 0.97);
    panel.fillRoundedRect(width / 2 - 480, 160, 960, 400, 12);
    panel.lineStyle(2, 0x6600cc, 1);
    panel.strokeRoundedRect(width / 2 - 480, 160, 960, 400, 12);

    this.add.text(width / 2, 196, '⬡  CHOOSE A MUTATION  ⬡', {
      fontFamily: 'serif', fontSize: '26px', color: '#cc88ff',
      stroke: '#330055', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(52);

    const cleanup = (objects) => objects.forEach(o => o?.destroy());
    const uiObjects = [overlay, panel];

    offered.forEach((mut, i) => {
      const bx = width / 2 - 340 + i * 280, by = 240, bw = 240, bh = 280;
      const bg = this.add.graphics().setDepth(51);
      const draw = (hov) => {
        bg.clear();
        bg.fillStyle(hov ? 0x1a0033 : 0x0d0020, 0.95);
        bg.fillRoundedRect(bx, by, bw, bh, 8);
        bg.lineStyle(hov ? 2 : 1, mut.color, hov ? 1 : 0.6);
        bg.strokeRoundedRect(bx, by, bw, bh, 8);
      };
      draw(false);
      uiObjects.push(bg);

      const mutColor = '#' + mut.color.toString(16).padStart(6, '0');
      const nm = this.add.text(bx + bw / 2, by + 20, mut.name, {
        fontFamily: 'serif', fontSize: '18px', color: mutColor, align: 'center',
      }).setOrigin(0.5, 0).setDepth(52);
      const ds = this.add.text(bx + bw / 2, by + 58, mut.description, {
        fontFamily: 'sans-serif', fontSize: '14px', color: '#ccaaee', align: 'center',
        wordWrap: { width: bw - 20 },
      }).setOrigin(0.5, 0).setDepth(52);
      uiObjects.push(nm, ds);

      const zone = this.add.zone(bx + bw / 2, by + bh / 2, bw, bh)
        .setInteractive({ useHandCursor: true }).setDepth(53);
      uiObjects.push(zone);
      zone.on('pointerover',  () => draw(true));
      zone.on('pointerout',   () => draw(false));
      zone.on('pointerdown',  () => {
        this._applyMutation(mut);
        cleanup(uiObjects);
        this._beginPrep();
      });
    });
  }

  _applyMutation(mut) {
    switch (mut.effect) {
      case 'fireRateMult':       this.muts.fireRateMult    *= mut.value; break;
      case 'darkDamageMult':     this.muts.darkDamageMult  *= mut.value; break;
      case 'barrierMaxHPBonus':
        this.barrierMaxHP += mut.value;
        this.barrierHP     = Math.min(this.barrierMaxHP, this.barrierHP + mut.value);
        this._drawBarrier();
        break;
      case 'ecstasyGainMult':    this.muts.ecstasyGainMult *= mut.value; break;
      case 'synergyBuff':        this.muts.synergyBuff     *= mut.value; this._recalcSynergies(); break;
      case 'moneyGainMult':      this.muts.moneyGainMult   *= mut.value; break;
      case 'rangeMult':          this.muts.rangeMult        *= mut.value; break;
      case 'regenMult':          this.muts.regenMult        *= mut.value; break;
    }
    this._floatText(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60, `✦ ${mut.name}`, '#cc88ff', 20);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TUTORIAL
  // ═══════════════════════════════════════════════════════════════════════════

  _showTutorial() {
    const { width, height } = this.scale;
    const steps = [
      'Place ARTIFACTS on yellow (buildable) tiles to defend the Mausoleum.',
      'The dark path tiles cannot be built on.\nEnemies follow the winding path.',
      'Defeat enemies to earn 💰 money and fill your ⚡ ECSTASY meter.',
      'When Ecstasy is full, press ULTIMATE for your hero\'s special ability.',
      'Every 3 waves, choose a MUTATION to power up your defences.',
      'If the BARRIER HP drops to 0 — you lose.\nRight-click a totem to sell it.',
    ];
    let step = 0;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6).setDepth(60);
    const bg = this.add.graphics().setDepth(61);
    const drawBg = () => {
      bg.clear();
      bg.fillStyle(0x06000f, 0.97);
      bg.fillRoundedRect(width / 2 - 340, height / 2 - 100, 680, 220, 10);
      bg.lineStyle(2, 0x9966ff, 1);
      bg.strokeRoundedRect(width / 2 - 340, height / 2 - 100, 680, 220, 10);
    };
    drawBg();

    const titleTxt = this.add.text(width / 2, height / 2 - 84, 'TUTORIAL  —  Mausoleum 2.2', {
      fontFamily: 'serif', fontSize: '20px', color: '#9966ff',
    }).setOrigin(0.5).setDepth(62);

    const bodyTxt = this.add.text(width / 2, height / 2 - 30, steps[0], {
      fontFamily: 'sans-serif', fontSize: '17px', color: '#ccaaee',
      align: 'center', wordWrap: { width: 620 },
    }).setOrigin(0.5).setDepth(62);

    const progTxt = this.add.text(width / 2, height / 2 + 62, `1 / ${steps.length}`, {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#665588',
    }).setOrigin(0.5).setDepth(62);

    const nextBg  = this.add.graphics().setDepth(61);
    const drawBtn = (lbl, hov) => {
      nextBg.clear();
      nextBg.fillStyle(hov ? 0x9966ff : 0x220033, 0.9);
      nextBg.fillRoundedRect(width / 2 - 70, height / 2 + 80, 140, 38, 6);
      nextBg.lineStyle(1, 0x9966ff, 1);
      nextBg.strokeRoundedRect(width / 2 - 70, height / 2 + 80, 140, 38, 6);
    };
    drawBtn('NEXT ▶', false);
    const nextTxt  = this.add.text(width / 2, height / 2 + 99, 'NEXT ▶', {
      fontFamily: 'sans-serif', fontSize: '15px', color: '#cc88ff',
    }).setOrigin(0.5).setDepth(62);

    const nextZone = this.add.zone(width / 2, height / 2 + 99, 140, 38).setInteractive({ useHandCursor: true }).setDepth(63);
    nextZone.on('pointerover',  () => drawBtn('', true));
    nextZone.on('pointerout',   () => drawBtn('', false));
    nextZone.on('pointerdown',  () => {
      step++;
      if (step >= steps.length) {
        [overlay, bg, titleTxt, bodyTxt, progTxt, nextBg, nextTxt, nextZone].forEach(o => o.destroy());
        GameState.tutorialSeen = true;
        this._beginPrep();
        return;
      }
      bodyTxt.setText(steps[step]);
      progTxt.setText(`${step + 1} / ${steps.length}`);
      nextTxt.setText(step === steps.length - 1 ? 'BEGIN' : 'NEXT ▶');
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VICTORY / DEFEAT
  // ═══════════════════════════════════════════════════════════════════════════

  _victory() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.waveActive = false;
    this._showEndScreen(true);
  }

  _defeat() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.waveActive = false;
    this.cameras.main.shake(500, 0.015);
    this.time.delayedCall(600, () => this._showEndScreen(false));
  }

  _showEndScreen(won) {
    const { width, height } = this.scale;
    this.cameras.main.fadeIn(200);

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, won ? 0.6 : 0.8).setDepth(70);

    const bg = this.add.graphics().setDepth(71);
    bg.fillStyle(won ? 0x06000f : 0x0f0000, 0.97);
    bg.fillRoundedRect(width / 2 - 320, height / 2 - 180, 640, 360, 14);
    bg.lineStyle(3, won ? 0x9966ff : 0xff3300, 1);
    bg.strokeRoundedRect(width / 2 - 320, height / 2 - 180, 640, 360, 14);

    const titleColor = won ? '#cc88ff' : '#ff5533';
    const title = won ? '⬡  VICTORY  ⬡' : '✖  BARRIER FALLEN  ✖';
    this.add.text(width / 2, height / 2 - 148, title, {
      fontFamily: 'serif', fontSize: '36px', color: titleColor,
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(72);

    const sub = won
      ? `All ${WAVES.length} waves repelled!\nThe Mausoleum endures.`
      : `The Void broke through.\nThe Mausoleum falls silent.`;
    this.add.text(width / 2, height / 2 - 60, sub, {
      fontFamily: 'sans-serif', fontSize: '18px', color: '#ccaadd',
      align: 'center',
    }).setOrigin(0.5).setDepth(72);

    // Stats
    const stats = [
      `Waves cleared: ${GameState.wavesCleared} / ${WAVES.length}`,
      `Total kills:   ${GameState.totalKills}`,
      `Score:         ${GameState.score}`,
      `Barrier HP:    ${Math.ceil(this.barrierHP)} / ${this.barrierMaxHP}`,
    ].join('\n');
    this.add.text(width / 2, height / 2 + 30, stats, {
      fontFamily: 'sans-serif', fontSize: '16px', color: '#aaaacc',
      align: 'center',
    }).setOrigin(0.5).setDepth(72);

    // Buttons
    this._endButton(width / 2 - 110, height / 2 + 130, 'RETRY', won ? 0x6633aa : 0x660000, () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        GameState.score = 0; GameState.totalKills = 0; GameState.wavesCleared = 0;
        this.scene.restart({ heroKey: this.heroKey });
      });
    });
    this._endButton(width / 2 + 110, height / 2 + 130, 'MAIN MENU', 0x222255, () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MenuScene'));
    });
  }

  _endButton(x, y, label, bgColor, cb) {
    const g = this.add.graphics().setDepth(72);
    const draw = (h) => {
      g.clear();
      g.fillStyle(h ? bgColor : 0x000000, 0.9);
      g.fillRoundedRect(x - 90, y - 22, 180, 44, 7);
      g.lineStyle(2, bgColor, 1);
      g.strokeRoundedRect(x - 90, y - 22, 180, 44, 7);
    };
    draw(false);
    this.add.text(x, y, label, {
      fontFamily: 'sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5).setDepth(73);
    const z = this.add.zone(x, y, 180, 44).setInteractive({ useHandCursor: true }).setDepth(74);
    z.on('pointerover',  () => draw(true));
    z.on('pointerout',   () => draw(false));
    z.on('pointerdown',  cb);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VISUAL FX HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  _floatText(x, y, msg, color, size = 16) {
    const t = this.add.text(x, y, msg, {
      fontFamily: 'sans-serif', fontSize: `${size}px`,
      fontStyle: 'bold', color,
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(25);
    this.tweens.add({
      targets: t, y: y - 48, alpha: 0, duration: 900,
      onComplete: () => t.destroy(),
    });
  }

  _flashText(msg) {
    this._floatText(FIELD_WIDTH / 2, GAME_HEIGHT / 2, msg, '#ff5533', 18);
  }

  _screenFlash(color) {
    const flash = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, color, 0.35
    ).setDepth(40);
    this.tweens.add({
      targets: flash, alpha: 0, duration: 500, onComplete: () => flash.destroy(),
    });
  }
}
