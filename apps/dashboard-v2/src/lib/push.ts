/**
 * Push subscription management for PWA notifications.
 *
 * Registers the service worker, subscribes to push via VAPID key,
 * and sends the subscription to the backend.
 */
import { api } from "@/lib/api"

let registered = false

/**
 * Register the service worker and prompt for push notification permission.
 * Safe to call multiple times — only registers once.
 */
export async function registerPush(): Promise<boolean> {
  if (registered) return true
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.log("[push] Push not supported in this browser")
    return false
  }

  try {
    // Register service worker
    const registration = await navigator.serviceWorker.register("/sw.js")
    console.log("[push] Service worker registered")

    // Get VAPID public key from backend
    const vapidRes = await api.api.notifications.push["vapid-key"].$get()
    if (!vapidRes.ok) {
      console.log("[push] VAPID key not available — push disabled")
      return false
    }
    const { publicKey } = (await vapidRes.json()) as { publicKey: string }

    // Request permission
    const permission = await Notification.requestPermission()
    if (permission !== "granted") {
      console.log("[push] Notification permission denied")
      return false
    }

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    })

    // Send subscription to backend
    const subJson = subscription.toJSON()
    const res = await api.api.notifications.push.subscribe.$post({
      json: {
        endpoint: subJson.endpoint!,
        keys: {
          p256dh: subJson.keys!.p256dh!,
          auth: subJson.keys!.auth!,
        },
      },
    })

    if (!res.ok) {
      console.error("[push] Failed to register subscription with backend")
      return false
    }

    registered = true
    console.log("[push] Push subscription registered successfully")
    return true
  } catch (err) {
    console.error("[push] Registration failed:", err)
    return false
  }
}

/**
 * Unregister push notifications — removes subscription from browser and backend.
 */
export async function unregisterPush(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false

  try {
    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) return false

    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return false

    // Remove from backend
    await api.api.notifications.push.subscribe.$delete({
      json: { endpoint: subscription.endpoint },
    })

    // Unsubscribe from browser
    await subscription.unsubscribe()
    registered = false
    return true
  } catch (err) {
    console.error("[push] Unregister failed:", err)
    return false
  }
}

/**
 * Check if push is currently active (subscribed).
 */
export async function isPushSubscribed(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false

  try {
    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) return false
    const subscription = await registration.pushManager.getSubscription()
    return !!subscription
  } catch {
    return false
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
