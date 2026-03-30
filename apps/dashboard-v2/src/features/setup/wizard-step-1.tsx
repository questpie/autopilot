import { useForm, FormProvider } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "@/lib/i18n"
import { authClient } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { EyeIcon, EyeSlashIcon, WarningCircleIcon, EnvelopeSimpleIcon, ArrowCounterClockwiseIcon, TerminalWindowIcon } from "@phosphor-icons/react"
import { useState } from "react"
import { m, AnimatePresence } from "framer-motion"
import { useQuery, useMutation } from "@tanstack/react-query"
import { zxcvbnAsync, zxcvbnOptions } from "@zxcvbn-ts/core"
import * as zxcvbnCommonPkg from "@zxcvbn-ts/language-common"
import * as zxcvbnEnPkg from "@zxcvbn-ts/language-en"
import { useWizardState } from "./use-wizard-state"
import { useDeploymentMode } from "@/hooks/use-deployment-mode"
import { toast } from "sonner"

zxcvbnOptions.setOptions({
  translations: zxcvbnEnPkg.translations,
  graphs: zxcvbnCommonPkg.adjacencyGraphs,
  dictionary: {
    ...zxcvbnCommonPkg.dictionary,
    ...zxcvbnEnPkg.dictionary,
  },
})

const accountSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Invalid email address"),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .regex(/[0-9]/, "Must contain at least 1 digit")
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, "Must contain at least 1 special character"),
})

type AccountValues = z.infer<typeof accountSchema>

interface WizardStep1Props {
  onComplete: () => void
}

function PasswordStrengthMeter({ score }: { score: number }) {
  const { t } = useTranslation()

  const isEmpty = score < 0
  const effectiveScore = isEmpty ? 0 : score

  const labels = [
    t("auth.password_strength_weak"),
    t("auth.password_strength_weak"),
    t("auth.password_strength_fair"),
    t("auth.password_strength_good"),
    t("auth.password_strength_strong"),
  ] as const

  const colors = [
    "bg-destructive",
    "bg-destructive",
    "bg-amber-500",
    "bg-success",
    "bg-success",
  ] as const

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 transition-colors ${
              !isEmpty && i <= effectiveScore - 1 ? colors[effectiveScore] : "bg-muted"
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">
        {isEmpty ? "\u00A0" : labels[effectiveScore]}
      </span>
    </div>
  )
}

