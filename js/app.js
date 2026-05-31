// --- 状态管理 ---
const state = {
    bpm: 65,
    beatsPerBar: 4, 
    currentPresetKey: 'c_major',
    
    // 修改：不再使用 index，而是使用 Key 和 对象
    currentChordKey: null, // e.g. "I", "vi"
    playingChord: null,    // 当前正在响的和弦对象 (用于旋律匹配)
    
    lastPlayedNoteIndex: 7,
    isPlaying: false,
    isDrumsEnabled: false, 
    currentBeat: 0,
    melodyTrail: [],
    drumTrail: [],
    drumPattern: {},
    drumPatternBarsRemaining: 0,
    isDrumFillEnabled: false,
    drumFillQueued: false,
    drumFillActive: false,
    drumFillPattern: {},
    drumFillBarsUntilAuto: AUTO_DRUM_FILL_INTERVAL_BARS,
    
    // --- 新增：乐句与动机状态 ---
    phraseState: 'PLAYING', // 'PLAYING' | 'RESTING'
    phraseBeatsRemaining: 16, // 当前乐句还剩多少拍
    currentMotif: [], // 当前的节奏型 (数组，例如 [1, 0.5, 0.5])
    motifIndex: 0 // 当前播放到节奏型的第几步
};

// --- 初始化 ---
let engine; 
let noiseGen; // 新增
let toneLoadPromise = null;
let nextBeatTime = 0; 
let melodyBusyUntil = 0; // 新增：旋律忙碌截止时间，用于处理长音符 
let stepIndex = 0; // 新增：半拍计数器 (0, 1, 2, 3...) 
let timerWorker = null; // 新增：Worker 实例
const SCHEDULE_LOOKAHEAD = 0.18;
const MAX_MELODY_TRAIL = 12;
const MAX_DRUM_TRAIL = 28;

const rainToggle = document.getElementById('rain-toggle');
const thunderToggle = document.getElementById('thunder-toggle');
const thunderVolInput = document.getElementById('noise-vol');
const thunderDistanceInput = document.getElementById('noise-freq');
const noiseQInput = document.getElementById('noise-q');
const drumVolInput = document.getElementById('drum-vol');
const drumFillBtn = document.getElementById('drum-fill-btn');
const drumFillControl = document.querySelector('.fill-control');
const startBtn = document.getElementById('start-btn');

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

function renderMelodyTrail() {
    const trail = document.getElementById('melody-trail');
    const lastDrumIndex = state.drumTrail.length - 1;
    const drumEvents = state.drumTrail.map((event, index) => `
        <span class="drum-mark drum-${event.type}${event.isFill ? ' drum-fill' : ''}${index === lastDrumIndex ? ' drum-mark-current' : ''}" style="--drum-x: ${event.x}; --drum-y: ${event.y}; --drum-size: ${event.size}" aria-label="${event.type}"></span>
    `).join('');
    const melodyEvents = state.melodyTrail.map(event => `
        <span class="trail-note" style="--pitch-y: ${event.pitchY}; --note-size: ${event.size}" aria-label="${event.note}">
            <span class="note-head"></span>
            <span class="note-tail"></span>
        </span>
    `).join('');

    trail.innerHTML = `${drumEvents}${melodyEvents}`;
}

function pushMelodyTrail(note, noteIndex, durationInBeats, scaleLength) {
    state.melodyTrail.push({
        note,
        pitchY: Math.max(0, Math.min(1, noteIndex / Math.max(scaleLength - 1, 1))),
        size: Math.min(durationInBeats / 2, 1)
    });
    if (state.melodyTrail.length > MAX_MELODY_TRAIL) {
        state.melodyTrail.shift();
    }
    renderMelodyTrail();
}

function pushDrumTrail(type, beatPosition, isFill = false) {
    const props = {
        kick: { y: 0.82, size: 1 },
        snare: { y: 0.5, size: 0.82 },
        hihat: { y: 0.2, size: 0.48 },
        'tom-low': { y: 0.68, size: 0.86 },
        'tom-mid': { y: 0.42, size: 0.8 },
        'tom-high': { y: 0.28, size: 0.74 },
        crash: { y: 0.12, size: 1.08 }
    }[type];
    if (!props) return;

    state.drumTrail.push({
        type,
        x: Math.max(0, Math.min(1, beatPosition / Math.max(state.beatsPerBar, 1))),
        y: props.y,
        size: props.size,
        isFill
    });
    if (state.drumTrail.length > MAX_DRUM_TRAIL) {
        state.drumTrail.shift();
    }
    renderMelodyTrail();
}

