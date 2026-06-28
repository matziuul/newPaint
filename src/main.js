import { AppState }     from './state.js';
import { History }      from './history.js';
import { CanvasManager } from './canvas-mgr.js';
import { Toolbox }      from './toolbox.js';
import { createTool }   from './tools.js';
import { FatbitsView }  from './fatbits.js';
import { ColorWheel }   from './color-wheel.js';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const paperCanvas   = document.getElementById('paperCanvas');
const overlayCanvas = document.getElementById('overlayCanvas');
const fatbitsCanvas = document.getElementById('fatbitsCanvas');
const ovCtx         = overlayCanvas.getContext('2d');

// ── Core objects ──────────────────────────────────────────────────────────────
const state   = new AppState();
const cm      = new CanvasManager(paperCanvas);
const history = new History();
const fatbits = new FatbitsView(fatbitsCanvas, paperCanvas, history, state);

const toolbox = new Toolbox(state, _name => {
    activeTool.onDeactivate();
    activeTool = createTool(_name, state, cm, history, ovCtx);
});

new ColorWheel(document.getElementById('colorPanel'), (fg, bg) => {
    state.fgColor = fg;
    state.bgColor = bg;
    cm.setColors(fg, bg);
});

// ── Canvas resize ─────────────────────────────────────────────────────────────
function applyResize(w, h) {
    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));
    if (w === cm.W && h === cm.H) return;
    const saved = cm.ctx.getImageData(0, 0, cm.W, cm.H);
    paperCanvas.width    = w;
    paperCanvas.height   = h;
    overlayCanvas.width  = w;
    overlayCanvas.height = h;
    cm.W = w; cm.H = h;
    cm.ctx.imageSmoothingEnabled = false;
    cm.ctx.fillStyle = 'white';
    cm.ctx.fillRect(0, 0, w, h);
    cm.ctx.putImageData(saved, 0, 0);
    ovCtx.clearRect(0, 0, w, h);
}

// Set initial canvas size to fill available area (computed once at startup)
{
    const area     = document.getElementById('canvas-area').getBoundingClientRect();
    const titlebar = document.getElementById('doc-titlebar').getBoundingClientRect();
    const pad = 16, border = 4;
    const initW = Math.max(100, Math.round(area.width)  - pad * 2 - border);
    const initH = Math.max(100, Math.round(area.height) - pad * 2 - border - Math.round(titlebar.height) - 1);
    applyResize(initW, initH);
}

history.save(cm.ctx, cm.W, cm.H);
let activeTool = createTool(state.activeTool, state, cm, history, ovCtx);

// ── Coordinate helpers ────────────────────────────────────────────────────────
function canvasPos(e) {
    const r = paperCanvas.getBoundingClientRect();
    return {
        x: Math.floor((e.clientX - r.left) * paperCanvas.width  / r.width),
        y: Math.floor((e.clientY - r.top)  * paperCanvas.height / r.height),
    };
}

function fatbitsPos(e) {
    const r = fatbitsCanvas.getBoundingClientRect();
    return {
        x: Math.floor((e.clientX - r.left) * fatbitsCanvas.width  / r.width),
        y: Math.floor((e.clientY - r.top)  * fatbitsCanvas.height / r.height),
    };
}

// ── Main canvas events ────────────────────────────────────────────────────────
overlayCanvas.addEventListener('mousedown', e => {
    e.preventDefault();
    if (document.querySelector('.menu-drop.open')) { closeAllMenus(); return; }
    const { x, y } = canvasPos(e);
    // Shift+click pans the fatbits viewport without drawing
    if (e.shiftKey && fatbits.active) { fatbits.panTo(x, y); return; }
    activeTool.onDown(x, y, e);
});

overlayCanvas.addEventListener('mousemove', e => {
    const { x, y } = canvasPos(e);
    activeTool.onMove(x, y, e);
    document.getElementById('statusPos').textContent = `${x}, ${y}`;
});

overlayCanvas.addEventListener('mouseup', e => {
    const { x, y } = canvasPos(e);
    activeTool.onUp(x, y, e);
});

overlayCanvas.addEventListener('mouseleave', e => {
    const { x, y } = canvasPos(e);
    activeTool.onLeave(x, y, e);
    document.getElementById('statusPos').textContent = '';
});

// Double-click on main canvas toggles fatbits centred on that spot
overlayCanvas.addEventListener('dblclick', e => {
    e.preventDefault();
    const { x, y } = canvasPos(e);
    fatbits.toggle(x, y);
});

