// --- 状态管理 ---
const state = {
    bpm: 80,
    beatsPerBar: 4, 
    currentPresetKey: 'c_major',
    
    // 修改：不再使用 index，而是使用 Key 和 对象
    currentChordKey: null, // e.g. "I", "vi"
    playingChord: null,    // 当前正在响的和弦对象 (用于旋律匹配)
    
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
let noiseGen; // 新增
let nextBeatTime = 0; 
let melodyBusyUntil = 0; // 新增：旋律忙碌截止时间，用于处理长音符 
let stepIndex = 0; // 新增：半拍计数器 (0, 1, 2, 3...) 
let timerWorker = null; // 新增：Worker 实例


const scaleSelect = document.getElementById('scale-select');
Object.keys(PRESETS).forEach(key => {
    const option = document.createElement('option');
    option.value = key;
    option.text = PRESETS[key].name;
    scaleSelect.appendChild(option);
});

// 新增：初始化音色选择器
const instrumentSelect = document.getElementById('instrument-select');
Object.keys(INSTRUMENT_PRESETS).forEach(key => {
    const option = document.createElement('option');
    option.value = key;
    option.text = INSTRUMENT_PRESETS[key].name;
    instrumentSelect.appendChild(option);
});

// --- 核心逻辑 ---

// 新增：基于权重的图游走算法
function getNextChordKey(currentKey, graph) {
    const transitions = graph[currentKey];
    if (!transitions) return currentKey; // 如果没有定义去向，保持不变

    // 1. 计算总权重
    const keys = Object.keys(transitions);
    let sum = 0;
    keys.forEach(k => sum += transitions[k]);
    
    // 2. 随机选择
    let r = Math.random() * sum;
    for (let k of keys) {
        r -= transitions[k];
        if (r <= 0) return k;
    }
    return keys[0]; // Fallback
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
            
            const preset = PRESETS[state.currentPresetKey];
            
            // 获取上一个演奏音符的音名 (去掉八度数字)
            // 注意：lastPlayedNoteIndex 可能越界，加个保护
            const lastNote = preset.scale[state.lastPlayedNoteIndex] || "C4";
            const pitchClass = lastNote.slice(0, -1); // e.g. "C4" -> "C"

            // 检查是否是稳定音 (如果 data.js 没配 stableNotes，默认允许休息)
            const isStable = preset.stableNotes ? preset.stableNotes.includes(pitchClass) : true;

            if (isStable) {
                // 是稳定音，允许休息
                state.phraseState = 'RESTING';
                state.phraseBeatsRemaining = [2, 4][Math.floor(Math.random() * 2)];
                
                // UI 反馈
                document.getElementById('note-display').innerText = "(Rest)";
                console.log(`Phrase resolved on ${lastNote}. Resting.`);
            } else {
                // 不是稳定音，强行延长乐句，寻找解决
                // 延长 1 到 2 拍，给 pick_gohome 更多机会去解决
                state.phraseBeatsRemaining += 2; 
                console.log(`Unstable note ${lastNote}. Extending phrase to find resolution...`);
            }
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
    
    // --- 新增：后台重同步逻辑 (Resync) ---
    // 如果 nextBeatTime 落后当前时间超过 0.5秒 (说明浏览器可能在后台被降频了)
    // 我们就不补齐中间的音符了，直接"快进"到当前时间，避免报错和爆音
    if (nextBeatTime < now - 0.5) {
        nextBeatTime = now;
    }

    // --- 统一调度核心 (The Grid) ---
    while (nextBeatTime < now + 0.1) {
        
        const isOnBeat = stepIndex % 2 === 0; 
        const currentBeatInBar = Math.floor(stepIndex / 2) % state.beatsPerBar;

        // 1. 鼓组 (Drums)
        if (state.isDrumsEnabled && isOnBeat) {
            if (currentBeatInBar === 0) {
                // engine.playKick(nextBeatTime);
                engine.playHiHatHeavey(nextBeatTime);
            } else {
                engine.playHiHat(nextBeatTime);
            }
        }

        // 2. 和弦 (Chords) - 只在小节第一拍触发
        if (currentBeatInBar === 0 && isOnBeat) {
            const preset = PRESETS[state.currentPresetKey];
            
            // 初始化 (如果是第一次播放)
            if (!state.currentChordKey) {
                state.currentChordKey = preset.startChord;
            }

            // 获取当前和弦数据
            const chord = preset.chords[state.currentChordKey];
            state.playingChord = chord; // 记录下来给旋律用
            
            // UI 更新
            document.getElementById('chord-display').innerText = chord.name;
            document.getElementById('chord-detail').innerText = `Notes: ${chord.tones.join("-")}`;
            
            // Audio
            // 随机选择演奏方式：大部分时候是柱状(block)，偶尔扫弦(strum)或琶音(arpeggio)
            const styles = ["block", "block", "block", "strum", "arpeggio"];
            const style = styles[Math.floor(Math.random() * styles.length)];
            
            engine.playPad(chord, nextBeatTime, style, beatDuration);

            // *** 关键：计算下一个和弦 (Graph Walk) ***
            state.currentChordKey = getNextChordKey(state.currentChordKey, preset.graph);
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

                // 2. 选音 (Pitch) - 修改：调用 NextNote 模块
                const preset = PRESETS[state.currentPresetKey];
                const selection = NextNote.pick_gohome(preset, state.playingChord, state.lastPlayedNoteIndex);
                
                state.lastPlayedNoteIndex = selection.index;
                const freq = FREQ[selection.note];

                // todo 根据选音的结果，如果是稳定音，则适当延长时值

                // 3. 播放
                engine.playMelodyNote(freq, durationSeconds, nextBeatTime);
                
                // UI
                document.getElementById('note-display').innerText = selection.note;
                const logDiv = document.getElementById('log');
                
                // 获取当前和弦名称用于日志
                const chordName = state.playingChord ? state.playingChord.name : "--";
                logDiv.innerHTML = `<div>${selection.note} (${durationInBeats}) on ${chordName}</div>` + logDiv.innerHTML;

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
}

// --- 事件监听 ---

document.getElementById('start-btn').addEventListener('click', async function() {
    await Tone.start();
    console.log("Audio Context Started");

    if (!engine) engine = new AudioEngine();
    // 新增：初始化噪音生成器
    if (!noiseGen) noiseGen = new NoiseGenerator();
    
    await engine.resume(); 
    state.isPlaying = true;
    this.style.display = 'none';
    document.getElementById('main-ui').style.opacity = 1;
    
    // 立即对齐时间
    const now = engine.getCurrentTime();
    nextBeatTime = now + 0.1; // 稍微延迟一点点开始，给音频引擎缓冲
    melodyBusyUntil = nextBeatTime; // 重置旋律状态
    stepIndex = 0; // 重置步进
    state.currentBeat = 0;
    state.currentChordKey = null; // 重置和弦
    
    // --- 修改：启动 Web Worker ---
    if (!timerWorker) {
        timerWorker = new Worker('js/worker.js');
        timerWorker.onmessage = function(e) {
            if (e.data === "tick") {
                tick(); // 收到 Worker 信号时执行 tick
            }
        };
    }
    timerWorker.postMessage("start");
});

// 新增：鼓组开关监听
document.getElementById('drums-toggle').addEventListener('change', (e) => {
    state.isDrumsEnabled = e.target.checked;
});

// 新增：雨声开关监听
document.getElementById('rain-toggle').addEventListener('change', (e) => {
    const isEnabled = e.target.checked;
    
    // 1. 控制音频
    if (engine) {
        engine.toggleRain(isEnabled);
    }
    
    // 2. 控制视觉
    visuals.toggle(isEnabled);
});

// --- 噪音控制事件监听 ---

// 1. 音量控制
document.getElementById('noise-vol').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (noiseGen) noiseGen.setVolume(val);
    
    // 联动视觉效果：有声音就有雨滴
    if (visuals) visuals.toggle(val > 0.05);
});

// 2. 频率控制 (Tone)
document.getElementById('noise-freq').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (noiseGen) noiseGen.setFilterFreq(val);
});

// 3. Q值控制 (Wind)
document.getElementById('noise-q').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (noiseGen) {
        noiseGen.setFilterQ(val);
        // 当 Q 值很高时，切换到带通滤波器，风声更逼真
        if (val > 5) {
            noiseGen.setType('bandpass');
        } else {
            noiseGen.setType('lowpass');
        }
    }
    
    // 联动视觉：风越大，雨越斜
    if (visuals) visuals.wind = val * 2; // 简单的联动映射
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
    state.currentChordKey = null; // 重置和弦，下次 tick 会自动初始化为 startChord
    // 可以在这里强制立即切换和弦，或者等待当前小节结束
});

// 新增：Instrument Control
instrumentSelect.addEventListener('change', (e) => {
    if (engine) {
        engine.setInstrument(e.target.value);
    }
});

// Time Sig Control
document.getElementById('time-sig-select').addEventListener('change', (e) => {
    state.beatsPerBar = parseInt(e.target.value);
});