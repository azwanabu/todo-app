import { createClient } from '@/lib/supabase/server'

const TAG_COLORS = [
  { bg: '#dbeafe', text: '#1d4ed8' },
  { bg: '#ede9fe', text: '#6d28d9' },
  { bg: '#d1fae5', text: '#047857' },
  { bg: '#fed7aa', text: '#c2410c' },
  { bg: '#fce7f3', text: '#be185d' },
  { bg: '#fef3c7', text: '#b45309' },
  { bg: '#ccfbf1', text: '#0f766e' },
  { bg: '#ffe4e6', text: '#be123c' },
  { bg: '#e0e7ff', text: '#4338ca' },
  { bg: '#cffafe', text: '#0e7490' },
]

export default async function PublicTodoPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const supabase = await createClient()

  const { data: todos } = await supabase
    .from('todos')
    .select(`
      id, task, position,
      todo_tags (
        tag_id,
        tags ( id, name, color_index )
      )
    `)
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
              <li key={todo.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-300 w-4">{i + 1}</span>
                  <span className="text-sm text-gray-800">{todo.task}</span>
                </div>
                {todo.todo_tags.length > 0 && (
                  <div className="ml-7 mt-1.5 flex flex-wrap gap-1">
                    {todo.todo_tags.map(tt => {
                      const tag = tt.tags as unknown as { id: string; name: string; color_index: number } | null
                      if (!tag) return null
                      const c = TAG_COLORS[tag.color_index % TAG_COLORS.length]
                      return (
                        <span
                          key={tt.tag_id}
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: c.bg, color: c.text }}
                        >
                          {tag.name}
                        </span>
                      )
                    })}
                  </div>
                )}
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
