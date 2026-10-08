import { useState, useEffect } from 'react';
import { Activity, AlertCircle } from 'lucide-react';
import ChatInput from './ChatInput';

export default function InterviewerMode({ onResult }: { onResult: (res: any) => void }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const handleAnalyze = async (transcript: string, file: File) => {
    setAnalyzing(true);
    setError(null);

    const formData = new FormData();
    formData.append('participant', file);
    formData.append('transcript', transcript);
    formData.append('mode', 'interviewer');

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
            onResult(data.result);
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
        <h2 className="text-2xl font-headline font-bold text-primary tracking-tight">Analyzing Interview...</h2>
        <p className="text-secondary text-sm">Evaluating hesitation and professional clarity.</p>
        <div className="h-1 w-48 bg-surface-container-high rounded-full overflow-hidden mt-4">
          <div className="h-full bg-primary w-full animate-[pulse_1s_ease-in-out_infinite]" style={{ transformOrigin: 'left' }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col space-y-6">
      <div className="bg-surface-container-low border-l-2 border-primary p-4 rounded-r-lg">
        <p className="text-xs text-on-surface-variant leading-relaxed">
          <strong className="text-primary font-semibold mr-2">Mode Info:</strong> 
          Dynamic response mode. Evaluates against a professional baseline focusing on hesitation and clarity.
        </p>
      </div>

      {error && (
        <div className="flex items-center space-x-2 bg-error-container text-on-error-container p-4 rounded-lg text-sm border border-error/20">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="pt-2">
        <ChatInput 
          onAnalyze={handleAnalyze} 
          disabled={analyzing} 
          placeholder="Enter interview answer text... (Leave blank to auto-transcribe)" 
        />
      </div>
    </div>
  );
}
