import { useSyncExternalStore } from 'react'
import { store } from './store'

export function useAppState() {
  return useSyncExternalStore(store.subscribe, store.get)
}
