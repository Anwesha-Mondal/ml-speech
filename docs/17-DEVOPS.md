# Document 17: DevOps, CI/CD, and Cloud Infrastructure Architecture

## 1. Executive Summary: The Backbone of the Speech Arena
The Speech Arena relies on a highly scalable, resilient, and automated infrastructure to process heavy audio files, extract acoustic features, perform temporal grounding, and serve real-time dashboard experiences. This document outlines the exhaustive DevOps practices, Continuous Integration and Continuous Deployment (CI/CD) pipelines, containerization strategies, orchestration mechanisms, cloud infrastructure provisioning, and observability frameworks required to support the platform.

This architecture is designed to handle high concurrency during public battles, massive batch processing during dataset ingestion, and low-latency responses for the leaderboards and scoring dashboards.

## 2. Cloud Infrastructure Architecture (AWS)
The platform is hosted primarily on Amazon Web Services (AWS), utilizing a microservices architecture. Infrastructure as Code (IaC) is strictly enforced using Terraform and AWS CloudFormation.

### 2.1 Compute Layer
#### 2.1.1 Amazon Elastic Kubernetes Service (EKS)
*   **Purpose:** Orchestrates all microservices, including the API Gateway, Ingestion Service, Alignment Service, Feature Extraction Service, Scoring Service, and the Dashboard Backend.
*   **Node Groups:**
    *   **General Purpose:** `m5.large` instances for lightweight microservices (API Gateway, Leaderboard Service).
    *   **Memory-Optimized:** `r5.xlarge` instances for the Alignment Service and Temporal Grounding (handling large DTW matrices).
    *   **Compute-Optimized:** `c5.2xlarge` instances for acoustic feature extraction (F0, RMS, MFCC).
    *   **GPU Instances:** `g4dn.xlarge` (NVIDIA T4) dedicated to the Wav2Vec2 forced alignment model inference.
*   **Autoscaling:**
    *   **Cluster Autoscaler:** Automatically provisions new EC2 nodes when pods cannot be scheduled due to resource constraints.
    *   **Horizontal Pod Autoscaler (HPA):** Scales the number of pod replicas based on CPU utilization (target 70%) or custom metrics (e.g., length of the SQS queue for processing).

#### 2.1.2 AWS Lambda (Serverless)
*   **Purpose:** Handles asynchronous, event-driven, short-lived tasks to offload the EKS cluster.
*   **Use Cases:**
    *   Triggering initial file validation when a new `.wav` file is uploaded to S3.
    *   Updating the Redis leaderboard periodically.
    *   Generating daily summary reports for the dashboard.
    *   Data lifecycle management (archiving old raw audio to Glacier).

### 2.2 Storage Layer
#### 2.2.1 Amazon Simple Storage Service (S3)
*   **Purpose:** The primary data lake for all unstructured and semi-structured data.
*   **Buckets:**
    *   `speech-arena-raw-audio-inbox`: Landing zone for user uploads. Transient storage (7-day lifecycle).
    *   `speech-arena-normalized-audio`: Stores 16kHz, mono WAV files ready for processing.
    *   `speech-arena-features-parquet`: Stores the extracted acoustic feature arrays (MFCC, F0, RMS) in Parquet format. Partitioned by `dataset_id/speaker_id/`.
    *   `speech-arena-alignments`: Stores TextGrids and JSON alignment outputs from Wav2Vec2/MFA.
*   **Security:** Block Public Access enforced. KMS encryption (SSE-KMS) for data at rest. Strict IAM policies governing read/write access.

#### 2.2.2 Amazon Relational Database Service (RDS) - PostgreSQL
*   **Purpose:** The single source of truth for structured relational data.
*   **Schema Content:** User metadata, dataset metadata, reference text definitions, flaw taxonomy definitions, battle histories, and pointers (S3 URIs) to the Parquet feature files.
*   **Configuration:** Multi-AZ deployment for high availability. Automated daily backups with a 30-day retention period. `db.r6g.large` instances.

