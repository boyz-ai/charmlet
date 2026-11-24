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

  private tone(f: number, d: number, type: OscillatorType = 'sine', v = 0.08, delay = 0): void {
    const ac = this.ac;
    if (!ac || !this.sound) return;
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + 0.02);
  }
  private hap(fn: (h: Haptics) => void): void { if (this.vibration) fn(this.haptics); }

  tick(): void { this.tone(2200, 0.025, 'triangle', 0.035); this.hap(h => h.impact('light')); }
  becameFree(): void { this.tone(1320, 0.08, 'sine', 0.05); }
  release(): void { this.tone(784, 0.12, 'sine', 0.09); this.tone(1175, 0.18, 'sine', 0.07, 0.06); this.hap(h => h.impact('medium')); }
  locked(): void { this.tone(150, 0.12, 'square', 0.05); this.hap(h => h.notify('error')); }
  merge(): void { [880, 1109, 1319, 1760].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.07, i * 0.05)); this.hap(h => h.impact('heavy')); }
  win(): void { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.08, i * 0.09)); this.hap(h => h.notify('success')); }
  lose(): void { [392, 330, 262].forEach((f, i) => this.tone(f, 0.3, 'sawtooth', 0.04, i * 0.12)); }
}
