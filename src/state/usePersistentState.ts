import { useEffect, useState } from 'react';
import { storageAdapter } from '../storage/StorageAdapter';

export function usePersistentState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => storageAdapter.get<T>(key, initialValue));

  useEffect(() => {
    storageAdapter.set(key, value);
  }, [key, value]);

  return [value, setValue] as const;
}
