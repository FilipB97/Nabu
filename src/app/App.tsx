import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { ThemeProvider } from '@/theme/ThemeProvider'
import { LangProvider } from './lang'
import { AppShell } from './AppShell'
import { AddLanguage } from '@/routes/AddLanguage'
import { Demo } from '@/routes/Demo'
import { Start } from '@/routes/Start'
import { Session } from '@/routes/Session'
import { Calibration } from '@/routes/Calibration'
import { Stats } from '@/routes/Stats'
import { Settings } from '@/routes/Settings'
import { Done } from '@/routes/Done'
import { AudioTest } from '@/routes/AudioTest'
import { SpeechTest } from '@/routes/SpeechTest'

/**
 * Korzeń aplikacji.
 *
 * `HashRouter`, a nie `BrowserRouter`: GitHub Pages nie potrafi przepisywać ścieżek
 * na `index.html`, więc odświeżenie na trasie zagnieżdżonej dałoby 404. Zmiana na
 * ścieżki historyczne będzie możliwa dopiero przy własnej domenie.
 *
 * Trzy warstwy, każda o jednym zadaniu: motyw wpisuje zmienne do `<html>`, `LangProvider`
 * trzyma wybrany język (potrzebny szynie, zakładkom i ustawieniom naraz), `AppShell`
 * rysuje nawigację. Ekrany dostają czystą kolumnę treści i nie wiedzą nic o układzie —
 * dzięki temu ten sam kod obsługuje telefon i desktop 1280.
 *
 * Pasek deweloperski zniknął razem z powłoką: demo i test dźwięku są teraz wierszami
 * w ustawieniach, więc nie potrzebują własnej nawigacji obok produktowej.
 */
export function App() {
  return (
    <ThemeProvider>
      <HashRouter>
        <LangProvider>
          <AppShell>
            <Routes>
              <Route path="/start" element={<Start />} />
              <Route path="/dodaj" element={<AddLanguage />} />
              <Route path="/sesja/:lang" element={<Session />} />
              <Route path="/kalibracja/:lang" element={<Calibration />} />
              <Route path="/koniec/:lang" element={<Done />} />
              <Route path="/postep/:lang" element={<Stats />} />
              <Route path="/ustawienia" element={<Settings />} />
              <Route path="/demo" element={<Demo />} />
              <Route path="/audio" element={<AudioTest />} />
              <Route path="/mowa" element={<SpeechTest />} />
              <Route path="*" element={<Navigate to="/start" replace />} />
            </Routes>
          </AppShell>
        </LangProvider>
      </HashRouter>
    </ThemeProvider>
  )
}
