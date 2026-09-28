const formatBrowserName = (navigatorRef, unavailable) => {
  const brands = navigatorRef.userAgentData?.brands;
  const browser = Array.isArray(brands)
    ? brands.find(({ brand }) => !/not.?a.?brand/i.test(brand))
    : null;
  if (browser?.brand) return `${browser.brand} ${browser.version || ''}`.trim();
  const userAgent = navigatorRef.userAgent || '';
  const match = userAgent.match(/(Edg|OPR|Firefox|Chrome|Version)\/([\d.]+)/);
  if (match) return `${match[1] === 'Edg' ? 'Edge' : match[1] === 'OPR' ? 'Opera' : match[1] === 'Version' ? 'Safari' : match[1]} ${match[2]}`;
  return userAgent || unavailable;
};

export const readBrowserInfo = ({
  navigatorRef = globalThis.navigator || {},
  screenRef = globalThis.screen || {},
  windowRef = globalThis.window || {},
  translate = (key) => key,
} = {}) => {
  const unavailable = translate('ui.browserValueUnavailable');
  const width = Number(screenRef.width);
  const height = Number(screenRef.height);
  const viewportWidth = Number(windowRef.innerWidth);
  const viewportHeight = Number(windowRef.innerHeight);
  const cores = Number(navigatorRef.hardwareConcurrency);
  const memory = Number(navigatorRef.deviceMemory);
  const pixelRatio = Number(windowRef.devicePixelRatio);
  const languages = Array.isArray(navigatorRef.languages) && navigatorRef.languages.length
    ? navigatorRef.languages.join(', ')
    : navigatorRef.language || unavailable;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || unavailable;
  const system = navigatorRef.userAgentData?.platform || navigatorRef.platform || unavailable;
  const device = navigatorRef.userAgentData?.mobile === true ? translate('ui.browserMobile')
    : navigatorRef.userAgentData?.mobile === false ? translate('ui.browserDesktop')
      : (Number(navigatorRef.maxTouchPoints) > 0 ? translate('ui.browserTouchCapable') : unavailable);

  return Object.freeze({
    browser: formatBrowserName(navigatorRef, unavailable),
    system,
    device,
    display: Number.isFinite(width) && Number.isFinite(height)
      ? `${width} × ${height} · ${Number.isFinite(viewportWidth) && Number.isFinite(viewportHeight) ? `${viewportWidth} × ${viewportHeight}` : unavailable}`
      : unavailable,
    capacity: `${Number.isFinite(cores) && cores > 0 ? `${cores} ${translate('ui.browserCores')}` : unavailable} · ${Number.isFinite(memory) && memory > 0 ? `~${memory} ${translate('ui.browserGigabytes')}` : unavailable}`,
    languageZone: `${languages} · ${timeZone}`,
    pixelRatio: Number.isFinite(pixelRatio) && pixelRatio > 0 ? String(pixelRatio) : unavailable,
    online: navigatorRef.onLine === true ? translate('ui.browserOnline') : navigatorRef.onLine === false ? translate('ui.browserOffline') : unavailable,
    userAgent: navigatorRef.userAgent || unavailable,
  });
};

