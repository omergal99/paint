import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../../..');

export const BROWSER_SPECS = Object.freeze([
  Object.freeze({
    id: 'brush-desktop',
    name: 'Desktop app loads and Brush changes canvas pixels',
    spec: 'desktop',
    device: 'Desktop',
    viewport: Object.freeze({ width: 1280, height: 800 }),
    file: path.join(root, 'tests/specs/browser/desktop.browser.mjs'),
  }),
  Object.freeze({
    id: 'clipboard-text-paste',
    name: 'Browser clipboard text paste opens Paint text editor',
    spec: 'desktop',
    device: 'Desktop',
    viewport: Object.freeze({ width: 1280, height: 800 }),
    file: path.join(root, 'tests/specs/browser/clipboard.browser.mjs'),
  }),
  Object.freeze({
    id: 'brush-mobile',
    name: 'Mobile viewport receives touch input and paints canvas pixels',
    spec: 'mobile',
    device: 'Mobile emulation',
    viewport: Object.freeze({ width: 390, height: 844 }),
    file: path.join(root, 'tests/specs/browser/mobile.browser.mjs'),
  }),
]);
