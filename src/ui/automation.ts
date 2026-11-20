import type { PickerService } from '../homebridge-ui/accessory-lister.js'
import type { ChristmasPattern, SmartAutomationConfig } from '../smart-automation.interfaces.js'

import { PLUGIN_NAME } from '../settings.js'

export type AutomationType = SmartAutomationConfig['type']

export interface Draft {
  id?: string
  name?: string
  type: AutomationType
  enabled: boolean
  uniqueIds: string[]
  targetUniqueId?: string
  lightbulbType?: 'on-off' | 'dimmable' | 'colour' | 'temperature'
  openMinutes?: number
  repeatMinutes?: number
  onHumidity?: number
  offHumidity?: number
  removeAfterMinutes?: number
  autoBypass?: boolean
  pattern?: ChristmasPattern
  stepSeconds?: number
  brightness?: number
}

export const AUTOMATION_TYPES: AutomationType[] = [
  'average-temperature',
  'christmas-lights',
  'door-ajar',
  'humidity-control',
  'security-system',
  'smart-light-group',
]

const SOURCE_TYPES: Record<AutomationType, string[]> = {
  'average-temperature': ['TemperatureSensor', 'Thermostat', 'HeaterCooler'],
  'christmas-lights': ['Lightbulb'],
  'door-ajar': [
    'GarageDoorOpener',
    'Door',
    'Window',
    'WindowCovering',
    'ContactSensor',
  ],
  'humidity-control': ['HumiditySensor', 'HumidifierDehumidifier', 'Thermostat'],
  'security-system': ['ContactSensor', 'MotionSensor'],
  'smart-light-group': ['Lightbulb'],
}

const REQUIRED_CHARACTERISTIC: Partial<Record<AutomationType, string>> = {
  'average-temperature': 'CurrentTemperature',
  'humidity-control': 'CurrentRelativeHumidity',
  // Only colour lights can show a pattern
  'christmas-lights': 'Hue',
}

const TARGET_TYPES = [
  'Switch',
  'Outlet',
  'Fan',
  'Fanv2',
  'HeaterCooler',
  'Thermostat',
  'AirPurifier',
]
const TARGET_CHARACTERISTICS = ['On', 'Active', 'TargetHeatingCoolingState']

/**
 * Stop a rule consuming the accessory it publishes, which would be a feedback
 * loop. Outputs of other rules stay selectable so rules can be chained.
 * @param service - a discovered service
 * @param automationId - the rule being edited
 */
function isOwnPublishedAccessory(service: PickerService, automationId?: string): boolean {
  return Boolean(automationId && service.manufacturer === PLUGIN_NAME && service.serialNumber === automationId)
}

export function isSingleSource(type: AutomationType): boolean {
  return type === 'door-ajar' || type === 'humidity-control'
}

export function isSourceSelectable(service: PickerService, draft: Draft): boolean {
  if (!SOURCE_TYPES[draft.type].includes(service.type) || isOwnPublishedAccessory(service, draft.id)) {
    return false
  }
  const required = REQUIRED_CHARACTERISTIC[draft.type]
  return !required || service.characteristics.some(characteristic => characteristic.type === required)
}

export function isControlTarget(service: PickerService, draft: Draft): boolean {
  return !isOwnPublishedAccessory(service, draft.id)
    && TARGET_TYPES.includes(service.type)
    && service.characteristics.some(characteristic => characteristic.canWrite && TARGET_CHARACTERISTICS.includes(characteristic.type))
}

export function canSave(draft: Draft): boolean {
  return Boolean(
    draft.name?.trim()
    && draft.uniqueIds.length
    && (draft.type !== 'humidity-control' || draft.targetUniqueId),
  )
}

function toMinutes(value: unknown, fallback: number): number {
  const minutes = Number(value)
  return Number.isFinite(minutes) && minutes > 0
    ? Math.min(Math.round(minutes), 1440)
    : fallback
}

function toHumidity(value: unknown, fallback: number): number {
  const humidity = Number(value)
  return value !== '' && value != null && Number.isFinite(humidity)
    ? Math.min(Math.max(Math.round(humidity), 0), 100)
    : fallback
}

/**
 * Turn a draft into the config the engine reads, holding only the fields that
 * belong to its type so changing type cannot leave stale settings behind.
 * @param draft - the editor state
 * @param id - generates an id for a new rule
 */
/**
 * A random v4 UUID for a new rule.
 *
 * ⚠️ `crypto.randomUUID` only exists in a secure context (HTTPS or localhost),
 * and the Homebridge UI is usually opened over plain http on a LAN address,
 * where calling it throws and the Create button silently does nothing.
 * `getRandomValues` is available everywhere.
 * @param crypto - the Web Crypto object, replaceable in tests
 */
export function newId(crypto: Partial<Crypto> = globalThis.crypto): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const bytes = crypto.getRandomValues!(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0F) | 0x40
  bytes[8] = (bytes[8] & 0x3F) | 0x80
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function toAutomation(draft: Draft, id: () => string = () => newId()): SmartAutomationConfig {
  const uniqueIds = [
    ...new Set(draft.uniqueIds),
  ]
  const shared = {
    id: draft.id || id(),
    name: draft.name!.trim(),
    enabled: draft.enabled,
  }
  switch (draft.type) {
    case 'door-ajar':
      return {
        ...shared,
        type: draft.type,
        uniqueIds: uniqueIds.slice(0, 1),
        openMinutes: toMinutes(draft.openMinutes, 5),
        repeatMinutes: toMinutes(draft.repeatMinutes, 5),
      }
    case 'humidity-control': {
      const onHumidity = toHumidity(draft.onHumidity, 60)
      return {
        ...shared,
        type: draft.type,
        uniqueIds: uniqueIds.slice(0, 1),
        targetUniqueId: draft.targetUniqueId!,
        onHumidity,
        offHumidity: Math.min(toHumidity(draft.offHumidity, 50), Math.max(0, onHumidity - 1)),
      }
    }
    case 'average-temperature':
      return {
        ...shared,
        type: draft.type,
        uniqueIds,
        removeAfterMinutes: toMinutes(draft.removeAfterMinutes, 30),
      }
    case 'security-system':
      return {
        ...shared,
        type: draft.type,
        uniqueIds,
        autoBypass: draft.autoBypass === true,
      }
    case 'christmas-lights':
      return {
        ...shared,
        type: draft.type,
        uniqueIds,
        pattern: draft.pattern || 'classic',
        stepSeconds: Math.min(Math.max(Math.round(Number(draft.stepSeconds) || 2), 1), 60),
        brightness: Math.min(Math.max(Math.round(Number(draft.brightness) || 100), 1), 100),
      }
    default:
      return {
        ...shared,
        type: 'smart-light-group',
        uniqueIds,
        lightbulbType: draft.lightbulbType || 'on-off',
      }
  }
}

export function newDraft(): Draft {
  return {
    type: 'smart-light-group',
    lightbulbType: 'on-off',
    uniqueIds: [],
    enabled: true,
  }
}

export function toDraft(automation: SmartAutomationConfig): Draft {
  return {
    ...automation,
    enabled: automation.enabled ?? true,
    uniqueIds: [...automation.uniqueIds],
  }
}
