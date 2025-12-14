/* 将此代码作为一个新的模块加入你的项目 
   使用方法: playAmbience('heavy_rain') 或 playAmbience('wind')
*/

const AudioContext = window.AudioContext || window.webkitAudioContext;
// 假设 ctx 已经在主程序里创建了
// let ctx = new AudioContext(); 

let ambienceNodes = []; // 存储当前播放的节点以便停止

class NoiseGenerator {
    constructor() {
        // 使用 Tone.js 的原生 AudioContext，确保时间同步和输出一致
        this.ctx = Tone.context.rawContext;
        this.nodes = []; // 存储当前播放的所有节点
        
        // 预生成 Buffer (单例模式)
        this.pinkBuffer = this.createNoiseBuffer('pink');
        this.brownBuffer = this.createNoiseBuffer('brown');
        
        // 当前参数状态
        this.params = {
            vol: 0,
            freq: 400,
            Q: 0
        };
        
        // 初始化音频图 (但不播放)
        this.initAudioGraph();
    }

    createNoiseBuffer(type) {
        const bufferSize = this.ctx.sampleRate * 2; // 2秒循环
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            if (type === 'pink') {
                // 简单的粉噪近似
                data[i] = (lastOut + (0.02 * white)) / 1.02;
                lastOut = data[i];
                data[i] *= 3.5; // 补偿音量
            } else if (type === 'brown') {
                // 棕噪算法
                lastOut = (lastOut + (0.02 * white)) / 1.02;
                data[i] = lastOut * 3.5; 
            }
        }
        return buffer;
    }

    initAudioGraph() {
        // 1. 源节点 (Source) - 使用 Brown Noise 作为基础，因为它最适合做雨声/风声
        this.source = this.ctx.createBufferSource();
        this.source.buffer = this.brownBuffer;
        this.source.loop = true;

        // 2. 滤波器 (Filter) - 核心塑形工具
        this.filter = this.ctx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 400; // 默认闷一点
        this.filter.Q.value = 0;

        // 3. 音量 (Gain)
        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.value = 0; // 初始静音

        // 4. 连接
        // Source -> Filter -> Gain -> Tone.Destination
        this.source.connect(this.filter);
        this.filter.connect(this.gainNode);
        
        // 连接到 Tone.js 的主输出
        Tone.connect(this.gainNode, Tone.Destination);
        
        this.source.start();
    }

    // --- 公共控制接口 ---

    setVolume(val) {
        // 平滑过渡
        this.gainNode.gain.setTargetAtTime(val, this.ctx.currentTime, 0.1);
    }

    setFilterFreq(val) {
        // 频率控制：低频像雨，高频像喷气机
        this.filter.frequency.setTargetAtTime(val, this.ctx.currentTime, 0.1);
    }

    setFilterQ(val) {
        // 共振控制：高 Q 值会有"哨音"，适合模拟风声
        this.filter.Q.setTargetAtTime(val, this.ctx.currentTime, 0.1);
    }
    
    setType(type) {
        // 切换滤波器类型：lowpass (雨) vs bandpass (风)
        this.filter.type = type;
    }
}

// --- 配方参数配置 ---
const PRESETS_NOISE = {
    'light_rain': {
        type: 'brown',
        filterType: 'lowpass',
        freq: 400,    // 很闷，像窗外的雨
        Q: 0,
        vol: 0.3,
        pan: 0,
        modulate: false
    },
    'heavy_rain': {
        type: 'brown',
        filterType: 'lowpass',
        freq: 2500,   // 亮一点，像直接打在脸上
        Q: 0,
        vol: 0.8,
        pan: 0,
        modulate: false
    },
    'howling_wind': {
        type: 'pink',
        filterType: 'bandpass', // 带通是风的关键
        freq: 600,
        Q: 5,         // 高共振产生哨音
        vol: 0.4,
        pan: 0,
        modulate: true, // 开启 LFO 调制
        modRate: 0.2,   // 调制速度 (Hz)
        modDepth: 300   // 频率扫动范围 (Hz)
    }
};

function playAmbience(presetName) {
    // 1. 停止旧的
    ambienceNodes.forEach(n => {
        try { n.source.stop(); } catch(e){}
    });
    ambienceNodes = [];

    const preset = PRESETS_NOISE[presetName];
    if (!preset) return;

    const t = ctx.currentTime;

    // 2. 创建节点链
    const source = ctx.createBufferSource();
    source.buffer = preset.type === 'pink' ? pinkBuffer : brownBuffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = preset.filterType;
    filter.frequency.value = preset.freq;
    filter.Q.value = preset.Q;

    const gain = ctx.createGain();
    gain.gain.value = preset.vol;
    
    // 3. 动态调制 (LFO) - 让风“吹”起来
    if (preset.modulate) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = preset.modRate; // 比如 0.2Hz (5秒一个周期)
        
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = preset.modDepth; // 扫动深度
        
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency); // LFO 控制 Filter Frequency
        lfo.start(t);
        ambienceNodes.push({source: lfo}); // 存起来以便停止
    }

    // 4. 连接
    // Source -> Filter -> Gain -> Master
    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain); // 假设连接到全局主音量

    source.start(t);
    ambienceNodes.push({source: source});
    
    console.log(`Ambience playing: ${presetName}`);
}