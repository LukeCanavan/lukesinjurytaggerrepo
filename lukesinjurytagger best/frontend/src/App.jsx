import React, { useState, useRef, useEffect } from 'react'

const API = '/api'

const TAGS = [
  { key: 'T', label: 'Tackle' },
  { key: 'F', label: 'Fall' },
  { key: 'I', label: 'Injury' },
  { key: 'O', label: 'Other' }
]

export default function App() {
  const videoRef = useRef(null)
  const timelineRef = useRef(null)
  const [videoUrl, setVideoUrl] = useState('')
  const [events, setEvents] = useState([])
  const [note, setNote] = useState('Concussion')
  const [version, setVersion] = useState('')
  const [currentTime, setCurrentTime] = useState(0)
  const [matchId, setMatchId] = useState('')
  const [player, setPlayer] = useState('')
  const [severity, setSeverity] = useState(0)
  const [filterLabel, setFilterLabel] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingValues, setEditingValues] = useState({})

  useEffect(()=> { fetch(API + '/events').then(r=>r.json()).then(setEvents) },[])
  useEffect(()=> { fetch(API + '/version').then(r=>r.json()).then(d=> setVersion(d.version)) },[])
  useEffect(()=> {
    const v = videoRef.current
    if (!v) return
    const h = () => setCurrentTime(v.currentTime)
    v.addEventListener('timeupdate', h)
    return () => v.removeEventListener('timeupdate', h)
  },[videoRef.current])

  useEffect(()=> {
    const onKey = e => {
      if (editingId) return
      const tag = TAGS.find(t => t.key.toLowerCase() === e.key.toLowerCase())
      if (tag) { e.preventDefault(); addEvent(tag) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  },[editingId])

  function refresh(filter='') {
    const url = filter ? `${API}/events?label=${encodeURIComponent(filter)}` : API + '/events'
    fetch(url).then(r=>r.json()).then(setEvents)
  }

  function addEvent(tag) {
    const v = videoRef.current
    if (!v) return
    const payload = { timestamp_s: v.currentTime, label: tag.label, note, match_id: matchId, player, severity }
    fetch(API + '/events', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
      .then(r=>r.json()).then(e=> { setEvents(evts=> [...evts, e]); setNote(note) })
  }

  function deleteEvent(id) {
    fetch(API + '/events/' + id, { method:'DELETE' })
      .then(()=> setEvents(evts => evts.filter(e=> e.id !== id)))
  }

  function startEdit(e) {
    setEditingId(e.id)
    setEditingValues({ note: e.note, label: e.label, match_id: e.match_id||'', player: e.player||'', severity: e.severity||0 })
  }

  function saveEdit(id) {
    fetch(API + '/events/' + id, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(editingValues) })
      .then(r=>r.json()).then(updated => {
        setEvents(evts => evts.map(e=> e.id===id? updated: e))
        setEditingId(null)
      })
  }

  function cancelEdit() { setEditingId(null) }

  function exportXlsx() { window.location = API + '/export/xlsx' }
  function exportCsv() { window.location = API + '/export/csv' }

  const filtered = filterLabel ? events.filter(e=> e.label === filterLabel) : events
  const sorted = [...filtered].sort((a,b)=> a.timestamp_s - b.timestamp_s)
  const fmt = s => new Date(s * 1000).toISOString().substr(14,8)

  function seekTo(t) { const v = videoRef.current; if (v) { v.currentTime = t; v.play() } }

  // Timeline markers
  const duration = videoRef.current?.duration || 0
  const markers = duration ? sorted.map(e=> ({ id: e.id, left: (e.timestamp_s/duration)*100, label: e.label })) : []

  return (
    <div style={{ fontFamily:'Arial', background:'#c0f2d9', minHeight:'100vh', padding:'10px' }}>
      <h2 style={{ textAlign:'center' }}>Lukes Injury Event System <small style={{ fontSize:12 }}>v{version}</small></h2>
      <div style={{ display:'flex', justifyContent:'center', gap:'6px', flexWrap:'wrap', marginBottom:8 }}>
        <input placeholder='Video URL' value={videoUrl} onChange={e=> setVideoUrl(e.target.value)} style={{ flex:'1 1 260px', minWidth:260 }} />
        <button onClick={()=> { if (videoRef.current && videoUrl) { videoRef.current.src = videoUrl } }}>Load</button>
        <input placeholder='Note' value={note} onChange={e=> setNote(e.target.value)} style={{ width:140 }} />
        <input placeholder='Match ID' value={matchId} onChange={e=> setMatchId(e.target.value)} style={{ width:90 }} />
        <input placeholder='Player' value={player} onChange={e=> setPlayer(e.target.value)} style={{ width:90 }} />
        <input type='number' min={0} max={5} value={severity} onChange={e=> setSeverity(Number(e.target.value))} style={{ width:60 }} title='Severity 0-5' />
        <select value={filterLabel} onChange={e=> { setFilterLabel(e.target.value); refresh(e.target.value) }} style={{ width:110 }}>
          <option value=''>All Labels</option>
          {TAGS.map(t=> <option key={t.label} value={t.label}>{t.label}</option>)}
        </select>
        <button onClick={exportXlsx}>XLSX</button>
        <button onClick={exportCsv}>CSV</button>
        <div style={{ alignSelf:'center', fontSize:14 }}>Time: {fmt(currentTime)}</div>
      </div>
      <div style={{ display:'flex', justifyContent:'center', marginTop:6 }}>
        <video ref={videoRef} style={{ maxWidth:900, width:'100%', background:'#000' }} controls />
        <div style={{ marginLeft:12, display:'flex', flexDirection:'column', gap:8 }}>
          {TAGS.map(t=> <button key={t.key} title={`Key: ${t.key}`} onClick={()=> addEvent(t)} style={{ padding:8 }}>{t.label}</button>)}
        </div>
      </div>
      <div style={{ maxWidth:960, margin:'10px auto' }}>
        <div ref={timelineRef} style={{ position:'relative', height:24, background:'#e0e0e0', borderRadius:4 }}>
          <div style={{ position:'absolute', left:`${duration? (currentTime/duration)*100:0}%`, top:0, bottom:0, width:2, background:'#ff0000' }} />
          {markers.map(m=> (
            <div key={m.id} title={m.label} onClick={()=> seekTo(events.find(e=> e.id===m.id).timestamp_s)} style={{ position:'absolute', left:`${m.left}%`, top:0, bottom:0, width:6, background:'#2d6cdf', cursor:'pointer' }} />
          ))}
        </div>
      </div>
      <div style={{ display:'flex', justifyContent:'center', marginTop:20 }}>
        <div style={{ maxWidth:960, width:'100%' }}>
          <h4>Logged Events ({sorted.length})</h4>
          <table width='100%' border={1} cellPadding={4} style={{ background:'#fff', fontSize:13 }}>
            <thead>
              <tr><th>#</th><th>Time</th><th>Label</th><th>Note</th><th>Match</th><th>Player</th><th>Severity</th><th></th></tr>
            </thead>
            <tbody>
              {sorted.map((e,i)=> {
                const editing = editingId === e.id
                return (
                  <tr key={e.id} style={{ background: editing? '#fff9d6':'inherit' }}>
                    <td>{i+1}</td>
                    <td style={{ cursor:'pointer' }} onClick={()=> seekTo(e.timestamp_s)}>{fmt(e.timestamp_s)}</td>
                    <td>{editing ? (
                      <select value={editingValues.label} onChange={ev=> setEditingValues(v=> ({...v, label: ev.target.value}))}>{TAGS.map(t=> <option key={t.label}>{t.label}</option>)}</select>
                    ) : e.label}</td>
                    <td>{editing ? <input value={editingValues.note} onChange={ev=> setEditingValues(v=> ({...v, note: ev.target.value}))} /> : e.note}</td>
                    <td>{editing ? <input value={editingValues.match_id} onChange={ev=> setEditingValues(v=> ({...v, match_id: ev.target.value}))} style={{ width:70 }} /> : (e.match_id||'')}</td>
                    <td>{editing ? <input value={editingValues.player} onChange={ev=> setEditingValues(v=> ({...v, player: ev.target.value}))} style={{ width:70 }} /> : (e.player||'')}</td>
                    <td>{editing ? <input type='number' min={0} max={5} value={editingValues.severity} onChange={ev=> setEditingValues(v=> ({...v, severity:Number(ev.target.value)}))} style={{ width:50 }} /> : (e.severity??0)}</td>
                    <td style={{ whiteSpace:'nowrap' }}>
                      {editing ? (
                        <>
                          <button onClick={()=> saveEdit(e.id)} style={{ marginRight:4 }}>Save</button>
                          <button onClick={cancelEdit}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={()=> startEdit(e)} style={{ marginRight:4 }}>Edit</button>
                          <button onClick={()=> deleteEvent(e.id)} style={{ fontSize:11 }}>x</button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ marginTop:6, fontSize:12, opacity:0.7 }}>Keyboard: {TAGS.map(t=> t.key).join(', ')} | Click time to seek | Timeline markers clickable.</div>
        </div>
      </div>
    </div>
  )
}
