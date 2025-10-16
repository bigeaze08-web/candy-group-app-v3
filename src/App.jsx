import React from 'react'
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import supabase from './supabase'

/* ---------------- Header ---------------- */
function Header({ user, admin }) {
  const Link = ({to, children}) => (
    <NavLink to={to} className={({isActive})=> isActive? 'active' : undefined }>{children}</NavLink>
  )
  return (
    <header>
      <div className="inner">
        <div className="brand">
          <img src="/logo.jpg" alt="Candy Group"/>
          <div className="title">Candy Weight Loss Challenge</div>
        </div>
        <nav>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/participants">Participants</Link>
          {admin && <Link to="/admin/attendance">Attendance</Link>}
          {admin && <Link to="/admin/weighins">Weigh-Ins</Link>}
          {user
            ? <button className="btn" onClick={()=> supabase.auth.signOut().then(()=>window.location.reload())}>Sign out</button>
            : <button className="btn" onClick={async ()=>{
                const email = prompt('Enter email')
                const password = prompt('Enter password')
                if(!email || !password) return
                const { error } = await supabase.auth.signInWithPassword({ email, password })
                alert(error ? error.message : 'Signed in!')
                if(!error) window.location.reload()
              }}>Sign in</button>
          }
        </nav>
      </div>
    </header>
  )
}