// Touch (main canvas)
overlayCanvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const { x, y } = canvasPos(e.touches[0]);
    activeTool.onDown(x, y, e.touches[0]);
}, { passive: false });
overlayCanvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const { x, y } = canvasPos(e.touches[0]);
    activeTool.onMove(x, y, e.touches[0]);
}, { passive: false });
overlayCanvas.addEventListener('touchend', e => {
    e.preventDefault();
    const { x, y } = canvasPos(e.changedTouches[0]);
    activeTool.onUp(x, y, e.changedTouches[0]);
}, { passive: false });

// ── Fatbits canvas events ─────────────────────────────────────────────────────
let _fbPan = null;  // { fx, fy, ox, oy } when shift-dragging to pan viewport

fatbitsCanvas.addEventListener('mousedown', e => {
    e.preventDefault();
    const { x, y } = fatbitsPos(e);
    if (e.shiftKey) {
        _fbPan = { fx: x, fy: y, ox: fatbits.originX, oy: fatbits.originY };
    } else {
        fatbits.onDown(x, y);
    }
});
fatbitsCanvas.addEventListener('mousemove', e => {
    const { x, y } = fatbitsPos(e);
    if (_fbPan) {
        const dx = ((x - _fbPan.fx) / fatbits.zoom) | 0;
        const dy = ((y - _fbPan.fy) / fatbits.zoom) | 0;
        fatbits.originX = _fbPan.ox - dx;
        fatbits.originY = _fbPan.oy - dy;
        fatbits._clamp();
        return;
    }
    fatbits.onMove(x, y);
    const p = fatbits.toPaper(x, y);
    document.getElementById('statusPos').textContent = `${p.x}, ${p.y} [fatbits]`;
});
fatbitsCanvas.addEventListener('mouseup', e => {
    if (_fbPan) { _fbPan = null; return; }
    fatbits.onUp();
});
fatbitsCanvas.addEventListener('mouseleave', () => {
    if (_fbPan) { _fbPan = null; return; }
    fatbits.onLeave();
    document.getElementById('statusPos').textContent = '';
});

// ── Fatbits panel controls ────────────────────────────────────────────────────
document.getElementById('fatbits-close').addEventListener('click', () => fatbits.close());
document.getElementById('fatbits-zoom-in').addEventListener('click',  () => fatbits.zoomIn());
document.getElementById('fatbits-zoom-out').addEventListener('click', () => fatbits.zoomOut());

// ── Fatbits panel drag (move the window) ─────────────────────────────────────
const fatbitsPanel    = document.getElementById('fatbits-panel');
const fatbitsTitlebar = document.getElementById('fatbits-titlebar');
let _fbWinDrag = null;  // { ox, oy } offset of mousedown inside panel

fatbitsTitlebar.addEventListener('mousedown', e => {
    if (e.target.closest('button, .doc-close')) return;
    e.preventDefault();
    const rect = fatbitsPanel.getBoundingClientRect();
    _fbWinDrag = { ox: e.clientX - rect.left, oy: e.clientY - rect.top };
});
document.addEventListener('mousemove', e => {
    if (!_fbWinDrag) return;
    fatbitsPanel.style.left  = (e.clientX - _fbWinDrag.ox) + 'px';
    fatbitsPanel.style.top   = (e.clientY - _fbWinDrag.oy) + 'px';
    fatbitsPanel.style.right = 'auto';
});
document.addEventListener('mouseup', () => { _fbWinDrag = null; });

// ── Keyboard events ───────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
    const cmd = e.metaKey || e.ctrlKey;

    if (cmd && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (history.undo(cm.ctx)) ovCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        return;
    }
    if (cmd && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (history.redo(cm.ctx)) ovCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        return;
    }
    if (cmd && e.key === 's') { e.preventDefault(); saveAsPNG(); return; }
    if (cmd && e.key === 'o') { e.preventDefault(); openImage(); return; }
    if (cmd && e.key === 'a') {
        e.preventDefault();
        activeTool.onDeactivate();
        activeTool = createTool('select', state, cm, history, ovCtx);
        toolbox.sync();
        state.activeTool = 'select';
        state.selection = { x: 0, y: 0, w: cm.W, h: cm.H };
        return;
    }

    activeTool.onKey(e);
});

// ── Menu bar ──────────────────────────────────────────────────────────────────
document.getElementById('menuNew').addEventListener('click', () => {
    if (!confirm('New document? This will erase your current drawing.')) return;
    cm.ctx.fillStyle = 'white';
    cm.ctx.fillRect(0, 0, cm.W, cm.H);
    history.save(cm.ctx, cm.W, cm.H);
    ovCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
});

