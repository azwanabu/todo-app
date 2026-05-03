'use client'

import { useState, useRef, useEffect } from 'react'
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

function tagColor(index: number) {
  return TAG_COLORS[index % TAG_COLORS.length]
}

type Tag = {
  id: string
  name: string
  color_index: number
  user_id: string
}

type TodoTag = {
  tag_id: string
  tags: Tag
}

type Todo = {
  id: string
  task: string
  is_complete: boolean
  inserted_at: string
  user_id: string
  position: number
  todo_tags: TodoTag[]
}

function DragHandle() {
  return (
    <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
    </svg>
  )
}

function TagPicker({
  todo,
  tags,
  onAdd,
  onRemove,
  onCreateAndAdd,
  onClose,
}: {
  todo: Todo
  tags: Tag[]
  onAdd: (todoId: string, tagId: string) => Promise<void>
  onRemove: (todoId: string, tagId: string) => Promise<void>
  onCreateAndAdd: (todoId: string, name: string) => Promise<void>
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const assignedIds = new Set(todo.todo_tags.map(tt => tt.tag_id))
  const filtered = tags.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
  const canCreate =
    search.trim() !== '' &&
    !tags.some(t => t.name.toLowerCase() === search.trim().toLowerCase())

  return (
    <div className="absolute z-50 top-full left-0 mt-1 w-52 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
      <div className="p-2 border-b border-gray-100">
        <input
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && canCreate) {
              onCreateAndAdd(todo.id, search.trim())
              onClose()
            }
            if (e.key === 'Escape') onClose()
          }}
          placeholder="Search or create tag…"
          className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>
      <div className="max-h-44 overflow-y-auto p-1">
        {filtered.map(tag => {
          const assigned = assignedIds.has(tag.id)
          const c = tagColor(tag.color_index)
          return (
            <button
              key={tag.id}
              onMouseDown={e => e.preventDefault()}
              onClick={() => (assigned ? onRemove(todo.id, tag.id) : onAdd(todo.id, tag.id))}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: c.bg, color: c.text }}
              >
                {tag.name}
              </span>
              {assigned && (
                <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          )
        })}
        {canCreate && (
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={() => { onCreateAndAdd(todo.id, search.trim()); onClose() }}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors text-xs text-gray-500"
          >
            <span className="text-blue-400 font-bold">+</span>
            Create <span className="font-medium text-gray-700">"{search.trim()}"</span>
          </button>
        )}
        {filtered.length === 0 && !canCreate && (
          <p className="text-xs text-gray-400 px-2 py-2 text-center">No tags found</p>
        )}
      </div>
    </div>
  )
}

function SortableTodoItem({
  todo,
  tags,
  onToggle,
  onDelete,
  onAddTag,
  onRemoveTag,
  onCreateAndAddTag,
  onTagFilterClick,
}: {
  todo: Todo
  tags: Tag[]
  onToggle: (t: Todo) => void
  onDelete: (id: string) => void
  onAddTag: (todoId: string, tagId: string) => Promise<void>
  onRemoveTag: (todoId: string, tagId: string) => Promise<void>
  onCreateAndAddTag: (todoId: string, name: string) => Promise<void>
  onTagFilterClick: (tagId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id,
  })
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerContainerRef = useRef<HTMLDivElement>(null)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  useEffect(() => {
    if (!pickerOpen) return
    function handler(e: MouseEvent) {
      if (pickerContainerRef.current && !pickerContainerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pickerOpen])

  const assignedTags = todo.todo_tags.map(tt => tt.tags).filter(Boolean)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border border-gray-200 rounded-xl px-4 py-3 group"
    >
      <div className="flex items-center gap-3">
        <button
          className="cursor-grab active:cursor-grabbing shrink-0 touch-none"
          {...attributes}
          {...listeners}
        >
          <DragHandle />
        </button>

        <button
          onClick={() => onToggle(todo)}
          className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
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

        <div className="flex items-center gap-1 flex-wrap justify-end">
          {assignedTags.map(tag => {
            const c = tagColor(tag.color_index)
            return (
              <span
                key={tag.id}
                className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: c.bg, color: c.text }}
              >
                <button onClick={() => onTagFilterClick(tag.id)} className="hover:underline">
                  {tag.name}
                </button>
                <button
                  onClick={() => onRemoveTag(todo.id, tag.id)}
                  className="hover:opacity-50 transition-opacity leading-none ml-0.5"
                  title="Remove tag"
                >
                  ×
                </button>
              </span>
            )
          })}

          <div className="relative" ref={pickerContainerRef}>
            <button
              onClick={() => setPickerOpen(v => !v)}
              className="text-xs text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded border border-dashed border-gray-200 hover:border-gray-400 transition-colors"
            >
              + tag
            </button>
            {pickerOpen && (
              <TagPicker
                todo={todo}
                tags={tags}
                onAdd={onAddTag}
                onRemove={onRemoveTag}
                onCreateAndAdd={onCreateAndAddTag}
                onClose={() => setPickerOpen(false)}
              />
            )}
          </div>
        </div>

        <button
          onClick={() => onDelete(todo.id)}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all text-lg leading-none shrink-0"
        >
          ×
        </button>
      </div>
    </div>
  )
}

