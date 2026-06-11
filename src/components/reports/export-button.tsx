import { Icons } from "@/components/design/icons"

export function ExportButton({
  href,
  label = "Export CSV",
}: {
  href: string
  label?: string
}) {
  return (
    <a href={href} className="btn btn-ghost h-8 text-[12.5px]">
      <Icons.Download size={12} /> {label}
    </a>
  )
}
