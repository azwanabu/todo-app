'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createClient } from '@/lib/supabase/client'

const PREVIEW_SIZE = 5
const PAGE_SIZE = 20

type Todo = {
  id: string
  task: string
  is_complete: boolean
  inserted_at: string
  user_id: string
  position: number
}

function DragHandle() {
  return (
    <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
    </svg>
  )
}

function SortableTodoItem({
  todo,
  onToggle,
  onDelete,
}: {
  todo: Todo
  onToggle: (t: Todo) => void
  onDelete: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 group"
    >
      <button
        className="cursor-grab active:cursor-grabbing flex-shrink-0 touch-none"
        {...attributes}
        {...listeners}
      >
        <DragHandle />
      </button>

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

export default function TodoList({
  initialTodos,
  userId,
}: {
  initialTodos: Todo[]
  userId: string
}) {
  const sorted = [...initialTodos].sort((a, b) => a.position - b.position)
  const [todos, setTodos] = useState<Todo[]>(sorted)
  const [newTask, setNewTask] = useState('')
  const [loading, setLoading] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const sensors = useSensors(useSensor(PointerSensor))

  const usePagination = todos.length > PAGE_SIZE
  const totalPages = Math.ceil(todos.length / PAGE_SIZE)

  const visibleTodos = usePagination
    ? todos.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
    : !showAll && todos.length > PREVIEW_SIZE
      ? todos.slice(0, PREVIEW_SIZE)
      : todos

  async function addTodo(e: React.FormEvent) {
    e.preventDefault()
    if (!newTask.trim()) return
    setLoading(true)

    const supabase = createClient()
    const maxPosition = todos.length > 0 ? Math.max(...todos.map(t => t.position)) + 1 : 0
    const { data, error } = await supabase
      .from('todos')
      .insert({ task: newTask.trim(), user_id: userId, is_complete: false, position: maxPosition })
      .select()
      .single()

    if (!error && data) {
      const next = [...todos, data]
      setTodos(next)
      setNewTask('')
      if (next.length > PAGE_SIZE) {
        setCurrentPage(Math.ceil(next.length / PAGE_SIZE))
      }
    }
    setLoading(false)
  }

  async function toggleTodo(todo: Todo) {
    const supabase = createClient()
    const { error } = await supabase
      .from('todos')
      .update({ is_complete: !todo.is_complete })
      .eq('id', todo.id)

    if (!error) {
      setTodos(todos.map(t => t.id === todo.id ? { ...t, is_complete: !t.is_complete } : t))
    }
  }

  async function deleteTodo(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('todos').delete().eq('id', id)
    if (!error) {
      const next = todos.filter(t => t.id !== id)
      setTodos(next)
      const newTotalPages = Math.ceil(next.length / PAGE_SIZE)
      if (currentPage > newTotalPages && newTotalPages > 0) {
        setCurrentPage(newTotalPages)
      }
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = todos.findIndex(t => t.id === active.id)
    const newIndex = todos.findIndex(t => t.id === over.id)
    const reordered = arrayMove(todos, oldIndex, newIndex).map((t, i) => ({ ...t, position: i }))
    setTodos(reordered)

    const supabase = createClient()
    await Promise.all(
      reordered.map(t => supabase.from('todos').update({ position: t.position }).eq('id', t.id))
    )
  }

  const pending = visibleTodos.filter(t => !t.is_complete)
  const completed = visibleTodos.filter(t => t.is_complete)

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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        {pending.length > 0 && (
          <SortableContext items={pending.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {pending.map(todo => (
                <SortableTodoItem key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
              ))}
            </div>
          </SortableContext>
        )}
      </DndContext>

      {completed.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Completed</p>
          <div className="space-y-2">
            {completed.map(todo => (
              <SortableTodoItem key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
            ))}
          </div>
        </div>
      )}

      {!usePagination && todos.length > PREVIEW_SIZE && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="w-full text-sm text-blue-500 hover:text-blue-700 py-2 transition-colors"
        >
          {showAll
            ? 'Show less'
            : `Show ${todos.length - PREVIEW_SIZE} more`}
        </button>
      )}

      {usePagination && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