export default function TodoList({
  initialTodos,
  initialTags,
  userId,
}: {
  initialTodos: Todo[]
  initialTags: Tag[]
  userId: string
}) {
  const sorted = [...initialTodos].sort((a, b) => a.position - b.position)
  const [todos, setTodos] = useState<Todo[]>(sorted)
  const [tags, setTags] = useState<Tag[]>(initialTags)
  const [newTask, setNewTask] = useState('')
  const [loading, setLoading] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [activeTagIds, setActiveTagIds] = useState<Set<string>>(new Set())

  const sensors = useSensors(useSensor(PointerSensor))

  function toggleTagFilter(tagId: string) {
    setCurrentPage(1)
    setShowAll(false)
    setActiveTagIds(prev => {
      const next = new Set(prev)
      if (next.has(tagId)) next.delete(tagId)
      else next.add(tagId)
      return next
    })
  }

  const filteredTodos =
    activeTagIds.size === 0
      ? todos
      : todos.filter(t => t.todo_tags.some(tt => activeTagIds.has(tt.tag_id)))

  const usePagination = filteredTodos.length > PAGE_SIZE
  const totalPages = Math.ceil(filteredTodos.length / PAGE_SIZE)

  const visibleTodos = usePagination
    ? filteredTodos.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
    : !showAll && filteredTodos.length > PREVIEW_SIZE
      ? filteredTodos.slice(0, PREVIEW_SIZE)
      : filteredTodos

  const pending = visibleTodos.filter(t => !t.is_complete)
  const completed = visibleTodos.filter(t => t.is_complete)

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
      const next = [...todos, { ...data, todo_tags: [] }]
      setTodos(next)
      setNewTask('')
      if (next.length > PAGE_SIZE) setCurrentPage(Math.ceil(next.length / PAGE_SIZE))
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
      setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, is_complete: !t.is_complete } : t))
    }
  }

  async function deleteTodo(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('todos').delete().eq('id', id)
    if (!error) {
      const next = todos.filter(t => t.id !== id)
      setTodos(next)
      const newTotal = Math.ceil(next.length / PAGE_SIZE)
      if (currentPage > newTotal && newTotal > 0) setCurrentPage(newTotal)
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
    await Promise.all(reordered.map(t => supabase.from('todos').update({ position: t.position }).eq('id', t.id)))
  }

  async function addTag(todoId: string, tagId: string) {
    const supabase = createClient()
    const { error } = await supabase.from('todo_tags').insert({ todo_id: todoId, tag_id: tagId })
    if (!error) {
      const tag = tags.find(t => t.id === tagId)
      if (tag) {
        setTodos(prev =>
          prev.map(t =>
            t.id === todoId
              ? { ...t, todo_tags: [...t.todo_tags, { tag_id: tagId, tags: tag }] }
              : t
          )
        )
      }
    }
  }

  async function removeTag(todoId: string, tagId: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('todo_tags')
      .delete()
      .eq('todo_id', todoId)
      .eq('tag_id', tagId)
    if (!error) {
      setTodos(prev =>
        prev.map(t =>
          t.id === todoId
            ? { ...t, todo_tags: t.todo_tags.filter(tt => tt.tag_id !== tagId) }
            : t
        )
      )
    }
  }

  async function createAndAddTag(todoId: string, name: string) {
    const supabase = createClient()
    const color_index = tags.length % TAG_COLORS.length
    const { data: newTag, error } = await supabase
      .from('tags')
      .insert({ name, user_id: userId, color_index })
      .select()
      .single()
    if (error || !newTag) return
    const { error: linkError } = await supabase
      .from('todo_tags')
      .insert({ todo_id: todoId, tag_id: newTag.id })
    if (!linkError) {
      setTags(prev => [...prev, newTag])
      setTodos(prev =>
        prev.map(t =>
          t.id === todoId
            ? { ...t, todo_tags: [...t.todo_tags, { tag_id: newTag.id, tags: newTag }] }
            : t
        )
      )
    }
  }

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

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          {tags.map(tag => {
            const c = tagColor(tag.color_index)
            const active = activeTagIds.has(tag.id)
            return (
              <button
                key={tag.id}
                onClick={() => toggleTagFilter(tag.id)}
                style={{
                  backgroundColor: c.bg,
                  color: c.text,
                  outline: active ? `2px solid ${c.text}` : 'none',
                  outlineOffset: '2px',
                }}
                className="text-xs px-2.5 py-1 rounded-full font-medium transition-all"
              >
                {tag.name}
              </button>
            )
          })}
          {activeTagIds.size > 0 && (
            <button
              onClick={() => { setActiveTagIds(new Set()); setCurrentPage(1) }}
              className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 transition-colors"
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {todos.length === 0 && (
        <p className="text-center text-gray-400 text-sm py-10">No todos yet. Add one above!</p>
      )}

      {filteredTodos.length === 0 && todos.length > 0 && (
        <p className="text-center text-gray-400 text-sm py-6">No todos match the selected tags.</p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        {pending.length > 0 && (
          <SortableContext items={pending.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {pending.map(todo => (
                <SortableTodoItem
                  key={todo.id}
                  todo={todo}
                  tags={tags}
                  onToggle={toggleTodo}
                  onDelete={deleteTodo}
                  onAddTag={addTag}
                  onRemoveTag={removeTag}
                  onCreateAndAddTag={createAndAddTag}
                  onTagFilterClick={toggleTagFilter}
                />
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
              <SortableTodoItem
                key={todo.id}
                todo={todo}
                tags={tags}
                onToggle={toggleTodo}
                onDelete={deleteTodo}
                onAddTag={addTag}
                onRemoveTag={removeTag}
                onCreateAndAddTag={createAndAddTag}
                onTagFilterClick={toggleTagFilter}
              />
            ))}
          </div>
        </div>
      )}

      {!usePagination && filteredTodos.length > PREVIEW_SIZE && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="w-full text-sm text-blue-500 hover:text-blue-700 py-2 transition-colors"
        >
          {showAll ? 'Show less' : `Show ${filteredTodos.length - PREVIEW_SIZE} more`}
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
          <span className="text-sm text-gray-500">Page {currentPage} of {totalPages}</span>
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
