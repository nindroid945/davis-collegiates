import React, { useState, useEffect } from 'react';

const getTimePerPerson = (eventId) => {
  if (!eventId) return 2;
  const levelCode = eventId.charAt(0).toUpperCase();
  const eventCodeNum = eventId.slice(-3);

  let mins = 2; // Beginner / default
  if (levelCode === 'I') mins = 2.5;
  if (levelCode === 'A') mins = 3;

  if (['111', '112'].includes(eventCodeNum)) mins = 5;
  if (['301', '302', '311', '321', '322', '323', '341'].includes(eventCodeNum)) mins = 7.5;

  return mins;
};

function EventCard({ event, waitTimeStr }) {
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
        </div>
        {waitTimeStr && (
          <div className="event-estimate" style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500', textAlign: 'right', whiteSpace: 'nowrap', marginLeft: '1rem' }}>
            {waitTimeStr}
          </div>
        )}
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
  const currentEvent = (events || []).find(ev => ev.status !== 'Finished');
  let cumulativeWaitTime = 0;

  return (
    <div className="ring-column">
      <h2 className="ring-title">
        Ring {ringId}
        {currentEvent && (
          <div style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '500', marginTop: '0.25rem' }}>
            Current: {currentEvent.name}
          </div>
        )}
      </h2>
      <div className="event-list">
        {events && events.length > 0 ? (
          events.map(ev => {
            let estimatedWaitStr = "";
            if (ev.status !== 'Finished') {
              if (ev === currentEvent) {
                estimatedWaitStr = "Ongoing";
              } else {
                const roundedMins = Math.round(cumulativeWaitTime);
                if (roundedMins < 60) {
                  estimatedWaitStr = `Starts in ~${roundedMins} mins`;
                } else {
                  const hr = Math.floor(roundedMins / 60);
                  const min = roundedMins % 60;
                  estimatedWaitStr = `Starts in ~${hr}h${min > 0 ? ` ${min}m` : ''}`;
                }
              }

              const numRemaining = (ev.competitors || []).filter(c => !c.score || c.score === '-').length;
              const timePer = getTimePerPerson(ev.eventId);
              cumulativeWaitTime += (numRemaining * timePer);
            }

            return <EventCard key={ev.eventId} event={ev} waitTimeStr={estimatedWaitStr} />;
          })
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
    const source = new EventSource('https://davis-collegiates.onrender.com/api/stream');

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
        <p>Please show up to your events 15 minutes in advance! The time estimates will be slightly off.</p>
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
