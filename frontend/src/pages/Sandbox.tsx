import { useState, useEffect } from 'react';
import { Upload, Activity, AlertCircle } from 'lucide-react';

export default function Sandbox() {
  const [file, setFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState('Default transcript goes here');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<string>('sandbox');
  const [jobId, setJobId] = useState<string | null>(null);

  const modeDescriptions: Record<string, string> = {
    sandbox: "Standard test against a reference with general acoustic feedback.",
    interviewer: "Dynamic response mode. Evaluates against a professional baseline focusing on hesitation and clarity.",
    news_anchor: "Teleprompter reading mode. Strict emphasis on steady pacing, articulation, and authoritative pitch.",
    storytelling: "Long-form narrative delivery. Evaluates dynamic range and dramatic pausing."
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('participant', file);
    formData.append('transcript', transcript);
    formData.append('mode', selectedMode);

    try {
      const res = await fetch('http://localhost:8000/api/analyze', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to start analysis');
      const data = await res.json();
      setJobId(data.job_id);
    } catch (err: any) {
      setError(err.message);
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    let interval: any;
    if (jobId && analyzing) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`http://localhost:8000/api/jobs/${jobId}`);
          if (!res.ok) return;
          const data = await res.json();
          if (data.status === 'completed') {
            setResult(data.result);
            setAnalyzing(false);
            setJobId(null);
            clearInterval(interval);
          } else if (data.status === 'error') {
            setError(data.message || 'Analysis failed');
            setAnalyzing(false);
            setJobId(null);
            clearInterval(interval);
          }
        } catch (err) {
          console.error('Polling error', err);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [jobId, analyzing]);

  if (analyzing) {
    return (
      <div className="premium-card" style={{ textAlign: 'center', padding: '60px' }}>
        <Activity size={48} color="var(--text-main)" className="pulse-anim" />
        <h2 style={{ marginTop: '24px' }}>Analyzing Speech...</h2>
        <p style={{ color: 'var(--text-muted)' }}>This may take a few moments.</p>
      </div>
    );
  }

  if (result) {
    return (
      <div className="premium-card">
        <h2 style={{ fontWeight: 600 }}>Analysis Complete</h2>
        <div style={{ display: 'flex', gap: '40px', marginTop: '24px', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '4.5rem', fontWeight: 'bold', color: 'var(--success)', lineHeight: 1 }}>{result.score.total}</div>
            <div style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Overall Score</div>
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 16px 0' }}>Flaws Detected:</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {result.flaws.map((f: any, i: number) => (
                <li key={i} style={{ padding: '16px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 'bold', color: 'var(--danger)', marginBottom: '8px' }}>{f.type} (-{f.penalty} pts)</div>
                  <div style={{ fontSize: '0.9rem' }}>{f.explanation}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>At {f.start_time}s - {f.end_time}s</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <button className="btn" onClick={() => setResult(null)} style={{ marginTop: '24px' }}>Analyze Another</button>
      </div>
    );
  }

  return (
    <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontWeight: 600 }}>Prepare Analysis</h2>
        <select value={selectedMode} onChange={(e) => setSelectedMode(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-main)' }}>
          <option value="sandbox">Standard (Sandbox)</option>
          <option value="interviewer">The Interviewer</option>
          <option value="news_anchor">News Anchor</option>
          <option value="storytelling">Storytelling</option>
        </select>
      </div>
      <div style={{ padding: '12px', borderLeft: '4px solid var(--text-main)', backgroundColor: 'var(--bg-secondary)' }}>
        <strong>Mode Info:</strong> {modeDescriptions[selectedMode]}
      </div>
      {error && (
        <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '4px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Transcript
        </label>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Enter reference or speech transcript..."
          rows={3}
          style={{
            padding: '12px',
            borderRadius: '4px',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--bg-main)',
            color: 'var(--text-main)',
            fontSize: '0.9rem',
            resize: 'vertical',
            fontFamily: 'inherit'
          }}
        />
      </div>
      <div style={{ border: '1px dashed var(--border)', borderRadius: '8px', padding: '40px', textAlign: 'center', backgroundColor: 'var(--bg-panel)' }}>
        <Upload size={48} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
        <p>Drag & drop your audio file</p>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ marginTop: '12px' }} />
      </div>
      <button className="btn" onClick={handleAnalyze} disabled={!file} style={{ padding: '14px' }}>Start Analysis</button>
    </div>
  );
}
