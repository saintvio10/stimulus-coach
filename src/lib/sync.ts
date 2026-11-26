import { useEffect } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { exportData, useStore } from './store';
import type { AppData } from './types';

/**
 * Optionale geräteübergreifende Synchronisation über Supabase.
 * Benötigte Tabelle (einmalig im Supabase-SQL-Editor ausführen) – siehe SUPABASE_SQL.
 * Strategie: ein JSON-Dokument pro Nutzer, "last write wins" anhand von updatedAt.
 */
export const SUPABASE_SQL = `create table if not exists public.app_state (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null,
  updated_at bigint not null
);
alter table public.app_state enable row level security;
create policy "own state" on public.app_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);`;

let client: SupabaseClient | null = null;
let clientKey = '';

export async function getClient(): Promise<SupabaseClient | null> {
  const { url, anonKey } = useStore.getState().settings.supabase;
  if (!url || !anonKey) return null;
  const key = url + anonKey;
  if (client && clientKey === key) return client;
  const { createClient } = await import('@supabase/supabase-js');
  client = createClient(url, anonKey, { auth: { persistSession: true, storageKey: 'stimulus-auth' } });
  clientKey = key;
  return client;
}

export async function currentUser() {
  const c = await getClient();
  if (!c) return null;
  const { data } = await c.auth.getUser();
  return data.user ?? null;
}

export async function signIn(email: string, password: string, register = false) {
  const c = await getClient();
  if (!c) throw new Error('Supabase-URL und Anon-Key fehlen.');
  const res = register ? await c.auth.signUp({ email, password }) : await c.auth.signInWithPassword({ email, password });
  if (res.error) throw new Error(res.error.message);
  return res.data.user;
}

export async function signOut() {
  const c = await getClient();
  await c?.auth.signOut();
}

function payload(): AppData {
  const d = exportData();
  return { ...d, timer: null };
}

export async function pushState(): Promise<number> {
  const c = await getClient();
  const user = await currentUser();
  if (!c || !user) throw new Error('Nicht angemeldet.');
  const data = payload();
  const { error } = await c.from('app_state').upsert({ user_id: user.id, data, updated_at: data.updatedAt });
  if (error) throw new Error(error.message);
  return data.updatedAt;
}

/** Holt den Serverstand. Ersetzt lokale Daten nur, wenn der Server neuer ist (oder force). */
export async function pullState(force = false): Promise<'updated' | 'local-newer' | 'empty'> {
  const c = await getClient();
  const user = await currentUser();
  if (!c || !user) throw new Error('Nicht angemeldet.');
  const { data, error } = await c.from('app_state').select('data, updated_at').eq('user_id', user.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return 'empty';
  const local = useStore.getState().updatedAt;
  if (!force && data.updated_at <= local) return 'local-newer';
  useStore.getState().replaceAll(data.data as AppData);
  // replaceAll setzt updatedAt neu – auf Serverstand zurücksetzen, um Ping-Pong zu vermeiden
  useStore.setState({ updatedAt: data.updated_at });
  return 'updated';
}

export function useSupabaseAutoSync() {
  const enabled = useStore((s) => s.settings.supabase.autoSync && !!s.settings.supabase.url && !!s.settings.supabase.anonKey);
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last = 0;
    let cancelled = false;
    (async () => {
      try {
        if (await currentUser()) await pullState();
      } catch {
        /* offline */
      }
      last = useStore.getState().updatedAt;
    })();
    const unsub = useStore.subscribe((s) => {
      if (cancelled || s.updatedAt === last) return;
      last = s.updatedAt;
      clearTimeout(timer);
      timer = setTimeout(() => {
        pushState().catch(() => {
          /* offline – nächster Versuch bei nächster Änderung */
        });
      }, 4000);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsub();
    };
  }, [enabled]);
}
