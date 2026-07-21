"use client"

import { supabase, type Plan } from "@/lib/supabase"
import { getModelById } from "@/lib/models"

export interface UsageInfo {
  count: number
  limit: number
  resetInMinutes: number
  canSend: boolean
  percentage: number
}

function resolveModel(plan: Plan, modelId?: string) {
  const id = plan === "free" ? "kisan" : (modelId ?? "fasal")
  return getModelById(id)
}

// ─── Local cache so UI stays snappy (Supabase calls are async) ───────────────

function _localKey(userId: string, plan: Plan) {
  return `agriintel_usage_${userId}_${plan}`
}

function _readLocal(userId: string, plan: Plan) {
  try {
    const raw = localStorage.getItem(_localKey(userId, plan))
    return raw ? (JSON.parse(raw) as { count: number; windowStart: number }) : null
  } catch { return null }
}

function _writeLocal(userId: string, plan: Plan, count: number, windowStart: number) {
  try {
    localStorage.setItem(_localKey(userId, plan), JSON.stringify({ count, windowStart }))
  } catch {}
}

// ─── Supabase operations ─────────────────────────────────────────────────────

export async function getUsageFromDb(
  userId: string,
  plan: Plan,
  modelId?: string
): Promise<UsageInfo> {
  const model = resolveModel(plan, modelId)
  const resetMs = model.resetHours * 60 * 60 * 1000
  const now = Date.now()

  // 1. Try local cache first for instant response
  const local = _readLocal(userId, plan)
  if (local) {
    const elapsed = now - local.windowStart
    if (elapsed < resetMs) {
      const resetInMinutes = Math.ceil((resetMs - elapsed) / 60000)
      const percentage = Math.min(100, (local.count / model.requestLimit) * 100)
      return {
        count: local.count,
        limit: model.requestLimit,
        resetInMinutes,
        canSend: local.count < model.requestLimit,
        percentage,
      }
    }
    // Window expired — reset local cache
    _writeLocal(userId, plan, 0, now)
  }

  // 2. Fetch from Supabase
  const { data, error } = await supabase
    .from("usage")
    .select("count, window_start")
    .eq("user_id", userId)
    .eq("plan", plan)
    .single()

  if (error || !data) {
    return { count: 0, limit: model.requestLimit, resetInMinutes: model.resetHours * 60, canSend: true, percentage: 0 }
  }

  const windowStart = new Date(data.window_start).getTime()
  const elapsed = now - windowStart

  if (elapsed >= resetMs) {
    // Reset the window in Supabase
    await supabase.from("usage").upsert({
      user_id: userId, plan, count: 0, window_start: new Date().toISOString(), updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,plan" })
    _writeLocal(userId, plan, 0, now)
    return { count: 0, limit: model.requestLimit, resetInMinutes: model.resetHours * 60, canSend: true, percentage: 0 }
  }

  const resetInMinutes = Math.ceil((resetMs - elapsed) / 60000)
  const percentage = Math.min(100, (data.count / model.requestLimit) * 100)
  _writeLocal(userId, plan, data.count, windowStart)

  return {
    count: data.count,
    limit: model.requestLimit,
    resetInMinutes,
    canSend: data.count < model.requestLimit,
    percentage,
  }
}

export async function incrementUsageInDb(
  userId: string,
  plan: Plan,
  modelId?: string,
  cost = 1
): Promise<void> {
  const model = resolveModel(plan, modelId)
  const resetMs = model.resetHours * 60 * 60 * 1000
  const now = new Date()

  // Optimistic local update
  const local = _readLocal(userId, plan)
  const windowStart = local ? local.windowStart : Date.now()
  const elapsed = Date.now() - windowStart
  const newCount = elapsed >= resetMs ? cost : (local?.count ?? 0) + cost
  _writeLocal(userId, plan, newCount, elapsed >= resetMs ? Date.now() : windowStart)

  // Persist to Supabase (fire-and-forget from UX perspective)
  const { data: existing } = await supabase
    .from("usage")
    .select("count, window_start")
    .eq("user_id", userId)
    .eq("plan", plan)
    .single()

  if (!existing) {
    await supabase.from("usage").insert({
      user_id: userId, plan, count: cost,
      window_start: now.toISOString(), updated_at: now.toISOString(),
    })
    return
  }

  const dbWindowStart = new Date(existing.window_start).getTime()
  const dbElapsed = Date.now() - dbWindowStart
  const dbNewCount = dbElapsed >= resetMs ? cost : existing.count + cost

  await supabase.from("usage").update({
    count: dbNewCount,
    window_start: dbElapsed >= resetMs ? now.toISOString() : existing.window_start,
    updated_at: now.toISOString(),
  }).eq("user_id", userId).eq("plan", plan)
}

export function canSendWithCost(info: UsageInfo, cost: number): boolean {
  return info.count + cost <= info.limit
}
