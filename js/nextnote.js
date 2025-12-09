const NextNote = {
    /**
     * 计算音符权重
     * @param {string} noteName - 音符名称 (e.g. "C4")
     * @param {number} noteIndex - 音符在音阶中的索引
     * @param {object} chord - 当前和弦对象
     * @param {number} lastPlayedIndex - 上一个演奏音符的索引
     * @returns {number} 权重值
     */
    getNoteWeight: function(noteName, noteIndex, chord, lastPlayedIndex) {
        let weight = 10;
        const pitchClass = noteName.slice(0, -1); // 去掉八度，只留音名 (e.g. "C")
        
        // 1. 和声匹配 (Harmony)
        // 如果音符在当前和弦内，大幅增加权重
        if (chord && chord.tones.includes(pitchClass)) {
            weight += 50;
        }

        // 2. 物理距离 (Stepwise Motion)
        // 旋律倾向于级进（走小步），而不是大跳
        const distance = Math.abs(noteIndex - lastPlayedIndex);
        if (distance === 0) weight += 10; // 同音重复
        if (distance === 1) weight += 40; // 二度级进 (最自然)
        if (distance === 2) weight += 20; // 三度跳进
        if (distance > 4) weight -= 20;   // 大跳惩罚
        if (distance > 7) weight -= 50;   // 八度以上大跳极少见

        // 3. 避免极端音区
        // 假设音阶长度约 15，中间部分权重高
        if (noteIndex < 3 || noteIndex > 12) weight -= 10;

        return Math.max(0, weight);
    },

    /**
     * 选择下一个音符
     * @param {object} preset - 当前预设 (包含 scale)
     * @param {object} currentChord - 当前和弦
     * @param {number} lastPlayedIndex - 上一个音符索引
     * @returns {object} { note: "C4", index: 5 }
     */
    pick_rand: function(preset, currentChord, lastPlayedIndex) {
        const scale = preset.scale;
        let weightSum = 0;
        
        // 计算所有候选音符的权重
        const candidates = scale.map((note, index) => {
            const weight = this.getNoteWeight(note, index, currentChord, lastPlayedIndex);
            weightSum += weight;
            return { note, index, weight };
        });

        // 加权随机选择 (Weighted Random Selection)
        let r = Math.random() * weightSum;
        for (let item of candidates) {
            r -= item.weight;
            if (r <= 0) {
                return item;
            }
        }
        
        // Fallback (防止浮点误差导致没选中)
        return candidates[Math.floor(candidates.length / 2)];
    }, 

    /**
     * 回归稳定音策略 (Go Home)
     * 倾向于解决到主音、属音或和弦根音
     */
    pick_gohome: function(preset, currentChord, lastPlayedIndex) {
        console.log("Picking next note with Go Home strategy...");
        
        const scale = preset.scale;
        
        // 1. 30% 概率依然保持随机性，避免太死板
        if (Math.random() < 0.3) {
            return this.pick_rand(preset, currentChord, lastPlayedIndex);
        }

        // 2. 寻找稳定音 (Stable Notes)
        // 稳定音定义：
        // - 调式主音 (Scale Degree 1) -> 对应 scale[0], scale[7], scale[14]...
        // - 调式属音 (Scale Degree 5) -> 对应 scale[4], scale[11]...
        // - 当前和弦根音 (Chord Root)
        
        const stableIndices = [];
        
        // A. 添加主音和属音 (假设 scale 是按自然音阶排列的)
        // C Major: C(0), D(1), E(2), F(3), G(4)...
        for (let i = 0; i < scale.length; i++) {
            const degree = i % 7; // 0=主音, 4=属音
            if (degree === 0 || degree === 4) {
                stableIndices.push(i);
            }
        }

        // B. 添加当前和弦根音
        if (currentChord) {
            const rootPitchClass = currentChord.root.slice(0, -1); // e.g. "C"
            scale.forEach((note, index) => {
                if (note.startsWith(rootPitchClass)) {
                    if (!stableIndices.includes(index)) stableIndices.push(index);
                }
            });
        }

        // 3. 寻找距离上一个音最近的稳定音
        let bestCandidate = null;
        let minDistance = Infinity;

        // 打乱顺序，如果有两个距离一样的，随机选一个
        stableIndices.sort(() => Math.random() - 0.5);

        for (let index of stableIndices) {
            const dist = Math.abs(index - lastPlayedIndex);
            
            // 优先找最近的，但不要是同一个音 (除非没得选)
            if (dist < minDistance) {
                // 如果距离是0 (同音)，稍微降低优先级，除非它是唯一的选择
                if (dist === 0 && minDistance !== Infinity) continue;
                
                minDistance = dist;
                bestCandidate = index;
            }
        }

        // 如果找不到 (极少情况)，回退到随机
        if (bestCandidate === null) return this.pick_rand(preset, currentChord, lastPlayedIndex);

        return {
            note: scale[bestCandidate],
            index: bestCandidate,
            weight: 100 // 虚拟权重
        };
    }
};