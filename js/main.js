import BootScene        from './scenes/BootScene.js';
import MenuScene        from './scenes/MenuScene.js';
import IntroScene       from './scenes/IntroScene.js';
import HeroSelectScene  from './scenes/HeroSelectScene.js';
import GameScene        from './scenes/GameScene.js';

const config = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#000000',
  parent: 'game-container',
  scene: [BootScene, MenuScene, IntroScene, HeroSelectScene, GameScene],
  audio: { disableWebAudio: false },
  render: { antialias: true, pixelArt: false },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
