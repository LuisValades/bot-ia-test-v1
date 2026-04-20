-- ============================================
-- Bot Alejandra - Schema Supabase
-- Proyecto: BOT CLAUDE SUPABASE
-- ============================================

create extension if not exists "uuid-ossp";

-- ===== conversations =====
-- Estado por contacto: una fila por contacto activo en el bot
create table if not exists conversations (
  id              uuid primary key default uuid_generate_v4(),
  contact_id      text unique not null,
  location_id     text not null,
  phone           text,
  full_name       text,
  stage           text default 'inicio',          -- inicio | calificando | proponiendo_horario | confirmado | finalizado
  intent          text,                            -- credito_pyme | hipotecario | liquidez | tpv | desconocido
  proposed_slots  jsonb,                           -- array de slots ISO propuestos al lead
  appointment_id  text,                            -- id de cita GHL si ya agendó
  appointment_at  timestamptz,                     -- fecha/hora de la cita confirmada
  last_msg_at     timestamptz default now(),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_conversations_contact on conversations(contact_id);
create index if not exists idx_conversations_stage on conversations(stage);

-- Follow-up automático: contador y timestamp del último nudge
alter table conversations add column if not exists followup_count int default 0;
alter table conversations add column if not exists followup_at timestamptz;
create index if not exists idx_conversations_followup on conversations(stage, last_msg_at, followup_count);

-- ===== messages =====
-- Log completo de cada SMS (in/out) y la respuesta IA
create table if not exists messages (
  id              uuid primary key default uuid_generate_v4(),
  contact_id      text not null,
  conversation_id uuid references conversations(id) on delete cascade,
  direction       text check (direction in ('in','out')) not null,
  body            text not null,
  ai_model        text,                            -- modelo usado en la respuesta IA
  ai_tokens_in    int,
  ai_tokens_out   int,
  ai_cost_usd     numeric(10,6),
  ghl_message_id  text,                            -- id devuelto por GHL al enviar
  metadata        jsonb,                           -- cualquier extra (intent detectado, slots, etc)
  created_at      timestamptz default now()
);

create index if not exists idx_messages_contact on messages(contact_id);
create index if not exists idx_messages_created on messages(created_at desc);

-- ===== trigger updated_at =====
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_conversations_updated on conversations;
create trigger trg_conversations_updated
  before update on conversations
  for each row execute function set_updated_at();
