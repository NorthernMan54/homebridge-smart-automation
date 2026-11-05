/**
 * Build the HapClient options for a parsed Homebridge config.json.
 *
 * Even in insecure mode each bridge checks the Authorization header against its
 * own pin, so every child bridge that sets one has to be supplied. The UI's own
 * accessory control settings sit directly on its `config` platform block.
 * @param config - the parsed config.json
 * @param logger - the logger handed to HapClient
 */
export function buildHapClientOptions(config: any, logger: any) {
  const pin = config?.bridge?.pin
  if (!pin) {
    throw new Error('The main bridge pin is missing.')
  }

  const platforms = Array.isArray(config.platforms)
    ? config.platforms
    : []
  const accessories = Array.isArray(config.accessories)
    ? config.accessories
    : []
  const pins: Record<string, string> = {}
  const ownUsernames = new Set<string>()
  if (config.bridge.username) {
    ownUsernames.add(config.bridge.username)
  }
  for (const block of [
    ...platforms,
    ...accessories,
  ]) {
    const bridge = block?._bridge
    if (bridge?.username) {
      ownUsernames.add(bridge.username)
      if (bridge.pin) {
        pins[bridge.username] = bridge.pin
      }
    }
  }

  return {
    pin,
    pins,
    ownUsernames: [...ownUsernames],
    logger,
    config: platforms.find((platform: any) => platform?.platform === 'config')?.accessoryControl || {},
  }
}
