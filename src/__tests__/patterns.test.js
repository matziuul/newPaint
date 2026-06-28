import { describe, it, expect } from 'vitest';
import { patternPixel } from '../patterns.js';

const WHITE = [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
const BLACK = [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF];
// 0xAA = 10101010, 0x55 = 01010101 — checkerboard
const CHECKER = [0xAA, 0x55, 0xAA, 0x55, 0xAA, 0x55, 0xAA, 0x55];
// 0xFF,0x00 alternating — horizontal lines every other row
const HLINES  = [0xFF, 0x00, 0xFF, 0x00, 0xFF, 0x00, 0xFF, 0x00];

describe('patternPixel', () => {
    it('white pattern is always off', () => {
        for (let y = 0; y < 8; y++)
            for (let x = 0; x < 8; x++)
                expect(patternPixel(WHITE, x, y)).toBe(false);
    });

    it('black pattern is always on', () => {
        for (let y = 0; y < 8; y++)
            for (let x = 0; x < 8; x++)
                expect(patternPixel(BLACK, x, y)).toBe(true);
    });

    it('checkerboard alternates by x and y', () => {
        // Row 0 (0xAA): even cols on, odd cols off
        expect(patternPixel(CHECKER, 0, 0)).toBe(true);
        expect(patternPixel(CHECKER, 1, 0)).toBe(false);
        expect(patternPixel(CHECKER, 6, 0)).toBe(true);
        expect(patternPixel(CHECKER, 7, 0)).toBe(false);
        // Row 1 (0x55): odd cols on, even cols off
        expect(patternPixel(CHECKER, 0, 1)).toBe(false);
        expect(patternPixel(CHECKER, 1, 1)).toBe(true);
    });

    it('horizontal lines: row 0 fully on, row 1 fully off', () => {
        for (let x = 0; x < 8; x++) {
            expect(patternPixel(HLINES, x, 0)).toBe(true);
            expect(patternPixel(HLINES, x, 1)).toBe(false);
        }
    });

    it('tiles: x wraps at 8', () => {
        for (let x = 0; x < 8; x++)
            for (let y = 0; y < 8; y++)
                expect(patternPixel(CHECKER, x + 8, y)).toBe(patternPixel(CHECKER, x, y));
    });

    it('tiles: y wraps at 8', () => {
        for (let x = 0; x < 8; x++)
            for (let y = 0; y < 8; y++)
                expect(patternPixel(CHECKER, x, y + 8)).toBe(patternPixel(CHECKER, x, y));
    });

    it('MSB of each row is pixel x=0', () => {
        const rows = [0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
        expect(patternPixel(rows, 0, 0)).toBe(true);
        expect(patternPixel(rows, 1, 0)).toBe(false);
        expect(patternPixel(rows, 0, 1)).toBe(false);
    });
});