#### 2.2.3 Amazon ElastiCache (Redis)
*   **Purpose:** High-speed in-memory data store.
*   **Use Cases:**
    *   **Leaderboard Caching:** Serving real-time Elo ratings and rankings.
    *   **Session Management:** Storing user session tokens (JWTs).
    *   **Rate Limiting:** Preventing API abuse (token bucket algorithm).

### 2.3 Networking and Content Delivery
#### 2.3.1 Amazon Virtual Private Cloud (VPC)
*   **Architecture:** Multiple availability zones.
    *   **Public Subnets:** Application Load Balancers (ALB), NAT Gateways, Bastion Hosts.
    *   **Private Subnets:** EKS Worker Nodes, RDS instances, ElastiCache clusters.
*   **Security Groups:** Strictly defining ingress/egress rules based on the principle of least privilege (e.g., RDS only accepts traffic from the EKS worker node security group).

#### 2.3.2 Amazon API Gateway & Route 53
*   **Route 53:** DNS management, pointing `api.speecharena.com` and `app.speecharena.com` to the respective ALBs/CloudFront distributions.
*   **API Gateway:** Routes RESTful and WebSocket traffic to the backend services. Integrates with AWS WAF (Web Application Firewall) for protection against SQL injection, XSS, and DDoS attacks.

#### 2.3.3 Amazon CloudFront
*   **Purpose:** Content Delivery Network (CDN) for serving the React frontend application (Dashboard) and caching static assets (CSS, JS, images). Lowers latency for global users.

## 3. Containerization Strategy (Docker)
Every component of the Speech Arena is containerized using Docker, ensuring consistency across development, staging, and production environments.

### 3.1 Base Images
*   **Python Services (Ingestion, Scoring):** `python:3.10-slim-bullseye`. Slim images minimize attack surface and image size.
*   **Data Science Services (Alignment, Features):** Specialized images built on top of `nvidia/cuda:11.8.0-runtime-ubuntu22.04` to support GPU-accelerated PyTorch/Wav2Vec2.
*   **Frontend (Dashboard):** Nginx alpine image `nginx:1.25-alpine` serving the static React build.

### 3.2 Dockerfile Best Practices Enforced
*   **Multi-Stage Builds:** Used extensively to separate build dependencies from the final runtime environment, drastically reducing image size (e.g., compiling Praat/MFA binaries in a builder stage and only copying the executable).
*   **Non-Root User:** All containers run as a non-root user (`USER appuser`) for security compliance.
*   **Dependency Pinning:** `requirements.txt` (Python) and `package-lock.json` (Node) strictly pin specific versions.
*   **Caching:** Optimizing `COPY` instructions to leverage Docker's layer caching (copying `requirements.txt` and installing dependencies before copying the source code).

## 4. Continuous Integration (CI) Pipeline
The CI pipeline is automated using GitHub Actions. It triggers on every push to a branch and every Pull Request opened against `main` or `develop`.

### 4.1 Linting and Static Analysis
*   **Python:** `flake8` for style, `black` for formatting, `mypy` for static type checking, `bandit` for security vulnerability scanning.
*   **JavaScript/TypeScript:** `eslint` and `prettier`.
*   **Infrastructure:** `tflint` for Terraform code, `checkov` for IaC security scanning.

### 4.2 Unit and Integration Testing
*   **Unit Tests:** Executed using `pytest` (Python) and `jest` (React). Coverage must remain above 85% (enforced by SonarQube).
*   **Integration Tests:** Spin up lightweight ephemeral databases (Testcontainers or local Docker Compose) to test the interactions between the Ingestion Service, PostgreSQL, and S3 (mocked via LocalStack).
*   **Acoustic Pipeline Mocks:** Specific dummy `.wav` files with known mathematical properties are fed through the extraction pipeline to verify that F0/RMS algorithms yield deterministic, expected arrays.

### 4.3 Artifact Building
*   If all tests pass, Docker images are built and tagged with the git commit SHA.

## 5. Continuous Deployment (CD) Pipeline
The CD pipeline is governed by ArgoCD, implementing a strict GitOps methodology.

