// Color wheel UI: hue ring + SV square + FG/BG swatches.

function hsvToRgb(h, s, v) {
    // h: 0-360, s: 0-1, v: 0-1  →  [r, g, b] 0-255
    const c = v * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    if      (h < 60)  { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else              { r = c; b = x; }
    return [Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255)];
}

function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d   = max - min;
    let h = 0;
    if (d > 0) {
        if      (max === r) h = ((g - b) / d % 6 + 6) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else                h = (r - g) / d + 4;
        h *= 60;
    }
    return [h, max > 0 ? d / max : 0, max];
}

export function hexToRgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

// Geometry constants for the 68×68 wheel canvas
const SIZE = 68;
const C    = 34;    // center
const R    = 33;    // outer ring radius
const RW   = 11;    // ring width  → inner ring radius = R - RW = 22
const RINNER = R - RW;
const SQ   = Math.floor(RINNER / Math.SQRT2) - 1;  // SV square half-side ≈ 14

export class ColorWheel {
    constructor(container, onChange) {
        // onChange(fgHex, bgHex) is called whenever either color changes.
        this._onChange = onChange;
        this._h = 0; this._s = 0; this._v = 0;
        this._bgHex = '#ffffff';
        this._dragging = null;
        this._build(container);
    }

    // Call to set FG color externally without firing onChange.
    setFg(hex) {
        const [r, g, b] = hexToRgb(hex);
        [this._h, this._s, this._v] = rgbToHsv(r, g, b);
        this._syncUI(false);
        this._render();
    }

    get _fgHex() {
        const [r, g, b] = hsvToRgb(this._h, this._s, this._v);
        return rgbToHex(r, g, b);
    }

    _build(container) {
        // --- Swatch row ---
        const swRow = document.createElement('div');
        swRow.className = 'cw-swatches';

        this._bgSwatch = document.createElement('div');
        this._bgSwatch.className = 'cw-swatch cw-bg';
        this._bgSwatch.style.background = this._bgHex;
        this._bgSwatch.title = 'Background color — click to edit';

        this._fgSwatch = document.createElement('div');
        this._fgSwatch.className = 'cw-swatch cw-fg';
        this._fgSwatch.title = 'Foreground color — use wheel below';

        const swapBtn = document.createElement('button');
        swapBtn.className = 'cw-swap';
        swapBtn.textContent = '↔';
        swapBtn.title = 'Swap foreground / background';
        swapBtn.addEventListener('click', () => this._swap());

        // Native color picker for BG (hidden, triggered by BG swatch click)
        this._bgInput = document.createElement('input');
        this._bgInput.type  = 'color';
        this._bgInput.value = this._bgHex;
        this._bgInput.style.cssText = 'position:absolute;opacity:0;width:0;height:0;pointer-events:none';
        this._bgInput.addEventListener('input', e => {
            this._bgHex = e.target.value;
            this._bgSwatch.style.background = e.target.value;
            this._onChange(this._fgHex, this._bgHex);
        });
        this._bgSwatch.addEventListener('click', () => this._bgInput.click());

        swRow.append(this._bgSwatch, this._fgSwatch, swapBtn, this._bgInput);
        container.append(swRow);

        // --- Wheel canvas ---
        this._canvas = document.createElement('canvas');
        this._canvas.width  = SIZE;
        this._canvas.height = SIZE;
        this._canvas.className = 'cw-canvas';
        this._ctx = this._canvas.getContext('2d');

        this._canvas.addEventListener('mousedown', e => {
            this._dragging = this._hit(e);
            if (this._dragging) { this._handleDrag(e); e.preventDefault(); }
        });
        window.addEventListener('mousemove', e => { if (this._dragging) this._handleDrag(e); });
        window.addEventListener('mouseup',   ()  => { this._dragging = null; });
        container.append(this._canvas);

        // --- Hex input ---
        this._hexInput = document.createElement('input');
        this._hexInput.type      = 'text';
        this._hexInput.className = 'cw-hex';
        this._hexInput.maxLength = 7;
        this._hexInput.spellcheck = false;
        this._hexInput.addEventListener('change', () => {
            const v = this._hexInput.value.trim();
            if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                const [r, g, b] = hexToRgb(v);
                [this._h, this._s, this._v] = rgbToHsv(r, g, b);
                this._syncUI(true);
                this._render();
            }
        });
        container.append(this._hexInput);

