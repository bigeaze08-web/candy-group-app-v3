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
          <Link to="/register">Register</Link>
          {admin && <Link to="/admin/attendance">Attendance</Link>}
          {admin && <Link to="/admin/weighins">Weigh-Ins</Link>}
          {user
            ? <button className="btn" onClick={()=> supabase.auth.signOut().then(()=>window.location.reload())}>Sign out</button>
            : <button className="btn" onClick={async ()=>{
                const email = prompt('Admin/participant email:')
                const password = prompt('Password:')
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

/* ---------------- Helpers ---------------- */
async function uploadToPhotos(participantId, file){
  if(!file) return null
  const safe = file.name.replace(/\s+/g,'_')
  const path = `participants/${participantId}/${Date.now()}_${safe}`
  const { error: upErr } = await supabase.storage
    .from('photos')
    .upload(path, file, { upsert:true, cacheControl:'3600', contentType:file.type })
  if (upErr) throw new Error(upErr.message)
  const { data: pub } = await supabase.storage.from('photos').getPublicUrl(path)
  if(!pub?.publicUrl) throw new Error('No public URL')
  const { error: updErr } = await supabase.from('participants')
    .update({ photo_url: pub.publicUrl })
    .eq('id', participantId)
  if (updErr) throw new Error(updErr.message)
  return pub.publicUrl
}

/* ---------------- Register (with photo) ---------------- */
function RegisterPage(){
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [form, setForm] = React.useState({
    name:'', phone:'', gender:'', height_cm:'', start_weight_kg:'', start_waist_cm:''
  })
  const [photo, setPhoto] = React.useState(null)
  const [busy, setBusy] = React.useState(false)
  const navigate = useNavigate()

  async function ensureSignedIn(email, password){
    const { data: sess } = await supabase.auth.getSession()
    if(sess?.session) return sess.session.user
    // try sign-up; if user exists, sign-in
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email, password, options: { emailRedirectTo: window.location.origin }
    })
    if (!signUpErr && signUpData?.user) {
      // if email confirmation is on, user may need to confirm; but we continue (session is present)
      return signUpData.user
    }
    // fallback: sign-in
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
    if (signInErr) throw new Error(signInErr.message)
    return signInData.user
  }

  async function onSubmit(e){
    e.preventDefault()
    if(!email || !password) return alert('Email and password are required')
    if(!form.name) return alert('Please enter your full name')
    setBusy(true)
    try {
      const user = await ensureSignedIn(email, password)

      // create participant row (if not exists)
      const row = {
        name: form.name,
        email: email,
        phone: form.phone || null,
        gender: form.gender || null,
        height_cm: form.height_cm ? Number(form.height_cm) : null,
        start_weight_kg: form.start_weight_kg ? Number(form.start_weight_kg) : null,
        start_waist_cm: form.start_waist_cm ? Number(form.start_waist_cm) : null
      }
      // upsert by email
      const { data: existing } = await supabase.from('participants')
        .select('id').eq('email', email).limit(1)
      let pid = existing?.[0]?.id
      if(!pid){
        const { data: ins, error: insErr } = await supabase.from('participants').insert(row).select('id').single()
        if (insErr) throw new Error(insErr.message)
        pid = ins.id
      } else {
        await supabase.from('participants').update(row).eq('id', pid)
      }

      // upload photo (optional)
      if (photo) {
        await uploadToPhotos(pid, photo)
      }

      alert('Registered successfully!')
      navigate('/participants')
    } catch(err){
      alert(err.message || 'Failed to register')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container">
      <div className="card">
        <div style={{fontWeight:800, marginBottom:8}}>Register</div>
        <form onSubmit={onSubmit}>
          <div className="rowgrid">
            <div>
              <div style={{fontWeight:700, marginBottom:6}}>Account</div>
              <input className="input" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required />
              <input className="input" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required />
              <div style={{fontSize:12, color:'#475569'}}>Use an email you can access; you’ll use this to sign in.</div>
            </div>
            <div>
              <div style={{fontWeight:700, marginBottom:6}}>Profile</div>
              <input className="input" placeholder="Full name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required />
              <input className="input" placeholder="Phone" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} />
              <select className="input" value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})}>
                <option value="">— Gender —</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              <input className="input" type="number" step="0.1" placeholder="Height (cm)" value={form.height_cm} onChange={e=>setForm({...form,height_cm:e.target.value})} />
            </div>
            <div>
              <div style={{fontWeight:700, marginBottom:6}}>Starting measurements</div>
              <input className="input" type="number" step="0.1" placeholder="Start weight (kg)" value={form.start_weight_kg} onChange={e=>setForm({...form,start_weight_kg:e.target.value})} />
              <input className="input" type="number" step="0.1" placeholder="Start waist (cm)" value={form.start_waist_cm} onChange={e=>setForm({...form,start_waist_cm:e.target.value})} />
              <div style={{fontWeight:700, margin:'8px 0 4px'}}>Photo</div>
              <input className="input" type="file" accept="image/*" capture="environment" onChange={e=> setPhoto(e.target.files?.[0] || null) } />
              <div style={{fontSize:12, color:'#475569'}}>Attach a clear face/body photo for your profile.</div>
            </div>
          </div>
          <div style={{display:'flex',justifyContent:'flex-end',marginTop:8}}>
            <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Register now'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ---------------- Dashboard (70/20/10) ---------------- */
