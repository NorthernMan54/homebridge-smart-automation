import type { ServiceType } from '@homebridge/hap-client'

import type { ChristmasLightsConfig, ChristmasPattern, SmartAutomationAccessoryController } from '../smart-automation.interfaces.js'

export const CHRISTMAS_PATTERNS: ChristmasPattern[] = [
  'classic',
  'candy-cane',
  'chase',
  'twinkle',
  'colour-cycle',
  'rainbow',
]

export interface LightColour {
  hue: number
  saturation: number
  brightness: number
}

/** The characteristics saved when the pattern starts and put back when it stops. */
const RESTORED = [
  'Hue',
  'Saturation',
  'ColorTemperature',
  'Brightness',
  'On',
]

const RED = { hue: 0, saturation: 100 }
const GREEN = { hue: 120, saturation: 100 }
const WHITE = { hue: 0, saturation: 0 }
const GOLD = { hue: 40, saturation: 100 }
const BLUE = { hue: 230, saturation: 100 }

/**
 * Clamp the configured step time, in seconds. Each step writes to every light,
 * so going much faster than a second floods slow bridges and Wi-Fi bulbs.
 * @param value - the configured value
 */
export function clampStepSeconds(value: unknown): number {
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds > 0
    ? Math.min(Math.max(Math.round(seconds), 1), 60)
    : 2
}

/**
 * Clamp the configured brightness, as a percentage.
 * @param value - the configured value
 */
export function clampBrightness(value: unknown): number {
  const brightness = Number(value)
  return Number.isFinite(brightness) && brightness > 0
    ? Math.min(Math.round(brightness), 100)
    : 100
}

/**
 * The colour of each light for one step of a pattern. Lights are in the order
 * they were chosen, which should be the order they run along the soffit.
 * @param pattern - the selected pattern
 * @param step - how many steps have run since the pattern started
 * @param count - how many lights there are
 * @param brightness - the configured brightness
 * @param random - a 0–1 source, replaceable in tests
 */
export function patternFrame(pattern: ChristmasPattern, step: number, count: number, brightness: number, random: () => number = Math.random): LightColour[] {
  const lit = (colour: { hue: number, saturation: number }, level = brightness) => ({ ...colour, brightness: level })
  return Array.from({ length: count }, (_, index) => {
    switch (pattern) {
      case 'candy-cane':
        return lit((index + step) % 2
          ? WHITE
          : RED)
      case 'chase': {
        const colours = [RED, GREEN, WHITE, GOLD]
        return lit(colours[((index - step) % colours.length + colours.length) % colours.length])
      }
      case 'twinkle':
        // Warm white, each light at its own random level
        return lit({ hue: 35, saturation: 45 }, Math.max(1, Math.round(brightness * (0.25 + 0.75 * random()))))
      case 'colour-cycle': {
        const colours = [RED, GREEN, GOLD, BLUE, WHITE]
        return lit(colours[step % colours.length])
      }
      case 'rainbow':
        return lit({
          hue: Math.round((index * 360 / Math.max(count, 1) + step * 30) % 360),
          saturation: 100,
        })
      case 'classic':
      default:
        return lit((index + step) % 2
          ? GREEN
          : RED)
    }
  })
}

/**
 * Christmas lights: a switch that, while on, runs a colour pattern across a
 * row of RGB lights (for example the pot lights in a soffit), then puts every
 * light back the way it was when it is turned off.
 */
export class ChristmasLightsRulesEngine {
  private timer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private step = 0
  private lights: ServiceType[] = []
  private saved = new Map<string, Array<{ type: string, value: unknown }>>()
  /** The last colour written to each light, so unchanged values are not resent. */
  private last = new Map<string, LightColour>()

  constructor(
    private readonly config: ChristmasLightsConfig,
    private readonly accessories: SmartAutomationAccessoryController,
    private readonly log: any,
    private readonly random: () => number = Math.random,
  ) {}

  public isRunning(): boolean {
    return this.running
  }

  public async setOn(on: boolean): Promise<void> {
    if (on === this.running) {
      return
    }
    if (on) {
      await this.begin()
    } else {
      await this.end()
    }
  }

  /** Stop without restoring, for shutdown. */
  public stop(): void {
    this.running = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private async begin(): Promise<void> {
    try {
      const services = await this.accessories.getServices()
      this.lights = this.config.uniqueIds
        .map(uniqueId => services.find(service => service.uniqueId === uniqueId))
        .filter((service): service is ServiceType => Boolean(service))
    } catch (error: any) {
      this.log.warn(`${this.config.name}: could not read the lights: ${error?.message || error}`)
      return
    }
    if (this.lights.length < this.config.uniqueIds.length) {
      this.log.warn(`${this.config.name}: ${this.config.uniqueIds.length - this.lights.length} of the chosen lights were not found.`)
    }
    if (!this.lights.length) {
      return
    }

    this.saved.clear()
    this.last.clear()
    for (const light of this.lights) {
      this.saved.set(light.uniqueId, RESTORED
        .map(type => ({ type, value: light.getCharacteristic(type)?.value }))
        .filter(entry => entry.value !== undefined && entry.value !== null))
    }

    this.log.info(`${this.config.name}: starting the ${this.config.pattern} pattern on ${this.lights.length} light${this.lights.length === 1
      ? ''
      : 's'}.`)
    this.running = true
    this.step = 0
    await Promise.allSettled(this.lights.map(light => this.write(light, 'On', true)))
    await this.runStep()
  }

  private async end(): Promise<void> {
    this.stop()
    this.log.info(`${this.config.name}: stopping and restoring the lights.`)
    await Promise.allSettled(this.lights.map(async (light) => {
      // ColorTemperature and Hue/Saturation are exclusive on many bulbs, and
      // On goes last so a light that was off does not flash its old colour
      const saved = this.saved.get(light.uniqueId) || []
      const hadTemperature = saved.some(entry => entry.type === 'ColorTemperature')
      for (const { type, value } of saved) {
        if (hadTemperature && (type === 'Hue' || type === 'Saturation')) {
          continue
        }
        await this.write(light, type, value as any)
      }
    }))
  }

  /**
   * Show one frame, then schedule the next once every write has finished, so
   * a slow light cannot pile up overlapping steps.
   *
   * ⚠️ Nothing in here may throw: it runs from a timer.
   */
  private async runStep(): Promise<void> {
    if (!this.running) {
      return
    }
    const frame = patternFrame(this.config.pattern, this.step++, this.lights.length, this.config.brightness, this.random)
    await Promise.allSettled(this.lights.map((light, index) => this.show(light, frame[index])))
    if (!this.running) {
      return
    }
    this.timer = setTimeout(() => {
      this.timer = null
      void this.runStep()
    }, this.config.stepSeconds * 1000)
    this.timer.unref?.()
  }

  private async show(light: ServiceType, colour: LightColour): Promise<void> {
    const previous = this.last.get(light.uniqueId)
    this.last.set(light.uniqueId, colour)
    for (const type of ['Hue', 'Saturation', 'Brightness'] as const) {
      const key = type.toLowerCase() as keyof LightColour
      if (previous?.[key] !== colour[key]) {
        await this.write(light, type, colour[key])
      }
    }
  }

  private async write(light: ServiceType, type: string, value: string | number | boolean): Promise<void> {
    const characteristic = light.getCharacteristic(type)
    if (!characteristic?.canWrite) {
      return
    }
    try {
      await characteristic.setValue(value)
    } catch (error: any) {
      this.log.debug(`${this.config.name}: could not set ${type} on ${light.serviceName || light.uniqueId}: ${error?.message || error}`)
    }
  }
}
