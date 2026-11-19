"use client";

import { useSyncExternalStore } from "react";

/**
 * A value shared between components that are far apart (the dock and the motto section both
 * switch the code layer on, the story and the dock both need the sound state). Smaller than a
 * context: read it with `useStore`, change it with `set`, or read it outside React with `get`.
 */
export type Store<T> = {
  get(): T;
  set(next: T | ((previous: T) => T)): void;
  subscribe(listener: () => void): () => void;
};

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      const resolved = typeof next === "function" ? (next as (previous: T) => T)(value) : next;
      if (Object.is(resolved, value)) return;
      value = resolved;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** `serverValue` is what the server renders (and the first client render, so they match). */
export function useStore<T>(store: Store<T>, serverValue?: T): T {
  return useSyncExternalStore(store.subscribe, store.get, () =>
    serverValue === undefined ? store.get() : serverValue,
  );
}
