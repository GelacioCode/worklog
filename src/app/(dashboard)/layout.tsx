import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/layout/sidebar"
import { TopBar } from "@/components/layout/topbar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const email = user.email ?? ""
  const workspaceLabel = email
    ? `${email.split("@")[0]}'s workspace`
    : "Your workspace"

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar email={email} />

      <main className="flex-1 min-w-0 flex flex-col">
        <TopBar workspaceLabel={workspaceLabel} />
        <div className="px-4 md:px-8 lg:px-10 py-6 md:py-7 mx-auto w-full max-w-[1480px]">
          <div className="anim-slide-up">{children}</div>
        </div>
      </main>
    </div>
  )
}
