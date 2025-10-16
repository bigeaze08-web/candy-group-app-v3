import React from 'react'
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import supabase from './supabase'

/** ---------- Header ---------- */
function Header({ user, admin }) {
  const navLink = (to, text) => (
    <NavLink to={to} className={({isActive})=> isActive? 'active' : undefined }>{text}</NavLink>
  )
  return (
    <header>
      <div className="inner">
        <div className="brand">
          <img src="/logo.jpg" alt="Candy Group"/>
          <div className="title">Candy Weight Loss Challenge</div>
        </div>
        <nav>
          {navLink('/dashboard','Dashboard')}
          {navLink('/participants','Participants')}
          {/* Admin-only Weigh-Ins tab */}
          {admin && navLink('/admin/weighins','Weigh-Ins')}
          {user
            ? <button className="btn" onClick={()=> supabase.auth.signOut().then(()=>window.location.reload())}>Sign out</button>
            : <button className="btn" onClick={async ()=>{
                const email = prompt('Enter your email to sign in (admins must use admin email):')
                const password = prompt('Enter your password:')
                if(!email || !password) return
                const { error } = await supabase.auth.signInWithPassword({ email, password })
                alert(error ? error.message : 'Signed in! If you are an admin, the Weigh-Ins tab will appear.')
                if(!error) window.location.reload()
              }}>Sign in</button>
          }
        </nav>
      </div>
    </header>
  )
}

/** ---------- Simple pages ---------- */
function Dashboard({ participants }) {
  // Minimal placeholder; your leaderboard logic can be plugged here
  return (
    <div className="container">
      <div className="card">
        <div style={{fontWeight:800, marginBottom:8}}>Dashboard</div>
        <div>Participants: {participants.length}</div>
        <div style={{fontSize:12, color:'#475569', marginTop:6}}>
          (Leaderboard logic can be added back here — current version focuses on the Weigh-Ins admin tab.)
        </div>
      </div>
    </div>
  )
}

