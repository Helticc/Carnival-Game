// ── Tiny WebAudio synth for game SFX ─────────────────────────────────────────

export class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noiseBuf: AudioBuffer | null = null
  private last: Record<string, number> = {}
  muted = false

  ensure() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        this.ctx = new AC()
        this.master = this.ctx.createGain()
        this.master.gain.value = 0.32
        this.master.connect(this.ctx.destination)
        const len = this.ctx.sampleRate * 0.5
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
        const d = this.noiseBuf.getChannelData(0)
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
      } catch { /* audio unsupported */ }
    }
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume()
  }

  setMuted(m: boolean) { this.muted = m }

  private ok(name: string, min: number) {
    const now = performance.now()
    if (this.last[name] && now - this.last[name] < min) return false
    this.last[name] = now
    return true
  }

  private tone(f: number, type: OscillatorType, dur: number, vol: number, slide?: number, delay = 0) {
    if (!this.ctx || !this.master || this.muted) return
    const t = this.ctx.currentTime + delay
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(Math.max(20, f), t)
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur)
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g); g.connect(this.master)
    o.start(t); o.stop(t + dur + 0.02)
  }

  private noise(dur: number, vol: number, fc = 1200, delay = 0) {
    if (!this.ctx || !this.master || !this.noiseBuf || this.muted) return
    const t = this.ctx.currentTime + delay
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuf
    const flt = this.ctx.createBiquadFilter()
    flt.type = 'lowpass'; flt.frequency.value = fc
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(flt); flt.connect(g); g.connect(this.master)
    src.start(t, Math.random() * 0.3); src.stop(t + dur + 0.02)
  }

  shoot() { if (this.ok('shoot', 60)) this.tone(700 + Math.random() * 120, 'square', 0.06, 0.09, 300) }
  slash() { if (this.ok('slash', 80)) this.noise(0.09, 0.14, 3200) }
  zap() { if (this.ok('zap', 70)) { this.noise(0.08, 0.15, 4000); this.tone(1600, 'square', 0.06, 0.05, 500) } }
  throwIt() { if (this.ok('throw', 90)) this.tone(300, 'triangle', 0.12, 0.10, 620) }
  land() { if (this.ok('land', 120)) { this.noise(0.18, 0.2, 900); this.tone(160, 'sine', 0.16, 0.16, 60) } }
  boom() { if (this.ok('boom', 90)) { this.noise(0.32, 0.4, 500); this.tone(130, 'sine', 0.3, 0.34, 40) } }
  bigBoom() { this.noise(0.6, 0.55, 360); this.tone(110, 'sine', 0.55, 0.5, 32) }
  hit() { if (this.ok('hit', 55)) this.noise(0.05, 0.10, 1800) }
  kill() { if (this.ok('kill', 70)) { this.noise(0.12, 0.16, 700); this.tone(220, 'sawtooth', 0.1, 0.06, 70) } }
  pickup(combo: number) {
    if (!this.ok('pickup', 28)) return
    const f = 520 * Math.pow(1.0595, Math.min(combo, 16))
    this.tone(f, 'sine', 0.09, 0.14, f * 1.4)
  }
  heal() { this.tone(340, 'sine', 0.25, 0.2, 760); this.tone(680, 'sine', 0.2, 0.1, 980, 0.08) }
  magnetize() { this.tone(240, 'triangle', 0.3, 0.2, 1500) }
  hurt() { if (this.ok('hurt', 200)) { this.tone(190, 'sawtooth', 0.2, 0.3, 62); this.noise(0.15, 0.2, 500) } }
  levelup() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 'triangle', 0.16, 0.2, undefined, i * 0.07)) }
  evolve() { [392, 523, 659, 880, 1175].forEach((f, i) => this.tone(f, 'sawtooth', 0.2, 0.1, undefined, i * 0.06)) }
  chest() { [659, 784, 988, 1319].forEach((f, i) => this.tone(f, 'triangle', 0.14, 0.16, undefined, i * 0.06)) }
  boss() { this.tone(95, 'sawtooth', 0.7, 0.34, 48); this.noise(0.6, 0.24, 240) }
  warn() { this.tone(440, 'square', 0.12, 0.14, 392); this.tone(440, 'square', 0.12, 0.14, 392, 0.18) }
  ui() { this.tone(640, 'triangle', 0.05, 0.14, 840) }
  die() { this.tone(320, 'sawtooth', 0.9, 0.26, 40); this.noise(0.8, 0.2, 300) }
}
