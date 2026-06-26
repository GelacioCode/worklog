// GET /auth/callback?code=…&next=/dashboard
// Handles the email-confirmation + OAuth redirect from Supabase. Exchanges the
// PKCE code for a session cookie and bounces the user onward.

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  // Allow only same-origin relative paths so the param can't be used to
  // redirect users off-site.
  const rawNext = url.searchParams.get("next") ?? "/dashboard"
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard"

  if (!code) {
    return NextResponse.redirect(`${url.origin}/login?error=missing_code`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error("Auth callback failed:", error)
    return NextResponse.redirect(
      `${url.origin}/login?error=${encodeURIComponent(error.message)}`,
    )
  }

  return NextResponse.redirect(`${url.origin}${next}`)
}
