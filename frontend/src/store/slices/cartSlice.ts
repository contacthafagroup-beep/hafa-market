import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { Product } from '@/types'

export interface LocalCartItem {
  id:        string
  productId: string
  product:   Product
  quantity:  number
}

interface CartState {
  items:    LocalCartItem[]
  isOpen:   boolean
}

const saved = localStorage.getItem('cart')
const initialState: CartState = {
  items:  saved ? JSON.parse(saved) : [],
  isOpen: false,
}

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addItem(state, action: PayloadAction<{ product: Product; quantity?: number }>) {
      const { product, quantity = 1 } = action.payload
      const existing = state.items.find(i => i.productId === product.id)
      if (existing) {
        existing.quantity += quantity
      } else {
        state.items.push({ id: `local-${Date.now()}`, productId: product.id, product, quantity })
      }
      localStorage.setItem('cart', JSON.stringify(state.items))
    },
    removeItem(state, action: PayloadAction<string>) {
      state.items = state.items.filter(i => i.productId !== action.payload)
      localStorage.setItem('cart', JSON.stringify(state.items))
    },
    updateQty(state, action: PayloadAction<{ productId: string; quantity: number }>) {
      const item = state.items.find(i => i.productId === action.payload.productId)
      if (item) {
        if (action.payload.quantity <= 0) {
          state.items = state.items.filter(i => i.productId !== action.payload.productId)
        } else {
          item.quantity = action.payload.quantity
        }
      }
      localStorage.setItem('cart', JSON.stringify(state.items))
    },
    clearCart(state) {
      state.items = []
      localStorage.removeItem('cart')
    },
    setCartOpen(state, action: PayloadAction<boolean>) {
      state.isOpen = action.payload
    },
    syncFromServer(state, action: PayloadAction<LocalCartItem[]>) {
      state.items = action.payload
      localStorage.setItem('cart', JSON.stringify(state.items))
    },
  },
})

export const { addItem, removeItem, updateQty, clearCart, setCartOpen, syncFromServer } = cartSlice.actions
export default cartSlice.reducer

// Selectors
export const selectCartCount   = (s: { cart: CartState }) => s.cart.items.reduce((n, i) => n + i.quantity, 0)
export const selectCartTotal   = (s: { cart: CartState }) => s.cart.items.reduce((n, i) => n + i.product.price * i.quantity, 0)
export const selectCartItems   = (s: { cart: CartState }) => s.cart.items
export const selectCartIsOpen  = (s: { cart: CartState }) => s.cart.isOpen
