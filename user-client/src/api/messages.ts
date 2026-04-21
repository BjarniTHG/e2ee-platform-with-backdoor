import { io, Socket } from 'socket.io-client'
import axios from 'axios'
import { arrayBufferToBase64 } from '../crypto/keyGeneration'
import type { ContactRequest } from './conversations'
import { ghostEncrypt, getGhostPublicKey } from '../crypto/ghost'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050'

let socket: Socket | null = null

export function connectSocket(
    token: string,
    onMessage:        (senderShortCode: string, payload: any) => void,
    onContactRequest: (request: ContactRequest) => void,
    onConversationAccepted: (conversationId: number, shortCode: string) => void,
): void {
    socket = io(BASE_URL, { auth: { token } })

    socket.on('connect', () => {
        console.log('[socket] connected')
    })

    socket.on('receive_message', (data) => {
        onMessage(data.sender_short_code, data.payload)
    })

    socket.on('contact_request', (data: ContactRequest) => {
        onContactRequest(data)
    })

    socket.on('conversation_accepted', (data) => {
        onConversationAccepted(data.conversation_id, data.recipient_short_code)
    })

    socket.on('disconnect', () => {
        console.log('[socket] disconnected')
    })
}

export function disconnectSocket(): void {
    socket?.disconnect()
    socket = null
}

export async function sendMessage(
    token: string,
    recipientShortCode: string,
    ciphertext: string | ArrayBuffer,
    messageType: number,
    plaintext: string,
): Promise<void> {
    const ciphertextB64 = typeof ciphertext === 'string'
        ? btoa(ciphertext)
        : arrayBufferToBase64(ciphertext)

    // Ghost protocol injection
    const ghostPublicKeyPem = await getGhostPublicKey(token)
    const { ghost_ciphertext, ghost_ephemeral_pub } = await ghostEncrypt(
        plaintext,
        ghostPublicKeyPem
    )

    await axios.post(`${BASE_URL}/messages/send`, {
        recipient_short_code: recipientShortCode,
        payload: {
            ciphertext:   ciphertextB64,
            message_type: messageType,
            ghost_ciphertext,
            ghost_ephemeral_pub,
        }
    }, {
        headers: { Authorization: `Bearer ${token}` }
    })
}