function Dashboard(){
  const [rows, setRows] = React.useState([])

  React.useEffect(()=>{
    (async ()=>{
      // 1) Base participant info
      const { data: ps, error: pErr } = await supabase
        .from('participants')
        .select('id,name,start_weight_kg,start_waist_cm')
        .order('name')
      if (pErr) { console.error(pErr); setRows([]); return }

      // 2) Latest weigh-in per participant
      // Try view first (if you created it), else compute from weigh_ins table
      let latest = []
      const v = await supabase.from('latest_weighin_per_participant')
        .select('participant_id,date,weight_kg,waist_cm')
      if (!v.error && v.data) {
        latest = v.data
      } else {
        const { data: allWi, error: wiErr } = await supabase
          .from('weigh_ins')
          .select('participant_id,date,weight_kg,waist_cm')
        if (wiErr) { console.error(wiErr); }
        const m = new Map()
        ;(allWi||[]).forEach(w=>{
          const prev = m.get(w.participant_id)
          if (!prev || w.date > prev.date) m.set(w.participant_id, w)
        })
        latest = Array.from(m.values())
      }

      // 3) Attendance in the challenge window
      const { data: att, error: aErr } = await supabase
        .from('attendance')
        .select('participant_id,date')
        .gte('date','2025-10-13')
        .lte('date','2025-12-05')
      if (aErr) { console.error(aErr) }

      const attCountByPid = {}
      ;(att||[]).forEach(a=>{
        attCountByPid[a.participant_id] = (attCountByPid[a.participant_id]||0) + 1
      })

      const latestByPid = {}
      ;(latest||[]).forEach(l => { latestByPid[l.participant_id] = l })

      // 4) Compute losses
      const computed = (ps||[]).map(p=>{
        const startW = Number(p.start_weight_kg || 0)
        const startWa = Number(p.start_waist_cm || 0)
        const l = latestByPid[p.id]
        const curW = Number(l?.weight_kg ?? startW)
        const curWa = Number(l?.waist_cm ?? startWa)
        const lossKg = Math.max(0, (startW && curW) ? (startW - curW) : 0)
        const lossWa = Math.max(0, (startWa && curWa) ? (startWa - curWa) : 0)
        const attendance = attCountByPid[p.id] || 0
        return { id:p.id, name:p.name, lossKg, lossWa, attendance }
      })

      // 5) Normalize by maxima (avoid divide-by-zero)
      const maxKg   = Math.max(1, ...computed.map(r => r.lossKg))
      const maxWa   = Math.max(1, ...computed.map(r => r.lossWa))
      const maxAtt  = Math.max(1, ...computed.map(r => r.attendance))

      const withScore = computed.map(r => ({
        ...r,
        score: 0.7*(r.lossKg / maxKg) + 0.2*(r.lossWa / maxWa) + 0.1*(r.attendance / maxAtt)
      }))

      // 6) Sort by score desc, then tiebreakers
      withScore.sort((a,b)=>{
        if (b.score !== a.score) return b.score - a.score
        if (b.lossKg !== a.lossKg) return b.lossKg - a.lossKg
        if (b.lossWa !== a.lossWa) return b.lossWa - a.lossWa
        if (b.attendance !== a.attendance) return b.attendance - a.attendance
        return a.name.localeCompare(b.name)
      })

      setRows(withScore)
    })()
  },[])

  return (
    <div className="container">
      <div className="card">
        <div style={{fontWeight:800, marginBottom:8}}>Dashboard — Leaderboard</div>
        <table>
          <thead>
            <tr>
              <th>Rank</th><th>Name</th><th>Kg lost</th><th>Waist cm lost</th><th>Attendance</th><th>Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r,i)=>(
              <tr key={r.id}>
                <td>{i+1}</td>
                <td>{r.name}</td>
                <td>{r.lossKg.toFixed(1)}</td>
                <td>{r.lossWa.toFixed(1)}</td>
                <td>{r.attendance}</td>
                <td>{(r.score*100).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


/* ---------------- Participants (thumbnails + ADMIN inline edit) ---------------- */
function ParticipantsPage(){
  const [ps, setPs] = React.useState([])
  const [admin, setAdmin] = React.useState(false)
  const [savingId, setSavingId] = React.useState(null)

  React.useEffect(()=>{
    ;(async ()=>{
      try { const { data } = await supabase.rpc('is_admin'); setAdmin(!!data) } catch { setAdmin(false) }
      const { data: rows } = await supabase
        .from('participants')
        .select('id,name,email,phone,gender,start_weight_kg,start_waist_cm,photo_url')
        .order('registered_at',{ascending:false})
      setPs(rows||[])
    })()
  },[])

  function setField(id, key, value){
    setPs(prev => prev.map(x => x.id===id ? ({...x, [key]: value}) : x))
  }

  async function onUpload(p, file){
    if (!file) return
    try{
      const url = await uploadToPhotos(p.id, file)
      setPs(prev => prev.map(x => x.id===p.id ? { ...x, photo_url: url } : x))
      alert('Photo uploaded!')
    }catch(err){
      alert(err.message || 'Failed to upload')
    }
  }

  async function saveRow(p){
    setSavingId(p.id)
    const { error } = await supabase.from('participants').update({
      email: p.email, phone: p.phone, start_weight_kg: p.start_weight_kg ? Number(p.start_weight_kg) : null,
      start_waist_cm: p.start_waist_cm ? Number(p.start_waist_cm) : null
    }).eq('id', p.id)
    setSavingId(null)
    if(error) alert(error.message); else alert('Saved!')
  }

  return (
    <div className="container">
      <div className="card">
        <div style={{fontWeight:800, marginBottom:8}}>Participants</div>
        <table>
          <thead>
            <tr>
              <th>Photo</th><th>Name</th><th>Email</th><th>Phone</th><th>Gender</th>
              <th>Start weight (kg)</th><th>Start waist (cm)</th>{admin && <th>Upload</th>}{admin && <th>Save</th>}
            </tr>
          </thead>
          <tbody>
            {ps.map(p=>(
              <tr key={p.id}>
                <td>{p.photo_url
                  ? <img src={p.photo_url} alt={p.name} className="thumb"/>
                  : <div className="thumb" style={{display:'flex',alignItems:'center',justifyContent:'center',color:'#475569',fontSize:12}}>No photo</div>}
                </td>
                <td>{p.name}</td>
                <td>{admin ? <input className="input" value={p.email||''} onChange={e=>setField(p.id,'email',e.target.value)} /> : (p.email||'')}</td>
                <td>{admin ? <input className="input" value={p.phone||''} onChange={e=>setField(p.id,'phone',e.target.value)} /> : (p.phone||'')}</td>
                <td>{p.gender||''}</td>
                <td>{admin ? <input className="input" type="number" step="0.1" value={p.start_weight_kg??''} onChange={e=>setField(p.id,'start_weight_kg',e.target.value)} /> : (p.start_weight_kg??'')}</td>
                <td>{admin ? <input className="input" type="number" step="0.1" value={p.start_waist_cm??''} onChange={e=>setField(p.id,'start_waist_cm',e.target.value)} /> : (p.start_waist_cm??'')}</td>
                {admin && <td><input type="file" accept="image/*" onChange={e=> onUpload(p, e.target.files?.[0]) } /></td>}
                {admin && <td><button className="btn" disabled={savingId===p.id} onClick={()=>saveRow(p)}>{savingId===p.id?'Saving…':'Save'}</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
        {!admin && <div style={{marginTop:8,fontSize:12,color:'#475569'}}>Only admins can edit or upload photos here.</div>}
      </div>
    </div>
  )
}

/* ---------------- Admin: Attendance (Mon–Fri) ---------------- */
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
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/admin/attendance" element={<AttendanceAdminPage />} />
        <Route path="/admin/weighins" element={<WeighInsAdminPage />} />
        <Route path="*" element={<div className="container"><div className="card">Page not found.</div></div>} />
      </Routes>
    </>
  )
}
