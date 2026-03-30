import { createFileRoute, useRouter } from "@tanstack/react-router"
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
import { useReducer, useRef, useCallback, useEffect } from "react"
import { m, AnimatePresence } from "framer-motion"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

type LoginValues = z.infer<typeof loginSchema>

const loginSearchSchema = z.object({
  redirect: z.string()
    .refine(u => u.startsWith('/') && !u.startsWith('//'), 'Invalid redirect')
    .optional(),
})

function isValidRedirect(url: string | undefined): url is string {
  if (!url) return false
  // Must start with / and not // (prevent protocol-relative URLs)
  return url.startsWith('/') && !url.startsWith('//')
}

export const Route = createFileRoute("/_auth/login")({
  component: LoginPage,
  validateSearch: loginSearchSchema,
})

type LoginState = {
  showPassword: boolean
  error: string | null
  showError: boolean
  failCount: number
  rateLimitCountdown: number
}

type LoginAction =
  | { type: "TOGGLE_PASSWORD" }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_FAIL"; error: string; rateLimit: boolean }
  | { type: "COUNTDOWN_TICK" }

const loginInitialState: LoginState = {
  showPassword: false,
  error: null,
  showError: false,
  failCount: 0,
  rateLimitCountdown: 0,
}

function loginReducer(state: LoginState, action: LoginAction): LoginState {
  switch (action.type) {
    case "TOGGLE_PASSWORD":
      return { ...state, showPassword: !state.showPassword }
    case "SUBMIT_START":
      return { ...state, error: null, showError: false }
    case "SUBMIT_FAIL": {
      const newCount = state.failCount + 1
      return {
        ...state,
        failCount: newCount,
        error: action.error,
        showError: true,
        rateLimitCountdown: action.rateLimit ? 60 : state.rateLimitCountdown,
      }
    }
    case "COUNTDOWN_TICK": {
      const next = state.rateLimitCountdown - 1
      if (next <= 0) {
        return { ...state, rateLimitCountdown: 0, failCount: 0 }
      }
      return { ...state, rateLimitCountdown: next }
    }
    default:
      return state
  }
}

function LoginPage() {
  "use no memo"
  const { t } = useTranslation()
  const router = useRouter()
  const search = Route.useSearch()
  const redirect = search.redirect

  const [state, dispatch] = useReducer(loginReducer, loginInitialState)

  const { showPassword, error, showError, failCount, rateLimitCountdown } = state
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    emailInputRef.current?.focus()
  }, [])

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  const startRateLimitCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    let ticks = 60
    countdownRef.current = setInterval(() => {
      ticks--
      dispatch({ type: "COUNTDOWN_TICK" })
      if (ticks <= 0 && countdownRef.current) {
        clearInterval(countdownRef.current)
        countdownRef.current = null
      }
    }, 1000)
  }, [])

  const onSubmit = async (values: LoginValues) => {
    if (rateLimitCountdown > 0) return

    dispatch({ type: "SUBMIT_START" })

    const result = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    })

    if (result.error) {
      const shouldRateLimit = failCount + 1 >= 10
      dispatch({
        type: "SUBMIT_FAIL",
        error: shouldRateLimit
          ? t("auth.error_too_many_attempts", { seconds: 60 })
          : (result.error.message ?? t("auth.error_invalid_credentials")),
        rateLimit: shouldRateLimit,
      })
      if (shouldRateLimit) {
        startRateLimitCountdown()
      }
      return
    }

    // Check if 2FA is needed -- Better Auth returns redirect=true for 2FA
    if (result.data?.redirect) {
      void router.invalidate().then(() => router.navigate({ to: "/login/2fa" }))
      return
    }

    // Success: redirect (validated to prevent open redirects)
    void router.invalidate().then(() => router.navigate({ to: isValidRedirect(redirect) ? redirect : "/" }))
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
          <m.div
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
          </m.div>
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
              autoComplete="email"
              placeholder="you@company.com"
              disabled={form.formState.isSubmitting || isRateLimited}
              aria-invalid={!!form.formState.errors.email}
              {...form.register("email")}
              ref={(el) => {
                form.register("email").ref(el)
                emailInputRef.current = el
              }}
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
                onClick={() => dispatch({ type: "TOGGLE_PASSWORD" })}
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
