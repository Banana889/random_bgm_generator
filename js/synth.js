class AudioEngine {
    constructor() {
        // 1. 混响链 (Reverb Chain)
        // Tone.js 的 Reverb 比卷积混响更灵活，且自带衰减控制
        this.reverb = new Tone.Reverb({
            decay: 4,
            wet: 0.5,
            preDelay: 0.2
        }).toDestination(); // 连接到主输出
        
        // 必须调用 generate() 才能生效
        this.reverb.generate();

        // 2. 和弦合成器 (Pad Synth)
        // 使用 PolySynth 支持复音，声音选用 "FatOscillator" (加厚锯齿波)
        this.padSynth = new Tone.PolySynth(Tone.Synth, {
            oscillator: {
                type: "fatsawtooth",
                count: 3,
                spread: 30
            },
            envelope: {
                attack: 1,
                decay: 0.5,
                sustain: 1,
                release: 2
            }
        }).connect(this.reverb);
        
        // 降低 Pad 音量，作为背景
        this.padSynth.volume.value = -20; // dB

        // 3. 旋律合成器 (Lead Synth)
        // 使用 AMSynth (调幅合成)，声音更有金属感和动态
        this.melodySynth = new Tone.AMSynth({
            harmonicity: 3,
            detune: 0,
            oscillator: {
                type: "sine"
            },
            envelope: {
                attack: 0.01,
                decay: 0.01,
                sustain: 1,
                release: 0.5
            },
            modulation: {
                type: "square"
            },
            modulationEnvelope: {
                attack: 0.5,
                decay: 0,
                sustain: 1,
                release: 0.5
            }
        });
        
        // 加一个乒乓延时，让旋律在左右耳跳动
        this.pingPong = new Tone.PingPongDelay("8n", 0.4).connect(this.reverb);
        this.melodySynth.connect(this.pingPong);
        this.melodySynth.volume.value = -10;

        // 4. 鼓组 (Drums)
        // 底鼓：MembraneSynth (专门做鼓的合成器)
        this.kick = new Tone.MembraneSynth({
            pitchDecay: 0.05,
            octaves: 10,
            oscillator: { type: "sine" },
            envelope: {
                attack: 0.001,
                decay: 0.4,
                sustain: 0.01,
                release: 1.4,
                attackCurve: "exponential"
            }
        }).toDestination();
        this.kick.volume.value = -5;

        // 镲片：MetalSynth (专门做金属打击乐)
        this.hihat = new Tone.MetalSynth({
            frequency: 200,
            envelope: {
                attack: 0.001,
                decay: 0.1,
                release: 0.01
            },
            harmonicity: 5.1,
            modulationIndex: 32,
            resonance: 4000,
            octaves: 1.5
        }).connect(this.reverb);
        this.hihat.volume.value = -5; // 稍微小声点
    }

    // --- 统一接口 ---

    playPad(chord, time) {
        // Tone.js 接受音名数组 (e.g. ["C3", "E3", "G3"])
        // 我们的 chord.tones 是 ["C", "E", "G"]，需要加上八度
        // 这里简单处理：根音+八度
        
        // 释放之前的音 (如果有的话)
        this.padSynth.releaseAll(time);

        const root = chord.root; // e.g. "C3"
        const notes = [
            root,
            Tone.Frequency(root).transpose(7), // 五度
            Tone.Frequency(root).transpose(12), // 八度
            Tone.Frequency(root).transpose(16)  // 大三度(高八度)
        ];

        // 触发攻击 (Attack)
        // duration 设为 "1m" (1 measure) 或者更长，这里我们手动控制 release
        this.padSynth.triggerAttack(notes, time);
        this.padSynth.volume.value = -30;
    }

    playMelodyNote(freq, duration, time) {
        // Tone.js 可以直接接受频率数字
        this.melodySynth.triggerAttackRelease(freq, duration, time);
    }

    playKick(time) {
        // C1 是标准的底鼓音高
        this.kick.triggerAttackRelease("C1", "8n", time);
    }

    playHiHat(time) {
        // 触发短促的噪音
        this.hihat.triggerAttackRelease("32n", time, 0.3); // velocity 0.3
    }
    
    async resume() {
        await Tone.start();
    }
    
    getCurrentTime() {
        return Tone.now();
    }
}