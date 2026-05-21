import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './contexts/ThemeContext.tsx'
import { loadAppRuntimeConfig } from './lib/runtimeConfig.ts'

async function bootstrap() {
  const { clerkPublishableKey } = await loadAppRuntimeConfig()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ClerkProvider publishableKey={clerkPublishableKey}>
        <ThemeProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ThemeProvider>
      </ClerkProvider>
    </StrictMode>,
  )
}

void bootstrap().catch((error) => {
  const root = document.getElementById('root')
  if (root) {
    root.textContent = 'Configuration error: unable to start Quantnance.'
  }
  console.error(error)
})
