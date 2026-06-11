// Shared auth helper for server components + server actions.
// Drizzle connects via the postgres pooler role (BYPASSRLS), so every query
// MUST manually scope by user_id. RLS is defense-in-depth; this helper is the
// app-layer enforcement.

import { redirect } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"

export async function requireUser(): Promise<User> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  return user
}

export async function getUser(): Promise<User | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}
