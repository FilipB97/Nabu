import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

/**
 * Kody języków obsługiwanych przez aplikację, obecnie i planowanych. Każdy dołożony
 * język dopisujemy tutaj, inaczej reguła poniżej przestaje go pilnować.
 */
const LANG_CODES = ['es', 'pt', 'sv', 'ko', 'ja', 'zh', 'ar', 'he', 'de', 'it', 'no']

/**
 * Sekcja 2.1 i 16 planu: cała wiedza o konkretnym języku siedzi w `src/langs/{code}/`.
 * Rozgałęzienie `lang === 'ja'` gdziekolwiek indziej jest początkiem osypywania się
 * wielojęzyczności, a wychodzi na jaw dopiero przy dokładaniu piątego języka.
 *
 * Plan pierwotnie przewidywał `grep` w M4. Reguła jest lepsza, bo działa od M0
 * i nie da się jej przeoczyć przy przeglądzie.
 */
const noLangLiterals = [
  {
    selector: `Literal[value=/^(${LANG_CODES.join('|')})$/]`,
    message:
      'Kod języka poza src/langs/. Różnice językowe należą do adaptera (sekcja 2.1 planu), ' +
      'nie do rdzenia. Dodaj pole do LangAdapter i czytaj je stąd.',
  },
]

/**
 * Sekcja 9.1: kolor pochodzi z tokenu motywu albo nie istnieje. Wartość heksowa
 * w komponencie omija presety i test kontrastu — czyli obie bramki naraz.
 */
const noHexColors = [
  {
    selector: 'Literal[value=/#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?\\b/]',
    message:
      'Wartość heksowa poza src/theme/. Użyj tokenu z sekcji 9.1 planu — kolor wpisany ' +
      'na sztywno omija presety i test kontrastu.',
  },
]

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules', 'docs/design', 'public'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // Rdzeń: obie reguły. Zakresy są rozłączne, bo flat config NADPISUJE regułę
  // o tej samej nazwie zamiast scalać selektory.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/langs/**', 'src/theme/**'],
    rules: { 'no-restricted-syntax': ['error', ...noLangLiterals, ...noHexColors] },
  },
  // Adaptery mogą znać swój kod języka, ale nie mogą znać kolorów.
  {
    files: ['src/langs/**/*.{ts,tsx}'],
    rules: { 'no-restricted-syntax': ['error', ...noHexColors] },
  },
  // Motyw jest jedynym miejscem z wartościami heksowymi i nic nie wie o językach.
  {
    files: ['src/theme/**/*.{ts,tsx}'],
    rules: { 'no-restricted-syntax': ['error', ...noLangLiterals] },
  },

  {
    files: ['**/*.{test,spec}.{ts,tsx}', 'vite.config.ts', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: { 'no-restricted-syntax': 'off' },
  },
)
