-- Adds a due date to todos, defaulting existing (and future, if omitted) rows to tomorrow.
alter table public.todos
  add column due_date date not null default (current_date + 1);