/* ---------------- Dashboard (70/20/10) ---------------- */
function Dashboard(){
  const [rows, setRows] = React.useState([])

  React.useEffect(()=>{
    (async ()=>{
      // Get participants
      const { data: ps } = await supabase
        .from('participants')
        .select('id,name,start_weight_kg,start_waist_cm')
        .order('name')

      // Get latest weigh-in (via view if present; else compute)
      let latest = []
      const viewRes = await supabase.from('latest_weighin_per_participant')
        .select('participant_id,date,weight_kg,waist_cm')
      if(!viewRes.error && viewRes.data) {
        latest = viewRes.data
      } else {
        // fallback: fetch all weigh_ins (could be heavy for big datasets)
        const { data: allWi } = await supabase.from('weigh_ins').select('participant_id,date,weight_kg,waist_cm')
        const m = new Map()
        ;(allWi||[]).forEach(w=>{
          const key = w.participant_id
          const prev = m.get(key)
          if(!prev || w.date > prev.date) m.set(key, w)
        })
        latest = Array.from(m.values())
      }

      // Get attendance for the contest window
      const { data: att } = await supabase
        .from('attendance')
        .select('participant_id,date')
        .gte('date','2025-10-13')
        .lte('date','2025-12-05')

      const attCountByPid = {}
      ;(att||[]).forEach(a=>{
        attCountByPid[a.participant_id] = (attCountByPid[a.participant_id]||0) + 1
      })

      const latestByPid = {}
      ;(latest||[]).forEach(l => { latestByPid[l.participant_id] = l })

      const computed = (ps||[]).map(p=>{
        const startW = Number(p.start_weight_kg || 0)
        const startWa = Number(p.start_waist_cm || 0)
        const l = latestByPid[p.id]
        const curW = Number(l?.weight_kg ?? startW)
        const curWa = Number(l?.waist_cm ?? startWa)
        const lossKg = (startW && curW) ? (startW - curW) : 0
        const lossWa = (startWa && curWa) ? (startWa - curWa) : 0
        const attendance = attCountByPid[p.id] || 0
        return { id:p.id, name:p.name, lossKg, lossWa, attendance }
      })

      // rank by each metric, then score 70/20/10
      function ranking(arr, key){
        const s=[...arr].sort((a,b)=> b[key]-a[key])
        const pos=new Map(); s.forEach((r,i)=>pos.set(r.id,i+1)); return pos
      }
      const rW = ranking(computed,'lossKg')
      const rWa = ranking(computed,'lossWa')
      const rAt = ranking(computed,'attendance')
      const N = computed.length
      const scored = computed.map(r => ({
        ...r,
        score: ((N - (rW.get(r.id)||N) + 1)*0.7)
             + ((N - (rWa.get(r.id)||N) + 1)*0.2)
             + ((N - (rAt.get(r.id)||N) + 1)*0.1)
      })).sort((a,b)=> b.score - a.score)

      setRows(scored)
    })()
  },[])

  return (
    <div className="container">
      <div className="card">
        <div style={{fontWeight:800, marginBottom:8}}>Dashboard — Leaderboard</div>
        <table>
          <thead><tr><th>Rank</th><th>Name</th><th>Kg lost</th><th>Waist cm lost</th><th>Attendance</th></tr></thead>
          <tbody>{rows.map((r,i)=>(
            <tr key={r.id}><td>{i+1}</td><td>{r.name}</td><td>{r.lossKg.toFixed(1)}</td><td>{r.lossWa.toFixed(1)}</td><td>{r.attendance}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}

/* ---------------- Participants ---------------- */
function ParticipantsPage(){
  const [ps, setPs] = React.useState([])
  React.useEffect(()=>{
    supabase.from('participants')
      .select('id,name,phone,gender,start_weight_kg')
      .order('registered_at',{ascending:false})
      .then(({data})=> setPs(data||[]))
  },[])
  return (
    <div className="container">
      <div className="card">
        <div style={{fontWeight:800, marginBottom:8}}>Participants</div>
        <table>
          <thead><tr><th>Name</th><th>Phone</th><th>Gender</th><th>Start weight (kg)</th></tr></thead>
          <tbody>
            {ps.map(p=>(
              <tr key={p.id}>
                <td>{p.name}</td><td>{p.phone||''}</td><td>{p.gender||''}</td><td>{p.start_weight_kg ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ---------------- Admin: Attendance ---------------- */
function AttendanceAdminPage(){
  const [adminOk, setAdminOk] = React.useState(false)
  const [parts, setParts] = React.useState([])
  const [attDate, setAttDate] = React.useState('')
  const [checks, setChecks] = React.useState({})
  const [saving, setSaving] = React.useState(false)

  const attendanceDates = React.useMemo(()=>{
    const out = []
    const start = new Date('2025-10-13')
    const end   = new Date('2025-12-05')
    for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
      const dow = d.getDay() // 1..5 = Mon..Fri
      if (dow >= 1 && dow <= 5) {
        const iso = d.toISOString().slice(0,10)
        out.push({ iso, label: d.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' }) })
      }
    }
    return out
  },[])

  React.useEffect(()=>{
    (async ()=>{
      const { data } = await supabase.rpc('is_admin')
      setAdminOk(!!data)
      const { data: ps } = await supabase.from('participants').select('id,name').order('name')
      setParts(ps||[])
    })()
  },[])

  function markAll(v){ const m={}; parts.forEach(p=>m[p.id]=v); setChecks(m) }
  function toggle(id){ setChecks(prev=> ({...prev, [id]: !prev[id]})) }

  async function save(e){
    e.preventDefault()
    if(!attDate) return alert('Pick a date')
    const ids = parts.filter(p=>checks[p.id]).map(p=>p.id)
    if(ids.length===0) return alert('No one marked present')
    setSaving(true)
    const { data, error } = await supabase.rpc('mark_attendance', { d: attDate, ids })
    setSaving(false)
    if(error) return alert(error.message)
    alert(`Attendance saved for ${data} participant(s) on ${attDate}`)
    setChecks({})
  }

  if(!adminOk){ return <div className="container"><div className="card">Admins only.</div></div> }

  return (
    <div className="container">
      <div className="card">
        <div style={{fontWeight:800, marginBottom:8}}>Attendance (Mon–Fri)</div>
        <div style={{display:'flex',gap:8,alignItems:'center', marginBottom:8}}>
          <select className="input" value={attDate} onChange={e=>setAttDate(e.target.value)}>
            <option value="">— Choose a date —</option>
            {attendanceDates.map(o=> <option key={o.iso} value={o.iso}>{o.label} ({o.iso})</option>)}
          </select>
          <button className="btn" type="button" onClick={()=>markAll(true)}>Mark all</button>
          <button className="btn" type="button" onClick={()=>markAll(false)}>Clear</button>
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

/* ---------------- Admin: Weigh-Ins (Mon/Fri) ---------------- */
function WeighInsAdminPage(){
  const [adminOk, setAdminOk] = React.useState(false)
  const [parts, setParts] = React.useState([])
  const [wiDate, setWiDate] = React.useState('')
  const [rows, setRows] = React.useState([])
  const [saving, setSaving] = React.useState(false)

  const weighinDates = React.useMemo(()=>{
    const out = []
    const start = new Date('2025-10-13')
    const end   = new Date('2025-12-05')
    for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
      const dow = d.getDay()
      if (dow === 1 || dow === 5) {
        const iso = d.toISOString().slice(0,10)
        out.push({ iso, label: d.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' }) })
      }
    }
    return out
  },[])

  React.useEffect(()=>{
    (async ()=>{
      const { data } = await supabase.rpc('is_admin')
      setAdminOk(!!data)

      const { data: ps, error } = await supabase
        .from('participants')
        .select('id,name')
        .order('name')
      if (error) { setParts([]); setRows([]); return }
      setParts(ps || [])
      setRows((ps||[]).map(p=>({ participant_id: p.id, weight_kg:'', waist_cm:'' })))
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
    setSaving(true)
    const { data, error } = await supabase.rpc('upsert_weighins', { d: wiDate, rows: payload })
    setSaving(false)
    if(error) return alert(error.message)
    alert(`Saved ${data} weigh-in(s) for ${wiDate}`)
  }

  if(!adminOk){ return <div className="container"><div className="card">Admins only.</div></div> }

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
            <thead><tr><th>Name</th><th>Weight (kg)</th><th>Waist (cm)</th></tr></thead>
            <tbody>
              {parts.map(p=>{
                const r = rows.find(x=>x.participant_id===p.id) || {weight_kg:'',waist_cm:''}
                return (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td><input className="input" type="number" step="0.1" value={r.weight_kg} onChange={e=>setField(p.id,'weight_kg',e.target.value)} placeholder="e.g. 82.4" /></td>
                    <td><input className="input" type="number" step="0.1" value={r.waist_cm} onChange={e=>setField(p.id,'waist_cm',e.target.value)} placeholder="e.g. 92.0" /></td>
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

/* ---------------- App shell ---------------- */
export default function App(){
  const [user, setUser]   = React.useState(null)
  const [admin, setAdmin] = React.useState(false)
  const navigate = useNavigate()

  React.useEffect(()=>{
    supabase.auth.getUser().then(({data})=> setUser(data?.user || null))
  },[])
  React.useEffect(()=>{
    (async ()=>{
      try { const { data } = await supabase.rpc('is_admin'); setAdmin(!!data) } catch { setAdmin(false) }
    })()
  },[])

  React.useEffect(()=>{
    if (location.pathname === '/') navigate('/dashboard', { replace:true })
  },[navigate])

  return (
    <>
      <Header user={user} admin={admin} />
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/participants" element={<ParticipantsPage />} />
        <Route path="/admin/attendance" element={<AttendanceAdminPage />} />
        <Route path="/admin/weighins" element={<WeighInsAdminPage />} />
        <Route path="*" element={<div className="container"><div className="card">Page not found.</div></div>} />
      </Routes>
    </>
  )
}

