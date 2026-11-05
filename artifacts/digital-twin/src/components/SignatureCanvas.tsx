/**
 * Signature canvas — vanilla HTML5 canvas + pointer events.
 *
 * Used inside the LOI signing modal. Caller passes a ref-style callback:
 *   - `onChange(dataUrl|null)` fires whenever the user draws or clears.
 *   - The data URL is a transparent-background PNG (`image/png`) of the
 *     current stroke set, sized to the canvas backing store. Suitable to
 *     embed directly into the PDF.
 *
 * Implementation notes:
 *   - Uses Pointer Events (covers mouse + touch + pen) and `setPointerCapture`
 *     so a finger drag doesn't break when it leaves the canvas briefly.
 *   - Backing store is sized at devicePixelRatio so the line is crisp on
 *     retina laptops and tablets.
 *   - Empty state detection: tracks whether any stroke has happened so the
 *     parent can disable the "Sign" button while the canvas is blank.
 *   - No external dep — kept intentionally small.
 */
import { useEffect, useRef, useState } from "react";

interface SignatureCanvasProps {
  /** Fires with the current PNG data URL whenever the user draws or clears. */
  onChange?: (dataUrl: string | null) => void;
  /** CSS width — px. Defaults to "100%" via parent flex. */
  width?: number;
  /** CSS height — px. */
  height?: number;
  /** Test id forwarded to the canvas element. */
  testId?: string;
}

export interface SignatureCanvasHandle {
  clear: () => void;
  toDataUrl: () => string | null;
  isEmpty: () => boolean;
}

export function SignatureCanvas({
  onChange,
  width = 480,
  height = 160,
  testId = "signature-canvas",
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  // Resize the backing store to devicePixelRatio for crisp strokes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 1.8;
  }, [width, height]);

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function emitChange() {
    const canvas = canvasRef.current;
    if (!canvas || !onChange) return;
    onChange(empty ? null : canvas.toDataURL("image/png"));
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastPointRef.current = pointFromEvent(e);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Dot at start so a single tap still leaves a mark.
    const p = lastPointRef.current;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 0.9, 0, Math.PI * 2);
    ctx.fillStyle = "#0f172a";
    ctx.fill();
    if (empty) setEmpty(false);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const p = pointFromEvent(e);
    const last = lastPointRef.current;
    if (last) {
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    lastPointRef.current = p;
  }

  function endStroke(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    // Emit once stroke is done.
    if (onChange && canvas) onChange(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    setEmpty(true);
    if (onChange) onChange(null);
  }

  // Keep emit in sync when `empty` flips back to true via clear.
  useEffect(() => {
    if (empty) emitChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empty]);

  return (
    <div className="loi-sig">
      <div className="loi-sig-pad">
        <canvas
          ref={canvasRef}
          data-testid={testId}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerLeave={endStroke}
          onPointerCancel={endStroke}
          className="loi-sig-canvas"
          aria-label="Signature canvas — draw your signature with your mouse, finger, or stylus."
        />
        {empty && (
          <span aria-hidden="true" className="loi-sig-placeholder">
            Draw your signature here
          </span>
        )}
      </div>
      <div className="loi-sig-foot">
        <p className="loi-sig-tip">
          Tip: use a finger on tablet, mouse or trackpad on laptop.
        </p>
        <button
          type="button"
          onClick={clear}
          disabled={empty}
          data-testid="signature-clear"
          className="loi-sig-clear"
        >
          Clear signature
        </button>
      </div>
    </div>
  );
}
