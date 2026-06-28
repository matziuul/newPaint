// Brush shape pixel offsets from (0,0).  Each entry is an array of [dx,dy] pairs.
function circle(r) {
    const pts = [];
    for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++)
            if (dx * dx + dy * dy <= r * r + 0.5) pts.push([dx, dy]);
    return pts;
}
function square(half) {
    const pts = [];
    for (let dy = -half; dy <= half; dy++)
        for (let dx = -half; dx <= half; dx++)
            pts.push([dx, dy]);
    return pts;
}

export const BRUSH_SHAPES = [
    circle(0),    // 0  round 1px
    circle(1),    // 1  round 3px
    circle(2),    // 2  round 5px
    circle(4),    // 3  round 9px
    square(1),    // 4  square 3×3
    square(2),    // 5  square 5×5
    square(4),    // 6  square 9×9
    // horizontal bar
    [[-3,0],[-2,0],[-1,0],[0,0],[1,0],[2,0],[3,0]],       // 7
    // vertical bar
    [[0,-3],[0,-2],[0,-1],[0,0],[0,1],[0,2],[0,3]],         // 8
    // diagonal \ (thin)
    [[-2,2],[-1,1],[0,0],[1,-1],[2,-2]],                    // 9
    // diagonal / (thin)
    [[-2,-2],[-1,-1],[0,0],[1,1],[2,2]],                    // 10
    // calligraphic (wide NW-SE line)
    [[-2,1],[-1,1],[0,1],[-1,0],[0,0],[1,0],[0,-1],[1,-1],[2,-1]], // 11
];

// Eraser is always a 16×16 square — not user-selectable (authentic MacPaint).
export const ERASER_PIXELS = square(8);

export class AppState {
    constructor() {
        this.activeTool     = 'pencil';
        this.activePattern  = 8;     // index into QD_PATTERNS (8 = black)
        this.brushShapeIdx  = 1;     // index into BRUSH_SHAPES
        this.lineWidth      = 1;     // for shape outlines
        this.roundRadius    = 12;    // for rounded rectangles

        // Active selection state
        this.selection = null;       // { x, y, w, h } clipped to canvas, or null
        this.floatData = null;       // ImageData of lifted selection pixels
        this.floatX    = 0;
        this.floatY    = 0;
        this.isFloating = false;

        // Foreground / background colors
        this.fgColor = '#000000';
        this.bgColor = '#ffffff';

        // Text tool state
        this.textX     = 0;
        this.textY     = 0;
        this.textBuf   = '';
        this.textActive = false;
        this.textFont  = 'Geneva, Arial, sans-serif';
        this.textSize  = 24;
        this.textStyle = 'normal';   // 'normal' | 'bold' | 'italic'

        // Internal: current brush pixels (derived)
        this._brushPixels = null;
    }

    get brushPixels() {
        if (!this._brushPixels) this._brushPixels = BRUSH_SHAPES[this.brushShapeIdx];
        return this._brushPixels;
    }

    selectBrush(idx) {
        this.brushShapeIdx = idx;
        this._brushPixels = null;
    }
}
