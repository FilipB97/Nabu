import { HashRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router'
import { ThemeProvider } from '@/theme/ThemeProvider'
import { Demo } from '@/routes/Demo'
import { Start } from '@/routes/Start'
import { Session } from '@/routes/Session'
import { Done } from '@/routes/Done'
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
/**
 * Pasek nawigacji deweloperskiej. Znika w sesji: ekran karty ma jedno zadanie
 * i nic nie może odciągać uwagi od słowa na środku (sekcja 9 planu).
 */
function DevNav() {
  const { pathname } = useLocation()
  if (pathname.startsWith('/sesja/')) return null

  return (
    <nav className="flex gap-5 border-b border-border-quiet bg-bg px-8 py-3">
      <Link to="/start">
        <Mono tone="normal">start</Mono>
      </Link>
      <Link to="/demo">
        <Mono tone="normal">demo</Mono>
      </Link>
      <Link to="/audio">
        <Mono tone="normal">test dźwięku</Mono>
      </Link>
    </nav>
  )
}

export function App() {
  return (
    <ThemeProvider>
      <HashRouter>
        <DevNav />
        <Routes>
          <Route path="/start" element={<Start />} />
          <Route path="/sesja/:lang" element={<Session />} />
          <Route path="/koniec/:lang" element={<Done />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/audio" element={<AudioTest />} />
          <Route path="*" element={<Navigate to="/start" replace />} />
        </Routes>
      </HashRouter>
    </ThemeProvider>
  )
}
