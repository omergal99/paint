// js/utils/transform.js

export function rotateCanvas(sourceCanvas, direction = 1) {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const out = document.createElement('canvas');
  out.width = h;
  out.height = w;
  const ctx = out.getContext('2d');
  
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate(direction * (Math.PI / 2));
  ctx.drawImage(sourceCanvas, -w / 2, -h / 2);
  
  return out;
}

export function flipCanvas(sourceCanvas, horizontal = true) {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  
  if (horizontal) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(0, h);
    ctx.scale(1, -1);
  }
  
  ctx.drawImage(sourceCanvas, 0, 0);
  return out;
}

export function rotateCanvasByAngle(sourceCanvas, degrees) {
  const radians = degrees * Math.PI / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.ceil(sourceCanvas.width * cos + sourceCanvas.height * sin));
  out.height = Math.max(1, Math.ceil(sourceCanvas.width * sin + sourceCanvas.height * cos));
  const ctx = out.getContext('2d');
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate(radians);
  ctx.drawImage(sourceCanvas, -sourceCanvas.width / 2, -sourceCanvas.height / 2);
  return out;
}

export function scaleCanvas(sourceCanvas, width, height) {
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(width));
  out.height = Math.max(1, Math.round(height));
  out.getContext('2d').drawImage(sourceCanvas, 0, 0, out.width, out.height);
  return out;
}

export function removeBackground(sourceCanvas, tolerance = 30) {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  ctx.drawImage(sourceCanvas, 0, 0);
  
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  
  // Sample top-left pixel as background color
  const bgR = data[0];
  const bgG = data[1];
  const bgB = data[2];
  const bgA = data[3];
  
  // Simple color-keying replacement
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    
    if (a > 0) {
      const diff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
      if (diff <= tolerance * 3) {
        data[i + 3] = 0; // Make transparent
      }
    }
  }
  
  ctx.putImageData(imgData, 0, 0);
  return out;
}
