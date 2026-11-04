/** Original synthesized effects only. Audio starts after a user gesture. */
export class AudioManager {
  constructor() {
    this.enabled = false;
    this.context = null;
    this.master = null;
  }

  setEnabled(value) {
    this.enabled = value === true;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this.enabled ? 0.15 : 0, this.context.currentTime, 0.02);
    }
    if (this.enabled) void this.unlock();
    return this.enabled;
  }

  async unlock() {
    try {
      if (!this.context) {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) return false;
        this.context = new Context();
        this.master = this.context.createGain();
        this.master.gain.value = this.enabled ? 0.15 : 0;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') await this.context.resume();
      return this.context.state === 'running';
    } catch {
      return false;
    }
  }

  note(frequency, start, duration, type = 'sine', volume = 0.4) {
    if (!this.context || !this.master) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }

  play(type = 'click') {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    const patterns = {
      click: [[620, 0, 0.055, 'sine', 0.2]],
      notify: [[740, 0, 0.13], [988, 0.12, 0.2]],
      whistle: [[1760, 0, 0.16, 'sine', 0.16], [1760, 0.21, 0.12, 'sine', 0.13]],
      success: [[523, 0, 0.2], [659, 0.11, 0.2], [784, 0.22, 0.3], [1047, 0.36, 0.45]],
      error: [[220, 0, 0.16, 'triangle', 0.25], [185, 0.15, 0.25, 'triangle', 0.25]],
      ending: [[523, 0, 0.3], [659, 0.18, 0.3], [784, 0.36, 0.3], [1047, 0.56, 0.7], [659, 0.56, 0.7], [784, 0.56, 0.7]]
    };
    for (const [frequency, delay, duration, wave, volume] of patterns[type] || patterns.click) {
      this.note(frequency, now + delay, duration, wave, volume);
    }
  }
}
