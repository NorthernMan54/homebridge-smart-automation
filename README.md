# Homebridge Smart Automation

A rules engine for Homebridge that watches and controls your existing accessories. Each rule is configured in the plugin's settings in the Homebridge UI.

| Automation | What it does |
| --- | --- |
| Smart Light Group | Publishes a light that turns on several lights together, then restores each light's earlier state when turned off |
| Door Left Ajar | Publishes a contact sensor that opens when a door stays open too long, for use as a Home app trigger |
| Humidity-controlled AC | Turns a target on above one humidity threshold and off below another |
| Average Temperature Sensor | Publishes the average of several temperature sensors |
| Security System | Publishes a HomeKit security system driven by contact and motion sensors |

## Requirements

- Homebridge with **insecure mode** turned on, which is how this plugin reads and controls other accessories.
- Running this plugin on its own child bridge is recommended, so changing a rule only restarts that bridge.

## Using it

Open the plugin's settings, choose **Add automation**, pick a type and its accessories, then choose **Save**. Homebridge then offers to restart the plugin so the changes take effect.

## Development

```sh
npm install
npm run test
npm run lint
npm run build
npm run watch   # needs homebridge-config-ui-x installed globally
```

This code was moved out of the `alpha-6.0.1` branch of [homebridge-config-ui-x](https://github.com/homebridge/homebridge-config-ui-x), where it began as a built-in feature.
