import type { HomebridgeUi } from './App.js'

import { render } from 'preact'

import { App } from './App.js'

declare global {
  // eslint-disable-next-line vars-on-top
  var homebridge: HomebridgeUi & EventTarget
}

// The host answers plugin requests only after it has sent 'ready'
globalThis.homebridge.addEventListener('ready', () => {
  render(<App homebridge={globalThis.homebridge} />, document.getElementById('app')!)
}, { once: true })
