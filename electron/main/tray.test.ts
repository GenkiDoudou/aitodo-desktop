import { app } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC } from '@shared/ipc-channels'
import type { CloseBehavior } from '@shared/close-behavior'
import { bindMinimizeToTray, toggleMainWindow } from './tray'

const electronApp = vi.hoisted(() => ({}))

vi.mock('electron', () => ({
  app: electronApp,
  BrowserWindow: vi.fn(),
  Menu: { buildFromTemplate: vi.fn() },
  Tray: vi.fn(),
  nativeImage: {
    createFromPath: vi.fn(() => ({ isEmpty: () => false })),
    createEmpty: vi.fn()
  }
}))

type CloseEvent = {
  preventDefault: ReturnType<typeof vi.fn>
}

function createWindowHarness() {
  let closeHandler: ((event: CloseEvent) => void) | undefined
  const send = vi.fn()
  const hide = vi.fn()
  const win = {
    hide,
    webContents: { send },
    on: vi.fn((event: string, handler: (event: CloseEvent) => void) => {
      if (event === 'close') {
        closeHandler = handler
      }
    })
  }

  return {
    win,
    hide,
    send,
    close() {
      const event = { preventDefault: vi.fn() }
      closeHandler?.(event)
      return event
    }
  }
}

describe('bindMinimizeToTray', () => {
  beforeEach(() => {
    ;(app as typeof app & { isQuitting?: boolean }).isQuitting = false
  })

  it('hides the window when close behavior is tray', () => {
    const harness = createWindowHarness()
    bindMinimizeToTray(harness.win as never, { readCloseBehavior: () => 'tray' })

    const event = harness.close()

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(harness.hide).toHaveBeenCalledTimes(1)
    expect(harness.send).not.toHaveBeenCalled()
  })

  it('asks renderer when close behavior is ask', () => {
    const harness = createWindowHarness()
    bindMinimizeToTray(harness.win as never, { readCloseBehavior: () => 'ask' })

    const event = harness.close()

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(harness.hide).not.toHaveBeenCalled()
    expect(harness.send).toHaveBeenCalledWith(IPC.APP_CLOSE_REQUEST)
  })

  it('marks app as quitting and allows close when close behavior is quit', () => {
    const harness = createWindowHarness()
    bindMinimizeToTray(harness.win as never, {
      readCloseBehavior: () => 'quit' satisfies CloseBehavior
    })

    const event = harness.close()

    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(harness.hide).not.toHaveBeenCalled()
    expect(harness.send).not.toHaveBeenCalled()
    expect((app as typeof app & { isQuitting?: boolean }).isQuitting).toBe(true)
  })
})

describe('toggleMainWindow', () => {
  it('hides visible window', () => {
    const hide = vi.fn()
    const show = vi.fn()
    const focus = vi.fn()
    const win = {
      isDestroyed: () => false,
      isVisible: () => true,
      hide,
      show,
      focus
    }

    toggleMainWindow(win as never)

    expect(hide).toHaveBeenCalledTimes(1)
    expect(show).not.toHaveBeenCalled()
  })

  it('shows hidden window', () => {
    const hide = vi.fn()
    const show = vi.fn()
    const focus = vi.fn()
    const win = {
      isDestroyed: () => false,
      isVisible: () => false,
      hide,
      show,
      focus
    }

    toggleMainWindow(win as never)

    expect(hide).not.toHaveBeenCalled()
    expect(show).toHaveBeenCalledTimes(1)
    expect(focus).toHaveBeenCalledTimes(1)
  })
})
