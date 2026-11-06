import type { PickerService } from '../homebridge-ui/accessory-lister.js'
import type { AutomationType, Draft } from './automation.js'
import type { AccessoryLayoutRoom } from './rooms.js'

import { useState } from 'preact/hooks'

import { AUTOMATION_TYPES, canSave, isControlTarget, isSingleSource, isSourceSelectable } from './automation.js'
import { t } from './i18n.js'
import { Picker } from './Picker.js'

interface EditorProps {
  initial: Draft
  services: PickerService[]
  rooms?: AccessoryLayoutRoom[] | null
  accessoryNotice: any
  onCancel: () => void
  onApply: (draft: Draft) => void
}

function NumberField({ id, label, help, value, min, max, onChange }: { id: string, label: string, help?: string, value: number, min: number, max: number, onChange: (value: any) => void }) {
  return (
    <div class="col-sm-6 mb-3">
      <label class="form-label" for={id}>{label}</label>
      <input id={id} type="number" min={min} max={max} class="form-control custom-input" value={value} onInput={e => onChange(e.currentTarget.value)} />
      {help && <small class="form-text grey-text">{help}</small>}
    </div>
  )
}

const SOURCE_TITLES: Record<AutomationType, string> = {
  'average-temperature': 'picker.temperature_sensors',
  'door-ajar': 'picker.door',
  'humidity-control': 'picker.humidity_sensor',
  'security-system': 'picker.security_sensors',
  'smart-light-group': 'picker.lights',
}