function ParticipantsPage({ participants }) {
  return (
    <div className="container">
      <div className="card">
        <div style={{fontWeight:800, marginBottom:8}}>Participants</div>
        <table>
          <thead><tr><th>Name</th><th>Phone</th><th>Gender</th><th>Start weight (kg)</th></tr></thead>
          <tbody>
            {participants.map(p=>(
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.phone||''}</td>
                <td>{p.gender||''}</td>
                <td>{p.start_weight_kg ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** ---------- Admin: Weigh-Ins (Mon & Fri only) ---------- */
function WeighInsAdminPage(){
  const [adminOk, setAdminOk] = React.useState(false)
  const [parts, setParts] = React.useState([])
  const [wiDate, setWiDate] = React.useState('')
  const [rows, setRows] = React.useState([]) // [{participant_id, weight_kg, waist_cm}]
  const [saving, setSaving] = React.useState(false)

  // Only Mon & Fri between Oct 13 — Dec 5, 2025
  const weighinDates = React.useMemo(()=>{
    const out = []
    const start = new Date('2025-10-13')
    const end   = new Date('2025-12-05')
    for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
      const dow = d.getDay() // 0 Sun .. 6 Sat
      if (dow === 1 || dow === 5) {
        const iso = d.toISOString().slice(0,10)
        out.push({ iso, label: d.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' }) })
      }
    }
    return out
  },[])

  React.useEffect(()=>{
    (async ()=>{
      try {
        const { data } = await supabase.rpc('is_admin')
        setAdminOk(!!data)
      } catch { setAdminOk(false) }

      try {
        const { data: ps, error } = await supabase
          .from('participants')
          .select('id,name')
          .order('name')
        if (error) throw error
        setParts(ps || [])
        setRows((ps||[]).map(p=>({ participant_id: p.id, weight_kg:'', waist_cm:'' })))
      } catch {
        setParts([]); setRows([])
      }
    })()
  },[])

  function setField(pid, key, value){
    setRows(prev => prev.map(r => r.participant_id===pid ? { ...r, [key]: value } : r))
  }

  async function save(e){
    e.preventDefault()
    if(!wiDate) return alert('Pick a Monday or Friday date')
    const payload = rows.filter(r => r.weight_kg !== '' || r.waist_cm !== '')
    if(payload.length === 0) return alert('Enter at least one value')
    try{
      setSaving(true)
      const { data, error } = await supabase.rpc('upsert_weighins', { d: wiDate, rows: payload })
      setSaving(false)
      if(error) return alert(error.message)
      alert(`Saved ${data} weigh-in(s) for ${wiDate}`)
    }catch(err){
      setSaving(false)
      alert(err.message || 'Failed to save weigh-ins')
    }
  }

  if(!adminOk){
    return <div className="container"><div className="card">Admins only.</div></div>
  }

  return (
    <div className="container">
      <div className="card">
        <div style={{fontWeight:800, marginBottom:8}}>Weigh-Ins (Mon & Fri)</div>

        <div style={{display:'flex',gap:8,alignItems:'center', marginBottom:8}}>
          <select className="input" value={wiDate} onChange={e=>setWiDate(e.target.value)}>
            <option value="">— Choose a date —</option>
            {weighinDates.map(o=> <option key={o.iso} value={o.iso}>{o.label} ({o.iso})</option>)}
          </select>
        </div>

        <form onSubmit={save}>
          <table>
            <thead>
              <tr>
                <th style={{textAlign:'left'}}>Name</th>
                <th style={{textAlign:'left'}}>Weight (kg)</th>
                <th style={{textAlign:'left'}}>Waist (cm)</th>
              </tr>
            </thead>
            <tbody>
              {parts.map(p=>{
                const r = rows.find(x=>x.participant_id===p.id) || {weight_kg:'',waist_cm:''}
                return (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>
                      <input className="input" type="number" step="0.1"
                        value={r.weight_kg}
                        onChange={e=>setField(p.id, 'weight_kg', e.target.value)}
                        placeholder="e.g. 82.4"
                      />
                    </td>
                    <td>
                      <input className="input" type="number" step="0.1"
                        value={r.waist_cm}
                        onChange={e=>setField(p.id, 'waist_cm', e.target.value)}
                        placeholder="e.g. 92.0"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div style={{display:'flex',justifyContent:'flex-end',marginTop:8}}>
            <button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save weigh-ins'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

/** ---------- App shell ---------- */
export default function App(){
  const [user, setUser] = React.useState(null)
  const [participants, setParticipants] = React.useState([])
  const [admin, setAdmin] = React.useState(false)
  const navigate = useNavigate()

  React.useEffect(()=>{
    supabase.auth.getUser().then(({data})=> setUser(data?.user || null))
  },[])

  React.useEffect(()=>{
    (async ()=>{
      try {
        const { data } = await supabase.rpc('is_admin')
        setAdmin(!!data)
      } catch { setAdmin(false) }

      try {
        const { data: ps } = await supabase
          .from('participants')
          .select('id,name,phone,gender,start_weight_kg')
          .order('registered_at', { ascending:false })
        setParticipants(ps || [])
      } catch { setParticipants([]) }
    })()
  },[])

  React.useEffect(()=>{
    // default route -> /dashboard
    if (location.pathname === '/') navigate('/dashboard', { replace:true })
  },[navigate])

  return (
    <>
      <Header user={user} admin={admin} />
      <Routes>
        <Route path="/dashboard" element={<Dashboard participants={participants} />} />
        <Route path="/participants" element={<ParticipantsPage participants={participants} />} />
        <Route path="/admin/weighins" element={<WeighInsAdminPage />} />
        {/* fallback */}
        <Route path="*" element={<div className="container"><div className="card">Page not found.</div></div>} />
      </Routes>
    </>
  )
}
