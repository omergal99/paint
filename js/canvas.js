export class CanvasRenderer {
  constructor(canvas, { maxPixels = 268000000 } = {}) {
    this.canvas = canvas;
    this.maxPixels = maxPixels;
    this.buffer = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(1, 1) : document.createElement('canvas');
    this.pending = [];
    this.frameRequested = false;
    this.resize(canvas.width || 1, canvas.height || 1);
  }

  get context() {
    return this.buffer.getContext('2d', { alpha: true, willReadFrequently: false });
  }

  getSafeSize(width, height) {
    const requestedPixels = Math.max(1, width * height);
    if (requestedPixels <= this.maxPixels) return { width, height };
    const scale = Math.sqrt(this.maxPixels / requestedPixels);
    return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
  }

  resize(width, height) {
    const size = this.getSafeSize(Math.round(width), Math.round(height));
    const previous = document.createElement('canvas');
    previous.width = this.buffer.width;
    previous.height = this.buffer.height;
    previous.getContext('2d').drawImage(this.buffer, 0, 0);
    this.buffer.width = size.width;
    this.buffer.height = size.height;
    this.canvas.width = size.width;
    this.canvas.height = size.height;
    this.context.drawImage(previous, 0, 0);
    return size;
  }

  enqueue(drawOperation) {
    this.pending.push(drawOperation);
    if (this.frameRequested) return;
    this.frameRequested = true;
    requestAnimationFrame(() => {
      this.frameRequested = false;
      const context = this.context;
      for (const operation of this.pending.splice(0)) operation(context);
      this.canvas.getContext('2d').clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.canvas.getContext('2d').drawImage(this.buffer, 0, 0);
    });
  }

  copyFrom(source) {
    this.buffer.width = source.width;
    this.buffer.height = source.height;
    this.context.drawImage(source, 0, 0);
    this.canvas.width = source.width;
    this.canvas.height = source.height;
    this.canvas.getContext('2d').drawImage(this.buffer, 0, 0);
  }
}
