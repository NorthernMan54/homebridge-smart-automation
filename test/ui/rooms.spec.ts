import type { PickerService } from '../../src/homebridge-ui/accessory-lister.js'

import { describe, expect, it } from 'vitest'

import { groupByRoom, groupByType } from '../../src/ui/rooms.js'

function service(uniqueId: string, serviceName: string, type = 'Lightbulb'): PickerService {
  return {
    uniqueId,
    serviceName,
    type,
    bridge: '',
    characteristics: [],
  }
}

function names(groups: ReturnType<typeof groupByRoom>) {
  return groups.map(group => [
    group.name,
    group.services.map(item => item.uniqueId),
  ])
}

describe('groupByType', () => {
  it('groups by type, sorted by type', () => {
    expect(names(groupByType([
      service('a', 'Hall'),
      service('b', 'Door', 'ContactSensor'),
      service('c', 'Porch'),
    ]))).toEqual([
      [
        'ContactSensor',
        ['b'],
      ],
      [
        'Lightbulb',
        ['a', 'c'],
      ],
    ])
  })
})

describe('groupByRoom', () => {
  const services = [
    service('a', 'Hall'),
    service('b', 'Porch'),
    service('c', 'Attic'),
    service('d', 'Bedside'),
  ]

  it('keeps the user\'s room and accessory order, and puts unplaced accessories in the default room', () => {
    expect(names(groupByRoom(services, [
      {
        name: 'Outside',
        services: [
          { uniqueId: 'b' },
        ],
      },
      {
        name: 'Default Room',
        isDefault: true,
        services: [
          { uniqueId: 'a' },
        ],
      },
    ], 'Fallback'))).toEqual([
      [
        'Outside',
        ['b'],
      ],
      [
        'Default Room',
        ['a', 'c', 'd'],
      ],
    ])
  })

  it('adds a fallback group when no room is the default', () => {
    expect(names(groupByRoom(services, [
      {
        name: 'Outside',
        services: [
          { uniqueId: 'b' },
          { uniqueId: 'a' },
        ],
      },
    ], 'Fallback'))).toEqual([
      [
        'Outside',
        ['b', 'a'],
      ],
      [
        'Fallback',
        ['c', 'd'],
      ],
    ])
  })

  it('leaves out empty rooms, unknown services and repeats', () => {
    expect(names(groupByRoom([
      service('a', 'Hall'),
    ], [
      { name: 'Empty', services: [] },
      {
        name: 'Gone',
        services: [
          { uniqueId: 'missing' },
        ],
      },
      {
        name: 'Hall',
        services: [
          { uniqueId: 'a' },
        ],
      },
      {
        name: 'Again',
        services: [
          { uniqueId: 'a' },
        ],
      },
    ], 'Fallback'))).toEqual([
      [
        'Hall',
        ['a'],
      ],
    ])
  })

  it('tolerates a malformed layout', () => {
    expect(names(groupByRoom([
      service('a', 'Hall'),
    ], [
      null as any,
      { name: 'No services' } as any,
    ], 'Fallback'))).toEqual([
      [
        'Fallback',
        ['a'],
      ],
    ])
  })
})
