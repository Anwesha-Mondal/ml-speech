import { useState } from 'react';
import { PartyPopper, Mic2 } from 'lucide-react';

export default function MimicParty() {
  const [mimicData, setMimicData] = useState<any>(null);
  const [mimicking, setMimicking] = useState(false);

  const handleMimic = () => {
    setMimicking(true);
    setTimeout(() => {
      setMimicData({
        score: 94,
        metrics: { melody_match: 96, cadence_sync: 91, emphasis_timing: 95 },
        highlights: ["Perfect pause timing on the dramatic turn!"],
        feedback: "Outstanding! You sounded just like the melody of the original performance."
      });
      setMimicking(false);
    }, 2500);
  };

  if (mimicking) {
    return (
      <div className="premium-card" style={{ textAlign: 'center', padding: '80px' }}>
        <PartyPopper size={64} color="var(--text-main)" className="pulse-anim" />
        <h2 style={{ marginTop: '32px' }}>Analyzing Melody & Cadence...</h2>
      </div>
    );
  }

  if (mimicData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="premium-card" style={{ textAlign: 'center' }}>
          <h2>{mimicData.score}% Structural Similarity</h2>
          <p style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>"{mimicData.feedback}"</p>
          <button className="btn" onClick={() => setMimicData(null)}>Play Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="premium-card" style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
      <PartyPopper size={64} color="var(--text-main)" style={{ marginBottom: '16px' }} />
      <h2 style={{ fontWeight: 600 }}>Mimic Party</h2>
      <select style={{ width: '100%', padding: '12px', margin: '16px 0', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border)' }}>
        <option>JFK "We choose to go to the Moon"</option>
      </select>
      <div style={{ border: '1px dashed var(--border)', padding: '40px', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)' }}>
        <Mic2 size={48} color="var(--text-muted)" />
        <p>Upload your best impression</p>
      </div>
      <button className="btn" onClick={handleMimic} style={{ width: '100%', padding: '16px', marginTop: '16px' }}>Let's Party!</button>
    </div>
  );
}
