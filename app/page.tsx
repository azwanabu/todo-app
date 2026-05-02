import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TodoList from '@/components/TodoList'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: todos } = await supabase
    .from('todos')
    .select('*')
    .order('inserted_at', { ascending: false })

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">My Todos</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{user.email}</span>
            <form action="/auth/signout" method="post">
              <button className="text-sm text-red-500 hover:text-red-700 transition-colors">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="max-w-xl mx-auto px-4 py-8">
        <TodoList initialTodos={todos ?? []} userId={user.id} />
      </main>
    </div>
  )
}
