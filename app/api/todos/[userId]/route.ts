import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(_: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('todos')
    .select('task, is_complete, position')
    .eq('user_id', userId)
    .eq('is_complete', false)
    .order('position', { ascending: true })
    .limit(5)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ todos: data })
}
