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
        this.padSynth = new Tone.PolySynth(Tone.Synth).chain(this.padTremolo, this.padFilter, this.reverb);
        
        // Lead Synth (旋律)
        // 使用 PolySynth 以支持快速音符重叠时的平滑过渡
        this.leadSynth = new Tone.PolySynth(Tone.Synth).connect(this.reverb);
        
        // 4. 鼓组 & 环境音 (保持不变)
        this.kick = new Tone.MembraneSynth().toDestination();
        this.hihat = new Tone.MetalSynth().toDestination();
        this.hihat.volume.value = -25;
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

    // 新增：切换音色方法
    setInstrument(presetKey) {
        const preset = INSTRUMENT_PRESETS[presetKey];
        if (!preset) return;

        console.log("Switching instrument to:", preset.name);

        // 更新 Pad 设置
        // 提取 volume 单独处理，其他参数全部传给 synth
        const { volume: padVolume, ...padParams } = preset.pad;
        this.padSynth.set(padParams);
        this.padSynth.volume.rampTo(padVolume, 0.1);

        // 更新 Lead 设置
        // 关键修改：使用解构赋值，把 modulation, modulationEnvelope 等所有参数都传进去
        const { volume: leadVolume, ...leadParams } = preset.lead;
        this.leadSynth.set(leadParams);
        this.leadSynth.volume.rampTo(leadVolume, 0.1);
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
        // 稍微随机化 velocity (力度)，让声音更自然
        const velocity = 0.6 + Math.random() * 0.3;
        this.leadSynth.triggerAttackRelease(freq, duration, time, velocity);
    }

    playKick(time) {
        // C1 是标准的底鼓音高
        this.kick.triggerAttackRelease(60, "8n", time);
    }

    playHiHatHeavey(time) {
        console.log("Playing hi-hat at time:", time);
        // 触发短促的噪音
        this.hihat.triggerAttackRelease(200, "32n", time, 0.25); // velocity 0.3
    }

    playHiHat(time) {
        console.log("Playing hi-hat at time:", time);
        // 触发短促的噪音
        this.hihat.triggerAttackRelease(160, "32n", time, 0.1); // velocity 0.3
    }
    
    async resume() {
        await Tone.start();
    }
    
    getCurrentTime() {
        return Tone.now();
    }
}