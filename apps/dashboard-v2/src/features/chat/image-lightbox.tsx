import { memo, useCallback, useEffect, useRef, useState } from "react"
import { XIcon } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

interface ImageLightboxProps {
  src: string
  alt?: string
  onClose: () => void
}

export const ImageLightbox = memo(function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  const [zoomed, setZoomed] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    },
    [onClose],
  )

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    // Focus the close button for keyboard accessibility
    closeButtonRef.current?.focus()
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [handleKeyDown])

  const toggleZoom = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setZoomed((z) => !z)
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClose()
        }
      }}
      role="dialog"
      aria-modal
      aria-label={alt ?? "Image preview"}
    >
      {/* Close button */}
      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
        aria-label="Close"
      >
        <XIcon size={18} />
      </button>

      {/* Image */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <img
        src={src}
        alt={alt ?? ""}
        onClick={toggleZoom}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            toggleZoom(e as unknown as React.MouseEvent)
          }
        }}
        tabIndex={0}
        role="button"
        aria-label={zoomed ? "Zoom out" : "Zoom in"}
        className={cn(
          "transition-all duration-200",
          zoomed
            ? "max-h-none max-w-none cursor-zoom-out"
            : "max-h-[90vh] max-w-[90vw] cursor-zoom-in object-contain",
        )}
      />
    </div>
  )
})