function saveAsPNG() {
    ovCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    const link = document.createElement('a');
    link.download = 'newpaint.png';
    link.href     = paperCanvas.toDataURL('image/png');
    link.click();
}

function openImage() {
    document.getElementById('fileInput').click();
}

document.getElementById('menuSave').addEventListener('click', saveAsPNG);
document.getElementById('menuLoad').addEventListener('click', openImage);

document.getElementById('fileInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
        applyResize(img.naturalWidth, img.naturalHeight);
        cm.ctx.drawImage(img, 0, 0);
        history.save(cm.ctx, cm.W, cm.H);
        URL.revokeObjectURL(url);
    };
    img.src = url;
    e.target.value = '';
});

document.getElementById('menuCanvasSize').addEventListener('click', () => {
    const input = prompt('Canvas size (width x height):', `${cm.W} x ${cm.H}`);
    if (!input) return;
    const parts = input.trim().split(/[\s,x×]+/).map(Number);
    const w = parts[0], h = parts[1] || parts[0];
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) return;
    applyResize(w, h);
    history.save(cm.ctx, cm.W, cm.H);
});

document.getElementById('menuUndo').addEventListener('click', () => {
    if (history.undo(cm.ctx)) ovCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
});

document.getElementById('menuRedo').addEventListener('click', () => {
    if (history.redo(cm.ctx)) ovCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
});

document.getElementById('menuFatbits').addEventListener('click', () => {
    fatbits.toggle(Math.floor(cm.W / 2), Math.floor(cm.H / 2));
});

document.getElementById('menuSelectAll').addEventListener('click', () => {
    activeTool.onDeactivate();
    activeTool = createTool('select', state, cm, history, ovCtx);
    toolbox.sync();
    state.activeTool = 'select';
    state.selection = { x: 0, y: 0, w: cm.W, h: cm.H };
});

// ── Dropdown menu system ──────────────────────────────────────────────────────
function closeAllMenus() {
    document.querySelectorAll('.menu-drop.open').forEach(d => d.classList.remove('open'));
    document.querySelectorAll('.menu-title.open').forEach(t => t.classList.remove('open'));
}

document.querySelectorAll('.menu-wrap').forEach(wrap => {
    wrap.querySelector('.menu-title').addEventListener('click', e => {
        e.stopPropagation();
        const drop  = wrap.querySelector('.menu-drop');
        const title = wrap.querySelector('.menu-title');
        const wasOpen = drop.classList.contains('open');
        closeAllMenus();
        if (!wasOpen) { drop.classList.add('open'); title.classList.add('open'); }
    });
});

document.addEventListener('click', closeAllMenus);
document.querySelectorAll('.menu-drop-item').forEach(item => {
    item.addEventListener('click', closeAllMenus);
});

// ── Font menu ─────────────────────────────────────────────────────────────────
document.querySelectorAll('.font-item').forEach(item => {
    item.addEventListener('click', () => {
        state.textFont = item.dataset.font;
        document.querySelectorAll('.font-item').forEach(i => i.classList.remove('checked'));
        item.classList.add('checked');
    });
});

// ── Size menu ─────────────────────────────────────────────────────────────────
document.querySelectorAll('.size-item').forEach(item => {
    item.addEventListener('click', () => {
        state.textSize = parseInt(item.dataset.size, 10);
        document.querySelectorAll('.size-item').forEach(i => i.classList.remove('checked'));
        item.classList.add('checked');
    });
});

// ── Style menu ────────────────────────────────────────────────────────────────
document.querySelectorAll('.style-item').forEach(item => {
    item.addEventListener('click', () => {
        const s = item.dataset.style;
        if (s === 'normal') {
            state.textStyle = 'normal';
        } else {
            state.textStyle = state.textStyle === s ? 'normal' : s;
        }
        document.querySelectorAll('.style-item').forEach(i => i.classList.remove('checked'));
        document.querySelector(`.style-item[data-style="${state.textStyle}"]`)?.classList.add('checked');
    });
});

// ── Render / animation loop ───────────────────────────────────────────────────
let dashOff  = 0;
let lastTick = 0;

function frame(ts) {
    if (ts - lastTick > 80) { dashOff = (dashOff + 1) % 8; lastTick = ts; }

    // Clear overlay; each active tool and fatbits redraws what it needs
    ovCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    if (typeof activeTool.renderOverlay === 'function') activeTool.renderOverlay(dashOff);
    fatbits.renderIndicator(ovCtx, dashOff);  // viewport rect on main canvas
    fatbits.render();                          // the fatbits panel itself

    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
