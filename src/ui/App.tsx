import type { PickerService } from '../homebridge-ui/accessory-lister.js'
import type { SmartAutomationConfig } from '../smart-automation.interfaces.js'
import type { Draft } from './automation.js'

import { useEffect, useState } from 'preact/hooks'

import { PLATFORM_NAME } from '../settings.js'
import { newDraft, toAutomation, toDraft } from './automation.js'
import { Editor } from './Editor.js'
import { t } from './i18n.js'

export interface HomebridgeUi {
  serverEnv?: { env?: { enableAccessories?: boolean } }
  getPluginConfig: () => Promise<any[]>
  updatePluginConfig: (config: any[]) => Promise<any[]>
  request: (path: string, body?: unknown) => Promise<any>
  toast: { error: (message: string, title?: string) => void }
}

function unit(count: number, singular: string): string {
  return t(`unit.${singular}${count === 1
    ? ''
    : 's'}`)
}

function summary(automation: SmartAutomationConfig): string {
  const count = automation.uniqueIds.length
  switch (automation.type) {
    case 'door-ajar':
      return t('summary.door_ajar', {
        open: automation.openMinutes,
        openUnit: unit(automation.openMinutes, 'minute'),
        repeat: automation.repeatMinutes,
        repeatUnit: unit(automation.repeatMinutes, 'minute'),
      })
    case 'humidity-control':
      return t('summary.humidity_control', { on: automation.onHumidity, off: automation.offHumidity })
    case 'average-temperature':
      return t('summary.average_temperature', {
        count,
        unit: unit(count, 'sensor'),
        remove: automation.removeAfterMinutes,
      })
    case 'security-system':
      return t(automation.autoBypass ? 'summary.security_system_auto_bypass' : 'summary.security_system', {
        count,
        unit: unit(count, 'sensor'),
      })
    default:
      return t('summary.smart_light_group', {
        count,
        unit: unit(count, 'light'),
        lightType: t(automation.lightbulbType === 'on-off'
          ? 'light_type.on_off'
          : `light_type.${automation.lightbulbType}`),
      })
  }
}

export function App({ homebridge }: { homebridge: HomebridgeUi }) {
  const [block, setBlock] = useState<Record<string, any> | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [dirty, setDirty] = useState(false)
  const [services, setServices] = useState<PickerService[]>([])
  const [accessories, setAccessories] = useState<{ state: 'loading' | 'ready' | 'error', message?: string }>({ state: 'loading' })
  const accessoriesEnabled = homebridge.serverEnv?.env?.enableAccessories !== false

  const loadServices = async () => {
    if (!accessoriesEnabled) {
      setAccessories({ state: 'ready' })
      return
    }
    setAccessories({ state: 'loading' })
    try {
      setServices(await homebridge.request('/services'))
      setAccessories({ state: 'ready' })
    } catch (error: any) {
      setAccessories({ state: 'error', message: error?.message || String(error) })
    }
  }

  useEffect(() => {
    void homebridge.getPluginConfig().then(([current]) => setBlock(current || {}))
    void loadServices()
  }, [])

  if (!block) {
    return <div class="spinner-border spinner-border-sm" role="status" aria-label={t('loading.accessories')} />
  }

  const automations: SmartAutomationConfig[] = (block.smartAutomations || []).filter((automation: any) => typeof automation?.name === 'string')
  const save = async (changes: Record<string, any>) => {
    const next = {
      ...block,
      platform: PLATFORM_NAME,
      name: block.name || t('title'),
      ...changes,
    }
    await homebridge.updatePluginConfig([next])
    setBlock(next)
    setDirty(true)
  }
  const saveAutomations = (next: SmartAutomationConfig[]) => save({ smartAutomations: next })

  const accessoryNotice = !accessoriesEnabled
    ? <div class="alert alert-warning mb-3" role="alert">{t('error.insecure')}</div>
    : accessories.state === 'loading'
      ? (
          <div class="mb-3" role="status">
            <span class="spinner-border spinner-border-sm me-2" aria-hidden="true" />
            {t('loading.accessories')}
          </div>
        )
      : accessories.state === 'error' || !services.length
        ? (
            <div class="alert alert-warning mb-3" role="alert">
              <div class="mb-2">
                {accessories.state === 'error'
                  ? t('error.accessories', { message: accessories.message! })
                  : t('error.no_accessories')}
              </div>
              <button type="button" class="btn btn-sm btn-elegant" onClick={() => void loadServices()}>{t('action.retry')}</button>
            </div>
          )
        : null

  if (draft) {
    return (
      <Editor
        initial={draft}
        services={services}
        accessoryNotice={accessoryNotice}
        onCancel={() => setDraft(null)}
        onApply={(edited) => {
          const saved = toAutomation(edited)
          const exists = automations.some(automation => automation.id === saved.id)
          void saveAutomations(exists
            ? automations.map(automation => automation.id === saved.id
                ? saved
                : automation)
            : [...automations, saved])
          setDraft(null)
        }}
      />
    )
  }

  return (
    <div>
      {dirty && <div class="alert alert-info mb-3" role="status">{t('notice.unsaved')}</div>}
      <div class="d-flex align-items-center justify-content-between mb-3">
        <h5 class="mb-0">{t('list.title')}</h5>
        <button type="button" class="btn btn-primary" onClick={() => setDraft(newDraft())}>{t('action.add')}</button>
      </div>
      {!automations.length && (
        <div class="card card-body text-center mb-3">
          <h6>{t('empty.title')}</h6>
          <p class="grey-text small mb-0">{t('empty.message')}</p>
        </div>
      )}
      {automations.map((automation) => {
        const enabled = automation.enabled ?? true
        return (
          <div class="card card-body mb-3" key={automation.id}>
            <div class="d-flex align-items-center justify-content-between gap-2 mb-1">
              <h6 class="mb-0 text-truncate">{automation.name}</h6>
              <span class={`badge ${enabled ? 'bg-success' : 'bg-secondary'}`}>{t(enabled ? 'status.enabled' : 'status.disabled')}</span>
            </div>
            <small class="grey-text d-block mb-3">{summary(automation)}</small>
            <div class="sa-actions">
              <button
                type="button"
                class="btn btn-sm btn-elegant"
                onClick={() => void saveAutomations(automations.map(item => item.id === automation.id
                  ? { ...item, enabled: !enabled }
                  : item))}
              >
                {t(enabled ? 'action.disable' : 'action.enable')}
              </button>
              <button type="button" class="btn btn-sm btn-elegant" onClick={() => setDraft(toDraft(automation))}>{t('action.edit')}</button>
              <button
                type="button"
                class="btn btn-sm btn-outline-danger"
                onClick={() => void saveAutomations(automations.filter(item => item.id !== automation.id))}
              >
                {t('action.delete', { name: automation.name })}
              </button>
            </div>
          </div>
        )
      })}
      <div class="form-check">
        <input id="sa-debug" type="checkbox" class="form-check-input" checked={block.debug === true} onChange={e => void save({ debug: e.currentTarget.checked })} />
        <label class="form-check-label" for="sa-debug">{t('settings.debug')}</label>
        <small class="form-text grey-text d-block">{t('settings.debug_help')}</small>
      </div>
    </div>
  )
}
