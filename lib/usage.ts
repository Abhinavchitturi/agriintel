import { FREE_MODEL, PRO_MODELS, getModelById } from "./models"

interface UsageData {
  count: number
  windowStart: number
}

export interface UsageInfo {
  count: number
  limit: number
  resetInMinutes: number
  canSend: boolean
  percentage: number
}

// Free uses its own key. All Pro models share one key so switching models
// doesn't reset the counter — the limit just changes per selected model.
function _key(plan: "free" | "pro") {
  return plan === "free" ? "agriintel_usage_free" : "agriintel_usage_pro"
}

export function canSendWithCost(plan: "free" | "pro", modelId?: string, cost = 1): boolean {
  const info = getUsage(plan, modelId)
  return info.count + cost <= info.limit
}

export function getUsage(plan: "free" | "pro", modelId?: string): UsageInfo {
  const resolvedId = plan === "free" ? "kisan" : (modelId ?? "fasal")
  const model = getModelById(resolvedId)
  const { requestLimit: limit, resetHours } = model
  const resetMs = resetHours * 60 * 60 * 1000

  if (typeof window === "undefined") {
    return { count: 0, limit, resetInMinutes: resetMs / 60000, canSend: true, percentage: 0 }
  }

  const stored = localStorage.getItem(_key(plan))
  const now = Date.now()

  if (!stored) {
    return { count: 0, limit, resetInMinutes: resetMs / 60000, canSend: true, percentage: 0 }
  }

  const data: UsageData = JSON.parse(stored)
  const elapsed = now - data.windowStart

  if (elapsed >= resetMs) {
    localStorage.setItem(_key(plan), JSON.stringify({ count: 0, windowStart: now }))
    return { count: 0, limit, resetInMinutes: resetMs / 60000, canSend: true, percentage: 0 }
  }

  const resetInMinutes = Math.ceil((resetMs - elapsed) / 60000)
  const percentage = Math.min(100, (data.count / limit) * 100)

  return {
    count: data.count,
    limit,
    resetInMinutes,
    canSend: data.count < limit,
    percentage,
  }
}

export function incrementUsage(plan: "free" | "pro", modelId?: string, cost = 1) {
  if (typeof window === "undefined") return
  const resolvedId = plan === "free" ? "kisan" : (modelId ?? "fasal")
  const model = getModelById(resolvedId)
  const resetMs = model.resetHours * 60 * 60 * 1000
  const key = _key(plan)
  const stored = localStorage.getItem(key)
  const now = Date.now()

  if (!stored) {
    localStorage.setItem(key, JSON.stringify({ count: cost, windowStart: now }))
    return
  }

  const data: UsageData = JSON.parse(stored)
  const elapsed = now - data.windowStart

  if (elapsed >= resetMs) {
    localStorage.setItem(key, JSON.stringify({ count: cost, windowStart: now }))
  } else {
    localStorage.setItem(key, JSON.stringify({ count: data.count + cost, windowStart: data.windowStart }))
  }
}

export function formatResetTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}
