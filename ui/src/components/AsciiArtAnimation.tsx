import { useEffect, useRef } from "react";

const TARGET_FPS = 30;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;

const AMBER = { r: 212, g: 160, b: 84 };
const AMBER_DIM = { r: 140, g: 105, b: 55 };
const BG = { r: 30, g: 32, b: 48 };

interface Pulse {
  cx: number;
  cy: number;
  radius: number;
  maxRadius: number;
  speed: number;
  opacity: number;
}

export function AsciiArtAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    let isVisible = document.visibilityState !== "hidden";
    let loopActive = false;
    let lastRenderAt = 0;
    let time = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let pulses: Pulse[] = [];

    function resize() {
      dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawnPulse() {
      const cx = width * (0.3 + Math.random() * 0.4);
      const cy = height * (0.3 + Math.random() * 0.4);
      pulses.push({
        cx,
        cy,
        radius: 0,
        maxRadius: Math.max(width, height) * 0.7,
        speed: 0.6 + Math.random() * 0.4,
        opacity: 0.4 + Math.random() * 0.3,
      });
    }

    function drawGrid(t: number) {
      const spacing = 28;
      const dotSize = 1;

      for (let x = spacing / 2; x < width; x += spacing) {
        for (let y = spacing / 2; y < height; y += spacing) {
          const wave = Math.sin(x * 0.008 + t * 0.3) * Math.cos(y * 0.006 - t * 0.2);
          const alpha = 0.06 + wave * 0.04;
          ctx!.fillStyle = `rgba(${AMBER_DIM.r}, ${AMBER_DIM.g}, ${AMBER_DIM.b}, ${alpha})`;
          ctx!.fillRect(x - dotSize / 2, y - dotSize / 2, dotSize, dotSize);
        }
      }
    }

    function drawContours(t: number) {
      const cx = width * 0.5;
      const cy = height * 0.5;
      const maxR = Math.max(width, height) * 0.6;
      const ringCount = 12;

      for (let i = 0; i < ringCount; i++) {
        const baseR = (i / ringCount) * maxR;
        const wobble = Math.sin(t * 0.15 + i * 0.8) * 8;
        const r = baseR + wobble;
        if (r <= 0) continue;

        const progress = i / ringCount;
        const alpha = (1 - progress) * 0.12 + 0.02;

        ctx!.beginPath();
        for (let angle = 0; angle < Math.PI * 2; angle += 0.02) {
          const noise = Math.sin(angle * 3 + t * 0.1 + i) * 6 +
                       Math.sin(angle * 7 - t * 0.08) * 3;
          const cr = r + noise;
          const px = cx + Math.cos(angle) * cr;
          const py = cy + Math.sin(angle) * cr;
          if (angle === 0) ctx!.moveTo(px, py);
          else ctx!.lineTo(px, py);
        }
        ctx!.closePath();
        ctx!.strokeStyle = `rgba(${AMBER.r}, ${AMBER.g}, ${AMBER.b}, ${alpha})`;
        ctx!.lineWidth = 0.8;
        ctx!.stroke();
      }
    }

    function drawPulses(t: number) {
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i]!;
        p.radius += p.speed * 1.2;

        const life = p.radius / p.maxRadius;
        if (life >= 1) {
          pulses.splice(i, 1);
          continue;
        }

        const fadeIn = Math.min(1, life * 8);
        const fadeOut = 1 - life;
        const alpha = p.opacity * fadeIn * fadeOut * fadeOut;

        ctx!.beginPath();
        ctx!.arc(p.cx, p.cy, p.radius, 0, Math.PI * 2);
        ctx!.strokeStyle = `rgba(${AMBER.r}, ${AMBER.g}, ${AMBER.b}, ${alpha})`;
        ctx!.lineWidth = 1.5 * (1 - life * 0.5);
        ctx!.stroke();
      }
    }

    function drawCrosshair(t: number) {
      const cx = width * 0.5;
      const cy = height * 0.5;
      const armLen = 18;
      const alpha = 0.25 + Math.sin(t * 0.5) * 0.08;

      ctx!.strokeStyle = `rgba(${AMBER.r}, ${AMBER.g}, ${AMBER.b}, ${alpha})`;
      ctx!.lineWidth = 1;

      ctx!.beginPath();
      ctx!.moveTo(cx - armLen, cy);
      ctx!.lineTo(cx - 5, cy);
      ctx!.moveTo(cx + 5, cy);
      ctx!.lineTo(cx + armLen, cy);
      ctx!.moveTo(cx, cy - armLen);
      ctx!.lineTo(cx, cy - 5);
      ctx!.moveTo(cx, cy + 5);
      ctx!.lineTo(cx, cy + armLen);
      ctx!.stroke();

      const beaconAlpha = 0.5 + Math.sin(t * 1.2) * 0.3;
      ctx!.beginPath();
      ctx!.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx!.fillStyle = `rgba(${AMBER.r}, ${AMBER.g}, ${AMBER.b}, ${beaconAlpha})`;
      ctx!.fill();
    }

    function drawVignette() {
      const gradient = ctx!.createRadialGradient(
        width * 0.5, height * 0.5, Math.min(width, height) * 0.2,
        width * 0.5, height * 0.5, Math.max(width, height) * 0.7,
      );
      gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
      gradient.addColorStop(1, `rgba(${BG.r}, ${BG.g}, ${BG.b}, 0.6)`);
      ctx!.fillStyle = gradient;
      ctx!.fillRect(0, 0, width, height);
    }

    function render(timestamp: number) {
      if (!loopActive) return;
      frameRef.current = requestAnimationFrame(render);
      if (timestamp - lastRenderAt < FRAME_INTERVAL_MS) return;

      const delta = lastRenderAt === 0 ? 1 / TARGET_FPS : (timestamp - lastRenderAt) / 1000;
      lastRenderAt = timestamp;
      time += Math.min(delta, 0.1);

      if (Math.random() < 0.012) spawnPulse();

      ctx!.fillStyle = `rgb(${BG.r}, ${BG.g}, ${BG.b})`;
      ctx!.fillRect(0, 0, width, height);

      drawGrid(time);
      drawContours(time);
      drawPulses(time);
      drawCrosshair(time);
      drawVignette();
    }

    function drawStatic() {
      if (width <= 0 || height <= 0) return;
      ctx!.fillStyle = `rgb(${BG.r}, ${BG.g}, ${BG.b})`;
      ctx!.fillRect(0, 0, width, height);
      drawGrid(0);
      drawContours(0);
      drawCrosshair(0);
      drawVignette();
    }

    function syncLoop() {
      if (motionMedia.matches) {
        if (loopActive) {
          loopActive = false;
          if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
          frameRef.current = null;
        }
        drawStatic();
        return;
      }
      if (!isVisible) {
        if (loopActive) {
          loopActive = false;
          if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
          frameRef.current = null;
        }
        return;
      }
      if (!loopActive) {
        loopActive = true;
        lastRenderAt = 0;
        frameRef.current = requestAnimationFrame(render);
      }
    }

    const observer = new ResizeObserver(() => {
      resize();
      syncLoop();
    });
    observer.observe(canvas);

    const onVisibilityChange = () => {
      isVisible = document.visibilityState !== "hidden";
      syncLoop();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    motionMedia.addEventListener("change", syncLoop);

    resize();
    syncLoop();

    return () => {
      loopActive = false;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motionMedia.removeEventListener("change", syncLoop);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      aria-hidden="true"
    />
  );
}
