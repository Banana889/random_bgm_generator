// --- 状态管理 ---
const state = {
    bpm: 80,
    beatsPerBar: 4, 
    currentPresetKey: 'c_major',
    currentChordIndex: 0,
    lastPlayedNoteIndex: 7,
    isPlaying: false,
    isDrumsEnabled: false, 
    currentBeat: 0,
    
    // --- 新增：乐句与动机状态 ---
    phraseState: 'PLAYING', // 'PLAYING' | 'RESTING'
    phraseBeatsRemaining: 16, // 当前乐句还剩多少拍
    currentMotif: [], // 当前的节奏型 (数组，例如 [1, 0.5, 0.5])
    motifIndex: 0 // 当前播放到节奏型的第几步
};

// --- 初始化 ---
let engine; 
let nextBeatTime = 0; 
let melodyBusyUntil = 0; // 新增：旋律忙碌截止时间，用于处理长音符 
let stepIndex = 0; // 新增：半拍计数器 (0, 1, 2, 3...) 

// 填充下拉菜单
const scaleSelect = document.getElementById('scale-select');
Object.keys(PRESETS).forEach(key => {
    const option = document.createElement('option');
    option.value = key;
    option.innerText = PRESETS[key].name;
    scaleSelect.appendChild(option);
});

// --- 核心逻辑 ---

function getNoteWeight(noteName, noteIndex, chord) {
    let weight = 10;
    const pitchClass = noteName.slice(0, -1);
    
    // 1. 和声匹配
    if (chord.tones.includes(pitchClass)) weight += 50;

    // 2. 物理距离
    const distance = Math.abs(noteIndex - state.lastPlayedNoteIndex);
    if (distance === 0) weight -= 5;
    if (distance > 4) weight -= 20;
    if (distance > 7) weight -= 100;

    return Math.max(0, weight);
}

function pickNextNote() {
    const preset = PRESETS[state.currentPresetKey];
    const currentChord = preset.progression[state.currentChordIndex];
    const scale = preset.scale;

    let weightSum = 0;
    const candidates = scale.map((note, index) => {
        const w = getNoteWeight(note, index, currentChord);
        weightSum += w;
        return { note, index, weight: w };
    });

    let r = Math.random() * weightSum;
    for (let item of candidates) {
        r -= item.weight;
        if (r <= 0) return item;
    }
    return candidates[0];
}

// --- 新增：生成节奏动机 (Rhythmic Motif) ---
function generateNewMotif() {
    // 生成一个长度为 1小节 或 2小节 的节奏型
    const pattern = [];
    let remaining = 4.0; // 凑满 4 拍
    
    const possibleDurations = [0.5, 0.5, 1.0, 1.0, 2.0];
    
    while (remaining > 0) {
        // 随机选一个时值，但不能超过剩余时间
        let dur = possibleDurations[Math.floor(Math.random() * possibleDurations.length)];
        if (dur > remaining) dur = remaining; // 截断
        
        pattern.push(dur);
        remaining -= dur;
    }
    
    return pattern;
}

// --- 新增：乐句控制逻辑 ---
function updatePhraseState() {
    // 如果当前乐句/休息结束了
    if (state.phraseBeatsRemaining <= 0) {
        if (state.phraseState === 'PLAYING') {
            // 演奏结束，进入休息 (Rest)
            // 休息 2 到 4 拍
            state.phraseState = 'RESTING';
            state.phraseBeatsRemaining = [2, 4][Math.floor(Math.random() * 2)];
            
            // UI 反馈
            document.getElementById('note-display').innerText = "(Rest)";
            
        } else {
            // 休息结束，开始新乐句 (Phrase)
            state.phraseState = 'PLAYING';
            // 乐句长度：8拍 或 12拍 (2-3小节)
            state.phraseBeatsRemaining = [8, 12, 16][Math.floor(Math.random() * 3)];
            
            // *** 关键：新乐句开始时，生成一个新的节奏型 ***
            state.currentMotif = generateNewMotif();
            state.motifIndex = 0;
        }
    }
}

