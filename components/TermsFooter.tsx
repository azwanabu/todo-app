'use client'

import { useState } from 'react'
import Link from 'next/link'

export function TermsSummary() {
  return (
    <div className="space-y-3 text-sm text-gray-600">
      <p>By using this app, you agree to the following:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>Your todos and tags are your own responsibility — keep sensitive info out of them.</li>
        <li>We store your data to make the app work; we don&apos;t sell it to third parties.</li>
        <li>The app is provided &quot;as is&quot;, with no warranty of uptime or data retention.</li>
        <li>You can delete your account or data at any time.</li>
        <li>These terms may change; continued use means you accept the latest version.</li>
      </ul>
    </div>
  )
}

function TermsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-800">Terms and Conditions</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>

        <TermsSummary />

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
          <Link href="/terms" className="text-xs text-blue-600 hover:underline">
            View full terms
          </Link>
          <button
            onClick={onClose}
            className="text-xs bg-gray-100 text-gray-700 rounded-lg px-3 py-1.5 hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TermsFooter() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <footer className="max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto px-4 py-6 md:px-6 lg:px-8 text-center">
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-gray-400 hover:text-gray-600 hover:underline transition-colors"
        >
          Terms and Conditions
        </button>
      </footer>
      {open && <TermsModal onClose={() => setOpen(false)} />}
    </>
  )
}
