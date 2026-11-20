import { afterEach, describe, expect, it, vi } from 'vitest'

import { ChristmasLightsRulesEngine, clampStepSeconds, patternFrame } from '../src/rules/christmas-lights.rules-engine.js'

describe('patternFrame', () => {
  it('alternates red and green, swapping each step', () => {
    expect(patternFrame('classic', 0, 3, 100).map(c => c.hue)).toEqual([0, 120, 0])
    expect(patternFrame('classic', 1, 3, 100).map(c => c.hue)).toEqual([120, 0, 120])
  })

  it('moves a chase one light along per step', () => {
    const first = patternFrame('chase', 0, 4, 100)
    const next = patternFrame('chase', 1, 4, 100)
    expect(next.slice(1)).toEqual(first.slice(0, 3))
  })

  it('keeps twinkle within the configured brightness', () => {
    const frame = patternFrame('twinkle', 0, 5, 80, () => 1)
    expect(frame.every(c => c.brightness === 80)).toBe(true)
    expect(patternFrame('twinkle', 0, 1, 80, () => 0)[0].brightness).toBe(20)
  })

  it('clamps the step time', () => {
    expect(clampStepSeconds(0)).toBe(2)
    expect(clampStepSeconds(500)).toBe(60)
  })
})

describe('christmasLightsRulesEngine', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  function light(uniqueId: string, values: Record<string, unknown>) {
    const characteristics = Object.fromEntries(Object.entries(values).map(([type, value]) => [
      type,
      {
        type,
        value,
        canWrite: true,
        setValue: vi.fn(async function (this: any, next: unknown) {
          this.value = next
        }),
      },
    ]))
    return {
      uniqueId,
      serviceName: uniqueId,
      characteristics,
      getCharacteristic: (type: string) => characteristics[type],
    }
  }

  const config = {
    id: 'xmas',
    name: 'Soffit',
    type: 'christmas-lights' as const,
    uniqueIds: ['a', 'b'],
    pattern: 'classic' as const,
    stepSeconds: 2,
    brightness: 100,
  }
  const log = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }

  it('runs the pattern while on and restores each light when off', async () => {
    vi.useFakeTimers()
    const a = light('a', {
      On: false,
      Hue: 200,
      Saturation: 10,
      Brightness: 40,
    })
    const b = light('b', {
      On: true,
      Hue: 50,
      Saturation: 60,
      Brightness: 70,
    })
    const engine = new ChristmasLightsRulesEngine(config, {
      getServices: async () => [a, b] as any,
    }, log)

    await engine.setOn(true)
    expect(a.characteristics.On.value).toBe(true)
    expect([a.characteristics.Hue.value, b.characteristics.Hue.value]).toEqual([0, 120])

    await vi.advanceTimersByTimeAsync(2000)
    expect([a.characteristics.Hue.value, b.characteristics.Hue.value]).toEqual([120, 0])

    await engine.setOn(false)
    expect(a.characteristics).toMatchObject({
      On: { value: false },
      Hue: { value: 200 },
      Brightness: { value: 40 },
    })
    expect(b.characteristics).toMatchObject({
      On: { value: true },
      Hue: { value: 50 },
      Brightness: { value: 70 },
    })

    // No more steps once stopped
    const writes = a.characteristics.Hue.setValue.mock.calls.length
    await vi.advanceTimersByTimeAsync(10_000)
    expect(a.characteristics.Hue.setValue.mock.calls.length).toBe(writes)
  })

  it('does not resend a value a light already has', async () => {
    vi.useFakeTimers()
    const a = light('a', {
      On: true,
      Hue: 0,
      Saturation: 0,
      Brightness: 100,
    })
    const engine = new ChristmasLightsRulesEngine({
      ...config,
      uniqueIds: ['a'],
      pattern: 'candy-cane',
    }, {
      getServices: async () => [a] as any,
    }, log)

    await engine.setOn(true)
    await vi.advanceTimersByTimeAsync(2000)
    // Red then white: hue stays 0, only saturation changes
    expect(a.characteristics.Hue.setValue).toHaveBeenCalledTimes(1)
    expect(a.characteristics.Saturation.setValue).toHaveBeenCalledTimes(2)
    engine.stop()
  })
})
