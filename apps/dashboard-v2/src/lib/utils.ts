import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const AVATAR_COLORS = [
  'bg-primary/20 text-primary',
  'bg-info/20 text-info',
  'bg-success/20 text-success',
  'bg-amber-500/20 text-amber-400',
  'bg-destructive/20 text-destructive',
  'bg-cyan-500/20 text-cyan-400',
  'bg-violet-500/20 text-violet-400',
  'bg-pink-500/20 text-pink-400',
] as const

/** Generates a deterministic color from a string (for avatar backgrounds). */
export function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}
