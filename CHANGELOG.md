# Changelog

## Unreleased

- The accessory picker groups accessories by the rooms set up on the Homebridge UI's Accessories page, using `homebridge.getAccessoryLayout()` from plugin-ui-utils 2.2.8. Older Homebridge UIs still group by type.

## 0.1.0

- First release as a standalone plugin, moved from the `alpha-6.0.1` branch of homebridge-config-ui-x.
- Fix: a disabled humidity rule could still run, and a disabled security system could still be armed.
- Fix: accessories on a child bridge with its own PIN could not be read or controlled.
- Fix: the UI's `accessoryControl` settings, such as `instanceBlacklist`, were ignored.
