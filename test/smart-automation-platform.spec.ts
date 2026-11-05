import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SmartAutomationPlatform } from '../src/smart-automation.platform.js'

const fake = vi.hoisted(() => ({
  services: [] as any[],
  listeners: new Set<any>(),
}))

vi.mock('../src/smart-automation-accessory.controller.js', () => ({
  HapSmartAutomationAccessoryController: class {
    start = async () => {}
    stop = () => {}
    getServices = async () => fake.services
    onServicesChanged = (listener: any) => {
      fake.listeners.add(listener)
      return () => fake.listeners.delete(listener)
    }
  },
}))

function characteristic(uuid: string) {
  const c: any = {
    UUID: uuid,
    value: undefined,
    setHandler: undefined,
    updateValue: (value: any) => {
      c.value = value
      return c
    },
    onSet: (handler: any) => {
      c.setHandler = handler
      return c
    },
    onGet: () => c,
    removeAllListeners: () => c,
  }
  return c
}

function service(): any {
  const characteristics = new Map<any, any>()
  const s: any = {
    characteristics: [],
    getCharacteristic: (type: any) => {
      if (!characteristics.has(type)) {
        characteristics.set(type, characteristic(String(type)))
      }
      return characteristics.get(type)
    },
    setCharacteristic: () => s,
    updateCharacteristic: () => s,
  }
  return s
}

class PlatformAccessory {
  context: any = {}
  services = new Map<any, any>([
    [
      'AccessoryInformation',
      service(),
    ],
  ])

  constructor(public displayName: string, public UUID: string) {}
  getService = (type: any) => this.services.get(type)
  addService = (type: any) => {
    this.services.set(type, service())
    return this.services.get(type)
  }

  removeService = () => {}
}

const names = [
  'AccessoryInformation',
  'Lightbulb',
  'ContactSensor',
  'TemperatureSensor',
  'SecuritySystem',
  'Switch',
]
function api() {
  const handlers: Record<string, () => void> = {}
  return {
    handlers,
    on: (event: string, handler: () => void) => {
      handlers[event] = handler
    },
    user: {
      configPath: () => '/nonexistent/config.json',
    },
    platformAccessory: PlatformAccessory,
    registerPlatformAccessories: vi.fn(),
    updatePlatformAccessories: vi.fn(),
    unregisterPlatformAccessories: vi.fn(),
    hap: {
      uuid: {
        generate: (value: string) => value,
      },
      Service: Object.fromEntries(names.map(name => [name, name])),
      Characteristic: new Proxy({}, {
        get: (_, name) => String(name),
      }),
    },
  }
}
const log = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

async function launch(smartAutomations: any[]) {
  const homebridge = api()
  const platform = new SmartAutomationPlatform(log, { smartAutomations }, homebridge)
  homebridge.handlers.didFinishLaunching()
  await vi.waitFor(() => expect(log.info.mock.calls.some(([m]) => m.startsWith('Engine ready'))).toBe(true))
  return { homebridge, platform }
}

function humidityServices() {
  const setValue = vi.fn()
  fake.services = [
    {
      uniqueId: 'sensor',
      type: 'HumiditySensor',
      serviceCharacteristics: [
        { type: 'CurrentRelativeHumidity', value: 80 },
      ],
      getCharacteristic: (type: string) => type === 'CurrentRelativeHumidity'
        ? { value: 80 }
        : undefined,
    },
    {
      uniqueId: 'target',
      type: 'Switch',
      serviceCharacteristics: [
        { type: 'On', value: false, canWrite: true },
      ],
      getCharacteristic: (type: string) => type === 'On'
        ? { canWrite: true, value: false, setValue }
        : undefined,
    },
  ]
  return setValue
}

function humidityRule(enabled: boolean, id = 'humidity') {
  return {
    id,
    name: id,
    type: 'humidity-control',
    uniqueIds: ['sensor'],
    targetUniqueId: 'target',
    onHumidity: 60,
    offHumidity: 50,
    enabled,
  }
}

describe('smartAutomationPlatform', () => {
  beforeEach(() => {
    fake.services = []
    fake.listeners.clear()
    log.info.mockClear()
  })

  it('runs an enabled humidity rule', async () => {
    const setValue = humidityServices()
    await launch([
      humidityRule(true),
    ])
    await vi.waitFor(() => expect(setValue).toHaveBeenCalledWith(true))
  })

  it('does not run a disabled humidity rule when an enabled rule watches the same accessories', async () => {
    const setValue = humidityServices()
    await launch([
      humidityRule(false),
      {
        id: 'door',
        name: 'door',
        type: 'security-system',
        uniqueIds: ['sensor', 'target'],
        enabled: true,
      },
    ])
    expect(fake.listeners.size).toBe(1)
    expect(setValue).not.toHaveBeenCalled()
  })

  it('keeps a disabled security system disarmed when asked to arm', async () => {
    const { homebridge } = await launch([
      {
        id: 'alarm',
        name: 'alarm',
        type: 'security-system',
        uniqueIds: ['sensor'],
        enabled: false,
      },
    ])
    const accessory = homebridge.registerPlatformAccessories.mock.calls[0][2][0]
    const target = accessory.getService('SecuritySystem').getCharacteristic('SecuritySystemTargetState')

    await target.setHandler(1)

    expect(target.value).toBe(3)
    expect(fake.listeners.size).toBe(0)
  })

  it('registers accessories under the plugin name', async () => {
    const { homebridge } = await launch([
      {
        id: 'alarm',
        name: 'alarm',
        type: 'security-system',
        uniqueIds: ['sensor'],
        enabled: false,
      },
    ])
    expect(homebridge.registerPlatformAccessories.mock.calls[0].slice(0, 2)).toEqual(['homebridge-smart-automation', 'smart-automation'])
  })
})
