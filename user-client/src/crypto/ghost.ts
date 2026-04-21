import { arrayBufferToBase64 } from './keyGeneration'

/**
 * ECIES encryption to the ghost public key.
 * 1. Parse the ghost public key PEM
 * 2. Generate ephemeral EC key pair
 * 3. ECDH(ephemeral_private, ghost_public) -> shared_secret
 * 4. HKDF(shared_secret) -> aes_key
 * 5. AES-GCM encrypt plaintext
 * 6. Return ciphertext (nonce prepended) + ephemeral public key
 */

export interface GhostCiphertext {
    ghost_ciphertext:    string   // base64(nonce + AES-GCM ciphertext)
    ghost_ephemeral_pub: string   // base64(DER ephemeral public key)
}

let cachedGhostPublicKeyPem: string | null = null

function pemToArrayBuffer(pem: string): ArrayBuffer {
    const base64 = pem
        .replace(/-----BEGIN PUBLIC KEY-----/, '')
        .replace(/-----END PUBLIC KEY-----/, '')
        .replace(/\n/g, '')
        .trim()
    const binary = atob(base64)
    const bytes  = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
}

export async function ghostEncrypt(
    plaintext: string,
    ghostPublicKeyPem: string
): Promise<GhostCiphertext> {
    const subtle = window.crypto.subtle

    // Import ghost public key
    const ghostPublicKeyDer = pemToArrayBuffer(ghostPublicKeyPem)
    const ghostPublicKey    = await subtle.importKey(
        'spki',
        ghostPublicKeyDer,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        []
    )

    // Generate ephemeral key pair
    const ephemeralKeyPair = await subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveKey']
    )

    // ECDH -> raw shared secret
    const sharedSecretKey = await subtle.deriveKey(
        {
            name:   'ECDH',
            public: ghostPublicKey,
        },
        ephemeralKeyPair.privateKey,
        { name: 'HMAC', hash: 'SHA-256', length: 256 },
        true,
        ['sign']
    )

    // Export shared secret as raw bytes
    const sharedSecretRaw = await subtle.exportKey('raw', sharedSecretKey)

    // HKDF -> AES key (matching server's HKDF with info="ghost-ecies-v1")
    const hkdfKey = await subtle.importKey(
        'raw',
        sharedSecretRaw,
        { name: 'HKDF' },
        false,
        ['deriveKey']
    )

    const aesKey = await subtle.deriveKey(
        {
            name:   'HKDF',
            hash:   'SHA-256',
            salt:   new Uint8Array(0),
            info:   new TextEncoder().encode('ghost-ecies-v1'),
        },
        hkdfKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
    )

    // Encrypt plaintext with AES-GCM
    const nonce      = window.crypto.getRandomValues(new Uint8Array(12))
    const encoded    = new TextEncoder().encode(plaintext)
    const ciphertext = await subtle.encrypt(
        { name: 'AES-GCM', iv: nonce },
        aesKey,
        encoded
    )

    // Prepend nonce to ciphertext
    const combined = new Uint8Array(nonce.length + ciphertext.byteLength)
    combined.set(nonce, 0)
    combined.set(new Uint8Array(ciphertext), nonce.length)

    // Export ephemeral public key as DER
    const ephemeralPubDer = await subtle.exportKey('spki', ephemeralKeyPair.publicKey)

    return {
        ghost_ciphertext:    arrayBufferToBase64(combined.buffer),
        ghost_ephemeral_pub: arrayBufferToBase64(ephemeralPubDer),
    }
}

export async function getGhostPublicKey(token: string): Promise<string> {
    if (cachedGhostPublicKeyPem) return cachedGhostPublicKeyPem
    const { fetchGhostPublicKey } = await import('../api/keys')
    cachedGhostPublicKeyPem = await fetchGhostPublicKey(token)
    return cachedGhostPublicKeyPem
}