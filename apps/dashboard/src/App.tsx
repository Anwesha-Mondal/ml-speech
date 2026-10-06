import { useState, useRef } from 'react'
import { Upload, Play, Pause, Activity, AlertTriangle, Zap, CheckCircle2 } from 'lucide-react'
import './index.css'

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [transcript, setTranscript] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleAnalyze = () => {
    setAnalyzing(true)
    setTimeout(() => {
      setResult({
        score: { total: 85, buckets: { pacing: 10, energy: 5 } },
        flaws: [
          { type: 'pacing_fast', start: 2.5, end: 3.1, penalty: 10, explain: 'You spoke 30% faster than the reference here.' },
          { type: 'energy_low', start: 5.0, end: 6.2, penalty: 5, explain: 'Your energy dropped significantly here.' }
        ]
      })
      setAnalyzing(false)
    }, 2000)
  }

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '40px', borderBottom: '1px solid #334155', paddingBottom: '20px' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '2rem', margin: 0 }}>
          <Activity size={32} color="var(--accent)" />
          Speech Arena <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>Dashboard</span>
        </h1>
      </header>

      {!result && !analyzing && (
        <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px', margin: '0 auto' }}>
          <h2>Upload Speech</h2>
          
          <div style={{ border: '2px dashed #334155', borderRadius: '8px', padding: '40px', textAlign: 'center' }}>
            <Upload size={48} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
            <p>Drag & drop your audio file or click to browse</p>
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ marginTop: '12px' }} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px' }}>Transcript (Optional)</label>
            <textarea 
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste your canonical transcript here..."
              style={{ width: '100%', height: '120px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '12px', color: '#fff' }}
            />
          </div>

          <button className="btn" onClick={handleAnalyze} disabled={!file} style={{ width: '100%', padding: '14px', fontSize: '1.1rem' }}>
            Start Analysis
          </button>
        </div>
      )}

      {analyzing && (
        <div className="premium-card" style={{ textAlign: 'center', padding: '60px' }}>
          <Activity size={48} color="var(--accent)" className="pulse-anim" />
          <h2 style={{ marginTop: '24px' }}>Analyzing Speech...</h2>
          <p style={{ color: 'var(--text-muted)' }}>Aligning audio, extracting features, and comparing against reference.</p>
        </div>
      )}

      {result && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px' }}>
          {/* Main Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="premium-card">
              <h3>Waveforms & Overlays</h3>
              <div style={{ height: '200px', backgroundColor: '#0f172a', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', border: '1px solid #334155' }}>
                <p>[Wavesurfer.js Dual Waveform Component]</p>
              </div>
              <div style={{ height: '150px', backgroundColor: '#0f172a', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', border: '1px solid #334155', marginTop: '16px' }}>
                <p>[uPlot F0 / Energy Component]</p>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button className="btn" style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#334155' }}>
                  <Play size={18} /> Play Segment
                </button>
              </div>
            </div>

            <div className="premium-card">
              <h3>Detected Flaws</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                {result.flaws.map((f: any, i: number) => (
                  <div key={i} style={{ padding: '16px', backgroundColor: '#0f172a', borderRadius: '8px', borderLeft: '4px solid var(--danger)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <strong style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
                          <AlertTriangle size={18} /> {f.type}
                        </strong>
                        <p style={{ margin: '8px 0 0 0' }}>{f.explain}</p>
                      </div>
                      <span style={{ backgroundColor: '#1e293b', padding: '4px 12px', borderRadius: '16px', fontSize: '0.85rem' }}>
                        {f.start}s - {f.end}s
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="premium-card" style={{ textAlign: 'center' }}>
              <h2 style={{ margin: 0, color: 'var(--text-muted)', fontSize: '1.2rem' }}>Total Score</h2>
              <div style={{ fontSize: '4.5rem', fontWeight: 'bold', color: 'var(--success)', margin: '16px 0', lineHeight: 1 }}>
                {result.score.total}
              </div>
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>out of 100</p>
            </div>

            <div className="premium-card">
              <h3>Penalty Breakdown</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                {Object.entries(result.score.buckets).map(([k, v]: [string, any]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
                    <span style={{ textTransform: 'capitalize' }}>{k}</span>
                    <span style={{ color: 'var(--danger)' }}>-{v} pts</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
