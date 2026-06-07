type Drop = {
  x: number;
  y: number;
  speed: number;
  drift: number;
  length: number;
  opacity: number;
};

type Lightning = {
  points: { x: number; y: number }[];
  createdAt: number;
  duration: number;
  alpha: number;
  width: number;
  flash: number;
};

export class RainVisualizer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private drops: Drop[] = [];
  private isRunning = false;
  private isSpawning = false;
  private animationFrameId: number | null = null;
  private intensity = 0;
  private tone = 400;
  private wind = 0;
  private thunderEnabled = false;
  private thunderIntensity = 0;
  private thunderDistance = 0.9;
  private lightning: Lightning | null = null;
  private nextLightningAt = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Rain canvas context is unavailable.');
    this.ctx = context;
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    if (this.animationFrameId !== null) cancelAnimationFrame(this.animationFrameId);
  }

  setIntensity(value: number): void {
    this.intensity = Math.max(0, Math.min(1, value));
  }

  setTone(value: number): void {
    this.tone = Math.max(100, Math.min(3000, value));
  }

  setWind(value: number): void {
    this.wind = Math.max(0, Math.min(40, value));
  }

  setThunder(enable: boolean, intensity: number, distance: number): void {
    this.thunderEnabled = enable;
    this.thunderIntensity = Math.max(0, Math.min(1, intensity));
    this.thunderDistance = Math.max(0, Math.min(1, distance));
    if (enable && this.thunderIntensity > 0 && !this.animationFrameId) this.draw();
  }

  toggle(enable: boolean): void {
    if (enable === this.isRunning) return;
    this.isRunning = enable;
    this.isSpawning = enable;
    if (enable) this.draw();
    else if (!this.animationFrameId) this.draw();
  }

  private resize = (): void => {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  };

  private createLightning(now: number): void {
    const distance = this.thunderDistance;
    const intensity = this.thunderIntensity;
    const startX = this.canvas.width * (0.18 + Math.random() * 0.64);
    const startY = this.canvas.height * (0.04 + Math.random() * 0.18);
    const segmentCount = Math.floor(4 + intensity * 5 + Math.random() * 3);
    const maxLength = this.canvas.height * (0.16 + (1 - distance) * 0.24 + intensity * 0.12);
    const points = [{ x: startX, y: startY }];

    for (let i = 1; i <= segmentCount; i++) {
      points.push({
        x: startX + (Math.random() - 0.5) * ((1 - distance) * 52 + intensity * 26) * i,
        y: startY + maxLength * (i / segmentCount)
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

  private drawLightning(now: number): void {
    if (!this.lightning) return;
    const age = now - this.lightning.createdAt;
    if (age > this.lightning.duration) {
      this.lightning = null;
      return;
    }

    const fade = 1 - age / this.lightning.duration;
    this.ctx.save();
    this.ctx.globalAlpha = this.lightning.flash * fade;
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
      if (index === 0) this.ctx.moveTo(point.x, point.y);
      else this.ctx.lineTo(point.x, point.y);
    });
    this.ctx.stroke();
    this.ctx.restore();
  }

  private createDrop(): void {
    const spawnBase = 1 + this.intensity * 6;
    const count = Math.max(1, Math.floor(Math.random() * 2 + spawnBase));
    const toneRatio = (this.tone - 100) / 2900;
    const windDrift = this.wind * 0.16;
    const baseSpeed = 4 + this.intensity * 8 + toneRatio * 6;
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

  private draw = (): void => {
    const now = performance.now();
    const hasThunder = this.thunderEnabled && this.thunderIntensity > 0;
    if (!this.isRunning && this.drops.length === 0 && !this.lightning && !hasThunder) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.animationFrameId = null;
      return;
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const toneRatio = (this.tone - 100) / 2900;
    this.ctx.strokeStyle = `rgb(169, ${Math.round(185 + toneRatio * 25)}, ${Math.round(210 + toneRatio * 45)})`;
    this.ctx.lineWidth = 1 + this.intensity * 0.8 + toneRatio * 0.6;
    this.ctx.lineCap = 'round';

    for (let i = 0; i < this.drops.length; i++) {
      const drop = this.drops[i];
      this.ctx.beginPath();
      this.ctx.moveTo(drop.x, drop.y);
      this.ctx.lineTo(drop.x + drop.drift * (1.2 + drop.length * 0.025), drop.y + drop.length);
      this.ctx.globalAlpha = drop.opacity;
      this.ctx.stroke();
      drop.y += drop.speed;
      drop.x += drop.drift;
      if (drop.y > this.canvas.height || drop.x < -80 || drop.x > this.canvas.width + 80) {
        this.drops.splice(i, 1);
        i--;
      }
    }

    if (this.isSpawning) this.createDrop();
    if (hasThunder) {
      if (now >= this.nextLightningAt) {
        this.createLightning(now);
        this.nextLightningAt = now + 1800 + this.thunderDistance * 3200 + (1 - this.thunderIntensity) * 2200 + Math.random() * 2600;
      }
      this.drawLightning(now);
    }
    this.ctx.globalAlpha = 1;
    this.animationFrameId = requestAnimationFrame(this.draw);
  };
}
