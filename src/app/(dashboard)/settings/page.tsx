import { PageHeader } from "@/components/layout/page-header"
import { SettingsForm } from "@/components/settings/settings-form"
import { getSettings } from "@/lib/db/queries/settings"
import { createClient } from "@/lib/supabase/server"
import { requireUser } from "@/server/auth"

const LOGO_BUCKET = "business-logos"
const LOGO_SIGNED_URL_TTL = 60 * 60 // 1h is plenty for the page session

async function signedLogoUrl(path: string | null): Promise<string | null> {
  if (!path) return null
  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from(LOGO_BUCKET)
    .createSignedUrl(path, LOGO_SIGNED_URL_TTL)
  if (error || !data) return null
  return data.signedUrl
}

export default async function SettingsPage() {
  const user = await requireUser()
  const settings = await getSettings(user.id)
  const logoUrl = await signedLogoUrl(settings.logoStoragePath)

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Business profile, invoice defaults, and account."
      />

      <div className="max-w-3xl">
        <SettingsForm
          settings={settings}
          logoUrl={logoUrl}
          email={user.email ?? ""}
        />
      </div>
    </div>
  )
}
