# Paint Online Playwright CLI commands

Set `PWCLI` as described in the parent skill.

## Core

```bash
pwcli open http://127.0.0.1:4173/
pwcli close
pwcli snapshot
pwcli click e3
pwcli dblclick e7
pwcli press Escape
pwcli fill e5 "100"
pwcli check e12
pwcli uncheck e12
pwcli hover e4
pwcli resize 320 720
pwcli screenshot output/playwright/shot.png
```
## Canvas/pointer checks

```bash
pwcli mousemove 150 300
pwcli mousedown
pwcli mouseup
pwcli mousewheel 0 100
pwcli mousedown right
pwcli mouseup right
```

Use screenshots and traces for visual/performance evidence rather than trying
to assert canvas pixels through a generic DOM selector.

## Inspection

```bash
pwcli eval "document.title"
pwcli eval "el => el.textContent" e5
pwcli console warning
pwcli network
pwcli tracing-start
pwcli tracing-stop
```

## Session isolation

```bash
pwcli --session paint-phase2 open http://127.0.0.1:4173/
pwcli --session paint-phase2 snapshot
```
