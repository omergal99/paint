// Safe text-object focus affordance. The committed pixels remain untouched;
// this layer only exposes the metadata bounds as keyboard/mouse targets.

const labelFor = (object) => {
  const text = String(object.text || '').replace(/\s+/g, ' ').trim();
  return text ? `Focus text: ${text.slice(0, 60)}` : 'Focus text object';
};

export const createTextSelectionOverlay = ({ root, store }) => {
  const layer = document.createElement('div');
  layer.className = 'text-object-focus-layer';
  layer.setAttribute('aria-label', 'Committed text objects');
  root?.appendChild(layer);

  let selectedId = null;

  const select = (id) => {
    const object = store?.getAll().find((item) => item.id === id);
    if (!object) return null;
    selectedId = id;
    render(store.getAll());
    layer.dispatchEvent(new CustomEvent('paint:text-object-focus', { detail: object }));
    return object;
  };

  const render = (objects = []) => {
    layer.replaceChildren();
    objects.forEach((object) => {
      const target = document.createElement('button');
      target.type = 'button';
      target.className = 'text-object-focus-target';
      target.dataset.textObjectId = object.id;
      target.setAttribute('aria-label', labelFor(object));
      target.title = 'Focus text object (editing is not enabled yet)';
      target.classList.toggle('selected', object.id === selectedId);
      target.style.left = `${object.x}px`;
      target.style.top = `${object.y}px`;
      target.style.width = `${Math.max(4, object.width)}px`;
      target.style.height = `${Math.max(4, object.height)}px`;
      target.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        select(object.id);
      });
      layer.appendChild(target);
    });
  };

  const unsubscribe = store?.subscribe(render) || (() => {});
  render(store?.getAll?.() || []);

  return Object.freeze({
    element: layer,
    select,
    clear() {
      selectedId = null;
      render(store?.getAll?.() || []);
    },
    getSelectedId: () => selectedId,
    destroy() {
      unsubscribe();
      layer.remove();
    },
  });
};
