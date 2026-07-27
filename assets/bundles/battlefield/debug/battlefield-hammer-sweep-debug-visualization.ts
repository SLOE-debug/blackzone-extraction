import { type BattlefieldHammerSweepDebugSource } from '../equipment/combat/battlefield-hammer-sweep-debug-state';

const CANVAS_PADDING = 22;
const MINIMUM_HALF_EXTENT = 2.6;
const HIT_MARKER_RADIUS = 4;

/** 在浏览器 Debug 面板中俯视绘制实际锤头轨迹、胶囊半径和命中目标。 */
export class BattlefieldHammerSweepDebugVisualization {
  private readonly context: CanvasRenderingContext2D;
  private animationFrameId = 0;
  private disposed = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly source: BattlefieldHammerSweepDebugSource,
  ) {
    const context = canvas.getContext('2d');
    if (context === null) {
      throw new Error('浏览器不支持战场锤头扫掠 Debug 画布。');
    }
    this.context = context;
    this.draw();
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.animationFrameId !== 0) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
  }

  private readonly draw = (): void => {
    if (this.disposed) {
      return;
    }
    const { canvas, context, source } = this;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#8ea7ae';
    context.font = '11px Arial, Microsoft YaHei, sans-serif';
    if (!source.enabled) {
      context.fillText('启用“锤头扫掠诊断”后显示', 12, 22);
      this.scheduleNextFrame();
      return;
    }
    if (!source.active) {
      context.fillText('等待普通横扫、上挑或旋风轨迹…', 12, 22);
      this.scheduleNextFrame();
      return;
    }

    const centerX = (source.startX + source.endX) * 0.5;
    const centerZ = (source.startZ + source.endZ) * 0.5;
    const segmentHalfLength = Math.hypot(
      source.endX - source.startX,
      source.endZ - source.startZ,
    ) * 0.5;
    const halfExtent = Math.max(
      MINIMUM_HALF_EXTENT,
      segmentHalfLength + source.radius + 0.5,
    );
    const scale = Math.min(
      (canvas.width - CANVAS_PADDING * 2) / (halfExtent * 2),
      (canvas.height - CANVAS_PADDING * 2) / (halfExtent * 2),
    );
    const startX = canvas.width * 0.5 + (source.startX - centerX) * scale;
    const startY = canvas.height * 0.5 - (source.startZ - centerZ) * scale;
    const endX = canvas.width * 0.5 + (source.endX - centerX) * scale;
    const endY = canvas.height * 0.5 - (source.endZ - centerZ) * scale;

    this.drawAxes();
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
    context.lineWidth = source.radius * scale * 2 + 2;
    context.strokeStyle = 'rgba(74, 229, 218, 0.92)';
    context.stroke();
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
    context.lineWidth = source.radius * scale * 2;
    context.strokeStyle = 'rgba(39, 127, 121, 0.32)';
    context.stroke();
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
    context.lineWidth = 2;
    context.strokeStyle = '#ffe082';
    context.stroke();

    context.fillStyle = '#ff625d';
    for (let index = 0; index < source.hitCount; index++) {
      const hitX = canvas.width * 0.5 + (source.getHitX(index) - centerX) * scale;
      const hitY = canvas.height * 0.5 - (source.getHitZ(index) - centerZ) * scale;
      context.beginPath();
      context.arc(hitX, hitY, HIT_MARKER_RADIUS, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = '#d9f7f4';
    context.fillText(
      `半径 ${source.radius.toFixed(2)}m · 命中 ${source.hitCount}`,
      10,
      canvas.height - 9,
    );
    this.scheduleNextFrame();
  };

  private drawAxes(): void {
    const { canvas, context } = this;
    context.lineCap = 'butt';
    context.lineWidth = 1;
    context.strokeStyle = 'rgba(255, 255, 255, 0.09)';
    context.beginPath();
    context.moveTo(CANVAS_PADDING, canvas.height * 0.5);
    context.lineTo(canvas.width - CANVAS_PADDING, canvas.height * 0.5);
    context.moveTo(canvas.width * 0.5, CANVAS_PADDING);
    context.lineTo(canvas.width * 0.5, canvas.height - CANVAS_PADDING);
    context.stroke();
  }

  private scheduleNextFrame(): void {
    this.animationFrameId = requestAnimationFrame(this.draw);
  }
}
