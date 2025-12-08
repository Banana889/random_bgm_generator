class AudioEngine {
    constructor() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.5;
        this.masterGain.connect(this.ctx.destination);
        
        this.reverbNode = this.createReverb();
        this.reverbNode.connect(this.masterGain);

        this.currentPadOscillators = [];
        
        // Pad 配置 (已应用之前的优化)
        this.padConfig = {
            volume: 0.015,
            waveform: 'triangle',
            cutoff: 600,      // Low cutoff for background feel
            attackTime: 2.0,
            releaseTime: 0.5
        };
    }

    createReverb() {
        const convolver = this.ctx.createConvolver();
        const rate = this.ctx.sampleRate;
        const length = rate * 3;
        const decay = 2.0;
        const buffer = this.ctx.createBuffer(2, length, rate);
        
        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
            }
        }
        convolver.buffer = buffer;
        return convolver;
    }

    playPad(chord, time) { // 修改：增加 time 参数
        const now = time || this.ctx.currentTime; // 修改：优先使用传入的精确时间
        const { releaseTime, attackTime, volume, cutoff, waveform } = this.padConfig;

        // 1. 清理旧和弦
        this.currentPadOscillators.forEach(item => {
            try {
                item.gain.gain.cancelScheduledValues(now);
                item.gain.gain.setValueAtTime(item.gain.gain.value, now);
                item.gain.gain.linearRampToValueAtTime(0, now + releaseTime);
                item.osc.stop(now + releaseTime + 0.2);
            } catch(e) {}
        });
        this.currentPadOscillators = [];

        // 2. 生成新和弦频率
        const freqs = [
            FREQ[chord.root],
            FREQ[chord.root] * 1.5,
            FREQ[chord.root] * 2
        ];

        freqs.forEach(f => {
            if (!f) return; // Skip undefined freqs
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            osc.type = waveform;
            osc.frequency.value = f;
            osc.detune.value = (Math.random() * 10) - 5;

            filter.type = 'lowpass';
            filter.frequency.value = cutoff;

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(volume, now + attackTime);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.reverbNode);

            // 垃圾回收
            osc.onended = () => {
                try {
                    osc.disconnect();
                    filter.disconnect();
                    gain.disconnect();
                } catch(e) {}
            };

            osc.start(now);
            this.currentPadOscillators.push({osc, gain});
        });
    }

    // 2.3 旋律合成器 (Lead Synth)
    playMelodyNote(freq, duration, time) { // 修改：增加 time 参数
        if (!freq) return;
        
        const t = time || this.ctx.currentTime; // 修改：优先使用传入的精确时间
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.2, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        const panner = this.ctx.createStereoPanner();
        panner.pan.value = (Math.random() * 2) - 1;

        osc.connect(gain);
        gain.connect(panner);
        panner.connect(this.reverbNode);

        osc.start(t);
        osc.stop(t + duration);
        
        osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
            panner.disconnect();
        };
    }
    

    // --- 新增：鼓组合成器 ---

    playKick(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        // 频率快速下潜 (50Hz -> 0.01Hz) 模拟鼓皮撞击
        osc.frequency.setValueAtTime(120, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
        
        // 音量快速衰减
        gain.gain.setValueAtTime(0.8, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(time);
        osc.stop(time + 0.5);
    }

    playHiHat(time) {
        // 使用白噪音生成镲片声
        const bufferSize = this.ctx.sampleRate * 0.1; // 0.1秒
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        
        // 高通滤波器，只保留高频
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 5000;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, time); // 音量稍小
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05); // 极短的衰减
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        
        noise.start(time);
    }
    
    resume() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }
    
    getCurrentTime() {
        return this.ctx.currentTime;
    }
}