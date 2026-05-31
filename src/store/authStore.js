import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  user: null,
  accessToken: null,
  tokenExpiry: null,
  isSignedIn: false,

  setAuth: (accessToken, expiresIn) =>
    set({
      accessToken,
      tokenExpiry: Date.now() + expiresIn * 1000,
      isSignedIn: true,
    }),

  setUser: (user) => set({ user }),

  signOut: () =>
    set({ user: null, accessToken: null, tokenExpiry: null, isSignedIn: false }),

  isTokenValid: () => {
    const { accessToken, tokenExpiry } = useAuthStore.getState()
    return accessToken && tokenExpiry && Date.now() < tokenExpiry - 60_000
  },
}))
