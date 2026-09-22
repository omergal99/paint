const clone = (value) => {
  if (Array.isArray(value)) return value.map(clone);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, clone(child)]),
  );
};

const setPath = (target, path, value) => {
  const segments = path.split(".");
  let cursor = target;
  segments.slice(0, -1).forEach((segment) => {
    cursor[segment] ||= {};
    cursor = cursor[segment];
  });
  cursor[segments.at(-1)] = value;
};

// Catalogs are initialized from the reviewed English shape so adding a new
// key cannot silently break a locale. Each locale then overrides its reviewed
// translations; the checker still requires every ready catalog key to exist.
export const createCatalog = (english, translations) => {
  const catalog = clone(english);
  Object.entries(translations).forEach(([key, value]) =>
    setPath(catalog, key, value),
  );
  return Object.freeze(catalog);
};
