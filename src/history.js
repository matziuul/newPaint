const MAX_UNDO = 30;

export class History {
    constructor() {
        this._stack = [];
        this._pos   = -1;
    }

    // Call before any destructive operation.
    save(ctx, W, H) {
        // Trim redo tail
        this._stack.length = this._pos + 1;
        this._stack.push(ctx.getImageData(0, 0, W, H));
        if (this._stack.length > MAX_UNDO + 1) this._stack.shift();
        this._pos = this._stack.length - 1;
    }

    undo(ctx) {
        if (this._pos <= 0) return false;
        this._pos--;
        ctx.putImageData(this._stack[this._pos], 0, 0);
        return true;
    }

    redo(ctx) {
        if (this._pos >= this._stack.length - 1) return false;
        this._pos++;
        ctx.putImageData(this._stack[this._pos], 0, 0);
        return true;
    }

    canUndo() { return this._pos > 0; }
    canRedo() { return this._pos < this._stack.length - 1; }
}
