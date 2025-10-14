import React from 'react'
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import supabase from './supabase'

/* ============== Small helpers so the UI never hard-crashes ============== */
async function getUserSafe() {
  try {
    const { data } = await supabase.auth.getUser()
    return data?.user || null
  } catch { return null }
}
async function isAdminSafe() {
  try {
    const { data } = await supabase.rpc('is_admin')
    return !!data
  } catch { return false }
}
async function loadParticipantsSafe() {
  try {
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .order('registered_at', { ascending: false })
    if (error) throw error
    return data || []
  } catch { return [] }
}
async function loadWeighInsSafe() {
  try {
    const { data, error } = await supabase
      .from('weigh_ins')
      .select('participant_id, weight_kg, waist_cm, date')
    if (error) throw error
    return data || []
  } catch { return [] }
}
async function loadAttendanceSafe() {
  try {
    const { data, error } = await supabase
      .from('attendance')
      .select('participant_id, date')
    if (error) throw error
    return data || []
  } catch { return [] }
}
async function loadPhotosSafe() {
  try {
    const { data, error } = await supabase
      .from('photos')
      .select('participant_id, public_url, created_at')
    if (error) throw error
    return data || []
  } catch { return [] }
}

/* ============================ Header (tabs) ============================= */
function Header({ user, admin }) {
  return (
    <header style={{position:'sticky',top:0,background:'rgba(241,245,249,.9)',backdropFilter:'saturate(180%) blur(8px)',borderBottom:'1px solid #e2e8f0', zIndex:10}}>
      <div className="inner" style={{maxWidth:1100, margin:'0 auto', padding:'10px 16px'}}>
        {/* Row 1: brand */}
        <div style={{display:'flex',alignItems:'center',gap:12, marginBottom:8}}>
          <img src="/logo.jpg" alt="Candy Logo" style={{height:64, borderRadius:12}} />
          <div style={{fontWeight:800, fontSize:26}}>Candy Weight Loss Challenge</div>
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
          {!admin && (
            <NavLink to="/admin/signin" className={({isActive})=> isActive? 'active' : undefined }>
              Admin sign in
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

/* ============================== Dashboard ============================== */
function Dashboard(){
  const [rows, setRows] = React.useState([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(()=>{
    (async ()=>{
      setLoading(true)
      const [participants, weighIns, attendance] = await Promise.all([
        loadParticipantsSafe(),
        loadWeighInsSafe(),
        loadAttendanceSafe()
      ])

      // Latest weigh-in per participant
      const latestByPid = {}
      for (const w of weighIns) {
        const key = w.participant_id
        if (!latestByPid[key] || (w.date > latestByPid[key].date)) latestByPid[key] = w
      }

      // Attendance count per participant
      const attCount = {}
      for (const a of attendance) {
        attCount[a.participant_id] = (attCount[a.participant_id] || 0) + 1
      }

      // Build rows
      const calc = participants.map(p=>{
        const startW = Number(p.start_weight_kg ?? 0)
        const startWaist = Number(p.start_waist_cm ?? 0)
        const latest = latestByPid[p.id]
        const curW = Number(latest?.weight_kg ?? startW)
        const curWaist = Number(latest?.waist_cm ?? startWaist)
        const lossKg = startW && curW ? (startW - curW) : 0
        const lossWaist = startWaist && curWaist ? (startWaist - curWaist) : 0
        const attendanceCount = attCount[p.id] || 0
        return { id:p.id, name:p.name, lossKg, lossWaist, attendanceCount }
      })

      // Rank-based score (higher is better)
      function rankMap(arr, key){
        const s=[...arr].sort((a,b)=> b[key]-a[key])
        const m=new Map()
        s.forEach((r,i)=> m.set(r.id, i+1))
        return m
      }
      const rW = rankMap(calc,'lossKg')
      const rWa = rankMap(calc,'lossWaist')
      const rAt = rankMap(calc,'attendanceCount')
      const N = Math.max(1, calc.length)

      const scored = calc.map(r => ({
        ...r,
        score: ((N - (rW.get(r.id)||N) + 1)*0.7)
             + ((N - (rWa.get(r.id)||N) + 1)*0.2)
             + ((N - (rAt.get(r.id)||N) + 1)*0.1)
      })).sort((a,b)=> b.score - a.score)

      setRows(scored)
      setLoading(false)
    })()
  },[])

  return (
    <div className="container">
      <div className="card" style={{padding:16}}>
        <div style={{fontWeight:800, marginBottom:8}}>Dashboard — Leaderboard</div>
        {loading ? <div>Loading…</div> : (
          <table>
            <thead>
              <tr><th>Rank</th><th>Name</th><th>Kg lost</th><th>Waist cm lost</th><th>Attendance</th></tr>
            </thead>
            <tbody>
              {rows.map((r,i)=>(
                <tr key={r.id}>
                  <td>{i+1}</td>
                  <td>{r.name}</td>
                  <td>{r.lossKg.toFixed(1)}</td>
                  <td>{r.lossWaist.toFixed(1)}</td>
                  <td>{r.attendanceCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

/* ============================ Participants ============================ */
function ParticipantsPage(){
  const [items, setItems] = React.useState([])
  const [thumb, setThumb] = React.useState({}) // pid -> url

  React.useEffect(()=>{
    (async ()=>{
      const ps = await loadParticipantsSafe()
      setItems(ps)

      // Try to load latest photo per participant (optional if you have photos table)
      const allPhotos = await loadPhotosSafe()
      const latest = {}
      for (const ph of allPhotos) {
        const pid = ph.participant_id
        if (!latest[pid] || ph.created_at > latest[pid].created_at) latest[pid] = ph
      }
      const map = {}
      Object.keys(latest).forEach(pid => map[pid] = latest[pid].public_url)
      setThumb(map)
    })()
  },[])

  return (
    <div className="container">
      <div className="card" style={{padding:16}}>
        <div style={{fontWeight:800, marginBottom:8}}>Participants</div>
        <table>
          <thead><tr><th>Photo</th><th>Name</th><th>Start weight (kg)</th></tr></thead>
          <tbody>
            {items.map(p=>(
              <tr key={p.id}>
                <td>
                  {thumb[p.id]
                    ? <img src={thumb[p.id]} alt="" style={{height:48,width:48,objectFit:'cover',borderRadius:8}}/>
                    : <div style={{height:48,width:48,background:'#e2e8f0',borderRadius:8}}/>
                  }
                </td>
                <td>{p.name}</td>
                <td>{p.start_weight_kg ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ============================== Register ============================== */
function RegisterPage(){
  const [form, setForm] = React.useState({
    name:'', email:'', phone:'', gender:'', height_cm:'', start_weight_kg:'', start_waist_cm:''
  })
  const [saving, setSaving] = React.useState(false)

  async function submit(e){
    e.preventDefault()
    setSaving(true)
    try{
      const row = {
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        gender: form.gender || null,
        height_cm: form.height_cm ? Number(form.height_cm) : null,
        start_weight_kg: form.start_weight_kg ? Number(form.start_weight_kg) : null,
        start_waist_cm: form.start_waist_cm ? Number(form.start_waist_cm) : null
      }
      const { error } = await supabase.from('participants').insert(row)
      if(error) throw error
      alert('Registered!')
      setForm({name:'',email:'',phone:'',gender:'',height_cm:'',start_weight_kg:'',start_waist_cm:''})
    }catch(err){ alert(err.message) }
    setSaving(false)
  }

  return (
    <div className="container">
      <div className="card" style={{padding:16, maxWidth:900, margin:'12px auto'}}>
        <div style={{fontWeight:800, marginBottom:8}}>Register</div>
        <form onSubmit={submit}>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8}}>
            <input className="input" placeholder="Full name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required />
            <input className="input" type="email" placeholder="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} />
            <input className="input" placeholder="Phone" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} />
            <select className="input" value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})}>
              <option value="">— Gender —</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
            <input className="input" type="number" step="0.1" placeholder="Height (cm)" value={form.height_cm} onChange={e=>setForm({...form,height_cm:e.target.value})} />
            <input className="input" type="number" step="0.1" placeholder="Start weight (kg)" value={form.start_weight_kg} onChange={e=>setForm({...form,start_weight_kg:e.target.value})} />
            <input className="input" type="number" step="0.1" placeholder="Start waist (cm)" value={form.start_waist_cm} onChange={e=>setForm({...form,start_waist_cm:e.target.value})} />
          </div>
          <div style={{display:'flex', justifyContent:'flex-end', marginTop:8}}>
            <button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Create my profile'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ============================= My Profile ============================= */
function MyProfilePage(){
  const [user, setUser] = React.useState(null)
  const [p, setP] = React.useState(null)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(()=>{
    supabase.auth.getUser().then(async ({data})=>{
      const u = data?.user; setUser(u)
      if (!u) return
      const { data: rows } = await supabase.from('participants').select('*').eq('email', u.email).limit(1)
      setP(rows?.[0] || null)
    })
  },[])

  async function save(){
    if (!p) return
    setSaving(true)
    const { error } = await supabase.from('participants').update({
      name: p.name, phone: p.phone, gender: p.gender, height_cm: p.height_cm
    }).eq('id', p.id)
    setSaving(false)
    if (error) alert(error.message); else alert('Saved!')
  }

  async function onUploadPhoto(file){
    if (!p || !file) return
    const safe = file.name.replace(/\s+/g,'_')
    const path = `participants/${p.id}/${Date.now()}_${safe}`
    const { error: upErr } = await supabase.storage.from('photos').upload(path, file, { cacheControl:'3600', upsert:false })
    if (upErr) { alert(upErr.message); return }
    const { data: pub } = await supabase.storage.from('photos').getPublicUrl(path)
    await supabase.from('photos').insert({ participant_id: p.id, storage_path: path, public_url: pub.publicUrl })
    alert('Photo uploaded!')
  }

  if (!user) return <div className="container"><div className="card" style={{padding:16}}>Please sign in from Admin or use magic link flow (if enabled).</div></div>
  if (!p) return <div className="container"><div className="card" style={{padding:16}}>No profile yet. <a href="/register">Register here</a>.</div></div>

  return (
    <div className="container">
      <div className="card" style={{padding:16, maxWidth:900, margin:'12px auto'}}>
        <div style={{fontWeight:800, marginBottom:8}}>My profile</div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8}}>
          <input className="input" value={p.name||''} onChange={e=>setP({...p,name:e.target.value})} placeholder="Full name" />
          <input className="input" value={p.phone||''} onChange={e=>setP({...p,phone:e.target.value})} placeholder="Phone" />
          <select className="input" value={p.gender||''} onChange={e=>setP({...p,gender:e.target.value})}>
            <option value="">— Gender —</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
          <input className="input" type="number" step="0.1" value={p.height_cm||''} onChange={e=>setP({...p,height_cm:e.target.value})} placeholder="Height (cm)" />
          <input className="input" value={p.email||''} readOnly />
        </div>
        <div style={{display:'flex', justifyContent:'flex-end', marginTop:8}}>
          <button className="btn" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
        <div style={{height:12}}/>
        <div style={{fontWeight:700, marginBottom:6}}>Upload transformation photo</div>
        <input type="file" accept="image/*" capture="environment" onChange={e=> onUploadPhoto(e.target.files?.[0]) } />
      </div>
    </div>
  )
}

/* ============================ Admin Sign-in ============================ */
function AdminSignInPage(){
  const [email, setEmail] = React.useState('bigeaze08@gmail.com')
  const [password, setPassword] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const nav = useNavigate()

  async function submit(e){
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if(error) return alert(error.message)
    const ok = await isAdminSafe()
    if(!ok) { alert('Signed in but not an admin. Add your email to app_admins.'); return }
    nav('/admin/attendance')
  }

  return (
    <div className="container">
      <div className="card" style={{padding:16, maxWidth:420, margin:'16px auto'}}>
        <div style={{fontWeight:800, marginBottom:8}}>Admin Sign in</div>
        <form onSubmit={submit}>
          <input className="input" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required />
          <input className="input" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required />
          <div style={{display:'flex',justifyContent:'flex-end',marginTop:8}}>
            <button className="btn" disabled={busy}>{busy?'Signing in…':'Sign in'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ====================== Attendance (admin-only) ======================= */
function AttendanceAdminPage(){
  const [adminOk, setAdminOk] = React.useState(false)
  const [parts, setParts] = React.useState([])
  const [date, setDate] = React.useState('')
  const [checks, setChecks] = React.useState({})
  const [saving, setSaving] = React.useState(false)

  const dateOptions = React.useMemo(()=>{
    const out = []
    const start = new Date('2025-10-13')
    const end   = new Date('2025-12-05')
    for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
      const dow = d.getDay()
      if (dow >= 1 && dow <= 5) {
        const iso = d.toISOString().slice(0,10)
        out.push({ iso, label: d.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' }) })
      }
    }
    return out
  },[])

  React.useEffect(()=>{
    (async ()=>{
      setAdminOk(await isAdminSafe())
      setParts(await loadParticipantsSafe())
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
          Admins only. Use Admin sign in with your admin email.
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

/* ================================ App ================================ */
export default function App(){
  const [user, setUser] = React.useState(null)
  const [admin, setAdmin] = React.useState(false)

  React.useEffect(()=>{
    getUserSafe().then(setUser)
    const { data: sub } = supabase.auth.onAuthStateChange(()=> getUserSafe().then(setUser))
    return () => sub?.subscription?.unsubscribe?.()
  },[])

  React.useEffect(()=>{
    isAdminSafe().then(setAdmin)
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
        <Route path="/admin/signin" element={<AdminSignInPage />} />
        <Route path="/admin/attendance" element={<AttendanceAdminPage />} />
      </Routes>
    </>
  )
}
{!admin && (
  <NavLink
    to="/admin/signin"
    className={({isActive})=> isActive? 'active' : undefined }
    style={{
      background:'#f59e0b', color:'#111827',
      padding:'6px 10px', borderRadius:8, fontWeight:700
    }}
  >
    Admin sign in
  </NavLink>
)}
