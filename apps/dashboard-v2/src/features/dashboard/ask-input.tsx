import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PaperPlaneTiltIcon } from "@phosphor-icons/react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useHapticPattern } from "@/hooks/use-haptic"
import { SPRING } from "@/lib/motion"

/**
 * Persistent "Ask your team" input for the dashboard.
 * Creates an intent task assigned to the CEO agent.
 * Focus: border transitions to primary with glow.
 * Submit: scale press + haptic feedback.
 */
export function AskInput() {
  const { t } = useTranslation()
  const [value, setValue] = useState("")
  const [focused, setFocused] = useState(false)
  const queryClient = useQueryClient()
  const { trigger: haptic } = useHapticPattern()

  const createIntent = useMutation({
    mutationFn: async (message: string) => {
      const res = await api.api.tasks.$post({
        json: {
          title: message,
          type: "intent",
          assigned_to: "ceo",
          status: "backlog",
          created_by: "human",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      })
      if (!res.ok) throw new Error("Failed to create task")
      return res.json()
    },
    onSuccess: () => {
      setValue("")
      toast.success(t("dashboard.intent_submitted"))
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.root })
    },
    onError: () => {
      toast.error(t("common.error"))
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    haptic("tap")
    createIntent.mutate(trimmed)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 transition-shadow duration-200"
      style={{
        boxShadow: focused ? "0 0 0 3px oklch(from var(--primary) l c h / 10%)" : "none",
      }}
    >
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={t("dashboard.quick_ask_placeholder")}
        className="flex-1 font-heading text-sm transition-colors duration-200"
        disabled={createIntent.isPending}
      />
      <motion.div whileTap={{ scale: 0.95 }} transition={SPRING.snappy}>
        <Button
          type="submit"
          size="sm"
          disabled={!value.trim() || createIntent.isPending}
          className="shrink-0 gap-1.5"
        >
          <PaperPlaneTiltIcon size={14} />
          {t("dashboard.ask")}
        </Button>
      </motion.div>
    </form>
  )
}
