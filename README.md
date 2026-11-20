<p align="center"><img src="images/icon.svg" alt="" width="120"></p>

# Homebridge Smart Automation

Do more with the accessories you already have, with no scripting and no tangle of Home app automations. Smart Automation adds automations that the Home app can't do on its own, and each one takes just a few clicks in the Homebridge UI. Get a nudge when the garage door is left open. Bring every outside light to full brightness when someone walks up, then put each light back exactly as it was. Run the AC when the basement gets humid. Turn your soffit lights into a Christmas display. Pick the automation, choose your accessories, and you're done.

| Automation | What it does |
| --- | --- |
| Smart Light Group | Publishes a light that turns on several lights together, then restores each light's earlier state when turned off |
| Christmas Lights | Publishes a light that runs a Christmas pattern across a row of colour lights, such as soffit pot lights, and restores them when turned off |
| Door Left Ajar | Publishes a contact sensor that opens when a door stays open too long, for use as a Home app trigger |
| Humidity-controlled AC | Turns a target on above one humidity threshold and off below another |
| Average Temperature Sensor | Publishes the average of several temperature sensors |
| Security System | Publishes a HomeKit security system driven by contact and motion sensors |

## Requirements

- Homebridge with **insecure mode** turned on, which is how this plugin reads and controls other accessories.
- Running this plugin on its own child bridge is recommended, so changing a rule only restarts that bridge.

## Using it

Open the plugin's settings, choose **Add automation**, pick a type and its accessories, then choose **Save**. Homebridge then offers to restart the plugin so the changes take effect.

The accessory picker groups accessories by the rooms you set up on the Homebridge UI's Accessories page. With a Homebridge UI that is too old to share its rooms, it groups them by accessory type instead.

## Development

```sh
npm install
npm run test
npm run lint
npm run build
npm run watch   # needs homebridge-config-ui-x installed globally
```

This code was moved out of the `alpha-6.0.1` branch of [homebridge-config-ui-x](https://github.com/homebridge/homebridge-config-ui-x), where it began as a built-in feature.

The icon is [Font Awesome](https://fontawesome.com) Free "wand-magic-sparkles", licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). It was the Smart Automations icon in the Homebridge UI sidebar.
