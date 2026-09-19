// DeterministicCommandService.js
// Small, provider-neutral command layer for safe app actions. It intentionally
// has no model/network dependency: the same commands power quick-action
// buttons and recognizable chat phrases.

const normalize = (value) => String(value || '').trim().toLowerCase();

const createCommandDefinitions = (actions) => {
  return [
    {
      id: 'theme-dark',
      label: 'Dark mode',
      command: '/dark',
      matches: (text) => /^\/(?:dark|dark-mode)$/.test(text) || /\b(?:dark mode|dark theme)\b/.test(text),
      run: () => {
        actions.setTheme?.('dark');
        return 'Dark mode enabled.';
      },
    },
    {
      id: 'theme-light',
      label: 'Light mode',
      command: '/light',
      matches: (text) => /^\/(?:light|light-mode)$/.test(text) || /\b(?:light mode|light theme)\b/.test(text),
      run: () => {
        actions.setTheme?.('light');
        return 'Light mode enabled.';
      },
    },
    {
      id: 'background-solid',
      label: 'Solid canvas',
      command: '/solid',
      matches: (text) => /^\/(?:solid|plain)$/.test(text) || /\bsolid canvas\b/.test(text),
      run: () => {
        actions.setCanvasBackground?.('none');
        return 'Canvas background set to solid.';
      },
    },
    {
      id: 'background-checkerboard',
      label: 'Checkerboard',
      command: '/checkerboard',
      matches: (text) => /^\/(?:checkerboard|transparent)$/.test(text) || /\b(?:checkerboard|transparent canvas)\b/.test(text),
      run: () => {
        actions.setCanvasBackground?.('checkerboard');
        return 'Transparent checkerboard enabled.';
      },
    },
    {
      id: 'background-grid',
      label: 'Gridlines',
      command: '/grid',
      matches: (text) => /^\/grid$/.test(text) || /\bgridlines?\b/.test(text),
      run: () => {
        actions.setCanvasBackground?.('grid');
        return 'Canvas gridlines enabled.';
      },
    },
    {
      id: 'zoom',
      label: 'Zoom 100%',
      command: '/zoom 100',
      matches: (text) => /^\/zoom\s+(\d{2,3})%?$/.test(text) || /^zoom\s+(\d{2,3})%?$/.test(text),
      run: (text) => {
        const value = Number(text.match(/(?:zoom\s+|\/zoom\s+)(\d{2,3})%?$/)?.[1]);
        if (!Number.isFinite(value)) return 'Use a zoom between 10 and 800 percent.';
        actions.setZoom?.(value);
        return `Zoom set to ${Math.min(800, Math.max(10, Math.round(value)))}%.`;
      },
    },
    {
      id: 'flip-horizontal',
      label: 'Flip horizontal',
      command: '/flip horizontal',
      matches: (text) => /^\/flip\s+h(?:orizontal)?$/.test(text) || /\bflip\s+horizontal\b/.test(text),
      run: () => {
        actions.flip?.('horizontal');
        return 'Image flipped horizontally.';
      },
    },
    {
      id: 'flip-vertical',
      label: 'Flip vertical',
      command: '/flip vertical',
      matches: (text) => /^\/flip\s+v(?:ertical)?$/.test(text) || /\bflip\s+vertical\b/.test(text),
      run: () => {
        actions.flip?.('vertical');
        return 'Image flipped vertically.';
      },
    },
    {
      id: 'rotate-90',
      label: 'Rotate 90°',
      command: '/rotate 90',
      matches: (text) => /^\/rotate\s+90$/.test(text) || /\brotate\s+(?:the\s+)?image\s+90\b/.test(text),
      run: () => {
        actions.rotate?.(90);
        return 'Image rotated 90 degrees.';
      },
    },
    {
      id: 'save-history',
      label: 'Save to history',
      command: '/save',
      matches: (text) => /^\/(?:save|history)$/.test(text) || /\bsave\s+(?:this\s+)?(?:image|current)\s+to\s+history\b/.test(text),
      run: async () => {
        await actions.saveToHistory?.();
        return 'Current image saved to history.';
      },
    },
    {
      id: 'image-context',
      label: 'Image info',
      command: '/image-info',
      matches: (text) => /^\/(?:image-info|context)$/.test(text) || /\b(?:image info|current image)\b/.test(text),
      run: () => actions.getImageContext?.() || 'Current image context is unavailable.',
    },
  ];
}

export const createDeterministicCommandService = (actions = {}) => {
  const commands = createCommandDefinitions(actions);

  return {
    getQuickActions() {
      return commands.map(({ id, label, command }) => ({ id, label, command }));
    },

    async execute(input) {
      const text = normalize(input);
      const command = commands.find((candidate) => candidate.matches(text));
      if (!command) {
        return {
          matched: false,
          reply: 'I can apply safe quick actions such as /dark, /light, /grid, /zoom 100, /flip horizontal, /rotate 90, and /save.',
        };
      }

      return {
        matched: true,
        commandId: command.id,
        reply: await command.run(text),
      };
    },
  };
}
