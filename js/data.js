// 1. 基础频率表 (补全了 D3)
const FREQ = {
    'G2': 98.00, 'A2': 110.00, 'B2': 123.47,
    'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
    'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00
};

// 2. 音乐预设 (包含音阶和对应的和弦进行)
const PRESETS = {
    "c_major": {
        name: "C Major (Dynamic Pop)",
        scale: ['C3','D3','E3','F3','G3','A3','B3','C4','D4','E4','F4','G4','A4','B4','C5'],
        // 新增：定义稳定音 (主音 C, 属音 G)
        stableNotes: ["C", "G"], 
        startChord: "I",
        // 定义该调式内可用的和弦节点
        chords: {
            "I":   { name: "Cmaj7", root: "C4", tones: ["C", "E", "G", "B"] },
            "ii":  { name: "Dm7",   root: "D4", tones: ["D", "F", "A", "C"] },
            "iii": { name: "Em7",   root: "E3", tones: ["E", "G", "B", "D"] },
            "IV":  { name: "Fmaj7", root: "F3", tones: ["F", "A", "C", "E"] },
            "V":   { name: "G7",    root: "G3", tones: ["G", "B", "D", "F"] },
            "vi":  { name: "Am7",   root: "A3", tones: ["A", "C", "E", "G"] }
        },
        // 定义和弦转移图 (权重越大，跳转概率越高)
        graph: {
            "I":   { "IV": 3, "V": 2, "vi": 2, "ii": 1 }, // 主和弦可以去任何地方
            "ii":  { "V": 4, "vi": 1 },                   // ii -> V (2-5进行)
            "iii": { "vi": 3, "IV": 1 },                  // iii -> vi
            "IV":  { "V": 3, "I": 2, "ii": 1 },           // IV -> V 或 回到 I
            "V":   { "I": 4, "vi": 2, "iii": 1 },         // V -> I (解决)
            "vi":  { "ii": 2, "IV": 2, "iii": 1, "V": 1 } // vi -> ii
        }
    },
    "a_minor": {
        name: "A Minor (Emotional)",
        scale: ['A2','B2','C3','D3','E3','F3','G3','A3','B3','C4','D4','E4','F4','G4','A4'],
        // 新增：定义稳定音 (主音 A, 属音 E)
        stableNotes: ["A", "E"],
        startChord: "i",
        chords: {
            "i":   { name: "Am9",   root: "A2", tones: ["A", "C", "E", "G", "B"] },
            "III": { name: "Cmaj7", root: "C3", tones: ["C", "E", "G", "B"] },
            "iv":  { name: "Dm7",   root: "D3", tones: ["D", "F", "A", "C"] },
            "v":   { name: "Em7",   root: "E3", tones: ["E", "G", "B", "D"] },
            "VI":  { name: "Fmaj7", root: "F3", tones: ["F", "A", "C", "E"] },
            "VII": { name: "G7",    root: "G2", tones: ["G", "B", "D", "F"] }
        },
        graph: {
            "i":   { "VI": 3, "iv": 2, "VII": 1, "III": 1 },
            "III": { "VI": 2, "VII": 2 },
            "iv":  { "v": 3, "VII": 1, "i": 1 },
            "v":   { "i": 4, "VI": 1 },
            "VI":  { "VII": 2, "iv": 2, "i": 1 },
            "VII": { "III": 3, "i": 2 }
        }
    },
    // "chill_lofi": {
    //     name: "Lo-Fi (Jazz Hop)",
    //     scale: ['C3','D3','E3','G3','A3','C4','D4','E4','G4','A4','C5'],
    //     // 新增：定义稳定音 (C, G)
    //     stableNotes: ["C", "G"],
    //     startChord: "I",
    //     chords: {
    //         "I":   { name: "Cmaj9", root: "C3", tones: ["C", "E", "G", "B", "D"] },
    //         "ii":  { name: "Dm9",   root: "D3", tones: ["D", "F", "A", "C", "E"] },
    //         "IV":  { name: "Fmaj9", root: "F3", tones: ["F", "A", "C", "E", "G"] },
    //         "vi":  { name: "Am9",   root: "A2", tones: ["A", "C", "E", "G", "B"] }
    //     },
    //     graph: {
    //         "I":   { "vi": 2, "IV": 2, "ii": 1 },
    //         "ii":  { "IV": 2, "I": 1 },
    //         "IV":  { "I": 2, "ii": 2 },
    //         "vi":  { "ii": 2, "IV": 2 }
    //     }
    // }, 
    "5_scale": {
        name: "Pentatonic Scale (Versatile)",
        scale: ['C3','D3','E3','G3','A3','C4','D4','E4','G4','A4','C5'],
        // 新增：定义稳定音 (C, G)
        stableNotes: ["C", "G"], 
        startChord: "I",
        // 定义该调式内可用的和弦节点
        chords: {
            "I":   { name: "Cmaj7", root: "C4", tones: ["C", "E", "G", "B"] },
            "ii":  { name: "Dm7",   root: "D3", tones: ["D", "F", "A", "C"] },
            "iii": { name: "Em7",   root: "E3", tones: ["E", "G", "B", "D"] },
            "IV":  { name: "Fmaj7", root: "F3", tones: ["F", "A", "C", "E"] },
            "V":   { name: "G7",    root: "G3", tones: ["G", "B", "D", "F"] },
            "vi":  { name: "Am7",   root: "A3", tones: ["A", "C", "E", "G"] }
        },
        // 定义和弦转移图 (权重越大，跳转概率越高)
        graph: {
            "I":   { "IV": 3, "V": 2, "vi": 2, "ii": 1 }, // 主和弦可以去任何地方
            "ii":  { "V": 4, "vi": 1 },                   // ii -> V (2-5进行)
            "iii": { "vi": 3, "IV": 1 },                  // iii -> vi
            "IV":  { "V": 3, "I": 2, "ii": 1 },           // IV -> V 或 回到 I
            "V":   { "I": 4, "vi": 2, "iii": 1 },         // V -> I (解决)
            "vi":  { "ii": 2, "IV": 2, "iii": 1, "V": 1 } // vi -> ii
        }
    },
    "c_major_high": {
        name: "C Major High (Bright)",
        scale: ['C4','D4','E4','F4','G4','A4','B4','C5','D5','E5','F5','G5'],
        // 新增：定义稳定音 (主音 C, 属音 G)
        stableNotes: ["C", "G"], 
        startChord: "I",
        // 定义该调式内可用的和弦节点
        chords: {
            "I":   { name: "Cmaj7", root: "C4", tones: ["C", "E", "G", "B"] },
            "ii":  { name: "Dm7",   root: "D4", tones: ["D", "F", "A", "C"] },
            "iii": { name: "Em7",   root: "E4", tones: ["E", "G", "B", "D"] },
            "IV":  { name: "Fmaj7", root: "F4", tones: ["F", "A", "C", "E"] },
            "V":   { name: "G7",    root: "G4", tones: ["G", "B", "D", "F"] },
            "vi":  { name: "Am7",   root: "A4", tones: ["A", "C", "E", "G"] }
        },
        // 定义和弦转移图 (权重越大，跳转概率越高)
        graph: {
            "I":   { "IV": 3, "V": 2, "vi": 2, "ii": 1 }, // 主和弦可以去任何地方
            "ii":  { "V": 4, "vi": 1 },                   // ii -> V (2-5进行)
            "iii": { "vi": 3, "IV": 1 },                  // iii -> vi
            "IV":  { "V": 3, "I": 2, "ii": 1 },           // IV -> V 或 回到 I
            "V":   { "I": 4, "vi": 2, "iii": 1 },         // V -> I (解决)
            "vi":  { "ii": 2, "IV": 2, "iii": 1, "V": 1 } // vi -> ii
        }
    }
};
