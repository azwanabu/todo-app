import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TodoList from '@/components/TodoList'

async function TodosLoader({ userId }: { userId: string }) {
  const supabase = await createClient()

  const [{ data: todosWithTags, error: todosError }, { data: tags }] = await Promise.all([
    supabase
      .from('todos')
      .select(`
        *,
        todo_tags (
          tag_id,
          tags ( id, name, color_index, user_id )
        )
      `)
      .eq('user_id', userId)
      .order('position', { ascending: true }),
    supabase
      .from('tags')
      .select('*')
      .eq('user_id', userId)
      .order('inserted_at', { ascending: true }),
  ])

  let todos = todosWithTags
  if (todosError) {
    const { data: plainTodos } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', userId)
      .order('position', { ascending: true })
    todos = plainTodos?.map(t => ({ ...t, todo_tags: [] })) ?? []
  }

  return <TodoList initialTodos={todos ?? []} initialTags={tags ?? []} userId={userId} />
}

function TodosSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
      <div className="h-8 w-32 bg-gray-100 rounded animate-pulse" />
      {[0, 1, 2].map(i => (
        <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
      ))}
    </div>
  )
}

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const shareUrl = `${(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://todo.qprm.com').trim().replace(/\/$/, '')}/u/${user.id}`

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">My Todos</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 truncate max-w-35 sm:max-w-none">{user.email}</span>
            <form action="/auth/signout" method="post">
              <button className="text-sm text-red-500 hover:text-red-700 transition-colors">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="max-w-xl mx-auto px-4 py-8">
        <Suspense fallback={<TodosSkeleton />}>
          <TodosLoader userId={user.id} />
        </Suspense>
        <div className="mt-10 pt-6 border-t border-gray-200">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Your public top-5 link</p>
          <a href={shareUrl} target="_blank" className="text-sm text-blue-500 hover:underline break-all">
            {shareUrl}
          </a>
        </div>
      </main>
    </div>
  )
}