function playDrum(type, time, beatPosition, isFill = false) {
    if (type === 'kick') {
        engine.playKick(time);
    } else if (type === 'snare') {
        engine.playSnare(time);
    } else if (type === 'tom-low') {
        engine.playTomLow(time);
    } else if (type === 'tom-mid') {
        engine.playTomMid(time);
    } else if (type === 'tom-high') {
        engine.playTomHigh(time);
    } else if (type === 'crash') {
        engine.playCrash(time);
    } else if (type === 'hihat-heavy') {
        engine.playHiHatHeavey(time);
        pushDrumTrail('hihat', beatPosition, isFill);
        return;
    } else if (type === 'hihat') {
        engine.playHiHat(time);
    } else {
        return;
    }

    pushDrumTrail(type, beatPosition, isFill);
}

function pickDrumPattern(beatsPerBar) {
    const patterns = DRUM_PATTERN_POOL[beatsPerBar] || DRUM_PATTERN_POOL.default;
    return patterns[Math.floor(Math.random() * patterns.length)];
}

function pickDrumFill(beatsPerBar) {
    const fills = DRUM_FILL_POOL[beatsPerBar] || DRUM_FILL_POOL.default;
    return fills[Math.floor(Math.random() * fills.length)];
}

function setDrumFillUi(mode) {
    drumFillControl.classList.toggle('is-queued', mode === 'queued');
    drumFillControl.classList.toggle('is-active', mode === 'active');
}

function clearDrumFill() {
    state.drumFillQueued = false;
    state.drumFillActive = false;
    state.drumFillPattern = {};
    setDrumFillUi('idle');
}

function setDrumFillEnabled(isEnabled) {
    state.isDrumFillEnabled = isEnabled;
    drumFillBtn.checked = isEnabled;
    state.drumFillBarsUntilAuto = AUTO_DRUM_FILL_INTERVAL_BARS;
    if (!isEnabled) {
        clearDrumFill();
    }
}

function playDrumPatternStep(currentHalfBeatInBar, time) {
    if (currentHalfBeatInBar === 0) {
        if (state.drumFillActive) {
            playDrum('crash', time, 0, true);
            state.drumFillActive = false;
            state.drumFillPattern = {};
            setDrumFillUi('idle');
        }

        if (state.isDrumFillEnabled && !state.drumFillQueued) {
            state.drumFillBarsUntilAuto -= 1;
        }

        if (state.isDrumFillEnabled && (state.drumFillQueued || state.drumFillBarsUntilAuto <= 0)) {
            state.drumFillQueued = false;
            state.drumFillActive = true;
            state.drumFillPattern = pickDrumFill(state.beatsPerBar);
            state.drumFillBarsUntilAuto = AUTO_DRUM_FILL_INTERVAL_BARS;
            setDrumFillUi('active');
        } else if (state.drumPatternBarsRemaining <= 0) {
            state.drumPattern = pickDrumPattern(state.beatsPerBar);
            state.drumPatternBarsRemaining = 2 + Math.floor(Math.random() * 3);
        } else {
            state.drumPatternBarsRemaining -= 1;
        }
    }

    const pattern = state.drumFillActive ? state.drumFillPattern : state.drumPattern;
    const hits = pattern[currentHalfBeatInBar] || [];
    hits.forEach(type => {
        playDrum(type, time, currentHalfBeatInBar / 2, state.drumFillActive);
    });
}

function clearVisualHistory() {
    state.melodyTrail = [];
    state.drumTrail = [];
    renderMelodyTrail();
}

function loadTone() {
    if (window.Tone) return Promise.resolve(window.Tone);
    if (toneLoadPromise) return toneLoadPromise;

    toneLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js';
        script.onload = () => resolve(window.Tone);
        script.onerror = () => reject(new Error('Failed to load Tone.js'));
        document.head.appendChild(script);
    });

    return toneLoadPromise;
}

// --- 核心逻辑 ---

// 新增：基于权重的图游走算法
function getNextChordKey(currentKey, graph) {
    const transitions = graph[currentKey];
    if (!transitions) return currentKey; // 如果没有定义去向，保持不变

    // 1. 计算总权重
    const keys = Object.keys(transitions);
    let sum = 0;
    keys.forEach(k => {
        sum += transitions[k];
    });
    
    // 2. 随机选择
    let r = Math.random() * sum;
    for (let k of keys) {
        r -= transitions[k];
        if (r <= 0) return k;
    }
    return keys[0]; // Fallback
}

// --- 新增：生成节奏动机 (Rhythmic Motif) ---
function generateNewMotif(beatsPerBar) {
    // 生成一个长度为 1小节 或 2小节 的节奏型
    const pattern = [];
    let remaining = beatsPerBar; // 凑满 4 拍
    
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
    if (state.phraseBeatsRemaining <= 1) { // 这里要改成1， 如果是 0 的话会在下一个小节发出一个音之后截断
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
            state.currentMotif = generateNewMotif(state.beatsPerBar);
            state.motifIndex = 0;
        }
    }
}