### 5.1 GitOps Workflow
1.  **Image Push:** The CI pipeline pushes the successfully built Docker image to Amazon Elastic Container Registry (ECR).
2.  **Manifest Update:** The CI pipeline updates the Kubernetes manifest (Helm chart values file) in a separate `speech-arena-k8s-config` repository with the new image tag.
3.  **ArgoCD Synchronization:** ArgoCD, running inside the EKS cluster, constantly monitors the `speech-arena-k8s-config` repository.
4.  **Deployment:** Upon detecting a change, ArgoCD automatically applies the new manifests to the cluster, updating the deployments.

### 5.2 Deployment Strategies
*   **Rolling Updates:** The default strategy. Kubernetes slowly replaces old pods with new ones, ensuring zero downtime.
*   **Blue/Green Deployments:** Used for major architectural changes. A complete new "Green" environment is spun up alongside the "Blue" environment. Traffic is shifted at the API Gateway/Ingress level once Green is verified.
*   **Canary Deployments:** Used for testing new scoring algorithms. 5% of user traffic is routed to the new Scoring Service pods to monitor error rates and latency before a full rollout.

## 6. Observability and Monitoring
Comprehensive observability is required to debug the complex, asynchronous acoustic pipelines.

### 6.1 Centralized Logging (ELK Stack / Datadog)
*   All containers output logs to `stdout`/`stderr`.
*   Fluent Bit runs as a DaemonSet on EKS, collecting logs, enriching them with Kubernetes metadata (pod name, namespace), and forwarding them to a centralized logging platform (e.g., Datadog or OpenSearch).
*   **Structured Logging:** All logs are formatted as JSON, containing a `trace_id` to correlate logs across multiple microservices for a single user request.

### 6.2 Metrics and APM (Application Performance Monitoring)
*   **Prometheus & Grafana:** Prometheus scrapes metrics from the Kubernetes cluster (CPU, memory, network I/O) and custom application metrics exposed via `/metrics` endpoints. Grafana visualizes these metrics.
*   **Key Custom Metrics Tracked:**
    *   `audio_ingestion_duration_seconds`: Histogram of time taken to validate and normalize audio.
    *   `alignment_confidence_score`: Average confidence of the Wav2Vec2 alignment.
    *   `feature_extraction_queue_depth`: Number of files waiting for MFCC extraction.
    *   `scoring_latency_ms`: Time taken by the rule engine to calculate the final score.

### 6.3 Distributed Tracing
*   **OpenTelemetry:** Implemented across all services. When a user initiates a battle, a trace is created. Spans track the lifecycle of the request through the API Gateway, Ingestion Service, SQS, Alignment Service, etc., identifying bottlenecks in the asynchronous flow.

### 6.4 Alerting
*   Alertmanager (or Datadog Monitors) triggers alerts to PagerDuty/Slack based on predefined thresholds:
    *   **High Severity (Page):** API Gateway 5xx error rate > 1%.
    *   **High Severity (Page):** SQS Feature Extraction Dead Letter Queue (DLQ) is not empty (files are failing to process).
    *   **Warning (Slack):** RDS CPU Utilization > 80% for 15 minutes.
    *   **Warning (Slack):** Wav2Vec2 GPU memory utilization > 95%.

## 7. Security and Compliance
*   **Secret Management:** AWS Secrets Manager or HashiCorp Vault is used. Passwords, API keys, and database credentials are never stored in code or environment variables directly. Kubernetes External Secrets injects them securely into pods at runtime.
*   **Vulnerability Scanning:** ECR Image Scanning runs daily to detect CVEs in base images and dependencies.
*   **IAM Roles for Service Accounts (IRSA):** Pods are granted granular AWS permissions. The Ingestion Service pod only has `s3:PutObject` access to the inbox bucket, nothing else.

## 8. Data Engineering Pipelines (Airflow)
While real-time battles run on the EKS microservices, heavy batch processing (e.g., ingesting a new 100-hour reference dataset) is orchestrated by Apache Airflow.
*   **Airflow DAGs (Directed Acyclic Graphs):** Define the sequence of tasks: Download dataset -> Split into chunks -> Spin up spot instances -> Run alignment -> Extract Parquet -> Load metadata to PostgreSQL.
*   **Idempotency:** All Airflow tasks are idempotent. If a task fails midway (e.g., a spot instance is reclaimed), it can be re-run safely without corrupting the data lake.
