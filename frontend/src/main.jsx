import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LangProvider, LangToggle } from './i18n'
import './index.css'
import App from './App'
import GraphExplorer from './pages/GraphExplorer'
import RepealSimulator from './pages/RepealSimulator'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LangProvider>
      <LangToggle />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/simulator" element={<RepealSimulator />} />
          <Route path="/graph" element={<GraphExplorer />} />
          <Route path="/graph/:normId" element={<GraphExplorer />} />
        </Routes>
      </BrowserRouter>
    </LangProvider>
  </StrictMode>,
)
