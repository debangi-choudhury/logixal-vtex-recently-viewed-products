/** Each handle becomes a class of the same name */
export function useCssHandles<T extends string>(handles: readonly T[]) {
  const result = {} as Record<T, string>

  for (const handle of handles) {
    result[handle] = handle
  }

  return result
}
