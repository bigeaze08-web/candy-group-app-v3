import { Routes, Route, NavLink } from 'react-router-dom'
import React from 'react'
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import supabase from './supabase'

/* ---------------- Small helpers ---------------- */
const LOGO_SRC = '/logo.jpg'
const FALLBACK_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160">
       <rect width="100%" height="100%" fill="#e2e8f0"/>
       <text x="50%" y="50%" font-size="22" text-anchor="middle" fill="#334155" dy=".35em">
         Image not available
       </text>
     </svg>`
  )

async function isAdmin() {
  const { data, error } = await supabase.rpc('is_admin')
  return !!data && !error
}

/* ---------------- Header (title smaller; nav below) ---------------- */
function Header({ user, isAdmin }) {
  return (
    <header style={{position:'sticky', top:0, zIndex:10, background:'rgba(241,245,249,.85)', backdropFilter:'saturate(180%) blur(8px)', borderBottom:'1px solid #e2e8f0'}}>
      <div className="inner" style={{display:'flex', alignItems:'center', gap:16, padding:'10px 16px', maxWidth:1100, margin:'0 auto'}}>
        <img
          src={LOGO_SRC}
          alt="Candy Weight Loss Challenge"
          style={{height:120, borderRadius:16}}
          onError={(e)=>{ e.currentTarget.src = FALLBACK_SVG }}
        />
        <div style={{fontWeight:800, fontSize:48, lineHeight:1.1}}>
          Candy Weight Loss Challenge
        </div>
      </div>

      {/* separate nav bar under header */}
      <div style={{borderTop:'1px solid #e2e8f0', background:'#fff'}}>
        <nav className="inner" style={{display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', padding:'8px 16px', maxWidth:1100, margin:'0 auto'}}>
          <NavLink to="/dashboard" className={({isActive})=> isActive? 'active' : undefined }>Dashboard</NavLink>
          <NavLink to="/participants" className={({isActive})=> isActive? 'active' : undefined }>Participants</NavLink>
          <NavLink to="/attendance" className={({isActive})=> isActive? 'active' : undefined }>Attendance</NavLink>
          <NavLink to="/register" className={({isActive})=> isActive? 'active' : undefined }>Register</NavLink>
          <NavLink to="/my-profile" className={({isActive})=> isActive? 'active' : undefined }>My Profile</NavLink>
          <NavLink to="/qr" className={({isActive})=> isActive? 'active' : undefined }>QR</NavLink>
          {isAdmin && <NavLink to="/admin" className={({isActive})=> isActive? 'active' : undefined }>Admin</NavLink>}

          <div style={{flex:1}} />
          {user
            ? <button className="btn" onClick={()=> supabase.auth.signOut().then(()=>window.location.reload())}>Sign out</button>
            : <NavLink to="/admin-login" className={({isActive})=> isActive? 'active' : undefined }>
                <button className="btn">Admin sign in</button>
              </NavLink>
          }
        </nav>
      </div>
    </header>
  )
}

/* ---------------- Pages ---------------- */

/* QR page renders a QR of the site URL (no external nav 404s) */
function QRPage(){
  const url = (typeof window !== 'undefined') ? window.location.origin : ''
  // QuickChart QR endpoint (no library needed)
  const qr = `https://quickchart.io/qr?text=${encodeURIComponent(url)}&size=300&margin=1`
  return (
    <div className="container">
      <div className="card" style={{padding:16, textAlign:'center'}}>
        <div style={{fontWeight:800, marginBottom:8}}>Share this app</div>
        <img src={qr} alt="QR" style={{width:240, height:240}} onError={e=>{ e.currentTarget.src = FALLBACK_SVG }} />
        <div style={{marginTop:8, fontSize:12, color:'#475569'}}>{url}</div>
      </div>
    </div>
  )
}

