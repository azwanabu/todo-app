import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const NINETY_DAYS = 90 * 24 * 60 * 60

export async function POST(request: NextRequest) {
  const { access_token, refresh_token, remember } = await request.json()

  type PendingCookie = { name: string; value: string; options: Record<string, unknown> }
  const pending: PendingCookie[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Strip whatever maxAge/expires the library wants to set,
            // then apply our own based on the remember flag.
            const { maxAge: _m, expires: _e, ...rest } = (options ?? {}) as Record<string, unknown>
            pending.push({
              name,
              value,
              options: remember ? { ...rest, maxAge: NINETY_DAYS } : rest,
            })
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.setSession({ access_token, refresh_token })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const response = NextResponse.json({ ok: true })
  pending.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
  })
  return response
}
