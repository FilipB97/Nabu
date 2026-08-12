import { afterEach, describe, expect, it, vi } from 'vitest'
import { hasVoice, speechSupported, voicesFor } from './speak.ts'

/**
 * Dobór głosu — sekcja 11 i M5.
 *
 * Testujemy wyłącznie dopasowanie locale do listy głosów, bo to jest jedyna część tej
 * warstwy, która podejmuje decyzję. Reszta to wywołania przeglądarki, których atrapa
 * sprawdzałaby atrapę.
 */

function withVoices(langs: string[]): void {
  const voices = langs.map((lang, i) => ({ lang, name: `głos-${i}` }) as SpeechSynthesisVoice)
  vi.stubGlobal('window', {
    speechSynthesis: {
      getVoices: () => voices,
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('dobór głosu systemowego', () => {
  it('bez syntezy w przeglądarce nie ma głosów i nie ma wyjątku', () => {
    vi.stubGlobal('window', {})
    expect(speechSupported()).toBe(false)
    expect(voicesFor('ja-JP')).toEqual([])
    expect(hasVoice('ja-JP')).toBe(false)
  })

  it('bierze dopasowanie pełne, gdy jest', () => {
    withVoices(['en-US', 'ja-JP', 'ja-JP'])
    expect(voicesFor('ja-JP')).toHaveLength(2)
  })

  it('schodzi do samego języka, gdy wariantu regionalnego nie ma', () => {
    // `zh-CN` bywa w systemie zapisane jako `zh-Hans-CN`. Bez tego stopnia chiński
    // wyglądałby na język bez głosu, mimo że głos jest.
    withVoices(['zh-Hans-CN'])
    expect(hasVoice('zh-CN')).toBe(true)
  })

  it('znosi podkreślnik zamiast myślnika w kodzie systemowym', () => {
    withVoices(['ko_KR'])
    expect(voicesFor('ko-KR')).toHaveLength(1)
  })

  it('nie myli języków o wspólnym przedrostku regionu', () => {
    withVoices(['pt-BR', 'pl-PL'])
    expect(voicesFor('pt-PT').map((v) => v.lang)).toEqual(['pt-BR'])
  })

  it('brak głosu dla języka jest stanem, nie błędem', () => {
    withVoices(['en-US'])
    expect(hasVoice('ja-JP')).toBe(false)
  })
})
