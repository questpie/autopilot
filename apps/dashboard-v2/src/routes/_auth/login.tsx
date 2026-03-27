import { createFileRoute } from "@tanstack/react-router"
import { useTranslation } from "@/lib/i18n"
import { useForm, FormProvider } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@hookform/resolvers/zod"
import { authClient } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { SquareBuildLogo } from "@/components/brand"
import { EyeIcon, EyeSlashIcon, WarningCircleIcon } from "@phosphor-icons/react"
import { useState, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

type LoginValues = z.infer<typeof loginSchema>

export const Route = createFileRoute("/_auth/login")({
  component: LoginPage,
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: (search.redirect as string) || undefined,
  }),
})

function LoginPage() {
  const { t } = useTranslation()
  const search = Route.useSearch()
  const redirect = search.redirect

  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showError, setShowError] = useState(false)
  const [failCount, setFailCount] = useState(0)
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  const startRateLimitCountdown = useCallback(() => {
    setRateLimitCountdown(60)
    if (countdownRef.current) clearInterval(countdownRef.current)
    countdownRef.current = setInterval(() => {
      setRateLimitCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current)
          setFailCount(0)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const onSubmit = async (values: LoginValues) => {
    if (rateLimitCountdown > 0) return

    setError(null)
    setShowError(false)

    const result = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    })

    if (result.error) {
      const newCount = failCount + 1
      setFailCount(newCount)

      if (newCount >= 10) {
        setError(t("auth.error_too_many_attempts", { seconds: 60 }))
        startRateLimitCountdown()
      } else {
        setError(result.error.message ?? t("auth.error_invalid_credentials"))
      }
      setShowError(true)
      return
    }

    // Check if 2FA is needed -- Better Auth returns redirect=true for 2FA
    if (result.data?.redirect) {
      window.location.href = "/login/2fa"
      return
    }

    // Success: redirect
    window.location.href = redirect ?? "/"
  }

  const isRateLimited = rateLimitCountdown > 0

  return (
    <div className="flex flex-col gap-6">
      {/* Brand logo */}
      <div className="flex justify-center">
        <SquareBuildLogo size={48} />
      </div>

      {/* Title */}
      <div className="text-center">
        <h2 className="font-heading text-lg font-semibold">
          {t("app.name")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("auth.sign_in_description")}
        </p>
      </div>

      {/* Error alert */}
      <AnimatePresence>
        {showError && error && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: [0, -6, 6, -4, 4, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, x: { type: "spring", stiffness: 300, damping: 15 } }}
          >
            <Alert variant="destructive">
              <WarningCircleIcon className="size-4" />
              <AlertDescription>
                {isRateLimited
                  ? t("auth.error_too_many_attempts", { seconds: rateLimitCountdown })
                  : error}
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Login form */}
      <FormProvider {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email" className="font-heading text-xs font-medium">
              {t("auth.email")}
            </Label>
            <Input
              id="email"
              type="email"
              autoFocus
              autoComplete="email"
              placeholder="you@company.com"
              disabled={form.formState.isSubmitting || isRateLimited}
              aria-invalid={!!form.formState.errors.email}
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password" className="font-heading text-xs font-medium">
              {t("auth.password")}
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                disabled={form.formState.isSubmitting || isRateLimited}
                aria-invalid={!!form.formState.errors.password}
                className="pr-9"
                {...form.register("password")}
              />
              <button
                type="button"
                tabIndex={-1}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? t("a11y.hide_password") : t("a11y.show_password")}
              >
                {showPassword ? (
                  <EyeSlashIcon className="size-4" />
                ) : (
                  <EyeIcon className="size-4" />
                )}
              </button>
            </div>
            {form.formState.errors.password && (
              <p className="text-xs text-destructive">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={form.formState.isSubmitting || isRateLimited}
          >
            {form.formState.isSubmitting ? (
              <>
                <Spinner size="sm" />
                {t("auth.signing_in")}
              </>
            ) : (
              t("auth.sign_in")
            )}
          </Button>
        </form>
      </FormProvider>
    </div>
  )
}
