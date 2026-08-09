import { useEffect, useRef } from 'react';
import './ParticleText.css';

const hexToRgb = hex => {
  if (!hex) return { r: 107, g: 70, b: 193 };
  const clean = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return { r: 107, g: 70, b: 193 };
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16)
  };
};

const mixRgb = (c1, c2, factor) => {
  const f = Math.min(Math.max(factor, 0), 1);
  return {
    r: Math.round(c1.r + (c2.r - c1.r) * f),
    g: Math.round(c1.g + (c2.g - c1.g) * f),
    b: Math.round(c1.b + (c2.b - c1.b) * f)
  };
};

const rgbToCss = (rgb, alpha = 1) => 
  alpha < 1 ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})` : `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

const resolveFontSize = (value, container, fontWeight, fontFamily) => {
  if (typeof value === 'number') return value;

  const probe = document.createElement('span');
  probe.textContent = 'M';
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  probe.style.fontSize = value;
  probe.style.fontWeight = String(fontWeight);
  probe.style.fontFamily = fontFamily;
  container.appendChild(probe);
  const size = parseFloat(window.getComputedStyle(probe).fontSize) || 96;
  probe.remove();
  return size;
};

const waitForFonts = async font => {
  if (!('fonts' in document)) return;

  try {
    await document.fonts.load(font);
  } catch {}

  await document.fonts.ready;
};

