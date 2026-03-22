# QUESTPIE Autopilot — Deployment Guide

> Internal deployment reference. Covers the live landing page and future orchestrator deployment.
> Last updated: 2026-03-22

---

## 1. Current Deployment (Landing Page)

The landing page is live at **https://autopilot.questpie.com**.

### What's Deployed

| Component | Detail |
|-----------|--------|
| Application | TanStack Start SSR app served by Bun |
| Docker image | `questpie/autopilot-docs:latest` on DockerHub |
| Cluster | k3s at Hetzner |
| Namespace | `questpie-infra` |
| Ingress | Traefik with `websecure` entrypoint |
| TLS | cert-manager with `letsencrypt-dns` ClusterIssuer (Cloudflare DNS-01) |
| CI/CD | Woodpecker CI at `https://ci.eu-infra.questpie.com` |
| Platform | `linux/arm64` (Hetzner ARM nodes) |

### Kubernetes Resources

All manifests live in `~/questpie/infra/k3s/manifests/questpie-infra/autopilot-docs/`:

- **Deployment** (`deployment.yaml`) — 1 replica, image `questpie/autopilot-docs:latest`, port 3000, requests 64Mi/25m, limits 256Mi/250m. Includes readiness probe (GET `/` every 10s) and liveness probe (GET `/` every 30s). Uses `dockerhub-pull-secret` for image pulls.
- **Service** (`service.yaml`) — ClusterIP, port 3000 -> 3000.
- **Ingress** (`ingress.yaml`) — Host `autopilot.questpie.com`, path `/`, TLS secret `autopilot-questpie-tls`.
- **Middleware** (`middleware.yaml`) — Traefik `stripPrefix` middleware stripping `/autopilot` (available if path-based routing is needed).

### Docker Image

The Dockerfile at `apps/web/Dockerfile` uses a 3-stage build:

1. **Pruner** — uses `turbo prune @questpie/autopilot-web --docker` to isolate the web app from the monorepo
2. **Builder** — installs deps with `bun install --frozen-lockfile`, builds with `DISABLE_PRERENDER=true bun run build`
3. **Runner** — copies `dist/` and `serve.ts`, installs runtime React deps, runs `bun run serve.ts` on port 3000

The serve script (`apps/web/serve.ts`) uses `Bun.serve` to handle static assets from `dist/client/` with immutable cache headers and SSR for everything else.

### CI/CD Pipeline

The Woodpecker pipeline at `~/questpie/infra/woodpecker-config-service/configs/questpie/autopilot/.woodpecker/deploy.yml`:

- **Trigger:** push to `main` branch or manual trigger
- **Build step:** uses `woodpeckerci/plugin-docker-buildx:6` to build for `linux/arm64` and push to `questpie/autopilot-docs:latest` on DockerHub
- **Credentials:** `docker_username` and `docker_password` from Woodpecker secrets
- **Note:** The pipeline builds and pushes the image but does NOT restart the k8s deployment. The deployment has `imagePullPolicy: Always`, so a rollout restart is needed to pick up the new image.

### How to Redeploy

**Option 1: CI auto-build + manual restart (standard flow)**

```bash
# Push triggers Woodpecker to build and push the Docker image
git push origin main

# After CI finishes, restart the deployment to pull the new image
kubectl rollout restart deployment/autopilot-docs -n questpie-infra
```

**Option 2: Fully manual build and deploy**

```bash
# Build from monorepo root
docker buildx build --platform linux/arm64 -f apps/web/Dockerfile -t questpie/autopilot-docs:latest --push .

# Restart to pull the new image
kubectl rollout restart deployment/autopilot-docs -n questpie-infra
```

**Option 3: Local testing before deploy**

```bash
# Build for local architecture (drop --platform for native)
docker build -f apps/web/Dockerfile -t questpie/autopilot-docs:local .

# Run locally
docker run -p 3000:3000 questpie/autopilot-docs:local

# Visit http://localhost:3000
```

---

## 2. Deploying the Orchestrator (Future)

The orchestrator runs the Autopilot runtime: agents, webhooks, API server, watcher, scheduler. For Autopilot Cloud, each company gets its own pod.

