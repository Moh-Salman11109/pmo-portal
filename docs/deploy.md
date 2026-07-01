# Deployment — Docker + Kubernetes (GKE) via GitHub Actions

This app is a **Vite + React static SPA**. It builds to `dist/` and is served by a
hardened, non-root nginx container. **One immutable image serves every environment** —
configuration is injected at runtime, not baked at build time.

## How runtime config works

`VITE_*` values are normally frozen into the JS bundle by `vite build`. To avoid
rebuilding per environment:

1. The app reads config through `src/config/runtimeEnv.js`, which merges
   `window.__APP_CONFIG__` over `import.meta.env`.
2. `public/config.js` is an empty placeholder (dev uses local `.env`).
3. In the container, `docker/40-render-config.sh` runs at startup and rewrites
   `/config.js` from the pod's `VITE_*` env vars (sourced from the ConfigMap).

So to change config for an environment you edit the **ConfigMap** (via the overlay) and
restart — no image rebuild.

## Image

```
me-central2-docker.pkg.dev/prj-cmn-platform-tree/artifact-app-bus-fe/img-fe-pmo-portal
```

Tagged `sha-<12>` (immutable, used for deploys) and the branch/tag name.

## Pipeline (Build-Once-Deploy-Many)

**`.github/workflows/ci.yml`** is a thin caller of the shared platform reusable workflow
[`build-node-pmo.yml`](https://github.com/TreeDigitalInsurance/tree-platform-workflows/blob/main/.github/workflows/build-node-pmo.yml)
(`@v0`). On every push to `main` it runs the SPA quality gate (lint / test / build) and pushes
ONE immutable image to Artifact Registry as `sha-<git-sha>`. **Deployment is manual** (see
below) — there is no CD workflow.

Gate configuration passed to the reusable workflow:
- `run_format_check: false` — this repo has no `format:check` script yet.
- `lint_soft_fail: true` — 8 pre-existing `react-hooks` lint errors are non-blocking for now.

Image coordinates are pinned via inputs: `service_name: pmo-portal`, `gcp_region: me-central2`,
`artifact_registry_repo: artifact-app-bus-fe`, `artifact_registry_image: img-fe-pmo-portal`.

## Required GitHub configuration

**Secrets** — forwarded via `secrets: inherit`; names must match what the platform workflow
declares (keyless GCP auth via Workload Identity Federation, no JSON keys):

| Secret | Value |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/<num>/locations/global/workloadIdentityPools/<pool>/providers/<provider>` |
| `GCP_SERVICE_ACCOUNT` | service account, e.g. `deployer@prj-cmn-platform-tree.iam.gserviceaccount.com` |
| `GOOGLE_PROJECT` | GCP project id `prj-cmn-platform-tree` (used to build the image path) |

The service account needs `roles/artifactregistry.writer` (push) on `prj-cmn-platform-tree`.

> Requires tree-platform-workflows PR #6 (adds `build-node-pmo.yml`) to be merged and
> included in the `@v0` release before this workflow resolves.

## Kubernetes manifests live in the GitOps repo

The Kustomize manifests are **not** in this repo. They live in
[`TreeDigitalInsurance/gitops-repo`](https://github.com/TreeDigitalInsurance/gitops-repo/tree/main/k8s-kustomize/frontend/pmo-portal),
following the standard `k8s-kustomize/frontend/<app>` layout:

```
k8s-kustomize/frontend/pmo-portal/
├── base/{deployment,service,kustomization}.yaml
└── overlays/{preprod,prod,uat}/{kustomization.yaml,config.env,ns.yaml}
```

Per-environment `VITE_*` runtime config is set in each overlay's `config.env`
(`configMapGenerator` → `pmo-portal-config`), consumed by the Deployment via `envFrom`, and
rendered into `/config.js` at container startup. Namespaces: `ns-fe-solutions / ns-uat-fe-solutions / ns-preprod-fe-solutions`.

## Manual deploy (until CD is added)

This repo's CI builds and pushes the image as `:sha-<12>` (and `:main`). Deploy from the
GitOps repo by pinning that tag:

```bash
# in a gitops-repo checkout, authenticate to the cluster, then:
cd k8s-kustomize/frontend/pmo-portal/overlays/prod        # or uat / preprod
kustomize edit set image \
  me-central2-docker.pkg.dev/prj-cmn-platform-tree/artifact-app-bus-fe/img-fe-pmo-portal=me-central2-docker.pkg.dev/prj-cmn-platform-tree/artifact-app-bus-fe/img-fe-pmo-portal:sha-<12>
kustomize build . | kubectl apply -f -
kubectl -n ns-fe-solutions rollout status deployment/pmo-portal
```

Commit the `newTag` bump in the GitOps repo so it reflects what's deployed (and so an ArgoCD
sync, if configured, picks it up).

## Environment-specific values

Edit the relevant `config.env` in the GitOps repo overlay. Fill in the real Azure
client/tenant IDs and confirm hosts/SP URLs (currently `*.tree.com.sa` / defaults) before the
first real deploy.

## Rollback

Manual (deploys are manual for now):

```bash
kubectl -n ns-fe-solutions rollout undo deployment/pmo-portal
# or to a specific revision:
kubectl -n ns-fe-solutions rollout history deployment/pmo-portal
kubectl -n ns-fe-solutions rollout undo deployment/pmo-portal --to-revision=<N>
```

## Guardrails

- Least-privilege workflow `permissions`; keyless OIDC auth (no stored keys).
- Build-Once-Deploy-Many: a single immutable image is built and pushed; the same tag is
  deployed to every environment.
- `CODEOWNERS` routes infra/CI changes to the DevOps team.
- Enable branch protection on `main`: require Code Owner review. (CI runs post-merge on
  push to `main`; add a PR-triggered check separately if you want pre-merge gating.)
- Actions are pinned to major version tags. For stricter supply-chain posture, pin to commit
  SHAs.
