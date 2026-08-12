import { HashRouter, Link, Navigate, Route, Routes } from 'react-router'
import { ThemeProvider } from '@/theme/ThemeProvider'
import { Demo } from '@/routes/Demo'
import { AudioTest } from '@/routes/AudioTest'
import { Mono } from '@/ui/Mono'

/**
 * Powłoka aplikacji.
 *
 * `HashRouter`, a nie `BrowserRouter`: GitHub Pages nie potrafi przepisywać ścieżek
 * na `index.html`, więc odświeżenie na trasie zagnieżdżonej dałoby 404. Zmiana na
 * ścieżki historyczne będzie możliwa dopiero przy własnej domenie.
 *
 * W M0 są dwie trasy: demo tokenów i test dźwięku z sekcji 11.
 */
export function App() {
  return (
    <ThemeProvider>
      <HashRouter>
        <nav className="flex gap-5 border-b border-border-quiet bg-bg px-8 py-3">
          <Link to="/demo">
            <Mono tone="normal">demo</Mono>
          </Link>
          <Link to="/audio">
            <Mono tone="normal">test dźwięku</Mono>
          </Link>
        </nav>
        <Routes>
          <Route path="/demo" element={<Demo />} />
          <Route path="/audio" element={<AudioTest />} />
          <Route path="*" element={<Navigate to="/demo" replace />} />
        </Routes>
      </HashRouter>
    </ThemeProvider>
  )
}