### Architecture

```
Pod per company:
  ├── Bun process (orchestrator)
  │   ├── Webhook server on port 7777
  │   ├── API + FS server on port 7778
  │   ├── Watcher (chokidar on company dir)
  │   ├── Scheduler (cron jobs)
  │   └── Session manager (agent spawning)
  └── PVC mount at /data/company
```

### Sample Orchestrator Dockerfile

```dockerfile
FROM oven/bun:1.3.0-alpine
WORKDIR /app

# Copy built orchestrator and CLI
COPY packages/orchestrator/dist ./dist
COPY packages/cli/dist ./cli

# Copy company templates for `autopilot init`
COPY templates/solo-dev-shop ./templates/solo-dev-shop

# Runtime environment
ENV PORT=7778
ENV WEBHOOK_PORT=7777
ENV NODE_ENV=production

EXPOSE 7777 7778

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD bun -e "fetch('http://localhost:7778/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["bun", "run", "dist/index.js"]
```

### Sample Kubernetes Manifests

#### Deployment with PVC

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: autopilot-orchestrator-{company-slug}
  namespace: questpie-autopilot
  labels:
    app: autopilot-orchestrator
    company: "{company-slug}"
spec:
  replicas: 1  # Always 1 per company (single-process model)
  strategy:
    type: Recreate  # No rolling update — only one writer per company
  selector:
    matchLabels:
      app: autopilot-orchestrator
      company: "{company-slug}"
  template:
    metadata:
      labels:
        app: autopilot-orchestrator
        company: "{company-slug}"
    spec:
      imagePullSecrets:
        - name: dockerhub-pull-secret
      containers:
        - name: orchestrator
          image: questpie/autopilot-orchestrator:latest
          imagePullPolicy: Always
          ports:
            - name: webhooks
              containerPort: 7777
            - name: api
              containerPort: 7778
          env:
            - name: ANTHROPIC_API_KEY
              valueFrom:
                secretKeyRef:
                  name: autopilot-{company-slug}-secrets
                  key: anthropic-api-key
            - name: COMPANY_ROOT
              value: /data/company
            - name: WEBHOOK_PORT
              value: "7777"
            - name: PORT
              value: "7778"
          volumeMounts:
            - name: company-data
              mountPath: /data/company
          resources:
            requests:
              memory: "128Mi"
              cpu: "50m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          readinessProbe:
            httpGet:
              path: /api/health
              port: 7778
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /api/health
              port: 7778
            initialDelaySeconds: 15
            periodSeconds: 30
      volumes:
        - name: company-data
          persistentVolumeClaim:
            claimName: autopilot-{company-slug}-data
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: autopilot-{company-slug}-data
  namespace: questpie-autopilot
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
  storageClassName: hcloud-volumes  # Hetzner CSI
```

#### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: autopilot-{company-slug}
  namespace: questpie-autopilot
  labels:
    app: autopilot-orchestrator
    company: "{company-slug}"
spec:
  selector:
    app: autopilot-orchestrator
    company: "{company-slug}"
  ports:
    - name: webhooks
      port: 7777
      targetPort: 7777
      protocol: TCP
    - name: api
      port: 7778
      targetPort: 7778
      protocol: TCP
```

#### Ingress (Subdomain Routing)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: autopilot-{company-slug}
  namespace: questpie-autopilot
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-dns
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
    traefik.ingress.kubernetes.io/router.tls: "true"
spec:
  ingressClassName: traefik
  tls:
    - hosts:
        - "{company-slug}.autopilot.questpie.com"
      secretName: autopilot-{company-slug}-tls
  rules:
    - host: "{company-slug}.autopilot.questpie.com"
      http:
        paths:
          - path: /webhooks
            pathType: Prefix
            backend:
              service:
                name: autopilot-{company-slug}
                port:
                  number: 7777
          - path: /
            pathType: Prefix
            backend:
              service:
                name: autopilot-{company-slug}
                port:
                  number: 7778
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes | - | Claude API key for agent sessions |
| `COMPANY_ROOT` | Yes | - | Path to company data directory |
| `PORT` | No | `7778` | API server port |
| `WEBHOOK_PORT` | No | `7777` | Webhook server port |
| `NODE_ENV` | No | `development` | Set to `production` in containers |
| `MAX_CONCURRENT_AGENTS` | No | `5` | Max simultaneous agent sessions |

