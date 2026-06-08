import * as Tone from 'tone';

type FilterType = BiquadFilterType;

export class NoiseGenerator {
  private ctx: BaseAudioContext;
  private brownBuffer: AudioBuffer;
  private source: AudioBufferSourceNode;
  private filter: BiquadFilterNode;
  private gainNode: GainNode;

  constructor() {
    this.ctx = Tone.getContext().rawContext;
    this.brownBuffer = this.createNoiseBuffer('brown');
    this.source = this.ctx.createBufferSource();
    this.filter = this.ctx.createBiquadFilter();
    this.gainNode = this.ctx.createGain();
    this.initAudioGraph();
  }

  setVolume(value: number): void {
    this.gainNode.gain.setTargetAtTime(value, this.ctx.currentTime, 0.1);
  }

  setFilterFreq(value: number): void {
    this.filter.frequency.setTargetAtTime(value, this.ctx.currentTime, 0.1);
  }

  setFilterQ(value: number): void {
    this.filter.Q.setTargetAtTime(value, this.ctx.currentTime, 0.1);
  }

  setType(type: FilterType): void {
    this.filter.type = type;
  }

  private initAudioGraph(): void {
    this.source.buffer = this.brownBuffer;
    this.source.loop = true;
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 400;
    this.filter.Q.value = 0;
    this.gainNode.gain.value = 0;
    this.source.connect(this.filter);
    this.filter.connect(this.gainNode);
    this.gainNode.connect(this.ctx.destination);
    this.source.start();
  }

  private createNoiseBuffer(type: 'pink' | 'brown'): AudioBuffer {
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      if (type === 'pink') {
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5;
      } else {
        lastOut = (lastOut + 0.02 * white) / 1.02;
        data[i] = lastOut * 3.5;
      }
    }
    return buffer;
  }
}
