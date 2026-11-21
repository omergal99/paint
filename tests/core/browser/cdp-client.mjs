import { DEFAULT_TEST_CONFIG } from '../../config/test-config.mjs';

const asText = async (data) => {
  if (typeof data === 'string') return data;
  if (typeof data?.text === 'function') return data.text();
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  if (ArrayBuffer.isView(data)) {
    return new TextDecoder().decode(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  }
  throw new Error('Unsupported Chrome DevTools Protocol message payload.');
};

export const connectCdp = async ({
  url,
  timeoutMs = DEFAULT_TEST_CONFIG.browserCommandTimeoutMs,
  closeTimeoutMs = DEFAULT_TEST_CONFIG.browserCloseTimeoutMs,
} = {}) => {
  if (typeof WebSocket !== 'function') {
    throw new Error('This Node.js runtime does not provide the built-in WebSocket API.');
  }
  const socket = new WebSocket(url);
  const pending = new Map();
  const listeners = new Map();
  let nextId = 0;
  let closed = false;

  const rejectPending = (error) => {
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    pending.clear();
  };

  const opened = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`Timed out connecting to Chrome DevTools at ${url}.`));
    }, timeoutMs);

    socket.addEventListener('open', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
    socket.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error(`Could not connect to Chrome DevTools at ${url}.`));
    }, { once: true });
    socket.addEventListener('close', () => {
      clearTimeout(timer);
      reject(new Error(`Chrome DevTools closed before connecting to ${url}.`));
    }, { once: true });
  });

  socket.addEventListener('message', async (event) => {
    let message;
    try {
      message = JSON.parse(await asText(event.data));
    } catch (error) {
      rejectPending(new Error(`Invalid Chrome DevTools response: ${error.message}`));
      return;
    }

    if (Number.isInteger(message.id)) {
      const request = pending.get(message.id);
      if (!request) return;
      clearTimeout(request.timer);
      pending.delete(message.id);
      if (message.error) {
        request.reject(new Error(`CDP ${request.method} failed (${message.error.code}): ${message.error.message}`));
      } else {
        request.resolve(message.result || {});
      }
      return;
    }

    for (const listener of listeners.get(message.method) || []) {
      listener(message.params || {});
    }
  });

  socket.addEventListener('close', () => {
    closed = true;
    rejectPending(new Error('Chrome DevTools connection closed.'));
  });

  await opened;

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    if (closed || socket.readyState !== WebSocket.OPEN) {
      reject(new Error(`Cannot send CDP ${method}: the connection is closed.`));
      return;
    }
    const id = ++nextId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP ${method} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
    pending.set(id, { method, resolve, reject, timer });
    try {
      socket.send(JSON.stringify({ id, method, params }));
    } catch (error) {
      clearTimeout(timer);
      pending.delete(id);
      reject(new Error(`Could not send CDP ${method}: ${error.message}`));
    }
  });

  const on = (method, listener) => {
    const methodListeners = listeners.get(method) || new Set();
    methodListeners.add(listener);
    listeners.set(method, methodListeners);
    return () => {
      methodListeners.delete(listener);
      if (methodListeners.size === 0) listeners.delete(method);
    };
  };

  const close = async () => {
    if (socket.readyState === WebSocket.CLOSED) return;
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, closeTimeoutMs);
      socket.addEventListener('close', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      socket.close(1000, 'Local test complete');
    });
  };

  return Object.freeze({ send, on, close });
};
