// Next.js 16 renamed `middleware.ts` to `proxy.ts`. Same matcher, same role —
// runs before any request resolution to refresh the Supabase session and gate
// unauthed users out of the (dashboard) routes.
import { type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // Run on every route except static assets, images, and the PDF API
    // (which streams binary and doesn't need session refresh).
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
