import { useState } from 'react';
import SandboxMode from './modes/SandboxMode';
import InterviewerMode from './modes/InterviewerMode';
import NewsAnchorMode from './modes/NewsAnchorMode';
import StorytellingMode from './modes/StorytellingMode';
import SandboxResult from './SandboxResult';

export default function Sandbox() {
  const [selectedMode, setSelectedMode] = useState<string>('sandbox');
  const [result, setResult] = useState<any>(null);

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

      {selectedMode === 'sandbox' && <SandboxMode onResult={setResult} />}
      {selectedMode === 'interviewer' && <InterviewerMode onResult={setResult} />}
      {selectedMode === 'news_anchor' && <NewsAnchorMode onResult={setResult} />}
      {selectedMode === 'storytelling' && <StorytellingMode onResult={setResult} />}
    </div>
  );
}