function tick() {
    if (!state.isPlaying) return;

    const now = engine.getCurrentTime();
    const beatDuration = 60.0 / state.bpm; 
    const stepDuration = beatDuration / 2; 
    
    // --- 统一调度核心 (The Grid) ---
    while (nextBeatTime < now + 0.1) {
        
        const isOnBeat = stepIndex % 2 === 0; 
        const currentBeatInBar = Math.floor(stepIndex / 2) % state.beatsPerBar;

        // 1. 鼓组 (Drums)
        if (state.isDrumsEnabled && isOnBeat) {
            if (currentBeatInBar === 0) {
                engine.playKick(nextBeatTime);
            } else {
                engine.playHiHat(nextBeatTime);
            }
        }

        // 2. 和弦 (Chords)
        if (currentBeatInBar === 0 && isOnBeat) {
            const preset = PRESETS[state.currentPresetKey];
            const chord = preset.progression[state.currentChordIndex];
            
            document.getElementById('chord-display').innerText = chord.name;
            document.getElementById('chord-detail').innerText = `Notes: ${chord.tones.join("-")}`;
            
            engine.playPad(chord, nextBeatTime);

// 准备下一个和弦索引
            state.currentChordIndex = (state.currentChordIndex + 1) % preset.progression.length;
        }

        // 3. 旋律 (Melody) - 乐句化与动机化
        if (nextBeatTime >= melodyBusyUntil - 0.001) {
            
            // 只有在半拍点上才尝试更新乐句状态 (避免切分音中间打断)
            // 这里简化处理：每次尝试播放音符前，检查乐句状态
            
            if (state.phraseState === 'RESTING') {
                // 休息中，什么都不做，只消耗时间
                melodyBusyUntil = nextBeatTime + stepDuration;
                state.phraseBeatsRemaining -= 0.5; // 消耗半拍
                updatePhraseState(); // 检查是否休息完了
                
            } else {
                // --- 演奏状态 ---
                
                // 1. 获取当前动机的下一个时值
                if (state.currentMotif.length === 0) state.currentMotif = generateNewMotif();
                
                const durationInBeats = state.currentMotif[state.motifIndex];
                const durationSeconds = beatDuration * durationInBeats;

                // 2. 选音 (Pitch) - 依然使用加权随机，保证和声匹配
                const selection = pickNextNote();
                state.lastPlayedNoteIndex = selection.index;
                const freq = FREQ[selection.note];

                // 3. 播放
                engine.playMelodyNote(freq, durationSeconds, nextBeatTime);
                
                // UI
                document.getElementById('note-display').innerText = selection.note;
                const logDiv = document.getElementById('log');
                logDiv.innerHTML = `<div>${selection.note} (${durationInBeats})</div>` + logDiv.innerHTML;

                // 4. 推进状态
                melodyBusyUntil = nextBeatTime + durationSeconds;
                
                // 推进动机索引 (循环播放这个节奏型)
                state.motifIndex = (state.motifIndex + 1) % state.currentMotif.length;
                
                // 消耗乐句剩余时间
                state.phraseBeatsRemaining -= durationInBeats;
                updatePhraseState(); // 检查乐句是否结束
            }
        }

        // --- 推进时间 ---
        nextBeatTime += stepDuration;
        stepIndex++;
        state.currentBeat = Math.floor(stepIndex / 2) % state.beatsPerBar;
    }

    requestAnimationFrame(tick);
}

// --- 事件监听 ---

document.getElementById('start-btn').addEventListener('click', function() {
    if (!engine) engine = new AudioEngine();
    engine.resume();
    
    state.isPlaying = true;
    this.style.display = 'none';
    document.getElementById('main-ui').style.opacity = 1;
    
    // 立即对齐时间
    const now = engine.getCurrentTime();
    nextBeatTime = now + 0.1; // 稍微延迟一点点开始，给音频引擎缓冲
    melodyBusyUntil = nextBeatTime; // 重置旋律状态
    stepIndex = 0; // 重置步进
    state.currentBeat = 0;
    state.currentChordIndex = 0; // 重置和弦
    
    tick();
});

// 新增：鼓组开关监听
document.getElementById('drums-toggle').addEventListener('change', (e) => {
    state.isDrumsEnabled = e.target.checked;
});

// BPM Control
const bpmSlider = document.getElementById('bpm-slider');
const bpmVal = document.getElementById('bpm-val');
bpmSlider.addEventListener('input', (e) => {
    state.bpm = parseInt(e.target.value);
    bpmVal.innerText = state.bpm;
});

// Scale Control
scaleSelect.addEventListener('change', (e) => {
    state.currentPresetKey = e.target.value;
    state.currentChordIndex = 0; // 重置和弦进度
    // 可以在这里强制立即切换和弦，或者等待当前小节结束
});

// Time Sig Control
document.getElementById('time-sig-select').addEventListener('change', (e) => {
    state.beatsPerBar = parseInt(e.target.value);
});