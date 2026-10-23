class AudioManager {
  private ctx: AudioContext | null = null;

  private init() {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    } catch (e) {}
  }

  spawnPop() {
    try {
      this.init();
      if (!this.ctx) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(320, this.ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(780, this.ctx.currentTime + 0.16);
      g.gain.setValueAtTime(0.35, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.18);
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start();
      o.stop(this.ctx.currentTime + 0.18);
    } catch (e) {}
  }

  stepInRope() {
    try {
      this.init();
      if (!this.ctx) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(440, this.ctx.currentTime);
      o.frequency.setValueAtTime(660, this.ctx.currentTime + 0.1);
      g.gain.setValueAtTime(0.3, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start();
      o.stop(this.ctx.currentTime + 0.25);
    } catch (e) {}
  }

  whistle() {
    try {
      this.init();
      if (!this.ctx) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(2000, this.ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(2800, this.ctx.currentTime + 0.25);
      g.gain.setValueAtTime(0.4, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.55);
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start();
      o.stop(this.ctx.currentTime + 0.55);
    } catch (e) {}
  }

  pullHeave() {
    try {
      this.init();
      if (!this.ctx) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(140, this.ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(340, this.ctx.currentTime + 0.14);
      g.gain.setValueAtTime(0.3, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.18);
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start();
      o.stop(this.ctx.currentTime + 0.18);
    } catch (e) {}
  }

  bonusLifeChime() {
    try {
      this.init();
      if (!this.ctx) return;
      [587.33, 880, 1174.66].forEach((f, idx) => {
        if (!this.ctx) return;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        const t = this.ctx.currentTime + idx * 0.09;
        g.gain.setValueAtTime(0.35, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
        o.connect(g);
        g.connect(this.ctx.destination);
        o.start(t);
        o.stop(t + 0.35);
      });
    } catch (e) {}
  }

  freezeCrack() {
    try {
      this.init();
      if (!this.ctx) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(520, this.ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(90, this.ctx.currentTime + 0.35);
      g.gain.setValueAtTime(0.3, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start();
      o.stop(this.ctx.currentTime + 0.35);
    } catch (e) {}
  }

  winFanfare() {
    try {
      this.init();
      if (!this.ctx) return;
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
        if (!this.ctx) return;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = f;
        const t = this.ctx.currentTime + i * 0.12;
        g.gain.setValueAtTime(0.38, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.55);
        o.connect(g);
        g.connect(this.ctx.destination);
        o.start(t);
        o.stop(t + 0.55);
      });
    } catch (e) {}
  }

  firstBloodStrike() {
    try {
      this.init();
      if (!this.ctx) return;
      [659.25, 880, 1318.5, 1760].forEach((f, i) => {
        if (!this.ctx) return;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.value = f;
        const t = this.ctx.currentTime + i * 0.06;
        g.gain.setValueAtTime(0.28, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
        o.connect(g);
        g.connect(this.ctx.destination);
        o.start(t);
        o.stop(t + 0.25);
      });
    } catch (e) {}
  }

  jackpotSpin() {
    try {
      this.init();
      if (!this.ctx) return;
      [523.25, 659.25, 783.99, 987.77, 1046.5, 1318.5, 1567.98].forEach((f, i) => {
        if (!this.ctx) return;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        const t = this.ctx.currentTime + i * 0.055;
        g.gain.setValueAtTime(0.32, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
        o.connect(g);
        g.connect(this.ctx.destination);
        o.start(t);
        o.stop(t + 0.35);
      });
    } catch (e) {}
  }

  worldEventSiren() {
    try {
      this.init();
      if (!this.ctx) return;
      [440, 554.37, 659.25, 880].forEach((f, i) => {
        if (!this.ctx) return;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = f;
        const t = this.ctx.currentTime + i * 0.1;
        g.gain.setValueAtTime(0.36, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.45);
        o.connect(g);
        g.connect(this.ctx.destination);
        o.start(t);
        o.stop(t + 0.45);
      });
    } catch (e) {}
  }
}

export const AudioFX = new AudioManager();