const ParticleText = ({
  text = 'MockMate AI',
  particleSize = 2.2,
  density = 3.8,
  // Landing Page Brand Colors Palette Defaults:
  // Primary Deep Purple: #6B46C1
  // Secondary Light Purple: #9F7AEA
  // Electric Indigo Accent: #6366F1
  // Ripple Highlight: #E9D5FF
  color = '#6B46C1',
  highlightColor = '#9F7AEA',
  secondaryColor = '#6366F1',
  rippleColor = '#E9D5FF',
  scatter = 160,
  gatherDuration = 1500,
  stagger = 400,
  pointerRepel = 45,
  repelRadius = 130,
  idleDrift = 0.8,
  waterFlow = true,
  trigger = 'hover',
  fontSize = 'clamp(2.5rem, 8vw, 6rem)',
  fontWeight = 800,
  fontFamily = 'inherit',
  glow = true,
  className = '',
  style
}) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let particles = [];
    let animationFrame = null;
    let resizeFrame = null;
    let buildId = 0;
    let gathering = false;
    let gatherStart = 0;
    // Without this, the loop below runs the full particle physics (up to
    // ~5,200 particles, each doing several sin/cos/hypot calls) forever at
    // 60fps for as long as this component is mounted — including while the
    // user has scrolled it out of view. requestAnimationFrame only pauses
    // automatically when the whole TAB is backgrounded, not when the canvas
    // itself is merely off-screen, so that case needs an explicit gate.
    let visible = true;
    let reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const pointer = {
      active: false,
      x: 0,
      y: 0,
      smoothX: 0,
      smoothY: 0,
      velX: 0,
      velY: 0
    };

    const brandRgb = {
      primary: hexToRgb(color),
      secondary: hexToRgb(highlightColor),
      indigo: hexToRgb(secondaryColor),
      ripple: hexToRgb(rippleColor)
    };

    const startGather = (fromScatter = true) => {
      if (!particles.length) return;

      const now = performance.now();
      const spread = reducedMotion ? 0 : scatter;

      particles.forEach(particle => {
        if (fromScatter) {
          const angle = particle.seed * Math.PI * 2;
          const distance = spread * (0.35 + particle.depth * 0.75);
          particle.x = particle.targetX + Math.cos(angle) * distance + (particle.depth - 0.5) * spread * 0.55;
          particle.y = particle.targetY + Math.sin(angle) * distance + (particle.seed - 0.5) * spread * 0.55;
        }

        particle.startX = particle.x;
        particle.startY = particle.y;
        particle.vx = 0;
        particle.vy = 0;
        particle.delay = reducedMotion ? 0 : particle.seed * stagger;
      });

      gatherStart = now;
      gathering = true;
    };

    const drawParticle = (particle, dynamicColor, alpha) => {
      const size = particle.size;
      ctx.fillStyle = dynamicColor;

      if (size <= 2.1) {
        ctx.fillRect(particle.x - size / 2, particle.y - size / 2, size, size);
        return;
      }

      ctx.beginPath();
      ctx.arc(particle.x, particle.y, size / 2, 0, Math.PI * 2);
      ctx.fill();
    };

    const render = now => {
      ctx.clearRect(0, 0, width, height);

      // Smooth pointer velocity calculation for water flow currents
      const targetSmoothX = pointer.smoothX + (pointer.x - pointer.smoothX) * 0.15;
      const targetSmoothY = pointer.smoothY + (pointer.y - pointer.smoothY) * 0.15;
      pointer.velX = (targetSmoothX - pointer.smoothX) * 0.8 + pointer.velX * 0.2;
      pointer.velY = (targetSmoothY - pointer.smoothY) * 0.8 + pointer.velY * 0.2;
      pointer.smoothX = targetSmoothX;
      pointer.smoothY = targetSmoothY;

      let complete = true;
      const timeSec = now * 0.001;

      if (glow && !reducedMotion) {
        ctx.shadowBlur = particleSize * 3.5;
        ctx.shadowColor = highlightColor;
      } else {
        ctx.shadowBlur = 0;
      }

      particles.forEach(particle => {
        let baseX = particle.targetX;
        let baseY = particle.targetY;
        let progress = 1;

        if (gathering) {
          const local = (now - gatherStart - particle.delay) / Math.max(1, reducedMotion ? 1 : gatherDuration);
          progress = clamp(local, 0, 1);
          const eased = easeOutCubic(progress);
          baseX = particle.startX + (particle.targetX - particle.startX) * eased;
          baseY = particle.startY + (particle.targetY - particle.startY) * eased;
          particle.x = baseX;
          particle.y = baseY;
          if (progress < 1) complete = false;
        } else {
          // ── WATER FLOW & RIPPLE PHYSICS ──
          if (!reducedMotion && idleDrift > 0) {
            // Ambient organic wave flow across particle grid (water surface undulation)
            const waveX = Math.sin(timeSec * 2.2 + particle.targetX * 0.012 + particle.seed * 6.28) * idleDrift * 2.2 * particle.depth;
            const waveY = Math.cos(timeSec * 1.8 + particle.targetY * 0.014 + particle.depth * 6.28) * idleDrift * 2.2 * particle.depth;
            baseX += waveX;
            baseY += waveY;
          }

          if (pointer.active && !reducedMotion && pointerRepel > 0 && repelRadius > 0) {
            const dx = baseX - pointer.smoothX;
            const dy = baseY - pointer.smoothY;
            const distance = Math.hypot(dx, dy);

            if (distance > 0 && distance < repelRadius) {
              const normDist = distance / repelRadius;
              
              // Water drop concentric ripple wave effect
              const rippleWave = Math.sin(normDist * Math.PI * 4 - timeSec * 10) * Math.pow(1 - normDist, 1.4) * 14;

              // Fluid repulsion + transverse flow along pointer velocity direction
              const repForce = Math.pow(1 - normDist, 1.8) * pointerRepel;
              const flowX = (dx / distance) * repForce + pointer.velX * 0.4 * Math.pow(1 - normDist, 1.2);
              const flowY = (dy / distance) * repForce + pointer.velY * 0.4 * Math.pow(1 - normDist, 1.2) + rippleWave;

              // Viscous liquid impulse acceleration
              particle.vx += flowX * 0.14;
              particle.vy += flowY * 0.14;
            }
          }

          // Spring pull towards target with liquid viscosity damping (water viscosity = 0.85)
          const springX = (baseX - particle.x) * 0.09;
          const springY = (baseY - particle.y) * 0.09;
          particle.vx = (particle.vx + springX) * 0.85;
          particle.vy = (particle.vy + springY) * 0.85;

          particle.x += particle.vx;
          particle.y += particle.vy;
        }

        // ── DYNAMIC BRAND COLOR SHIFTING ──
        // Blends from Primary Deep Purple (#6B46C1) -> Secondary Purple (#9F7AEA) -> Indigo (#6366F1) -> Ripple Lavender (#E9D5FF)
        const currentSpeed = Math.hypot(particle.vx, particle.vy);
        const currentDisplacement = Math.hypot(particle.x - particle.targetX, particle.y - particle.targetY);

        // Position-based color gradient across text width
        const posRatio = clamp(particle.targetX / Math.max(1, width), 0, 1);
        let baseColorRgb = mixRgb(brandRgb.primary, brandRgb.secondary, posRatio);
        
        // Add subtle wave shimmer
        const waveShimmer = Math.sin(timeSec * 3 + particle.seed * 10) * 0.2 + 0.2;
        baseColorRgb = mixRgb(baseColorRgb, brandRgb.indigo, waveShimmer);

        // Fluid disturbance high-energy color shift (light ripple lavender glow on interaction)
        const energy = clamp((currentSpeed * 0.15 + currentDisplacement * 0.02), 0, 1);
        const finalColorRgb = mixRgb(baseColorRgb, brandRgb.ripple, energy);

        const alpha = clamp((0.4 + progress * 0.6) * (0.8 + energy * 0.2), 0, 1);
        drawParticle(particle, rgbToCss(finalColorRgb, alpha), alpha);
      });

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      if (gathering && complete) {
        gathering = false;
      }

      animationFrame = visible ? window.requestAnimationFrame(render) : null;
    };

    const ensureRenderLoop = () => {
      if (animationFrame === null && visible) {
        animationFrame = window.requestAnimationFrame(render);
      }
    };

    const sampleText = async () => {
      const currentBuild = ++buildId;
      const rect = container.getBoundingClientRect();
      width = Math.floor(rect.width);
      height = Math.floor(rect.height);

      if (width <= 0 || height <= 0) return;

      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const computed = window.getComputedStyle(container);
      const resolvedFamily = fontFamily === 'inherit' ? computed.fontFamily || 'sans-serif' : fontFamily;
      let resolvedSize = resolveFontSize(fontSize, container, fontWeight, resolvedFamily);
      let font = `${fontWeight} ${resolvedSize}px ${resolvedFamily}`;

      await waitForFonts(font);
      if (currentBuild !== buildId) return;

      const offscreen = document.createElement('canvas');
      const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
      if (!offCtx) return;

      const content = String(text || ' ');
      const maxTextWidth = width * 0.92;
      offCtx.font = font;
      let metrics = offCtx.measureText(content);
      const measuredWidth = Math.max(1, metrics.width);
      if (measuredWidth > maxTextWidth) {
        resolvedSize = Math.max(18, resolvedSize * (maxTextWidth / measuredWidth));
        font = `${fontWeight} ${resolvedSize}px ${resolvedFamily}`;
        await waitForFonts(font);
        if (currentBuild !== buildId) return;
        offCtx.font = font;
        metrics = offCtx.measureText(content);
      }

      const left = Math.ceil(metrics.actualBoundingBoxLeft || 0);
      const right = Math.ceil(metrics.actualBoundingBoxRight || metrics.width);
      const ascent = Math.ceil(metrics.actualBoundingBoxAscent || resolvedSize * 0.78);
      const descent = Math.ceil(metrics.actualBoundingBoxDescent || resolvedSize * 0.22);
      const padding = Math.max(12, Math.ceil(resolvedSize * 0.08));
      const textWidth = Math.max(1, left + right);
      const textHeight = Math.max(1, ascent + descent);

      offscreen.width = textWidth + padding * 2;
      offscreen.height = textHeight + padding * 2;
      offCtx.clearRect(0, 0, offscreen.width, offscreen.height);
      offCtx.font = font;
      offCtx.textAlign = 'left';
      offCtx.textBaseline = 'alphabetic';
      offCtx.fillStyle = '#ffffff';
      offCtx.fillText(content, padding - left, padding + ascent);

      const imageData = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
      const targets = [];
      const step = Math.max(2, Math.floor(density));

      for (let y = 0; y < offscreen.height; y += step) {
        for (let x = 0; x < offscreen.width; x += step) {
          const alpha = imageData.data[(y * offscreen.width + x) * 4 + 3];
          if (alpha > 40) {
            targets.push({
              x: width / 2 - offscreen.width / 2 + x,
              y: height / 2 - offscreen.height / 2 + y,
              alpha: alpha / 255
            });
          }
        }
      }

      const maxParticles = Math.max(900, Math.min(5200, Math.floor((width * height) / 90)));
      const stride = Math.max(1, Math.ceil(targets.length / maxParticles));
      const selected = targets.filter((_, index) => index % stride === 0);

      particles = selected.map((target, index) => {
        const seed = ((index * 9301 + 49297) % 233280) / 233280;
        const depth = 0.45 + (((index * 233 + 97) % 1000) / 1000) * 0.9;
        const angle = seed * Math.PI * 2;
        const distance = (reducedMotion ? 0 : scatter) * (0.35 + depth * 0.75);
        const startX = target.x + Math.cos(angle) * distance + (seed - 0.5) * scatter * 0.45;
        const startY = target.y + Math.sin(angle) * distance + (depth - 0.9) * scatter * 0.45;

        return {
          x: reducedMotion ? target.x : startX,
          y: reducedMotion ? target.y : startY,
          startX,
          startY,
          targetX: target.x,
          targetY: target.y,
          vx: 0,
          vy: 0,
          size: Math.max(0.6, particleSize * (0.75 + target.alpha * 0.45)),
          seed,
          depth,
          delay: seed * stagger
        };
      });

      pointer.x = width / 2;
      pointer.y = height / 2;
      pointer.smoothX = pointer.x;
      pointer.smoothY = pointer.y;

      if (reducedMotion) {
        particles.forEach(particle => {
          particle.x = particle.targetX;
          particle.y = particle.targetY;
          particle.startX = particle.targetX;
          particle.startY = particle.targetY;
          particle.delay = 0;
        });
        gathering = false;
      } else {
        startGather(false);
      }

      ensureRenderLoop();
    };

    const queueSample = () => {
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(sampleText);
    };

    const handlePointerMove = event => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = true;
    };

    const handlePointerLeave = () => {
      pointer.active = false;
    };

    const handlePointerEnter = event => {
      handlePointerMove(event);
      if (trigger === 'hover') startGather(true);
    };

    const handleClick = () => {
      if (trigger === 'click') startGather(true);
    };

    const reduceMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const handleReduceMotionChange = event => {
      reducedMotion = event.matches;
      sampleText();
    };

    reduceMotionQuery?.addEventListener('change', handleReduceMotionChange);
    canvas.addEventListener('pointerenter', handlePointerEnter);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerleave', handlePointerLeave);
    canvas.addEventListener('click', handleClick);

    const resizeObserver = new ResizeObserver(queueSample);
    resizeObserver.observe(container);

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) ensureRenderLoop();
        else if (animationFrame !== null) {
          window.cancelAnimationFrame(animationFrame);
          animationFrame = null;
        }
      },
      { threshold: 0 }
    );
    visibilityObserver.observe(container);

    sampleText();

    return () => {
      buildId += 1;
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      reduceMotionQuery?.removeEventListener('change', handleReduceMotionChange);
      canvas.removeEventListener('pointerenter', handlePointerEnter);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
      canvas.removeEventListener('click', handleClick);

      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
    };
  }, [
    text,
    particleSize,
    density,
    color,
    highlightColor,
    secondaryColor,
    rippleColor,
    scatter,
    gatherDuration,
    stagger,
    pointerRepel,
    repelRadius,
    idleDrift,
    waterFlow,
    trigger,
    fontSize,
    fontWeight,
    fontFamily,
    glow
  ]);

  return (
    <div ref={containerRef} className={`particle-text ${className}`} style={style} aria-label={text}>
      <canvas ref={canvasRef} className="particle-text__canvas" aria-hidden="true" />
      <span className="particle-text__sr">{text}</span>
    </div>
  );
};

export default ParticleText;
