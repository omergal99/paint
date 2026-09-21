.DEFAULT_GOAL := help

.PHONY: help setup dev serve preview build test typecheck i18n check audit

help:
	@printf '%s\n' 'Paint commands:' \
	  '  make setup      Install the locked development tools (first checkout)' \
	  '  make dev        Install tools if needed, then start the source app' \
	  '  make serve      Start source mode at http://127.0.0.1:4173/' \
	  '  make build      Create the production dist/ bundle' \
	  '  make preview    Build, then serve dist/ at http://127.0.0.1:4174/' \
	  '  make test       Run the automated test suite' \
	  '  make typecheck  Run the dev-only TypeScript checker' \
	  '  make i18n        Check locale catalogs and translation references' \
	  '  make check      Run release verification and type checking' \
	  '  make audit      Verify runtime/storage contracts (no artifact is written)' \
	  '  npm run audit:snapshot  Intentionally refresh the historical JSON snapshot'

setup:
	npm ci

dev:
	@if [ ! -x node_modules/.bin/esbuild ]; then $(MAKE) setup; fi
	npm run serve

serve:
	npm run serve

build:
	npm run build

preview: build
	npm run preview

test:
	npm test

typecheck:
	npm run typecheck

i18n:
	npm run check:i18n

check:
	npm run verify:release
	npm run typecheck
	npm run check:i18n

audit:
	npm run audit:runtime
