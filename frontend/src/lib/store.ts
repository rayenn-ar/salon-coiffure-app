import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  role: string;
  nom: string;
  prenom: string;
  mustChangePassword?: boolean;
  isMfaEnabled?: boolean;
  mfaMethod?: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  mfaPending: boolean;
  pendingToken: string | null;
  /** True after client-side rehydration. Always false on the server. */
  _hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  login: (token: string, user: User, refreshToken?: string) => void;
  logout: () => void;
  setUser: (user: User) => void;
  setMfaPending: (pending: boolean, pendingToken?: string | null, user?: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      mfaPending: false,
      pendingToken: null,
      _hasHydrated: false,
      setHasHydrated: (v) => set({ _hasHydrated: v }),
      login: (token, user, refreshToken) => set({
        token, user, isAuthenticated: true,
        refreshToken: refreshToken || null,
        mfaPending: false, pendingToken: null,
      }),
      logout: () => set({
        token: null, user: null, isAuthenticated: false,
        refreshToken: null, mfaPending: false, pendingToken: null,
      }),
      setUser: (user) => set({ user }),
      setMfaPending: (pending, pendingToken, user) => set((state) => ({
        mfaPending: pending,
        pendingToken: pendingToken || null,
        user: user ? { ...state.user, ...user } as User : state.user,
      })),
    }),
    {
      name: 'auth-salon',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
