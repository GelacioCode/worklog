"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import { Icons } from "@/components/design/icons"
import { removeLogo, uploadLogo } from "@/server/actions/settings"

export function LogoUploader({
  initialPreviewUrl,
  businessName,
}: {
  initialPreviewUrl: string | null
  businessName: string
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(initialPreviewUrl)
  const [uploading, startUpload] = useTransition()
  const [removing, startRemove] = useTransition()

  function pickFile() {
    fileInputRef.current?.click()
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Immediate optimistic preview
    const localUrl = URL.createObjectURL(file)
    setPreview(localUrl)

    const fd = new FormData()
    fd.append("file", file)
    startUpload(async () => {
      const result = await uploadLogo(fd)
      if (result.ok) {
        toast.success("Logo updated")
        router.refresh()
      } else {
        toast.error(result.error)
        setPreview(initialPreviewUrl)
      }
    })
    // Reset input so re-uploading the same file fires onChange.
    e.target.value = ""
  }

  function onRemove() {
    if (!confirm("Remove the logo?")) return
    startRemove(async () => {
      const result = await removeLogo()
      if (result.ok) {
        setPreview(null)
        toast.success("Logo removed")
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  const initials =
    (businessName || "?").slice(0, 1).toUpperCase() || "W"

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={pickFile}
        disabled={uploading || removing}
        className="relative w-24 h-24 rounded-xl flex items-center justify-center overflow-hidden group"
        style={{
          background: preview ? "var(--surface)" : "var(--surface-2)",
          border: preview ? "1px solid var(--border)" : "1px dashed var(--border)",
        }}
        aria-label="Upload logo"
      >
        {preview ? (
          // Using <img> intentionally — preview is a Supabase signed URL or blob,
          // both of which fight next/image. Sized to fit.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Business logo"
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="text-center">
            <div
              className="w-12 h-12 rounded-lg accent-bg text-white mx-auto flex items-center justify-center text-[18px] font-semibold"
              style={{
                boxShadow:
                  "inset 0 -1px 0 rgb(0 0 0 / .15), 0 2px 6px rgb(var(--accent) / .35)",
              }}
            >
              {initials}
            </div>
            <div className="text-[10px] text-subtle mt-1">Placeholder</div>
          </div>
        )}
        {(uploading || removing) && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "rgb(255 255 255 / .7)" }}
          >
            <Loader2 className="h-4 w-4 animate-spin text-fg" />
          </div>
        )}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
          style={{ background: "rgb(0 0 0 / .35)", color: "#fff" }}
        >
          <Icons.Plus size={16} />
        </div>
      </button>

      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium">Logo</div>
        <p className="text-[12px] text-muted mt-0.5 max-w-sm">
          Appears in the header of every invoice PDF. PNG, JPG, WebP, or SVG, up to 1 MB.
        </p>
        <div className="flex items-center gap-2 mt-2">
          <button
            type="button"
            onClick={pickFile}
            disabled={uploading || removing}
            className="btn btn-ghost h-8"
          >
            {preview ? "Replace" : "Upload"}
          </button>
          {preview && (
            <button
              type="button"
              onClick={onRemove}
              disabled={uploading || removing}
              className="btn btn-ghost h-8 text-red-500 hover:text-red-600"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={onFileChange}
        className="hidden"
      />
    </div>
  )
}
