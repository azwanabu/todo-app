import Link from 'next/link'

export const metadata = {
  title: 'Terms and Conditions — Todo App',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen px-4 py-10">
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Terms and Conditions</h1>

        <div className="space-y-5 text-sm text-gray-600 leading-relaxed">
          <section>
            <h2 className="text-sm font-semibold text-gray-800 mb-1">1. Using the app</h2>
            <p>This app lets you create and manage a personal todo list. You&apos;re responsible for the content you add, and for keeping your account credentials safe.</p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-800 mb-1">2. Your data</h2>
            <p>We store your todos, tags, and account info so the app can work. We don&apos;t sell your data to third parties. If you make a list public via a share link, anyone with that link can view it.</p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-800 mb-1">3. No warranty</h2>
            <p>The app is provided &quot;as is&quot;, without guarantees of uptime, accuracy, or data retention. Back up anything important elsewhere.</p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-800 mb-1">4. Account and data deletion</h2>
            <p>You may stop using the app or request deletion of your account and data at any time.</p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-800 mb-1">5. Changes to these terms</h2>
            <p>These terms may be updated from time to time. Continued use of the app after a change means you accept the updated terms.</p>
          </section>
        </div>

        <Link href="/" className="inline-block mt-8 text-sm text-blue-600 hover:underline">
          ← Back to Todos
        </Link>
      </div>
    </div>
  )
}
