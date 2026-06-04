// 1. 基础频率表 (补全了 D3)
const FREQ = {
    'G2': 98.00, 'A2': 110.00, 'B2': 123.47,
    'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
    'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00
};

// A#3 Bb3
function getFrequency(note) {
    if (note in FREQ) {
        return FREQ[note];
    } 
    if (note.length === 3 && note[1] === '#') {
        const baseNote = note[0] + note[2];
        if (baseNote in FREQ) {
            return FREQ[baseNote] * Math.pow(2, 1/12); // 升半音
        }
    }
    if (note.length === 3 && note[1] === 'b') {
        const baseNote = note[0] + note[2];
        if (baseNote in FREQ) {
            return FREQ[baseNote] / Math.pow(2, 1/12); // 降半音
        }
    }
    console.warn("Unknown note:", note);
    return 440.00; // 默认 A4
}

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
        scale: ['B3', 'C4','D4','E4','F4','G4','A4','B4','C5','D5'],
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
    },
    "a_minor_blues": {
        name: "Minor Blues (Soulful)",
        scale: ['A2','C3','D3','D#3','E3','G3','A3','C4','D4','D#4','E4','G4','A4'],
        // 新增：定义稳定音 (主音 A, 属音 E)
        stableNotes: ["A", "E"],
        specialNotes: ["D#"],
        startChord: "i",
        chords: {
            "i":   { name: "Am7",   root: "A2", tones: ["A", "C", "E", "G"] },
            "IV":  { name: "D7",    root: "D3", tones: ["D", "F#", "A", "C"] },
            "V":   { name: "E7",    root: "E3", tones: ["E", "G#", "B", "D"] }
        },
        graph: {
            "i":   { "IV": 4, "V": 2 },
            "IV":  { "i": 4, "V": 2 },
            "V":   { "i": 5, "IV": 1 }
        }
    },
    "c_dorian": {
        name: "C Dorian (Moody)",
        scale: ['C3','D3','Eb3','F3','G3','A3','Bb3','C4','D4','Eb4','F4','G4','A4'],
        // 新增：定义稳定音 (主音 C, 属音 G)
        stableNotes: ["C", "G"],
        specialNotes: ["Eb", "Bb"], // Dorian 模式的特征音
        startChord: "i",
        chords: {
            "i":   { name: "Cm7",   root: "C3", tones: ["C", "Eb", "G", "Bb"] },
            "ii":  { name: "Dm7",   root: "D3", tones: ["D", "F", "A", "C"] },
            "III": { name: "Ebmaj7",root: "Eb3",tones: ["Eb", "G", "Bb", "D"] },
            "IV":  { name: "F7",    root: "F3", tones: ["F", "A", "C", "Eb"] },
            "v":   { name: "Gm7",   root: "G3", tones: ["G", "Bb", "D", "F"] },
            "vi":  { name: "Am7b5", root: "A3", tones: ["A", "C", "Eb", "G"] },
            "VII": { name: "Bbmaj7",root: "Bb3",tones: ["Bb", "D", "F", "A"] }
        },
        graph: {
            "i":   { "IV": 3, "v": 2, "ii": 1 },
            "ii":  { "v": 4, "vi": 1 },
            "III": { "vi": 2, "VII": 2 },
            "IV":  { "v": 3, "i": 2, "ii": 1 },
            "v":   { "i": 4, "vi": 1 },
            "vi":  { "VII": 2, "IV": 2, "i": 1 },
            "VII": { "III": 3, "i": 2 }
        }
    }
};

const AUTO_DRUM_FILL_INTERVAL_BARS = 8;