### Resource Estimates

- Memory: ~128MB per company pod (mostly I/O wait on Claude API calls)
- CPU: minimal, burst on context assembly and YAML parsing
- Storage: 1Gi PVC covers ~10K tasks with full history
- One 4GB RAM node can host ~30 companies

---

## 3. Infrastructure Overview

### Cluster

- **Provider:** Hetzner Cloud
- **Distribution:** k3s (lightweight Kubernetes)
- **Architecture:** ARM64 nodes
- **Kubeconfig:** configured locally for `kubectl` access

### Filesystem Layout

```
~/questpie/infra/
├── k3s/
│   ├── manifests/
│   │   └── questpie-infra/          # Namespace: questpie-infra
│   │       └── autopilot-docs/      # Landing page resources
│   │           ├── deployment.yaml
│   │           ├── service.yaml
│   │           ├── ingress.yaml
│   │           └── middleware.yaml
│   └── helm-values/
│       └── woodpecker.yaml          # Woodpecker CI Helm values
└── woodpecker-config-service/
    └── configs/
        └── questpie/
            └── autopilot/
                └── .woodpecker/
                    └── deploy.yml   # CI pipeline definition
```

### Networking Stack

| Layer | Technology | Config |
|-------|-----------|--------|
| DNS | Cloudflare | `autopilot.questpie.com` -> Hetzner LB |
| Ingress | Traefik | Installed via k3s, `websecure` entrypoint (443) |
| TLS | cert-manager | `letsencrypt-dns` ClusterIssuer, Cloudflare DNS-01 challenge |
| Image Pull | DockerHub | `dockerhub-pull-secret` in `questpie-infra` namespace |

### CI/CD

| Component | Detail |
|-----------|--------|
| CI system | Woodpecker CI |
| URL | `https://ci.eu-infra.questpie.com` |
| Admin | `drepkovsky` |
| SCM | GitHub |
| Config injection | `woodpecker-config-service` (injects pipeline configs from infra repo) |
| Build plugin | `woodpeckerci/plugin-docker-buildx:6` (privileged) |
| Secrets | `docker_username`, `docker_password` in Woodpecker |

---

## 4. Updating the Landing Page

### Step-by-Step

1. **Make changes** in `apps/web/`:
   ```bash
   cd ~/questpie/repos/questpie-autopilot
   # Edit components, pages, styles, etc.
   ```

2. **Test locally:**
   ```bash
   bun install
   cd apps/web
   bun run dev
   # Visit http://localhost:3000
   ```

3. **Build locally to verify production build:**
   ```bash
   cd apps/web
   DISABLE_PRERENDER=true bun run build
   bun run serve.ts
   # Visit http://localhost:3000
   ```

4. **Push to main:**
   ```bash
   git add -A
   git commit -m "feat(web): update landing page"
   git push origin main
   ```

5. **Wait for CI** — check build status at `https://ci.eu-infra.questpie.com`

6. **Restart deployment** (CI builds the image but does not restart the pod):
   ```bash
   kubectl rollout restart deployment/autopilot-docs -n questpie-infra
   ```

7. **Verify:**
   ```bash
   # Check rollout status
   kubectl rollout status deployment/autopilot-docs -n questpie-infra

   # Check the site
   curl -sI https://autopilot.questpie.com | head -5
   ```

### Important Notes

- The Woodpecker pipeline only builds and pushes the Docker image. It does **not** trigger a k8s rollout restart. You must do that manually.
- The deployment uses `imagePullPolicy: Always`, so a rollout restart will always pull the latest image.
- Build platform is `linux/arm64` — if you build locally on an x86 Mac, use `docker buildx build --platform linux/arm64` or the image won't run on the cluster.

---

## 5. Monitoring & Debugging

### Check Pod Status

