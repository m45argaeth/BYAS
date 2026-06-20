import './globals.css'
import type { Metadata } from 'next'
import { ThemeProvider } from '@/lib/theme'
import { I18nProvider } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'BYAS — Bring Your Alchemy Skill',
  description: 'Gamified chemistry combos. Combine elements, discover reactions, level up.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <I18nProvider>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
