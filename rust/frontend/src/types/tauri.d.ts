// Type declarations for Tauri globals

interface Window {
  __TAURI__?: {
    core: {
      invoke: <T = unknown>(cmd: string, args?: Record<string, unknown>) => Promise<T>
    }
    event: {
      listen: <T = unknown>(event: string, handler: (event: { payload: T }) => void) => Promise<() => void>
      emit: (event: string, payload?: unknown) => Promise<void>
    }
  }
}
