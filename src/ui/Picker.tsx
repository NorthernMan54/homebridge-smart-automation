import type { PickerService } from '../homebridge-ui/accessory-lister.js'

import { useMemo, useState } from 'preact/hooks'

import { t } from './i18n.js'

interface PickerProps {
  title: string
  badge: string
  name: string
  single: boolean
  services: PickerService[]
  selected: string[]
  onChange: (uniqueId: string, selected: boolean) => void
}

/** Accessories grouped by type, because room layouts are not available to a plugin. */
export function Picker({ title, badge, name, single, services, selected, onChange }: PickerProps) {
  const [search, setSearch] = useState('')
  const groups = useMemo(() => {
    const term = search.trim().toLowerCase()
    const grouped = new Map<string, PickerService[]>()
    for (const service of services) {
      if (!term || service.serviceName.toLowerCase().includes(term) || service.bridge.toLowerCase().includes(term)) {
        grouped.set(service.type, [
          ...(grouped.get(service.type) || []),
          service,
        ])
      }
    }
    return [
      ...grouped.entries(),
    ].sort(([a], [b]) => a.localeCompare(b))
  }, [services, search])
  const missing = selected.filter(id => !services.some(service => service.uniqueId === id)).length

  return (
    <div class="mb-3">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <h6 class="mb-0">{title}</h6>
        <small class="grey-text">{badge}</small>
      </div>
      <input
        type="search"
        class="form-control custom-input mb-2"
        aria-label={`${t('field.search')}: ${title}`}
        placeholder={t('field.search')}
        value={search}
        onInput={e => setSearch(e.currentTarget.value)}
      />
      {missing > 0 && <small class="form-text grey-text d-block mb-2">{t('picker.missing', { count: missing })}</small>}
      <div class="list-group-item sa-chooser">
        {groups.map(([type, group]) => (
          <div class="mb-2" key={type}>
            <div class="fw-semibold">{type}</div>
            {group.map((service) => {
              const id = `${name}-${service.uniqueId}`
              return (
                <div class="form-check" key={service.uniqueId}>
                  <input
                    id={id}
                    class="form-check-input"
                    type={single ? 'radio' : 'checkbox'}
                    name={name}
                    checked={selected.includes(service.uniqueId)}
                    onChange={e => onChange(service.uniqueId, e.currentTarget.checked)}
                  />
                  <label class="form-check-label" for={id}>
                    {service.serviceName}
                    {service.bridge && (
                      <span class="grey-text small">
                        {' · '}
                        {service.bridge}
                      </span>
                    )}
                  </label>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