/* Admin login page (email/password) */
function AdminLoginPage(){
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const navigate = useNavigate()

  async function login(e){
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { alert(error.message); return }
    const ok = await isAdmin()
    if (!ok) { alert('Signed in but not an admin. Ask owner to add your email to app_admins.'); return }
    navigate('/admin')
  }

  return (
    <div className="container">
      <div className="card" style={{padding:16, maxWidth:480, margin:'12px auto'}}>
        <div style={{fontWeight:800, marginBottom:8}}>Admin sign in</div>
        <form onSubmit={login}>
          <input className="input" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required />
          <input className="input" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required />
          <div style={{display:'flex', justifyContent:'flex-end', marginTop:8}}>
            <button className="btn" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* Registration (no login required), optional email, optional photo */
function RegisterPage() {
  const [form, setForm] = React.useState({
    name:'', email:'', phone:'', gender:'', height_cm:'', start_weight_kg:'', start_waist_cm:''
  })
  const [photoFile, setPhotoFile] = React.useState(null)
  const [saving, setSaving] = React.useState(false)

  async function submit(e){
    e.preventDefault()
    setSaving(true)

    const row = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      gender: form.gender || null,
      height_cm: form.height_cm ? Number(form.height_cm) : null,
      start_weight_kg: form.start_weight_kg ? Number(form.start_weight_kg) : null,
      start_waist_cm: form.start_waist_cm ? Number(form.start_waist_cm) : null
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('participants')
      .insert(row)
      .select()
      .single()
    if (insertErr) { alert(insertErr.message); setSaving(false); return }

    if (photoFile) {
      const safe = photoFile.name.replace(/\s+/g,'_')
      const path = `participants/${inserted.id}/${Date.now()}_${safe}`
      const { error: upErr } = await supabase.storage
        .from('photos')
        .upload(path, photoFile, { cacheControl:'3600', upsert:false })
      if (!upErr) {
        const { data: pub } = await supabase.storage.from('photos').getPublicUrl(path)
        await supabase.from('photos').insert({
          participant_id: inserted.id, storage_path: path, public_url: pub.publicUrl, uploader_email: null
        })
      }
    }

    setSaving(false)
    alert('Registration complete!')
    window.location.href = '/participants'
  }

  return (
    <div className="container">
      <div className="card" style={{padding:16, maxWidth:900, margin:'12px auto'}}>
        <div style={{fontWeight:800, marginBottom:8}}>Register</div>
        <form onSubmit={submit}>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8}}>
            <input className="input" placeholder="Full name" value={form.name}
              onChange={e=>setForm({...form,name:e.target.value})} required />
            <input className="input" type="email" placeholder="Email (optional)" value={form.email}
              onChange={e=>setForm({...form,email:e.target.value})} />
            <input className="input" placeholder="Phone" value={form.phone}
              onChange={e=>setForm({...form,phone:e.target.value})} />
            <select className="input" value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})}>
              <option value="">— Gender —</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
            <input className="input" type="number" step="0.1" placeholder="Height (cm)"
              value={form.height_cm} onChange={e=>setForm({...form,height_cm:e.target.value})} />
            <input className="input" type="number" step="0.1" placeholder="Start weight (kg)"
              value={form.start_weight_kg} onChange={e=>setForm({...form,start_weight_kg:e.target.value})} required />
            <input className="input" type="number" step="0.1" placeholder="Start waist (cm)"
              value={form.start_waist_cm} onChange={e=>setForm({...form,start_waist_cm:e.target.value})} required />

            {/* Photo at registration */}
            <div style={{gridColumn:'1 / -1'}}>
              <div style={{fontWeight:600, margin:'4px 0'}}>Upload / Take a photo</div>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={e=> setPhotoFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>

          <div style={{fontSize:12, color:'#475569', marginTop:6}}>
            Your details will be saved instantly. Admins will handle weigh-ins & attendance.
          </div>

          <div style={{display:'flex', justifyContent:'flex-end', marginTop:8}}>
            <button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Register now'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* My Profile (optional for admins; read-only email) */
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

  if (!user) return <div className="container"><div className="card" style={{padding:16}}>Admins can sign in from the header to link a profile.</div></div>
  if (!p) return <div className="container"><div className="card" style={{padding:16}}>No profile found for your email.</div></div>

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

/* Participants with photo thumbnail */
function ParticipantsPage({ participants, isAdmin, latestPhotoByPid }) {
  return (
    <div className="container">
      <div className="card" style={{padding:16}}>
        <div style={{fontWeight:800, marginBottom:8}}>Participants</div>
        <table>
          <thead><tr><th>Photo</th><th>Name</th><th>Email</th><th>Phone</th><th>Gender</th><th>Height</th></tr></thead>
          <tbody>
            {participants.map(p=>(
              <tr key={p.id}>
                <td>
                  {latestPhotoByPid[p.id]
                    ? <img src={latestPhotoByPid[p.id]} alt=""
                        style={{width:54, height:54, objectFit:'cover', borderRadius:8}}
                        onError={(e)=>{ e.currentTarget.src = FALLBACK_SVG }} />
                    : <img src={FALLBACK_SVG} alt="" style={{width:54, height:54, objectFit:'cover', borderRadius:8}}/>
                  }
                </td>
                <td>{p.name}</td>
                <td>{p.email||''}</td>
                <td>{p.phone||''}</td>
                <td>{p.gender||''}</td>
                <td>{p.height_cm||''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isAdmin && <div style={{marginTop:10, fontSize:12, color:'#475569'}}>Weigh-ins, waist, and attendance are admin-entered.</div>}
      </div>
    </div>
  )
}

/* Attendance placeholder (we can extend later) */
function AttendancePage() {
  return (
    <div className="container">
      <div className="card" style={{padding:16}}>
        <div style={{fontWeight:800, marginBottom:8}}>Attendance (admin)</div>
        <div>Mon–Fri tracking. Admin tools to record attendance can be added next.</div>
      </div>
    </div>
  )
}

/* Dashboard simple table (we can enhance with weigh-ins data later) */
function Dashboard({ participants }) {
  const rows = participants.map(p => ({
    id: p.id, name: p.name, lossKg: 0, lossWaist: 0, attendanceCount: 0
  }))
  const scored = rows.map((r,i)=>({...r, score: rows.length - i}))
  return (
    <div className="container">
      <div className="card" style={{padding:16}}>
        <div style={{fontWeight:700, marginBottom:8}}>Dashboard — Leaderboard</div>
        <table>
          <thead><tr><th>Rank</th><th>Name</th><th>Kg lost</th><th>Waist cm lost</th><th>Attendance</th></tr></thead>
          <tbody>{scored.map((r,i)=>(
            <tr key={r.id}><td>{i+1}</td><td>{r.name}</td><td>{r.lossKg.toFixed(1)}</td><td>{r.lossWaist.toFixed(1)}</td><td>{r.attendanceCount}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}

/* Admin Page: edit/delete + add weigh-ins */
function AdminPage() {
  const [user, setUser] = React.useState(null)
  const [isAdminState, setIsAdminState] = React.useState(false)
  const [rows, setRows] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [savingId, setSavingId] = React.useState(null)
  const [deletingId, setDeletingId] = React.useState(null)

  // weigh-in new entry state
  const [wi, setWi] = React.useState({ participant_id:'', date:'', weight_kg:'', waist_cm:'' })
  const [wiSaving, setWiSaving] = React.useState(false)

  React.useEffect(()=>{
    (async ()=>{
      const { data } = await supabase.auth.getUser()
      setUser(data?.user || null)
      const adminOk = await supabase.rpc('is_admin')
      setIsAdminState(!!adminOk.data && !adminOk.error)
      setLoading(false)
    })()
  },[])

  async function loadParticipants(){
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .order('registered_at', { ascending:false })
    if (!error) setRows(data || [])
  }

  React.useEffect(()=>{
    if (!isAdminState) return
    loadParticipants()
  },[isAdminState])

  async function saveRow(r) {
    setSavingId(r.id)
    const { error } = await supabase
      .from('participants')
      .update({
        name: r.name, email: r.email, phone: r.phone, gender: r.gender,
        height_cm: r.height_cm, start_weight_kg: r.start_weight_kg, start_waist_cm: r.start_waist_cm
      })
      .eq('id', r.id)
    setSavingId(null)
    if (error) alert(error.message)
  }

  async function deleteRow(id) {
    if (!confirm('Delete this participant? This cannot be undone.')) return
    setDeletingId(id)
    const { error } = await supabase.from('participants').delete().eq('id', id)
    setDeletingId(null)
    if (error) alert(error.message)
    else setRows(prev => prev.filter(r => r.id !== id))
  }

  async function addWeighIn(e){
    e.preventDefault()
    if (!wi.participant_id) { alert('Choose a participant'); return }
    if (!wi.date) { alert('Choose a date'); return }
    setWiSaving(true)
    const payload = {
      participant_id: wi.participant_id,
      date: wi.date,
      weight_kg: wi.weight_kg ? Number(wi.weight_kg) : null,
      waist_cm: wi.waist_cm ? Number(wi.waist_cm) : null
    }
    const { error } = await supabase.from('weigh_ins').insert(payload)
    setWiSaving(false)
    if (error) { alert(error.message); return }
    alert('Weigh-in saved!')
    setWi({ participant_id:'', date:'', weight_kg:'', waist_cm:'' })
  }

  if (loading) return <div className="container"><div className="card" style={{padding:16}}>Loading…</div></div>
  if (!user || !isAdminState) {
    return (
      <div className="container">
        <div className="card" style={{padding:16}}>
          <div style={{fontWeight:800, marginBottom:8}}>Admin</div>
          <p>You must be signed-in as an admin to access this page.</p>
          <NavLink to="/admin-login"><button className="btn">Go to admin login</button></NavLink>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="card" style={{padding:16, marginBottom:12}}>
        <div style={{fontWeight:800, marginBottom:8}}>Add Weigh-in (Mon/Fri or any date)</div>
        <form onSubmit={addWeighIn} style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', gap:8}}>
          <select className="input" value={wi.participant_id} onChange={e=>setWi({...wi, participant_id:e.target.value})} required>
            <option value="">— Select participant —</option>
            {rows.map(r=> <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <input className="input" type="date" value={wi.date} onChange={e=>setWi({...wi, date:e.target.value})} required />
          <input className="input" type="number" step="0.1" placeholder="Weight (kg)" value={wi.weight_kg} onChange={e=>setWi({...wi, weight_kg:e.target.value})} required />
          <input className="input" type="number" step="0.1" placeholder="Waist (cm)" value={wi.waist_cm} onChange={e=>setWi({...wi, waist_cm:e.target.value})} required />
          <button className="btn" disabled={wiSaving}>{wiSaving ? 'Saving…' : 'Save weigh-in'}</button>
        </form>
        <div style={{fontSize:12, color:'#475569', marginTop:6}}>
          Tip: Only admins can create/update data. RLS protects weigh-ins from non-admin edits.
        </div>
      </div>

      <div className="card" style={{padding:16}}>
        <div style={{fontWeight:800, marginBottom:8}}>Admin — Participants</div>
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Email</th><th>Phone</th><th>Gender</th>
              <th>Height</th><th>Start kg</th><th>Start waist</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r=>(
              <tr key={r.id}>
                <td><input className="input" value={r.name||''} onChange={e=>setRows(prev=>prev.map(x=>x.id===r.id?{...x,name:e.target.value}:x))}/></td>
                <td><input className="input" type="email" value={r.email||''} onChange={e=>setRows(prev=>prev.map(x=>x.id===r.id?{...x,email:e.target.value}:x))}/></td>
                <td><input className="input" value={r.phone||''} onChange={e=>setRows(prev=>prev.map(x=>x.id===r.id?{...x,phone:e.target.value}:x))}/></td>
                <td>
                  <select className="input" value={r.gender||''} onChange={e=>setRows(prev=>prev.map(x=>x.id===r.id?{...x,gender:e.target.value}:x))}>
                    <option value="">—</option><option value="male">Male</option><option value="female">Female</option>
                  </select>
                </td>
                <td><input className="input" type="number" step="0.1" value={r.height_cm||''} onChange={e=>setRows(prev=>prev.map(x=>x.id===r.id?{...x,height_cm:e.target.value}:x))}/></td>
                <td><input className="input" type="number" step="0.1" value={r.start_weight_kg||''} onChange={e=>setRows(prev=>prev.map(x=>x.id===r.id?{...x,start_weight_kg:e.target.value}:x))}/></td>
                <td><input className="input" type="number" step="0.1" value={r.start_waist_cm||''} onChange={e=>setRows(prev=>prev.map(x=>x.id===r.id?{...x,start_waist_cm:e.target.value}:x))}/></td>
                <td style={{whiteSpace:'nowrap'}}>
                  <button className="btn" disabled={savingId===r.id} onClick={()=>saveRow(r)}>{savingId===r.id?'Saving…':'Save'}</button>
                  <span style={{display:'inline-block', width:8}}/>
                  <button className="btn" disabled={deletingId===r.id} onClick={()=>deleteRow(r.id)}>{deletingId===r.id?'Deleting…':'Delete'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{marginTop:10, fontSize:12, color:'#475569'}}>Only admins can edit or delete participants.</div>
      </div>
    </div>
    {isAdmin && <NavLink to="/admin/attendance" className={({isActive})=> isActive? 'active' : undefined }>Attendance</NavLink>}

  )
}

/* ---------------- App root: fetch participants + latest photos ---------------- */
export default function App(){
  const [user, setUser] = React.useState(null)
  const [participants, setParticipants] = React.useState([])
  const [admin, setAdmin] = React.useState(false)
  const [latestPhotoByPid, setLatestPhotoByPid] = React.useState({})

  React.useEffect(()=>{
    supabase.auth.getUser().then(({data})=> setUser(data?.user || null))
  },[])
  React.useEffect(()=>{
    (async ()=>{
      const ok = await isAdmin(); setAdmin(ok)

      const { data: ps } = await supabase
        .from('participants')
        .select('*')
        .order('registered_at', { ascending:false })
      setParticipants(ps || [])

      const { data: ph } = await supabase
        .from('photos')
        .select('participant_id, public_url, inserted_at')
        .order('inserted_at', { ascending:false })

      const map = {}
      ;(ph || []).forEach(row=>{
        if (!map[row.participant_id]) map[row.participant_id] = row.public_url
      })
      setLatestPhotoByPid(map)
    })()
  },[])

  return (
    <>
      <Header user={user} isAdmin={admin} />
      <Routes>
        <Route path="/" element={<Dashboard participants={participants} />} />
        <Route path="/dashboard" element={<Dashboard participants={participants} />} />
        <Route path="/participants" element={<ParticipantsPage participants={participants} isAdmin={admin} latestPhotoByPid={latestPhotoByPid} />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/my-profile" element={<MyProfilePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin-login" element={<AdminLoginPage />} />
        <Route path="/admin/attendance" element={<AttendanceAdminPage />} />
        <Route path="/qr" element={<QRPage />} />
      </Routes>
    </>
  )
}
function AttendanceAdminPage(){
  const [ok, setOk] = React.useState(false)
  const [parts, setParts] = React.useState([])
  const [date, setDate] = React.useState('')
  const [present, setPresent] = React.useState({})
  const [saving, setSaving] = React.useState(false)
  const min='2025-10-13', max='2025-12-05'

  React.useEffect(()=>{ (async ()=>{
    const admin = await isAdmin(); setOk(admin)
    const { data: ps } = await supabase.from('participants').select('id,name').order('name')
    setParts(ps || [])
  })() },[])

  function isWeekday(iso){ const d=new Date(iso+'T00:00:00'); const w=d.getUTCDay(); return w>=1&&w<=5 }
  function markAll(v){ const m={}; parts.forEach(p=>m[p.id]=v); setPresent(m) }

  async function save(e){
    e.preventDefault()
    if(!date) return alert('Pick a date')
    if(!isWeekday(date)) return alert('Attendance is Mon–Fri only')
    const rows = parts.filter(p=>present[p.id]).map(p=>({participant_id:p.id,date, present:true}))
    if(rows.length===0) return alert('No one marked present')

    setSaving(true)
    const { error } = await supabase.from('attendance').insert(rows)
    setSaving(false)
    if(error) return alert(error.message)
    alert('Attendance saved')
    setPresent({})
  }

  if(!ok) return <BlockedAdmin />  // show your existing "not admin" component

  return (
    <div className="container">
      <div className="card" style={{padding:16}}>
        <div style={{fontWeight:800, marginBottom:8}}>Attendance (Mon–Fri, Oct 13 – Dec 5, 2025)</div>
        <div style={{display:'flex',gap:8,marginBottom:8}}>
          <input className="input" type="date" min={min} max={max} value={date} onChange={e=>setDate(e.target.value)} />
          <button className="btn" onClick={()=>markAll(true)}>Mark all present</button>
          <button className="btn" onClick={()=>markAll(false)}>Clear all</button>
        </div>
        <form onSubmit={save}>
          <table>
            <thead><tr><th>Present</th><th>Name</th></tr></thead>
            <tbody>
              {parts.map(p=>(
                <tr key={p.id}>
                  <td><input type="checkbox" checked={!!present[p.id]} onChange={e=>setPresent(prev=>({...prev,[p.id]:e.target.checked}))} /></td>
                  <td>{p.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{display:'flex',justifyContent:'flex-end',marginTop:8}}>
            <button className="btn" disabled={saving}>{saving?'Saving…':'Save attendance'}</button>
          </div>
        </form>
      </div>
    </div>
    {admin && <NavLink to="/admin/attendance">Attendance</NavLink>}

  )
}
function AttendanceAdminPage(){
  const [ok, setOk] = React.useState(false)
  const [parts, setParts] = React.useState([])
  const [date, setDate] = React.useState('')
  const [checks, setChecks] = React.useState({})
  const [saving, setSaving] = React.useState(false)
  const min='2025-10-13', max='2025-12-05'

  React.useEffect(()=>{ (async ()=>{
    // confirm admin
    const { data } = await supabase.auth.getUser()
    if (!data?.user) { setOk(false); return }
    const { data: isadm } = await supabase.rpc('is_admin') // if you have it; else inline check below
    const admin = !!isadm
    setOk(admin)

    // load participants
    const { data: ps } = await supabase.from('participants').select('id,name').order('name')
    setParts(ps || [])
  })() },[])

  function markAll(v){ const m={}; parts.forEach(p=>m[p.id]=v); setChecks(m) }
  function toggle(id){ setChecks(prev=> ({...prev, [id]: !prev[id]})) }

  async function save(e){
    e.preventDefault()
    if(!date) return alert('Pick a date')
    const ids = parts.filter(p=>checks[p.id]).map(p=>p.id)
    if(ids.length===0) return alert('No one marked present')

    setSaving(true)
    const { error, data } = await supabase.rpc('mark_attendance', { d: date, ids })
    setSaving(false)
    if(error) return alert(error.message)
    alert(`Attendance saved for ${data} participant(s).`)
    setChecks({})
  }

  if(!ok) return <div className="container"><div className="card" style={{padding:16}}>Admins only. Use Admin sign in.</div></div>

  return (
    <div className="container">
      <div className="card" style={{padding:16}}>
        <div style={{fontWeight:800, marginBottom:8}}>Attendance (Mon–Fri, Oct 13 – Dec 5, 2025)</div>
        <div style={{display:'flex',gap:8,marginBottom:8}}>
          <input className="input" type="date" min={min} max={max} value={date} onChange={e=>setDate(e.target.value)} />
          <button className="btn" onClick={()=>markAll(true)}>Mark all present</button>
          <button className="btn" onClick={()=>markAll(false)}>Clear all</button>
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
// inside <Routes>
<Route path="/admin/attendance" element={<AttendanceAdminPage />} />

// in your header, when admin === true
{isAdmin && <NavLink to="/admin/attendance" className={({isActive})=> isActive? 'active' : undefined }>Attendance</NavLink>}

