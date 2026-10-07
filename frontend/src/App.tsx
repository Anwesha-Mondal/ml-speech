import { useState, useEffect } from 'react'
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

  const getTabClass = (tab: string) => {
    return activeTab === tab 
      ? 'text-primary font-semibold border-b border-primary pb-4' 
      : 'text-on-surface-variant hover:text-primary transition-colors duration-150 pb-4';
  }

  return (
    <>
      <header className="w-full top-0 z-50 h-14 bg-surface border-b border-outline-variant sticky flex items-center">
        <div className="w-full px-6 flex justify-between items-center h-full">
          {/* Brand & Global Tabs */}
          <div className="flex items-center space-x-8">
            <div className="font-headline text-base font-semibold tracking-tighter text-primary uppercase flex items-center space-x-2 cursor-pointer">
              <span className="w-2.5 h-2.5 bg-primary rounded-full inline-block mr-1"></span>
              <span>Speech Arena</span>
            </div>
            
            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center space-x-6 text-sm pt-4">
              <button className={getTabClass('progress')} onClick={() => setActiveTab('progress')}>Overview</button>
              <button className={getTabClass('mimic')} onClick={() => setActiveTab('mimic')}>Practice</button>
              <button className={getTabClass('battle')} onClick={() => setActiveTab('battle')}>Arena</button>
              <button className={getTabClass('leaderboard')} onClick={() => setActiveTab('leaderboard')}>Leaderboard</button>
              <button className={getTabClass('sandbox')} onClick={() => setActiveTab('sandbox')}>Analysis</button>
            </nav>
          </div>
          
          {/* Trailing Action Controls */}
          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-1 border border-outline-variant/60 rounded-lg p-0.5 bg-surface-container-lowest">
              <button className="p-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors duration-150" title="Audio Spectral EQ">
                <span className="material-symbols-outlined">graphic_eq</span>
              </button>
              <button className="p-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors duration-150" title="Analysis Calibration">
                <span className="material-symbols-outlined">tune</span>
              </button>
              <button className="p-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors duration-150" title="More Options">
                <span className="material-symbols-outlined">more_vert</span>
              </button>
            </div>
            <button className="text-xs font-medium px-3.5 py-1.5 rounded-lg border border-outline-variant hover:border-outline text-on-surface hover:bg-surface-container-high transition-all duration-150">
              Share Session
            </button>
            <button className="text-xs font-medium px-3.5 py-1.5 rounded-lg bg-primary text-on-primary hover:bg-neutral-800 transition-all duration-150 flex items-center space-x-1.5 shadow-sm">
              <span>Export Report</span>
              <span className="material-symbols-outlined text-[15px]">arrow_outward</span>
            </button>
            {/* User Analyst Avatar */}
            <div className="w-8 h-8 rounded-full border border-outline-variant overflow-hidden bg-surface-container-high flex-shrink-0 ml-2">
              <img alt="Avatar" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB7u-s9Dshc11CaLBQRkghwVtuNJzsTGljCg5Fvb6lMw340BpvBdGb1zNPJCGZzc4k95JlENvcY38JQMA5FFLzi8iWYZtWx0TLUZFl8LUD5j5EZfVdLjkhiAutuc7oahm6UiZNlYCKHlVkmAIKtrKCGh6Eh9T7qxLMoxy016YZaSZrSN_ZM76kuoXmFZVXmtO9IvH7ppaupbrUW0XKw2tJQujEz9Geas81YOyRHTqwfac0gEWl7Q-dvM1LwRtwyJuGXZOktDj7S4T_g"/>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full max-w-[1600px] mx-auto px-4 md:px-8 py-7 space-y-6">
        {activeTab === 'sandbox' && <Sandbox />}
        {activeTab === 'progress' && <Progress />}
        {activeTab === 'battle' && <Battle />}
        {activeTab === 'mimic' && <MimicParty />}
        {activeTab === 'leaderboard' && <Leaderboard />}
      </main>
    </>
  )
}

export default App
