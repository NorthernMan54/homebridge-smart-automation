import type { PickerService } from '../homebridge-ui/accessory-lister.js'

/** A room from the Homebridge UI's Accessories page, as `homebridge.getAccessoryLayout()` returns it. */
export interface AccessoryLayoutRoom {
  name: string
  isDefault?: boolean
  services: Array<{ uniqueId: string }>
}

export interface PickerGroup {
  name: string
  services: PickerService[]
}

function byName(a: PickerService, b: PickerService): number {
  return a.serviceName.localeCompare(b.serviceName)
}

/**
 * Group services by accessory type, sorted by type. Used when the Homebridge
 * UI is too old to share its room layout.
 * @param services - the services to group
 */
export function groupByType(services: PickerService[]): PickerGroup[] {
  const grouped = new Map<string, PickerService[]>()
  for (const service of services) {
    grouped.set(service.type, [
      ...(grouped.get(service.type) || []),
      service,
    ])
  }
  return [
    ...grouped.entries(),
  ]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, group]) => ({ name, services: group }))
}

/**
 * Group services by the user's rooms, in the order the user arranged them.
 * Services the user has not placed go into the default room, or into a group
 * named `fallbackName` at the end when the layout has no default room. Empty
 * rooms are left out.
 * @param services - the services to group
 * @param rooms - the room layout from the Homebridge UI
 * @param fallbackName - the name for unplaced services when no room is the default
 */
export function groupByRoom(services: PickerService[], rooms: AccessoryLayoutRoom[], fallbackName: string): PickerGroup[] {
  const byId = new Map(services.map(service => [service.uniqueId, service]))
  const placed = new Set<string>()
  const groups = rooms
    .filter(room => room && typeof room.name === 'string')
    .map((room) => {
      const roomServices: PickerService[] = []
      for (const entry of Array.isArray(room.services)
        ? room.services
        : []) {
        const service = byId.get(entry?.uniqueId)
        if (service && !placed.has(service.uniqueId)) {
          placed.add(service.uniqueId)
          roomServices.push(service)
        }
      }
      return { name: room.name, isDefault: room.isDefault === true, services: roomServices }
    })

  const unplaced = services.filter(service => !placed.has(service.uniqueId)).sort(byName)
  if (unplaced.length) {
    const defaultRoom = groups.find(group => group.isDefault)
    if (defaultRoom) {
      defaultRoom.services.push(...unplaced)
    } else {
      groups.push({ name: fallbackName, isDefault: true, services: unplaced })
    }
  }

  return groups
    .filter(group => group.services.length)
    .map(({ name, services: groupServices }) => ({ name, services: groupServices }))
}
