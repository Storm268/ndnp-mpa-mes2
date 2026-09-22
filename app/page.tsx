import { createClient } from '@/lib/supabase/server'
import { ROLE_HOME } from '@/lib/supabase/client'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const home = profile?.role ? ROLE_HOME[profile.role as keyof typeof ROLE_HOME] : '/dashboard/operational'
    redirect(home || '/dashboard/operational')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ocean-deep)', color: 'var(--text-primary)', fontFamily: 'var(--font-jakarta)' }}>
      {/* Nav */}
      <nav style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(2,11,20,0.9)', backdropFilter: 'blur(12px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #00bcd4, #0077a8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064"/></svg>
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff', letterSpacing: '-0.2px' }}>NDNP Marine Park</div>
            <div style={{ fontSize: '10px', color: '#5a7d94', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Caribbean Protected Area</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Link href="/report" style={{ padding: '8px 16px', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '8px', color: '#f87171', fontSize: '13px', fontWeight: '600', textDecoration: 'none', background: 'rgba(239,68,68,0.08)' }}>
            Report Incident
          </Link>
          <Link href="/register" style={{ padding: '8px 16px', border: '1px solid rgba(0,188,212,0.4)', borderRadius: '8px', color: '#00bcd4', fontSize: '13px', fontWeight: '600', textDecoration: 'none', background: 'rgba(0,188,212,0.08)' }}>
            Register
          </Link>
          <Link href="/login" style={{ padding: '8px 16px', borderRadius: '8px', color: '#7aa3be', fontSize: '13px', fontWeight: '500', textDecoration: 'none' }}>
            Staff Login
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: '80px 32px 60px', textAlign: 'center', maxWidth: '900px', margin: '0 auto', position: 'relative' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '20px', background: 'rgba(0,188,212,0.1)', border: '1px solid rgba(0,188,212,0.25)', marginBottom: '24px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse 2s infinite' }}></span>
          <span style={{ fontSize: '12px', color: '#00bcd4', fontWeight: '600', letterSpacing: '0.5px' }}>PROTECTED MARINE AREA — OPEN TO VISITORS</span>
        </div>
        <h1 style={{ fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: '800', color: '#fff', lineHeight: '1.1', marginBottom: '20px', letterSpacing: '-1px' }}>
          Welcome to the<br />
          <span style={{ background: 'linear-gradient(135deg, #00bcd4, #0077a8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Caribbean Marine Reserve</span>
        </h1>
        <p style={{ fontSize: '18px', color: '#7aa3be', lineHeight: '1.7', marginBottom: '40px', maxWidth: '640px', margin: '0 auto 40px' }}>
          The National Designated Natural Park protects over 120km² of pristine Caribbean marine ecosystems.
          Register as a citizen to report environmental threats and help protect our ocean.
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/register" style={{ padding: '14px 32px', background: 'linear-gradient(135deg, #00bcd4, #0077a8)', borderRadius: '10px', color: '#fff', fontSize: '15px', fontWeight: '700', textDecoration: 'none', boxShadow: '0 4px 20px rgba(0,188,212,0.35)' }}>
            Register as Citizen
          </Link>
          <Link href="/report" style={{ padding: '14px 32px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#e2f0f9', fontSize: '15px', fontWeight: '600', textDecoration: 'none' }}>
            Report an Incident
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section style={{ padding: '40px 32px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
          {[
            { value: '120km²', label: 'Protected Area', color: '#00bcd4' },
            { value: '6', label: 'Monitoring Stations', color: '#10b981' },
            { value: '4', label: 'Marine Zones', color: '#f59e0b' },
            { value: '24/7', label: 'Ranger Patrols', color: '#8b5cf6' },
          ].map((s) => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: '800', color: s.color, marginBottom: '6px', fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
              <div style={{ fontSize: '12px', color: '#5a7d94', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Park Overview */}
      <section style={{ padding: '60px 32px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#00bcd4', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>About the Park</div>
            <h2 style={{ fontSize: '26px', fontWeight: '700', color: '#fff', marginBottom: '16px', letterSpacing: '-0.3px' }}>A Living Coral Sanctuary</h2>
            <p style={{ fontSize: '14px', color: '#7aa3be', lineHeight: '1.8', marginBottom: '16px' }}>
              The NDNP MPA encompasses four distinct marine zones protecting critical habitats including
              coral reefs, seagrass beds, mangrove forests, and open water ecosystems.
            </p>
            <p style={{ fontSize: '14px', color: '#7aa3be', lineHeight: '1.8' }}>
              Our team of marine scientists, park rangers, and heritage officers work year-round
              to monitor, protect, and restore these vital Caribbean ecosystems.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              { name: 'Coral Reef Zone', type: 'Core Zone', color: '#ef4444' },
              { name: 'Seagrass Beds', type: 'Buffer Zone', color: '#f59e0b' },
              { name: 'Mangrove Coast', type: 'Heritage Zone', color: '#10b981' },
              { name: 'Open Water', type: 'Transition Zone', color: '#00bcd4' },
            ].map((z) => (
              <div key={z.name} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '14px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: z.color, marginBottom: '8px' }}></div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#e2f0f9', marginBottom: '3px' }}>{z.name}</div>
                <div style={{ fontSize: '11px', color: '#5a7d94' }}>{z.type}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How to Report */}
      <section style={{ padding: '60px 32px', background: 'rgba(239,68,68,0.04)', borderTop: '1px solid rgba(239,68,68,0.1)', borderBottom: '1px solid rgba(239,68,68,0.1)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#f87171', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Report an Incident</div>
          <h2 style={{ fontSize: '26px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>See Something? Report It.</h2>
          <p style={{ fontSize: '14px', color: '#7aa3be', lineHeight: '1.8', marginBottom: '32px', maxWidth: '560px' }}>
            You don't need an account to report environmental threats. All reports are reviewed
            by our ranger team within 24 hours. Provide as much detail as possible.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            {[
              { icon: '🪸', label: 'Coral Damage', desc: 'Bleaching, breakage, anchor damage' },
              { icon: '🐟', label: 'Illegal Fishing', desc: 'Poaching, unlicensed nets, dynamite' },
              { icon: '🗑️', label: 'Pollution', desc: 'Oil spills, plastic dumping, runoff' },
              { icon: '⚠️', label: 'Other Threats', desc: 'Boats, dive violations, disturbance' },
            ].map((item) => (
              <div key={item.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>{item.icon}</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#e2f0f9', marginBottom: '4px' }}>{item.label}</div>
                <div style={{ fontSize: '12px', color: '#5a7d94' }}>{item.desc}</div>
              </div>
            ))}
          </div>
          <Link href="/report" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 28px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '10px', color: '#f87171', fontSize: '14px', fontWeight: '700', textDecoration: 'none' }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            Submit Anonymous Report
          </Link>
        </div>
      </section>

      {/* Register as Citizen */}
      <section style={{ padding: '60px 32px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', color: '#10b981', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Citizen Registration</div>
        <h2 style={{ fontSize: '26px', fontWeight: '700', color: '#fff', marginBottom: '16px' }}>Join as a Registered Citizen</h2>
        <p style={{ fontSize: '14px', color: '#7aa3be', lineHeight: '1.8', marginBottom: '32px', maxWidth: '560px' }}>
          Create an account to track your incident reports, receive updates on marine conditions,
          and contribute to citizen science data collection in the park.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          {[
            { icon: '📋', title: 'Track Reports', desc: 'Follow up on every incident you submit' },
            { icon: '🔔', title: 'Get Alerts', desc: 'Receive marine condition updates' },
            { icon: '🔬', title: 'Citizen Science', desc: 'Contribute observations to research' },
            { icon: '🎯', title: 'Community', desc: 'Join a network of conservation stewards' },
          ].map((item) => (
            <div key={item.title} style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>{item.icon}</div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#e2f0f9', marginBottom: '4px' }}>{item.title}</div>
              <div style={{ fontSize: '12px', color: '#5a7d94' }}>{item.desc}</div>
            </div>
          ))}
        </div>
        <Link href="/register" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 28px', background: 'linear-gradient(135deg, #00bcd4, #0077a8)', borderRadius: '10px', color: '#fff', fontSize: '14px', fontWeight: '700', textDecoration: 'none', boxShadow: '0 4px 16px rgba(0,188,212,0.3)' }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
          Create Citizen Account
        </Link>
      </section>

      {/* Contact */}
      <section style={{ padding: '40px 32px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#5a7d94', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Contact</div>
            <div style={{ fontSize: '14px', color: '#7aa3be', lineHeight: '2' }}>
              <div>Emergency: +1 (800) PARK-911</div>
              <div>Info Line: +1 (800) NDNP-INFO</div>
              <div>Email: info@ndnp-mpa.gov</div>
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#5a7d94', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Visitor Hours</div>
            <div style={{ fontSize: '14px', color: '#7aa3be', lineHeight: '2' }}>
              <div>Mon–Fri: 7:00 AM – 6:00 PM</div>
              <div>Weekends: 8:00 AM – 5:00 PM</div>
              <div>Ranger Patrol: 24/7</div>
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#5a7d94', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Quick Links</div>
            <div style={{ fontSize: '14px', lineHeight: '2' }}>
              <div><Link href="/report" style={{ color: '#f87171', textDecoration: 'none' }}>Report an Incident</Link></div>
              <div><Link href="/register" style={{ color: '#00bcd4', textDecoration: 'none' }}>Citizen Registration</Link></div>
              <div><Link href="/login" style={{ color: '#7aa3be', textDecoration: 'none' }}>Staff Portal Login</Link></div>
            </div>
          </div>
        </div>
      </section>

      <footer style={{ padding: '20px 32px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <p style={{ fontSize: '12px', color: '#3d6b84' }}>
          © {new Date().getFullYear()} National Designated Natural Park — Marine Protected Area. All rights reserved.
        </p>
      </footer>
    </div>
  )
}

