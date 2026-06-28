import { QD_PATTERNS } from './patterns.js';
import { ERASER_PIXELS } from './state.js';

// ─────────────────────────────────────────────────────────────────────────────
// Base tool — all tools inherit from here.
// ─────────────────────────────────────────────────────────────────────────────
class BaseTool {
    constructor(state, cm, history, overlay) {
        this.state   = state;
        this.cm      = cm;
        this.history = history;
        this.ov      = overlay;      // overlay canvas 2D context
        this._lx = 0; this._ly = 0; // last mouse position
        this._down = false;
    }

    pat()    { return QD_PATTERNS[this.state.activePattern]; }
    lw()     { return this.state.lineWidth; }
    radius() { return this.state.roundRadius; }

    clearOverlay() {
        this.ov.clearRect(0, 0, this.ov.canvas.width, this.ov.canvas.height);
    }

    onDown(_x, _y, _e) {}
    onMove(_x, _y, _e) {}
    onUp  (_x, _y, _e) {}
    onKey (_e)         {}
    onLeave()          {}
    onDeactivate()     {}

    _saveHistory() {
        this.history.save(this.cm.ctx, this.cm.W, this.cm.H);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pencil — 1 px, toggle mode: if clicked on a black pixel, draws white.
// ─────────────────────────────────────────────────────────────────────────────
export class PencilTool extends BaseTool {
    constructor(...a) { super(...a); this._inkBit = 1; }

    onDown(x, y) {
        this._inkBit = this.cm.getPixelBit(x, y) === 1 ? 0 : 1;
        const rows = this._inkBit ? this.pat() : [0,0,0,0,0,0,0,0];
        this.cm.drawStroke(x, y, x, y, [[0,0]], rows);
        this._lx = x; this._ly = y;
        this._down = true;
    }

    onMove(x, y) {
        if (!this._down) return;
        const rows = this._inkBit ? this.pat() : [0,0,0,0,0,0,0,0];
        this.cm.drawStroke(this._lx, this._ly, x, y, [[0,0]], rows);
        this._lx = x; this._ly = y;
    }

    onUp() { this._down = false; this._saveHistory(); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Brush — draws with current brush shape and pattern.
// ─────────────────────────────────────────────────────────────────────────────
export class BrushTool extends BaseTool {
    onDown(x, y) {
        this.cm.drawStroke(x, y, x, y, this.state.brushPixels, this.pat());
        this._lx = x; this._ly = y;
        this._down = true;
    }

    onMove(x, y) {
        if (!this._down) return;
        this.cm.drawStroke(this._lx, this._ly, x, y, this.state.brushPixels, this.pat());
        this._lx = x; this._ly = y;
    }

    onUp() { this._down = false; this._saveHistory(); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Eraser — 16 × 16 white square.
// ─────────────────────────────────────────────────────────────────────────────
export class EraserTool extends BaseTool {
    onDown(x, y) {
        const WHITE = [0,0,0,0,0,0,0,0];
        this.cm.drawStroke(x, y, x, y, ERASER_PIXELS, WHITE);
        this._lx = x; this._ly = y;
        this._down = true;
    }

    onMove(x, y) {
        if (!this._down) return;
        const WHITE = [0,0,0,0,0,0,0,0];
        this.cm.drawStroke(this._lx, this._ly, x, y, ERASER_PIXELS, WHITE);
        this._lx = x; this._ly = y;
    }

    onUp() { this._down = false; this._saveHistory(); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Spray can — continuous dots while dragging.
// ─────────────────────────────────────────────────────────────────────────────
export class SprayTool extends BaseTool {
    constructor(...a) { super(...a); this._interval = null; this._cx = 0; this._cy = 0; }

    onDown(x, y) {
        this._cx = x; this._cy = y;
        this._down = true;
        this._spray();
        this._interval = setInterval(() => { if (this._down) this._spray(); }, 50);
    }

    onMove(x, y) { this._cx = x; this._cy = y; }

    onUp() {
        this._down = false;
        clearInterval(this._interval);
        this._interval = null;
        this._saveHistory();
    }

    onLeave() { this.onUp(); }

    _spray() { this.cm.spray(this._cx, this._cy, 20, 12, this.pat()); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fill / paint bucket — flood fill with current pattern.
// ─────────────────────────────────────────────────────────────────────────────
export class FillTool extends BaseTool {
    onDown(x, y) {
        this.cm.floodFill(x, y, this.pat());
        this._saveHistory();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Text tool — click to place, type, Enter/Escape to commit.
// ─────────────────────────────────────────────────────────────────────────────
export class TextTool extends BaseTool {
    constructor(...a) {
        super(...a);
        this._cursor = true;
        this._cursorInterval = null;
    }

    onDown(x, y) {
        this._commit();
        this.state.textX = x;
        this.state.textY = y;
        this.state.textBuf = '';
        this.state.textActive = true;
        this._startCursor();
    }

    onKey(e) {
        if (!this.state.textActive) return;
        if (e.key === 'Enter' || e.key === 'Escape') {
            this._commit();
            return;
        }
        if (e.key === 'Backspace') {
            this.state.textBuf = this.state.textBuf.slice(0, -1);
        } else if (e.key.length === 1) {
            this.state.textBuf += e.key;
        }
    }

    _commit() {
        if (!this.state.textActive) return;
        clearInterval(this._cursorInterval);
        this._cursorInterval = null;
        if (this.state.textBuf) {
            this.cm.drawText(
                this.state.textX, this.state.textY,
                this.state.textBuf,
                this.state.textFont, this.state.textSize,
                this.state.textStyle, this.pat()
            );
            this._saveHistory();
        }
        this.state.textActive = false;
        this.state.textBuf = '';
        this.clearOverlay();
    }

    _startCursor() {
        this._cursor = true;
        this._cursorInterval = setInterval(() => {
            this._cursor = !this._cursor;
        }, 500);
    }

    // Overlay rendering is driven from main.js render loop via renderOverlay().
    renderOverlay(dashOffset) {
        if (!this.state.textActive) return;
        const { textX, textY, textBuf, textFont, textSize, textStyle } = this.state;
        const ctx = this.ov;
        ctx.save();
        ctx.font          = `${textStyle} ${textSize}px ${textFont}`;
        ctx.textBaseline  = 'top';
        ctx.fillStyle     = this.state.fgColor;
        if (textBuf) ctx.fillText(textBuf, textX, textY);
        // Cursor blinking
        if (this._cursor) {
            const w = textBuf ? this.cm.measureText(textBuf, textFont, textSize, textStyle) : 0;
            ctx.fillRect(textX + w, textY, 2, textSize);
        }
        ctx.restore();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shape base — common drag-to-draw pattern for line/rect/oval tools.
// ─────────────────────────────────────────────────────────────────────────────
class ShapeTool extends BaseTool {
    constructor(...a) { super(...a); this._sx = 0; this._sy = 0; this._ex = 0; this._ey = 0; }

    onDown(x, y) {
        this._sx = x; this._sy = y;
        this._ex = x; this._ey = y;
        this._down = true;
    }

    onMove(x, y) {
        if (!this._down) return;
        // Just store the current end point; the RAF loop calls renderOverlay() each frame.
        this._ex = x; this._ey = y;
    }

    onUp(x, y) {
        if (!this._down) return;
        this._down = false;
        this.clearOverlay();
        const dx = Math.abs(x - this._sx), dy = Math.abs(y - this._sy);
        if (dx > 2 || dy > 2) {
            this._drawFinal(this._sx, this._sy, x, y);
            this._saveHistory();
        }
    }

    onLeave() { if (this._down) this.onUp(this._ex, this._ey); }

    // Called every frame by the RAF loop so the preview stays visible.
    renderOverlay(_dashOff) {
        if (!this._down) return;
        this.clearOverlay();
        this._drawPreview(this._sx, this._sy, this._ex, this._ey);
        this.ov.beginPath(); // clear path so it doesn't leak into other renderers
    }

    // Subclasses implement these:
    _drawPreview(_x1, _y1, _x2, _y2) {}
    _drawFinal(_x1, _y1, _x2, _y2) {}

    _beginPreview() {
        const ctx = this.ov;
        ctx.save();
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
    }

    _strokePreview() {
        const ctx = this.ov;
        ctx.strokeStyle    = 'black';
        ctx.lineDashOffset = 0;
        ctx.stroke();
        ctx.strokeStyle    = 'white';
        ctx.lineDashOffset = 4;
        ctx.stroke();
        ctx.restore();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Line tool
// ─────────────────────────────────────────────────────────────────────────────
export class LineTool extends ShapeTool {
    _drawPreview(x1, y1, x2, y2) {
        const ctx = this.ov;
        this._beginPreview();
        ctx.beginPath();
        ctx.moveTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5);
        ctx.lineTo(Math.round(x2) + 0.5, Math.round(y2) + 0.5);
        this._strokePreview();
    }

    _drawFinal(x1, y1, x2, y2) {
        this.cm.drawLine(x1, y1, x2, y2, this.pat(), this.lw());
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rectangle tools
// ─────────────────────────────────────────────────────────────────────────────
function normBox(x1, y1, x2, y2) {
    return [Math.min(x1,x2), Math.min(y1,y2), Math.abs(x2-x1), Math.abs(y2-y1)];
}

export class RectTool extends ShapeTool {
    constructor(a, b, c, d, filled = false) {
        super(a, b, c, d);
        this._filled = filled;
    }

    _drawPreview(x1, y1, x2, y2) {
        const [x,y,w,h] = normBox(x1,y1,x2,y2);
        if (!w || !h) return;
        const ctx = this.ov;
        this._beginPreview();
        ctx.beginPath();
        ctx.rect(x + 0.5, y + 0.5, w - 1, h - 1);
        this._strokePreview();
    }

    _drawFinal(x1, y1, x2, y2) {
        this.cm.drawRect(x1, y1, x2, y2, this._filled, this.pat(), this.lw());
    }
}

export class RoundRectTool extends ShapeTool {
    constructor(a, b, c, d, filled = false) {
        super(a, b, c, d);
        this._filled = filled;
    }

    _drawPreview(x1, y1, x2, y2) {
        const [x,y,w,h] = normBox(x1,y1,x2,y2);
        if (!w || !h) return;
        const r = Math.min(this.radius(), w/2, h/2);
        const ctx = this.ov;
        this._beginPreview();
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
        this._strokePreview();
    }

    _drawFinal(x1, y1, x2, y2) {
        this.cm.drawRoundRect(x1, y1, x2, y2, this._filled, this.pat(), this.lw(), this.radius());
    }
}

export class OvalTool extends ShapeTool {
    constructor(a, b, c, d, filled = false) {
        super(a, b, c, d);
        this._filled = filled;
    }

    _drawPreview(x1, y1, x2, y2) {
        const [x,y,w,h] = normBox(x1,y1,x2,y2);
        if (!w || !h) return;
        const ctx = this.ov;
        this._beginPreview();
        ctx.beginPath();
        ctx.ellipse(x + w/2, y + h/2, w/2, h/2, 0, 0, Math.PI*2);
        this._strokePreview();
    }

    _drawFinal(x1, y1, x2, y2) {
        this.cm.drawOval(x1, y1, x2, y2, this._filled, this.pat(), this.lw());
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Selection rectangle — rubber-band + move floated selection.
// ─────────────────────────────────────────────────────────────────────────────
export class SelectRectTool extends BaseTool {
    constructor(...a) {
        super(...a);
        this._mode      = 'idle';   // 'idle' | 'selecting' | 'moving'
        this._sx = 0; this._sy = 0;
        this._mx = 0; this._my = 0; // anchor inside selection when moving
        this._dashOff = 0;
    }

    onDown(x, y) {
        const s = this.state;
        if (s.isFloating) {
            // Click outside floated selection → commit it
            if (!this._insideFloat(x, y)) {
                this._commitFloat();
            } else {
                // Grab the floating layer
                this._mode = 'moving';
                this._mx = x - s.floatX;
                this._my = y - s.floatY;
                this._down = true;
                return;
            }
        }
        if (s.selection && this._insideSel(x, y)) {
            // Lift selection to floating layer
            this._lift();
            this._mode = 'moving';
            this._mx = x - s.floatX;
            this._my = y - s.floatY;
        } else {
            // Start a new rubber-band selection
            this._commitFloat();
            s.selection = null;
            this._mode = 'selecting';
            this._sx = x; this._sy = y;
        }
        this._down = true;
    }

    onMove(x, y) {
        if (!this._down) return;
        const s = this.state;
        if (this._mode === 'selecting') {
            s.selection = {
                x: Math.min(this._sx, x),
                y: Math.min(this._sy, y),
                w: Math.abs(x - this._sx),
                h: Math.abs(y - this._sy),
            };
        } else if (this._mode === 'moving') {
            s.floatX = x - this._mx;
            s.floatY = y - this._my;
        }
    }

    onUp() {
        if (this._mode === 'selecting') {
            const sel = this.state.selection;
            if (sel && (sel.w < 2 || sel.h < 2)) this.state.selection = null;
        }
        this._down = false;
        if (this._mode !== 'moving') this._mode = 'idle';
    }

    onKey(e) {
        if (e.key === 'Escape') {
            this._commitFloat();
            this.state.selection = null;
            this.clearOverlay();
        }
        if ((e.key === 'Delete' || e.key === 'Backspace') && this.state.selection) {
            const { x, y, w, h } = this.state.selection;
            this.cm.clearRegion(x, y, w, h);
            this.state.selection = null;
            this.state.isFloating = false;
            this.state.floatData  = null;
            this.clearOverlay();
            this._saveHistory();
        }
        // Cmd+C: copy selection
        if ((e.metaKey || e.ctrlKey) && e.key === 'c' && this.state.selection) {
            const { x, y, w, h } = this.state.selection;
            this.state._clipboard = this.cm.copyRegion(x, y, w, h);
        }
        // Cmd+V: paste
        if ((e.metaKey || e.ctrlKey) && e.key === 'v' && this.state._clipboard) {
            this._commitFloat();
            const cb = this.state._clipboard;
            this.state.floatData = cb;
            this.state.floatX    = 20;
            this.state.floatY    = 20;
            this.state.isFloating = true;
            this.state.selection = { x: 20, y: 20, w: cb.width, h: cb.height };
        }
    }

    // Render marching ants + floating layer on overlay.
    renderOverlay(dashOff) {
        this.clearOverlay();
        const s   = this.state;
        const ctx = this.ov;

        // Draw floating selection pixels
        if (s.isFloating && s.floatData) {
            ctx.putImageData(s.floatData, s.floatX, s.floatY);
        }

        // Marching ants border
        const sel = s.isFloating
            ? { x: s.floatX, y: s.floatY, w: s.floatData?.width ?? 0, h: s.floatData?.height ?? 0 }
            : s.selection;
        if (sel && sel.w > 0 && sel.h > 0) {
            ctx.save();
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.rect(sel.x + 0.5, sel.y + 0.5, sel.w - 1, sel.h - 1);
            ctx.strokeStyle    = 'black';
            ctx.lineDashOffset = -dashOff;
            ctx.stroke();
            ctx.strokeStyle    = 'white';
            ctx.lineDashOffset = -dashOff + 4;
            ctx.stroke();
            ctx.restore();
        }
    }

    _insideSel(x, y) {
        const s = this.state.selection;
        if (!s) return false;
        return x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h;
    }

    _insideFloat(x, y) {
        const s = this.state;
        if (!s.isFloating || !s.floatData) return false;
        return x >= s.floatX && x <= s.floatX + s.floatData.width &&
               y >= s.floatY && y <= s.floatY + s.floatData.height;
    }

    _lift() {
        const s   = this.state;
        const sel = s.selection;
        if (!sel) return;
        s.floatData   = this.cm.copyRegion(sel.x, sel.y, sel.w, sel.h);
        s.floatX      = sel.x;
        s.floatY      = sel.y;
        s.isFloating  = true;
        this.cm.clearRegion(sel.x, sel.y, sel.w, sel.h);
    }

    _commitFloat() {
        const s = this.state;
        if (!s.isFloating || !s.floatData) return;
        this.cm.pasteRegion(s.floatData, s.floatX, s.floatY);
        s.isFloating  = false;
        s.floatData   = null;
        s.selection   = null;
        this.clearOverlay();
        this._saveHistory();
    }

    onDeactivate() {
        this._commitFloat();      // pastes any floating selection and saves history
        this.state.selection = null;  // clears any non-floating rubber-band selection
        this.clearOverlay();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────
export function createTool(name, state, cm, history, ovCtx) {
    const args = [state, cm, history, ovCtx];
    switch (name) {
        case 'pencil':        return new PencilTool(...args);
        case 'brush':         return new BrushTool(...args);
        case 'spray':         return new SprayTool(...args);
        case 'eraser':        return new EraserTool(...args);
        case 'fill':          return new FillTool(...args);
        case 'text':          return new TextTool(...args);
        case 'line':          return new LineTool(...args);
        case 'rect':          return new RectTool(...args, false);
        case 'filled-rect':   return new RectTool(...args, true);
        case 'round-rect':    return new RoundRectTool(...args, false);
        case 'filled-round-rect': return new RoundRectTool(...args, true);
        case 'oval':          return new OvalTool(...args, false);
        case 'filled-oval':   return new OvalTool(...args, true);
        case 'select':        return new SelectRectTool(...args);
        default:              return new BaseTool(...args);
    }
}
