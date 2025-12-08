// --- 状态管理 ---
const state = {
    bpm: 80,
    beatsPerBar: 4, 
    currentPresetKey: 'c_major',
    currentChordIndex: 0,
    lastPlayedNoteIndex: 7,
    isPlaying: false,
    isDrumsEnabled: false, // 新增
    currentBeat: 0         // 新增：当前是第几拍 (0, 1, 2, 3...)
};

// --- 初始化 ---
let engine; 
// 移除独立的 nextNoteTime 和 nextChordTime，统一使用 nextBeatTime
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

function tick() {
    if (!state.isPlaying) return;

    const now = engine.getCurrentTime();
    const beatDuration = 60.0 / state.bpm; 
    const stepDuration = beatDuration / 2; // 最小步进改为半拍
    
    // --- 统一调度核心 (The Grid) ---
    // 我们只看"下一个半拍"什么时候来
    while (nextBeatTime < now + 0.1) {
        
        const isOnBeat = stepIndex % 2 === 0; // 是否是整拍
        const currentBeatInBar = Math.floor(stepIndex / 2) % state.beatsPerBar;

        // 1. 鼓组 (Drums) - 只在整拍触发
        if (state.isDrumsEnabled && isOnBeat) {
            if (currentBeatInBar === 0) {
                engine.playKick(nextBeatTime);
            } else {
                engine.playHiHat(nextBeatTime);
            }
        }

        // 2. 和弦 (Chords) - 只在小节第一拍触发
        if (currentBeatInBar === 0 && isOnBeat) {
            const preset = PRESETS[state.currentPresetKey];
            const chord = preset.progression[state.currentChordIndex];
            
            // UI 更新
            // 注意：为了避免UI闪烁，这里可以加个简单的防抖，或者直接更新
            document.getElementById('chord-display').innerText = chord.name;
            document.getElementById('chord-detail').innerText = `Notes: ${chord.tones.join("-")}`;
            
            // Audio: 传入精确的 nextBeatTime
            engine.playPad(chord, nextBeatTime);

            // 准备下一个和弦索引
            state.currentChordIndex = (state.currentChordIndex + 1) % preset.progression.length;
        }

        // 3. 旋律 (Melody) - 支持切分音和长音符
        // 检查旋律是否空闲 (使用小量 epsilon 避免浮点误差)
        if (nextBeatTime >= melodyBusyUntil - 0.001) {
            // 50% 概率触发
            if (Math.random() > 0.3) {
                const selection = pickNextNote();
                state.lastPlayedNoteIndex = selection.index;
                
                const freq = FREQ[selection.note];
                
                // 随机时值：0.5, 1, 2 拍
                const durationOptions = [0.5, 0.5, 1, 1, 2];
                const beats = durationOptions[Math.floor(Math.random() * durationOptions.length)];
                const duration = beatDuration * beats;

                // Audio: 传入精确的 nextBeatTime
                engine.playMelodyNote(freq, duration, nextBeatTime);
                
                // 标记忙碌时间，在此期间不会生成新音符
                melodyBusyUntil = nextBeatTime + duration;
                
                // UI 更新
                document.getElementById('note-display').innerText = selection.note;
                const logDiv = document.getElementById('log');
                // 简单的日志
                logDiv.innerHTML = `<div>${selection.note} (${beats} beats)</div>` + logDiv.innerHTML;
            } else {
                document.getElementById('note-display').innerText = "...";
                // 如果决定休止，至少休止一个半拍
                melodyBusyUntil = nextBeatTime + stepDuration;
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