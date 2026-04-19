import {
    KeyHelper,
    SignedPublicPreKeyType,
    PreKeyType,
} from '@privacyresearch/libsignal-protocol-typescript'
import {
    saveIdentityKey,
    saveSignedPrekey,
    saveOneTimePrekeys,
    loadIdentityKey,
} from '../storage/idb'


const SIGNED_PREKEY_ID  = 1
const NUM_ONE_TIME_KEYS = 20

// Helper functinos
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64)
    const bytes  = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
}



// Key generatoin
export interface GeneratedKeyBundle {
    registrationId:  number
    identityKey: {
        pubKey:  ArrayBuffer
        privKey: ArrayBuffer
    }
    signedPrekey: {
        id:        number
        pubKey:    ArrayBuffer
        privKey:   ArrayBuffer
        signature: ArrayBuffer
    }
    oneTimePrekeys: {
        id:      number
        pubKey:  ArrayBuffer
        privKey: ArrayBuffer
    }[]
}

export async function generateKeyBundle(): Promise<GeneratedKeyBundle> {
    // Registration ID — random number identifying this device
    const registrationId = KeyHelper.generateRegistrationId()

    // IK
    const identityKeyPair = await KeyHelper.generateIdentityKeyPair()

    // SPK
    const signedPrekeyRecord = await KeyHelper.generateSignedPreKey(
        identityKeyPair,
        SIGNED_PREKEY_ID
    )

    // OPK
    const oneTimePrekeys: PreKeyType[] = []
    for (let i = 0; i < NUM_ONE_TIME_KEYS; i++) {
        const opk = await KeyHelper.generatePreKey(i + 1)
        oneTimePrekeys.push(opk)
    }

    return {
        registrationId,
        identityKey: {
            pubKey:  identityKeyPair.pubKey,
            privKey: identityKeyPair.privKey,
        },
        signedPrekey: {
            id:        signedPrekeyRecord.keyId,
            pubKey:    signedPrekeyRecord.keyPair.pubKey,
            privKey:   signedPrekeyRecord.keyPair.privKey,
            signature: signedPrekeyRecord.signature,
        },
        oneTimePrekeys: oneTimePrekeys.map(opk => ({
            id:      opk.keyId,
            pubKey:  opk.keyPair.pubKey,
            privKey: opk.keyPair.privKey,
        })),
    }
}

// DB interaction
export async function generateAndStoreKeyBundle(): Promise<GeneratedKeyBundle> {
    const bundle = await generateKeyBundle()

    localStorage.setItem('registrationId', bundle.registrationId.toString())

    await saveIdentityKey(
        bundle.identityKey.pubKey,
        bundle.identityKey.privKey,
    )

    await saveSignedPrekey(
        bundle.signedPrekey.id,
        bundle.signedPrekey.pubKey,
        bundle.signedPrekey.privKey,
        bundle.signedPrekey.signature,
    )

    await saveOneTimePrekeys(bundle.oneTimePrekeys)

    return bundle
}

// Format for server
export function formatBundleForUpload(bundle: GeneratedKeyBundle): object {
    return {
        ik_public:     arrayBufferToBase64(bundle.identityKey.pubKey),
        spk_id:        bundle.signedPrekey.id,
        spk_public:    arrayBufferToBase64(bundle.signedPrekey.pubKey),
        spk_signature: arrayBufferToBase64(bundle.signedPrekey.signature),
        opks: bundle.oneTimePrekeys.map(opk => ({
            id:     opk.id,
            public: arrayBufferToBase64(opk.pubKey),
        })),
    }
}

export async function loadExistingKeyBundle(): Promise<{ registrationId: number } | null> {
    const identity = await loadIdentityKey()
    if (!identity) return null
    // Registration ID is not stored currently — fix below
    const storedId = localStorage.getItem('registrationId')
    if (!storedId) return null
    return { registrationId: parseInt(storedId) }
}