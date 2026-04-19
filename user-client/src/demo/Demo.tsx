import { useState } from 'react'
import { register } from '../api/auth'
import { uploadPrekeyBundle, fetchPrekeyBundle, replenishOpksIfNeeded } from '../api/keys'
import { sendMessage, connectSocket } from '../api/messages'
import { startConversation, acceptConversation, ignoreConversation } from '../api/conversations'
import { userExists } from '../api/users'
import { generateAndStoreKeyBundle, formatBundleForUpload, loadExistingKeyBundle } from '../crypto/keyGeneration'
import { saveAuth, loadAuth } from '../storage/idb'
import { SignalProtocolStore } from '../crypto/signalStore'
import { initializeSession } from '../crypto/x3dh'
import { encryptMessage, decryptMessage } from '../crypto/ratchet'
import type { ContactRequest } from '../api/conversations'

let store: SignalProtocolStore | null = null

export default function Demo() {
    const [log,           setLog]           = useState<string[]>([])
    const [token,         setToken]         = useState<string>('')
    const [shortCode,     setShortCode]     = useState<string>('')
    const [targetCode,    setTargetCode]    = useState<string>('')
    const [messageText,   setMessageText]   = useState<string>('')
    const [requests,      setRequests]      = useState<ContactRequest[]>([])

    const print = (msg: string) => setLog(prev => [...prev, msg])

    // ── Registration ──────────────────────────────────────────────────────────
    async function handleRegister() {
        try {
            print('Registering...')
            const { token: t, short_code } = await register()
            const bundle = await generateAndStoreKeyBundle()
            await uploadPrekeyBundle(t, formatBundleForUpload(bundle))
            await saveAuth(t, short_code)

            store = new SignalProtocolStore(bundle.registrationId)
            setToken(t)
            setShortCode(short_code)
            print(`✅ Registered as: ${short_code}`)

            await replenishOpksIfNeeded(t)

            setupSocket(t)
        } catch (err: any) {
            print(`❌ ${err.message}`)
        }
    }

    async function handleLoadExisting() {
        try {
            const auth = await loadAuth()
            if (!auth) { print('❌ No stored auth found'); return }

            const existing = await loadExistingKeyBundle()
            if (!existing) { print('❌ No stored keys — register first'); return }

            store = new SignalProtocolStore(existing.registrationId)
            setToken(auth.token)
            setShortCode(auth.shortCode)
            print(`✅ Loaded as: ${auth.shortCode}`)

            setupSocket(auth.token)
        } catch (err: any) {
            print(`❌ ${err.message}`)
        }
    }

    // ── Socket setup ──────────────────────────────────────────────────────────
    function setupSocket(t: string) {
        connectSocket(
            t,
            // onMessage
            async (senderShortCode, payload) => {
                try {
                    if (!store) return
                    const plaintext = await decryptMessage(
                        store,
                        senderShortCode,
                        atob(payload.ciphertext),
                        payload.message_type
                    )
                    print(`📨 ${senderShortCode}: ${plaintext}`)
                } catch (err: any) {
                    print(`❌ Decrypt error: ${err.message}`)
                }
            },
            // onContactRequest
            async (request) => {
                print(`📬 Contact request from: ${request.sender_short_code}`)
                setRequests(prev => [...prev, request])
            },
            // onConversationAccepted
            (conversationId, acceptedShortCode) => {
                print(`✅ ${acceptedShortCode} accepted your request`)
            }
        )
        print('✅ Listening for messages')
    }

    // ── Start conversation ────────────────────────────────────────────────────
    async function handleStartConversation() {
        try {
            if (!store || !token) { print('❌ Register first'); return }

            // Check user exists
            const exists = await userExists(token, targetCode)
            if (!exists) { print(`❌ No user with short code: ${targetCode}`); return }

            // Silently fetch bundle and init session
            print(`Initializing session with ${targetCode}...`)
            const bundle = await fetchPrekeyBundle(token, targetCode)
            await initializeSession(store, bundle)

            // Encrypt a first message
            const firstMessage = '👋'
            const { ciphertext, messageType } = await encryptMessage(store, targetCode, firstMessage)

            // Send as contact request
            await startConversation(token, targetCode, {
                ciphertext:   btoa(ciphertext as string),
                message_type: messageType,
            })

            print(`✅ Contact request sent to ${targetCode}`)
        } catch (err: any) {
            print(`❌ ${err.message}`)
        }
    }

    // ── Accept / ignore ───────────────────────────────────────────────────────
    async function handleAccept(request: ContactRequest) {
        try {
            if (!store || !token) return

            const plaintext = await decryptMessage(
                store,
                request.sender_short_code,
                atob(request.payload.ciphertext),
                request.payload.message_type
            )
            print(`📨 First message from ${request.sender_short_code}: ${plaintext}`)

            await acceptConversation(token, request.conversation_id)
            setRequests(prev => prev.filter(r => r.conversation_id !== request.conversation_id))

            // Set targetCode so Bob can reply to Alice
            setTargetCode(request.sender_short_code)

            await replenishOpksIfNeeded(token)
            print(`✅ Accepted conversation with ${request.sender_short_code}`)
        } catch (err: any) {
            print(`❌ ${err.message}`)
        }
    }

    async function handleIgnore(request: ContactRequest) {
        try {
            await ignoreConversation(token, request.conversation_id)
            setRequests(prev => prev.filter(r => r.conversation_id !== request.conversation_id))
            print(`🚫 Ignored ${request.sender_short_code}`)
        } catch (err: any) {
            print(`❌ ${err.message}`)
        }
    }

    // ── Send message ──────────────────────────────────────────────────────────
    async function handleSend() {
        try {
            if (!store || !token) { print('❌ Register first'); return }
            const { ciphertext, messageType } = await encryptMessage(store, targetCode, messageText)
            await sendMessage(token, targetCode, ciphertext, messageType)
            print(`📤 You → ${targetCode}: ${messageText}`)
            setMessageText('')
        } catch (err: any) {
            print(`❌ ${err.message}`)
        }
    }

    // ── UI ────────────────────────────────────────────────────────────────────
    return (
        <div style={{ padding: 32, fontFamily: 'monospace', maxWidth: 600 }}>
            <h2>Whistleblower Demo</h2>
            <div style={{ marginBottom: 16 }}>
                <strong>Your short code: </strong>{shortCode || 'not registered'}
            </div>

            {/* Auth */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <button onClick={handleRegister}>Register</button>
                <button onClick={handleLoadExisting}>Load Existing</button>
            </div>

            {/* Start conversation */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <input
                    placeholder="Recipient short code"
                    value={targetCode}
                    onChange={e => setTargetCode(e.target.value)}
                    style={{ flex: 1 }}
                />
                <button onClick={handleStartConversation}>Start Conversation</button>
            </div>

            {/* Send message */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <input
                    placeholder="Message"
                    value={messageText}
                    onChange={e => setMessageText(e.target.value)}
                    style={{ flex: 1 }}
                />
                <button onClick={handleSend}>Send</button>
            </div>

            {/* Contact requests */}
            {requests.length > 0 && (
                <div style={{ marginBottom: 16, border: '1px solid #333', padding: 12 }}>
                    <strong>Contact Requests</strong>
                    {requests.map(r => (
                        <div key={r.conversation_id} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <span>{r.sender_short_code}</span>
                            <button onClick={() => handleAccept(r)}>Accept</button>
                            <button onClick={() => handleIgnore(r)}>Ignore</button>
                        </div>
                    ))}
                </div>
            )}

            {/* Log */}
            <div style={{ background: '#111', color: '#0f0', padding: 16, minHeight: 200 }}>
                {log.map((line, i) => <div key={i}>{line}</div>)}
            </div>
        </div>
    )
}