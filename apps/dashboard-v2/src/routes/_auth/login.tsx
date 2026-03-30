import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useTranslation } from "@/lib/i18n"
import { useForm, FormProvider } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@hookform/resolvers/zod"
import { authClient } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { EyeIcon, EyeSlashIcon, WarningCircleIcon, EnvelopeSimpleIcon, ArrowCounterClockwiseIcon, TerminalWindowIcon } from "@phosphor-icons/react"
import { useReducer, useRef, useCallback, useEffect, useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useDeploymentMode } from "@/hooks/use-deployment-mode"
import { m, AnimatePresence } from "framer-motion"
import { EASING } from "@/lib/motion"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

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

const screenTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
  transition: { duration: 0.2, ease: EASING.enter },
}

function EmailVerificationScreen({ email, password, onBack }: { email: string; password: string; onBack: () => void }) {
  const { t } = useTranslation()
  const router = useRouter()
  const { data: deploymentMode } = useDeploymentMode()

  // Poll: try sign-in every 5s — succeeds only after email is verified
  const { error: checkError, refetch, isFetching: isChecking } = useQuery({
    queryKey: ["login-email-verification-poll", email],
    queryFn: async () => {
      const result = await authClient.signIn.email({ email, password })
      if (result.error) throw new Error("not_verified")
      await router.invalidate()
      await router.navigate({ to: "/" })
      return true
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
      <h2 className="font-heading text-xl font-semibold">
        {t("setup.step_1_verify_title")}
      </h2>

      <div className="flex flex-col items-center gap-4 py-6">
        <div className="flex size-16 items-center justify-center border border-primary/25 bg-primary/[0.08]">
          <EnvelopeSimpleIcon className="size-8 text-primary" />
        </div>
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            {t("setup.step_1_verify_sent_to", { email: "" })}
          </p>
          <p className="font-heading text-sm font-medium text-foreground">
            {email}
          </p>
        </div>
      </div>

      {checkError && (
        <Alert variant="warning">
          <WarningCircleIcon className="size-4" />
          <AlertDescription>{t("setup.step_1_verify_not_yet")}</AlertDescription>
        </Alert>
      )}

      {deploymentMode && deploymentMode !== "cloud" && (
        <Alert variant="info">
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

      <button
        type="button"
        className="text-xs text-muted-foreground hover:text-foreground"
        onClick={onBack}
      >
        {t("auth.back_to_login")}
      </button>
    </div>
  )
}

function LoginPage() {
  "use no memo"
  const { t } = useTranslation()
  const router = useRouter()
  const search = Route.useSearch()
  const redirect = search.redirect

  const [state, dispatch] = useReducer(loginReducer, loginInitialState)
  const [verifyCredentials, setVerifyCredentials] = useState<{ email: string; password: string } | null>(null)

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
      const msg = result.error.message?.toLowerCase() ?? ""
      if (msg.includes("email") && msg.includes("verified")) {
        setVerifyCredentials({ email: values.email, password: values.password })
        return
      }

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

    const target = result.data?.redirect
      ? "/login/2fa"
      : isValidRedirect(redirect) ? redirect : "/"

    // Invalidate cached route data (auth state changed), then navigate.
    // invalidate() may throw if a beforeLoad fires a redirect — that's fine,
    // the router handles it. We navigate as fallback.
    try { await router.invalidate() } catch { /* redirect thrown by beforeLoad */ }
    await router.navigate({ to: target })
  }

  const isRateLimited = rateLimitCountdown > 0

  return (
    <AnimatePresence mode="wait">
      {verifyCredentials ? (
        <m.div key="verify" {...screenTransition}>
          <EmailVerificationScreen email={verifyCredentials.email} password={verifyCredentials.password} onBack={() => setVerifyCredentials(null)} />
        </m.div>
      ) : (
        <m.div key="login" {...screenTransition}>
          <div className="flex flex-col gap-6">
            <h2 className="font-heading text-xl font-semibold">
              {t("auth.sign_in")}
            </h2>

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

            <FormProvider {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex flex-col gap-4"
                noValidate
              >
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

                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={form.formState.isSubmitting || isRateLimited}
                  loading={form.formState.isSubmitting}
                >
                  {t("auth.sign_in")}
                </Button>
              </form>
            </FormProvider>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  )
}
