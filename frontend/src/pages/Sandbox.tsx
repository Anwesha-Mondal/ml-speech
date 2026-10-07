import { useState } from 'react';
import { Upload, Activity, ListFilter } from 'lucide-react';

export default function Sandbox() {
  const [file, setFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [selectedMode, setSelectedMode] = useState<string>('sandbox');

  const modeDescriptions: Record<string, string> = {
    sandbox: "Standard test against a reference with general acoustic feedback.",
    interviewer: "Dynamic response mode. Evaluates against a professional baseline focusing on hesitation and clarity.",
    news_anchor: "Teleprompter reading mode. Strict emphasis on steady pacing, articulation, and authoritative pitch.",
    storytelling: "Long-form narrative delivery. Evaluates dynamic range and dramatic pausing."
  };

  const handleAnalyze = () => {
    setAnalyzing(true);
    setTimeout(() => {
      setResult({
        mode: selectedMode,
        score: { total: 85, buckets: { pacing: 10, energy: 5 } },
        flaws: [
          { type: 'pacing_fast', start: 2.5, end: 3.1, penalty: 10, explain: 'You spoke 30% faster than the reference here.' }
        ]
      });
      setAnalyzing(false);
    }, 2000);
  };

  if (analyzing) {
    return (
      <div className="premium-card" style={{ textAlign: 'center', padding: '60px' }}>
        <Activity size={48} color="var(--text-main)" className="pulse-anim" />
        <h2 style={{ marginTop: '24px' }}>Analyzing Speech...</h2>
      </div>
    );
  }

  if (result) {
    return (
      <div className="premium-card">
        <h2>Analysis Complete</h2>
        <div style={{ fontSize: '4.5rem', fontWeight: 'bold', color: 'var(--success)' }}>{result.score.total}</div>
        <button className="btn" onClick={() => setResult(null)}>Analyze Another</button>
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
      <div style={{ border: '1px dashed var(--border)', borderRadius: '8px', padding: '40px', textAlign: 'center', backgroundColor: 'var(--bg-panel)' }}>
        <Upload size={48} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
        <p>Drag & drop your audio file</p>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ marginTop: '12px' }} />
      </div>
      <button className="btn" onClick={handleAnalyze} disabled={!file} style={{ padding: '14px' }}>Start Analysis</button>
    </div>
  );
}
