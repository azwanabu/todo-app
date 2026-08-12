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

function tomorrowISO() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

function daysUntil(dueDate: string) {
  const [y, m, d] = dueDate.split('-').map(Number)
  const due = new Date(y, m - 1, d)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((due.getTime() - today.getTime()) / 86400000)
}

function formatDueDate(dueDate: string) {
  const [y, m, d] = dueDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function relativeDueLabel(diff: number) {
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff > 1) return `${diff}d left`
  return `${-diff}d overdue`
}

function dueDateStyle(diff: number, done: boolean) {
  if (done) return { bg: '#f3f4f6', text: '#6b7280' }
  if (diff < 0) return { bg: '#fee2e2', text: '#b91c1c' }
  if (diff === 0) return { bg: '#fef3c7', text: '#b45309' }
  if (diff <= 3) return { bg: '#dbeafe', text: '#1d4ed8' }
  return { bg: '#f3f4f6', text: '#4b5563' }
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
  due_date: string
  todo_tags: TodoTag[]
}

function DragHandle() {
  return (
    <svg className="w-4 h-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
      <circle cx="6" cy="4" r="1.6" />
      <circle cx="14" cy="4" r="1.6" />
      <circle cx="6" cy="10" r="1.6" />
      <circle cx="14" cy="10" r="1.6" />
      <circle cx="6" cy="16" r="1.6" />
      <circle cx="14" cy="16" r="1.6" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 7h16M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2m3 0-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6"
      />
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
            if (e.key === 'Enter' && canCreate) { onCreateAndAdd(todo.id, search.trim()); onClose() }
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
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: c.bg, color: c.text }}>
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

function NewTaskTagPicker({
  tags,
  selectedIds,
  onToggle,
  onCreateAndSelect,
  onClose,
}: {
  tags: Tag[]
  selectedIds: string[]
  onToggle: (tagId: string) => void
  onCreateAndSelect: (name: string) => Promise<void>
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const assignedIds = new Set(selectedIds)
  const filtered = tags.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
  const canCreate =
    search.trim() !== '' &&
    !tags.some(t => t.name.toLowerCase() === search.trim().toLowerCase())

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref} className="absolute z-50 top-full left-0 mt-1 w-52 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
      <div className="p-2 border-b border-gray-100">
        <input
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && canCreate) { onCreateAndSelect(search.trim()); setSearch('') }
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
              onClick={() => onToggle(tag.id)}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: c.bg, color: c.text }}>
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
            onClick={() => { onCreateAndSelect(search.trim()); setSearch('') }}
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

function DueDatePicker({
  value,
  onChange,
  onClose,
}: {
  value: string
  onChange: (date: string) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref} className="absolute z-50 top-full left-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg p-2">
      <input
        type="date"
        autoFocus
        defaultValue={value}
        onChange={e => {
          if (e.target.value) onChange(e.target.value)
          onClose()
        }}
        className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
    </div>
  )
}

