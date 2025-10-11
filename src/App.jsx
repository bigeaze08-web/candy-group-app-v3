import React from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import supabase from './supabase'

function Header({ user }) {
  return (
    <header>
      <div className="inner">
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <img src="/logo.jpg" alt="Candy Group" style={{height:80, borderRadius:12}}/>
          <div style={{fontWeight:800, fontSize:36}}>Candy Group App</div>
        </div>
        <nav style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          <NavLink to="/dashboard" className={({isActive})=> isActive? 'active' : undefined }>Dashboard</NavLink>
          <NavLink to="/participants" className={({isActive})=> isActive? 'active' : undefined }>Participants</NavLink>
          <NavLink to="/attendance" className={({isActive})=> isActive? 'active' : undefined }>Attendance</NavLink>
          <NavLink to="/register" className={({isActive})=> isActive? 'active' : undefined }>Register</NavLink>
          <NavLink to="/my-profile" className={({isActive})=> isActive? 'active' : undefined }>My Profile</NavLink>
          {user
            ? <button className="btn" onClick={()=> supabase.auth.signOut().then(()=>window.location.reload())}>Sign out</button>
            : <button className="btn" onClick={async ()=>{
                const email = prompt('Enter your email for a sign-in link:')
                if(!email) return
                const { error } = await supabase.auth.signInWithOtp({
                  email,
                  options: { shouldCreateUser:true, emailRedirectTo: window.location.origin }
                })
                alert(error ? error.message : 'Check your email and click the newest link in THIS browser.')
              }}>Sign in</button>
          }
        </nav>
      </div>
    </header>
  )
}

async function isAdmin() {
  const { data: s } = await supabase.auth.getUser()
  const email = s?.user?.email
  if (!email) return false
  const { data, error } = await supabase.rpc('is_admin')
  return !!data && !error
}

function RegisterPage() {
  const [form, setForm] = React.useState({ name:'', phone:'', gender:'', height_cm:'', start_weight_kg:'', start_waist_cm:'' })
  const [saving, setSaving] = React.useState(false)

  async function ensureSignedIn() {
    const { data } = await supabase.auth.getUser()
    if (!data?.user) {
      const email = prompt('Enter your email to get a sign-in link:')
      if (!email) return null
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser:true, emailRedirectTo: window.location.origin }
      })
      if (error) { alert(error.message); return null }
      alert('Open the newest email link in this same browser, then return here.')
      return null
    }
    return data.user
  }

  async function submit(e){
    e.preventDefault()
    const u = await ensureSignedIn()
    if (!u) return
    setSaving(true)
    const row = {
      name: form.name,
      email: u.email,
      phone: form.phone,
      gender: form.gender,
      height_cm: form.height_cm ? Number(form.height_cm) : null,
      start_weight_kg: form.start_weight_kg ? Number(form.start_weight_kg) : null,
      start_waist_cm: form.start_waist_cm ? Number(form.start_waist_cm) : null
    }
    const { error } = await supabase.from('participants').insert(row)
    setSaving(false)
    if (error) alert(error.message)
    else window.location.href = '/my-profile'
  }

  return (
    <div className="container">
      <div className="card" style={{padding:16, maxWidth:900, margin:'12px auto'}}>
        <div style={{fontWeight:800, marginBottom:8}}>Register</div>
        <form onSubmit={submit}>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8}}>
            <input className="input" placeholder="Full name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required />
            <input className="input" placeholder="Phone" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} />
            <select className="input" value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})}>
              <option value="">— Gender —</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
            <input className="input" type="number" step="0.1" placeholder="Height (cm)" value={form.height_cm} onChange={e=>setForm({...form,height_cm:e.target.value})} />
            <input className="input" type="number" step="0.1" placeholder="Start weight (kg)" value={form.start_weight_kg} onChange={e=>setForm({...form,start_weight_kg:e.target.value})} required />
            <input className="input" type="number" step="0.1" placeholder="Start waist (cm)" value={form.start_waist_cm} onChange={e=>setForm({...form,start_waist_cm:e.target.value})} required />
          </div>
          <div style={{fontSize:12, color:'#475569', marginTop:6}}>
            You’ll receive a magic link by email to sign in. Your profile email will be your sign-in email.
          </div>
          <div style={{display:'flex', justifyContent:'flex-end', marginTop:8}}>
            <button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Create my profile'}</button>
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

  if (!user) return <div className="container"><div className="card" style={{padding:16}}>Please sign in from the top-right first.</div></div>
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

function ParticipantsPage({ participants, isAdmin }) {
  return (
    <div className="container">
      <div className="card" style={{padding:16}}>
        <div style={{fontWeight:800, marginBottom:8}}>Participants</div>
        <table>
          <thead><tr><th>Name</th><th>Phone</th><th>Gender</th><th>Height</th></tr></thead>
          <tbody>
            {participants.map(p=>(
              <tr key={p.id}>
                <td>{p.name}</td><td>{p.phone||''}</td><td>{p.gender||''}</td><td>{p.height_cm||''}</td>
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
        <div>Mon–Fri tracking (Oct 13 – Dec 5, 2025). Enter from your admin tools.</div>
      </div>
    </div>
  )
}

function Dashboard({ participants }) {
  const rows = participants.map(p => {
    const latest = [...(p.weighIns||[])].sort((a,b)=>b.date.localeCompare(a.date))[0]
    const startW = Number(p.start_weight_kg ?? 0)
    const startWaist = Number(p.start_waist_cm ?? 0)
    const curW = Number(latest?.weight_kg ?? startW)
    const curWaist = Number(latest?.waist_cm ?? startWaist)
    const lossKg = startW && curW ? (startW - curW) : 0
    const lossWaist = startWaist && curWaist ? (startWaist - curWaist) : 0
    const attendanceCount = p.attendanceDates ? p.attendanceDates.size : 0
    return { id: p.id, name: p.name, lossKg, lossWaist, attendanceCount }
  })
  function rankBy(key){ const s=[...rows].sort((a,b)=>b[key]-a[key]); const m=new Map(); s.forEach((r,i)=>m.set(r.id,i+1)); return m }
  const rW = rankBy('lossKg'), rWa = rankBy('lossWaist'), rAt = rankBy('attendanceCount')
  const scored = rows.map(r => ({
    ...r,
    score: ((rows.length - rW.get(r.id) + 1)*0.7)
         + ((rows.length - rWa.get(r.id) + 1)*0.2)
         + ((rows.length - rAt.get(r.id) + 1)*0.1)
  })).sort((a,b)=> b.score - a.score)
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
      <Header user={user} />
      <Routes>
        <Route path="/" element={<Dashboard participants={participants} />} />
        <Route path="/dashboard" element={<Dashboard participants={participants} />} />
        <Route path="/participants" element={<ParticipantsPage participants={participants} isAdmin={admin} />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/my-profile" element={<MyProfilePage />} />
      </Routes>
    </>
  )
}

