import { QD_PATTERNS, buildPattern } from './patterns.js';
import { BRUSH_SHAPES } from './state.js';

const TOOLS = [
    { id: 'select',            label: '⬚',  title: 'Selection (S)'          },
    { id: 'pencil',            label: '✏',  title: 'Pencil (P)'             },
    { id: 'brush',             label: '🖌',  title: 'Brush (B)'              },
    { id: 'spray',             label: '💨',  title: 'Spray Can (Y)'          },
    { id: 'eraser',            label: '⬜',  title: 'Eraser (E)'             },
    { id: 'fill',              label: '🪣',  title: 'Paint Bucket (F)'       },
    { id: 'text',              label: 'A',  title: 'Text (T)'               },
    { id: 'line',              label: '╱',  title: 'Line (L)'               },
    { id: 'rect',              label: '□',  title: 'Rectangle'              },
    { id: 'filled-rect',       label: '■',  title: 'Filled Rectangle'       },
    { id: 'round-rect',        label: '▢',  title: 'Rounded Rect'           },
    { id: 'filled-round-rect', label: '▣',  title: 'Filled Rounded Rect'   },
    { id: 'oval',              label: '○',  title: 'Oval'                   },
    { id: 'filled-oval',       label: '●',  title: 'Filled Oval'            },
];

const LINE_WIDTHS = [1, 2, 3, 4, 6, 8];

export class Toolbox {
    constructor(state, onToolChange) {
        this.state        = state;
        this.onToolChange = onToolChange;
        this._buttons     = new Map();
        this._buildTools();
        this._buildPatterns();
        this._buildBrushes();
        this._buildLineWidths();
        this._attachKeyboard();
    }

    // ── Tool buttons ─────────────────────────────────────────────────────

    _buildTools() {
        const grid = document.getElementById('toolGrid');
        for (const t of TOOLS) {
            const btn = document.createElement('button');
            btn.className   = 'tool-btn';
            btn.textContent = t.label;
            btn.title       = t.title;
            btn.dataset.tool = t.id;
            if (t.id === this.state.activeTool) btn.classList.add('active');
            btn.addEventListener('click', () => this._select(t.id));
            this._buttons.set(t.id, btn);
            grid.appendChild(btn);
        }
    }

    _select(id) {
        this.state.activeTool = id;
        this._buttons.forEach((btn, key) => btn.classList.toggle('active', key === id));
        this.onToolChange(id);
    }

    // ── Pattern palette ──────────────────────────────────────────────────

    _buildPatterns() {
        const grid = document.getElementById('patternGrid');
        QD_PATTERNS.forEach((rows, idx) => {
            const cv = this._makePatternSwatch(rows, idx);
            cv.addEventListener('click', () => {
                this.state.activePattern = idx;
                grid.querySelectorAll('.pat-swatch').forEach((s, i) =>
                    s.classList.toggle('active', i === idx));
            });
            grid.appendChild(cv);
        });
    }

    _makePatternSwatch(rows, idx) {
        const cv = document.createElement('canvas');
        cv.width = 16; cv.height = 16;
        cv.className = 'pat-swatch';
        cv.title     = `Pattern ${idx}`;
        if (idx === this.state.activePattern) cv.classList.add('active');
        const ctx = cv.getContext('2d');
        ctx.fillStyle = buildPattern(ctx, rows);
        ctx.fillRect(0, 0, 16, 16);
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(0.25, 0.25, 15.5, 15.5);
        return cv;
    }

    // ── Brush shapes ─────────────────────────────────────────────────────

    _buildBrushes() {
        const grid = document.getElementById('brushGrid');
        BRUSH_SHAPES.forEach((pixels, idx) => {
            const cv = document.createElement('canvas');
            cv.width = 28; cv.height = 28;
            cv.className = 'brush-swatch';
            if (idx === this.state.brushShapeIdx) cv.classList.add('active');
            const ctx = cv.getContext('2d');
            this._drawBrushPreview(ctx, 14, 14, pixels);
            cv.addEventListener('click', () => {
                this.state.selectBrush(idx);
                grid.querySelectorAll('.brush-swatch').forEach((s, i) =>
                    s.classList.toggle('active', i === idx));
            });
            grid.appendChild(cv);
        });
    }

    _drawBrushPreview(ctx, cx, cy, pixels) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 28, 28);
        ctx.fillStyle = 'black';
        for (const [dx, dy] of pixels) {
            ctx.fillRect(cx + dx, cy + dy, 1, 1);
        }
    }

    // ── Line widths ──────────────────────────────────────────────────────

    _buildLineWidths() {
        const grid = document.getElementById('lineGrid');
        LINE_WIDTHS.forEach(w => {
            const cv = document.createElement('canvas');
            cv.width = 52; cv.height = 14;
            cv.className = 'line-swatch';
            if (w === this.state.lineWidth) cv.classList.add('active');
            const ctx = cv.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 52, 14);
            ctx.strokeStyle = 'black';
            ctx.lineWidth = w;
            ctx.lineCap   = 'butt';
            ctx.beginPath();
            ctx.moveTo(4, 7); ctx.lineTo(48, 7);
            ctx.stroke();
            cv.addEventListener('click', () => {
                this.state.lineWidth = w;
                grid.querySelectorAll('.line-swatch').forEach((s, i) =>
                    s.classList.toggle('active', LINE_WIDTHS[i] === w));
            });
            grid.appendChild(cv);
        });
    }

    // ── Keyboard shortcuts ───────────────────────────────────────────────

    _attachKeyboard() {
        const map = {
            's': 'select', 'p': 'pencil', 'b': 'brush',
            'y': 'spray',  'e': 'eraser', 'f': 'fill',
            't': 'text',   'l': 'line',
        };
        document.addEventListener('keydown', ev => {
            if (ev.target !== document.body && ev.target.tagName !== 'CANVAS') return;
            if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
            const id = map[ev.key.toLowerCase()];
            if (id) this._select(id);
        });
    }

    sync() {
        this._buttons.forEach((btn, key) =>
            btn.classList.toggle('active', key === this.state.activeTool));
    }
}
