import { createContext, useContext, useEffect, useReducer } from 'react';
import {
  expoReducer,
  loadExpoFromStorage,
  saveExpoToStorage,
} from '../lib/art.js';

const ExpoContext = createContext(null);

export function ExpoProvider({ children }) {
  const [expo, dispatch] = useReducer(expoReducer, undefined, () => loadExpoFromStorage());

  useEffect(() => {
    saveExpoToStorage(expo);
  }, [expo]);

  return (
    <ExpoContext.Provider value={{ expo, dispatch }}>
      {children}
    </ExpoContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useExpo() {
  const ctx = useContext(ExpoContext);
  if (!ctx) {
    throw new Error('useExpo must be used inside ExpoProvider');
  }
  return ctx;
}
