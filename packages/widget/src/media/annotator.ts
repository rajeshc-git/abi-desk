export type AnnotationTool = 'PEN' | 'RECTANGLE' | 'ARROW' | 'TEXT' | 'HIGHLIGHT' | 'BLUR';

export interface AnnotationShape {
  tool: AnnotationTool;
  color: string;
  strokeWidth: number;
  points?: { x: number; y: number }[];
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  text?: string;
}

export class ImageAnnotator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private bgImage: HTMLImageElement | null = null;

  private shapes: AnnotationShape[] = [];
  private redoStack: AnnotationShape[] = [];

  private currentTool: AnnotationTool = 'PEN';
  private currentColor: string = '#EF4444';
  private currentStrokeWidth: number = 3;

  private isDrawing = false;
  private currentShape: AnnotationShape | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get 2D context from canvas');
    this.ctx = ctx;

    this.bindEvents();
  }

  async loadImage(imageBlob: Blob): Promise<void> {
    const url = URL.createObjectURL(imageBlob);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.bgImage = img;
        this.canvas.width = img.width;
        this.canvas.height = img.height;
        this.redraw();
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image into annotator'));
      };
      img.src = url;
    });
  }

  setTool(tool: AnnotationTool) {
    this.currentTool = tool;
  }

  setColor(color: string) {
    this.currentColor = color;
  }

  setStrokeWidth(width: number) {
    this.currentStrokeWidth = width;
  }

  undo() {
    if (this.shapes.length === 0) return;
    const popped = this.shapes.pop();
    if (popped) this.redoStack.push(popped);
    this.redraw();
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const shape = this.redoStack.pop();
    if (shape) this.shapes.push(shape);
    this.redraw();
  }

  clear() {
    this.shapes = [];
    this.redoStack = [];
    this.redraw();
  }

  private bindEvents() {
    this.canvas.addEventListener('mousedown', (e) => this.onStart(e.offsetX, e.offsetY));
    this.canvas.addEventListener('mousemove', (e) => this.onMove(e.offsetX, e.offsetY));
    this.canvas.addEventListener('mouseup', () => this.onEnd());
    this.canvas.addEventListener('mouseleave', () => this.onEnd());

    // Touch events for mobile/tablet
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const touch = e.touches[0];
      if (touch) this.onStart(touch.clientX - rect.left, touch.clientY - rect.top);
    });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const touch = e.touches[0];
      if (touch) this.onMove(touch.clientX - rect.left, touch.clientY - rect.top);
    });

    this.canvas.addEventListener('touchend', () => this.onEnd());
  }

  private onStart(x: number, y: number) {
    this.isDrawing = true;
    this.redoStack = [];

    if (this.currentTool === 'PEN' || this.currentTool === 'HIGHLIGHT') {
      this.currentShape = {
        tool: this.currentTool,
        color: this.currentTool === 'HIGHLIGHT' ? 'rgba(251, 191, 36, 0.45)' : this.currentColor,
        strokeWidth: this.currentTool === 'HIGHLIGHT' ? 16 : this.currentStrokeWidth,
        points: [{ x, y }],
      };
    } else if (this.currentTool === 'TEXT') {
      const text = prompt('Enter annotation label:');
      if (text) {
        this.shapes.push({
          tool: 'TEXT',
          color: this.currentColor,
          strokeWidth: this.currentStrokeWidth,
          startX: x,
          startY: y,
          text,
        });
        this.redraw();
      }
      this.isDrawing = false;
      return;
    } else {
      this.currentShape = {
        tool: this.currentTool,
        color: this.currentColor,
        strokeWidth: this.currentStrokeWidth,
        startX: x,
        startY: y,
        endX: x,
        endY: y,
      };
    }
  }

  private onMove(x: number, y: number) {
    if (!this.isDrawing || !this.currentShape) return;

    if (this.currentShape.points) {
      this.currentShape.points.push({ x, y });
    } else {
      this.currentShape.endX = x;
      this.currentShape.endY = y;
    }

    this.redraw();
    this.renderShape(this.currentShape);
  }

  private onEnd() {
    if (!this.isDrawing || !this.currentShape) return;
    this.isDrawing = false;
    this.shapes.push(this.currentShape);
    this.currentShape = null;
    this.redraw();
  }

  private redraw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.bgImage) {
      this.ctx.drawImage(this.bgImage, 0, 0, this.canvas.width, this.canvas.height);
    }

    for (const shape of this.shapes) {
      this.renderShape(shape);
    }
  }

  private renderShape(shape: AnnotationShape) {
    this.ctx.save();
    this.ctx.strokeStyle = shape.color;
    this.ctx.fillStyle = shape.color;
    this.ctx.lineWidth = shape.strokeWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    switch (shape.tool) {
      case 'PEN':
      case 'HIGHLIGHT': {
        if (!shape.points || shape.points.length < 2) break;
        this.ctx.beginPath();
        this.ctx.moveTo(shape.points[0]!.x, shape.points[0]!.y);
        for (let i = 1; i < shape.points.length; i++) {
          this.ctx.lineTo(shape.points[i]!.x, shape.points[i]!.y);
        }
        this.ctx.stroke();
        break;
      }

      case 'RECTANGLE': {
        if (
          shape.startX === undefined ||
          shape.startY === undefined ||
          shape.endX === undefined ||
          shape.endY === undefined
        )
          break;
        const width = shape.endX - shape.startX;
        const height = shape.endY - shape.startY;
        this.ctx.strokeRect(shape.startX, shape.startY, width, height);
        break;
      }

      case 'BLUR': {
        // Redaction / blackout box
        if (
          shape.startX === undefined ||
          shape.startY === undefined ||
          shape.endX === undefined ||
          shape.endY === undefined
        )
          break;
        const width = shape.endX - shape.startX;
        const height = shape.endY - shape.startY;
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(shape.startX, shape.startY, width, height);
        break;
      }

      case 'ARROW': {
        if (
          shape.startX === undefined ||
          shape.startY === undefined ||
          shape.endX === undefined ||
          shape.endY === undefined
        )
          break;
        this.drawArrow(shape.startX, shape.startY, shape.endX, shape.endY);
        break;
      }

      case 'TEXT': {
        if (shape.startX === undefined || shape.startY === undefined || !shape.text) break;
        this.ctx.font =
          'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        this.ctx.fillStyle = '#000000';
        this.ctx.fillText(shape.text, shape.startX + 1, shape.startY + 1);
        this.ctx.fillStyle = shape.color;
        this.ctx.fillText(shape.text, shape.startX, shape.startY);
        break;
      }
    }

    this.ctx.restore();
  }

  private drawArrow(fromX: number, fromY: number, toX: number, toY: number) {
    const headlen = 14;
    const angle = Math.atan2(toY - fromY, toX - fromX);

    this.ctx.beginPath();
    this.ctx.moveTo(fromX, fromY);
    this.ctx.lineTo(toX, toY);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(toX, toY);
    this.ctx.lineTo(
      toX - headlen * Math.cos(angle - Math.PI / 6),
      toY - headlen * Math.sin(angle - Math.PI / 6),
    );
    this.ctx.lineTo(
      toX - headlen * Math.cos(angle + Math.PI / 6),
      toY - headlen * Math.sin(angle + Math.PI / 6),
    );
    this.ctx.closePath();
    this.ctx.fill();
  }

  async exportBlob(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      this.canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to export annotated image'));
      }, 'image/png');
    });
  }
}
