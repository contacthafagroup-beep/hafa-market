import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface UiState {
  searchOpen:    boolean
  mobileMenuOpen:boolean
  lang:          string
  currency:      string
}

const initialState: UiState = {
  searchOpen:     false,
  mobileMenuOpen: false,
  lang:           localStorage.getItem('lang') || 'en',
  currency:       localStorage.getItem('currency') || 'USD',
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setSearchOpen(state, action: PayloadAction<boolean>)     { state.searchOpen     = action.payload },
    setMobileMenu(state, action: PayloadAction<boolean>)     { state.mobileMenuOpen = action.payload },
    setLang(state, action: PayloadAction<string>)            { state.lang = action.payload; localStorage.setItem('lang', action.payload) },
    setCurrency(state, action: PayloadAction<string>)        { state.currency = action.payload; localStorage.setItem('currency', action.payload) },
  },
})

export const { setSearchOpen, setMobileMenu, setLang, setCurrency } = uiSlice.actions
export default uiSlice.reducer
