// All sound is synthesized with WebAudio: no audio files ship with the game.
// A tiny synth builds each effect from oscillators and filtered noise, and a
// slow pad loop plays underneath while a run is in progress.
const MUSIC_CHORDS = [
  [110.0, 164.81, 220.0],
  [87.31, 130.81, 174.61],
  [130.81, 196.0, 261.63],
  [98.0, 146.83, 220.0],
];

export function createAudio() {
  const audio = {
    context: null,
    master: null,
    musicGain: null,
    muted: false,
    musicTimer: null,
    chordIndex: 0,
  };

  audio.ensure = () => {
    if (audio.context) {
      if (audio.context.state === 'suspended') audio.context.resume();
      return true;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      audio.context = new Ctor();
      audio.master = audio.context.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.context.destination);
      audio.musicGain = audio.context.createGain();
      audio.musicGain.gain.value = 0.05;
      audio.musicGain.connect(audio.master);
      return true;
    } catch (error) {
      return false;
    }
  };

  audio.setMuted = (muted) => {
    audio.muted = muted;
    if (audio.master) audio.master.gain.value = muted ? 0 : 0.5;
  };

  function tone({ type, from, to, duration, volume, when = 0 }) {
    if (!audio.context || audio.muted) return;
    const start = audio.context.currentTime + when;
    const osc = audio.context.createOscillator();
    const gain = audio.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  function noise({ duration, volume, frequency, when = 0 }) {
    if (!audio.context || audio.muted) return;
    const start = audio.context.currentTime + when;
    const length = Math.max(1, Math.floor(audio.context.sampleRate * duration));
    const buffer = audio.context.createBuffer(1, length, audio.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = audio.context.createBufferSource();
    source.buffer = buffer;
    const filter = audio.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    const gain = audio.context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    source.start(start);
  }

  audio.shoot = () => tone({ type: 'square', from: 880, to: 440, duration: 0.08, volume: 0.08 });
  audio.enemyShoot = () => tone({ type: 'sawtooth', from: 220, to: 160, duration: 0.12, volume: 0.05 });
  audio.hit = () => noise({ duration: 0.08, volume: 0.12, frequency: 2400 });
  audio.explosion = (big = false) => {
    noise({ duration: big ? 0.5 : 0.25, volume: big ? 0.3 : 0.16, frequency: big ? 500 : 900 });
    tone({ type: 'sine', from: big ? 120 : 180, to: 40, duration: big ? 0.5 : 0.25, volume: 0.22 });
  };
  audio.pickup = () => {
    tone({ type: 'sine', from: 660, duration: 0.09, volume: 0.12 });
    tone({ type: 'sine', from: 990, duration: 0.12, volume: 0.12, when: 0.07 });
  };
  audio.heal = () => {
    tone({ type: 'sine', from: 523, duration: 0.12, volume: 0.14 });
    tone({ type: 'sine', from: 784, duration: 0.18, volume: 0.14, when: 0.09 });
  };
  audio.dash = () => noise({ duration: 0.18, volume: 0.1, frequency: 3200 });
  audio.nova = () => {
    tone({ type: 'sine', from: 80, to: 660, duration: 0.4, volume: 0.25 });
    noise({ duration: 0.4, volume: 0.18, frequency: 1400 });
  };
  audio.hurt = () => {
    tone({ type: 'sawtooth', from: 160, to: 50, duration: 0.35, volume: 0.25 });
    noise({ duration: 0.2, volume: 0.2, frequency: 700 });
  };
  audio.wave = () => {
    tone({ type: 'triangle', from: 392, duration: 0.16, volume: 0.14 });
    tone({ type: 'triangle', from: 523, duration: 0.22, volume: 0.14, when: 0.12 });
  };
  audio.gameOver = () => {
    [392, 311, 233, 175].forEach((freq, i) => {
      tone({ type: 'triangle', from: freq, duration: 0.34, volume: 0.16, when: i * 0.28 });
    });
  };
  audio.click = () => tone({ type: 'sine', from: 700, to: 900, duration: 0.06, volume: 0.1 });

  audio.startMusic = () => {
    if (!audio.ensure() || audio.musicTimer !== null) return;
    const playChord = () => {
      if (!audio.context || audio.muted) return;
      const chord = MUSIC_CHORDS[audio.chordIndex % MUSIC_CHORDS.length];
      audio.chordIndex += 1;
      const now = audio.context.currentTime;
      for (const freq of chord) {
        for (const detune of [-4, 4]) {
          const osc = audio.context.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          osc.detune.value = detune;
          const gain = audio.context.createGain();
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(0.5, now + 1.5);
          gain.gain.linearRampToValueAtTime(0.0001, now + 3.9);
          osc.connect(gain);
          gain.connect(audio.musicGain);
          osc.start(now);
          osc.stop(now + 4);
        }
      }
    };
    playChord();
    audio.musicTimer = window.setInterval(playChord, 4000);
  };

  audio.stopMusic = () => {
    if (audio.musicTimer !== null) {
      window.clearInterval(audio.musicTimer);
      audio.musicTimer = null;
    }
  };

  return audio;
}