function ManageTagsModal({
  tags,
  tagCounts,
  onClose,
  onCreate,
  onRename,
  onDelete,
  onUpdateColor,
}: {
  tags: Tag[]
  tagCounts: Record<string, number>
  onClose: () => void
  onCreate: (name: string) => Promise<void>
  onRename: (tagId: string, name: string) => Promise<void>
  onDelete: (tagId: string) => Promise<void>
  onUpdateColor: (tagId: string, colorIndex: number) => Promise<void>
}) {
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [colorPickerId, setColorPickerId] = useState<string | null>(null)

  function commitRename(tag: Tag) {
    const trimmed = editingName.trim()
    if (trimmed && trimmed !== tag.name) onRename(tag.id, trimmed)
    setEditingId(null)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-800">Manage tags</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>

        <div className="space-y-1 max-h-64 overflow-y-auto mb-3">
          {tags.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No tags yet.</p>}
          {tags.map(tag => {
            const c = tagColor(tag.color_index)
            const count = tagCounts[tag.id] ?? 0
            return (
              <div key={tag.id} className="relative flex items-center gap-2">
                <button
                  onClick={() => setColorPickerId(v => (v === tag.id ? null : tag.id))}
                  className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-offset-1 ring-transparent hover:ring-gray-300 transition-shadow"
                  style={{ backgroundColor: c.text }}
                  title="Change color"
                />
                {colorPickerId === tag.id && (
                  <div className="absolute z-10 top-full left-0 mt-1 flex flex-wrap gap-1.5 w-32 bg-white rounded-xl border border-gray-200 shadow-lg p-2">
                    {TAG_COLORS.map((color, idx) => (
                      <button
                        key={idx}
                        onClick={() => { onUpdateColor(tag.id, idx); setColorPickerId(null) }}
                        className="w-4 h-4 rounded-full shrink-0 ring-1 ring-offset-1 ring-transparent hover:ring-gray-400 transition-shadow"
                        style={{ backgroundColor: color.text, outline: tag.color_index === idx ? '2px solid #6b7280' : 'none', outlineOffset: '1px' }}
                        title={`Color ${idx + 1}`}
                      />
                    ))}
                  </div>
                )}
                {editingId === tag.id ? (
                  <input
                    autoFocus
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRename(tag)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    onBlur={() => commitRename(tag)}
                    className="flex-1 text-xs px-2 py-1 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                ) : (
                  <button
                    onClick={() => { setEditingId(tag.id); setEditingName(tag.name) }}
                    className="flex-1 text-left text-xs px-2 py-1 rounded-lg hover:bg-gray-50 text-gray-700 truncate"
                  >
                    {tag.name}
                  </button>
                )}
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                    count === 0 ? 'bg-amber-50 text-amber-500' : 'bg-gray-100 text-gray-400'
                  }`}
                  title={count === 0 ? 'Not used by any task' : `Used by ${count} task${count === 1 ? '' : 's'}`}
                >
                  {count === 0 ? 'unused' : `${count} task${count === 1 ? '' : 's'}`}
                </span>
                <button
                  onClick={() => {
                    const message = count > 0
                      ? `Delete tag "${tag.name}"? It will be removed from ${count} task${count === 1 ? '' : 's'}.`
                      : `Delete tag "${tag.name}"?`
                    if (confirm(message)) onDelete(tag.id)
                  }}
                  className="text-gray-300 hover:text-red-400 transition-colors text-sm leading-none px-1 shrink-0"
                  title="Delete tag"
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>

        <form
          onSubmit={e => {
            e.preventDefault()
            if (!newName.trim()) return
            onCreate(newName.trim())
            setNewName('')
          }}
          className="flex gap-2"
        >
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="New tag name…"
            className="flex-1 text-xs px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            className="text-xs bg-blue-600 text-white rounded-lg px-3 py-1.5 font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Add
          </button>
        </form>
      </div>
    </div>
  )
}

type ItemProps = {
  todo: Todo
  tags: Tag[]
  onToggle: (t: Todo) => void
  onDelete: (id: string) => void
  onAddTag: (todoId: string, tagId: string) => Promise<void>
  onRemoveTag: (todoId: string, tagId: string) => Promise<void>
  onCreateAndAddTag: (todoId: string, name: string) => Promise<void>
  onTagFilterClick: (tagId: string) => void
  onUpdateDueDate: (todoId: string, dueDate: string) => Promise<void>
  onUpdateTask: (todoId: string, task: string) => Promise<void>
  dragDisabledReason?: string
}

function ItemBody({
  todo,
  tags,
  onToggle,
  onDelete,
  onAddTag,
  onRemoveTag,
  onCreateAndAddTag,
  onTagFilterClick,
  onUpdateDueDate,
  onUpdateTask,
  dragHandleProps,
  dragDisabledReason,
}: ItemProps & { dragHandleProps?: React.HTMLAttributes<HTMLButtonElement> }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [dueDatePickerOpen, setDueDatePickerOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(false)
  const [taskDraft, setTaskDraft] = useState(todo.task)
  const pickerContainerRef = useRef<HTMLDivElement>(null)

  function commitTask() {
    const trimmed = taskDraft.trim()
    if (trimmed && trimmed !== todo.task) onUpdateTask(todo.id, trimmed)
    else setTaskDraft(todo.task)
    setEditingTask(false)
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
  const diff = daysUntil(todo.due_date)
  const dueStyle = dueDateStyle(diff, todo.is_complete)

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 md:px-5 md:py-3.5 lg:px-6 lg:py-4 group">
      <div className="flex items-center gap-3 md:gap-4">
        {dragHandleProps ? (
          <button
            className="cursor-grab active:cursor-grabbing shrink-0 touch-none rounded bg-gray-50 p-1 -m-1 hover:bg-gray-100 transition-colors"
            title="Drag to reorder"
            {...dragHandleProps}
          >
            <DragHandle />
          </button>
        ) : dragDisabledReason ? (
          <button
            type="button"
            disabled
            title={dragDisabledReason}
            className="shrink-0 rounded bg-gray-50 p-1 -m-1 opacity-50 cursor-not-allowed"
          >
            <DragHandle />
          </button>
        ) : (
          <div className="w-4 shrink-0" />
        )}

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

        <div className="flex-1 flex flex-col md:flex-row md:items-center gap-1 md:gap-2 min-w-0">
          {editingTask ? (
            <input
              autoFocus
              value={taskDraft}
              onChange={e => setTaskDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitTask()
                if (e.key === 'Escape') { setTaskDraft(todo.task); setEditingTask(false) }
              }}
              onBlur={commitTask}
              className="text-sm md:text-base md:flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800"
            />
          ) : (
            <span
              onClick={() => { setTaskDraft(todo.task); setEditingTask(true) }}
              className={`text-sm md:text-base md:flex-1 min-w-0 cursor-text rounded-lg px-2 py-0.5 -mx-2 hover:bg-gray-50 transition-colors ${todo.is_complete ? 'line-through text-gray-400' : 'text-gray-800'}`}
              title="Click to edit"
            >
              {todo.task}
            </span>
          )}
          <div className="flex items-center gap-1 flex-wrap">
            <div className="relative shrink-0">
              <button
                onClick={() => setDueDatePickerOpen(v => !v)}
                className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
                style={{ backgroundColor: dueStyle.bg, color: dueStyle.text }}
                title="Change due date"
              >
                {formatDueDate(todo.due_date)} · {relativeDueLabel(diff)}
              </button>
              {dueDatePickerOpen && (
                <DueDatePicker
                  value={todo.due_date}
                  onChange={date => onUpdateDueDate(todo.id, date)}
                  onClose={() => setDueDatePickerOpen(false)}
                />
              )}
            </div>
            {assignedTags.map(tag => {
              const c = tagColor(tag.color_index)
              return (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: c.bg, color: c.text }}
                >
                  <button onClick={() => onTagFilterClick(tag.id)} className="hover:underline">{tag.name}</button>
                  <button
                    onClick={() => onRemoveTag(todo.id, tag.id)}
                    className="hover:opacity-50 transition-opacity leading-none ml-0.5"
                    title="Remove tag"
                  >×</button>
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
        </div>

        <button
          onClick={() => onDelete(todo.id)}
          title="Delete task"
          className="text-gray-400 hover:text-red-500 transition-colors shrink-0 rounded p-1 -m-1 hover:bg-red-50"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  )
}

function SortableTodoItem(props: ItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.todo.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
    >
      <ItemBody {...props} dragHandleProps={{ ...attributes, ...listeners } as React.HTMLAttributes<HTMLButtonElement>} />
    </div>
  )
}

function DoneItem(props: ItemProps) {
  return <ItemBody {...props} />
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
  const [newDueDate, setNewDueDate] = useState(tomorrowISO())
  const [loading, setLoading] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [activeTagIds, setActiveTagIds] = useState<Set<string>>(new Set())
  const [noTagFilter, setNoTagFilter] = useState(false)
  const [dueDateFrom, setDueDateFrom] = useState('')
  const [dueDateTo, setDueDateTo] = useState('')
  const [activeTab, setActiveTab] = useState<'todo' | 'done'>('todo')
  const [sortMode, setSortMode] = useState<'default' | 'due'>('default')
  const [manageTagsOpen, setManageTagsOpen] = useState(false)
  const [newTagIds, setNewTagIds] = useState<string[]>([])
  const [newTaskPickerOpen, setNewTaskPickerOpen] = useState(false)

  const filterStorageKey = `todo-filter-tags:${userId}`
  const noTagFilterStorageKey = `todo-filter-no-tag:${userId}`
  const dueRangeStorageKey = `todo-filter-due-range:${userId}`
  const sortStorageKey = `todo-sort-mode:${userId}`
  const defaultDateStorageKey = `todo-default-date:${userId}`

  useEffect(() => {
    try {
      const storedFilter = localStorage.getItem(filterStorageKey)
      if (storedFilter) setActiveTagIds(new Set(JSON.parse(storedFilter)))
      const storedNoTag = localStorage.getItem(noTagFilterStorageKey)
      if (storedNoTag) setNoTagFilter(storedNoTag === 'true')
      const storedDueRange = localStorage.getItem(dueRangeStorageKey)
      if (storedDueRange) {
        const parsed = JSON.parse(storedDueRange)
        if (parsed.from) setDueDateFrom(parsed.from)
        if (parsed.to) setDueDateTo(parsed.to)
      }
      const storedSort = localStorage.getItem(sortStorageKey)
      if (storedSort === 'default' || storedSort === 'due') setSortMode(storedSort)
      const storedDate = localStorage.getItem(defaultDateStorageKey)
      if (storedDate) setNewDueDate(storedDate)
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function changeNewDueDate(date: string) {
    setNewDueDate(date)
    try {
      localStorage.setItem(defaultDateStorageKey, date)
    } catch {}
  }

  useEffect(() => {
    try {
      localStorage.setItem(filterStorageKey, JSON.stringify(Array.from(activeTagIds)))
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTagIds])

  useEffect(() => {
    try {
      localStorage.setItem(noTagFilterStorageKey, String(noTagFilter))
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noTagFilter])

  useEffect(() => {
    try {
      localStorage.setItem(dueRangeStorageKey, JSON.stringify({ from: dueDateFrom, to: dueDateTo }))
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dueDateFrom, dueDateTo])

  useEffect(() => {
    try {
      localStorage.setItem(sortStorageKey, sortMode)
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortMode])

  const sensors = useSensors(useSensor(PointerSensor))

  function switchTab(tab: 'todo' | 'done') {
    setActiveTab(tab)
    setCurrentPage(1)
    setShowAll(false)
  }

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

  function toggleNoTagFilter() {
    setCurrentPage(1)
    setShowAll(false)
    setNoTagFilter(v => !v)
  }

  function updateDueDateFrom(value: string) {
    setCurrentPage(1)
    setShowAll(false)
    setDueDateFrom(value)
  }

  function updateDueDateTo(value: string) {
    setCurrentPage(1)
    setShowAll(false)
    setDueDateTo(value)
  }

  function clearDueDateFilter() {
    setCurrentPage(1)
    setShowAll(false)
    setDueDateFrom('')
    setDueDateTo('')
  }

  const tagCounts = todos.reduce<Record<string, number>>((counts, t) => {
    for (const tt of t.todo_tags) counts[tt.tag_id] = (counts[tt.tag_id] ?? 0) + 1
    return counts
  }, {})

  const hasTagFilter = activeTagIds.size > 0 || noTagFilter

  const filteredTodos = todos.filter(t => {
    if (hasTagFilter) {
      const matchesNoTag = noTagFilter && t.todo_tags.length === 0
      const matchesTag = t.todo_tags.some(tt => activeTagIds.has(tt.tag_id))
      if (!matchesNoTag && !matchesTag) return false
    }
    if (dueDateFrom && t.due_date < dueDateFrom) return false
    if (dueDateTo && t.due_date > dueDateTo) return false
    return true
  })

  const hasDueDateFilter = dueDateFrom !== '' || dueDateTo !== ''

  const filteredPending = filteredTodos.filter(t => !t.is_complete)
  const filteredCompleted = filteredTodos.filter(t => t.is_complete)
  const baseTabItems = activeTab === 'todo' ? filteredPending : filteredCompleted
  const currentTabItems =
    sortMode === 'due'
      ? [...baseTabItems].sort((a, b) => a.due_date.localeCompare(b.due_date))
      : baseTabItems
  const isDraggable = activeTab === 'todo' && sortMode === 'default'

  const usePagination = currentTabItems.length > PAGE_SIZE
  const totalPages = Math.ceil(currentTabItems.length / PAGE_SIZE)

  const visibleItems = usePagination
    ? currentTabItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
    : !showAll && currentTabItems.length > PREVIEW_SIZE
      ? currentTabItems.slice(0, PREVIEW_SIZE)
      : currentTabItems

  async function addTodo(e: React.FormEvent) {
    e.preventDefault()
    if (!newTask.trim()) return
    setLoading(true)
    const supabase = createClient()
    const maxPosition = todos.length > 0 ? Math.max(...todos.map(t => t.position)) + 1 : 0
    const { data, error } = await supabase
      .from('todos')
      .insert({
        task: newTask.trim(),
        user_id: userId,
        is_complete: false,
        position: maxPosition,
        due_date: newDueDate || tomorrowISO(),
      })
      .select()
      .single()
    if (!error && data) {
      let todoTags: TodoTag[] = []
      if (newTagIds.length > 0) {
        const { data: linkData, error: linkError } = await supabase
          .from('todo_tags')
          .insert(newTagIds.map(tagId => ({ todo_id: data.id, tag_id: tagId })))
          .select()
        if (!linkError && linkData) {
          todoTags = linkData
            .map(l => ({ tag_id: l.tag_id, tags: tags.find(t => t.id === l.tag_id) as Tag }))
            .filter(tt => tt.tags)
        }
      }
      setTodos(prev => [...prev, { ...data, todo_tags: todoTags }])
      setNewTask('')
      setNewTagIds([])
      if (activeTab !== 'todo') switchTab('todo')
    }
    setLoading(false)
  }

  function toggleNewTagId(tagId: string) {
    setNewTagIds(prev => prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId])
  }

  async function createAndSelectNewTag(name: string) {
    const supabase = createClient()
    const color_index = tags.length % TAG_COLORS.length
    const { data: newTag, error } = await supabase.from('tags').insert({ name, user_id: userId, color_index }).select().single()
    if (error || !newTag) return
    setTags(prev => [...prev, newTag])
    setNewTagIds(prev => [...prev, newTag.id])
  }

  async function updateDueDate(todoId: string, dueDate: string) {
    const supabase = createClient()
    const { error } = await supabase.from('todos').update({ due_date: dueDate }).eq('id', todoId)
    if (!error) setTodos(prev => prev.map(t => t.id === todoId ? { ...t, due_date: dueDate } : t))
  }

  async function updateTask(todoId: string, task: string) {
    const supabase = createClient()
    const { error } = await supabase.from('todos').update({ task }).eq('id', todoId)
    if (!error) setTodos(prev => prev.map(t => t.id === todoId ? { ...t, task } : t))
  }

  async function toggleTodo(todo: Todo) {
    const supabase = createClient()
    const { error } = await supabase.from('todos').update({ is_complete: !todo.is_complete }).eq('id', todo.id)
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
      const newTotal = Math.ceil(next.filter(t => t.is_complete === (activeTab === 'done')).length / PAGE_SIZE)
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
      if (tag) setTodos(prev => prev.map(t => t.id === todoId ? { ...t, todo_tags: [...t.todo_tags, { tag_id: tagId, tags: tag }] } : t))
    }
  }

  async function removeTag(todoId: string, tagId: string) {
    const supabase = createClient()
    const { error } = await supabase.from('todo_tags').delete().eq('todo_id', todoId).eq('tag_id', tagId)
    if (!error) setTodos(prev => prev.map(t => t.id === todoId ? { ...t, todo_tags: t.todo_tags.filter(tt => tt.tag_id !== tagId) } : t))
  }

  async function createAndAddTag(todoId: string, name: string) {
    const supabase = createClient()
    const color_index = tags.length % TAG_COLORS.length
    const { data: newTag, error } = await supabase.from('tags').insert({ name, user_id: userId, color_index }).select().single()
    if (error || !newTag) return
    const { error: linkError } = await supabase.from('todo_tags').insert({ todo_id: todoId, tag_id: newTag.id })
    if (!linkError) {
      setTags(prev => [...prev, newTag])
      setTodos(prev => prev.map(t => t.id === todoId ? { ...t, todo_tags: [...t.todo_tags, { tag_id: newTag.id, tags: newTag }] } : t))
    }
  }

  async function createTag(name: string) {
    const supabase = createClient()
    const color_index = tags.length % TAG_COLORS.length
    const { data, error } = await supabase.from('tags').insert({ name, user_id: userId, color_index }).select().single()
    if (!error && data) setTags(prev => [...prev, data])
  }

  async function renameTag(tagId: string, name: string) {
    const supabase = createClient()
    const { error } = await supabase.from('tags').update({ name }).eq('id', tagId)
    if (!error) {
      setTags(prev => prev.map(t => t.id === tagId ? { ...t, name } : t))
      setTodos(prev => prev.map(t => ({
        ...t,
        todo_tags: t.todo_tags.map(tt => tt.tag_id === tagId ? { ...tt, tags: { ...tt.tags, name } } : tt),
      })))
    }
  }

  async function updateTagColor(tagId: string, colorIndex: number) {
    const supabase = createClient()
    const { error } = await supabase.from('tags').update({ color_index: colorIndex }).eq('id', tagId)
    if (!error) {
      setTags(prev => prev.map(t => t.id === tagId ? { ...t, color_index: colorIndex } : t))
      setTodos(prev => prev.map(t => ({
        ...t,
        todo_tags: t.todo_tags.map(tt => tt.tag_id === tagId ? { ...tt, tags: { ...tt.tags, color_index: colorIndex } } : tt),
      })))
    }
  }

  async function deleteTag(tagId: string) {
    const supabase = createClient()
    const { error } = await supabase.from('tags').delete().eq('id', tagId)
    if (!error) {
      setTags(prev => prev.filter(t => t.id !== tagId))
      setTodos(prev => prev.map(t => ({ ...t, todo_tags: t.todo_tags.filter(tt => tt.tag_id !== tagId) })))
      setActiveTagIds(prev => {
        const next = new Set(prev)
        next.delete(tagId)
        return next
      })
    }
  }

  const itemProps = {
    tags,
    onToggle: toggleTodo,
    onDelete: deleteTodo,
    onAddTag: addTag,
    onRemoveTag: removeTag,
    onCreateAndAddTag: createAndAddTag,
    onTagFilterClick: toggleTagFilter,
    onUpdateDueDate: updateDueDate,
    onUpdateTask: updateTask,
    dragDisabledReason:
      activeTab === 'todo' && sortMode === 'due'
        ? 'Switch to Default order to drag and reorder'
        : undefined,
  }

  return (
    <div className="space-y-4 md:space-y-5">
      <form onSubmit={addTodo} className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={newTask}
            onChange={e => setNewTask(e.target.value)}
            placeholder="What needs to be done?"
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 md:py-3 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="date"
            value={newDueDate}
            onChange={e => changeNewDueDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {newTagIds.map(tagId => {
            const tag = tags.find(t => t.id === tagId)
            if (!tag) return null
            const c = tagColor(tag.color_index)
            return (
              <span
                key={tagId}
                className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: c.bg, color: c.text }}
              >
                {tag.name}
                <button
                  type="button"
                  onClick={() => toggleNewTagId(tagId)}
                  className="hover:opacity-50 transition-opacity leading-none ml-0.5"
                  title="Remove tag"
                >×</button>
              </span>
            )
          })}
          <div className="relative">
            <button
              type="button"
              onClick={() => setNewTaskPickerOpen(v => !v)}
              className="text-xs text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded border border-dashed border-gray-200 hover:border-gray-400 transition-colors"
            >
              + tag
            </button>
            {newTaskPickerOpen && (
              <NewTaskTagPicker
                tags={tags}
                selectedIds={newTagIds}
                onToggle={toggleNewTagId}
                onCreateAndSelect={createAndSelectNewTag}
                onClose={() => setNewTaskPickerOpen(false)}
              />
            )}
          </div>
        </div>
        <button
          type="submit"
          disabled={loading || !newTask.trim()}
          className="w-full sm:w-auto bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          Add
        </button>
      </form>

      <div className="flex flex-wrap gap-1.5 items-center">
        {tags.map(tag => {
          const c = tagColor(tag.color_index)
          const active = activeTagIds.has(tag.id)
          return (
            <button
              key={tag.id}
              onClick={() => toggleTagFilter(tag.id)}
              style={{ backgroundColor: c.bg, color: c.text, outline: active ? `2px solid ${c.text}` : 'none', outlineOffset: '2px' }}
              className="text-xs px-2.5 py-1 rounded-full font-medium transition-all"
            >
              {tag.name}
            </button>
          )
        })}
        <button
          onClick={toggleNoTagFilter}
          style={{ outline: noTagFilter ? '2px solid #6b7280' : 'none', outlineOffset: '2px' }}
          className="text-xs px-2.5 py-1 rounded-full font-medium bg-gray-100 text-gray-500 transition-all"
        >
          No tag
        </button>
        {hasTagFilter && (
          <button
            onClick={() => { setActiveTagIds(new Set()); setNoTagFilter(false); setCurrentPage(1) }}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 transition-colors"
          >
            Clear filter
          </button>
        )}
        <button
          onClick={() => setManageTagsOpen(true)}
          className="text-xs text-gray-400 hover:text-gray-600 underline px-2 py-1 transition-colors"
        >
          Manage tags
        </button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-400">Due date:</span>
        <input
          type="date"
          value={dueDateFrom}
          onChange={e => updateDueDateFrom(e.target.value)}
          max={dueDateTo || undefined}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <span className="text-xs text-gray-400">to</span>
        <input
          type="date"
          value={dueDateTo}
          onChange={e => updateDueDateTo(e.target.value)}
          min={dueDateFrom || undefined}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        {hasDueDateFilter && (
          <button
            onClick={clearDueDateFilter}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 transition-colors"
          >
            Clear dates
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-gray-200">
        <div className="flex">
          <button
            onClick={() => switchTab('todo')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'todo'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            To Do
            {filteredPending.length > 0 && (
              <span className="ml-1.5 text-xs bg-blue-100 text-blue-600 rounded-full px-1.5 py-0.5">{filteredPending.length}</span>
            )}
          </button>
          <button
            onClick={() => switchTab('done')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'done'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Done
            {filteredCompleted.length > 0 && (
              <span className="ml-1.5 text-xs bg-green-100 text-green-600 rounded-full px-1.5 py-0.5">{filteredCompleted.length}</span>
            )}
          </button>
        </div>
        <select
          value={sortMode}
          onChange={e => { setSortMode(e.target.value as 'default' | 'due'); setCurrentPage(1) }}
          className="text-xs text-gray-500 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="default">Default order</option>
          <option value="due">Sort by due date</option>
        </select>
      </div>

      {todos.length === 0 && (
        <p className="text-center text-gray-400 text-sm py-10">No todos yet. Add one above!</p>
      )}

      {currentTabItems.length === 0 && todos.length > 0 && (
        <p className="text-center text-gray-400 text-sm py-8">
          {hasTagFilter || hasDueDateFilter
            ? 'No tasks match the selected filters.'
            : activeTab === 'todo'
              ? 'All done! Nothing left to do.'
              : 'No completed tasks yet.'}
        </p>
      )}

      {visibleItems.length > 0 && (
        isDraggable ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={visibleItems.map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2 md:space-y-2.5 lg:space-y-3">
                {visibleItems.map(todo => (
                  <SortableTodoItem key={todo.id} todo={todo} {...itemProps} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="space-y-2 md:space-y-2.5 lg:space-y-3">
            {visibleItems.map(todo => (
              <DoneItem key={todo.id} todo={todo} {...itemProps} />
            ))}
          </div>
        )
      )}

      {!usePagination && currentTabItems.length > PREVIEW_SIZE && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="w-full text-sm text-blue-500 hover:text-blue-700 py-2 transition-colors"
        >
          {showAll ? 'Show less' : `Show ${currentTabItems.length - PREVIEW_SIZE} more`}
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

      {manageTagsOpen && (
        <ManageTagsModal
          tags={tags}
          tagCounts={tagCounts}
          onClose={() => setManageTagsOpen(false)}
          onCreate={createTag}
          onRename={renameTag}
          onDelete={deleteTag}
          onUpdateColor={updateTagColor}
        />
      )}
    </div>
  )
}
