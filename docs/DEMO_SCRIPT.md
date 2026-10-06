# Speech Arena Demo Script (3-10 min)

**[0:00 - 0:30] Introduction**
- Show the problem: current AI speech coaches give vague feedback.
- Introduce Speech Arena: precise, temporal-grounded acoustic feedback.

**[0:30 - 2:00] The Engine (M1 Pipeline)**
- Run the CLI command: `sa analyze --ref ref.wav --part variant.wav --transcript t.txt`
- Show the deterministic JSON output and explain the exact timestamp matching.

**[2:00 - 4:00] The Dashboard**
- Open `localhost:3000`.
- Upload a file and show the analysis loading screen.
- Reveal the dual-waveform UI, the uPlot F0/Energy overlays.
- Click on a flaw in the timeline to seek the audio directly to the problem.

**[4:00 - 5:00] Benchmarks & Conclusion**
- Run `docker-compose run benchmark`.
- Show the generated JSON report proving F1 > 0.90 under stress.
- Conclude: Open, reproducible, and ready for Track C.
