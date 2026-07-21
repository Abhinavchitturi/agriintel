"use client"

import { supabase, type Profile } from "@/lib/supabase"

export async function dbSignUp(
  email: string,
  password: string,
  name: string
): Promise<{ user: Profile } | { error: string }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  })

  if (error) return { error: error.message }
  if (!data.user) return { error: "Sign-up failed. Please try again." }

  // Profile row is created automatically by the DB trigger.
  // Read it back so we have the full profile.
  const profile = await getProfile(data.user.id)
  if (!profile) return { error: "Account created but profile not found." }
  return { user: profile }
}

export async function dbSignIn(
  email: string,
  password: string
): Promise<{ user: Profile } | { error: string }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: "Invalid email or password." }
  if (!data.user) return { error: "Sign-in failed. Please try again." }

  const profile = await getProfile(data.user.id)
  if (!profile) return { error: "Profile not found." }
  return { user: profile }
}

export async function dbSignOut(): Promise<void> {
  await supabase.auth.signOut()
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id, email, name, plan")
    .eq("id", userId)
    .single()
  return data ?? null
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null
  return getProfile(session.user.id)
}

export async function upgradePlan(userId: string, plan: "pro" | "free"): Promise<void> {
  await supabase
    .from("profiles")
    .update({ plan, updated_at: new Date().toISOString() })
    .eq("id", userId)
}
