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
            pitchDecay: 0.08,
            octaves: 6,               // 进一步降低八度变化
            oscillator: { type: "sine" },
            envelope: {
                attack: 0.001,
                decay: 0.5,
                sustain: 0.03,
                release: 0.7,
                attackCurve: "sine"   // 更柔和的起音曲线
            }
        });
        
        // 添加低通滤波器，切掉刺耳的高频
        const filter = new Tone.Filter({
            type: "lowpass",
            frequency: 120,           // 只保留120Hz以下低频
            rolloff: -12,
            Q: 1
        });
        
        // 添加轻微饱和/失真，增加谐波温暖感
        const saturation = new Tone.Distortion({
            distortion: 0.2,          // 轻微失真，不要超过0.3
            wet: 0.3                  // 混合比例30%
        });
        
        // 串联效果器
        this.kick.chain(saturation, filter, Tone.Destination);
        this.kick.volume.value = -6;

        // 镲片：MetalSynth (专门做金属打击乐)
        this.hihat = new Tone.MetalSynth({
            frequency: 200,
            envelope: {
                attack: 0.005,
                decay: 0.1,
                release: 0.01
            },
            harmonicity: 5.1,
            modulationIndex: 32,
            resonance: 4000,
            octaves: 1.5
        }).toDestination();
        this.hihat.volume.value = -10; // 稍微小声点
    }

    // 统一接口
    playPad(chord, time, style = "block") {
        // 释放之前的音 (如果有的话)
        this.padSynth.releaseAll(time);

        const notes = this.getChordNotes(chord);
        console.log("Playing chord:", chord.name, "Notes:", notes, "Style:", style);

        // 根据 style 决定触发方式
        switch (style) {
            case "strum": // 扫弦：模拟吉他，快速依次触发 (间隔 50ms)
                notes.forEach((note, i) => {
                    this.padSynth.triggerAttack(note, time + i * time / 8);
                });
                break;
            
            case "arpeggio": // 琶音：较慢的依次触发 (间隔 150ms)
                notes.forEach((note, i) => {
                    this.padSynth.triggerAttack(note, time + i * time / 4);
                });
                break;

            case "block": // 柱状和弦：同时触发
            default:
                this.padSynth.triggerAttack(notes, time);
                break;
        }
        this.padSynth.volume.value = -30;
    }

    // 辅助函数：根据和弦名称获取具体音符频率
    getChordNotes(chord) {
        const root = chord.root;
        
        // 定义常见和弦类型的音程关系 (半音偏移)
        // 可以在这里扩展更多类型
        const INTERVALS = {
            "maj7": [0, 4, 7, 11],      // 大七
            "m7":   [0, 3, 7, 10],      // 小七
            "7":    [0, 4, 7, 10],      // 属七
            "maj9": [0, 4, 7, 11, 14],  // 大九
            "m9":   [0, 3, 7, 10, 14],  // 小九
            "9":    [0, 4, 7, 10, 14],  // 属九
            "6":    [0, 4, 7, 9],       // 大六
            "m6":   [0, 3, 7, 9],       // 小六
            "dim":  [0, 3, 6],          // 减三
            "aug":  [0, 4, 8]           // 增三
        };

        let intervals = [0, 7, 12]; // 默认: 根音+五度+八度 (Power Chord)

        // 简单的名称匹配逻辑 (注意顺序：先匹配长的后缀)
        const name = chord.name;
        if (name.includes("maj9")) intervals = INTERVALS["maj9"];
        else if (name.includes("m9")) intervals = INTERVALS["m9"];
        else if (name.includes("maj7")) intervals = INTERVALS["maj7"];
        else if (name.includes("m7")) intervals = INTERVALS["m7"];
        else if (name.includes("7")) intervals = INTERVALS["7"];
        else if (name.includes("6")) intervals = INTERVALS["6"];
        
        // 转换 intervals 为频率
        return intervals.map(semitone => Tone.Frequency(root).transpose(semitone));
    }

    playMelodyNote(freq, duration, time) {
        // Tone.js 可以直接接受频率数字
        this.melodySynth.triggerAttackRelease(freq, duration, time);
    }

    playKick(time) {
        // C1 是标准的底鼓音高
        this.kick.triggerAttackRelease(60, "8n", time);
    }

    playHiHat(time) {
        console.log("Playing hi-hat at time:", time);
        // 触发短促的噪音
        this.hihat.triggerAttackRelease(200, "32n", time, 0.1); // velocity 0.3
    }
    
    async resume() {
        await Tone.start();
    }
    
    getCurrentTime() {
        return Tone.now();
    }
}