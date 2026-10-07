import { useState, useEffect } from 'react';
import { Upload, Activity, AlertCircle } from 'lucide-react';
import SandboxResult from './SandboxResult';

export default function Sandbox() {
  const [file, setFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState('');
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
      <div className="w-full max-w-2xl mx-auto flex flex-col items-center justify-center py-32 space-y-6">
        <Activity size={48} className="text-primary animate-pulse" />
        <h2 className="text-2xl font-headline font-bold text-primary tracking-tight">Analyzing Speech...</h2>
        <p className="text-secondary text-sm">Processing waveform telemetry and temporal alignment.</p>
        <div className="h-1 w-48 bg-surface-container-high rounded-full overflow-hidden mt-4">
          <div className="h-full bg-primary w-full animate-[pulse_1s_ease-in-out_infinite]" style={{ transformOrigin: 'left' }}></div>
        </div>
      </div>
    );
  }

  if (result) {
    return <SandboxResult result={result} onReset={() => setResult(null)} />;
  }

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col space-y-8 bg-surface-container-lowest border border-outline-variant rounded-xl p-8 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/40 pb-6">
        <div>
          <h2 className="text-xl font-headline font-bold text-primary tracking-tight">Prepare Analysis</h2>
          <p className="text-xs text-secondary mt-1">Configure acoustic parameters and upload source.</p>
        </div>
        <select 
          value={selectedMode} 
          onChange={(e) => setSelectedMode(e.target.value)} 
          className="bg-surface-container-low border border-outline-variant text-on-surface text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5"
        >
          <option value="sandbox">Standard (Sandbox)</option>
          <option value="interviewer">The Interviewer</option>
          <option value="news_anchor">News Anchor</option>
          <option value="storytelling">Storytelling</option>
        </select>
      </div>
      
      <div className="bg-surface-container-low border-l-2 border-primary p-4 rounded-r-lg">
        <p className="text-xs text-on-surface-variant leading-relaxed">
          <strong className="text-primary font-semibold mr-2">Mode Info:</strong> 
          {modeDescriptions[selectedMode]}
        </p>
      </div>

      {error && (
        <div className="flex items-center space-x-2 bg-error-container text-on-error-container p-4 rounded-lg text-sm border border-error/20">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-[10px] font-mono font-medium tracking-widest uppercase text-secondary">
          Reference Transcript
        </label>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Enter reference or speech transcript for alignment..."
          rows={4}
          className="w-full bg-surface-container-low border border-outline-variant text-on-surface text-sm rounded-lg focus:ring-primary focus:border-primary block p-4 placeholder-secondary/50 font-body transition-colors"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-mono font-medium tracking-widest uppercase text-secondary">
          Vocal Recording
        </label>
        <div className="w-full border-2 border-dashed border-outline-variant hover:border-outline rounded-xl p-10 text-center bg-surface-container-low/50 hover:bg-surface-container-low transition-colors cursor-pointer relative">
          <input 
            type="file" 
            onChange={(e) => setFile(e.target.files?.[0] || null)} 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            accept="audio/*"
          />
          <Upload size={32} className="mx-auto text-secondary mb-3" />
          <p className="text-sm font-medium text-primary mb-1">
            {file ? file.name : "Click or drag audio file here"}
          </p>
          <p className="text-xs text-secondary">WAV, MP3, or FLAC up to 50MB</p>
        </div>
      </div>

      <div className="pt-4 border-t border-outline-variant/40 flex justify-end">
        <button 
          className="text-sm font-medium px-6 py-2.5 rounded-lg bg-primary text-on-primary hover:bg-neutral-800 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center space-x-2"
          onClick={handleAnalyze} 
          disabled={!file}
        >
          <span>Start Telemetry Analysis</span>
          <Activity size={16} />
        </button>
      </div>
    </div>
  );
}
