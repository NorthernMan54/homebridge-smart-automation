// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { App } from '../../src/ui/App.js'

function light(id: string, serviceName: string) {
  return {
    uniqueId: id,
    serviceName,
    type: 'Lightbulb',
    bridge: 'Main',
    characteristics: [],
  }
}

function host(config: any[] = [], services: any[] = [
  light('a', 'Hall'),
  light('b', 'Porch'),
]) {
  return {
    serverEnv: {
      env: { enableAccessories: true },
    },
    getPluginConfig: vi.fn(async () => config),
    updatePluginConfig: vi.fn(async (next: any[]) => next),
    request: vi.fn(async () => services),
    toast: {
      error: vi.fn(),
    },
  }
}

const rule = {
  id: 'r1',
  name: 'Downstairs',
  type: 'smart-light-group',
  uniqueIds: ['a'],
  lightbulbType: 'on-off',
  enabled: true,
}

describe('app', () => {
  afterEach(cleanup)

  it('creates a rule, prefilling its name, without losing other block settings', async () => {
    const homebridge = host([
      {
        platform: 'smart-automation',
        name: 'Mine',
        _bridge: { username: 'AA' },
      },
    ])
    render(<App homebridge={homebridge} />)

    fireEvent.click(await screen.findByText('Add automation'))
    fireEvent.click(await screen.findByLabelText(/Hall/))
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Hall Group')
    fireEvent.click(screen.getByText('Create automation'))

    await waitFor(() => expect(homebridge.updatePluginConfig).toHaveBeenCalled())
    const [block] = homebridge.updatePluginConfig.mock.calls[0][0]
    expect(block._bridge).toEqual({ username: 'AA' })
    expect(block.name).toBe('Mine')
    expect(block.smartAutomations[0]).toMatchObject({
      name: 'Hall Group',
      uniqueIds: ['a'],
      enabled: true,
    })
    expect(await screen.findByText(/unsaved changes/)).toBeTruthy()
  })

  it('creates the config block on first use', async () => {
    const homebridge = host([])
    render(<App homebridge={homebridge} />)
    fireEvent.click(await screen.findByLabelText('Debug logging'))
    await waitFor(() => expect(homebridge.updatePluginConfig).toHaveBeenCalled())
    expect(homebridge.updatePluginConfig.mock.calls[0][0][0]).toMatchObject({ platform: 'smart-automation', name: 'Smart Automations', debug: true })
  })

  it('disables and deletes a rule', async () => {
    const homebridge = host([
      {
        smartAutomations: [rule],
      },
    ])
    render(<App homebridge={homebridge} />)

    fireEvent.click(await screen.findByText('Disable'))
    await screen.findByText('Disabled')
    expect(homebridge.updatePluginConfig.mock.calls[0][0][0].smartAutomations[0].enabled).toBe(false)

    fireEvent.click(screen.getByText('Delete Downstairs'))
    await screen.findByText('No automations yet')
  })

  it('keeps an unavailable selected accessory when editing', async () => {
    const homebridge = host([
      {
        smartAutomations: [
          {
            ...rule,
            uniqueIds: ['gone'],
          },
        ],
      },
    ])
    render(<App homebridge={homebridge} />)

    fireEvent.click(await screen.findByText('Edit'))
    await screen.findByText(/not currently available/)
    fireEvent.click(screen.getByText('Apply changes'))

    await waitFor(() => expect(homebridge.updatePluginConfig).toHaveBeenCalled())
    expect(homebridge.updatePluginConfig.mock.calls[0][0][0].smartAutomations[0].uniqueIds).toEqual(['gone'])
  })

  it('filters the picker by search', async () => {
    render(<App homebridge={host()} />)
    fireEvent.click(await screen.findByText('Add automation'))
    await screen.findByLabelText(/Porch/)
    fireEvent.input(screen.getByRole('searchbox'), {
      target: { value: 'hall' },
    })
    await waitFor(() => expect(screen.queryByLabelText(/Porch/)).toBeNull())
  })

  it('groups the picker by the user\'s rooms when the host shares them', async () => {
    const homebridge = {
      ...host(),
      getAccessoryLayout: vi.fn(async () => [
        {
          name: 'Outside',
          services: [
            { uniqueId: 'b' },
          ],
        },
        { name: 'Default Room', isDefault: true, services: [] },
      ]),
    }
    render(<App homebridge={homebridge} />)
    fireEvent.click(await screen.findByText('Add automation'))

    expect(await screen.findByText('Outside')).toBeTruthy()
    expect(screen.getByText('Default Room')).toBeTruthy()
    expect(screen.queryByText('Lightbulb')).toBeNull()
    expect(screen.getAllByText(/· Lightbulb/)).toHaveLength(2)
  })

  it('groups the picker by type when the host has no room layout or it fails', async () => {
    const homebridge = {
      ...host(),
      getAccessoryLayout: vi.fn(async () => {
        throw new Error('no layout')
      }),
    }
    render(<App homebridge={homebridge} />)
    fireEvent.click(await screen.findByText('Add automation'))

    expect(await screen.findByText('Lightbulb')).toBeTruthy()
    expect(screen.queryByText('Default Room')).toBeNull()
  })

  it('explains when accessories cannot be listed, and can retry', async () => {
    const homebridge = host()
    homebridge.request.mockRejectedValueOnce(new Error('boom'))
    render(<App homebridge={homebridge} />)
    fireEvent.click(await screen.findByText('Add automation'))
    await screen.findByText(/boom/)
    fireEvent.click(screen.getByText('Try again'))
    await screen.findByLabelText(/Hall/)
  })

  it('explains when insecure mode is off, without asking for accessories', async () => {
    const homebridge = host()
    homebridge.serverEnv.env.enableAccessories = false
    render(<App homebridge={homebridge} />)
    fireEvent.click(await screen.findByText('Add automation'))
    await screen.findByText(/insecure mode/)
    expect(homebridge.request).not.toHaveBeenCalled()
  })
})
