export interface AgriModel {
  id: string
  name: string
  groqId: string
  tagline: string
  requestLimit: number
  resetHours: number
  badge: string
  badgeColor: string
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
    groqId: "deepseek-r1-distill-llama-70b",
    tagline: "Deep reasoning for complex crop & soil analysis",
    requestLimit: 60,
    resetHours: 3,
    badge: "Advanced",
    badgeColor: "text-blue-500",
  },
  {
    id: "samriddhi",
    name: "AgriIntel Samriddhi",
    groqId: "llama-3.1-70b-versatile",
    tagline: "Premium intelligence for precision agriculture",
    requestLimit: 30,
    resetHours: 3,
    badge: "Elite",
    badgeColor: "text-purple-500",
  },
]

export function getModelById(id: string): AgriModel {
  if (id === "kisan") return FREE_MODEL
  return PRO_MODELS.find((m) => m.id === id) ?? PRO_MODELS[0]
}
