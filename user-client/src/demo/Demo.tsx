import { useState, useRef, useEffect } from 'react'
import { register } from '../api/auth'
import { uploadPrekeyBundle, fetchPrekeyBundle } from '../api/keys'
import { sendMessage, connectSocket } from '../api/messages'
import { startConversation, acceptConversation, ignoreConversation } from '../api/conversations'
import { userExists } from '../api/users'
import { generateAndStoreKeyBundle, formatBundleForUpload, loadExistingKeyBundle } from '../crypto/keyGeneration'
import { saveAuth, loadAuth } from '../storage/idb'
import { SignalProtocolStore } from '../crypto/signalStore'
import { initializeSession } from '../crypto/x3dh'
import { encryptMessage, decryptMessage } from '../crypto/ratchet'
import type { ContactRequest } from '../api/conversations'

// ── Change this to swap bubble color everywhere ───────────────────────────────
const ACCENT_COLOR = '#D4537E'

let store: SignalProtocolStore | null = null
let msgId = 0

interface Message {
    id:        number
    text:      string
    dir:       'sent' | 'recv'
    time:      string
}

type ConvoMap = Record<string, Message[]>

export default function Demo() {
    const [token,      setToken]      = useState('')
    const [shortCode,  setShortCode]  = useState('')
    const [registered, setRegistered] = useState(false)
    const [convos,     setConvos]     = useState<ConvoMap>({})
    const [activeKey,  setActiveKey]  = useState<string | null>(null)
    const [requests,   setRequests]   = useState<ContactRequest[]>([])
    const [msgText,    setMsgText]    = useState('')
    const [modalOpen,  setModalOpen]  = useState(false)
    const [modalInput, setModalInput] = useState('')
    const [status,     setStatus]     = useState<{ text: string; ok: boolean } | null>(null)
    const messagesEnd = useRef<HTMLDivElement>(null)

    useEffect(() => {
        messagesEnd.current?.scrollIntoView({ behavior: 'smooth' })
    }, [convos, activeKey])

    function flash(text: string, ok = true) {
        setStatus({ text, ok })
        setTimeout(() => setStatus(null), 3000)
    }

    function addMessage(key: string, text: string, dir: 'sent' | 'recv') {
        const msg: Message = {
            id:   ++msgId,
            text,
            dir,
            time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        }
        setConvos(prev => ({
            ...prev,
            [key]: [...(prev[key] || []), msg],
        }))
        setActiveKey(key)
    }

    function ensureConvo(key: string) {
        setConvos(prev => key in prev ? prev : { ...prev, [key]: [] })
    }

    function setupSocket(t: string) {
        connectSocket(t,
            async (sender, payload) => {
                try {
                    if (!store) return
                    const pt = await decryptMessage(store, sender, atob(payload.ciphertext), payload.message_type)
                    addMessage(sender, pt, 'recv')
                } catch (err: any) { flash(`Decrypt error: ${err.message}`, false) }
            },
            (req) => setRequests(prev => [...prev, req]),
            (_id, accepted) => { flash(`${accepted} accepted`); ensureConvo(accepted); setActiveKey(accepted) }
        )
    }

    async function handleRegister() {
        try {
            const { token: t, short_code } = await register()
            const bundle = await generateAndStoreKeyBundle()
            await uploadPrekeyBundle(t, formatBundleForUpload(bundle))
            await saveAuth(t, short_code)
            store = new SignalProtocolStore(bundle.registrationId)
            setToken(t); setShortCode(short_code); setRegistered(true)
            setupSocket(t)
            flash('Registered and ready')
        } catch (err: any) { flash(err.message, false) }
    }

    async function handleLoadExisting() {
        try {
            const auth = await loadAuth()
            if (!auth) { flash('No stored identity', false); return }
            const existing = await loadExistingKeyBundle()
            if (!existing) { flash('No stored keys', false); return }
            store = new SignalProtocolStore(existing.registrationId)
            setToken(auth.token); setShortCode(auth.shortCode); setRegistered(true)
            setupSocket(auth.token)
            flash('Identity loaded')
        } catch (err: any) { flash(err.message, false) }
    }

    async function handleConnect() {
        const target = modalInput.trim()
        if (!target) return
        setModalOpen(false); setModalInput('')
        try {
            if (!store || !token) { flash('Register first', false); return }
            if (target in convos)  { setActiveKey(target); return }
            const exists = await userExists(token, target)
            if (!exists) { flash(`No user: ${target}`, false); return }
            const bundle = await fetchPrekeyBundle(token, target)
            await initializeSession(store, bundle)
            const first = 'Hello'
            const { ciphertext, messageType } = await encryptMessage(store, target, first)
            await startConversation(token, target, { ciphertext: btoa(ciphertext as string), message_type: messageType }, first)
            ensureConvo(target); setActiveKey(target)
            flash(`Request sent to ${target}`)
        } catch (err: any) { flash(err.message, false) }
    }

    async function handleAccept(req: ContactRequest) {
        try {
            if (!store || !token) return
            const pt = await decryptMessage(store, req.sender_short_code, atob(req.payload.ciphertext), req.payload.message_type)
            await acceptConversation(token, req.conversation_id)
            setRequests(prev => prev.filter(r => r.conversation_id !== req.conversation_id))
            ensureConvo(req.sender_short_code)
            addMessage(req.sender_short_code, pt, 'recv')
            flash(`Accepted ${req.sender_short_code}`)
        } catch (err: any) { flash(err.message, false) }
    }

    async function handleIgnore(req: ContactRequest) {
        await ignoreConversation(token, req.conversation_id)
        setRequests(prev => prev.filter(r => r.conversation_id !== req.conversation_id))
    }

    async function handleSend() {
        if (!store || !token || !activeKey || !msgText.trim()) return
        try {
            const { ciphertext, messageType } = await encryptMessage(store, activeKey, msgText)
            await sendMessage(token, activeKey, ciphertext, messageType, msgText)
            addMessage(activeKey, msgText, 'sent')
            setMsgText('')
        } catch (err: any) { flash(err.message, false) }
    }

    const convoKeys      = Object.keys(convos)
    const activeMsgs     = activeKey ? (convos[activeKey] || []) : []

    // ── shared styles ─────────────────────────────────────────────────────────
    const bg1 = '#1a1a1a'
    const bg2 = '#1e1e1e'
    const bg3 = '#2a2a2a'
    const border = '1px solid #2e2e2e'
    const textPrimary = '#e8e8e8'
    const textMuted   = '#888'

    return (
        <div style={{ minHeight: '100vh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: 'var(--font-sans)' }}>
        <div style={{ width: '100%', maxWidth: 720, height: 600, background: bg1, borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid #2a2a2a', position: 'relative' }}>

            {/* ── Banner ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: bg2, borderBottom: border, flexShrink: 0 }}>
                <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: textPrimary }}>Secure messenger</div>
                    <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>Signal Protocol · end-to-end encrypted</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {!registered && (
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={handleRegister}     style={{ fontSize: 12, padding: '5px 12px' }}>Register</button>
                            <button onClick={handleLoadExisting} style={{ fontSize: 12, padding: '5px 12px' }}>Load existing</button>
                        </div>
                    )}
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: bg3, border: '1px solid #3a3a3a', borderRadius: 99, padding: '5px 12px', fontSize: 12, fontFamily: 'var(--font-mono)', color: textMuted }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: registered ? '#1D9E75' : '#555', display: 'inline-block', flexShrink: 0 }} />
                        {registered ? shortCode : 'not registered'}
                    </div>
                </div>
            </div>

            {/* ── Status flash ── */}
            {status && (
                <div style={{ padding: '6px 16px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, background: status.ok ? '#0F3D2E' : '#3D0F0F', color: status.ok ? '#5DCAA5' : '#F09595', borderBottom: `1px solid ${status.ok ? '#0a2a1f' : '#2a0a0a'}` }}>
                    {status.text}
                </div>
            )}

            {/* ── Body ── */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                {/* ── Sidebar ── */}
                <div style={{ width: 200, background: bg2, borderRight: border, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                    <div style={{ padding: '10px 14px', fontSize: 10, fontWeight: 500, color: '#555', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: border }}>Conversations</div>

                    {/* Requests */}
                    {requests.length > 0 && (
                        <div style={{ padding: '6px 6px 0', borderBottom: border }}>
                            <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '4px 6px 6px' }}>Requests</div>
                            {requests.map(r => (
                                <div key={r.conversation_id} style={{ padding: '8px 8px', background: bg3, borderRadius: 8, marginBottom: 4 }}>
                                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#ccc', marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.sender_short_code}</div>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <button onClick={() => handleAccept(r)} style={{ flex: 1, fontSize: 10, padding: '3px 0', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer' }}>Accept</button>
                                        <button onClick={() => handleIgnore(r)} style={{ flex: 1, fontSize: 10, padding: '3px 0', background: bg3, color: '#777', border: '1px solid #333', borderRadius: 5, cursor: 'pointer' }}>Ignore</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Conversation list */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
                        {convoKeys.length === 0 ? (
                            <div style={{ padding: '20px 8px', textAlign: 'center', fontSize: 11, color: '#444' }}>No conversations yet</div>
                        ) : convoKeys.map(key => {
                            const msgs = convos[key]
                            const last = msgs.length ? msgs[msgs.length - 1].text : 'No messages yet'
                            return (
                                <div key={key} onClick={() => setActiveKey(key)} style={{ padding: '9px 10px', borderRadius: 10, cursor: 'pointer', marginBottom: 2, background: activeKey === key ? '#2e2e2e' : 'transparent' }}>
                                    <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#ccc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{key}</div>
                                    <div style={{ fontSize: 11, color: '#555', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{last}</div>
                                </div>
                            )
                        })}
                    </div>

                    {/* New conversation button */}
                    <button onClick={() => setModalOpen(true)} style={{ margin: 8, border: 'none', background: bg3, color: textMuted, fontSize: 12, padding: 9, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'var(--font-sans)' }}>
                        <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New conversation
                    </button>
                </div>

                {/* ── Chat panel ── */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {!activeKey ? (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            <div style={{ width: 44, height: 44, borderRadius: '50%', background: bg3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                            </div>
                            <div style={{ fontSize: 13, color: '#555' }}>Select a conversation</div>
                        </div>
                    ) : (
                        <>
                            {/* Chat header */}
                            <div style={{ padding: '12px 16px', background: bg2, borderBottom: border, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: bg3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500, color: textMuted, flexShrink: 0 }}>
                                    {activeKey[0].toUpperCase()}
                                </div>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 500, color: textPrimary, fontFamily: 'var(--font-mono)' }}>{activeKey}</div>
                                    <div style={{ fontSize: 11, color: '#555', marginTop: 1 }}>end-to-end encrypted</div>
                                </div>
                            </div>

                            {/* Messages */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {activeMsgs.length === 0 ? (
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                        <div style={{ fontSize: 13, color: '#555' }}>No messages yet</div>
                                    </div>
                                ) : activeMsgs.map(m => (
                                    <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: m.dir === 'sent' ? 'flex-end' : 'flex-start' }}>
                                        <div style={{
                                            background:   m.dir === 'sent' ? ACCENT_COLOR : bg3,
                                            color:        m.dir === 'sent' ? '#fff' : textPrimary,
                                            borderRadius: m.dir === 'sent' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                            border:       m.dir === 'recv' ? '1px solid #333' : 'none',
                                            padding:      '9px 14px',
                                            fontSize:     13,
                                            maxWidth:     '72%',
                                            lineHeight:   1.5,
                                            wordBreak:    'break-word',
                                        }}>
                                            {m.text}
                                        </div>
                                        <div style={{ fontSize: 10, color: '#555', marginTop: 3, paddingInline: 4 }}>{m.time}</div>
                                    </div>
                                ))}
                                <div ref={messagesEnd} />
                            </div>

                            {/* Input */}
                            <div style={{ padding: 12, borderTop: border, display: 'flex', gap: 8, background: bg2, flexShrink: 0 }}>
                                <input
                                    value={msgText}
                                    onChange={e => setMsgText(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                                    placeholder={`Message ${activeKey}...`}
                                    style={{ flex: 1, background: bg3, border: '1px solid #333', borderRadius: 22, padding: '9px 16px', fontSize: 13, color: textPrimary, outline: 'none', fontFamily: 'var(--font-sans)' }}
                                />
                                <button onClick={handleSend} disabled={!msgText.trim()} style={{ width: 38, height: 38, borderRadius: '50%', background: msgText.trim() ? ACCENT_COLOR : bg3, border: 'none', cursor: msgText.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/></svg>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ── Modal ── */}
            {modalOpen && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 16 }}>
                    <div style={{ background: '#222', border: '1px solid #333', borderRadius: 14, padding: 20, width: 280 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4, color: textPrimary }}>New conversation</div>
                        <div style={{ fontSize: 12, color: '#777', marginBottom: 14 }}>Enter the recipient's short code</div>
                        <input
                            autoFocus
                            value={modalInput}
                            onChange={e => setModalInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleConnect()}
                            placeholder="e.g. silent-wolf-4821"
                            style={{ width: '100%', background: bg3, border: '1px solid #333', borderRadius: 8, padding: '9px 12px', fontSize: 12, color: textPrimary, outline: 'none', fontFamily: 'var(--font-mono)', marginBottom: 10 }}
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => { setModalOpen(false); setModalInput('') }} style={{ flex: 1, padding: 8, borderRadius: 8, fontSize: 12, background: bg3, color: '#aaa', border: '1px solid #333', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={handleConnect} style={{ flex: 1, padding: 8, borderRadius: 8, fontSize: 12, background: ACCENT_COLOR, color: '#fff', border: 'none', cursor: 'pointer' }}>Connect</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
        </div>
    )
}