import React from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import supabase from './supabase'

/* ---------------- Header (big logo + QR + Admin link) ---------------- */
function Header({ user, isAdmin }) {
  return (
    <header>
      <div className="inner">
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <img src="/logo.jpg" alt="Candy Group" style={{height:160, borderRadius:16}}/>
          <div style={{fontWeight:800, fontSize:72}}>Candy Group App</div>
        </div>
        <nav style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          <NavLink to="/dashboard" className={({isActive})=> isActive ? 'active' : undefined}>Dashboard</NavLink>
          <NavLink to="/participants" className={({isActive})=> isActive ? 'active' : undefined}>Participants</NavLink>
          <NavLink to="/attendance" className={({isActive})=> isActive ? 'active' : undefined}>Attendance</NavLink>
          <NavLink to="/register" className={({isActive})=> isActive ? 'active' : undefined}>Register</NavLink>
          <NavLink to="/my-profile" className={({isActive})=> isActive ? 'active' : undefined}>My Profile</NavLink>
          {isAdmin && (
            <NavLink to="/admin" className={({isActive})=> isActive ? 'active' : undefined}>Admin</NavLink>
          )}

          {/* QR code for current site URL */}
          <a
            href={`https://chart.googleapis.com/chart?cht=qr&chs=512x512&chld=M|0&chl=${encodeURIComponent(window.location.origin)}`}
            target="_blank" rel="noreferrer"
            style={{textDecoration:'none', padding:'6px 10px', borderRadius:8}}
          >
            QR Code
          </a>

          {/* Admin sign-in (only needed to access /admin) */}
          {user
            ? <button className="btn" onClick={()=> supabase.auth.signOut().then(()=>window.location.reload())}>Sign out</button>
            : <button className="btn" onClick={async ()=>{
                const email = prompt('Enter your admin email for a sign-in link:')
                if(!email) return
                const { error } = await supabase.auth.signInWithOtp({
                  email,
                  options: { shouldCreateUser:false, emailRedirectTo: window.location.origin }
                })
                alert(error ? error.message : 'Check your email and open the newest link in THIS browser.')
              }}>Admin sign in</button>
          }
        </nav>
      </div>
    </header>
  )
}

/* ---------------- Helpers ---------------- */
async function isAdmin() {
  const { data, error } = await supabase.rpc('is_admin')
  return !!data && !error
}

/* ---------------- Pages ---------------- */

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

  if (!user) return <div className="container"><div className="card" style={{padding:16}}>Admins only: sign in from the header (optional).</div></div>
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

function ParticipantsPage({ participants, isAdmin }) {
  return (
    <div className="container">
      <div className="card" style={{padding:16}}>
        <div style={{fontWeight:800, marginBottom:8}}>Participants</div>
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Gender</th><th>Height</th></tr></thead>
          <tbody>
            {participants.map(p=>(
              <tr key={p.id}>
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

function Dashboard({ participants }) {
  // Placeholder ranking using current fields (weigh-ins can be added later).
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

/* ---------------- Admin Page: edit & delete participants ---------------- */
function AdminPage() {
  const [user, setUser] = React.useState(null)
  const [isAdminState, setIsAdminState] = React.useState(false)
  const [rows, setRows] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [savingId, setSavingId] = React.useState(null)
  const [deletingId, setDeletingId] = React.useState(null)

  React.useEffect(()=>{
    (async ()=>{
      const { data } = await supabase.auth.getUser()
      setUser(data?.user || null)
      const adminOk = await supabase.rpc('is_admin')
      setIsAdminState(!!adminOk.data && !adminOk.error)
      setLoading(false)
    })()
  },[])

  React.useEffect(()=>{
    if (!isAdminState) return
    ;(async ()=>{
      const { data, error } = await supabase
        .from('participants')
        .select('*')
        .order('registered_at', { ascending:false })
      if (!error) setRows(data || [])
    })()
  },[isAdminState])

  async function signIn() {
    const email = prompt('Enter your admin email for a sign-in link:')
    if (!email) return
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser:false, emailRedirectTo: window.location.origin }
    })
    alert(error ? error.message : 'Check your email and open it here, then reload.')
  }

  function editLocal(id, patch) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  }

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

  if (loading) return <div className="container"><div className="card" style={{padding:16}}>Loading…</div></div>
  if (!user || !isAdminState) {
    return (
      <div className="container">
        <div className="card" style={{padding:16}}>
          <div style={{fontWeight:800, marginBottom:8}}>Admin</div>
          <p>You must be signed-in as an admin to access this page.</p>
          <button className="btn" onClick={signIn}>Sign in as admin</button>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
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
                <td><input className="input" value={r.name||''} onChange={e=>editLocal(r.id,{name:e.target.value})}/></td>
                <td><input className="input" type="email" value={r.email||''} onChange={e=>editLocal(r.id,{email:e.target.value})}/></td>
                <td><input className="input" value={r.phone||''} onChange={e=>editLocal(r.id,{phone:e.target.value})}/></td>
                <td>
                  <select className="input" value={r.gender||''} onChange={e=>editLocal(r.id,{gender:e.target.value})}>
                    <option value="">—</option><option value="male">Male</option><option value="female">Female</option>
                  </select>
                </td>
                <td><input className="input" type="number" step="0.1" value={r.height_cm||''} onChange={e=>editLocal(r.id,{height_cm:e.target.value})}/></td>
                <td><input className="input" type="number" step="0.1" value={r.start_weight_kg||''} onChange={e=>editLocal(r.id,{start_weight_kg:e.target.value})}/></td>
                <td><input className="input" type="number" step="0.1" value={r.start_waist_cm||''} onChange={e=>editLocal(r.id,{start_waist_cm:e.target.value})}/></td>
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
  )
}

/* ---------------- App root ---------------- */
export default function App(){
  const [user, setUser] = React.useState(null)
  const [participants, setParticipants] = React.useState([])
  const [admin, setAdmin] = React.useState(false)

  React.useEffect(()=>{
    supabase.auth.getUser().then(({data})=> setUser(data?.user || null))
  },[])
  React.useEffect(()=>{
    (async ()=>{
      const ok = await isAdmin(); setAdmin(ok)
      const { data: ps } = await supabase.from('participants').select('*').order('registered_at', { ascending:false })
      setParticipants(ps || [])
    })()
  },[])

  return (
    <>
      <Header user={user} isAdmin={admin} />
      <Routes>
        <Route path="/" element={<Dashboard participants={participants} />} />
        <Route path="/dashboard" element={<Dashboard participants={participants} />} />
        <Route path="/participants" element={<ParticipantsPage participants={participants} isAdmin={admin} />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/my-profile" element={<MyProfilePage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </>
  )
}