export function Editor({ initial, services, rooms, accessoryNotice, onCancel, onApply }: EditorProps) {
  const [draft, setDraft] = useState<Draft>(initial)
  const update = (changes: Partial<Draft>) => setDraft(current => ({
    ...current,
    ...changes,
  }))

  const prefillName = (uniqueId: string, selected: boolean) => {
    if (!selected || draft.name?.trim()) {
      return {}
    }
    const service = services.find(item => item.uniqueId === uniqueId)
    return service
      ? { name: `${service.serviceName} ${t(`name_suffix.${draft.type}`)}` }
      : {}
  }

  const onSource = (uniqueId: string, selected: boolean) => {
    const single = isSingleSource(draft.type)
    update({
      uniqueIds: single
        ? (selected
            ? [uniqueId]
            : [])
        : selected
          ? [...draft.uniqueIds, uniqueId]
          : draft.uniqueIds.filter(id => id !== uniqueId),
      ...prefillName(uniqueId, selected),
    })
  }

  return (
    <div class="card card-body">
      <h5 class="card-title mb-1">{t(draft.id ? 'editor.edit' : 'editor.create')}</h5>
      <small class="grey-text mb-3">{t('editor.help')}</small>

      <div class="mb-3">
        <label class="form-label" for="sa-name">{t('field.name')}</label>
        <input id="sa-name" type="text" class="form-control custom-input" value={draft.name || ''} onInput={e => update({ name: e.currentTarget.value })} />
      </div>
      <div class="mb-3">
        <label class="form-label" for="sa-type">{t('field.type')}</label>
        <select
          id="sa-type"
          class="custom-select form-select"
          value={draft.type}
          onChange={e => update({ type: e.currentTarget.value as AutomationType, uniqueIds: [], targetUniqueId: undefined })}
        >
          {AUTOMATION_TYPES.map(type => <option value={type} key={type}>{t(`type.${type}`)}</option>)}
        </select>
      </div>
      <div class="alert alert-info mb-3" role="note">{t(`description.${draft.type.replaceAll('-', '_')}`)}</div>

      {draft.type === 'door-ajar' && (
        <div class="row">
          <NumberField id="sa-open" label={t('field.alert_after')} help={t('help.alert_after')} min={1} max={1440} value={draft.openMinutes ?? 5} onChange={openMinutes => update({ openMinutes })} />
          <NumberField id="sa-repeat" label={t('field.repeat_every')} help={t('help.repeat_every')} min={1} max={1440} value={draft.repeatMinutes ?? 5} onChange={repeatMinutes => update({ repeatMinutes })} />
        </div>
      )}
      {draft.type === 'humidity-control' && (
        <>
          <div class="row">
            <NumberField id="sa-on" label={t('field.turn_on_above')} min={1} max={100} value={draft.onHumidity ?? 60} onChange={onHumidity => update({ onHumidity })} />
            <NumberField id="sa-off" label={t('field.turn_off_below')} min={0} max={99} value={draft.offHumidity ?? 50} onChange={offHumidity => update({ offHumidity })} />
          </div>
          <small class="form-text grey-text d-block mb-3">{t('help.humidity_threshold')}</small>
        </>
      )}
      {draft.type === 'average-temperature' && (
        <div class="row">
          <NumberField id="sa-remove" label={t('field.remove_after')} help={t('help.remove_after')} min={1} max={1440} value={draft.removeAfterMinutes ?? 30} onChange={removeAfterMinutes => update({ removeAfterMinutes })} />
        </div>
      )}
      {draft.type === 'smart-light-group' && (
        <div class="mb-3">
          <label class="form-label" for="sa-light">{t('field.published_light_type')}</label>
          <select id="sa-light" class="custom-select form-select" value={draft.lightbulbType || 'on-off'} onChange={e => update({ lightbulbType: e.currentTarget.value as Draft['lightbulbType'] })}>
            <option value="on-off">{t('light_type.on_off_only')}</option>
            <option value="dimmable">{t('light_type.dimmable')}</option>
            <option value="colour">{t('light_type.colour')}</option>
            <option value="temperature">{t('light_type.temperature')}</option>
          </select>
          <small class="form-text grey-text">{t('help.published_light_type')}</small>
        </div>
      )}
      {draft.type === 'security-system' && (
        <div class="form-check mb-3">
          <input id="sa-bypass" type="checkbox" class="form-check-input" checked={draft.autoBypass === true} onChange={e => update({ autoBypass: e.currentTarget.checked })} />
          <label class="form-check-label" for="sa-bypass">{t('field.auto_bypass')}</label>
          <small class="form-text grey-text d-block">{t('help.auto_bypass')}</small>
        </div>
      )}
      <div class="form-check mb-3">
        <input id="sa-enabled" type="checkbox" class="form-check-input" checked={draft.enabled} onChange={e => update({ enabled: e.currentTarget.checked })} />
        <label class="form-check-label" for="sa-enabled">{t('status.enabled')}</label>
      </div>

      {accessoryNotice}
      <Picker
        key={`source-${draft.type}`}
        name="sa-source"
        title={t(SOURCE_TITLES[draft.type])}
        badge={draft.type === 'humidity-control'
          ? t(draft.uniqueIds.length ? 'status.selected' : 'status.required')
          : t('picker.selected_count', { count: draft.uniqueIds.length })}
        single={isSingleSource(draft.type)}
        services={services.filter(service => isSourceSelectable(service, draft))}
        rooms={rooms}
        selected={draft.uniqueIds}
        onChange={onSource}
      />
      {draft.type === 'humidity-control' && (
        <Picker
          name="sa-target"
          title={t('picker.control_target')}
          badge={t(draft.targetUniqueId ? 'status.selected' : 'status.required')}
          single
          services={services.filter(service => isControlTarget(service, draft))}
          rooms={rooms}
          selected={draft.targetUniqueId
            ? [draft.targetUniqueId]
            : []}
          onChange={(uniqueId, selected) => update({
            targetUniqueId: selected ? uniqueId : undefined,
          })}
        />
      )}

      <div class="d-flex justify-content-between mt-2">
        <button type="button" class="btn btn-elegant" onClick={onCancel}>{t('action.cancel')}</button>
        <button type="button" class="btn btn-primary" disabled={!canSave(draft)} onClick={() => onApply(draft)}>
          {t(draft.id ? 'action.apply_changes' : 'action.create')}
        </button>
      </div>
    </div>
  )
}
