import { EventEmitter } from 'node:events'

import { describe, expect, it, vi } from 'vitest'

import { AccessoryLister, toPickerService } from '../src/homebridge-ui/accessory-lister.js'

describe('toPickerService', () => {
  it('sends only what the editor needs', () => {
    const picked = toPickerService({
      uniqueId: 'id',
      serviceName: 'Hall',
      type: 'Lightbulb',
      instance: {
        name: 'homebridge',
        ipAddress: '10.0.0.2',
        port: 51826,
        pin: '111-11-111',
      },
      accessoryInformation: { 'Manufacturer': 'm', 'Serial Number': 's' },
      serviceCharacteristics: [
        { type: 'On', canWrite: true, value: true },
      ],
    })
    expect(picked).toEqual({
      uniqueId: 'id',
      serviceName: 'Hall',
      type: 'Lightbulb',
      bridge: '10.0.0.2:51826',
      manufacturer: 'm',
      serialNumber: 's',
      characteristics: [
        { type: 'On', canWrite: true },
      ],
    })
  })
})

describe('accessoryLister', () => {
  it('waits for discovery to settle, and discovers only once', async () => {
    vi.useFakeTimers()
    const client: any = new EventEmitter()
    client.getAllServices = vi.fn(async () => [
      { uniqueId: 'a', type: 'Switch' },
      {},
    ])
    const create = vi.fn(() => client)
    const lister = new AccessoryLister(create, 100)

    const first = lister.list()
    await vi.advanceTimersByTimeAsync(90)
    client.emit('instance-discovered')
    await vi.advanceTimersByTimeAsync(90)
    expect(client.getAllServices).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(20)
    expect(await first).toHaveLength(1)

    await lister.list()
    expect(create).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
