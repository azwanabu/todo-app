'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Todo = {
  id: string
  task: string
  is_complete: boolean
  inserted_at: string
  user_id: string
}

export default function TodoList({ initialTodos, userId }: { initialTodos: Todo[], userId: string }) {
  const [todos, setTodos] = useState<Todo[]>(initialTodos)
  const [newTask, setNewTask] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function addTodo(e: React.FormEvent) {
    e.preventDefault()
    if (!newTask.trim()) return
    setLoading(true)

    const { data, error } = await supabase
      .from('todos')
      .insert({ task: newTask.trim(), user_id: userId, is_complete: false })
      .select()
      .single()

    if (!error && data) {
      setTodos([data, ...todos])
      setNewTask('')
    }
    setLoading(false)
  }

  async function toggleTodo(todo: Todo) {
    const { error } = await supabase
      .from('todos')
      .update({ is_complete: !todo.is_complete })
      .eq('id', todo.id)

    if (!error) {
      setTodos(todos.map(t => t.id === todo.id ? { ...t, is_complete: !t.is_complete } : t))
    }
  }

  async function deleteTodo(id: string) {
    const { error } = await supabase.from('todos').delete().eq('id', id)
    if (!error) {
      setTodos(todos.filter(t => t.id !== id))
    }
  }

  const pending = todos.filter(t => !t.is_complete)
  const completed = todos.filter(t => t.is_complete)

  return (
    <div className="space-y-6">
      <form onSubmit={addTodo} className="flex gap-2">
        <input
          type="text"
          value={newTask}
          onChange={e => setNewTask(e.target.value)}
          placeholder="What needs to be done?"
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading || !newTask.trim()}
          className="bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          Add
        </button>
      </form>

      {todos.length === 0 && (
        <p className="text-center text-gray-400 text-sm py-10">No todos yet. Add one above!</p>
      )}

      {pending.length > 0 && (
        <div className="space-y-2">
          {pending.map(todo => (
            <TodoItem key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Completed</p>
          <div className="space-y-2">
            {completed.map(todo => (
              <TodoItem key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TodoItem({ todo, onToggle, onDelete }: { todo: Todo, onToggle: (t: Todo) => void, onDelete: (id: string) => void }) {
  return (
    <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 group">
      <button
        onClick={() => onToggle(todo)}
        className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
          todo.is_complete
            ? 'bg-green-500 border-green-500 text-white'
            : 'border-gray-300 hover:border-blue-400'
        }`}
      >
        {todo.is_complete && (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <span className={`flex-1 text-sm ${todo.is_complete ? 'line-through text-gray-400' : 'text-gray-800'}`}>
        {todo.task}
      </span>
      <button
        onClick={() => onDelete(todo.id)}
        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all text-lg leading-none"
      >
        ×
      </button>
    </div>
  )
}
