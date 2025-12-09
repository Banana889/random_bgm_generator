class RainVisualizer {
    constructor() {
        this.canvas = document.getElementById('rain-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.drops = [];
        this.isRunning = false;
        
        // 响应窗口大小变化
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createDrop() {
        // 每次生成 2-5 个雨滴
        const count = Math.random() * 3 + 2;
        for(let i=0; i<count; i++) {
            this.drops.push({
                x: Math.random() * this.canvas.width,
                y: -20, // 从屏幕上方一点点开始
                speed: Math.random() * 5 + 5, // 下落速度
                length: Math.random() * 10 + 15, // 雨滴长度
                opacity: Math.random() * 0.4 + 0.1 // 透明度
            });
        }
    }

    draw() {
        if (!this.isRunning) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            return;
        }

        // 稍微保留一点上一帧的痕迹，制造模糊感 (可选)
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.strokeStyle = '#A9D0F5'; // 雨滴颜色 (淡蓝)
        this.ctx.lineWidth = 1.5;
        this.ctx.lineCap = 'round';

        // 更新并绘制每个雨滴
        for (let i = 0; i < this.drops.length; i++) {
            const d = this.drops[i];
            
            this.ctx.beginPath();
            this.ctx.moveTo(d.x, d.y);
            this.ctx.lineTo(d.x, d.y + d.length);
            this.ctx.globalAlpha = d.opacity;
            this.ctx.stroke();
            
            // 移动
            d.y += d.speed;

            // 如果超出屏幕底部，移除
            if (d.y > this.canvas.height) {
                this.drops.splice(i, 1);
                i--;
            }
        }

        // 持续生成新雨滴
        this.createDrop();

        requestAnimationFrame(() => this.draw());
    }

    toggle(enable) {
        this.isRunning = enable;
        if (enable) {
            this.draw();
        } else {
            // todo： 关掉后不要清空屏幕。让剩下的雨滴落下
            this.drops = []; // 清空雨滴
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
}

// 导出实例
const visuals = new RainVisualizer();