function EmailVerificationPhase({
  email,
  onVerified,
}: {
  email: string
  onVerified: () => void
}) {
  const { t } = useTranslation()
  const { data: deploymentMode } = useDeploymentMode()

  // Poll session every 5s — auto-advance when verified
  const { error: checkError, refetch, isFetching: isChecking } = useQuery({
    queryKey: ["email-verification-poll", email],
    queryFn: async () => {
      const session = await authClient.getSession()
      if (session.data?.user) {
        onVerified()
        return true
      }
      throw new Error("not_verified")
    },
    refetchInterval: 5000,
    retry: false,
  })

  const resend = useMutation({
    mutationFn: () => authClient.sendVerificationEmail({ email }),
    onSuccess: () => toast.success(t("setup.step_1_verify_resent")),
    onError: () => toast.error(t("setup.step_1_verify_resend_failed")),
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-heading text-lg font-semibold">
          {t("setup.step_1_verify_title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("setup.step_1_verify_description")}
        </p>
      </div>

      <div className="flex flex-col items-center gap-4 py-4">
        <div className="flex size-14 items-center justify-center rounded-none bg-primary/10">
          <EnvelopeSimpleIcon className="size-7 text-primary" />
        </div>
        <p className="text-center text-sm">
          {t("setup.step_1_verify_sent_to", { email })}
        </p>
      </div>

      {checkError && (
        <Alert variant="destructive">
          <WarningCircleIcon className="size-4" />
          <AlertDescription>{t("setup.step_1_verify_not_yet")}</AlertDescription>
        </Alert>
      )}

      {deploymentMode && deploymentMode !== "cloud" && (
        <Alert>
          <TerminalWindowIcon className="size-4" />
          <AlertDescription>
            {t("setup.step_1_verify_console_hint")}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          loading={resend.isPending}
          onClick={() => resend.mutate()}
        >
          <ArrowCounterClockwiseIcon className="size-4" />
          {t("setup.step_1_verify_resend")}
        </Button>
        <Button
          type="button"
          size="lg"
          className="flex-1"
          loading={isChecking}
          onClick={() => void refetch()}
        >
          {t("setup.step_1_verify_done")}
        </Button>
      </div>
    </div>
  )
}

export function WizardStep1({ onComplete }: WizardStep1Props) {
  const { t } = useTranslation()
  const { setAccountData, completeStep } = useWizardState()
  const [showPassword, setShowPassword] = useState(false)
  const [phase, setPhase] = useState<"form" | "verify-email">("form")
  const [signupEmail, setSignupEmail] = useState("")

  const form = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", email: "", password: "" },
  })

  const watchedPassword = form.watch("password")

  const { data: passwordScore = 0 } = useQuery({
    queryKey: ["password-strength", watchedPassword],
    queryFn: async () => {
      if (!watchedPassword) return 0
      const result = await zxcvbnAsync(watchedPassword)
      return result.score
    },
    enabled: !!watchedPassword,
  })

  const onSubmit = async (values: AccountValues) => {
    const result = await authClient.signUp.email({
      email: values.email,
      password: values.password,
      name: values.name,
    })

    if (result.error) {
      form.setError("root", { message: result.error.message ?? t("errors.account_creation_failed") })
      return
    }

    setAccountData({ name: values.name, email: values.email })
    setSignupEmail(values.email)
    setPhase("verify-email")
  }

  if (phase === "verify-email") {
    return (
      <EmailVerificationPhase
        email={signupEmail}
        onVerified={() => {
          completeStep(1)
          onComplete()
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-heading text-lg font-semibold">
          {t("setup.step_1_title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("setup.step_1_description")}
        </p>
      </div>

      {form.formState.errors.root && (
        <Alert variant="destructive">
          <WarningCircleIcon className="size-4" />
          <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
        </Alert>
      )}

      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="setup-name" className="font-heading text-xs font-medium">
              {t("auth.full_name")}
            </Label>
            <Input
              id="setup-name"
              type="text"
              autoFocus
              autoComplete="name"
              disabled={form.formState.isSubmitting}
              aria-invalid={!!form.formState.errors.name}
              {...form.register("name")}
            />
            <AnimatePresence>
              {form.formState.errors.name && (
                <m.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="text-xs text-destructive"
                >
                  {form.formState.errors.name.message}
                </m.p>
              )}
            </AnimatePresence>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="setup-email" className="font-heading text-xs font-medium">
              {t("auth.email")}
            </Label>
            <Input
              id="setup-email"
              type="email"
              autoComplete="email"
              disabled={form.formState.isSubmitting}
              aria-invalid={!!form.formState.errors.email}
              {...form.register("email")}
            />
            <AnimatePresence>
              {form.formState.errors.email && (
                <m.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="text-xs text-destructive"
                >
                  {form.formState.errors.email.message}
                </m.p>
              )}
            </AnimatePresence>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="setup-password" className="font-heading text-xs font-medium">
              {t("auth.password")}
            </Label>
            <div className="relative">
              <Input
                id="setup-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                disabled={form.formState.isSubmitting}
                aria-invalid={!!form.formState.errors.password}
                className="pr-9"
                {...form.register("password")}
              />
              <button
                type="button"
                tabIndex={-1}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <m.span
                    key={showPassword ? "hide" : "show"}
                    initial={{ opacity: 0, rotate: -90 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: 90 }}
                    transition={{ duration: 0.15 }}
                  >
                    {showPassword ? <EyeSlashIcon className="size-4" /> : <EyeIcon className="size-4" />}
                  </m.span>
                </AnimatePresence>
              </button>
            </div>
            <PasswordStrengthMeter score={watchedPassword ? passwordScore : -1} />
            <p className="text-xs text-muted-foreground">{t("auth.password_requirements")}</p>
            <AnimatePresence>
              {form.formState.errors.password && (
                <m.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="text-xs text-destructive"
                >
                  {form.formState.errors.password.message}
                </m.p>
              )}
            </AnimatePresence>
          </div>

          <p className="text-xs text-muted-foreground/60">
            {t("setup.cli_hint")}: autopilot auth setup
          </p>

          <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
            {t("common.continue")}
          </Button>
        </form>
      </FormProvider>
    </div>
  )
}
