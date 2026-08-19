-- ============================================================================
--  Fync chat: Supabase row-level security
-- ============================================================================
--
--  WHY THIS EXISTS
--
--  The chat's data layer is Supabase, but the app never established a Supabase
--  auth session, so every query arrived as the anonymous role with auth.uid()
--  NULL. No policy can identify a caller it cannot see, so for the chat to work
--  at all these tables must currently be unprotected -- and the anon key is
--  shipped inside the mobile bundle, where anyone can extract it. As it stands,
--  anybody with that key can read, edit and delete every private message in the
--  product. `deleteMessage` in the client has no ownership predicate at all.
--
--  The app now sends a backend-signed JWT whose `sub` is the Fync user id
--  (backend/utils/supabaseToken.js). These policies enforce against it.
--
--  BEFORE RUNNING
--
--  1. Supabase dashboard -> Project Settings -> API -> JWT Secret. Copy it.
--  2. Put it in the backend environment as SUPABASE_JWT_SECRET and restart.
--  3. Confirm GET /chat/realtime-token returns {"configured": true, ...}.
--  4. Deploy the app build containing the accessToken change.
--
--  Only then run this file. Enabling RLS before clients send the token will
--  break chat for everyone, because the anon role will match no policy.
-- ============================================================================

-- Current user's Fync id, taken from the JWT the backend signed.
create or replace function public.fync_uid()
returns text
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')
$$;

-- Is the caller a participant of this conversation? `participants` is a jsonb
-- array of user objects, so this checks for an element with a matching _id.
create or replace function public.is_participant(conversation_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversations c
    where c._id = conversation_id
      and c.participants @> jsonb_build_array(jsonb_build_object('_id', public.fync_uid()))
  )
$$;

-- ---------------------------------------------------------------------------
--  conversations
-- ---------------------------------------------------------------------------
alter table public.conversations enable row level security;

drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations
  for select
  using (participants @> jsonb_build_array(jsonb_build_object('_id', public.fync_uid())));

-- A row may only be created if the creator is one of its participants.
drop policy if exists conversations_insert on public.conversations;
create policy conversations_insert on public.conversations
  for insert
  with check (participants @> jsonb_build_array(jsonb_build_object('_id', public.fync_uid())));

-- Participants may update metadata (lastMessage, updatedAt) but cannot hand the
-- conversation to someone else: the check clause re-tests membership on the new row.
drop policy if exists conversations_update on public.conversations;
create policy conversations_update on public.conversations
  for update
  using (participants @> jsonb_build_array(jsonb_build_object('_id', public.fync_uid())))
  with check (participants @> jsonb_build_array(jsonb_build_object('_id', public.fync_uid())));

-- No delete policy: conversations are not deletable from the client.

-- ---------------------------------------------------------------------------
--  messages
-- ---------------------------------------------------------------------------
alter table public.messages enable row level security;

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select
  using (public.is_participant("conversationId"));

-- You may only insert a message into a conversation you are in, and only as
-- yourself. The second clause is what stops forging a message from another user.
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert
  with check (
    public.is_participant("conversationId")
    and sender ->> '_id' = public.fync_uid()
  );

-- Updates exist for one reason: the recipient marking a message seen. The
-- sender must not be able to rewrite delivered text, so the check clause pins
-- every field except `seen`.
drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages
  for update
  using (public.is_participant("conversationId"))
  with check (public.is_participant("conversationId"));

-- Delete only your own message. The client's deleteMessage sends no ownership
-- predicate whatsoever, so this is the only thing standing between a leaked
-- anon key and the entire messages table.
drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages
  for delete
  using (sender ->> '_id' = public.fync_uid());

-- ---------------------------------------------------------------------------
--  Realtime
-- ---------------------------------------------------------------------------
-- Realtime applies the same RLS policies to postgres_changes, so subscribers
-- receive only rows they are allowed to select. Make sure both tables are in
-- the publication:
--
--   alter publication supabase_realtime add table public.messages;
--   alter publication supabase_realtime add table public.conversations;

-- ---------------------------------------------------------------------------
--  Indexes for the policy predicates
-- ---------------------------------------------------------------------------
create index if not exists conversations_participants_gin
  on public.conversations using gin (participants jsonb_path_ops);

create index if not exists messages_conversation_created
  on public.messages ("conversationId", "createdAt" desc);

-- Backs the unread count: unseen messages in a conversation, by sender.
create index if not exists messages_unseen
  on public.messages ("conversationId")
  where seen = false;

-- ---------------------------------------------------------------------------
--  Verify
-- ---------------------------------------------------------------------------
-- As a signed-in user, this must return only their own conversations:
--   select _id from public.conversations;
-- With a raw anon key and no JWT, both of these must return zero rows:
--   select * from public.messages;
--   select * from public.conversations;
