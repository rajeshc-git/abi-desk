// Lightweight zero-dependency celebration confetti & ribbons particle burst

const CONFETTI_COLORS = [
  '#f59e0b', // Gold
  '#2563eb', // Blue
  '#10b981', // Green
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#fbbf24', // Amber
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vRot: number;
  shape: 'rect' | 'circle' | 'ribbon';
  lengthRatio: number;
  alpha: number;
}

export function fireCelebrationConfetti(originX?: number, originY?: number): void {
  if (typeof window === 'undefined') return;

  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '999999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  const startX = originX !== undefined ? originX : width / 2;
  const startY = originY !== undefined ? originY : height * 0.45;

  const count = 140;
  const particles: Particle[] = [];

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.8;
    const speed = Math.random() * 12 + 6;
    const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    const shapes: Array<'rect' | 'circle' | 'ribbon'> = ['rect', 'circle', 'ribbon'];
    const shape = shapes[Math.floor(Math.random() * shapes.length)];

    particles.push({
      x: startX + (Math.random() - 0.5) * 60,
      y: startY + (Math.random() - 0.5) * 30,
      vx: Math.cos(angle) * speed * (0.8 + Math.random() * 0.6),
      vy: Math.sin(angle) * speed * 0.8 - (Math.random() * 6 + 4), // Burst upwards
      size: Math.random() * 7 + 5,
      color,
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.25,
      shape,
      lengthRatio: shape === 'ribbon' ? Math.random() * 2.5 + 2 : 1,
      alpha: 1,
    });
  }

  const gravity = 0.28;
  const drag = 0.982;
  const startTime = Date.now();
  const maxDuration = 3200; // 3.2 seconds

  const animate = () => {
    const elapsed = Date.now() - startTime;
    if (elapsed > maxDuration) {
      canvas.remove();
      return;
    }

    ctx.clearRect(0, 0, width, height);

    // Fade out towards the end
    const progress = elapsed / maxDuration;
    const globalAlpha = progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;

    for (const p of particles) {
      p.vx *= drag;
      p.vy = p.vy * drag + gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.vRot;

      ctx.save();
      ctx.globalAlpha = Math.max(0, globalAlpha * p.alpha);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;

      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'ribbon') {
        ctx.fillRect(-p.size / 2, (-p.size * p.lengthRatio) / 2, p.size, p.size * p.lengthRatio);
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      }

      ctx.restore();
    }

    requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);
}
