"use client"

export interface User {
  id: string
  email: string
  name: string
  plan: "free" | "pro"
}

type RegisteredUser = User & { password: string }

const DEMO_USERS: RegisteredUser[] = [
  {
    id: "demo-pro-001",
    email: "farmer@pro.com",
    name: "Pro Farmer",
    plan: "pro",
    password: "AgriPro123",
  },
  {
    id: "demo-pro-002",
    email: "pro@agriintel.com",
    name: "AgriIntel Tester",
    plan: "pro",
    password: "Test@Pro2026",
  },
]

export function signIn(email: string, password: string): { user: User } | { error: string } {
  const demo = DEMO_USERS.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  )
  if (demo) {
    const { password: _, ...user } = demo
    _saveUser(user)
    return { user }
  }

  const registered = _getRegisteredUsers()
  const found = registered.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  )
  if (!found) return { error: "Invalid email or password" }

  const { password: _, ...user } = found
  _saveUser(user)
  return { user }
}

export function signUp(
  email: string,
  password: string,
  name: string
): { user: User } | { error: string } {
  if (DEMO_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return { error: "Email already in use" }
  }
  const registered = _getRegisteredUsers()
  if (registered.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return { error: "Email already in use" }
  }

  const newUser: RegisteredUser = {
    id: `user-${Date.now()}`,
    email,
    name,
    plan: "free",
    password,
  }
  registered.push(newUser)
  if (typeof window !== "undefined") {
    localStorage.setItem("agriintel_registered_users", JSON.stringify(registered))
  }

  const { password: _, ...user } = newUser
  _saveUser(user)
  return { user }
}

export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null
  const stored = localStorage.getItem("agriintel_user")
  if (!stored) return null
  try {
    return JSON.parse(stored) as User
  } catch {
    return null
  }
}

export function signOut() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("agriintel_user")
  }
}

export function upgradeToPro(userId: string) {
  if (typeof window === "undefined") return
  const stored = localStorage.getItem("agriintel_user")
  if (!stored) return
  try {
    const user = JSON.parse(stored) as User
    if (user.id !== userId) return
    user.plan = "pro"
    localStorage.setItem("agriintel_user", JSON.stringify(user))
    localStorage.setItem("agriintel_plan", "pro")

    const registered = _getRegisteredUsers()
    const idx = registered.findIndex((u) => u.id === userId)
    if (idx !== -1) {
      registered[idx].plan = "pro"
      localStorage.setItem("agriintel_registered_users", JSON.stringify(registered))
    }
  } catch {}
}

function _saveUser(user: User) {
  if (typeof window !== "undefined") {
    localStorage.setItem("agriintel_user", JSON.stringify(user))
    localStorage.setItem("agriintel_plan", user.plan)
  }
}

function _getRegisteredUsers(): RegisteredUser[] {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem("agriintel_registered_users")
  if (!stored) return []
  try {
    return JSON.parse(stored)
  } catch {
    return []
  }
}