function tick() {
    if (!state.isPlaying) return;

    const now = engine.getCurrentTime();
    const beatDuration = state.beatsPerBar === 6 ? (60.0 / state.bpm) / 3 : 60.0 / state.bpm; 
    const stepDuration = beatDuration / 2; 
    
    // 移动端后台会节流 JS。恢复时不要补打过期事件，否则容易出现毛刺/沙沙声。
    if (nextBeatTime < now - stepDuration) {
        nextBeatTime = now + 0.02;
        melodyBusyUntil = Math.max(melodyBusyUntil, nextBeatTime);
    }

    // --- 统一调度核心 (The Grid) ---
    while (nextBeatTime < now + SCHEDULE_LOOKAHEAD) {
        const isOnBeat = stepIndex % 2 === 0;
        const currentHalfBeatInBar = stepIndex % (state.beatsPerBar * 2);
        const currentBeatInBar = Math.floor(stepIndex / 2) % state.beatsPerBar;

        // 1. 鼓组 (Drums)
        if (state.isDrumsEnabled) {
            playDrumPatternStep(currentHalfBeatInBar, nextBeatTime);
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
                if (state.currentMotif.length === 0) state.currentMotif = generateNewMotif(state.beatsPerBar);

                const durationInBeats = state.currentMotif[state.motifIndex];
                const durationSeconds = beatDuration * durationInBeats;

                // 2. 选音 (Pitch) - 修改：调用 NextNote 模块
                const preset = PRESETS[state.currentPresetKey];
                const selection = NextNote.pick_gohome(preset, state.playingChord, state.lastPlayedNoteIndex);

                state.lastPlayedNoteIndex = selection.index;

                // todo 根据选音的结果，如果是稳定音，则适当延长时值

                // 3. 播放
                engine.playMelodyNote(selection.note, durationSeconds, nextBeatTime);

                // UI
                document.getElementById('note-display').innerText = selection.note;
                pushMelodyTrail(selection.note, selection.index, durationInBeats, preset.scale.length);
                const logDiv = document.getElementById('log');

                // 获取当前和弦名称用于日志
                const chordName = state.playingChord ? state.playingChord.name : "--";
                const barSize = Math.min(durationInBeats / 2, 1);
                logDiv.insertAdjacentHTML('afterbegin', `
                    <div class="note-event">
                        <span class="event-note">${selection.note}</span>
                        <span class="event-duration" aria-label="${durationInBeats} beats">
                            <span style="--duration-size: ${barSize}"></span>
                        </span>
                        <span class="event-beats">${durationInBeats}</span>
                        <span class="event-chord">${chordName}</span>
                    </div>
                `);
                while (logDiv.children.length > 20) {
                    logDiv.lastElementChild.remove();
                }

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

document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
        const tab = button.dataset.tab;

        document.querySelectorAll('.tab-button').forEach(tabButton => {
            const isActive = tabButton === button;
            tabButton.classList.toggle('active', isActive);
            tabButton.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        document.querySelectorAll('.tab-panel').forEach(panel => {
            const isActive = panel.dataset.panel === tab;
            panel.classList.toggle('active', isActive);
            panel.hidden = !isActive;
        });
    });
});

function syncThunderNoiseControls() {
    const isRainEnabled = rainToggle.checked;
    const isThunderEnabled = thunderToggle.checked;
    const vol = parseFloat(thunderVolInput.value);
    const distance = parseFloat(thunderDistanceInput.value);
    const freq = 3000 - distance * 2900;
    const character = parseFloat(noiseQInput.value);

    if (noiseGen) {
        // 2. 频率控制 (Tone)
        noiseGen.setFilterFreq(freq);

        // 3. Character 控制：低值偏雷声，高值偏风声。
        noiseGen.setFilterQ(character);
        // 当 Q 值很高时，切换到带通滤波器，风声更逼真
        noiseGen.setType(character > 5 ? 'bandpass' : 'lowpass');

        // 雷声/噪声独立于雨层开关，但跟随 Session 生命周期和雷声开关。
        noiseGen.setVolume(state.isPlaying && isThunderEnabled ? vol : 0);
    }

    if (visuals) {
        // 雨视觉只跟随雨层开关，不再被雷声音量滑块关掉。
        visuals.setIntensity(isRainEnabled ? 0.45 : 0);
        visuals.setTone(400);
        visuals.setWind(character * 2);
        visuals.toggle(isRainEnabled);
        if (typeof visuals.setThunder === 'function') {
            visuals.setThunder(state.isPlaying && isThunderEnabled, vol, distance);
        }
    }
}

function syncDrumVolume() {
    if (engine) {
        engine.setDrumVolume(parseFloat(drumVolInput.value));
    }
}

function resetSchedulerTiming(offset = 0.12) {
    if (!engine) return;

    const now = engine.getCurrentTime();
    nextBeatTime = now + offset;
    melodyBusyUntil = nextBeatTime;
}

function stopSession() {
    state.isPlaying = false;
    clearDrumFill();
    state.isDrumFillEnabled = false;
    drumFillBtn.checked = false;
    state.drumFillBarsUntilAuto = AUTO_DRUM_FILL_INTERVAL_BARS;

    if (timerWorker) {
        timerWorker.postMessage("stop");
    }

    if (engine) {
        engine.stopAll();
        engine.toggleRain(false);
    }

    if (rainToggle) {
        rainToggle.checked = false;
    }

    if (thunderToggle) {
        thunderToggle.checked = false;
    }

    syncThunderNoiseControls();
    startBtn.innerText = "Start Session";
    startBtn.classList.remove('is-ending');
    document.getElementById('main-ui').style.opacity = 0.34;
    document.getElementById('note-display').innerText = "--";
    document.getElementById('chord-display').innerText = "--";
    document.getElementById('chord-detail').innerText = "Waiting...";
    document.getElementById('log').innerHTML = "";
    clearVisualHistory();
}

startBtn.addEventListener('click', async function() {
    if (state.isPlaying) {
        stopSession();
        return;
    }

    await loadTone();
    await Tone.start();

    if (!engine) engine = new AudioEngine();
    await engine.resume();
    syncDrumVolume();
    console.log("Audio Context Started");

    // 新增：初始化雷声噪声生成器
    if (!noiseGen) noiseGen = new NoiseGenerator();

    state.isPlaying = true;
    syncThunderNoiseControls();
    startBtn.innerText = "End Session";
    startBtn.classList.add('is-ending');
    document.getElementById('main-ui').style.opacity = 1;

    // 立即对齐时间
    resetSchedulerTiming(0.1); // 稍微延迟一点点开始，给音频引擎缓冲
    stepIndex = 0; // 重置步进
    state.currentBeat = 0;
    state.currentChordKey = null; // 重置和弦
    state.drumFillBarsUntilAuto = AUTO_DRUM_FILL_INTERVAL_BARS;
    clearVisualHistory();

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
    if (!state.isDrumsEnabled) {
        state.isDrumFillEnabled = false;
        drumFillBtn.checked = false;
        clearDrumFill();
        state.drumFillBarsUntilAuto = AUTO_DRUM_FILL_INTERVAL_BARS;
    }
});

drumVolInput.addEventListener('input', syncDrumVolume);

drumFillBtn.addEventListener('change', () => {
    if (!state.isPlaying || !state.isDrumsEnabled) {
        setDrumFillEnabled(false);
        return;
    }

    setDrumFillEnabled(drumFillBtn.checked);
});

// 新增：雨声开关监听
document.getElementById('rain-toggle').addEventListener('change', (e) => {
    const isEnabled = e.target.checked;
    
    // 1. 控制音频
    if (engine) {
        engine.toggleRain(isEnabled);
    }

    // 2. 控制雨视觉并同步雷声参数
    syncThunderNoiseControls();
});

// --- 雷声控制事件监听 ---

document.getElementById('thunder-toggle').addEventListener('change', (e) => {
    syncThunderNoiseControls();
});

// 1. 音量控制
document.getElementById('noise-vol').addEventListener('input', (e) => {
    syncThunderNoiseControls();
});

// 2. 距离控制，越远越低沉
document.getElementById('noise-freq').addEventListener('input', (e) => {
    syncThunderNoiseControls();
});

// 3. Character 控制：Thunder 到 Wind
document.getElementById('noise-q').addEventListener('input', (e) => {
    syncThunderNoiseControls();
});

// BPM Control
const bpmSlider = document.getElementById('bpm-slider');
const bpmVal = document.getElementById('bpm-val');
const beatUnit = document.getElementById('beat-unit');

function syncBpmFromSlider() {
    state.bpm = parseInt(bpmSlider.value, 10);
    bpmVal.innerText = state.bpm;
}

function syncBeatUnit() {
    const isDottedQuarterBeat = state.beatsPerBar === 6;
    beatUnit.innerText = isDottedQuarterBeat ? '♩.' : '♩';
    beatUnit.title = isDottedQuarterBeat ? 'One beat equals a dotted quarter note' : 'One beat equals a quarter note';
}

syncBpmFromSlider();
syncBeatUnit();
bpmSlider.addEventListener('input', syncBpmFromSlider);
bpmSlider.addEventListener('change', syncBpmFromSlider);

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
    state.drumPattern = {};
    state.drumPatternBarsRemaining = 0;
    clearDrumFill();
    state.isDrumFillEnabled = false;
    drumFillBtn.checked = false;
    state.drumFillBarsUntilAuto = AUTO_DRUM_FILL_INTERVAL_BARS;
    syncBeatUnit();
});

document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.isPlaying) {
        resetSchedulerTiming(0.08);
    }
});
