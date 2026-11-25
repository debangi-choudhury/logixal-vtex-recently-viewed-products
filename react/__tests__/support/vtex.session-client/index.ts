export const useRenderSession = jest.fn(() => ({
  loading: false,
  error: undefined,
  session: { namespaces: { profile: {} } },
}))
