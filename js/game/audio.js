/**
 * AudioManager – thin wrapper around Phaser's sound system.
 * Handles graceful degradation when audio assets are absent.
 */
export class AudioManager {
  constructor(scene) {
    this.scene        = scene;
    this.currentMusic = null;
  }

  /** Start a looping music track; stops any currently playing track first. */
  playMusic(key, config = {}) {
    this.stopMusic();
    if (!this.scene.cache.audio.has(key)) return;
    this.currentMusic = this.scene.sound.add(key, {
      loop: true, volume: 0.3, ...config,
    });
    this.currentMusic.play();
  }

  /** Fade out and stop the current music track. */
  fadeMusicOut(duration = 1000) {
    if (!this.currentMusic) return;
    this.scene.tweens.add({
      targets:    this.currentMusic,
      volume:     0,
      duration,
      onComplete: () => this.stopMusic(),
    });
  }

  /** Stop and destroy the current music track immediately. */
  stopMusic() {
    if (!this.currentMusic) return;
    this.currentMusic.stop();
    this.currentMusic.destroy();
    this.currentMusic = null;
  }

  /** Play a one-shot SFX; silently skipped if the key is not loaded. */
  playSfx(key, config = {}) {
    if (!this.scene.cache.audio.has(key)) return;
    this.scene.sound.play(key, { volume: 0.5, ...config });
  }
}
