import React, { useRef, useState, useEffect } from 'react';
import { saveWhiteboard } from '../../utils/api';

const COLORS = ['#111827', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#6B46C1', '#EC4899'];
const SIZES  = [2, 4, 8, 14];

export default function WhiteboardPanel({ sessionId }) {
  const canvasRef  = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor]     = useState('#111827');
  const [size, setSize]       = useState(4);
  const [tool, setTool]       = useState('pen'); // 'pen' | 'eraser'
  const [saved, setSaved]     = useState(false);
  const lastPos = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    const resizeCanvas = () => {
      // Canvas internal pixel buffer only tracked its CSS size once, at
      // mount. This app's whole layout uses a resizable split pane
      // (react-split) — dragging the divider changes the panel's CSS size
      // but never touched canvas.width/height, so the drawing surface
      // silently stayed at whatever size it was on first render, causing
      // strokes to appear stretched/misaligned relative to the cursor after
      // any resize. Preserve existing strokes across the resize instead of
      // just wiping the canvas.
      const prev = document.createElement('canvas');
      prev.width = canvas.width;
      prev.height = canvas.height;
      if (canvas.width > 0 && canvas.height > 0) {
        prev.getContext('2d').drawImage(canvas, 0, 0);
      }

      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (prev.width > 0 && prev.height > 0) {
        ctx.drawImage(prev, 0, 0);
      }
    };

    resizeCanvas();

    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const getPos = e => {
    const rect = canvasRef.current.getBoundingClientRect();
    if (e.touches) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = e => {
    setDrawing(true);
    lastPos.current = getPos(e);
  };

  const draw = e => {
    if (!drawing) return;
    const pos = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = tool === 'eraser' ? '#FFFFFF' : color;
    ctx.lineWidth = tool === 'eraser' ? size * 4 : size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDraw = () => setDrawing(false);

  const handleSave = async () => {
    const snapshot = canvasRef.current.toDataURL('image/png');
    try {
      await saveWhiteboard(sessionId, snapshot);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error('Failed to save whiteboard', e); }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div style={styles.root}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        {/* Colors */}
        <div style={styles.group}>
          {COLORS.map(c => (
            <button key={c}
              style={{ ...styles.colorBtn, background: c,
                boxShadow: color === c && tool === 'pen' ? `0 0 0 3px ${c}66, 0 0 0 5px rgba(0,0,0,0.12)` : 'none' }}
              onClick={() => { setColor(c); setTool('pen'); }}
            />
          ))}
        </div>

        <div style={styles.divider} />

        {/* Sizes */}
        <div style={styles.group}>
          {SIZES.map(s => (
            <button key={s}
              style={{ ...styles.sizeBtn, outline: size === s ? '2px solid #6B46C1' : 'none' }}
              onClick={() => setSize(s)}>
              <div style={{
                width: Math.max(4, s * 2), height: Math.max(4, s * 2),
                borderRadius: '50%', background: color,
              }} />
            </button>
          ))}
        </div>

        <div style={styles.divider} />

        {/* Tools */}
        <button style={{ ...styles.toolBtn, background: tool === 'eraser' ? '#F3E8FF' : 'transparent' }}
          onClick={() => setTool('eraser')} title="Eraser">
          🧹
        </button>
        <button style={styles.toolBtn} onClick={handleClear} title="Clear">🗑️</button>

        <div style={{ marginLeft: 'auto' }}>
          <button style={{ ...styles.saveBtn, background: saved ? '#10B981' : '#6B46C1' }}
            onClick={handleSave}>
            {saved ? '✓ Saved' : '💾 Save'}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={styles.canvas}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
      />
    </div>
  );
}

const styles = {
  root: { display: 'flex', flexDirection: 'column', height: '100%', background: '#FFFFFF' },
  toolbar: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 16px', background: '#fafafa',
    borderBottom: '1px solid rgba(0,0,0,0.06)', flexShrink: 0,
  },
  group: { display: 'flex', gap: '6px', alignItems: 'center' },
  colorBtn: {
    width: '22px', height: '22px', borderRadius: '50%',
    border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer', transition: 'box-shadow 0.15s',
  },
  sizeBtn: {
    background: '#ffffff', border: '1px solid rgba(0,0,0,0.1)',
    borderRadius: '6px', cursor: 'pointer', padding: '6px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '32px', height: '32px',
  },
  toolBtn: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    fontSize: '18px', padding: '4px 8px', borderRadius: '6px',
  },
  divider: { width: '1px', height: '28px', background: 'rgba(0,0,0,0.08)', margin: '0 4px' },
  saveBtn: {
    color: '#fff', border: 'none', borderRadius: '8px',
    padding: '7px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'background 0.3s',
  },
  canvas: { flex: 1, cursor: 'crosshair', display: 'block' },
};
