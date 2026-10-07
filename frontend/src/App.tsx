import { useState, useEffect } from 'react'
import { Zap, TrendingUp, Swords, PartyPopper, Trophy, Activity } from 'lucide-react'
import './index.css'

import Sandbox from './pages/Sandbox'
import Progress from './pages/Progress'
import Battle from './pages/Battle'
import MimicParty from './pages/MimicParty'
import Leaderboard from './pages/Leaderboard'

function App() {
  const [activeTab, setActiveTab] = useState<'sandbox' | 'progress' | 'battle' | 'mimic' | 'leaderboard'>('sandbox')

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '40px', borderBottom: '1px solid var(--border)', paddingBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '2rem', margin: 0, fontWeight: 600 }}>
          <Activity size={32} color="var(--text-main)" />
          Speech Arena <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>Dashboard</span>
        </h1>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className={`btn ${activeTab === 'sandbox' ? '' : 'secondary'}`} onClick={() => setActiveTab('sandbox')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={18} /> The Sandbox
          </button>
          <button className={`btn ${activeTab === 'progress' ? '' : 'secondary'}`} onClick={() => setActiveTab('progress')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={18} /> You vs You
          </button>
          <button className={`btn ${activeTab === 'battle' ? '' : 'secondary'}`} onClick={() => setActiveTab('battle')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Swords size={18} /> 1v1 Battle
          </button>
          <button className={`btn ${activeTab === 'mimic' ? '' : 'secondary'}`} onClick={() => setActiveTab('mimic')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PartyPopper size={18} /> Mimic Party
          </button>
          <button className={`btn ${activeTab === 'leaderboard' ? '' : 'secondary'}`} onClick={() => setActiveTab('leaderboard')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trophy size={18} /> Leaderboard
          </button>
        </div>
      </header>

      {activeTab === 'sandbox' && <Sandbox />}
      {activeTab === 'progress' && <Progress />}
      {activeTab === 'battle' && <Battle />}
      {activeTab === 'mimic' && <MimicParty />}
      {activeTab === 'leaderboard' && <Leaderboard />}
    </div>
  )
}

export default App
