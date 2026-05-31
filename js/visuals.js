class RainVisualizer {
    constructor() {
        this.canvas = document.getElementById('rain-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.drops = [];
        this.isRunning = false;
        this.isSpawning = false;
        this.animationFrameId = null;
        this.intensity = 0;
        this.tone = 400;
        this.wind = 0;
        this.thunderEnabled = false;
        this.thunderIntensity = 0;
        this.thunderDistance = 0.9;
        this.lightning = null;
        this.nextLightningAt = 0;
        
        // 响应窗口大小变化
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    setIntensity(val) {
        // 音量映射到“雨量感”：影响密度、长度、透明度
        this.intensity = Math.max(0, Math.min(1, val));
    }

    setTone(val) {
        // Tone 保持和音频滤波器同量级，视觉上用于控制速度和亮度
        this.tone = Math.max(100, Math.min(3000, val));
    }

    setWind(val) {
        // Wind 不直接做物理模拟，只作为横向漂移强度
        this.wind = Math.max(0, Math.min(40, val));
    }

    setThunder(enable, intensity, distance) {
        this.thunderEnabled = enable;
        this.thunderIntensity = Math.max(0, Math.min(1, intensity));
        this.thunderDistance = Math.max(0, Math.min(1, distance));

        if (enable && this.thunderIntensity > 0 && !this.animationFrameId) {
            this.draw();
        }
    }

    createLightning(now) {
        const distance = this.thunderDistance;
        const intensity = this.thunderIntensity;
        const startX = this.canvas.width * (0.18 + Math.random() * 0.64);
        const startY = this.canvas.height * (0.04 + Math.random() * 0.18);
        const segmentCount = Math.floor(4 + intensity * 5 + Math.random() * 3);
        const maxLength = this.canvas.height * (0.16 + (1 - distance) * 0.24 + intensity * 0.12);
        const points = [{ x: startX, y: startY }];

        for (let i = 1; i <= segmentCount; i++) {
            const progress = i / segmentCount;
            const jitter = (1 - distance) * 52 + intensity * 26;
            points.push({
                x: startX + (Math.random() - 0.5) * jitter * i,
                y: startY + maxLength * progress
            });
        }

        this.lightning = {
            points,
            createdAt: now,
            duration: 140 + intensity * 130,
            alpha: 0.18 + intensity * 0.48 + (1 - distance) * 0.2,
            width: 1 + intensity * 2.2 + (1 - distance) * 1.2,
            flash: 0.04 + intensity * 0.18 + (1 - distance) * 0.16
        };
    }

    drawLightning(now) {
        if (!this.lightning) return;

        const age = now - this.lightning.createdAt;
        if (age > this.lightning.duration) {
            this.lightning = null;
            return;
        }

        const fade = 1 - age / this.lightning.duration;
        const flashAlpha = this.lightning.flash * fade;

        this.ctx.save();
        this.ctx.globalAlpha = flashAlpha;
        this.ctx.fillStyle = 'rgb(220, 238, 255)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.globalAlpha = this.lightning.alpha * fade;
        this.ctx.strokeStyle = 'rgb(232, 246, 255)';
        this.ctx.lineWidth = this.lightning.width;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.shadowBlur = 18 + this.lightning.width * 6;
        this.ctx.shadowColor = 'rgba(194, 226, 255, 0.9)';
        this.ctx.beginPath();
        this.lightning.points.forEach((point, index) => {
            if (index === 0) {
                this.ctx.moveTo(point.x, point.y);
            } else {
                this.ctx.lineTo(point.x, point.y);
            }
        });
        this.ctx.stroke();
        this.ctx.restore();
    }

    createDrop() {
        const spawnBase = 1 + this.intensity * 6;
        const count = Math.max(1, Math.floor(Math.random() * 2 + spawnBase));
        const toneRatio = (this.tone - 100) / 2900;
        const windDrift = this.wind * 0.16;
        const baseSpeed = 4 + this.intensity * 8 + toneRatio * 6;
        // 斜雨如果只从屏幕正上方生成，迎风侧会出现空白。
        // 这里按“整段下落期间可能横向漂移多远”来扩展出生区域。
        const horizontalTravel = Math.abs(windDrift) * (this.canvas.height / Math.max(baseSpeed, 1));
        const spawnPadding = Math.max(40, horizontalTravel + 40);
        const spawnMinX = windDrift >= 0 ? -spawnPadding : 0;
        const spawnMaxX = windDrift >= 0 ? this.canvas.width : this.canvas.width + spawnPadding;
        const spawnBandHeight = 30 + this.intensity * 30;

        for (let i = 0; i < count; i++) {
            const speed = 4 + this.intensity * 8 + toneRatio * 6 + Math.random() * 3;
            const length = 7 + this.intensity * 10 + toneRatio * 5 + Math.random() * 4;
            const opacity = 0.12 + this.intensity * 0.4 + toneRatio * 0.18 + Math.random() * 0.08;
            this.drops.push({
                x: spawnMinX + Math.random() * (spawnMaxX - spawnMinX),
                y: -Math.random() * spawnBandHeight,
                speed,
                drift: windDrift + (Math.random() - 0.5) * 0.6,
                length,
                opacity: Math.min(opacity, 0.85)
            });
        }
    }

    draw() {
        const now = performance.now();

        const hasThunder = this.thunderEnabled && this.thunderIntensity > 0;

        if (!this.isRunning && this.drops.length === 0 && !this.lightning && !hasThunder) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.animationFrameId = null;
            return;
        }

        // 稍微保留一点上一帧的痕迹，制造模糊感 (可选)
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const toneRatio = (this.tone - 100) / 2900;
        const blue = Math.round(210 + toneRatio * 45);
        const green = Math.round(185 + toneRatio * 25);
        this.ctx.strokeStyle = `rgb(169, ${green}, ${blue})`;
        this.ctx.lineWidth = 1 + this.intensity * 0.8 + toneRatio * 0.6;
        this.ctx.lineCap = 'round';

        // 更新并绘制每个雨滴
        for (let i = 0; i < this.drops.length; i++) {
            const d = this.drops[i];
            const slant = d.drift * (1.2 + d.length * 0.025);
            
            this.ctx.beginPath();
            this.ctx.moveTo(d.x, d.y);
            this.ctx.lineTo(d.x + slant, d.y + d.length);
            this.ctx.globalAlpha = d.opacity;
            this.ctx.stroke();
            
            // 移动
            d.y += d.speed;
            d.x += d.drift;

            // 如果超出屏幕底部，移除
            if (d.y > this.canvas.height || d.x < -80 || d.x > this.canvas.width + 80) {
                this.drops.splice(i, 1);
                i--;
            }
        }

        // 持续生成新雨滴
        if (this.isSpawning) {
            this.createDrop();
        }

        if (hasThunder) {
            if (now >= this.nextLightningAt) {
                this.createLightning(now);
                const distanceDelay = 1800 + this.thunderDistance * 3200;
                const intensityDelay = (1 - this.thunderIntensity) * 2200;
                this.nextLightningAt = now + distanceDelay + intensityDelay + Math.random() * 2600;
            }
            this.drawLightning(now);
        }

        this.ctx.globalAlpha = 1;
        this.animationFrameId = requestAnimationFrame(() => this.draw());
    }

    toggle(enable) {
        // 避免重复 toggle(true) 时叠出多条 requestAnimationFrame 循环
        if (enable === this.isRunning) return;

        this.isRunning = enable;
        this.isSpawning = enable;
        if (enable) {
            this.draw();
        } else {
            if (!this.animationFrameId) {
                this.draw();
            }
        }
    }
}

// 导出实例
const visuals = new RainVisualizer();
