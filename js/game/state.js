/**
 * Global game state shared across scene transitions.
 * Only values that must persist between scenes live here.
 */
const GameState = {
  // Hero chosen in HeroSelectScene
  heroKey: null,

  // Whether the in-game tutorial has been shown this session
  tutorialSeen: false,

  // Audio preferences (persisted in localStorage if desired)
  musicEnabled: true,
  sfxEnabled:   true,

  // End-of-run statistics (populated by GameScene)
  score:       0,
  totalKills:  0,
  wavesCleared: 0,
};

export default GameState;
