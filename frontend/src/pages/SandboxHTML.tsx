
{/* SESSION HEADER & META BAR */}
<section className="flex flex-col lg:flex-row lg:items-center justify-between pb-6 border-b border-outline-variant/50 gap-4">
<div>
<div className="flex items-center space-x-3 mb-2">
<span className="inline-flex items-center space-x-1.5 text-xs font-mono font-medium px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant border border-outline-variant/60">
<span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
<span>VERIFIED SESSION #SA-8492</span>
</span>
<span className="text-xs text-secondary font-mono tracking-tight">ANALYZED 14 MIN AGO</span>
</div>
<div className="flex items-center flex-wrap gap-x-4 gap-y-1">
<h1 className="font-headline text-2xl md:text-3xl font-bold tracking-tight text-primary">
            Keynote: The Architecture of Persuasion
          </h1>
<div className="flex items-center space-x-2 text-xs text-on-surface-variant bg-surface-container-low px-2.5 py-1 rounded-lg border border-outline-variant/40">
<span className="font-medium text-on-surface">Dr. Elena Vance</span>
<span className="text-outline-variant">•</span>
<span className="font-mono">Dept. of Rhetoric &amp; Systems</span>
</div>
</div>
</div>
{/* Quick Session Telemetry & Actions */}
<div className="flex items-center flex-wrap gap-3">
<div className="flex items-center divide-x divide-outline-variant/50 bg-surface-container-lowest border border-outline-variant rounded-lg py-1.5 px-3 shadow-xs">
<div className="pr-3 text-left">
<div className="text-[10px] uppercase font-mono tracking-wider text-secondary">Total Duration</div>
<div className="font-mono text-sm font-semibold text-primary">08:42</div>
</div>
<div className="px-3 text-left">
<div className="text-[10px] uppercase font-mono tracking-wider text-secondary">Acoustic Score</div>
<div className="font-mono text-sm font-semibold text-primary flex items-center gap-1">
<span>82</span>
<span className="text-xs text-secondary font-normal">/ 100</span>
</div>
</div>
<div className="pl-3 text-left">
<div className="text-[10px] uppercase font-mono tracking-wider text-secondary">Rating Tier</div>
<div className="text-xs font-semibold text-emerald-800">STAGE READY</div>
</div>
</div>
<button className="text-xs font-medium px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-high transition-colors flex items-center space-x-1.5 text-on-surface">
<span className="material-symbols-outlined text-base" data-icon="compare_arrows">compare_arrows</span>
<span>Compare with Target</span>
</button>
</div>
</section>
{/* WORKSTATION DECK: AUDIO PLAYER & SPECTROGRAM WAVEFORM */}
<section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-all">
<div className="flex flex-col md:flex-row md:items-center justify-between pb-4 mb-4 border-b border-outline-variant/40 gap-3">
<div className="flex items-center space-x-3">
<div className="w-2.5 h-2.5 bg-primary rounded-xs"></div>
<h2 className="text-xs font-headline font-semibold tracking-wider uppercase text-on-surface">Waveform Telemetry &amp; Pitch Alignment</h2>
<span className="text-xs font-mono text-secondary">TRACK 01 [MASTER VOCAL]</span>
</div>
{/* Overlays & Cadence Pill */}
<div className="flex items-center flex-wrap gap-2 text-xs">
<div className="flex items-center space-x-1.5 bg-surface-container-low px-2.5 py-1 rounded-full border border-outline-variant/50">
<span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
<span className="font-mono font-medium text-on-surface">142 WPM</span>
<span className="text-secondary text-[11px]">(Optimal Zone 135–150)</span>
</div>
<div className="h-4 w-px bg-outline-variant/60 hidden sm:block"></div>
<button className="px-2.5 py-1 rounded text-xs font-mono border border-outline-variant hover:bg-surface-container-high transition-colors text-on-surface-variant flex items-center space-x-1" id="toggle-pitch">
<span className="w-2 h-2 rounded-full border border-primary bg-primary inline-block"></span>
<span>Pitch Contour</span>
</button>
<button className="px-2.5 py-1 rounded text-xs font-mono border border-outline-variant hover:bg-surface-container-high transition-colors text-on-surface-variant flex items-center space-x-1">
<span className="w-2 h-2 rounded-full border border-outline inline-block"></span>
<span>Cadence Heatmap</span>
</button>
</div>
</div>
{/* Waveform Canvas & Time Cursor */}
<div className="relative py-2 select-none group cursor-pointer" id="waveform-container">
{/* Time Markers Ruler */}
<div className="flex justify-between text-[10px] font-mono text-secondary mb-2 border-b border-outline-variant/30 pb-1">
<span>00:00</span>
<span>01:30</span>
<span>03:00</span>
<span className="font-semibold text-primary">03:14 [NOW]</span>
<span>04:30</span>
<span>06:00</span>
<span>07:30</span>
<span>08:42</span>
</div>
{/* Waveform Visualization Bars */}
<div className="relative h-28 flex items-center justify-between gap-[2px] md:gap-[3px] overflow-hidden px-1 bg-surface-container-low/40 rounded-lg py-2 border border-outline-variant/20">
{/* Simulated dynamic audio amplitude bars (100 bars) */}
{/* Played section (00:00 to 03:14: ~37% mark) */}
<div className="wave-bar w-full bg-primary rounded-full h-[32%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[45%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[28%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[55%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[70%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[85%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[60%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[40%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[15%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[65%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[78%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[90%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[82%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[64%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[48%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[30%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[12%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[52%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[68%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[74%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[92%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[65%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[45%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[38%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[58%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[70%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[88%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[95%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[60%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[42%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[18%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[50%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[66%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[84%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[72%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[89%]"></div>
<div className="wave-bar w-full bg-primary rounded-full h-[98%]"></div>
{/* Scrubber Playhead at ~37% */}
<div className="absolute top-0 bottom-0 left-[37%] w-0.5 bg-primary z-20 flex flex-col items-center">
<div className="w-2.5 h-2.5 bg-primary rounded-full -mt-1 shadow-sm"></div>
<div className="h-full border-r border-dashed border-primary"></div>
</div>
{/* Unplayed section: subtly muted bars */}
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[54%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[40%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[62%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[77%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[68%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[35%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[15%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[48%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[72%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[88%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[94%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[65%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[44%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[58%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[76%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[90%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[85%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[40%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[20%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[55%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[70%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[82%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[91%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[74%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[60%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[38%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[18%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[46%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[64%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[80%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[72%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[54%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[36%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[14%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[45%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[68%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[85%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[78%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[59%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[41%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[25%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[52%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[74%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[86%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[65%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[42%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[20%]"></div>
<div className="wave-bar w-full bg-secondary-fixed rounded-full h-[10%]"></div>
</div>
{/* Annotation Cue Flag at scrubber */}
<div className="absolute left-[37%] -bottom-5 transform -translate-x-1/2 z-20">
<span className="text-[9px] font-mono px-1.5 py-0.5 bg-primary text-on-primary rounded font-semibold tracking-wider">
            TRANSITION PEAK
          </span>
</div>
</div>
{/* Transport Controls Deck */}
<div className="mt-8 flex flex-col md:flex-row md:items-center justify-between gap-4 pt-3 border-t border-outline-variant/30">
{/* Primary Audio Controls */}
<div className="flex items-center space-x-3">
<button className="p-2 text-on-surface-variant hover:text-primary transition-colors rounded-lg hover:bg-surface-container" title="Skip back 10s">
<span className="material-symbols-outlined" data-icon="replay_10">replay_10</span>
</button>
<button className="w-10 h-10 rounded-full bg-primary text-on-primary hover:bg-neutral-800 flex items-center justify-center transition-transform active:scale-95 shadow-sm">
<span className="material-symbols-outlined text-[22px] fill-icon" data-icon="pause">pause</span>
</button>
<button className="p-2 text-on-surface-variant hover:text-primary transition-colors rounded-lg hover:bg-surface-container" title="Skip forward 10s">
<span className="material-symbols-outlined" data-icon="forward_10">forward_10</span>
</button>
{/* Current Time Code */}
<div className="font-mono text-xs pl-2 text-primary font-medium tracking-tight">
<span>03:14.28</span>
<span className="text-secondary font-normal"> / 08:42.00</span>
</div>
</div>
{/* Secondary Controls: Speed, Volume, Scrub Snapping */}
<div className="flex items-center space-x-6 text-xs">
{/* Playback Speed */}
<div className="flex items-center space-x-1 border border-outline-variant rounded-md p-0.5 bg-surface-container-low font-mono">
<button className="px-2 py-0.5 rounded text-on-surface-variant hover:text-primary">0.8x</button>
<button className="px-2 py-0.5 rounded bg-surface-container-lowest font-semibold text-primary shadow-xs">1.0x</button>
<button className="px-2 py-0.5 rounded text-on-surface-variant hover:text-primary">1.25x</button>
<button className="px-2 py-0.5 rounded text-on-surface-variant hover:text-primary">1.5x</button>
</div>
{/* Volume Slider */}
<div className="flex items-center space-x-2 text-on-surface-variant">
<span className="material-symbols-outlined text-[18px]" data-icon="volume_up">volume_up</span>
<input className="w-20 md:w-28 h-1 bg-surface-container-high rounded-lg appearance-none cursor-pointer accent-primary" max="100" min="0" type="range" value="84"/>
<span className="font-mono text-[11px] text-secondary">84%</span>
</div>
{/* Loop & Loop Marker toggle */}
<button className="text-on-surface-variant hover:text-primary transition-colors p-1" title="Loop Section">
<span className="material-symbols-outlined text-[18px]" data-icon="repeat">repeat</span>
</button>
</div>
</div>
</section>
{/* WORKSPACE BENTO GRID: OVERVIEW & SYNCHRONIZED TRANSCRIPT */}
<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
{/* LEFT COLUMN: SCORE OVERVIEW & HORIZONTAL BAR METERS (7 COLS) */}
<div className="lg:col-span-7 space-y-6">
{/* PERFORMANCE HERO CARD */}
<div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
<div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-outline-variant/40">
<div>
<span className="text-[10px] font-mono font-medium tracking-widest uppercase text-secondary">SPEECH ARENA EVALUATION</span>
<div className="mt-2 flex items-baseline space-x-3">
<span className="font-headline text-6xl md:text-7xl font-extrabold tracking-tighter text-primary">82</span>
<div className="font-mono text-sm text-secondary">
<div>/ 100 PTS</div>
<div className="text-emerald-700 font-semibold text-xs mt-0.5 tracking-normal">PROFICIENT / STAGE READY</div>
</div>
</div>
</div>
{/* Benchmark indicators */}
<div className="sm:text-right space-y-2">
<div className="inline-flex items-center space-x-1.5 text-xs font-mono font-medium px-2.5 py-1 rounded bg-surface-container-low text-on-surface border border-outline-variant/50">
<span className="material-symbols-outlined text-emerald-600 text-sm" data-icon="trending_up">trending_up</span>
<span>+4 pts vs. Cohort Avg (78)</span>
</div>
<div className="text-xs text-secondary font-mono">
                Confidence Index: <span className="text-primary font-semibold">89.4%</span>
</div>
</div>
</div>
{/* Editorial Synthesized Takeaway */}
<div className="pt-5 flex items-start space-x-3">
<span className="material-symbols-outlined text-primary text-xl mt-0.5 flex-shrink-0" data-icon="auto_awesome">auto_awesome</span>
<div className="text-xs text-on-surface leading-relaxed">
<strong className="font-semibold text-primary">Key Editorial Insight:</strong>
              Exceptional narrative pacing with natural rhetorical acceleration during thesis climaxes. Brief pause hesitation detected during dense technical slide transitions at [03:14], with mild pitch flattening toward closing statements.
            </div>
</div>
</div>
{/* COMPREHENSIVE SCORE BREAKDOWN (HORIZONTAL METERS) */}
<div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-6">
<div className="flex items-center justify-between pb-3 border-b border-outline-variant/40">
<h3 className="text-xs font-headline font-semibold tracking-wider uppercase text-on-surface">Dimensional Breakdown</h3>
<span className="text-xs font-mono text-secondary">WEIGHTED ACOUSTIC INDEX</span>
</div>
{/* Metric 1: Pacing */}
<div className="space-y-2 group">
<div className="flex items-center justify-between text-xs">
<div className="flex items-center space-x-2">
<span className="font-semibold text-primary">Pacing &amp; Flow</span>
<span className="font-mono text-[10px] text-secondary">142 WPM AVG</span>
</div>
<div className="font-mono text-xs font-semibold text-primary">
                21 <span className="text-secondary font-normal">/ 25</span>
<span className="ml-1.5 text-[11px] text-secondary font-normal">(84%)</span>
</div>
</div>
{/* Hairline Progress Bar */}
<div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
<div className="h-full bg-primary rounded-full transition-all duration-500 ease-out" style={{width: "84%"}}></div>
</div>
<p className="text-[11px] text-on-surface-variant leading-normal">
              Cadence maintained at 142 WPM average with natural acceleration in the second act climax. Optimal narrative spacing.
            </p>
</div>
{/* Metric 2: Pitch Control */}
<div className="space-y-2 group">
<div className="flex items-center justify-between text-xs">
<div className="flex items-center space-x-2">
<span className="font-semibold text-primary">Pitch Control &amp; Modulation</span>
<span className="font-mono text-[10px] text-secondary">186 Hz MEDIAN</span>
</div>
<div className="font-mono text-xs font-semibold text-primary">
                19 <span className="text-secondary font-normal">/ 25</span>
<span className="ml-1.5 text-[11px] text-secondary font-normal">(76%)</span>
</div>
</div>
<div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
<div className="h-full bg-primary rounded-full transition-all duration-500 ease-out" style={{width: "76%"}}></div>
</div>
<p className="text-[11px] text-on-surface-variant leading-normal">
              Good dynamic modulation across core arguments; subtle vocal fry detected during subordinate clauses and conclusions.
            </p>
</div>
{/* Metric 3: Strategic Pauses */}
<div className="space-y-2 group">
<div className="flex items-center justify-between text-xs">
<div className="flex items-center space-x-2">
<span className="font-semibold text-primary">Strategic Pauses &amp; Silences</span>
<span className="font-mono text-[10px] text-secondary">1.8s AVG DELAY</span>
</div>
<div className="font-mono text-xs font-semibold text-primary">
                17 <span className="text-secondary font-normal">/ 20</span>
<span className="ml-1.5 text-[11px] text-secondary font-normal">(85%)</span>
</div>
</div>
<div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
<div className="h-full bg-primary rounded-full transition-all duration-500 ease-out" style={{width: "85%"}}></div>
</div>
<p className="text-[11px] text-on-surface-variant leading-normal">
              Strategic 1.8s breath pauses before thesis points created high audience gravity; 2 involuntary filler pauses flagged.
            </p>
</div>
{/* Metric 4: Energy & Clarity */}
<div className="space-y-2 group">
<div className="flex items-center justify-between text-xs">
<div className="flex items-center space-x-2">
<span className="font-semibold text-primary">Energy Projection &amp; Articulation</span>
<span className="font-mono text-[10px] text-secondary">-14.2 LUFS</span>
</div>
<div className="font-mono text-xs font-semibold text-primary">
                25 <span className="text-secondary font-normal">/ 30</span>
<span className="ml-1.5 text-[11px] text-secondary font-normal">(83%)</span>
</div>
</div>
<div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
<div className="h-full bg-primary rounded-full transition-all duration-500 ease-out" style={{width: "83.3%"}}></div>
</div>
<p className="text-[11px] text-on-surface-variant leading-normal">
              Dynamic projection score high; diction crisp across multi-syllabic terminology with exceptional consonant definition.
            </p>
</div>
{/* Acoustic Spectrum Telemetry Note */}
<div className="mt-4 pt-4 border-t border-outline-variant/30 flex items-center justify-between text-[11px] font-mono text-secondary">
<span>HARMONIC-TO-NOISE RATIO: 24.8 dB</span>
<span className="hover:text-primary cursor-pointer transition-colors underline decoration-dotted">View Raw Spectrogram</span>
</div>
</div>
</div>
{/* RIGHT COLUMN: SYNCHRONIZED TRANSCRIPT PANEL (5 COLS) */}
<div className="lg:col-span-5 space-y-4">
<div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col h-[740px]">
{/* Transcript Top Toolbar */}
<div className="p-4 border-b border-outline-variant/40 space-y-3">
<div className="flex items-center justify-between">
<div className="flex items-center space-x-2">
<span className="material-symbols-outlined text-primary text-lg" data-icon="subtitles">subtitles</span>
<h3 className="text-xs font-headline font-semibold uppercase tracking-wider text-primary">Synchronized Transcript</h3>
</div>
<span className="text-[10px] font-mono text-secondary">AUTO-SCROLL ON</span>
</div>
{/* Search & Filter Bar */}
<div className="flex items-center space-x-2">
<div className="relative flex-1">
<span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary text-sm" data-icon="search">search</span>
<input className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-container-low border border-outline-variant/70 rounded-lg focus:outline-none focus:border-primary transition-colors text-on-surface placeholder:text-secondary font-body" placeholder="Search utterance, filler or cue..." type="text"/>
</div>
<button className="px-2.5 py-1.5 text-xs font-mono border border-outline-variant rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant flex items-center space-x-1" title="Toggle Markers">
<span className="material-symbols-outlined text-sm" data-icon="filter_list">filter_list</span>
<span className="text-[11px]">Markers</span>
</button>
</div>
</div>
{/* Transcript Scroll Container */}
<div className="flex-1 overflow-y-auto p-4 space-y-6 text-xs leading-relaxed" id="transcript-feed">
{/* Utterance Block 1 (Past) */}
<div className="space-y-1.5 opacity-60 hover:opacity-100 transition-opacity">
<div className="flex items-center space-x-2 text-[10px] font-mono text-secondary">
<button className="hover:text-primary transition-colors underline decoration-dotted font-semibold">[02:40]</button>
<span>Dr. Elena Vance</span>
</div>
<p className="text-on-surface">
                To understand audience resonance, we cannot merely rely on syntactic correctness. Rhetorical resonance requires deliberate architectural framing.
              </p>
</div>
{/* Utterance Block 2 (Past with Inline Strategic Pause) */}
<div className="space-y-1.5 opacity-70 hover:opacity-100 transition-opacity">
<div className="flex items-center space-x-2 text-[10px] font-mono text-secondary">
<button className="hover:text-primary transition-colors underline decoration-dotted font-semibold">[02:58]</button>
<span>Dr. Elena Vance</span>
<span className="px-1.5 py-0.2 rounded bg-surface-container-high text-[9px] text-on-surface-variant">Intonation: Rising</span>
</div>
<p className="text-on-surface">
                Every compelling argument creates a deliberate structural tension. 
                <span className="inline-flex items-center px-1.5 py-0.5 mx-1 rounded bg-surface-container-high text-[10px] font-mono text-on-surface-variant border border-outline-variant/40">
<span className="w-1 h-1 rounded-full bg-secondary mr-1"></span>[Pause 1.8s — Strategic]
                </span>
                And without tension, resolution remains completely unearned.
              </p>
</div>
{/* Utterance Block 3 (ACTIVE PLAYBACK STATE at 03:14) */}
<div className="p-3.5 rounded-lg bg-surface-container-low border border-primary/20 space-y-2 relative">
<div className="flex items-center justify-between text-[10px] font-mono">
<div className="flex items-center space-x-2">
<span className="px-1.5 py-0.5 rounded bg-primary text-on-primary font-bold">[03:14]</span>
<span className="font-semibold text-primary">CURRENT PLAYHEAD</span>
</div>
<span className="text-secondary">PITCH: +14Hz PEAK</span>
</div>
{/* Word-by-word tracking with active word highlight */}
<p className="text-on-surface leading-loose text-sm">
<span>When</span>
<span>we</span>
<span>examine</span>
<span>the</span>
<span className="bg-primary text-on-primary font-medium px-1.5 py-0.5 rounded shadow-xs">fundamental tension</span>
<span>between</span>
<span>logic</span>
<span>and</span>
<span>emotional</span>
<span>evocation,</span>
<span className="inline-flex items-center px-1.5 py-0.5 mx-1 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-mono align-middle">
<span className="material-symbols-outlined text-[12px] mr-0.5" data-icon="warning">warning</span>[Filler: 'um' — Flagged]
                </span>
<span>we</span>
<span>observe</span>
<span>that</span>
<span>conviction</span>
<span>is</span>
<span>never</span>
<span>linear.</span>
</p>
<div className="flex items-center space-x-2 pt-1 text-[10px] font-mono text-secondary">
<span className="text-emerald-700 font-medium">Cadence: 144 WPM</span>
<span>•</span>
<span>Clarity: 96%</span>
</div>
</div>
{/* Utterance Block 4 (Upcoming) */}
<div className="space-y-1.5 opacity-60 hover:opacity-100 transition-opacity">
<div className="flex items-center space-x-2 text-[10px] font-mono text-secondary">
<button className="hover:text-primary transition-colors underline decoration-dotted font-semibold">[03:40]</button>
<span>Dr. Elena Vance</span>
</div>
<p className="text-on-surface">
                Notice the deliberate cadence shifts when introducing empirical data. The rhythm decelerates, forcing cognitive processing onto each distinct proposition.
                <span className="inline-flex items-center px-1.5 py-0.5 mx-1 rounded bg-surface-container-high text-[10px] font-mono text-on-surface-variant border border-outline-variant/40">
<span className="w-1 h-1 rounded-full bg-emerald-600 mr-1"></span>[Pitch Peak +14Hz]
                </span>
                This is where persuasion transitions from intuition into indelible memory.
              </p>
</div>
{/* Utterance Block 5 (Upcoming) */}
<div className="space-y-1.5 opacity-40 hover:opacity-100 transition-opacity">
<div className="flex items-center space-x-2 text-[10px] font-mono text-secondary">
<button className="hover:text-primary transition-colors underline decoration-dotted font-semibold">[04:12]</button>
<span>Dr. Elena Vance</span>
</div>
<p className="text-on-surface">
                Now, let us turn to the structural architecture of the counter-argument, and how strategic vulnerability disarms reflexive skepticism...
              </p>
</div>
</div>
{/* Bottom Transcript Action Bar */}
<div className="p-3 bg-surface-container-low border-t border-outline-variant/40 flex items-center justify-between text-xs">
<span className="text-secondary font-mono text-[11px]">842 words analyzed • 2 filler events flagged</span>
<button className="text-xs font-medium text-primary hover:underline flex items-center space-x-1">
<span>Export raw text (.vtt)</span>
<span className="material-symbols-outlined text-sm" data-icon="download">download</span>
</button>
</div>
</div>
</div>
</div>
