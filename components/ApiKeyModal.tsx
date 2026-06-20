'use client'

import { useState } from 'react'

export function ApiKeyModal({
  current,
  onSave,
  onClose,
}: {
  current: string
  onSave: (key: string) => void
  onClose: () => void
}) {
  const [value, setValue] = useState(current)
  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4'
      onClick={onClose}
    >
      <div
        className='w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6'
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className='text-lg font-bold'>🔑 API Key Mimo kamu (opsional)</h2>
        <p className='mt-2 text-sm text-slate-400'>
          Punya key sendiri? Tempel di sini biar combine kamu unlimited. Kalau dikosongin, otomatis
          pakai key sistem (ada kuota harian). Key cuma disimpan di browser kamu.
        </p>
        <input
          type='password'
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder='sk-...'
          className='mt-4 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm outline-none focus:border-sky-500'
        />
        <div className='mt-4 flex gap-2'>
          <button
            onClick={() => onSave(value.trim())}
            className='flex-1 rounded-lg bg-sky-600 py-2 font-semibold hover:bg-sky-500'
          >
            Simpan
          </button>
          <button
            onClick={() => onSave('')}
            className='rounded-lg border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800'
          >
            Hapus
          </button>
        </div>
      </div>
    </div>
  )
}