export const createBrowserInfoPanel = ({
  list,
  locationButton,
  locationStatus,
  navigatorRef = globalThis.navigator || {},
  screenRef = globalThis.screen || {},
  windowRef = globalThis.window || {},
  translate = (key) => key,
} = {}) => {
  const fields = Object.fromEntries([...(list?.querySelectorAll('[data-browser-info]') || [])]
    .map((field) => [field.dataset.browserInfo, field]));
  let active = false;
  let disposed = false;
  let battery = null;
  let pointerFrame = null;
  let latestPointer = null;
  let locationMessage = { key: 'ui.browserLocationOff', variables: {} };

  const setField = (name, value) => {
    if (fields[name]) fields[name].textContent = value;
  };
  const setLocationMessage = (key, variables = {}) => {
    locationMessage = { key, variables };
    if (locationStatus) locationStatus.textContent = translate(key, variables);
  };
  const updateInfo = () => {
    const info = readBrowserInfo({ navigatorRef, screenRef, windowRef, translate });
    Object.entries(info).forEach(([name, value]) => setField(name, value));
    setField('battery', battery && Number.isFinite(Number(battery.level))
      ? `${Math.round(battery.level * 100)}%${battery.charging ? ` · ${translate('ui.browserCharging')}` : ''}`
      : translate('ui.browserValueUnavailable'));
    if (fields.pointer) setField('pointer', latestPointer || translate('ui.browserPointerIdle'));
    setLocationMessage(locationMessage.key, locationMessage.variables);
  };
  const onBatteryChange = () => updateInfo();
  const attachBattery = async () => {
    if (typeof navigatorRef.getBattery !== 'function') return;
    try {
      const nextBattery = await navigatorRef.getBattery();
      if (!active || disposed) return;
      battery = nextBattery;
      battery.addEventListener('levelchange', onBatteryChange);
      battery.addEventListener('chargingchange', onBatteryChange);
      updateInfo();
    } catch {
      setField('battery', translate('ui.browserValueUnavailable'));
    }
  };
  const onPointerMove = (event) => {
    latestPointer = `${Math.round(event.clientX)}, ${Math.round(event.clientY)}`;
    if (pointerFrame !== null) return;
    const requestFrame = windowRef.requestAnimationFrame
      ? windowRef.requestAnimationFrame.bind(windowRef)
      : (callback) => windowRef.setTimeout(callback, 16);
    pointerFrame = requestFrame(() => {
      pointerFrame = null;
      if (active && !disposed && latestPointer) setField('pointer', latestPointer);
    });
  };
  const onViewportChange = () => updateInfo();
  const onOnlineChange = () => updateInfo();
  const onLocationClick = () => {
    if (!locationStatus) return;
    if (!navigatorRef.geolocation?.getCurrentPosition) {
      setLocationMessage('ui.browserLocationUnavailable');
      return;
    }
    setLocationMessage('ui.browserLocationRequest');
    try {
      navigatorRef.geolocation.getCurrentPosition(
        ({ coords }) => {
          if (disposed) return;
          setLocationMessage('ui.browserCoordinates', {
            latitude: coords.latitude.toFixed(4),
            longitude: coords.longitude.toFixed(4),
            accuracy: Math.round(coords.accuracy),
          });
        },
        (error) => {
          if (disposed) return;
          setLocationMessage(error?.code === 1 ? 'ui.browserLocationDenied' : 'ui.browserLocationError');
        },
        { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 },
      );
    } catch {
      setLocationMessage('ui.browserLocationError');
    }
  };

  const activate = () => {
    if (disposed) return;
    if (active) {
      updateInfo();
      return;
    }
    active = true;
    updateInfo();
    windowRef.addEventListener('pointermove', onPointerMove, { passive: true });
    windowRef.addEventListener('resize', onViewportChange, { passive: true });
    windowRef.addEventListener('online', onOnlineChange);
    windowRef.addEventListener('offline', onOnlineChange);
    void attachBattery();
  };
  const deactivate = () => {
    if (!active) return;
    active = false;
    windowRef.removeEventListener('pointermove', onPointerMove);
    windowRef.removeEventListener('resize', onViewportChange);
    windowRef.removeEventListener('online', onOnlineChange);
    windowRef.removeEventListener('offline', onOnlineChange);
    if (pointerFrame !== null) {
      if (windowRef.cancelAnimationFrame) windowRef.cancelAnimationFrame(pointerFrame);
      else windowRef.clearTimeout(pointerFrame);
      pointerFrame = null;
    }
    battery?.removeEventListener('levelchange', onBatteryChange);
    battery?.removeEventListener('chargingchange', onBatteryChange);
    battery = null;
    latestPointer = null;
  };
  const destroy = () => {
    if (disposed) return;
    deactivate();
    disposed = true;
    locationButton?.removeEventListener('click', onLocationClick);
  };

  locationButton?.addEventListener('click', onLocationClick);
  updateInfo();
  return Object.freeze({ activate, deactivate, refresh: updateInfo, destroy });
};
