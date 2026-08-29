/* Procedural WebAudio SFX — no assets. */

type OscType = OscillatorType;

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private step = 0;
  muted = false;

  ensure() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
    } catch {
      /* audio unavailable */
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
  }

  private tone(freq: number, dur: number, type: OscType, vol: number, slideTo?: number, delay = 0) {
    try {
      if (!this.ctx || !this.master) return;
      const t0 = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(this.master);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    } catch { /* noop */ }
  }

  private noise(dur: number, vol: number, cutoff: number, delay = 0, q = 0.8) {
    try {
      if (!this.ctx || !this.master) return;
      const t0 = this.ctx.currentTime + delay;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = cutoff;
      f.Q.value = q;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f).connect(g).connect(this.master);
      src.start(t0);
    } catch { /* noop */ }
  }

  shoot(kind: "pistol" | "smg" | "shotgun") {
    if (kind === "pistol") { this.noise(0.09, 0.4, 2600); this.tone(190, 0.08, "square", 0.22, 70); }
    else if (kind === "smg") { this.noise(0.06, 0.3, 3200); this.tone(260, 0.05, "square", 0.16, 110); }
    else { this.noise(0.22, 0.65, 900, 0, 0.5); this.tone(90, 0.2, "square", 0.3, 40); }
  }
  hit() { this.tone(1150, 0.06, "square", 0.12, 500); }
  crit() { this.tone(1500, 0.09, "sawtooth", 0.16, 700); this.tone(2200, 0.07, "square", 0.1, 900, 0.02); }
  explode(big = false) {
    this.noise(big ? 0.7 : 0.4, big ? 0.8 : 0.5, big ? 320 : 500);
    this.tone(big ? 55 : 70, big ? 0.55 : 0.35, "sine", big ? 0.6 : 0.4, 28);
  }
  hurt() { this.tone(210, 0.16, "sawtooth", 0.26, 90); }
  dash() { this.tone(280, 0.2, "sine", 0.28, 950); this.noise(0.12, 0.16, 4000); }
  sande() { this.tone(1400, 0.7, "sine", 0.24, 120); this.tone(1406, 0.7, "sine", 0.18, 118); this.noise(0.5, 0.1, 6000, 0.1); }
  reload() { this.tone(700, 0.04, "square", 0.14); this.tone(1050, 0.04, "square", 0.14, undefined, 0.12); }
  pickup() { this.tone(880, 0.09, "sine", 0.22); this.tone(1318, 0.12, "sine", 0.22, undefined, 0.07); }
  levelup() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.16, "square", 0.16, undefined, i * 0.07)); }
  wave() { this.tone(95, 0.5, "sawtooth", 0.26, 55); this.noise(0.3, 0.2, 700, 0.05); }
  ui() { this.tone(1350, 0.045, "square", 0.1); }
  deny() { this.tone(220, 0.12, "square", 0.14, 160); }
  win() { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.5, "triangle", 0.18, undefined, i * 0.12)); }
  lose() { [330, 262, 196, 131].forEach((f, i) => this.tone(f, 0.5, "sawtooth", 0.18, undefined, i * 0.16)); }

  startMusic() {
    try {
      this.ensure();
      if (!this.ctx || !this.master || this.musicTimer !== null) return;
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
      const bass = [55, 55, 65.41, 49];
      const arp = [220, 261.6, 329.6, 392, 440];
      let beat = 0;
      const tick = () => {
        try {
          if (!this.ctx || !this.musicGain) return;
          const t = this.ctx.currentTime;
          // bass pulse
          const o = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          o.type = "sawtooth";
          o.frequency.value = bass[Math.floor(beat / 4) % bass.length];
          g.gain.setValueAtTime(0.5, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
          const f = this.ctx.createBiquadFilter();
          f.type = "lowpass"; f.frequency.value = 300;
          o.connect(f).connect(g).connect(this.musicGain);
          o.start(t); o.stop(t + 0.25);
          // arp sparkle every other beat
          if (beat % 2 === 1) {
            const a = this.ctx.createOscillator();
            const ag = this.ctx.createGain();
            a.type = "triangle";
            a.frequency.value = arp[Math.floor(Math.random() * arp.length)];
            ag.gain.setValueAtTime(0.12, t);
            ag.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
            a.connect(ag).connect(this.musicGain);
            a.start(t); a.stop(t + 0.32);
          }
          // hat
          if (beat % 4 === 2) {
            const len = Math.floor(this.ctx.sampleRate * 0.04);
            const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
            const s = this.ctx.createBufferSource(); s.buffer = buf;
            const hf = this.ctx.createBiquadFilter(); hf.type = "highpass"; hf.frequency.value = 6000;
            const hg = this.ctx.createGain(); hg.gain.value = 0.15;
            s.connect(hf).connect(hg).connect(this.musicGain);
            s.start(t);
          }
          beat++;
        } catch { /* noop */ }
      };
      tick();
      this.musicTimer = window.setInterval(tick, 240);
    } catch { /* noop */ }
  }

  stopMusic() {
    try {
      if (this.musicTimer !== null) { clearInterval(this.musicTimer); this.musicTimer = null; }
      if (this.musicGain && this.ctx) this.musicGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
    } catch { /* noop */ }
  }
}
