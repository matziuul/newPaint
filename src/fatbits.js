// Fatbits — zoomed pixel editor, authentic MacPaint feature.
//
// The fatbits canvas renders a magnified region of the paper canvas.
// All drawing tools delegate through here; coordinates are translated
// to paper-space before being forwarded to the tool, so every tool
// just works in fatbits without modification.

export class FatbitsView {
    constructor(canvas, paperCanvas, history, state) {
        this.canvas   = canvas;
        this.ctx      = canvas.getContext('2d');
        this.paper    = paperCanvas;
        this.paperCtx = paperCanvas.getContext('2d');
        this.history  = history;
        this.state    = state;

        this.active  = false;
        this.zoom    = 8;         // magnification factor
        this.originX = 0;         // top-left corner in paper pixels
        this.originY = 0;

        this._down   = false;
        this._inkBit = 1;         // 1 = black, 0 = white (set on mousedown)
        this._lx = 0; this._ly = 0;

        // Off-screen buffer for the pixel-scale blit
        this._buf    = document.createElement('canvas');
        this._bufCtx = this._buf.getContext('2d');
    }

    // ── Geometry ────────────────────────────────────────────────────────

    get viewW() { return (this.canvas.width  / this.zoom) | 0; }
    get viewH() { return (this.canvas.height / this.zoom) | 0; }

    _clamp() {
        const maxX = Math.max(0, this.paper.width  - this.viewW);
        const maxY = Math.max(0, this.paper.height - this.viewH);
        this.originX = Math.max(0, Math.min(maxX, this.originX));
        this.originY = Math.max(0, Math.min(maxY, this.originY));
    }

    centerOn(px, py) {
        this.originX = Math.round(px - this.viewW / 2);
        this.originY = Math.round(py - this.viewH / 2);
        this._clamp();
    }

    // ── Lifecycle ────────────────────────────────────────────────────────

    open(px, py) {
        this.active = true;
        this.centerOn(px, py);
        document.getElementById('fatbits-panel').style.display = '';
    }

    close() {
        this.active = false;
        document.getElementById('fatbits-panel').style.display = 'none';
    }

    toggle(px, py) {
        if (this.active) this.close();
        else             this.open(px, py);
    }

    // ── Zoom controls ────────────────────────────────────────────────────

    zoomIn() {
        if (this.zoom < 16) { this.zoom *= 2; this._clamp(); }
        this._updateZoomLabel();
    }

    zoomOut() {
        if (this.zoom > 2)  { this.zoom /= 2; this._clamp(); }
        this._updateZoomLabel();
    }

    _updateZoomLabel() {
        const el = document.getElementById('fatbits-zoom-label');
        if (el) el.textContent = `${this.zoom}×`;
    }

    // ── Rendering ────────────────────────────────────────────────────────

    render() {
        if (!this.active) return;
        const { ctx, zoom } = this;
        const FW = this.canvas.width, FH = this.canvas.height;
        const vW = this.viewW, vH = this.viewH;

        // Grab the source region from the paper canvas
        this._buf.width  = vW;
        this._buf.height = vH;
        this._bufCtx.putImageData(
            this.paperCtx.getImageData(this.originX, this.originY, vW, vH), 0, 0
        );

        // Scale up with crisp (no smoothing) nearest-neighbour
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, FW, FH);
        ctx.drawImage(this._buf, 0, 0, FW, FH);

        // Pixel grid — only when zoom is large enough to see individual cells
        if (zoom >= 4) {
            ctx.strokeStyle = 'rgba(140,140,155,0.5)';
            ctx.lineWidth   = 0.5;
            ctx.beginPath();
            for (let x = 0; x <= FW; x += zoom) {
                ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, FH);
            }
            for (let y = 0; y <= FH; y += zoom) {
                ctx.moveTo(0, y + 0.5); ctx.lineTo(FW, y + 0.5);
            }
            ctx.stroke();
        }
        ctx.restore();
    }

    // Draw the viewport indicator (dotted rect) on the main overlay canvas.
    renderIndicator(ovCtx, dashOff) {
        if (!this.active) return;
        const { originX: x, originY: y, viewW: w, viewH: h } = this;
        ovCtx.save();
        // Two-colour dashed outline for visibility on any background
        ovCtx.setLineDash([3, 3]);
        ovCtx.lineWidth = 1;
        ovCtx.beginPath();
        ovCtx.rect(x + 0.5, y + 0.5, w - 1, h - 1);
        ovCtx.strokeStyle    = 'black';
        ovCtx.lineDashOffset = -dashOff;
        ovCtx.stroke();
        ovCtx.strokeStyle    = 'white';
        ovCtx.lineDashOffset = -(dashOff + 3);
        ovCtx.stroke();
        ovCtx.restore();
    }

    // ── Coordinate mapping ───────────────────────────────────────────────

    // Convert a position on the fatbits canvas to paper-canvas pixel coords.
    toPaper(fx, fy) {
        return {
            x: Math.max(0, Math.min(this.paper.width  - 1, (fx / this.zoom | 0) + this.originX)),
            y: Math.max(0, Math.min(this.paper.height - 1, (fy / this.zoom | 0) + this.originY)),
        };
    }

    // ── Pixel editing ────────────────────────────────────────────────────

    onDown(fx, fy) {
        const { x, y } = this.toPaper(fx, fy);
        // Toggle: if pixel is black draw white, if white draw black.
        this._inkBit = this.paperCtx.getImageData(x, y, 1, 1).data[0] < 128 ? 0 : 1;
        this._paintPixel(x, y);
        this._down = true;
        this._lx = fx; this._ly = fy;
    }

    onMove(fx, fy) {
        if (!this._down) return;
        const cur  = this.toPaper(fx, fy);
        const prev = this.toPaper(this._lx, this._ly);
        if (cur.x !== prev.x || cur.y !== prev.y) this._paintPixel(cur.x, cur.y);
        this._lx = fx; this._ly = fy;
    }

    onUp() {
        if (!this._down) return;
        this._down = false;
        this.history.save(this.paperCtx, this.paper.width, this.paper.height);
    }

    onLeave() {
        if (this._down) this.onUp();
    }

    _paintPixel(x, y) {
        this.paperCtx.fillStyle = this._inkBit ? this.state.fgColor : this.state.bgColor;
        this.paperCtx.fillRect(x, y, 1, 1);
    }

    // ── Pan ──────────────────────────────────────────────────────────────

    // Shift+click in the main canvas pans the fatbits viewport.
    panTo(px, py) { this.centerOn(px, py); }
}
