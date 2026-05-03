create table public.tags (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  color_index integer not null default 0,
  inserted_at timestamptz default now() not null,
  unique(user_id, name)
);

create table public.todo_tags (
  todo_id uuid references public.todos(id) on delete cascade not null,
  tag_id uuid references public.tags(id) on delete cascade not null,
  primary key (todo_id, tag_id)
);

alter table public.tags enable row level security;
alter table public.todo_tags enable row level security;

create policy "Users manage own tags"
  on public.tags for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own todo_tags"
  on public.todo_tags for all
  using (
    exists (
      select 1 from public.todos
      where todos.id = todo_tags.todo_id
      and todos.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.todos
      where todos.id = todo_tags.todo_id
      and todos.user_id = auth.uid()
    )
  );