```bash
# List pods
kubectl get pods -n questpie-infra -l app=autopilot-docs

# Detailed pod info (events, conditions, IP)
kubectl describe pod -n questpie-infra -l app=autopilot-docs

# Check deployment status
kubectl get deployment autopilot-docs -n questpie-infra

# Watch rollout in real-time
kubectl rollout status deployment/autopilot-docs -n questpie-infra
```

### View Logs

```bash
# Current pod logs
kubectl logs -n questpie-infra -l app=autopilot-docs

# Follow logs in real-time
kubectl logs -n questpie-infra -l app=autopilot-docs -f

# Previous pod logs (after crash/restart)
kubectl logs -n questpie-infra -l app=autopilot-docs --previous
```

### Check if the Site is Up

```bash
# Quick health check
curl -sI https://autopilot.questpie.com | head -5

# Full response check
curl -s https://autopilot.questpie.com | head -20

# Check TLS certificate
curl -vI https://autopilot.questpie.com 2>&1 | grep -E "(subject|expire|issuer)"
```

### Check Ingress and Service

```bash
# Ingress status
kubectl get ingress autopilot-docs -n questpie-infra

# Service endpoints (should show pod IP)
kubectl get endpoints autopilot-docs -n questpie-infra

# TLS certificate secret
kubectl get secret autopilot-questpie-tls -n questpie-infra
```

### Common Issues and Fixes

#### Pod is `ImagePullBackOff`

The Docker image failed to pull. Check:
```bash
kubectl describe pod -n questpie-infra -l app=autopilot-docs
```
- Verify `dockerhub-pull-secret` exists: `kubectl get secret dockerhub-pull-secret -n questpie-infra`
- Verify image exists: `docker manifest inspect questpie/autopilot-docs:latest`
- Check if DockerHub rate limit is hit (anonymous pulls are limited)

#### Pod is `CrashLoopBackOff`

The app is crashing on startup:
```bash
kubectl logs -n questpie-infra -l app=autopilot-docs --previous
```
- Common cause: missing runtime dependencies in the Docker image
- Fix: rebuild the image, check `serve.ts` and `dist/` are present

#### Site Returns 502/503

Pod is running but Traefik can't reach it:
```bash
# Check if pod is actually ready
kubectl get pods -n questpie-infra -l app=autopilot-docs -o wide

# Check if service has endpoints
kubectl get endpoints autopilot-docs -n questpie-infra
```
- If endpoints are empty, the readiness probe is failing — check pod logs
- If endpoints exist, check Traefik logs: `kubectl logs -n kube-system -l app.kubernetes.io/name=traefik`

#### TLS Certificate Not Issued

```bash
# Check certificate status
kubectl get certificate -n questpie-infra
kubectl describe certificate autopilot-questpie-tls -n questpie-infra

# Check cert-manager logs
kubectl logs -n cert-manager -l app=cert-manager
```
- Common cause: Cloudflare API token expired or DNS propagation delay
- The ClusterIssuer `letsencrypt-dns` uses DNS-01 challenge via Cloudflare

#### CI Build Fails

Check the Woodpecker UI at `https://ci.eu-infra.questpie.com`:
- Navigate to the `questpie/autopilot` repo
- Check the failed pipeline logs
- Common causes: `bun install --frozen-lockfile` fails (lockfile out of sync), TypeScript build errors, Docker buildx issues

#### Need to Roll Back

```bash
# Check rollout history
kubectl rollout history deployment/autopilot-docs -n questpie-infra

# Undo last rollout
kubectl rollout undo deployment/autopilot-docs -n questpie-infra
```

### Quick Reference

| Action | Command |
|--------|---------|
| Pod status | `kubectl get pods -n questpie-infra -l app=autopilot-docs` |
| Pod logs | `kubectl logs -n questpie-infra -l app=autopilot-docs` |
| Restart | `kubectl rollout restart deployment/autopilot-docs -n questpie-infra` |
| Rollback | `kubectl rollout undo deployment/autopilot-docs -n questpie-infra` |
| Site check | `curl -sI https://autopilot.questpie.com` |
| CI dashboard | `https://ci.eu-infra.questpie.com` |
