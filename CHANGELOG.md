# Changelog

## 0.1.1

- New Christmas Lights automation: a switch that, while on, runs a Christmas pattern (classic, candy cane, chase, warm twinkle, colour cycle or rainbow) across a row of colour lights such as soffit pot lights, then restores every light when turned off.
- Fix: the Create automation button did nothing when the Homebridge UI was opened over plain http on a LAN address, because `crypto.randomUUID` is only available on HTTPS or localhost.
- The accessory picker groups accessories by the rooms set up on the Homebridge UI's Accessories page, using `homebridge.getAccessoryLayout()` from plugin-ui-utils 2.2.8. Older Homebridge UIs still group by type.
- Door Left Ajar: while the door stays open, each repeat interval is now split in half — the sensor stays open for the first half and closed for the second — instead of flicking closed for one second before each repeat.

## 0.1.0

- First release as a standalone plugin, moved from the `alpha-6.0.1` branch of homebridge-config-ui-x.
- Fix: a disabled humidity rule could still run, and a disabled security system could still be armed.
- Fix: accessories on a child bridge with its own PIN could not be read or controlled.
- Fix: the UI's `accessoryControl` settings, such as `instanceBlacklist`, were ignored.
