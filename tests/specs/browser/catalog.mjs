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
    id: 'selection-select',
    name: 'Rectangular selection displays the expected canvas region',
    spec: 'desktop',
    device: 'Desktop',
    viewport: Object.freeze({ width: 1280, height: 800 }),
    file: path.join(root, 'tests/specs/browser/selection-select.browser.mjs'),
  }),
  Object.freeze({
    id: 'selection-deselect',
    name: 'Deselect clears selection and restores the previous tool',
    spec: 'desktop',
    device: 'Desktop',
    viewport: Object.freeze({ width: 1280, height: 800 }),
    file: path.join(root, 'tests/specs/browser/selection-deselect.browser.mjs'),
  }),
  Object.freeze({
    id: 'canvas-resize',
    name: 'Canvas resize updates dimensions and supports undo and redo',
    spec: 'desktop',
    device: 'Desktop',
    viewport: Object.freeze({ width: 1280, height: 800 }),
    file: path.join(root, 'tests/specs/browser/canvas-resize.browser.mjs'),
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
