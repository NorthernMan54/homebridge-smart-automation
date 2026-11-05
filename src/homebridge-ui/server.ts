import { readFileSync } from 'node:fs'

import { HapClient } from '@homebridge/hap-client'
import { HomebridgePluginUiServer, RequestError } from '@homebridge/plugin-ui-utils'

import { buildHapClientOptions } from '../hap-client-options.js'
import { AccessoryLister } from './accessory-lister.js'

class SmartAutomationUiServer extends HomebridgePluginUiServer {
  private readonly lister = new AccessoryLister(() => new HapClient(
    buildHapClientOptions(JSON.parse(readFileSync(this.homebridgeConfigPath!, 'utf8')), console),
  ))

  constructor() {
    super()
    this.onRequest('/services', async () => {
      try {
        return await this.lister.list()
      } catch (error: any) {
        throw new RequestError(error?.message || 'Could not list accessories.', { status: 500 })
      }
    })
    process.once('disconnect', () => this.lister.stop())
    this.ready()
  }
}

(() => new SmartAutomationUiServer())()
