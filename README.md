# Speech Arena

A framework for temporal grounding, explainability, and evaluation of speech flaws without LLMs in the critical path.

## Quickstart

Start the entire stack (API, Dashboard, and Workers) using Docker Compose:

```bash
docker-compose up -d
```

Navigate to `http://localhost:3000` to access the Dashboard.

## Documentation

- [Technical Report (6-page)](docs/TECHNICAL_REPORT.md)
- [System Card](docs/SYSTEM_CARD.md)
- [Dataset Card](datasets/DATASET_CARD_v1.md)
- [Demo Script](docs/DEMO_SCRIPT.md)

## Replicating Benchmarks

To replicate the M1 evaluation and stress tests:

```bash
docker-compose run benchmark
```
The results will be written to `benchmarks/reports/benchmark_report.json`.
