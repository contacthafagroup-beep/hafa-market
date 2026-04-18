import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Provider } from 'react-redux'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { store } from './store'
import { useOffline } from './hooks/useOffline'
import './i18n'
import './index.css'

// Generate a unique session ID for search click tracking
if (!sessionStorage.getItem('sessionId')) {
  sessionStorage.setItem('sessionId', Math.random().toString(36).slice(2) + Date.now().toString(36))
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:  1000 * 60 * 2,
      retry:      1,
      refetchOnWindowFocus: false,
    },
  },
})

// Thin wrapper to activate offline detection at app root
function AppWithOffline() {
  useOffline()
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
          <AppWithOffline />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: { fontFamily: 'Poppins, sans-serif', fontSize: '14px' },
              success: { iconTheme: { primary: '#2E7D32', secondary: '#fff' } },
            }}
          />
        </BrowserRouter>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </Provider>
  </React.StrictMode>,
)
