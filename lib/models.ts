export interface AgriModel {
  id: string
  name: string
  groqId: string
  tagline: string
  requestLimit: number
  resetHours: number
  badge: string
  badgeColor: string
  /** True if the model accepts image input. Currently only Samriddhi (Qwen 3.6). */
  supportsImages?: boolean
}

export const FREE_MODEL: AgriModel = {
  id: "kisan",
  name: "AgriIntel Kisan",
  groqId: "llama-3.1-8b-instant",
  tagline: "Essential farming assistant",
  requestLimit: 20,
  resetHours: 6,
  badge: "Free",
  badgeColor: "text-gray-500",
}

// Kisan = farmer | Fasal = harvest | Vriddhi = growth | Samriddhi = prosperity
//
// Tiers are ordered by capability, not parameter count: speed -> accuracy ->
// reasoning -> vision. Groq removes models fairly often, so verify every groqId
// against `GET https://api.groq.com/openai/v1/models` before shipping a change,
// and keep these IDs in sync with backend/app/config.py.
export const PRO_MODELS: AgriModel[] = [
  {
    id: "fasal",
    name: "AgriIntel Fasal",
    groqId: "llama-3.3-70b-versatile",
    tagline: "Fast & accurate for everyday queries",
    requestLimit: 200,
    resetHours: 3,
    badge: "Standard",
    badgeColor: "text-agri-500",
  },
  {
    id: "vriddhi",
    name: "AgriIntel Vriddhi",
    // was deepseek-r1-distill-llama-70b — removed from Groq.
    // gpt-oss-120b also advertises `reasoning` support, so it is a like-for-like swap.
    groqId: "openai/gpt-oss-120b",
    tagline: "Deep reasoning for complex crop & soil analysis",
    requestLimit: 60,
    resetHours: 3,
    badge: "Advanced",
    badgeColor: "text-blue-500",
  },
  {
    id: "samriddhi",
    name: "AgriIntel Samriddhi",
    // was llama-3.1-70b-versatile — removed from Groq.
    // Qwen 3.6 is the only chat model in the account accepting image input.
    groqId: "qwen/qwen3.6-27b",
    tagline: "Photograph an affected crop for visual diagnosis",
    requestLimit: 30,
    resetHours: 3,
    badge: "Elite",
    badgeColor: "text-purple-500",
    supportsImages: true,
  },
]

export const ALL_MODELS: AgriModel[] = [FREE_MODEL, ...PRO_MODELS]

export function getModelById(id: string): AgriModel {
  return ALL_MODELS.find((m) => m.id === id) ?? FREE_MODEL
}

export function isProModel(id: string): boolean {
  return PRO_MODELS.some((m) => m.id === id)
}