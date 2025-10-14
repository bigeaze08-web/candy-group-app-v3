// src/App.jsx (safe version with admin attendance)
import React from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import supabase from './supabase'

/* ---------- tiny helpers to avoid hard crashes ---------- */
async function safeIsAdmin() {
  try {
    const { data } = await supabase.rpc('is_admin')
    return !!data
  } catch {
    return false
  }
}
async function safeLoadParticipants() {
  try {
    const { data } = await supabase.from('participants').select('id,name').order('name')
    return data || []
  } catch {
    return []
  }
}

/* ----------------- Header ----------------- */
function Header({ user, admin }) {
  return (
    <header style={{position:'sticky',top:0,background:'rgba(241,245,249,.9)',backdropFilter:'saturate(180%) blur(8px)',borderBottom:'1px solid #e2e8f0', zIndex:10}}>
      <div className="inner" style={{maxWidth:1100, margin:'0 auto', padding:'10px 16px'}}>
        {/* Row 1: brand */}
        <div style={{display:'flex',alignItems:'center',gap:12, marginBottom:8}}>
          <img src="/logo.jpg" alt="Candy Logo" style={{height:72, borderRadius:12}} />
          <div style={{fontWeight:800, fontSize:28}}>Candy Weight Loss Challenge</div>
        </div>
        {/* Row 2: tabs */}
        <nav style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          <NavLink to="/dashboard" className={({isActive})=> isActive? 'active' : undefined }>Dashboard</NavLink>
          <NavLink to="/participants" className={({isActive})=> isActive? 'active' : undefined }>Participants</NavLink>
          <NavLink to="/register" className={({isActive})=> isActive? 'active' : undefined }>Register</NavLink>
          <NavLink to="/my-profile" className={({isActive})=> isActive? 'active' : undefined }>My Profile</NavLink>
          {admin && (
            <NavLink to="/admin/attendance" className={({isActive})=> isActive? 'active' : undefined }>
              Attendance
            </NavLink>
          )}
          {user && (
            <button className="btn" onClick={()=> supabase.auth.signOut().then(()=>window.location.reload())}>
              Sign out
            </button>
          )}
        </nav>
      </div>
    </header>
  )
}

/* ----------------- Attendance (Admin-only) ----------------- */
function AttendanceAdminPage(){
  const [adminOk, setAdminOk] = React.useState(false)
  const [parts, setParts] = React.useState([])
  const [date, setDate] = React.useState('')
  const [checks, setChecks] = React.useState({})
  const [saving, setSaving] = React.useState(false)

  // Allowed Mon–Fri dates between 2025-10-13 and 2025-12-05
  const dateOptions = React.useMemo(()=>{
    const out = []
    const start = new Date('2025-10-13')
    const end   = new Date('2025-12-05')
    for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
      const dow = d.getDay() // 0=Sun..6=Sat
      if (dow >= 1 && dow <= 5) {
        const iso = d.toISOString().slice(0,10)
        out.push({ iso, label: d.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' }) })
      }
    }
    return out
  },[])

  React.useEffect(()=>{
    (async ()=>{
      const ok = await safeIsAdmin()
      setAdminOk(ok)
      setParts(await safeLoadParticipants())
    })()
  },[])

  function markAll(v){ const m={}; parts.forEach(p=>m[p.id]=v); setChecks(m) }
  function toggle(id){ setChecks(prev=> ({...prev, [id]: !prev[id]})) }

  async function save(e){
    e.preventDefault()
    if(!date) return alert('Pick a date')
    const ids = parts.filter(p=>checks[p.id]).map(p=>p.id)
    if(ids.length===0) return alert('No one marked present')

    try {
      setSaving(true)
      const { data, error } = await supabase.rpc('mark_attendance', { d: date, ids })
      setSaving(false)
      if(error) return alert(error.message)
      alert(`Attendance saved for ${data} participant(s).`)
      setChecks({})
    } catch (err) {
      setSaving(false)
      alert(err.message || 'Failed to save attendance')
    }
  }

  if(!adminOk){
    return (
      <div className="container">
        <div className="card" style={{padding:16}}>
          Admins only. Sign in with your admin account/email.
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="card" style={{padding:16}}>
        <div style={{fontWeight:800, marginBottom:8}}>Attendance (Mon–Fri, Oct 13 – Dec 5, 2025)</div>
        <div style={{display:'flex',gap:8,alignItems:'center', marginBottom:8}}>
          <select className="input" value={date} onChange={e=>setDate(e.target.value)}>
            <option value="">— Choose a date —</option>
            {dateOptions.map(o=> <option key={o.iso} value={o.iso}>{o.label} ({o.iso})</option>)}
          </select>
          <button className="btn" type="button" onClick={()=>markAll(true)}>Mark all present</button>
          <button className="btn" type="button" onClick={()=>markAll(false)}>Clear all</button>
        </div>
        <form onSubmit={save}>
          <table>
            <thead><tr><th>Present</th><th>Name</th></tr></thead>
            <tbody>
              {parts.map(p=>(
                <tr key={p.id}>
                  <td><input type="checkbox" checked={!!checks[p.id]} onChange={()=>toggle(p.id)} /></td>
                  <td>{p.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{display:'flex',justifyContent:'flex-end',marginTop:8}}>
            <button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save attendance'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* --------- Your original pages (keep as-is if they were working) --------- */
function Dashboard(){ return (
  <div className="container"><div className="card" style={{padding:16}}>Dashboard — Leaderboard</div></div>
)}
function ParticipantsPage(){ return (
  <div className="container"><div className="card" style={{padding:16}}>Participants (existing)</div></div>
)}
function RegisterPage(){ return (
  <div className="container"><div className="card" style={{padding:16}}>Register (existing)</div></div>
)}
function MyProfilePage(){ return (
  <div className="container"><div className="card" style={{padding:16}}>My Profile (existing)</div></div>
)}

/* ----------------- App ----------------- */
export default function App(){
  const [user, setUser] = React.useState(null)
  const [admin, setAdmin] = React.useState(false)

  React.useEffect(()=>{
    supabase.auth.getUser().then(({data})=> setUser(data?.user || null)).catch(()=>setUser(null))
  },[])

  React.useEffect(()=>{
    (async ()=>{
      setAdmin(await safeIsAdmin())
    })()
  },[])

  return (
    <>
      <Header user={user} admin={admin} />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/participants" element={<ParticipantsPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/my-profile" element={<MyProfilePage />} />
        <Route path="/admin/attendance" element={<AttendanceAdminPage />} />
      </Routes>
    </>
  )
}
