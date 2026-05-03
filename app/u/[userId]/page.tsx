import { createClient } from '@/lib/supabase/server'

export default async function PublicTodoPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const supabase = await createClient()

  const { data: todos } = await supabase
    .from('todos')
    .select('id, task, position')
    .eq('user_id', userId)
    .eq('is_complete', false)
    .order('position', { ascending: true })
    .limit(5)

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Top 5 Todos</h1>
        <p className="text-xs text-gray-400 mb-6">Live · no login required</p>

        {!todos || todos.length === 0 ? (
          <p className="text-sm text-gray-400">Nothing here yet.</p>
        ) : (
          <ol className="space-y-3">
            {todos.map((todo, i) => (
              <li key={todo.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
                <span className="text-sm font-bold text-gray-300 w-4">{i + 1}</span>
                <span className="text-sm text-gray-800">{todo.task}</span>
              </li>
            ))}
          </ol>
        )}

        <p className="text-xs text-gray-300 mt-8 text-center">
          Powered by todo-app · <a href="/login" className="text-orange-400 hover:text-orange-500">Login</a>
        </p>
      </div>
    </div>
  )
}
