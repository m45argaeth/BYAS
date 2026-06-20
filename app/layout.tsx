import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'BYAS — Bring Your Alchemy Skill',
  description: 'Game discovery reaksi kimia santai bertenaga AI.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang='id'>
      <body>{children}</body>
    </html>
  )
}
