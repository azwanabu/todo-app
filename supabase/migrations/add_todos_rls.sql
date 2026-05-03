-- Enable RLS on todos (idempotent)
alter table public.todos enable row level security;

-- Drop existing policies if any, then recreate cleanly
drop policy if exists "Users manage own todos" on public.todos;

create policy "Users manage own todos"
  on public.todos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
