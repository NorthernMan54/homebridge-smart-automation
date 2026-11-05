import { describe, expect, it } from 'vitest'

import { canSave, isControlTarget, isSourceSelectable, newDraft, toAutomation } from '../../src/ui/automation.js'

function service(type: string, characteristics: any[] = [], extra = {}) {
  return {
    uniqueId: type,
    serviceName: type,
    type,
    bridge: '',
    characteristics,
    ...extra,
  }
}

describe('accessory filters', () => {
  it('requires a reading for humidity and temperature sources', () => {
    const draft = {
      ...newDraft(),
      type: 'humidity-control' as const,
    }
    expect(isSourceSelectable(service('Thermostat'), draft)).toBe(false)
    expect(isSourceSelectable(service('Thermostat', [
      { type: 'CurrentRelativeHumidity', canWrite: false },
    ]), draft)).toBe(true)
    expect(isSourceSelectable(service('Lightbulb'), draft)).toBe(false)
  })

  it('refuses a rule its own published accessory, but allows another rule output', () => {
    const draft = {
      ...newDraft(),
      id: 'me',
    }
    const published = { manufacturer: 'homebridge-smart-automation', serialNumber: 'me' }
    expect(isSourceSelectable(service('Lightbulb', [], published), draft)).toBe(false)
    expect(isSourceSelectable(service('Lightbulb', [], { ...published, serialNumber: 'other' }), draft)).toBe(true)
  })

  it('needs a writable control on a target', () => {
    const draft = newDraft()
    expect(isControlTarget(service('Switch', [
      { type: 'On', canWrite: false },
    ]), draft)).toBe(false)
    expect(isControlTarget(service('Switch', [
      { type: 'On', canWrite: true },
    ]), draft)).toBe(true)
  })
})

describe('canSave', () => {
  it('needs a name, a source, and a target for humidity rules', () => {
    expect(canSave({
      ...newDraft(),
      name: ' ',
      uniqueIds: ['a'],
    })).toBe(false)
    expect(canSave({
      ...newDraft(),
      name: 'x',
    })).toBe(false)
    expect(canSave({
      ...newDraft(),
      name: 'x',
      uniqueIds: ['a'],
    })).toBe(true)
    expect(canSave({
      ...newDraft(),
      type: 'humidity-control',
      name: 'x',
      uniqueIds: ['a'],
    })).toBe(false)
  })
})

describe('toAutomation', () => {
  it('clamps values the way the engine does and keeps off below on', () => {
    const rule = toAutomation({
      ...newDraft(),
      type: 'humidity-control',
      name: ' x ',
      uniqueIds: ['a', 'b'],
      targetUniqueId: 't',
      onHumidity: 40,
      offHumidity: 70,
    }, () => 'new')
    expect(rule).toEqual({
      id: 'new',
      name: 'x',
      enabled: true,
      type: 'humidity-control',
      uniqueIds: ['a'],
      targetUniqueId: 't',
      onHumidity: 40,
      offHumidity: 39,
    })
  })

  it('keeps zero as a valid off threshold', () => {
    const rule: any = toAutomation({
      ...newDraft(),
      type: 'humidity-control',
      name: 'x',
      uniqueIds: ['a'],
      targetUniqueId: 't',
      offHumidity: 0,
    })
    expect(rule.offHumidity).toBe(0)
  })

  it('drops settings left over from another type', () => {
    const rule: any = toAutomation({
      ...newDraft(),
      type: 'door-ajar',
      id: 'k',
      name: 'x',
      uniqueIds: ['a'],
      lightbulbType: 'colour',
      openMinutes: 99999,
    })
    expect(rule.lightbulbType).toBeUndefined()
    expect(rule.openMinutes).toBe(1440)
    expect(rule.id).toBe('k')
  })
})
