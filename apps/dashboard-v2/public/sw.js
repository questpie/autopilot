/**
 * Service Worker for QUESTPIE Autopilot PWA.
 *
 * Handles:
 * - Push event: show OS-level notification
 * - Notification click: open dashboard at deeplink URL
 * - Action buttons: approve tasks directly via POST
 * - Notification close: mark as dismissed
 */

/* eslint-disable no-restricted-globals */

self.addEventListener('push', (event) => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch {
    data = { title: 'QUESTPIE Autopilot', body: event.data.text() }
  }

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'QUESTPIE Autopilot', {
      body: data.body ?? '',
      icon: data.icon ?? '/favicon.ico',
      badge: data.badge,
      tag: data.tag,
      data: data.data,
      actions: data.actions ?? [],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const notifData = event.notification.data ?? {}
  const url = notifData.url ?? '/'

  // Handle action buttons
  if (event.action === 'approve' && notifData.taskId) {
    event.waitUntil(
      fetch(`/api/tasks/${notifData.taskId}/approve`, {
        method: 'POST',
        credentials: 'include',
      }).catch(() => {
        // If the direct POST fails, fall through to opening the dashboard
        return self.clients.openWindow('/inbox')
      })
    )
    return
  }

  // Default: navigate to the URL from notification data
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If dashboard is already open, navigate it
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.navigate(url)
          return client.focus()
        }
      }
      // Otherwise open new window
      return self.clients.openWindow(url)
    })
  )
})

self.addEventListener('notificationclose', (event) => {
  const notifData = event.notification.data ?? {}
  if (notifData.notificationId) {
    // Fire-and-forget: mark as dismissed
    fetch(`/api/notifications/${notifData.notificationId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dismissed: true }),
    }).catch(() => {})
  }
})
