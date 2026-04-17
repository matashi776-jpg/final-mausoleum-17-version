import GameState from '../game/state.js';
import { HEROES } from '../game/constants.js';

export default class HeroSelectScene extends Phaser.Scene {
  constructor() { super({ key: 'HeroSelectScene' }); }

  create() {
    const { width, height } = this.scale;
    this._selected = GameState.heroKey || 'borislava';

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x04000e);

    const gfx = this.add.graphics();
    gfx.lineStyle(1, 0x1a0040, 0.3);
    for (let x = 0; x <= width; x += 60) gfx.lineBetween(x, 0, x, height);
    for (let y = 0; y <= height; y += 60) gfx.lineBetween(0, y, width, y);

    // Header
    this.add.text(width / 2, 42, 'CHOOSE YOUR KEEPER', {
      fontFamily: 'serif', fontSize: '36px',
      color: '#cc88ff', stroke: '#330055', strokeThickness: 3,
    }).setOrigin(0.5);

    // Hero cards
    const heroKeys = Object.keys(HEROES);
    this._cardGraphics = {};
    this._cardX = { borislava: 240, nazar: 640, mar_ta: 1040 };

    heroKeys.forEach((key, i) => {
      this._buildCard(key, this._cardX[key], 330);
    });

    // Info / description panel
    this._descBg = this.add.graphics();
    this._descTitle = this.add.text(width / 2, 582, '', {
      fontFamily: 'serif', fontSize: '20px', color: '#ffcc55',
    }).setOrigin(0.5);
    this._descBody = this.add.text(width / 2, 618, '', {
      fontFamily: 'sans-serif', fontSize: '15px', color: '#ccaadd',
      align: 'center', wordWrap: { width: 600 },
    }).setOrigin(0.5, 0);
    this._ultimateText = this.add.text(width / 2, 670, '', {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#88ddff',
      align: 'center',
    }).setOrigin(0.5);

    this._selectHero(this._selected, false);

    // Begin button
    const beginBg = this.add.graphics();
    const drawBegin = (h) => {
      beginBg.clear();
      beginBg.fillStyle(h ? 0x9966ff : 0x220033, 0.9);
      beginBg.fillRoundedRect(width / 2 - 130, 692, 260, 48, 8);
      beginBg.lineStyle(2, 0x9966ff, 1);
      beginBg.strokeRoundedRect(width / 2 - 130, 692, 260, 48, 8);
    };
    drawBegin(false);
    const beginTxt = this.add.text(width / 2, 716, 'BEGIN RITUAL', {
      fontFamily: 'sans-serif', fontSize: '22px', fontStyle: 'bold', color: '#cc88ff',
    }).setOrigin(0.5);
    const beginZone = this.add.zone(width / 2, 716, 260, 48).setInteractive({ useHandCursor: true });
    beginZone.on('pointerover',  () => drawBegin(true));
    beginZone.on('pointerout',   () => drawBegin(false));
    beginZone.on('pointerdown',  () => this._startGame());

    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  // ─── Card Builder ─────────────────────────────────────────────────────────

  _buildCard(key, cx, cy) {
    const hero = HEROES[key];
    const CARD_W = 220, CARD_H = 300;

    const bg = this.add.graphics();
    this._cardGraphics[key] = bg;
    this._drawCard(bg, cx, cy, hero.color, false);

    // Portrait
    const portrait = this.add.image(cx, cy - 60, key)
      .setDisplaySize(100, 140);

    // Name
    this.add.text(cx, cy + 80, hero.name, {
      fontFamily: 'serif', fontSize: '22px',
      color: '#' + hero.color.toString(16).padStart(6, '0'),
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5);

    // Title
    this.add.text(cx, cy + 108, hero.title, {
      fontFamily: 'sans-serif', fontSize: '13px', color: '#998aaa',
    }).setOrigin(0.5);

    // Click zone
    const zone = this.add.zone(cx, cy, CARD_W, CARD_H).setInteractive({ useHandCursor: true });
    zone.on('pointerover',  () => { if (this._selected !== key) this._hoverCard(key, true); });
    zone.on('pointerout',   () => { if (this._selected !== key) this._hoverCard(key, false); });
    zone.on('pointerdown',  () => this._selectHero(key));
  }

  _drawCard(gfx, cx, cy, color, selected) {
    const CARD_W = 220, CARD_H = 300;
    gfx.clear();
    gfx.fillStyle(selected ? 0x150025 : 0x0a0015, selected ? 0.95 : 0.8);
    gfx.fillRoundedRect(cx - CARD_W / 2, cy - CARD_H / 2, CARD_W, CARD_H, 10);
    gfx.lineStyle(selected ? 3 : 1, color, selected ? 1 : 0.5);
    gfx.strokeRoundedRect(cx - CARD_W / 2, cy - CARD_H / 2, CARD_W, CARD_H, 10);
    if (selected) {
      gfx.lineStyle(1, color, 0.3);
      gfx.strokeRoundedRect(cx - CARD_W / 2 - 4, cy - CARD_H / 2 - 4, CARD_W + 8, CARD_H + 8, 13);
    }
  }

  _hoverCard(key, hovered) {
    const hero = HEROES[key];
    this._drawCard(this._cardGraphics[key], this._cardX[key], 330, hero.color, hovered);
  }

  _selectHero(key, animate = true) {
    const prev = this._selected;
    this._selected = key;

    Object.keys(HEROES).forEach(k => {
      const h = HEROES[k];
      this._drawCard(this._cardGraphics[k], this._cardX[k], 330, h.color, k === key);
    });

    const hero = HEROES[key];
    this._descTitle.setText(hero.name + '  —  ' + hero.title);
    this._descBody.setText(hero.description);
    this._ultimateText.setText('⚡ ULTIMATE: ' + hero.ultimateName + '  •  ' + hero.ultimateDesc);

    if (animate && prev !== key) {
      this.tweens.add({
        targets:  this._descBody,
        alpha:    { from: 0, to: 1 },
        duration: 300,
      });
    }
  }

  _startGame() {
    GameState.heroKey = this._selected;
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene', { heroKey: this._selected });
    });
  }
}
