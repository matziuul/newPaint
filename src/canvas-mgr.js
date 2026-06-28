import { patternPixel, buildPattern } from './patterns.js';

function hexToRgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export class CanvasManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx    = canvas.getContext('2d');
        this.W      = canvas.width;
        this.H      = canvas.height;
        this.fgRgb  = [0, 0, 0];
        this.bgRgb  = [255, 255, 255];
        this.ctx.imageSmoothingEnabled = false;
        this._fillWhite();
    }

    setColors(fgHex, bgHex) {
        this.fgRgb = hexToRgb(fgHex);
        this.bgRgb = hexToRgb(bgHex);
    }

    _fillWhite() {
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, this.W, this.H);
    }

    // ── Pixel helpers ────────────────────────────────────────────────────

    getPixelBit(x, y) {
        if (x < 0 || x >= this.W || y < 0 || y >= this.H) return -1;
        const d = this.ctx.getImageData(x, y, 1, 1).data;
        return d[0] < 128 ? 1 : 0;
    }

    // ── Stroke/brush primitives ──────────────────────────────────────────

    // Render one brush stamp at (cx, cy) into a raw RGBA data array.
    _stampBrush(d, cx, cy, brushPixels, patRows) {
        const W = this.W, H = this.H;
        const [fr, fg, fb] = this.fgRgb;
        const [br, bg, bb] = this.bgRgb;
        cx = Math.round(cx); cy = Math.round(cy);
        for (const [dx, dy] of brushPixels) {
            const x = cx + dx, y = cy + dy;
            if (x < 0 || x >= W || y < 0 || y >= H) continue;
            const on = patternPixel(patRows, x, y);
            const i  = (y * W + x) * 4;
            d[i]   = on ? fr : br;
            d[i+1] = on ? fg : bg;
            d[i+2] = on ? fb : bb;
            d[i+3] = 255;
        }
    }

    // Bresenham line sweep — commits one putImageData at the end.
    drawStroke(x1, y1, x2, y2, brushPixels, patRows) {
        x1 = Math.round(x1); y1 = Math.round(y1);
        x2 = Math.round(x2); y2 = Math.round(y2);
        const imgd = this.ctx.getImageData(0, 0, this.W, this.H);
        const d    = imgd.data;
        let x = x1, y = y1;
        const dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1);
        const sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
        let err = dx - dy;
        this._stampBrush(d, x, y, brushPixels, patRows);
        while (x !== x2 || y !== y2) {
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x += sx; }
            if (e2 <  dx) { err += dx; y += sy; }
            this._stampBrush(d, x, y, brushPixels, patRows);
        }
        this.ctx.putImageData(imgd, 0, 0);
    }

    // ── Spray can ────────────────────────────────────────────────────────

    spray(cx, cy, radius, count, patRows) {
        cx = Math.round(cx); cy = Math.round(cy);
        const imgd = this.ctx.getImageData(0, 0, this.W, this.H);
        const d    = imgd.data;
        const W = this.W, H = this.H;
        const [fr, fg, fb] = this.fgRgb;
        const [br, bg, bb] = this.bgRgb;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r     = Math.sqrt(Math.random()) * radius;
            const x = Math.round(cx + Math.cos(angle) * r);
            const y = Math.round(cy + Math.sin(angle) * r);
            if (x < 0 || x >= W || y < 0 || y >= H) continue;
            const on = patternPixel(patRows, x, y);
            const ii = (y * W + x) * 4;
            d[ii]   = on ? fr : br;
            d[ii+1] = on ? fg : bg;
            d[ii+2] = on ? fb : bb;
            d[ii+3] = 255;
        }
        this.ctx.putImageData(imgd, 0, 0);
    }

    // ── Flood fill ───────────────────────────────────────────────────────

    floodFill(sx, sy, patRows) {
        sx = Math.round(sx); sy = Math.round(sy);
        if (sx < 0 || sx >= this.W || sy < 0 || sy >= this.H) return;
        const imgd = this.ctx.getImageData(0, 0, this.W, this.H);
        const d    = imgd.data;
        const W = this.W, H = this.H;
        const N   = W * H;
        const bit = (idx) => d[idx * 4] < 128 ? 1 : 0;
        const target = bit(sy * W + sx);

        const [fr, fg, fb] = this.fgRgb;
        const [br, bg, bb] = this.bgRgb;
        const visited = new Uint8Array(N);
        const stack   = new Int32Array(N);
        let top = 0;
        const startIdx = sy * W + sx;
        visited[startIdx] = 1;
        stack[top++] = startIdx;

        while (top > 0) {
            const idx = stack[--top];
            if (bit(idx) !== target) continue;     // pixel was already repainted
            const x = idx % W, y = (idx / W) | 0;
            const on = patternPixel(patRows, x, y);
            const i  = idx * 4;
            d[i]   = on ? fr : br;
            d[i+1] = on ? fg : bg;
            d[i+2] = on ? fb : bb;
            d[i+3] = 255;
            const push = (ni, nx, ny) => {
                if (nx < 0 || nx >= W || ny < 0 || ny >= H) return;
                if (visited[ni]) return;
                if (bit(ni) !== target) return;
                visited[ni] = 1;
                stack[top++] = ni;
            };
            push(idx - 1, x - 1, y);
            push(idx + 1, x + 1, y);
            push(idx - W, x, y - 1);
            push(idx + W, x, y + 1);
        }
        this.ctx.putImageData(imgd, 0, 0);
    }

    // ── Shape tools — use canvas 2D API with repeating pattern ───────────
    // Patterns tile from (0,0) of the canvas — authentic QuickDraw behaviour.

    _pat(patRows) { return buildPattern(this.ctx, patRows, this.fgRgb, this.bgRgb); }

    _save() { this.ctx.save(); this.ctx.imageSmoothingEnabled = false; }

    drawLine(x1, y1, x2, y2, patRows, lw) {
        this._save();
        this.ctx.strokeStyle = this._pat(patRows);
        this.ctx.lineWidth   = lw;
        this.ctx.lineCap     = 'square';
        this.ctx.beginPath();
        this.ctx.moveTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5);
        this.ctx.lineTo(Math.round(x2) + 0.5, Math.round(y2) + 0.5);
        this.ctx.stroke();
        this.ctx.restore();
    }

    drawRect(x1, y1, x2, y2, filled, patRows, lw) {
        const x = Math.min(Math.round(x1), Math.round(x2));
        const y = Math.min(Math.round(y1), Math.round(y2));
        const w = Math.abs(Math.round(x2) - Math.round(x1));
        const h = Math.abs(Math.round(y2) - Math.round(y1));
        if (w <= 0 || h <= 0) return;
        const pat = this._pat(patRows);
        this._save();
        if (filled) {
            this.ctx.fillStyle = pat;
            this.ctx.fillRect(x, y, w, h);
        } else {
            this.ctx.strokeStyle = pat;
            this.ctx.lineWidth   = lw;
            this.ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        }
        this.ctx.restore();
    }

    drawRoundRect(x1, y1, x2, y2, filled, patRows, lw, r) {
        const x = Math.min(Math.round(x1), Math.round(x2));
        const y = Math.min(Math.round(y1), Math.round(y2));
        const w = Math.abs(Math.round(x2) - Math.round(x1));
        const h = Math.abs(Math.round(y2) - Math.round(y1));
        if (w <= 0 || h <= 0) return;
        const cr  = Math.min(r, w / 2, h / 2);
        const pat = this._pat(patRows);
        this._save();
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, w, h, cr);
        if (filled) {
            this.ctx.fillStyle = pat; this.ctx.fill();
        } else {
            this.ctx.strokeStyle = pat; this.ctx.lineWidth = lw; this.ctx.stroke();
        }
        this.ctx.restore();
    }

    drawOval(x1, y1, x2, y2, filled, patRows, lw) {
        const x = Math.min(Math.round(x1), Math.round(x2));
        const y = Math.min(Math.round(y1), Math.round(y2));
        const w = Math.abs(Math.round(x2) - Math.round(x1));
        const h = Math.abs(Math.round(y2) - Math.round(y1));
        if (w <= 0 || h <= 0) return;
        const pat = this._pat(patRows);
        this._save();
        this.ctx.beginPath();
        this.ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        if (filled) {
            this.ctx.fillStyle = pat; this.ctx.fill();
        } else {
            this.ctx.strokeStyle = pat; this.ctx.lineWidth = lw; this.ctx.stroke();
        }
        this.ctx.restore();
    }

    // ── Text ─────────────────────────────────────────────────────────────

    drawText(x, y, text, fontFamily, size, style, patRows) {
        if (!text) return;
        this._save();
        this.ctx.fillStyle   = this._pat(patRows);
        this.ctx.font        = `${style} ${size}px ${fontFamily}`;
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(text, Math.round(x), Math.round(y));
        this.ctx.restore();
    }

    measureText(text, fontFamily, size, style) {
        this.ctx.save();
        this.ctx.font = `${style} ${size}px ${fontFamily}`;
        const m = this.ctx.measureText(text);
        this.ctx.restore();
        return m.width;
    }

    // ── Region ops (for selection) ────────────────────────────────────────

    copyRegion(x, y, w, h) {
        return this.ctx.getImageData(
            Math.round(x), Math.round(y),
            Math.max(1, Math.round(w)), Math.max(1, Math.round(h))
        );
    }

    clearRegion(x, y, w, h) {
        const [r, g, b] = this.bgRgb;
        this.ctx.fillStyle = `rgb(${r},${g},${b})`;
        this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    }

    pasteRegion(imgData, x, y) {
        this.ctx.putImageData(imgData, Math.round(x), Math.round(y));
    }
}
