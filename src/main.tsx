import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initSupabaseDebug } from './utils/supabaseDebug'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element not found')

void initSupabaseDebug()

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
