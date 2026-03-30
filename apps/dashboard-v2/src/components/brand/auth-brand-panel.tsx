import { m } from "framer-motion"
import { SquareBuildLogo } from "./square-build-logo"
import { useMotionPreference } from "@/lib/motion"

export function AuthBrandPanel() {
  const { shouldReduce } = useMotionPreference()

  return (
    <div className="relative hidden w-[45%] flex-col items-center justify-center overflow-hidden border-r border-border bg-background md:flex">
      {/* Grid overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `
            repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(183,0,255,0.06) 39px, rgba(183,0,255,0.06) 40px),
            repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(183,0,255,0.06) 39px, rgba(183,0,255,0.06) 40px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Floating purple glow */}
      {!shouldReduce && (
        <m.div
          className="pointer-events-none absolute h-[500px] w-[500px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(183,0,255,0.15) 0%, transparent 70%)",
          }}
          animate={{
            x: [0, 80, -40, 60, 0],
            y: [0, -60, 40, -80, 0],
          }}
          transition={{
            duration: 40,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      )}

      {/* Brand lockup */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        <SquareBuildLogo size={64} />
        <div className="flex flex-col items-center gap-2">
          <span className="font-heading text-2xl font-bold tracking-[-0.05em] text-foreground">
            QUESTPIE
          </span>
          <p className="max-w-[240px] text-center text-sm text-muted-foreground">
            Build apps. Run companies. One platform.
          </p>
        </div>
      </div>
    </div>
  )
}
