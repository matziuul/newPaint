import { describe, it, expect } from 'vitest';
import { hexToRgb, rgbToHex } from '../color-wheel.js';

describe('hexToRgb', () => {
    it('parses black', () => expect(hexToRgb('#000000')).toEqual([0, 0, 0]));
    it('parses white', () => expect(hexToRgb('#ffffff')).toEqual([255, 255, 255]));
    it('parses red',   () => expect(hexToRgb('#ff0000')).toEqual([255, 0, 0]));
    it('parses green', () => expect(hexToRgb('#00ff00')).toEqual([0, 255, 0]));
    it('parses blue',  () => expect(hexToRgb('#0000ff')).toEqual([0, 0, 255]));
    it('parses arbitrary colour', () => expect(hexToRgb('#1a2b3c')).toEqual([26, 43, 60]));
    it('is case-insensitive', () => expect(hexToRgb('#FF8800')).toEqual([255, 136, 0]));
});

describe('rgbToHex', () => {
    it('formats black', () => expect(rgbToHex(0, 0, 0)).toBe('#000000'));
    it('formats white', () => expect(rgbToHex(255, 255, 255)).toBe('#ffffff'));
    it('formats red',   () => expect(rgbToHex(255, 0, 0)).toBe('#ff0000'));
    it('zero-pads single digits', () => expect(rgbToHex(0, 1, 15)).toBe('#00010f'));
});

describe('hexToRgb / rgbToHex round-trip', () => {
    const cases = ['#000000', '#ffffff', '#ff0000', '#1a2b3c', '#aabbcc'];
    cases.forEach(hex => {
        it(`round-trips ${hex}`, () => {
            const [r, g, b] = hexToRgb(hex);
            expect(rgbToHex(r, g, b)).toBe(hex);
        });
    });
});
