import {
    SignalProtocolAddress,
    SessionRecordType,
    Direction,
    StorageType,
} from '@privacyresearch/libsignal-protocol-typescript'
import {
    loadIdentityKey as loadIdentityKeyFromDB,
    loadSignedPrekey,
    loadOneTimePrekey,
    deleteOneTimePrekey,
    saveSession,
    loadSession as loadSessionFromDB,
} from '../storage/idb'
import { base64ToArrayBuffer, arrayBufferToBase64 } from './keyGeneration'

export class SignalProtocolStore implements StorageType {
    private registrationId: number
    private identityKeyPair: { pubKey: ArrayBuffer; privKey: ArrayBuffer } | null = null

    constructor(registrationId: number) {
        this.registrationId = registrationId
    }

    // IK ----------------------------------------------------
    async getIdentityKeyPair() {
        console.log('[store] getIdentityKeyPair called')
        const stored = await loadIdentityKeyFromDB()
        console.log('[store] identity key loaded:', stored)
        if (!stored) throw new Error('Identity key not found in IndexedDB')
        this.identityKeyPair = stored
        return stored
    }

    async getLocalRegistrationId(): Promise<number> {
        return this.registrationId
    }

    async isTrustedIdentity(
        identifier: string,
        identityKey: ArrayBuffer,
        _direction: Direction
    ): Promise<boolean> {
        return true
    }

    async saveIdentity(identifier: string, identityKey: ArrayBuffer): Promise<boolean> {
        return true
    }

    async loadIdentityKey(identifier: string): Promise<ArrayBuffer | undefined> {
        return undefined
    }

    // SPK ----------------------------------------------------------------------
    async loadSignedPreKey(keyId: number) {
        console.log('[store] loadSignedPreKey called with id:', keyId)
        const stored = await loadSignedPrekey(keyId)
        console.log('[store] signed prekey loaded:', stored)
        if (!stored) throw new Error(`Signed prekey ${keyId} not found`)
        return { pubKey: stored.pubKey, privKey: stored.privKey }
    }

    async storeSignedPreKey(keyId: number, keyPair: { pubKey: ArrayBuffer; privKey: ArrayBuffer }) {
        // Maybe implement
    }

    async removeSignedPreKey(keyId: number) {
        // TODO: Handle SPK rotation later
    }

    // OPK ---------------------------------------------------------------------------
    async loadPreKey(keyId: number) {
        console.log('[store] loadPreKey called with id:', keyId)
        const stored = await loadOneTimePrekey(keyId)
        console.log('[store] one time prekey loaded:', stored)
        if (!stored) return undefined
        return { pubKey: stored.pubKey, privKey: stored.privKey }
    }

    async storePreKey(keyId: number, keyPair: { pubKey: ArrayBuffer; privKey: ArrayBuffer }) {
        // Maybe implement
    }

    async removePreKey(keyId: number) {
        await deleteOneTimePrekey(keyId)
    }

    // SESSION -------------------------------------------------
    async loadSession(identifier: string): Promise<SessionRecordType | undefined> {
        console.log('[store] loadSession called for:', identifier)
        const stored = await loadSessionFromDB(identifier)
        console.log('[store] session found:', !!stored)
        if (!stored) return undefined
        const text = new TextDecoder().decode(stored)
        return text as unknown as SessionRecordType
    }

    async storeSession(identifier: string, record: SessionRecordType): Promise<void> {
        // libsignal passes record as an already-serialized string
        const serialized = typeof record === 'string'
            ? record
            : JSON.stringify(record)
        const encoded = new TextEncoder().encode(serialized)
        await saveSession(identifier, encoded.buffer)
    }

    async removeSession(identifier: string): Promise<void> {
        // Maybe implement
    }

    async removeAllSessions(identifier: string): Promise<void> {
        // Maybe implement
    }
}