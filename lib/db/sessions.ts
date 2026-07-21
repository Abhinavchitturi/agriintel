"use client"

import { supabase } from "@/lib/supabase"

export interface DbMessage {
  id: string
  session_id: string
  user_id: string
  role: "user" | "assistant"
  content: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface DbSession {
  id: string
  user_id: string
  preview: string
  created_at: string
  updated_at: string
  messages?: DbMessage[]
}

export async function loadSessions(userId: string): Promise<DbSession[]> {
  const { data } = await supabase
    .from("chat_sessions")
    .select("id, preview, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(20)
  return (data ?? []) as DbSession[]
}

export async function loadSessionMessages(sessionId: string): Promise<DbMessage[]> {
  const { data } = await supabase
    .from("messages")
    .select("id, session_id, user_id, role, content, metadata, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
  return (data ?? []) as DbMessage[]
}

export async function upsertSession(
  userId: string,
  sessionId: string,
  preview: string
): Promise<void> {
  await supabase.from("chat_sessions").upsert(
    { id: sessionId, user_id: userId, preview, updated_at: new Date().toISOString() },
    { onConflict: "id" }
  )
}

export async function saveMessage(
  userId: string,
  sessionId: string,
  msg: { id: string; role: "user" | "assistant"; content: string; metadata?: Record<string, unknown> }
): Promise<void> {
  await supabase.from("messages").upsert(
    {
      id: msg.id,
      session_id: sessionId,
      user_id: userId,
      role: msg.role,
      content: msg.content,
      metadata: msg.metadata ?? null,
    },
    { onConflict: "id" }
  )
}

export async function deleteSession(sessionId: string): Promise<void> {
  await supabase.from("chat_sessions").delete().eq("id", sessionId)
}
