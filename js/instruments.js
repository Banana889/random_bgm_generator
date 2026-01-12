const INSTRUMENT_PRESETS = {
    "origin": {
        name: "Origin Instrument (Default)",
        // 和弦合成器配置
        pad: {
            oscillator: { type: "sine", count: 3, spread: 30 },
            envelope: { attack: 0.5, decay: 0.5, sustain: 0.8, release: 2 },
            volume: -10
        },
        lead: {
            // 使用 amsine (调幅正弦波) 来配合 modulation 参数
            oscillator: { type: "amsine", modulationType: "square" },
            envelope: { attack: 0.01, decay: 0.01, sustain: 1, release: 0.5 },
            
            // 新增：调制振荡器配置 (来自截图)
            modulation: { type: "square" },
            
            // 新增：调制包络 (控制"粗糙感"随时间的变化)
            modulationEnvelope: { 
                attack: 0.5, 
                decay: 0, 
                sustain: 1, 
                release: 0.5 
            },
            volume: -5
        }
    },
    "soft_dream": {
        name: "Soft Dream (C Major High, and higner BPM recommended)",
        // 和弦合成器配置 (保持不变)
        pad: {
            oscillator: { type: "sine", count: 10, spread: 30 },
            envelope: { attack: 1.0, decay: 3.0, sustain: 0.5, release: 2.0 },
            volume: -12
        },
        // 旋律合成器配置 (修改为 FM 铃铛音色)
        lead: {
            oscillator: { 
                type: "fmsine",         // FM 正弦波：制造清脆感的关键
                modulationType: "sine", // 调制波也是正弦波
                modulationIndex: 2,     // 调制深度：值越大声音越"亮"、越"金属"
                harmonicity: 3.0        // 谐波比率：3.0 会产生非常纯净的五度/八度泛音，像水晶
            },
            envelope: { 
                attack: 0.05, // 敲击感：瞬间达到最大音量
                decay: 0.4,   // 衰减：敲击后迅速变弱
                sustain: 0.5, // 延音：保持在很低的音量
                release: 3.0  // 释放：长长的尾音，营造梦幻感
            },
            // 这是一个小技巧：让金属感也随时间衰减，声音会更自然
            modulationEnvelope: {
                attack: 0.01,
                decay: 0.2,
                sustain: 0,
                release: 0.2
            },
            volume: -12 // 铃铛声音穿透力强，稍微降低一点音量
        }
    },
    "flute": {
        name: "Flute",
        // 和弦合成器配置
        pad: {
            oscillator: { type: "fattriangle", count: 3, spread: 20 },
            envelope: { attack: 2.0, decay: 3.0, sustain: 0.5, release: 2.0 },
            volume: -12
        },
        // 旋律合成器配置
        lead: {
            oscillator: { type: "triangle" },
            envelope: { attack: 0.05, decay: 0.2, sustain: 0.2, release: 1.5 },
            volume: -5
        }
    },
    // "retro_game": {
    //     name: "8-Bit Retro",
    //     pad: {
    //         oscillator: { type: "square" }, // 方波更有游戏感
    //         envelope: { attack: 0.1, decay: 0.1, sustain: 0.3, release: 0.1 },
    //         volume: -15
    //     },
    //     lead: {
    //         oscillator: { type: "pulse", width: 0.5 },
    //         envelope: { attack: 0.05, decay: 0.1, sustain: 0.2, release: 0.1 },
    //         volume: -10
    //     }
    // },
    "cinematic": {
        name: "Cinematic Strings",
        pad: {
            oscillator: { type: "fatsawtooth", count: 3, spread: 40 }, // 锯齿波更像弦乐
            envelope: { attack: 1.5, decay: 4.0, sustain: 0.7, release: 3.0 },
            volume: -15
        },
        lead: {
            oscillator: { type: "fmsine", modulationType: "sine", modulationIndex: 3, harmonicity: 3 }, // FM合成模拟钟琴/玻璃声
            envelope: { attack: 0.01, decay: 0.5, sustain: 0.1, release: 2.0 },
            volume: -8
        }
    },
    "electric_piano": {
        name: "Electric Piano",
        pad: {
            oscillator: { type: "fmsine", modulationIndex: 10, harmonicity: 1 },
            envelope: { attack: 0.1, decay: 1.5, sustain: 0.2, release: 1.0 },
            volume: -10
        },
        lead: {
            oscillator: { type: "sine" },
            envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.5 },
            volume: -2
        }
    }, 
    "wind_bell": {
        name: "Wind Bell",
        pad: {
            oscillator: { type: "fmsine", modulationIndex: 10, harmonicity: 1 },
            envelope: { attack: 0.1, decay: 1.5, sustain: 0.2, release: 1.0 },
            volume: -5
        },
        lead: {
            type: "customAdditive",
            harmonics: [
                { ratio: 1.0, amp: 1.0 },
                { ratio: 10.2, amp: 0.1 },
                { ratio: 13.14, amp: 0.03 }
            ],
            volume: -8,
            envelope: { attack: 0.01, decay: 0.5, sustain: 0.5, release: 0.5 },
        }
    }, 
};