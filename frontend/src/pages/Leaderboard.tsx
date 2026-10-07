import { useState, useEffect } from 'react';
import { Trophy, Lock, User } from 'lucide-react';

export default function Leaderboard() {
  const [leaderboardData, setLeaderboardData] = useState<any>(null);

  useEffect(() => {
    setTimeout(() => {
      setLeaderboardData({
        prompt_id: "T1_Gettysburg",
        version: "v1.0.0",
        rankings: [
          { rank: 1, user_id: "AlexTheOrator", score: 98, mode: "news_anchor" },
          { rank: 2, user_id: "SpeechKing", score: 96, mode: "sandbox" },
          { rank: 3, user_id: "You", score: 92, mode: "sandbox" },
          { rank: 4, user_id: "StoryTeller99", score: 90, mode: "storytelling" }
        ]
      });
    }, 800);
  }, []);

  if (!leaderboardData) {
    return (
      <div className="premium-card" style={{ textAlign: 'center', padding: '60px' }}>
        <Trophy size={48} color="var(--text-main)" className="pulse-anim" />
        <h2 style={{ marginTop: '24px' }}>Fetching Global Rankings...</h2>
      </div>
    );
  }

  return (
    <div className="premium-card" style={{ padding: '0', overflow: 'hidden' }}>
      <div style={{ padding: '24px', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
            <Trophy color="var(--text-main)" /> Global Leaderboard
          </h2>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Rankings for Prompt: <strong>{leaderboardData.prompt_id}</strong></p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '24px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border)' }}>
          <Lock size={16} color="var(--text-main)" />
          <span style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>Version Locked: {leaderboardData.version}</span>
        </div>
      </div>
      <div style={{ padding: '24px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px', textAlign: 'center' }}>Rank</th>
              <th style={{ padding: '12px' }}>Speaker</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {leaderboardData.rankings.map((row: any, idx: number) => (
              <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '16px', textAlign: 'center', fontWeight: 'bold' }}>#{row.rank}</td>
                <td style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {row.user_id === 'You' && <User size={16} color="var(--accent)" />}
                  {row.user_id}
                </td>
                <td style={{ padding: '16px', textAlign: 'center', color: 'var(--success)', fontWeight: 'bold' }}>{row.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
