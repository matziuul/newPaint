import { describe, it, expect, beforeEach } from 'vitest';
import { History } from '../history.js';

// Minimal canvas-context mock: getImageData returns a token object that
// putImageData records, so we can assert which snapshot was restored.
function makeCtx(label) {
    const ctx = {
        _current: { label },
        restored: [],
        getImageData() { return { label: this._current.label }; },
        putImageData(snap) { this._current = snap; this.restored.push(snap.label); },
        set(label) { this._current = { label }; },
    };
    return ctx;
}

describe('History', () => {
    let h, ctx;

    beforeEach(() => {
        h   = new History();
        ctx = makeCtx('initial');
    });

    it('starts with nothing to undo or redo', () => {
        expect(h.canUndo()).toBe(false);
        expect(h.canRedo()).toBe(false);
    });

    it('cannot undo after a single save (nothing to go back to)', () => {
        h.save(ctx, 1, 1);
        expect(h.canUndo()).toBe(false);
        expect(h.canRedo()).toBe(false);
    });

    it('can undo after two saves', () => {
        h.save(ctx, 1, 1);
        ctx.set('second');
        h.save(ctx, 1, 1);
        expect(h.canUndo()).toBe(true);
        expect(h.canRedo()).toBe(false);
    });

    it('undo restores the previous snapshot', () => {
        h.save(ctx, 1, 1);        // saves 'initial'
        ctx.set('second');
        h.save(ctx, 1, 1);        // saves 'second'
        h.undo(ctx);
        expect(ctx._current.label).toBe('initial');
    });

    it('redo restores the next snapshot', () => {
        h.save(ctx, 1, 1);
        ctx.set('second');
        h.save(ctx, 1, 1);
        h.undo(ctx);
        h.redo(ctx);
        expect(ctx._current.label).toBe('second');
    });

    it('undo returns false at the bottom of the stack', () => {
        h.save(ctx, 1, 1);
        expect(h.undo(ctx)).toBe(false);
    });

    it('redo returns false at the top of the stack', () => {
        h.save(ctx, 1, 1);
        ctx.set('second');
        h.save(ctx, 1, 1);
        expect(h.redo(ctx)).toBe(false);
    });

    it('saving after undo discards the redo branch', () => {
        h.save(ctx, 1, 1);        // snap 0: 'initial'
        ctx.set('second');
        h.save(ctx, 1, 1);        // snap 1: 'second'
        h.undo(ctx);              // back to snap 0
        ctx.set('branch');
        h.save(ctx, 1, 1);        // snap 1 replaced: 'branch'
        expect(h.canRedo()).toBe(false);
        h.undo(ctx);
        expect(ctx._current.label).toBe('initial');
    });

    it('caps the stack at 30 undos (31 total snapshots)', () => {
        for (let i = 0; i <= 35; i++) {
            ctx.set(`frame${i}`);
            h.save(ctx, 1, 1);
        }
        // oldest frames should have been dropped; we can still undo 30 times
        let undos = 0;
        while (h.undo(ctx)) undos++;
        expect(undos).toBe(30);
    });
});
