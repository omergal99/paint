# Step 02 - Contracts and SSOT

## Goal

Give settings, events, storage keys, limits, and document state one owner.

## Tasks

- Add constants and EventBus contracts with teardown.
- Add SettingsStore defaults, validation, and migrations.
- Define the future PaintDocument/TextObject/HistoryEntry shapes in JSDoc.
- Document compatibility with existing localStorage/IndexedDB keys.

## Done when

Later steps can add a setting or event without duplicating a string/default in
`main.js`, `Sidebar.js`, or a UI component.

