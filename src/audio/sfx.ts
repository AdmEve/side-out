import { clamp } from '../core/geometry.ts';

/**
 * All sound is synthesised at runtime — no audio files to load, ship or
 * license, and it keeps the Android bundle tiny.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  enabled = true;

  /** Must be called from inside a user gesture or browsers keep audio muted. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    sweepTo?: number,
  ): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), now + dur);
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.006);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(amp);
    amp.connect(this.master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  private noise(dur: number, gain: number, filterHz: number): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = filterHz;
    const amp = this.ctx.createGain();
    amp.gain.value = gain;
    src.connect(filt);
    filt.connect(amp);
    amp.connect(this.master);
    src.start(now);
  }

  /** Paddle return — pitch rises with ball speed so the escalation is audible. */
  paddle(speed: number): void {
    const k = clamp((speed - 500) / 800, 0, 1);
    this.tone(340 + k * 520, 0.07, 'square', 0.18);
  }

  wall(): void {
    this.tone(190, 0.05, 'triangle', 0.1);
  }

  hazard(): void {
    this.tone(520, 0.08, 'sawtooth', 0.08, 300);
  }

  miss(): void {
    this.tone(220, 0.22, 'sawtooth', 0.14, 90);
  }

  shielded(): void {
    this.tone(700, 0.16, 'sine', 0.16, 1200);
  }

  shatter(): void {
    this.noise(0.5, 0.4, 1400);
    this.tone(150, 0.5, 'sawtooth', 0.16, 45);
  }

  powerup(): void {
    this.tone(660, 0.09, 'square', 0.12);
    window.setTimeout(() => this.tone(990, 0.12, 'square', 0.12), 80);
  }

  spawn(): void {
    this.tone(880, 0.1, 'sine', 0.1, 1500);
  }

  count(final: boolean): void {
    this.tone(final ? 880 : 440, final ? 0.22 : 0.1, 'square', 0.14);
  }

  drop(): void {
    this.tone(300, 0.12, 'square', 0.1, 160);
  }

  win(): void {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => window.setTimeout(() => this.tone(f, 0.22, 'square', 0.16), i * 110));
  }

  lose(): void {
    const notes = [440, 370, 294, 220];
    notes.forEach((f, i) => window.setTimeout(() => this.tone(f, 0.26, 'triangle', 0.14), i * 130));
  }

  ui(): void {
    this.tone(600, 0.04, 'square', 0.08);
  }
}

export const sfx = new Sfx();
