import { useState, useEffect } from 'react'
import { login } from './api/auth'
import { retrieveMessages } from './api/messages'
import type { InterceptedMessage } from './api/messages'

export default function App() {
    const [view,       setView]       = useState<'login' | 'dashboard'>(localStorage.getItem('authority_token') ? 'dashboard' : 'login')
    const [token,      setToken]      = useState(localStorage.getItem('authority_token') || '')
    const [username,   setUsername]   = useState('')
    const [password,   setPassword]   = useState('')
    const [loginErr,   setLoginErr]   = useState('')
    const [loading,    setLoading]    = useState(false)
    const [messages,   setMessages]   = useState<InterceptedMessage[]>([])
    const [filtered,   setFiltered]   = useState<InterceptedMessage[]>([])
    const [sender,     setSender]     = useState('')
    const [recipient,  setRecipient]  = useState('')

    useEffect(() => {
        if (view === 'dashboard') doFetch()
    }, [view])

    useEffect(() => {
        setFiltered(messages.filter(m => {
            const s = !sender    || m.sender_id.includes(sender)
            const r = !recipient || m.recipient_id.includes(recipient)
            return s && r
        }))
    }, [sender, recipient, messages])

    async function doLogin() {
        setLoading(true)
        setLoginErr('')
        try {
            const t = await login(username, password)
            localStorage.setItem('authority_token', t)
            setToken(t)
            setView('dashboard')
        } catch (err: any) {
            setLoginErr(err.response?.data?.error || 'Login failed')
        } finally {
            setLoading(false)
        }
    }

    async function doFetch() {
        try {
            const msgs = await retrieveMessages(token)
            setMessages(msgs)
        } catch (err: any) {
            if (err.response?.status === 401) doLogout()
        }
    }

    function doLogout() {
        localStorage.removeItem('authority_token')
        setToken('')
        setView('login')
    }

    function fmt(iso: string) {
        const d = new Date(iso)
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' +
               d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    }

    const uniqueSenders = [...new Set(messages.map(m => m.sender_id))].length
    const errCount      = filtered.filter(m => m.error).length

    if (view === 'login') return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'monospace' }}>
            <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, padding: '2rem', width: 340 }}>
                <h2 style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>Authority access</h2>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>Intercepted message archive</p>
                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Username</label>
                    <input value={username} onChange={e => setUsername(e.target.value)} placeholder="authority" style={{ width: '100%' }} />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && doLogin()} placeholder="••••••••" style={{ width: '100%' }} />
                </div>
                <button onClick={doLogin} disabled={loading} style={{ width: '100%', padding: 8, background: 'var(--color-text-primary)', color: 'var(--color-background-primary)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'monospace' }}>
                    {loading ? 'Authenticating...' : 'Sign in'}
                </button>
                {loginErr && <p style={{ fontSize: 12, color: 'var(--color-text-danger)', marginTop: '0.75rem', textAlign: 'center' }}>{loginErr}</p>}
            </div>
        </div>
    )

    return (
        <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Intercepted messages
                    <span style={{ display: 'inline-block', background: 'var(--color-background-secondary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 99, fontSize: 11, padding: '1px 8px', color: 'var(--color-text-secondary)', marginLeft: 8 }}>{messages.length}</span>
                </h1>
                <button onClick={doLogout} style={{ fontSize: 11, color: 'var(--color-text-secondary)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'monospace' }}>sign out</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: '1.5rem' }}>
                {[['Total', messages.length], ['Unique senders', uniqueSenders], ['Decrypt errors', errCount]].map(([label, value]) => (
                    <div key={label as string} style={{ background: 'var(--color-background-secondary)', borderRadius: 8, padding: '1rem' }}>
                        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 22, fontWeight: 500 }}>{value}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
                <input placeholder="Filter by sender..."    value={sender}    onChange={e => setSender(e.target.value)}    style={{ flex: 1, fontSize: 12, fontFamily: 'monospace' }} />
                <input placeholder="Filter by recipient..." value={recipient} onChange={e => setRecipient(e.target.value)} style={{ flex: 1, fontSize: 12, fontFamily: 'monospace' }} />
                <button onClick={doFetch} style={{ fontSize: 12, fontFamily: 'monospace' }}>Fetch</button>
                <button onClick={() => { setSender(''); setRecipient('') }} style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>Clear</button>
            </div>

            <div style={{ border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
                    <thead>
                        <tr>
                            {[['Time', 130], ['From', 150], ['To', 150], ['Message', null]].map(([label, w]) => (
                                <th key={label as string} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, fontWeight: 500, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)', width: w ? w : 'auto' }}>{label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)', fontSize: 13 }}>No messages. Click Fetch to load.</td></tr>
                        ) : filtered.map(m => (
                            <tr key={m.id} style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                                <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)', fontSize: 11, verticalAlign: 'top' }}>{fmt(m.created_at)}</td>
                                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: 'var(--color-text-secondary)', verticalAlign: 'top', wordBreak: 'break-word' }}>{m.sender_id}</td>
                                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: 'var(--color-text-secondary)', verticalAlign: 'top', wordBreak: 'break-word' }}>{m.recipient_id}</td>
                                <td style={{ padding: '10px 12px', verticalAlign: 'top', wordBreak: 'break-word' }}>
                                    {m.error
                                        ? <span style={{ color: 'var(--color-text-danger)', fontSize: 11 }}>Decrypt error: {m.error}</span>
                                        : <span style={{ lineHeight: 1.5 }}>{m.plaintext}</span>
                                    }
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}