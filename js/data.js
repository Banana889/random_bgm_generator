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
        name: "C Major (Happy/Pop)",
        scale: ['C3','D3','E3','F3','G3','A3','B3','C4','D4','E4','F4','G4','A4','B4','C5'],
        progression: [
            { name: "Cmaj7", root: "C3", tones: ["C", "E", "G", "B"] }, // I
            { name: "Am7",   root: "A2", tones: ["A", "C", "E", "G"] }, // vi
            { name: "Fmaj7", root: "F3", tones: ["F", "A", "C", "E"] }, // IV
            { name: "G6",    root: "G2", tones: ["G", "B", "D", "E"] }  // V
        ]
    },
    "a_minor": {
        name: "A Minor (Sad/Emotional)",
        scale: ['A2','B2','C3','D3','E3','F3','G3','A3','B3','C4','D4','E4','F4','G4','A4'],
        progression: [
            { name: "Am9",   root: "A2", tones: ["A", "C", "E", "G", "B"] }, // i
            { name: "Fmaj7", root: "F3", tones: ["F", "A", "C", "E"] },       // VI
            { name: "Cmaj7", root: "C3", tones: ["C", "E", "G", "B"] },       // III
            { name: "Em7",   root: "E3", tones: ["E", "G", "B", "D"] }        // v
        ]
    },
    "c_pentatonic": {
        name: "C Major Pentatonic (Chill)",
        scale: ['C3','D3','E3','G3','A3','C4','D4','E4','G4','A4','C5'],
        progression: [
            { name: "Cadd9", root: "C3", tones: ["C", "E", "G", "D"] },
            { name: "G6",    root: "G2", tones: ["G", "B", "D", "E"] },
            { name: "Am7",   root: "A2", tones: ["A", "C", "E", "G"] },
            { name: "Fmaj7", root: "F3", tones: ["F", "A", "C", "E"] }
        ]
    }
};