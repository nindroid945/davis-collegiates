import React, { useState, useEffect } from 'react';

function EventCard({ event }) {
  const [expanded, setExpanded] = useState(false);

  const getMedal = (idx, score) => {
    if (!score || score === '-' || score === '') return null;
    if (idx === 0) return '🥇 ';
    if (idx === 1) return '🥈 ';
    if (idx === 2) return '🥉 ';
    return null;
  };

  const sortedCompetitors = [...(event.competitors || [])].sort((a, b) => {
    const hasScoreA = a.score && a.score !== '-';
    const hasScoreB = b.score && b.score !== '-';

    if (hasScoreA && hasScoreB) {
      return parseFloat(b.score) - parseFloat(a.score);
    }
    if (hasScoreA && !hasScoreB) return -1;
    if (!hasScoreA && hasScoreB) return 1;
    return 0;
  });

  return (
    <div className={`event-card ${event.status === 'Finished' ? 'finished' : ''}`}>
      <div className="event-header" onClick={() => setExpanded(!expanded)}>
        <div className="event-info">
          <h3>{event.name}</h3>
          {/* <span className="event-code">{event.eventId}</span> */}
        </div>
      </div>

      {expanded && event.competitors && (
        <div className="competitor-list">
          {event.status === 'Finished' && (
            <div className="competitor-row" style={{ backgroundColor: '#f1f5f9', justifyContent: 'center' }}>
              <span style={{ fontWeight: '700', color: '#64748b', letterSpacing: '2px', fontSize: '0.85rem' }}>COMPLETED</span>
            </div>
          )}
          {sortedCompetitors.length === 0 ? (
            <div className="no-competitors">No competitors scored yet.</div>
          ) : (
            sortedCompetitors.map((comp, idx) => (
              <div key={idx} className="competitor-row">
                <span className="competitor-name">
                  {getMedal(idx, comp.score)}
                  {comp.name}
                </span>
                <span className="competitor-score">{!comp.score || comp.score === '' ? '-' : comp.score}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function RingColumn({ ringId, events }) {
  return (
    <div className="ring-column">
      <h2 className="ring-title">Ring {ringId}</h2>
      <div className="event-list">
        {events && events.length > 0 ? (
          events.map(ev => <EventCard key={ev.eventId} event={ev} />)
        ) : (
          <div className="empty-ring">No events currently scheduled.</div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [rings, setRings] = useState({ 1: [], 2: [], 3: [] });
  const [activeTab, setActiveTab] = useState(1);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Responsive listener
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // SSE logic
  useEffect(() => {
    // Port 3001 is where the Node Express server will list. 
    // Usually configured via env, assuming localhost for testing.
    const source = new EventSource('http://localhost:3001/api/stream');

    source.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === 'INITIAL_STATE' || payload.type === 'STATE_UPDATE') {
          // Normalize state to guarantee all 3 rings
          const newRings = {
            1: payload.data.rings['1'] || [],
            2: payload.data.rings['2'] || [],
            3: payload.data.rings['3'] || []
          };
          setRings(newRings);
        }
      } catch (err) {
        console.error('Error parsing SSE data', err);
      }
    };

    source.onerror = (e) => {
      console.error('SSE connection error. Retrying...', e);
    };

    return () => source.close();
  }, []);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Davis Wushu Collegiates Event List</h1>
        <p>moo</p>
      </header>

      <main className="main-content">
        {isMobile ? (
          <div className="mobile-layout">
            <div className="tabs">
              {[1, 2, 3].map(r => (
                <button
                  key={r}
                  className={`tab-btn ${activeTab === r ? 'active' : ''}`}
                  onClick={() => setActiveTab(r)}
                >
                  Ring {r}
                </button>
              ))}
            </div>
            <div className="tab-panel">
              <RingColumn ringId={activeTab} events={rings[activeTab]} />
            </div>
          </div>
        ) : (
          <div className="desktop-grid">
            {[1, 2, 3].map(r => (
              <RingColumn key={r} ringId={r} events={rings[r]} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
