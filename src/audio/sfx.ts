import { clamp } from '../core/geometry.ts';

/**
 * All sound is synthesised at runtime — no audio files to load, ship or
 * license, and it keeps the Android bundle tiny.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;
  private musicStarted = false;
  private arpStep = 0;
  private _enabled = true;

  get enabled(): boolean {
    return this._enabled;
  }

  /** Muting fades the music bed rather than stopping it, so toggling sound
   * back on resumes instantly instead of re-triggering the whole engine. */
  set enabled(v: boolean) {
    this._enabled = v;
    if (this.ctx && this.musicGain) {
      const now = this.ctx.currentTime;
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.linearRampToValueAtTime(v ? 0.2 : 0, now + 0.4);
    }
  }

  /** Must be called from inside a user gesture or browsers keep audio muted. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      if (!this.musicStarted) this.startMusic();
      return;
    }
    try {
      const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      this.startMusic();
    } catch {
      this.ctx = null;
    }
  }

  // --------------------------------------------------------------- music
  //
  // No audio files here either — a sustained, filter-swept pad under a slow
  // arpeggio, all synthesised, so the ambience ships in the same few
  // kilobytes as everything else in this file.

  private readonly arpScale = [220, 261.63, 293.66, 329.63, 392, 440, 392, 329.63];

  private startMusic(): void {
    if (this.musicStarted || !this.ctx) return;
    this.musicStarted = true;

    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = this._enabled ? 0.2 : 0;
    gain.connect(ctx.destination);
    this.musicGain = gain;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    filter.connect(gain);
    this.musicFilter = filter;

    // A slow-breathing chord — A minor, an octave and a fifth down — under
    // the arena.
    for (const freq of [110, 130.81, 164.81, 220]) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const padGain = ctx.createGain();
      padGain.gain.value = 0.05;
      osc.connect(padGain);
      padGain.connect(filter);
      osc.start();
    }

    this.sweepFilter();
    this.scheduleArp();
  }

  private sweepFilter(): void {
    if (!this.ctx || !this.musicFilter) return;
    const now = this.ctx.currentTime;
    const next = 380 + Math.random() * 640;
    this.musicFilter.frequency.cancelScheduledValues(now);
    this.musicFilter.frequency.setValueAtTime(this.musicFilter.frequency.value, now);
    this.musicFilter.frequency.linearRampToValueAtTime(next, now + 6);
    window.setTimeout(() => this.sweepFilter(), 6000);
  }

  private scheduleArp(): void {
    window.setTimeout(() => {
      if (this._enabled && this.ctx && this.musicGain) {
        this.musicNote(this.arpScale[this.arpStep % this.arpScale.length]);
      }
      this.arpStep++;
      this.scheduleArp();
    }, 550);
  }

  private musicNote(freq: number): void {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(0.1, now + 0.05);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    osc.connect(amp);
    amp.connect(this.musicGain);
    osc.start(now);
    osc.stop(now + 0.55);
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
