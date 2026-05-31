class AudioEngine {
    constructor() {
        // 1. 混响链 (Reverb Chain)
        // Tone.js 的 Reverb 比卷积混响更灵活，且自带衰减控制
        this.reverb = new Tone.Reverb({
            decay: 4,
            preDelay: 0.2,
            wet: 0.4
        }).toDestination();
        this.reverb.generate();

        // 2. 效果器链 (Pad)
        this.padFilter = new Tone.AutoFilter({
            frequency: 0.2, baseFrequency: 200, octaves: 3, depth: 0.7, type: "sine"
        }).start();
        this.padTremolo = new Tone.Tremolo({
            frequency: 3, depth: 0.2, spread: 180
        }).start();

        // 3. 初始化合成器 (先创建空壳，具体参数由 setInstrument 填充)
        // Pad Synth
        this.padSynth = new Tone.PolySynth(Tone.AMSynth).chain(this.padTremolo, this.padFilter, this.reverb);
        
        // Lead Synth (旋律)
        // 使用 PolySynth 以支持快速音符重叠时的平滑过渡
        this.leadSynth = new Tone.PolySynth(Tone.FMSynth).connect(this.reverb);

        // 新增：用于 Wind Bell 的加法合成器组 (初始为空)
        this.additiveSynths = []; 
        
        // 4. 鼓组 & 环境音
        this.kick = new Tone.MembraneSynth({
            pitchDecay: 0.045,
            octaves: 3.5,
            oscillator: { type: "sine" },
            envelope: {
                attack: 0.001,
                decay: 0.14,
                sustain: 0,
                release: 0.18
            }
        }).toDestination();
        this.kick.volume.value = -7;
        this.snareFilter = new Tone.Filter({
            type: "bandpass",
            frequency: 2200,
            Q: 1
        }).toDestination();
        this.snare = new Tone.NoiseSynth({
            noise: { type: "pink" },
            envelope: {
                attack: 0.001,
                decay: 0.12,
                sustain: 0,
                release: 0.08
            }
        }).connect(this.snareFilter);
        this.snare.volume.value = -11;
        this.snareBody = new Tone.MembraneSynth({
            pitchDecay: 0.01,
            octaves: 0.8,
            oscillator: { type: "triangle" },
            envelope: {
                attack: 0.001,
                decay: 0.1,
                sustain: 0,
                release: 0.06
            }
        }).toDestination();
        this.snareBody.volume.value = -7;
        this.hihatFilter = new Tone.Filter({
            type: "highpass",
            frequency: 6500,
            Q: 0.8
        }).toDestination();
        this.hihat = new Tone.NoiseSynth({
            noise: { type: "white" },
            envelope: {
                attack: 0.001,
                decay: 0.035,
                sustain: 0,
                release: 0.02
            }
        }).connect(this.hihatFilter);
        this.hihat.volume.value = -21;
        this.drumPlayers = new Tone.Players({
            kick: "res/drums/kick.mp3",
            snare: "res/drums/snare.mp3",
            hihat: "res/drums/hihat.mp3",
            hihatHeavy: "res/drums/hihat-heavy.mp3"
        }).toDestination();
        this.drumPlayers.player("kick").volume.value = -8;
        this.drumPlayers.player("snare").volume.value = -10;
        this.drumPlayers.player("hihat").volume.value = -18;
        this.drumPlayers.player("hihatHeavy").volume.value = -22;
        this.rainNoise = new Tone.Noise("pink");
        this.rainFilter = new Tone.AutoFilter({ frequency: 0.1, depth: 0.5, baseFrequency: 600 }).start();
        this.rainVolume = new Tone.Volume(-Infinity);
        this.rainNoise.chain(this.rainFilter, this.rainVolume, this.reverb);
        this.rainNoise.start();

        // autostart: false (手动控制)
        // loop: true (循环播放)
        this.rainPlayer = new Tone.Player({
            url: "res/rain.mp3",
            loop: true,
            autostart: false,
            fadeIn: 2,  // 淡入 2秒
            fadeOut: 2  // 淡出 2秒
        }).toDestination(); // 直接输出，或者 .connect(this.reverb) 加混响
        this.rainPlayer.volume.value = -10;

        // 5. 加载默认音色
        this.setInstrument("origin");
    }
    
    // 加载音色
    setInstrument(presetKey) {
        const preset = INSTRUMENT_PRESETS[presetKey];
        if (!preset) return;

        console.log("Switching instrument to:", preset.name);
        
        // 保存当前预设类型，以便 playMelodyNote 知道怎么处理
        this.currentLeadType = preset.lead.type || "standard"; 

        // --- 1. 更新 Pad 设置 ---
        const { volume: padVolume, ...padParams } = preset.pad;
        this.padSynth.set(padParams);
        this.padSynth.volume.rampTo(padVolume, 0.1);

        // --- 2. 更新 Lead 设置 ---
        
        // 情况 A: 自定义加法合成 (如 Wind Bell)
        if (preset.lead.type === "customAdditive") {
            // 清理旧的加法合成器
            this.additiveSynths.forEach(s => {
                s.dispose();
            });
            this.additiveSynths = [];

            // 为每个谐波创建一个 PolySynth
            preset.lead.harmonics.forEach(h => {
                // 每个谐波本质上是一个正弦波合成器
                const synth = new Tone.PolySynth(Tone.Synth, {
                    oscillator: { type: "sine" },
                    envelope: preset.lead.envelope,
                    volume: preset.lead.volume + (Math.log10(h.amp) * 20) // 将线性振幅转换为 dB
                }).connect(this.reverb);
                
                // 存储比率，以便播放时计算频率
                synth._ratio = h.ratio; 
                this.additiveSynths.push(synth);
            });
            
            // 为了避免混淆，让主 leadSynth 静音，或者不管它
            this.leadSynth.volume.rampTo(-Infinity, 0.1);
        } 
        // 情况 B: 标准合成器 (标准流程)
        else {
            // 确保清理加法合成器以节省性能
            this.additiveSynths.forEach(s => {
                s.dispose();
            });
            this.additiveSynths = [];

            const { volume: leadVolume, ...leadParams } = preset.lead;
            
            // 如果从加法切回来，可能需要重置一下 oscillator 类型，防止报错
            // 因为 PolySynth.set 有时比较挑剔
            this.leadSynth.set(leadParams);
            this.leadSynth.volume.rampTo(leadVolume, 0.1);
        }
    }
    

    toggleRain(isEnabled) {
        if (isEnabled) {
            this.rainVolume.volume.rampTo(-15, 2);

            // 确保音频已加载 (Tone.Player 是异步加载的)
            if (this.rainPlayer.loaded) {
                this.rainPlayer.start();
                console.log("Rain MP3 started");
            } else {
                console.log("Rain MP3 loading...");
                // 如果还没加载完，等加载完自动播放
                Tone.loaded().then(() => {
                    this.rainPlayer.start();
                    console.log("Rain MP3 started (delayed)");
                });
            }
        } else {
            this.rainVolume.volume.rampTo(-Infinity, 2);

            this.rainPlayer.stop();
            console.log("Rain MP3 stopped");
        }
    }


    // 统一接口
    playPad(chord, time, style = "block", beatDuration) {
        // 释放之前的音 (如果有的话)
        this.padSynth.releaseAll(time);

        const notes = this.getChordNotes(chord);
        console.log("Playing chord:", chord.name, "Notes:", notes, "Style:", style);

        // 根据 style 决定触发方式
        switch (style) {
            case "strum": // 扫弦：模拟吉他，快速依次触发 (间隔 50ms)
                notes.forEach((note, i) => {
                    this.padSynth.triggerAttack(note, time + i * beatDuration / 4);
                });
                break;
            
            case "arpeggio": // 琶音：较慢的依次触发 (间隔 150ms)
                // 随机打乱 notes 顺序
                notes.sort(() => Math.random() - 0.5); // woc 这个写得好妙woc 好简洁
                notes.forEach((note, i) => {
                    this.padSynth.triggerAttackRelease(note, '1n', time + i * beatDuration);
                });
                break;

            case "block": // 柱状和弦：同时触发
            default:
                this.padSynth.triggerAttack(notes, time);
                break;
        }
    }

    // 辅助函数：根据和弦名称获取具体音符频率
    getChordNotes(chord) {
        const root = chord.root;

        const tones = chord.tones; // e.g. ["C", "E", "G", "B"]
        const octave = root.slice(-1); // e.g. "4"
        return tones.map(tone => {
            const noteName = tone + octave; // e.g. "C4", "E4", "G4", "B4"
            return Tone.Frequency(noteName);
        })  
    }

    playMelodyNote(freq, duration, time) {
        // 稍微随机化 velocity (力度)，让声音更自然
        const velocity = 0.6 + Math.random() * 0.3;

        if (this.currentLeadType === "customAdditive") {
            // 触发加法合成器组
            // 遍历所有子合成器，根据 ratio 算出对应的谐波频率并触发
            const baseFreq = Tone.Frequency(freq).toFrequency();
            
            this.additiveSynths.forEach(synth => {
                const harmonicFreq = baseFreq * synth._ratio;
                synth.triggerAttackRelease(harmonicFreq, duration, time, velocity);
            });

        } else {
            // 标准触发
            this.leadSynth.triggerAttackRelease(freq, duration, time, velocity);
        }
    }

    stopAll(time = Tone.now()) {
        this.padSynth.releaseAll(time);
        this.leadSynth.releaseAll(time);
        this.additiveSynths.forEach(synth => {
            synth.releaseAll(time);
        });
    }

    playDrumSample(name, time) {
        if (!this.drumPlayers) return false;

        const player = this.drumPlayers.player(name);
        if (!player || !player.loaded) return false;

        player.start(time);
        return true;
    }

    playKick(time) {
        if (this.playDrumSample('kick', time)) return;

        // C1 是标准的底鼓音高
        this.kick.triggerAttackRelease(55, "8n", time, 0.62);
    }

    playSnare(time) {
        if (this.playDrumSample('snare', time)) return;

        this.snareBody.triggerAttackRelease(200, "16n", time, 0.5);
        this.snare.triggerAttackRelease("16n", time, 0.58);
    }

    playHiHatHeavey(time) {
        if (this.playDrumSample('hihatHeavy', time) || this.playDrumSample('hihat', time)) return;

        // 触发短促的噪音
        this.hihat.triggerAttackRelease("32n", time, 0.3); // velocity 0.3
    }

    playHiHat(time) {
        if (this.playDrumSample('hihat', time)) return;

        // 触发短促的噪音
        this.hihat.triggerAttackRelease("32n", time, 0.2); // velocity 0.3
    }
    
    async resume() {
        await Tone.start();
    }
    
    getCurrentTime() {
        return Tone.now();
    }
}
