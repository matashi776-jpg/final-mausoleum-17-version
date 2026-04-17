/**
 * IntroScene – lore introduction (scroll + skip).
 * References: Borislava, Nazar, Mar-ta, Mausoleum 2.2, faith energy / ecstasy.
 */
export default class IntroScene extends Phaser.Scene {
  constructor() { super({ key: 'IntroScene' }); }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x02000a);

    // Subtle star field
    const gfx = this.add.graphics();
    gfx.fillStyle(0xffffff, 0.5);
    for (let i = 0; i < 80; i++) {
      gfx.fillRect((i * 173) % width, (i * 113) % height, 1, 1);
    }

    const loreText = [
      '~ The Age of Silence ~',
      '',
      'When the great Mausoleum still stood at the crossroads',
      'of the living world and the endless Void …',
      '',
      'Three keepers remained to guard its crimson gates:',
      '',
      'BORISLAVA — Priestess of the Undying Flame.',
      'She wove faith into stone, healing every crack',
      'the Void creatures tore from the ancient barrier.',
      '',
      'NAZAR — Void Seer and Geometer of the Dark Arts.',
      'He could read the patterns between dimensions',
      'and bend them into weapons of crystal and shadow.',
      '',
      'MAR-TA — Last of the Iron Guard.',
      'Where faith and geometry failed,',
      'her iron will and unbreakable body did not.',
      '',
      'Their shared power — the ECSTASY —',
      'was the only currency the Void respected.',
      'When it flowed, the barrier held.',
      'When it ran dry … the Void fed.',
      '',
      '~ ~ ~',
      '',
      'Mausoleum 2.2 stands again.',
      'The waves are coming.',
      '',
      'Three keepers.',
      'One barrier.',
      'Twelve waves of hunger.',
      '',
      'Hold. The. Line.',
    ];

    // Container for scrolling
    const container = this.add.container(0, 0);
    const startY = height + 20;
    let offsetY = 0;

    loreText.forEach((line, i) => {
      const isTitle   = line.startsWith('~');
      const isHero    = /^(BORISLAVA|NAZAR|MAR-TA)/.test(line);
      const isSpecial = line === 'Hold. The. Line.';
      const color   = isTitle   ? '#9966ff'
                    : isHero    ? '#ffcc44'
                    : isSpecial ? '#ff6633'
                    : '#ccaaee';
      const size    = isTitle   ? '28px'
                    : isHero    ? '24px'
                    : isSpecial ? '32px'
                    : '20px';

      const t = this.add.text(width / 2, startY + offsetY, line, {
        fontFamily: isTitle || isHero ? 'serif' : 'sans-serif',
        fontSize:   size,
        color,
        stroke:       '#000000',
        strokeThickness: isTitle || isHero ? 3 : 1,
        align: 'center',
      }).setOrigin(0.5, 0);

      container.add(t);
      offsetY += (isTitle || line === '' ? 28 : 30) + (line === '' ? 6 : 0);
    });

    const totalH = offsetY + 100;

    // Auto-scroll tween
    this._scrollTween = this.tweens.add({
      targets:  container,
      y:        -(totalH - 40),
      duration: totalH * 48,  // ~48 ms per pixel
      ease:     'Linear',
      onComplete: () => this._goToHeroSelect(),
    });

    // Skip button
    const skipBg = this.add.graphics();
    skipBg.fillStyle(0x000000, 0.6);
    skipBg.fillRoundedRect(width - 160, height - 54, 140, 40, 6);
    skipBg.lineStyle(1, 0x9966ff);
    skipBg.strokeRoundedRect(width - 160, height - 54, 140, 40, 6);

    this.add.text(width - 90, height - 34, 'SKIP  ▶', {
      fontFamily: 'sans-serif', fontSize: '16px', color: '#9966ff',
    }).setOrigin(0.5);

    const skipZone = this.add.zone(width - 90, height - 34, 140, 40).setInteractive({ useHandCursor: true });
    skipZone.on('pointerdown', () => this._goToHeroSelect());

    // Fade in
    this.cameras.main.fadeIn(600, 0, 0, 0);
  }

  _goToHeroSelect() {
    if (this._scrollTween) this._scrollTween.stop();
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('HeroSelectScene');
    });
  }
}
