import type { LangAdapter } from '../types.ts'
import { pinyinBatches, pinyinItems, pinyinMnemonic, pinyinNote } from './pinyin.ts'

/**
 * Chiński standardowy — klasa C. Brak spacji wymusza segmentację, ale w odróżnieniu
 * od japońskiego nie ma niejednoznacznych czytań: znak ma pinyin, a pinyin ma ton.
 *
 * Dwie rzeczy poszły łatwiej, niż zakładał plan. Lista częstości FrequencyWords dla
 * chińskiego JEST posegmentowana na słowa (`喜欢` ranga 99, `图书馆` 4409), więc nie
 * trzeba jej liczyć z korpusu jak przy japońskim. Segmentację załatwia zachłanne
 * dopasowanie do CC-CEDICT, bez analizatora morfologicznego.
 *
 * Brak trybu `type` z tego samego powodu co przy japońskim: wpisywanie przez systemowy
 * IME polega na wybraniu znaku z listy kandydatów, czyli na rozpoznaniu (sekcja 7.2).
 * Zostaje rysowanie.
 */
export const zh: LangAdapter = {
  code: 'zh',
  name: 'chiński',
  tatoeba: 'cmn',
  freq: 'zh_cn',
  freqSource: 'list',
  script: /^[\p{Script=Han}\p{P}\p{Zs}\d、。「」]+$/u,
  rtl: false,
  // Etap 0 nie jest tu pismem, tylko PINYINEM. Znaki rzeczywiście nie są alfabetem
  // i uczymy ich razem ze słownictwem — ale skończony inwentarz do opanowania przed
  // słowami istnieje: cztery tony, dwadzieścia jeden inicjałów i dwadzieścia finałów.
  // Bez nich czytanie `dì fāng` pod każdą kartą jest szumem, a ton — który jest częścią
  // słowa — w ogóle nie zostaje wprowadzony.
  hasScriptStage: true,
  needsReading: true,
  needsTranslit: true,
  tokenizer: 'dict',
  blocklist: /操你|傻逼|婊子|王八蛋|混蛋|他妈的/iu,
  display: { font: 'ja', size: 34, lineHeight: 2 },
  tts: { locale: 'zh-CN', rate: 0.5 },
  sentence: { minTokens: 4, maxTokens: 20, maxUnknown: 1, clozeSlack: 1 },
  maxBand: 12000,
  quiz: {
    // Tylko rzeczowniki: chiński nie odmienia, więc problem form odmienionych nie
    // istnieje, ale czasowniki i przymiotniki bywają w Wikisłowniku glosowane opisowo.
    clozePos: ['noun'],
    shape: 'kanji-components',
    minOptions: 4,
  },
  production: ['draw'],
  scriptItems: pinyinItems,
  scriptLabel: 'wymowa',
  scriptAbout:
    'Chiński nie ma alfabetu — znaki poznaje się razem ze słowami. Ma za to pinyin: ' +
    'zapis wymowy literami łacińskimi, w którym te litery znaczą co innego niż po polsku ' +
    '(q to „ć", x to „ś", c to „c"). Do tego cztery tony: ta sama sylaba wypowiedziana ' +
    'inaczej jest innym słowem, więc ton nie jest ozdobą, tylko częścią wyrazu. ' +
    'Czterdzieści sześć pozycji tego etapu domyka całą wymowę.',
  scriptNote: pinyinNote,
  scriptMnemonic: pinyinMnemonic,
  scriptBatches: pinyinBatches,
  // Pinyin nad każdym słowem: z samego znaku nie da się odczytać wymowy, a ton jest
  // częścią słowa. To jest dokładnie odwrotny przypadek niż japońska furigana, która
  // nad kaną byłaby powtórzeniem.
  showReading: () => true,
}
