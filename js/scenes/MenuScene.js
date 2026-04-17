import { AudioManager } from '../game/audio.js';

export default class MenuScene extends Phaser.Scene {
  constructor() { super({ key: 'MenuScene' }); }

  create() {
    this.audio = new AudioManager(this);
    this.audio.playMusic('main_theme');

    const { width, height } = this.scale;

    // Background
    this.add.image(width / 2, height / 2, 'background_menu')
      .setDisplaySize(width, height)
      .setAlpha(0.85);

    // Dark overlay vignette
    const vignette = this.add.graphics();
    vignette.fillStyle(0x000000, 0.4);
    vignette.fillCircle(width / 2, height / 2, 600);

    // Animated floating particles
    this._spawnParticles();

    // Title
    const titleShadow = this.add.text(width / 2 + 3, 183, 'MAUSOLEUM  2.2', {
      fontFamily: 'serif', fontSize: '72px',
      color: '#1a0033', stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5).setAlpha(0.7);

    const title = this.add.text(width / 2, 180, 'MAUSOLEUM  2.2', {
      fontFamily: 'serif', fontSize: '72px',
      color: '#cc88ff', stroke: '#330055', strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: [title, titleShadow], alpha: { from: 0, to: 1 }, duration: 1200, ease: 'Power2' });
    this._pulseTween(title, 1, 1.03, 2400);

    // Sub-title
    const sub = this.add.text(width / 2, 260, 'Defend the Mausoleum. Hold the Barrier. Survive the Void.', {
      fontFamily: 'sans-serif', fontSize: '18px',
      color: '#8866aa', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: sub, alpha: 0.9, delay: 600, duration: 1000 });

    // Separator rune line
    const line = this.add.graphics().setAlpha(0);
    line.lineStyle(1, 0x7744aa, 0.8);
    line.lineBetween(width / 2 - 300, 295, width / 2 + 300, 295);
    this.tweens.add({ targets: line, alpha: 1, delay: 800, duration: 800 });

    // Buttons
    this._makeButton(width / 2, 380, 'BEGIN', 0x9966ff, 0xcc88ff, () => {
      this.audio.fadeMusicOut(800);
      this._transition('IntroScene');
    });

    this._makeButton(width / 2, 460, 'HERO SELECT', 0x006688, 0x44aacc, () => {
      this.audio.fadeMusicOut(800);
      this._transition('HeroSelectScene');
    });

    // Version + credits
    this.add.text(width - 12, height - 12, 'v1.0.0  •  Mausoleum Project', {
      fontFamily: 'sans-serif', fontSize: '13px', color: '#443366',
    }).setOrigin(1, 1);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  _makeButton(x, y, label, bgColor, textColor, onDown) {
    const bg = this.add.graphics();
    const draw = (hovered) => {
      bg.clear();
      bg.fillStyle(hovered ? bgColor : 0x000000, hovered ? 0.9 : 0.5);
      bg.fillRoundedRect(x - 140, y - 26, 280, 52, 8);
      bg.lineStyle(2, hovered ? 0xffffff : bgColor, 0.9);
      bg.strokeRoundedRect(x - 140, y - 26, 280, 52, 8);
    };
    draw(false);

    const txt = this.add.text(x, y, label, {
      fontFamily: 'sans-serif', fontSize: '22px', fontStyle: 'bold',
      color: '#' + textColor.toString(16).padStart(6, '0'),
    }).setOrigin(0.5);

    const zone = this.add.zone(x, y, 280, 52).setInteractive({ useHandCursor: true });
    zone.on('pointerover',  () => { draw(true);  this.tweens.add({ targets: txt, scaleX: 1.05, scaleY: 1.05, duration: 100 }); });
    zone.on('pointerout',   () => { draw(false); this.tweens.add({ targets: txt, scaleX: 1, scaleY: 1, duration: 100 }); });
    zone.on('pointerdown',  onDown);
  }

  _pulseTween(target, from, to, duration) {
    this.tweens.add({
      targets: target, scaleX: to, scaleY: to,
      duration, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  _spawnParticles() {
    const { width, height } = this.scale;
    for (let i = 0; i < 30; i++) {
      const px = Phaser.Math.Between(0, width);
      const py = Phaser.Math.Between(0, height);
      const dot = this.add.graphics();
      dot.fillStyle(0x9955ff, 0.5 + Math.random() * 0.4);
      dot.fillCircle(0, 0, 1 + Math.random() * 2);
      dot.setPosition(px, py);
      this.tweens.add({
        targets: dot,
        y:       py - Phaser.Math.Between(40, 120),
        alpha:   { from: 0.7, to: 0 },
        duration: Phaser.Math.Between(3000, 7000),
        delay:    Phaser.Math.Between(0, 4000),
        repeat:  -1,
        yoyo:    false,
        onRepeat: () => { dot.x = Phaser.Math.Between(0, width); dot.y = Phaser.Math.Between(height / 2, height); dot.setAlpha(0.7); },
      });
    }
  }

  _transition(sceneKey) {
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(sceneKey);
    });
  }
}
