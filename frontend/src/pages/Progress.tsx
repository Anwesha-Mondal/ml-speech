import { useState, useEffect } from 'react';
import { History, CheckCircle2 } from 'lucide-react';

export default function Progress() {
  const [historyData, setHistoryData] = useState<any>(null);

  useEffect(() => {
    setTimeout(() => {
      setHistoryData({
        user_id: "user_1",
        prompt_id: "T1_Gettysburg",
        history: [
          { attempt: 1, date: "2026-09-01", score: 65, flaw_density: 4.2 },
          { attempt: 2, date: "2026-09-15", score: 75, flaw_density: 2.8 },
          { attempt: 3, date: "2026-10-06", score: 85, flaw_density: 1.5 }
        ],
        insights: [
          "Your flaw density has decreased by 64% since your first attempt.",
          "You are speaking at a more consistent pace."
        ]
      });
    }, 800);
  }, []);

  if (!historyData) {
    return (
      <div className="premium-card" style={{ textAlign: 'center', padding: '60px' }}>
        <History size={48} color="var(--text-main)" className="pulse-anim" />
        <h2 style={{ marginTop: '24px' }}>Loading History...</h2>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
        <div className="premium-card">
          <h3 style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Current Score</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--success)' }}>
            {historyData.history[historyData.history.length - 1].score}
          </div>
        </div>
        <div className="premium-card">
          <h3 style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Flaw Density</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
            {historyData.history[historyData.history.length - 1].flaw_density}
          </div>
        </div>
        <div className="premium-card">
          <h3 style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Total Attempts</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
            {historyData.history.length}
          </div>
        </div>
      </div>
      <div className="premium-card">
        <h3 style={{ fontWeight: 600 }}>AI Insights</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
          {historyData.insights.map((insight: string, i: number) => (
            <div key={i} style={{ display: 'flex', gap: '12px', padding: '16px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }}>
              <CheckCircle2 size={20} color="var(--success)" />
              <span>{insight}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
