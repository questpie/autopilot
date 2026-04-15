import { m } from "framer-motion"
import { SquareBuildLogo } from "./square-build-logo"
import { useMotionPreference } from "@/lib/motion"

export function AuthBrandPanel() {
  const { shouldReduce } = useMotionPreference()

  return (
    <div className="relative hidden w-[40%] flex-col items-center justify-center overflow-hidden bg-muted/20 md:flex lg:w-[45%]">
      {/* Animated grid overlay — slow drift gives it a living feel */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `
            repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(183,0,255,0.06) 39px, rgba(183,0,255,0.06) 40px),
            repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(183,0,255,0.06) 39px, rgba(183,0,255,0.06) 40px)
          `,
          backgroundSize: "40px 40px",
          animation: shouldReduce ? "none" : "auth-grid-drift 60s linear infinite",
        }}
      />

      {!shouldReduce && (
        <>
          {/* Primary glow — large, slow orbit */}
          <m.div
            className="pointer-events-none absolute h-[600px] w-[600px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(183,0,255,0.14) 0%, transparent 70%)",
            }}
            animate={{
              x: [0, 100, -60, 80, 0],
              y: [0, -80, 50, -100, 0],
              scale: [1, 1.1, 0.95, 1.05, 1],
            }}
            transition={{
              duration: 30,
              repeat: Infinity,
              ease: "linear",
            }}
          />

          {/* Secondary glow — smaller, faster, offset path for depth */}
          <m.div
            className="pointer-events-none absolute h-[350px] w-[350px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(183,0,255,0.1) 0%, transparent 65%)",
            }}
            animate={{
              x: [-80, 40, -20, 60, -80],
              y: [60, -40, 80, -60, 60],
              scale: [1, 0.9, 1.15, 0.95, 1],
            }}
            transition={{
              duration: 22,
              repeat: Infinity,
              ease: "linear",
            }}
          />

          {/* Subtle warm accent — tiny, fast, adds shimmer */}
          <m.div
            className="pointer-events-none absolute h-[200px] w-[200px] rounded-full opacity-60"
            style={{
              background:
                "radial-gradient(circle, rgba(212,79,255,0.12) 0%, transparent 60%)",
            }}
            animate={{
              x: [40, -60, 80, -40, 40],
              y: [-30, 70, -50, 30, -30],
            }}
            transition={{
              duration: 15,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        </>
      )}

      {/* Brand lockup */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        <SquareBuildLogo size={64} />
        <div className="flex flex-col items-center gap-2">
          <span className="font-heading text-2xl font-bold tracking-[-0.05em] text-foreground">
            QUESTPIE
          </span>
          <p className="font-heading px-6 text-center text-balance text-xs tracking-widest text-muted-foreground/60 uppercase">
            Build apps · Run companies · One platform
          </p>
        </div>
      </div>
    </div>
  )
}
