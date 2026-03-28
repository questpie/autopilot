import { useTotpSetup } from "./use-totp-setup"
import { StatusView } from "./status-view"
import { PasswordConfirm } from "./password-confirm"
import { QrDisplay } from "./qr-display"
import { VerifyCode } from "./verify-code"
import { BackupCodes } from "./backup-codes"

/**
 * Two-factor authentication settings.
 * Shows current status, enable/disable flow, backup codes, trusted devices.
 */
export function TwoFactorSetup() {
  const totp = useTotpSetup()

  if (totp.phase === "status") {
    return <StatusView is2FAEnabled={totp.is2FAEnabled} onGoToPassword={totp.goToPassword} />
  }

  if (totp.phase === "password") {
    return (
      <PasswordConfirm
        is2FAEnabled={totp.is2FAEnabled}
        password={totp.password}
        error={totp.error}
        isLoading={totp.isLoading}
        onPasswordChange={totp.setPassword}
        onSubmit={() => {
          if (totp.is2FAEnabled) {
            void totp.handleDisable()
          } else {
            void totp.handleEnable()
          }
        }}
        onCancel={totp.goToStatus}
      />
    )
  }

  if (totp.phase === "qr") {
    return (
      <QrDisplay
        totpURI={totp.totpURI}
        manualKey={totp.manualKey}
        onContinue={() => totp.setPhase("verify")}
      />
    )
  }

  if (totp.phase === "verify") {
    return (
      <VerifyCode
        digits={totp.digits}
        error={totp.error}
        isLoading={totp.isLoading}
        inputRefs={totp.inputRefs}
        onDigitChange={totp.handleDigitChange}
        onDigitKeyDown={totp.handleDigitKeyDown}
        onDigitPaste={totp.handleDigitPaste}
        onVerify={() => void totp.handleVerify()}
        onBack={() => totp.setPhase("qr")}
      />
    )
  }

  return (
    <BackupCodes
      backupCodes={totp.backupCodes}
      savedBackup={totp.savedBackup}
      onSavedBackupChange={totp.setSavedBackup}
      onCopyAll={totp.handleCopyAll}
      onDownload={totp.handleDownload}
      onFinish={totp.handleFinish}
    />
  )
}
