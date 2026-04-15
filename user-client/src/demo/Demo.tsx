import { useState } from 'react'
import { register } from '../api/auth'
import { uploadPrekeyBundle, fetchPrekeyBundle } from '../api/keys'
import { sendMessage, connectSocket } from '../api/messages'
import { generateAndStoreKeyBundle, formatBundleForUpload, loadExistingKeyBundle } from '../crypto/keyGeneration'
import { saveAuth, loadAuth } from '../storage/idb'
import { SignalProtocolStore } from '../crypto/signalStore'
import { initializeSession } from '../crypto/x3dh'
import { encryptMessage, decryptMessage } from '../crypto/ratchet'

let store: SignalProtocolStore | null = null

export default function Demo() {
    const [log,         setLog]         = useState<string[]>([])
    const [token,       setToken]       = useState<string>('')
    const [shortCode,   setShortCode]   = useState<string>('')
    const [targetCode,  setTargetCode]  = useState<string>('')
    const [messageText, setMessageText] = useState<string>('')

    const print = (msg: string) => setLog(prev => [...prev, msg])

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
            print(`✅ Keys generated and uploaded`)

            // Connect socket and listen for incoming messages
            connectSocket(t, async (senderShortCode, payload) => {
                try {
                    if (!store) return
                    // Decode base64 back to binary string for libsignal
                    const ciphertext = atob(payload.ciphertext)
                    const plaintext  = await decryptMessage(
                        store,
                        senderShortCode,
                        ciphertext,
                        payload.message_type
                    )
                    print(`📨 Message from ${senderShortCode}: ${plaintext}`)
                } catch (err: any) {
                    print(`❌ Decrypt error: ${err.message}`)
                }
            })
            print('✅ Listening for messages')
        } catch (err: any) {
            print(`❌ ${err.message}`)
        }
    }

    async function handleInitSession() {
        try {
            if (!store || !token) { print('❌ Register first'); return }
            print(`Fetching prekey bundle for ${targetCode}...`)
            const bundle = await fetchPrekeyBundle(token, targetCode)
            await initializeSession(store, bundle)
            print(`✅ Session initialized with ${targetCode}`)
        } catch (err: any) {
            print(`❌ ${err.message}`)
        }
    }

    async function handleSend() {
        try {
            if (!store || !token) { print('❌ Register first'); return }
            const { ciphertext, messageType } = await encryptMessage(store, targetCode, messageText)
            await sendMessage(token, targetCode, ciphertext, messageType)
            print(`✅ Sent to ${targetCode}: ${messageText}`)
            setMessageText('')
        } catch (err: any) {
            print(`❌ ${err.message}`)
        }
    }

    async function handleLoadExisting() {
        try {
            const auth = await loadAuth()
            if (!auth) { print('❌ No stored auth found'); return }

            const existing = await loadExistingKeyBundle()
            if (!existing) { print('❌ No stored keys found — register first'); return }

            store = new SignalProtocolStore(existing.registrationId)
            setToken(auth.token)
            setShortCode(auth.shortCode)
            print(`✅ Loaded existing identity: ${auth.shortCode}`)

            connectSocket(auth.token, async (senderShortCode, payload) => {
                try {
                    if (!store) return
                    const ciphertext = atob(payload.ciphertext)
                    const plaintext  = await decryptMessage(
                        store,
                        senderShortCode,
                        ciphertext,
                        payload.message_type
                    )
                    print(`📨 Message from ${senderShortCode}: ${plaintext}`)
                } catch (err: any) {
                    print(`❌ Decrypt error: ${err.message}`)
                }
            })
            print('✅ Listening for messages')
        } catch (err: any) {
            print(`❌ ${err.message}`)
        }
    }

    return (
        <div style={{ padding: 32, fontFamily: 'monospace' }}>
            <h2>Signal Protocol Demo</h2>
            <div style={{ marginBottom: 16 }}>
                <strong>Your short code: </strong>{shortCode || 'not registered'}
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <button onClick={handleRegister}>1. Register</button>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <button onClick={handleLoadExisting}>1b. Load Existing</button>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <input
                    placeholder="Target short code"
                    value={targetCode}
                    onChange={e => setTargetCode(e.target.value)}
                />
                <button onClick={handleInitSession}>2. Init Session</button>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                <input
                    placeholder="Message"
                    value={messageText}
                    onChange={e => setMessageText(e.target.value)}
                />
                <button onClick={handleSend}>3. Send</button>
            </div>

            <div style={{ background: '#111', color: '#0f0', padding: 16, minHeight: 200 }}>
                {log.map((line, i) => <div key={i}>{line}</div>)}
            </div>
        </div>
    )
}