        this._syncUI(false);
        this._render();
    }

    _swap() {
        const oldFg = this._fgHex;
        const oldBg = this._bgHex;
        // New FG = old BG
        const [r, g, b] = hexToRgb(oldBg);
        [this._h, this._s, this._v] = rgbToHsv(r, g, b);
        // New BG = old FG
        this._bgHex = oldFg;
        this._bgSwatch.style.background = oldFg;
        this._bgInput.value = oldFg;
        this._syncUI(true);
        this._render();
    }

    _syncUI(fire) {
        const hex = this._fgHex;
        this._fgSwatch.style.background = hex;
        if (this._hexInput) this._hexInput.value = hex;
        if (fire) this._onChange(hex, this._bgHex);
    }

    _canvasXY(e) {
        const rect = this._canvas.getBoundingClientRect();
        return [
            (e.clientX - rect.left) * SIZE / rect.width,
            (e.clientY - rect.top)  * SIZE / rect.height,
        ];
    }

    _hit(e) {
        const [px, py] = this._canvasXY(e);
        const dx = px - C, dy = py - C;
        const dist = Math.hypot(dx, dy);
        if (dist >= RINNER - 1 && dist <= R + 1) return 'ring';
        if (Math.abs(dx) <= SQ && Math.abs(dy) <= SQ) return 'sv';
        return null;
    }

    _handleDrag(e) {
        const [px, py] = this._canvasXY(e);
        const dx = px - C, dy = py - C;
        if (this._dragging === 'ring') {
            this._h = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
        } else {
            this._s = (Math.max(-SQ, Math.min(SQ, dx)) + SQ) / (2 * SQ);
            this._v = 1 - (Math.max(-SQ, Math.min(SQ, dy)) + SQ) / (2 * SQ);
        }
        this._syncUI(true);
        this._render();
    }

    _render() {
        const img = this._ctx.createImageData(SIZE, SIZE);
        const d   = img.data;

        for (let py = 0; py < SIZE; py++) {
            for (let px = 0; px < SIZE; px++) {
                const dx   = px - C, dy = py - C;
                const dist = Math.hypot(dx, dy);
                let rv = 0, gv = 0, bv = 0, av = 0;

                if (dist >= RINNER && dist <= R) {
                    // Hue ring
                    const angle = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
                    [rv, gv, bv] = hsvToRgb(angle, 1, 1);
                    av = 255;
                } else if (Math.abs(dx) <= SQ && Math.abs(dy) <= SQ) {
                    // SV square: x → saturation, y → value (inverted)
                    const s = (dx + SQ) / (2 * SQ);
                    const v = 1 - (dy + SQ) / (2 * SQ);
                    [rv, gv, bv] = hsvToRgb(this._h, s, v);
                    av = 255;
                }

                const i = (py * SIZE + px) * 4;
                d[i] = rv; d[i+1] = gv; d[i+2] = bv; d[i+3] = av;
            }
        }
        this._ctx.putImageData(img, 0, 0);

        // Hue ring indicator
        const ri   = RINNER + RW / 2;
        const hrad = this._h * Math.PI / 180;
        this._dot(C + ri * Math.cos(hrad), C + ri * Math.sin(hrad), 4.5);

        // SV square indicator
        const sx = C + (this._s * 2 - 1) * SQ;
        const sy = C + ((1 - this._v) * 2 - 1) * SQ;
        this._dot(sx, sy, 3.5);
    }

    _dot(x, y, r) {
        const ctx = this._ctx;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth   = 2;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.lineWidth   = 0.75;
        ctx.stroke();
    }
}
