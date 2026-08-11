"use client";

import { useEffect, useRef } from "react";

/**
 * Cursor-reactive SMS-themed canvas background.
 * - Flowing sine waves that ripple when the cursor moves.
 * - Floating message-node dots connected by thin lines.
 * - Slow global drift so it feels alive even when idle.
 * Kept professional: no emoji, no bright saturations, subtle indigo/slate palette.
 */
export default function AuthBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = Math.max(1, window.devicePixelRatio || 1);

    function resize() {
      if (!canvas) return;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    // Cursor tracking with smoothing (soft follow)
    const cursor = { x: width * 0.5, y: height * 0.5, tx: width * 0.5, ty: height * 0.5 };
    function onMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      cursor.tx = e.clientX - rect.left;
      cursor.ty = e.clientY - rect.top;
    }
    window.addEventListener("mousemove", onMove);

    // Nodes — floating "message" points
    const NODE_COUNT = 48;
    type Node = { x: number; y: number; vx: number; vy: number; r: number; phase: number };
    const nodes: Node[] = Array.from({ length: NODE_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: 1.2 + Math.random() * 1.6,
      phase: Math.random() * Math.PI * 2,
    }));

    // Ripples generated on cursor movement
    type Ripple = { x: number; y: number; r: number; life: number; max: number };
    const ripples: Ripple[] = [];
    let lastRippleAt = 0;
    function onMoveRipple(e: MouseEvent) {
      const now = performance.now();
      if (now - lastRippleAt < 60) return;
      lastRippleAt = now;
      const rect = canvas!.getBoundingClientRect();
      ripples.push({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        r: 0,
        life: 0,
        max: 180 + Math.random() * 60,
      });
      if (ripples.length > 12) ripples.shift();
    }
    window.addEventListener("mousemove", onMoveRipple);

    let t = 0;
    let animationFrame = 0;

    function draw() {
      if (!ctx) return;
      t += 1;

      // Smooth cursor follow
      cursor.x += (cursor.tx - cursor.x) * 0.08;
      cursor.y += (cursor.ty - cursor.y) * 0.08;

      // Background gradient — slate/indigo radial from cursor
      const bg = ctx.createRadialGradient(
        cursor.x, cursor.y, 60,
        width * 0.5, height * 0.5, Math.max(width, height) * 0.9
      );
      bg.addColorStop(0, "#1e1b4b");
      bg.addColorStop(0.4, "#0f172a");
      bg.addColorStop(1, "#020617");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Wave layers — 3 sine waves that warp toward the cursor
      const waves = [
        { amp: 30, freq: 0.005, speed: 0.015, y: height * 0.35, color: "rgba(99, 102, 241, 0.12)" },
        { amp: 22, freq: 0.007, speed: 0.02,  y: height * 0.55, color: "rgba(139, 92, 246, 0.10)" },
        { amp: 16, freq: 0.010, speed: 0.025, y: height * 0.72, color: "rgba(56, 189, 248, 0.08)" },
      ];
      for (const w of waves) {
        ctx.beginPath();
        ctx.moveTo(0, w.y);
        for (let x = 0; x <= width; x += 6) {
          // Distance-based cursor pull
          const dx = x - cursor.x;
          const dy = w.y - cursor.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const pull = Math.max(0, 1 - dist / 260) * 24;
          const y = w.y + Math.sin(x * w.freq + t * w.speed) * w.amp - pull;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fillStyle = w.color;
        ctx.fill();
      }

      // Ripples expanding outward from recent cursor positions
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.life += 1;
        r.r = (r.life / r.max) * 220;
        const alpha = 1 - r.life / r.max;
        if (alpha <= 0) { ripples.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(129, 140, 248, ${alpha * 0.4})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // Nodes — gentle drift, attracted slightly toward cursor
      for (const n of nodes) {
        // Drift
        n.x += n.vx;
        n.y += n.vy;
        n.phase += 0.015;

        // Soft cursor attraction
        const dx = cursor.x - n.x;
        const dy = cursor.y - n.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 240) {
          const pull = (1 - d / 240) * 0.12;
          n.vx += (dx / d) * pull * 0.05;
          n.vy += (dy / d) * pull * 0.05;
        }

        // Mild friction so attraction doesn't run away
        n.vx *= 0.985;
        n.vy *= 0.985;

        // Wrap edges
        if (n.x < -10) n.x = width + 10;
        if (n.x > width + 10) n.x = -10;
        if (n.y < -10) n.y = height + 10;
        if (n.y > height + 10) n.y = -10;
      }

      // Connection lines between nearby nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 130) {
            const alpha = (1 - d / 130) * 0.18;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(148, 163, 184, ${alpha})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }

      // Connection lines from nearby nodes to cursor
      for (const n of nodes) {
        const dx = n.x - cursor.x;
        const dy = n.y - cursor.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 180) {
          const alpha = (1 - d / 180) * 0.35;
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(cursor.x, cursor.y);
          ctx.strokeStyle = `rgba(129, 140, 248, ${alpha})`;
          ctx.lineWidth = 0.9;
          ctx.stroke();
        }
      }

      // Draw nodes (with subtle glow)
      for (const n of nodes) {
        const pulse = 0.8 + Math.sin(n.phase) * 0.4;
        const r = n.r * pulse;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(99, 102, 241, 0.04)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(199, 210, 254, 0.8)";
        ctx.fill();
      }

      // Cursor halo
      const halo = ctx.createRadialGradient(cursor.x, cursor.y, 0, cursor.x, cursor.y, 80);
      halo.addColorStop(0, "rgba(129, 140, 248, 0.28)");
      halo.addColorStop(1, "rgba(129, 140, 248, 0)");
      ctx.fillStyle = halo;
      ctx.fillRect(cursor.x - 80, cursor.y - 80, 160, 160);

      animationFrame = requestAnimationFrame(draw);
    }

    animationFrame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousemove", onMoveRipple);
    };
  }, []);

  return <canvas ref={canvasRef} className="auth-bg-canvas" aria-hidden="true" />;
}
