import { onCLS, onINP, onLCP, onFCP, onTTFB } from "web-vitals"
import type { Metric } from "web-vitals"

function reportMetric(metric: Metric) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(`[Web Vitals] ${metric.name}: ${metric.value.toFixed(2)}`)
  }
}

export function initWebVitals() {
  onCLS(reportMetric)
  onINP(reportMetric)
  onLCP(reportMetric)
  onFCP(reportMetric)
  onTTFB(reportMetric)
}
