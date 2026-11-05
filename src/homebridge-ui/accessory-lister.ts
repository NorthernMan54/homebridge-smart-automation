export interface PickerService {
  uniqueId: string
  serviceName: string
  type: string
  bridge: string
  manufacturer?: string
  serialNumber?: string
  characteristics: Array<{ type: string, canWrite: boolean }>
}

const DISCOVERY_SETTLE_MS = 3_000

/**
 * The fields the editor needs from a discovered service. Only what is used is
 * sent to the browser, so a pin or a live value never crosses into the iframe.
 * @param service - a service from HapClient
 */
export function toPickerService(service: any): PickerService {
  return {
    uniqueId: service.uniqueId,
    serviceName: service.serviceName || service.accessoryInformation?.Name || service.uniqueId,
    type: service.type,
    // instance.name is the bridge model, which is 'homebridge' for all of them
    bridge: service.instance?.ipAddress
      ? `${service.instance.ipAddress}:${service.instance.port}`
      : '',
    manufacturer: service.accessoryInformation?.Manufacturer,
    serialNumber: service.accessoryInformation?.['Serial Number'],
    characteristics: (service.serviceCharacteristics || []).map((characteristic: any) => ({
      type: characteristic.type,
      canWrite: Boolean(characteristic.canWrite),
    })),
  }
}

/** Starts HAP discovery once and lists services once discovery has settled. */
export class AccessoryLister {
  private client: any = null
  private settled: Promise<void> | null = null

  constructor(
    private readonly createClient: () => any,
    private readonly settleMs = DISCOVERY_SETTLE_MS,
  ) {}

  public async list(): Promise<PickerService[]> {
    await this.discovery()
    const services = await this.client.getAllServices()
    return services.filter((service: any) => service?.uniqueId).map(toPickerService)
  }

  public stop(): void {
    this.client?.destroy()
  }

  private discovery(): Promise<void> {
    this.settled ||= new Promise((resolve) => {
      let timer = setTimeout(resolve, this.settleMs)
      this.client = this.createClient()
      this.client.on('instance-discovered', () => {
        clearTimeout(timer)
        timer = setTimeout(resolve, this.settleMs)
      })
    })
    return this.settled
  }
}
