import { useState } from 'react';
import { Swords, User, Award } from 'lucide-react';

export default function Battle() {
  const [battleData, setBattleData] = useState<any>(null);
  const [battling, setBattling] = useState(false);

  const handleBattle = () => {
    setBattling(true);
    setTimeout(() => {
      setBattleData({
        battle_id: "b_1234",
        prompt_id: "T1_Gettysburg",
        winner: "User (You)",
        players: [
          { user_id: "User (You)", score: 88, metrics: { pacing_accuracy: 92, pitch_stability: 85 } },
          { user_id: "Opponent", score: 82, metrics: { pacing_accuracy: 78, pitch_stability: 88 } }
        ],
        insights: ["You maintained closer pacing to the reference (+14%)."]
      });
      setBattling(false);
    }, 2000);
  };

  if (battling) {
    return (
      <div className="premium-card" style={{ textAlign: 'center', padding: '80px' }}>
        <Swords size={64} color="var(--text-main)" className="pulse-anim" />
        <h2 style={{ marginTop: '32px' }}>Calculating Battle Results...</h2>
      </div>
    );
  }

  if (battleData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="premium-card" style={{ textAlign: 'center', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <Award size={64} color="var(--success)" />
          <h2>Winner: {battleData.winner}</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {battleData.players.map((player: any, idx: number) => (
            <div key={idx} className="premium-card">
              <h3 style={{ fontWeight: 600 }}>{player.user_id}</h3>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{player.score}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="premium-card" style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
      <Swords size={64} color="var(--text-main)" style={{ marginBottom: '16px' }} />
      <h2 style={{ fontWeight: 600 }}>1v1 Async Battle</h2>
      <button className="btn" onClick={handleBattle} style={{ width: '100%', padding: '16px', marginTop: '16px' }}>Start Battle</button>
    </div>
  );
}
