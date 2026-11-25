/** Haptics backend. Browser uses navigator.vibrate; Capacitor Haptics plugs in here in M6. */
export interface Haptics { impact(style: 'light' | 'medium' | 'heavy'): void; notify(kind: 'success' | 'error'): void }

export const browserHaptics: Haptics = {
  impact(style) { vibrate(style === 'light' ? 4 : style === 'medium' ? 15 : 30); },
  notify(kind) { vibrate(kind === 'success' ? [10, 40, 20] : [20, 30, 20]); },
};
function vibrate(p: number | number[]): void { try { navigator.vibrate?.(p); } catch { /* not supported (iOS Safari) */ } }

/** The single owner of all sound + haptic feedback. Scaled by event rarity. */
export class FeedbackManager {
  sound = true;
  vibration = true;
  private ac: AudioContext | null = null;

  constructor(private haptics: Haptics = browserHaptics) {}

  /** Must be called from a user gesture (browsers block audio before that). */
  unlock(): void {
    if (!this.ac) {
      try { this.ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { /* no audio */ }
    }
    if (this.ac?.state === 'suspended') void this.ac.resume();
  }

  /** master chain: gentle compressor + a short echo send for sparkle */
  private bus: { dry: GainNode; wet: GainNode } | null = null;
  private out(): { dry: GainNode; wet: GainNode } | null {
    const ac = this.ac;
    if (!ac) return null;
    if (!this.bus) {
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; comp.connect(ac.destination);
      const dry = ac.createGain(); dry.gain.value = 0.9; dry.connect(comp);
      const wet = ac.createGain(); wet.gain.value = 0.22;
      const delay = ac.createDelay(1); delay.delayTime.value = 0.13;
      const fbk = ac.createGain(); fbk.gain.value = 0.32;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
      wet.connect(delay); delay.connect(lp); lp.connect(fbk); fbk.connect(delay); lp.connect(comp);
      this.bus = { dry, wet };
    }
    return this.bus;
  }

  private tone(f: number, d: number, type: OscillatorType = 'sine', v = 0.08, delay = 0, wet = false, glideTo?: number): void {
    const ac = this.ac, bus = this.out();
    if (!ac || !bus || !this.sound) return;
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(bus.dry); if (wet) g.connect(bus.wet);
    o.start(t); o.stop(t + d + 0.03);
  }
  /** Bell / chime: a sine with two inharmonic partials that die faster. */
  private bell(f: number, d: number, v = 0.07, delay = 0): void {
    this.tone(f, d, 'sine', v, delay, true);
    this.tone(f * 2.76, d * 0.45, 'sine', v * 0.35, delay, true);
    this.tone(f * 5.4, d * 0.2, 'sine', v * 0.18, delay, true);
  }
  /** Short filtered noise (clicks, whooshes). */
  private noise(d: number, freq: number, v = 0.06, delay = 0, sweepTo?: number): void {
    const ac = this.ac, bus = this.out();
    if (!ac || !bus || !this.sound) return;
    const t = ac.currentTime + delay, len = Math.max(1, Math.floor(ac.sampleRate * d));
    const buf = ac.createBuffer(1, len, ac.sampleRate), data = buf.getChannelData(0);
    for (let k = 0; k < len; k++) data[k] = (Math.random() * 2 - 1) * (1 - k / len);
    const src = ac.createBufferSource(); src.buffer = buf;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4; bp.frequency.setValueAtTime(freq, t);
    if (sweepTo) bp.frequency.exponentialRampToValueAtTime(sweepTo, t + d);
    const g = ac.createGain(); g.gain.value = v;
    src.connect(bp).connect(g).connect(bus.dry); src.start(t);
  }
  private hap(fn: (h: Haptics) => void): void { if (this.vibration) fn(this.haptics); }
  /** merges in a row within a short window raise the pitch (combo feel) */
  private combo = 0;
  private lastMerge = 0;

  tick(): void { this.noise(0.018, 2600, 0.05); this.hap(h => h.impact('light')); }
  becameFree(): void { this.bell(1568, 0.35, 0.045); }
  release(): void { this.tone(660, 0.16, 'triangle', 0.07, 0, false, 990); this.bell(1319, 0.4, 0.05, 0.05); this.hap(h => h.impact('medium')); }
  locked(): void { this.tone(180, 0.12, 'triangle', 0.08, 0, false, 120); this.noise(0.06, 400, 0.05); this.hap(h => h.notify('error')); }
  merge(): void {
    const now = performance.now();
    this.combo = now - this.lastMerge < 4000 ? Math.min(this.combo + 1, 6) : 0;
    this.lastMerge = now;
    const k = Math.pow(2, (this.combo * 2) / 12); // +2 semitones per combo step
    [784, 988, 1175, 1568].forEach((f, i) => this.bell(f * k, 0.5, 0.055, i * 0.055));
    this.hap(h => h.impact('heavy'));
  }
  // ---------- background music: a quiet, endless music-box loop made on the fly ----------
  music = true;
  private musicTimer = 0;
  private beat = 0;
  /** Start (or keep) the music; call after unlock(). */
  startMusic(): void {
    if (this.musicTimer || !this.ac) return;
    const CHORDS = [[262, 330, 392], [220, 262, 330], [175, 220, 262], [196, 247, 294]]; // C · Am · F · G
    const step = (): void => {
      if (!this.music || !this.sound || !this.ac || this.ac.state !== 'running') { this.beat++; return; }
      const chord = CHORDS[Math.floor(this.beat / 8) % CHORDS.length], b = this.beat % 8;
      if (b === 0) chord.forEach(f => this.tone(f / 2, 2.6, 'sine', 0.018, 0, true));            // soft pad
      const pattern = [0, 2, 1, 2, 0, 1, 2, 1];
      if (b !== 7) this.bell(chord[pattern[b]] * 2, 0.9, 0.016);                                 // music box
      this.beat++;
    };
    this.musicTimer = window.setInterval(step, 375);
  }
  stopMusic(): void { clearInterval(this.musicTimer); this.musicTimer = 0; }
  whoosh(): void { this.noise(0.35, 300, 0.09, 0, 3000); this.bell(1760, 0.4, 0.04, 0.2); }
  boom(): void { this.tone(110, 0.5, 'sine', 0.2, 0, false, 40); this.noise(0.4, 600, 0.12, 0, 120); this.hap(h => h.impact('heavy')); }
  win(): void {
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.bell(f, 0.9, 0.06, i * 0.08));
    this.noise(0.6, 6000, 0.025, 0.45, 9000);
    this.hap(h => h.notify('success'));
  }
  lose(): void { [440, 392, 330].forEach((f, i) => this.tone(f, 0.45, 'triangle', 0.05, i * 0.16, true)); }
}
