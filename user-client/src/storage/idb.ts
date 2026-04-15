import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'

// ── Schema ────────────────────────────────────────────────────────────────────
interface WhistleblowerDB extends DBSchema {
    // Auth
    auth: {
        key: string
        value: {
            token: string
            shortCode: string
        }
    }
    // Identity key pair
    identityKey: {
        key: string
        value: {
            pubKey: ArrayBuffer
            privKey: ArrayBuffer
        }
    }
    // Signed prekey
    signedPrekey: {
        key: number   // spk id
        value: {
            id: number
            pubKey: ArrayBuffer
            privKey: ArrayBuffer
            signature: ArrayBuffer
        }
    }
    // One-time prekeys
    oneTimePrekeys: {
        key: number   // opk id
        value: {
            id: number
            pubKey: ArrayBuffer
            privKey: ArrayBuffer
        }
    }
    // Signal Protocol session store (double ratchet state)
    sessions: {
        key: string   // recipient short code
        value: ArrayBuffer
    }
    // Messages (local history)
    messages: {
        key: number
        value: {
            id: number
            senderShortCode: string
            recipientShortCode: string
            plaintext: string
            sentAt: string
            direction: 'sent' | 'received'
        }
        autoIncrement: true
    }
}

// ── Open DB ───────────────────────────────────────────────────────────────────
let db: IDBPDatabase<WhistleblowerDB>

async function getDB(): Promise<IDBPDatabase<WhistleblowerDB>> {
    if (db) return db
    db = await openDB<WhistleblowerDB>('whistleblower', 1, {
        upgrade(db) {
            db.createObjectStore('auth')
            db.createObjectStore('identityKey')
            db.createObjectStore('signedPrekey', { keyPath: 'id' })
            db.createObjectStore('oneTimePrekeys', { keyPath: 'id' })
            db.createObjectStore('sessions')
            db.createObjectStore('messages', { autoIncrement: true })
        }
    })
    return db
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function saveAuth(token: string, shortCode: string): Promise<void> {
    sessionStorage.setItem('auth', JSON.stringify({ token, shortCode }))
}

export async function loadAuth(): Promise<{ token: string; shortCode: string } | undefined> {
    const stored = sessionStorage.getItem('auth')
    if (!stored) return undefined
    return JSON.parse(stored)
}

export async function clearAuth(): Promise<void> {
    sessionStorage.removeItem('auth')
}

// ── Identity Key ──────────────────────────────────────────────────────────────
export async function saveIdentityKey(pubKey: ArrayBuffer, privKey: ArrayBuffer): Promise<void> {
    const db = await getDB()
    await db.put('identityKey', { pubKey, privKey }, 'identity')
}

export async function loadIdentityKey(): Promise<{ pubKey: ArrayBuffer; privKey: ArrayBuffer } | undefined> {
    const db = await getDB()
    return db.get('identityKey', 'identity')
}

// ── Signed Prekey ─────────────────────────────────────────────────────────────
export async function saveSignedPrekey(
    id: number,
    pubKey: ArrayBuffer,
    privKey: ArrayBuffer,
    signature: ArrayBuffer
): Promise<void> {
    const db = await getDB()
    await db.put('signedPrekey', { id, pubKey, privKey, signature })
}

export async function loadSignedPrekey(id: number): Promise<{
    id: number
    pubKey: ArrayBuffer
    privKey: ArrayBuffer
    signature: ArrayBuffer
} | undefined> {
    const db = await getDB()
    return db.get('signedPrekey', id)
}

// ── One-time Prekeys ──────────────────────────────────────────────────────────
export async function saveOneTimePrekeys(
    prekeys: { id: number; pubKey: ArrayBuffer; privKey: ArrayBuffer }[]
): Promise<void> {
    const db = await getDB()
    const tx = db.transaction('oneTimePrekeys', 'readwrite')
    await Promise.all(prekeys.map(opk => tx.store.put(opk)))
    await tx.done
}

export async function loadOneTimePrekey(id: number): Promise<{
    id: number
    pubKey: ArrayBuffer
    privKey: ArrayBuffer
} | undefined> {
    const db = await getDB()
    return db.get('oneTimePrekeys', id)
}

export async function deleteOneTimePrekey(id: number): Promise<void> {
    const db = await getDB()
    await db.delete('oneTimePrekeys', id)
}

// ── Sessions ──────────────────────────────────────────────────────────────────
export async function saveSession(recipientShortCode: string, sessionState: ArrayBuffer): Promise<void> {
    const db = await getDB()
    await db.put('sessions', sessionState, recipientShortCode)
}

export async function loadSession(recipientShortCode: string): Promise<ArrayBuffer | undefined> {
    const db = await getDB()
    return db.get('sessions', recipientShortCode)
}

export async function deleteSession(recipientShortCode: string): Promise<void> {
    const db = await getDB()
    await db.delete('sessions', recipientShortCode)
}

// ── Messages ──────────────────────────────────────────────────────────────────
export async function saveMessage(message: {
    senderShortCode: string
    recipientShortCode: string
    plaintext: string
    sentAt: string
    direction: 'sent' | 'received'
}): Promise<void> {
    const db = await getDB()
    await db.add('messages', { ...message, id: Date.now() })
}

export async function loadMessages(shortCode: string): Promise<{
    id: number
    senderShortCode: string
    recipientShortCode: string
    plaintext: string
    sentAt: string
    direction: 'sent' | 'received'
}[]> {
    const db = await getDB()
    const all = await db.getAll('messages')
    return all.filter(m =>
        m.senderShortCode === shortCode || m.recipientShortCode === shortCode
    )
}