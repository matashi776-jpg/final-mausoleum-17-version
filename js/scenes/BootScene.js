/**
 * BootScene
 * Loads all game assets. For every asset that fails to load (or is absent),
 * a programmatically-generated fallback texture is created so the game is
 * always fully playable without external files.
 */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
    this._failedKeys = new Set();
  }

  // ─── Preload ──────────────────────────────────────────────────────────────

  preload() {
    this._buildLoadingUI();

    // Track any file that fails so we can generate a fallback in create()
    this.load.on('loaderror', (file) => {
      this._failedKeys.add(file.key);
    });

    this.load.on('progress', (value) => {
      if (this._progressBar) {
        this._progressBar.clear();
        this._progressBar.fillStyle(0x9966ff, 1);
        this._progressBar.fillRect(340, 348, 600 * value, 24);
      }
    });

    // Real asset paths – will be overridden by generated fallbacks if missing
    this.load.image('background_menu',    'assets/images/background_menu.jpg');
    this.load.image('background_level_1', 'assets/images/background_level_1.jpg');
    this.load.image('borislava',          'assets/images/borislava.png');
    this.load.image('nazar',              'assets/images/nazar.png');
    this.load.image('mar_ta',             'assets/images/mar_ta.png');
    this.load.image('enemy_creature',     'assets/images/enemy_creature.png');
    this.load.image('enemy_boss_crawler', 'assets/images/enemy_boss_crawler.png');
    this.load.image('totem',              'assets/images/totem.png');
    this.load.image('faith_energy_bar',   'assets/images/faith_energy_bar.png');

    this.load.audio('main_theme', 'assets/audio/main_theme.mp3');
  }

  // ─── Create ───────────────────────────────────────────────────────────────

  create() {
    this._generateFallbackTextures();

    // Short tween then switch to menu
    this.tweens.add({
      targets:    this._loadText,
      alpha:      0,
      duration:   400,
      onComplete: () => this.scene.start('MenuScene'),
    });
  }

  // ─── Loading UI ───────────────────────────────────────────────────────────

  _buildLoadingUI() {
    const { width, height } = this.scale;

    // Dark background
    this.add.rectangle(width / 2, height / 2, width, height, 0x060010);

    // Title
    this.add.text(width / 2, height / 2 - 80, 'MAUSOLEUM  2.2', {
      fontFamily: 'serif',
      fontSize:   '42px',
      color:      '#9966ff',
      stroke:     '#330055',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // Progress track
    const track = this.add.graphics();
    track.lineStyle(2, 0x4400aa, 1);
    track.strokeRect(338, 346, 604, 28);

    this._progressBar = this.add.graphics();

    this._loadText = this.add.text(width / 2, height / 2 + 60, 'Loading…', {
      fontFamily: 'sans-serif',
      fontSize:   '18px',
      color:      '#8866cc',
    }).setOrigin(0.5);
  }

  // ─── Procedural Texture Generation ───────────────────────────────────────

  _generateFallbackTextures() {
    this._genMenuBackground();
    this._genLevelBackground();
    this._genHeroSprite('borislava', 0x9966ff, 0xcc88ff, 'female');
    this._genHeroSprite('nazar',     0x00aadd, 0x44ddff, 'mage');
    this._genHeroSprite('mar_ta',    0xff6633, 0xff9966, 'warrior');
    this._genEnemySprite('enemy_creature',     0xcc2200, 80);
    this._genEnemySprite('enemy_boss_crawler', 0x880000, 128);
    this._genTotemSprite();
    this._genEnergyBar();
  }

  _gfx() {
    // Helper: create an off-screen graphics object
    return this.make.graphics({ add: false });
  }

  _genMenuBackground() {
    if (this.textures.exists('background_menu') && !this._failedKeys.has('background_menu')) return;
    const g = this._gfx();
    // Deep void gradient layers
    g.fillStyle(0x04000e); g.fillRect(0, 0, 1280, 720);
    g.fillStyle(0x0d0028, 0.6);
    for (let y = 0; y < 720; y += 2) {
      g.fillRect(0, y, 1280, 1);
    }
    // Subtle grid
    g.lineStyle(1, 0x1a0040, 0.25);
    for (let x = 0; x <= 1280; x += 60) g.lineBetween(x, 0, x, 720);
    for (let y = 0; y <= 720;  y += 60) g.lineBetween(0, y, 1280, y);
    // Rune circle
    g.lineStyle(1, 0x6600aa, 0.5);
    g.strokeCircle(640, 360, 220);
    g.strokeCircle(640, 360, 260);
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      g.lineBetween(
        640 + Math.cos(a) * 220, 360 + Math.sin(a) * 220,
        640 + Math.cos(a) * 260, 360 + Math.sin(a) * 260
      );
    }
    // Stars
    g.fillStyle(0xffffff, 0.6);
    for (let i = 0; i < 120; i++) {
      const sx = (i * 137.5) % 1280;
      const sy = (i * 97.3)  % 720;
      g.fillRect(sx, sy, 1, 1);
    }
    g.generateTexture('background_menu', 1280, 720);
    g.destroy();
  }

  _genLevelBackground() {
    if (this.textures.exists('background_level_1') && !this._failedKeys.has('background_level_1')) return;
    const g = this._gfx();
    g.fillStyle(0x060816); g.fillRect(0, 0, 1280, 720);
    // Stone slab pattern
    g.lineStyle(1, 0x0f1f30, 0.6);
    for (let x = 0; x <= 960; x += 80) g.lineBetween(x, 60, x, 720);
    for (let y = 60; y <= 720; y += 80) g.lineBetween(0, y, 960, y);
    // Right panel tint
    g.fillStyle(0x050510, 0.8);
    g.fillRect(960, 0, 320, 720);
    g.generateTexture('background_level_1', 1280, 720);
    g.destroy();
  }

  _genHeroSprite(key, bodyColor, accentColor, style) {
    if (this.textures.exists(key) && !this._failedKeys.has(key)) return;
    const W = 120, H = 180;
    const g = this._gfx();
    // Silhouette
    g.fillStyle(bodyColor);
    g.fillCircle(60, 34, 24);            // head
    g.fillRect(28, 56, 64, 80);          // torso
    if (style === 'female') {
      g.fillTriangle(28, 136, 92, 136, 60, 180); // robe
    } else if (style === 'mage') {
      g.fillTriangle(20, 140, 100, 140, 60, 180); // robe wide
      g.fillRect(90, 30, 8, 110);                  // staff
    } else {
      g.fillRect(28, 136, 26, 44); // left leg
      g.fillRect(66, 136, 26, 44); // right leg
    }
    // Accent glow
    g.fillStyle(accentColor, 0.5);
    g.fillCircle(60, 34, 28);
    g.generateTexture(key, W, H);
    g.destroy();
  }

  _genEnemySprite(key, color, size) {
    if (this.textures.exists(key) && !this._failedKeys.has(key)) return;
    const g = this._gfx();
    const h = size, w = size;
    const cx = w / 2, cy = h / 2, r = size * 0.36;
    // Angular creature shape
    g.fillStyle(color);
    g.fillTriangle(cx, cy - r, cx - r, cy + r * 0.7, cx + r, cy + r * 0.7);
    g.fillTriangle(cx - r * 0.5, cy - r * 0.3, cx - r * 1.1, cy - r * 0.6, cx - r * 0.7, cy + r * 0.4);
    g.fillTriangle(cx + r * 0.5, cy - r * 0.3, cx + r * 1.1, cy - r * 0.6, cx + r * 0.7, cy + r * 0.4);
    // Eyes
    g.fillStyle(0xffff00);
    g.fillCircle(cx - 6, cy - r * 0.1, 4);
    g.fillCircle(cx + 6, cy - r * 0.1, 4);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  _genTotemSprite() {
    if (this.textures.exists('totem') && !this._failedKeys.has('totem')) return;
    const g = this._gfx();
    // Crystal pillar
    g.fillStyle(0x7733cc);
    g.fillRect(28, 20, 24, 50);
    // Crystal tip
    g.fillTriangle(14, 20, 66, 20, 40, 2);
    // Base
    g.fillStyle(0x4400aa);
    g.fillRect(16, 68, 48, 12);
    // Glow
    g.fillStyle(0xcc88ff, 0.4);
    g.fillCircle(40, 10, 14);
    g.generateTexture('totem', 80, 80);
    g.destroy();
  }

  _genEnergyBar() {
    if (this.textures.exists('faith_energy_bar') && !this._failedKeys.has('faith_energy_bar')) return;
    const g = this._gfx();
    g.fillStyle(0x224422);
    g.fillRect(0, 0, 300, 28);
    g.lineStyle(2, 0x55aa55);
    g.strokeRect(0, 0, 300, 28);
    g.generateTexture('faith_energy_bar', 300, 28);
    g.destroy();
  }
}
