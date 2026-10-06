# Document 19: Release Management & Rollout Strategy

## 1. Executive Summary
This document defines the release management lifecycle, branching strategies, environment staging, and rollback procedures for the Speech Arena platform. Given the competitive nature of the arena (Elo ratings, leaderboards) and the mathematical precision required for acoustic scoring, deployments must be orchestrated to ensure zero downtime, strict version control of scoring weights, and immediate fallback capabilities in the event of an anomaly.

## 2. Versioning Strategy
We employ a modified Semantic Versioning (SemVer) strategy (`MAJOR.MINOR.PATCH`), tightly coupled with the deterministic scoring engine.

### 2.1 Core Components Versioning
*   **Application Services (API, Ingestion, Dashboard):** Follow standard SemVer. 
    *   `PATCH`: Bug fixes, minor UI tweaks (no downtime).
    *   `MINOR`: New features, endpoints, new UI components (backward compatible).
    *   `MAJOR`: Breaking API changes, major architectural shifts.
*   **Scoring Weights (`SCORING_V`):** The weights assigned to specific flaws (e.g., F0 deviation penalty) are versioned independently. Any change to the deterministic scoring formula results in a new `SCORING_V` tag (e.g., `v1.2`). This is critical because past scores cannot be retroactively changed if the formula changes, as that would invalidate historical Elo rankings.

## 3. Branching Model (GitFlow adaptation)
The repository relies on a structured branching model to protect the production environment.

### 3.1 Main Branches
*   `main`: The highly protected branch representing the current state of production. Commits here must be tagged with a release version.
*   `develop`: The integration branch for upcoming releases. All feature branches merge here.

### 3.2 Supporting Branches
*   `feature/*`: Branched from `develop`. Used for new work (e.g., `feature/formant-extraction`). Merged back into `develop` via Pull Request (PR) after passing CI.
*   `release/*`: Branched from `develop` when preparing for a production release. Only bug fixes and documentation updates are allowed here. Merged into `main` and back into `develop`.
*   `hotfix/*`: Branched directly from `main` to address critical production issues. Merged back into `main` and `develop`.

## 4. Environment Architecture
Code progresses through three distinct environments before reaching production.

### 4.1 Development (Dev)
*   **Purpose:** Sandbox for developers.
*   **Data:** Small, synthetic datasets. Mocked S3 buckets and local PostgreSQL databases (often running locally via Docker Compose).
*   **Deployment:** Triggered manually or continuously on every push to a `feature/*` branch.

### 4.2 Staging (Stg)
*   **Purpose:** Pre-production validation. An exact mirror of the production infrastructure, but scaled down.
*   **Data:** A sanitized subset of real production data (anonymized audio, obfuscated user PII).
*   **Deployment:** Triggered automatically when code is merged into the `develop` or `release/*` branch.
*   **Validation:** Automated End-to-End (E2E) testing suites run here. QA teams perform manual exploratory testing.

### 4.3 Production (Prod)
*   **Purpose:** Live environment serving actual users.
*   **Data:** Full production databases and S3 buckets.
*   **Deployment:** Triggered manually via approval gates in the CD pipeline (ArgoCD) when merging a `release/*` or `hotfix/*` branch into `main`.

## 5. Deployment Strategies (Production)
To ensure zero downtime and mitigate risk, production deployments utilize advanced rollout strategies.

### 5.1 Rolling Updates (Standard)
For minor updates and bug fixes, Kubernetes performs a rolling update. It spins up new pods with the new version and gradually terminates old pods, ensuring the API Gateway always has healthy endpoints to route traffic to.

### 5.2 Canary Releases (High Risk / Scoring Changes)
When introducing a new scoring formula or a major change to the feature extraction pipeline, a canary release is mandatory.
1.  **Deploy Canary:** A small number of pods running the new version are deployed alongside the existing production pods.
2.  **Traffic Shifting:** The API Gateway is configured to route a small percentage (e.g., 5%) of live traffic to the canary pods.
3.  **Monitoring:** The observability stack (Datadog/Prometheus) aggressively monitors the canary pods for elevated error rates (5xx), latency spikes, or unexpected scoring distributions.
4.  **Promotion or Rollback:** 
    *   If metrics are stable for 2 hours, traffic is gradually shifted to 100%, and the old pods are terminated.
    *   If anomalies are detected, traffic is immediately shifted back to the stable pods (Rollback).

## 6. Rollback Procedures
Immediate rollback capability is a non-negotiable requirement.

### 6.1 Application Rollback
Because deployment is managed via GitOps (ArgoCD), rolling back an application deployment is as simple as reverting the commit in the `speech-arena-k8s-config` repository. ArgoCD detects the change and immediately scales down the bad pods while scaling up the previous stable version. Target rollback time: < 3 minutes.

### 6.2 Database Rollback (Complex)
Database schema changes are risky. We employ the "Expand and Contract" pattern to ensure forward and backward compatibility.
*   **Expand:** A new column/table is added (without removing the old one). Both old and new application versions can function.
*   **Migrate:** Data is copied/transformed to the new schema.
*   **Contract:** The old column/table is dropped. This only happens in a *subsequent* release, long after the application code relying on it has been removed.
*   If a deployment fails, the application code can be rolled back safely because the database schema still supports the old code.

## 7. Release Communication and Documentation
Every production release is accompanied by:
*   **Release Notes:** Automatically generated from merged PRs and commit messages (using tools like semantic-release). Published to the user community if user-facing changes occurred.
*   **Internal Runbook Update:** If infrastructure changed, DevOps runbooks must be updated.
*   **Scoring Version Changelog:** If `SCORING_V` changed, a detailed explanation of the mathematical changes to the flaw weights must be documented for transparency to the competitive user base.

## 8. Conclusion
The release management strategy described herein ensures that the Speech Arena can iterate rapidly without sacrificing the stability and fairness required by its competitive user base. By leveraging GitOps, Canary deployments, and strict schema management, the engineering team can deploy with confidence, knowing that safeguards are in place to prevent catastrophic failures.