const DRUM_PATTERN_POOL = {
    3: [
        // Waltz: kick on 1, snares on 2 and 3.
        { 0: ['kick', 'hihat'], 2: ['snare', 'hihat'], 4: ['snare', 'hihat'] },
        // 3/4 eighth-note variation with light offbeats.
        { 0: ['kick', 'hihat'], 1: ['hihat'], 2: ['snare'], 3: ['hihat'], 4: ['snare'], 5: ['hihat'] },
        // Country waltz-style variation with an extra beat-3 kick.
        { 0: ['kick'], 1: ['hihat'], 2: ['snare', 'hihat'], 4: ['kick', 'snare'], 5: ['hihat'] }
    ],
    6: [
        // Basic 6/8: kick on count 1, snare on count 4, hats on all counts.
        { 0: ['kick', 'hihat'], 2: ['hihat'], 4: ['hihat'], 6: ['snare', 'hihat'], 8: ['hihat'], 10: ['hihat'] },
        // 6/8 variation with an added kick on count 3 before the snare.
        { 0: ['kick', 'hihat'], 2: ['hihat'], 4: ['kick', 'hihat'], 6: ['snare', 'hihat'], 8: ['hihat'], 10: ['hihat'] },
        // 6/8 variation with an extra snare on count 6.
        { 0: ['kick'], 2: ['hihat'], 4: ['kick', 'hihat'], 6: ['snare', 'hihat'], 8: ['hihat'], 10: ['snare', 'hihat'] }
    ],
    default: [
        // Basic rock: eighth-note hats, kick on 1/3, snare on 2/4.
        { 0: ['kick', 'hihat'], 1: ['hihat'], 2: ['snare', 'hihat'], 3: ['hihat'], 4: ['kick', 'hihat'], 5: ['hihat'], 6: ['snare', 'hihat'], 7: ['hihat'] },
        // Four-on-the-floor/disco: kick every quarter, snare on 2/4.
        { 0: ['kick', 'hihat'], 1: ['hihat'], 2: ['kick', 'snare', 'hihat'], 3: ['hihat'], 4: ['kick', 'hihat'], 5: ['hihat'], 6: ['kick', 'snare', 'hihat'], 7: ['hihat'] },
        // Funk-style syncopation: offbeat kick around the backbeat.
        { 0: ['kick', 'hihat'], 1: ['hihat'], 2: ['snare', 'hihat'], 3: ['kick', 'hihat'], 4: ['hihat'], 5: ['snare', 'hihat'], 6: ['snare'], 7: ['kick', 'hihat'] },
        // Half-time feel: strong kick on 1, main snare on 3.
        { 0: ['kick', 'hihat'], 1: ['hihat'], 2: ['hihat'], 3: ['kick', 'hihat'], 4: ['snare', 'hihat'], 5: ['hihat'], 6: ['kick', 'hihat'], 7: ['hihat'] }
    ]
};

const DRUM_FILL_POOL = {
    3: [
        // Total Drummer: 3/4 straight quarter-note build, expanded to eighths around the kit.
        { 0: ['snare'], 2: ['snare'], 3: ['tom-high'], 4: ['tom-mid'], 5: ['tom-low'] },
        // Drumscore/Gear4music: eighth-note fill moving from snare to toms.
        { 0: ['snare'], 1: ['snare'], 2: ['tom-high'], 3: ['tom-mid'], 4: ['tom-low'], 5: ['tom-low'] },
        // Drumeo Motown-style idea: rack tom, snare, and floor tom orchestration.
        { 0: ['tom-high'], 2: ['snare'], 3: ['tom-high'], 4: ['snare'], 5: ['tom-low'] }
    ],
    6: [
        // Drumscore: full-bar eighth-note fill in 6/8 with snare/crash idea simplified to snare/toms.
        { 0: ['snare'], 2: ['snare'], 4: ['tom-high'], 6: ['tom-mid'], 8: ['tom-low'], 10: ['snare'] },
        // Total Drummer: 6/8 tom melody, felt as two groups of three eighth notes.
        { 0: ['tom-high'], 2: ['snare'], 4: ['tom-mid'], 6: ['tom-high'], 8: ['tom-mid'], 10: ['tom-low'] },
        // Drumscore RLLF concept adapted to this grid: hands around kit with kick resolution.
        { 0: ['snare'], 2: ['tom-high'], 4: ['kick'], 6: ['snare'], 8: ['tom-mid'], 10: ['kick', 'tom-low'] }
    ],
    default: [
        // Drumeo/Gear4music: traditional eighth-note fill, snare into toms.
        { 0: ['snare'], 1: ['snare'], 2: ['snare'], 3: ['snare'], 4: ['tom-high'], 5: ['tom-high'], 6: ['tom-low'], 7: ['tom-low'] },
        // Gear4music: 8th-note build, snare and floor tom together with quarter-note kick support.
        { 0: ['kick', 'snare', 'tom-low'], 1: ['snare', 'tom-low'], 2: ['kick', 'snare', 'tom-low'], 3: ['snare', 'tom-low'], 4: ['kick', 'snare', 'tom-low'], 5: ['snare', 'tom-low'], 6: ['kick', 'snare', 'tom-low'], 7: ['snare', 'tom-low'] },
        // DrumsTheWord: Fa-De-La-Dump concept, high-to-low movement resolving with kick.
        { 0: ['snare'], 1: ['tom-high'], 2: ['tom-low'], 3: ['kick'], 4: ['snare'], 5: ['tom-high'], 6: ['tom-low'], 7: ['kick'] },
        // Drumeo: Motown-style orchestration between rack tom, snare, and floor tom.
        { 0: ['tom-high'], 1: ['snare'], 2: ['tom-low'], 3: ['snare'], 4: ['tom-high'], 5: ['snare'], 6: ['tom-low'], 7: ['snare'] }
    ]
};
