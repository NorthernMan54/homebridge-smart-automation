import { describe, expect, it } from 'vitest'

import { buildHapClientOptions } from '../src/hap-client-options.js'

describe('buildHapClientOptions', () => {
  const logger = {}

  it('requires the main bridge pin', () => {
    expect(() => buildHapClientOptions({ bridge: {} }, logger)).toThrow('pin is missing')
  })

  it('supplies the pin of every child bridge, including accessory blocks', () => {
    const options = buildHapClientOptions({
      bridge: { pin: '111-11-111', username: 'AA' },
      platforms: [
        {
          platform: 'a',
          _bridge: { username: 'BB', pin: '222-22-222' },
        },
        {
          platform: 'b',
          _bridge: { username: 'CC' },
        },
      ],
      accessories: [
        {
          accessory: 'c',
          _bridge: { username: 'DD', pin: '333-33-333' },
        },
      ],
    }, logger)

    expect(options.pin).toBe('111-11-111')
    expect(options.pins).toEqual({ BB: '222-22-222', DD: '333-33-333' })
    expect(options.ownUsernames).toEqual(['AA', 'BB', 'CC', 'DD'])
  })

  it('reads accessory control settings from the top of the UI config block', () => {
    const accessoryControl = {
      instanceBlacklist: ['AA'],
    }
    const options = buildHapClientOptions({
      bridge: { pin: '111-11-111' },
      platforms: [
        { platform: 'config', accessoryControl },
      ],
    }, logger)

    expect(options.config).toBe(accessoryControl)
  })
})
