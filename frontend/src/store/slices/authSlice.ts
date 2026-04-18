import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { User } from '@/types'

interface AuthState {
  user:        User | null
  accessToken: string | null
}

const initialState: AuthState = {
  user:        null,
  accessToken: localStorage.getItem('accessToken'),
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ user: User; accessToken: string }>) {
      state.user        = action.payload.user
      state.accessToken = action.payload.accessToken
      localStorage.setItem('accessToken', action.payload.accessToken)
    },
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload
    },
    setLoading(_state, _action: PayloadAction<boolean>) {
      // kept for backwards compat — no-op now
    },
    logout(state) {
      state.user        = null
      state.accessToken = null
      localStorage.removeItem('accessToken')
    },
  },
})

export const { setCredentials, setUser, setLoading, logout } = authSlice.actions
export default authSlice.reducer
