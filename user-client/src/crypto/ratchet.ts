import {
    SessionCipher,
    SignalProtocolAddress,
    MessageType,
} from '@privacyresearch/libsignal-protocol-typescript'
import { SignalProtocolStore } from './signalStore'

export async function encryptMessage(
    store: SignalProtocolStore,
    recipientShortCode: string,
    plaintext: string
): Promise<{ ciphertext: string | ArrayBuffer; messageType: number }> {
    console.log('[ratchet] encrypting for:', recipientShortCode)
    const address = new SignalProtocolAddress(recipientShortCode, 1)
    const cipher  = new SessionCipher(store, address)
    console.log('[ratchet] cipher created')
    const encoded = new TextEncoder().encode(plaintext)
    console.log('[ratchet] calling cipher.encrypt')
    const encrypted = await cipher.encrypt(encoded.buffer)
    console.log('[ratchet] encrypted:', encrypted)
    return {
        ciphertext:  encrypted.body,
        messageType: encrypted.type,
    }
}

export async function decryptMessage(
    store: SignalProtocolStore,
    senderShortCode: string,
    ciphertext: ArrayBuffer | string,
    messageType: number
): Promise<string> {
    const address = new SignalProtocolAddress(senderShortCode, 1)
    const cipher  = new SessionCipher(store, address)

    let decrypted: ArrayBuffer

    if (messageType === 3) {
        decrypted = await cipher.decryptPreKeyWhisperMessage(ciphertext, 'binary')
    } else {
        decrypted = await cipher.decryptWhisperMessage(ciphertext, 'binary')
    }

    return new TextDecoder().decode(decrypted)
}