import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js'
import { SmartAutomationPlatform } from './smart-automation.platform.js'

export default (api: any) => {
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, SmartAutomationPlatform)
}
