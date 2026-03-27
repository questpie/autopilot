import { useForm, FormProvider } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "@/lib/i18n"
import { authClient } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { EyeIcon, EyeSlashIcon, WarningCircleIcon } from "@phosphor-icons/react"
import { useState, useMemo } from "react"
import { zxcvbnAsync, zxcvbnOptions } from "@zxcvbn-ts/core"
import * as zxcvbnCommonPkg from "@zxcvbn-ts/language-common"
import * as zxcvbnEnPkg from "@zxcvbn-ts/language-en"
import { useWizardState } from "./use-wizard-state"

// Initialize zxcvbn
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

  // score -1 = no input yet, show empty bar
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
    "bg-green-500",
    "bg-emerald-400",
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

export function WizardStep1({ onComplete }: WizardStep1Props) {
  const { t } = useTranslation()
  const { setAccountData, completeStep } = useWizardState()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [passwordScore, setPasswordScore] = useState(0)

  const form = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", email: "", password: "" },
  })

  const watchedPassword = form.watch("password")

  useMemo(() => {
    if (!watchedPassword) {
      setPasswordScore(0)
      return
    }
    void zxcvbnAsync(watchedPassword).then((result) => {
      setPasswordScore(result.score)
    })
  }, [watchedPassword])

  const onSubmit = async (values: AccountValues) => {
    setError(null)

    const result = await authClient.signUp.email({
      email: values.email,
      password: values.password,
      name: values.name,
    })

    if (result.error) {
      setError(result.error.message ?? t("errors.account_creation_failed"))
      return
    }

    setAccountData({ name: values.name, email: values.email })
    completeStep(1)
    onComplete()
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

      {error && (
        <Alert variant="destructive">
          <WarningCircleIcon className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          {/* Name */}
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
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          {/* Email */}
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
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>

          {/* Password */}
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
                {showPassword ? <EyeSlashIcon className="size-4" /> : <EyeIcon className="size-4" />}
              </button>
            </div>
            <PasswordStrengthMeter score={watchedPassword ? passwordScore : -1} />
            <p className="text-xs text-muted-foreground">{t("auth.password_requirements")}</p>
            {form.formState.errors.password && (
              <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>

          {/* CLI hint */}
          <p className="text-xs text-muted-foreground/60">
            {t("setup.cli_hint")}: autopilot auth setup
          </p>

          <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <>
                <Spinner size="sm" />
                {t("auth.creating_account")}
              </>
            ) : (
              t("common.continue")
            )}
          </Button>
        </form>
      </FormProvider>
    </div>
  )
}
