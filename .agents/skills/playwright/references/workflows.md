# Paint Online browser workflows

Run commands from `paint/` and store screenshots/traces under
`output/playwright/<label>/`.

## Baseline

```bash
pwcli --session baseline open http://127.0.0.1:4173/
pwcli --session baseline snapshot
pwcli --session baseline console warning
pwcli --session baseline screenshot output/playwright/baseline/cold-load.png
```

## Settings and menus

Snapshot before clicking Settings or a Ribbon menu. Snapshot again after the
dialog/menu opens, after switching tabs, and after closing it. Record focus and
visible selected state, not only whether a click succeeded.

## History and resize

Create at least two changes, open History and Session, verify newest/current-first
order, restore one item, export one item, and delete one item. Then check resize
with ratio lock, percentage input, and an active selection.

## Accessibility flow

Use only `press Tab`, `press Shift+Tab`, `press Enter`, `press Space`, and
`press Escape` for the ribbon, menus, settings, tabs, and history actions. Save a
screenshot of the focused state when it proves a finding.

## Performance trace

```bash
pwcli --session perf open http://127.0.0.1:4173/
pwcli --session perf tracing-start
# perform a short draw/zoom/history flow
pwcli --session perf tracing-stop
pwcli --session perf screenshot output/playwright/perf/after-trace.png
```

## Troubleshooting

- stale reference: snapshot again;
- page looks wrong: reopen headed and resize;
- state-dependent flow: use a named session and document its starting state;
- browser-only behavior: report it separately from `npm test`.
