import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050'

export interface ContactRequest {
    conversation_id:   number
    sender_short_code: string
    payload:           any
    created_at:        string
}

export interface Conversation {
    id:         number
    short_code: string
    status:     string
    initiated:  boolean
    created_at: string
}

export async function startConversation(
    token: string,
    recipientShortCode: string,
    payload: object
): Promise<{ conversation_id: number }> {
    const response = await axios.post(`${BASE_URL}/conversations/start`, {
        recipient_short_code: recipientShortCode,
        payload,
    }, {
        headers: { Authorization: `Bearer ${token}` }
    })
    return response.data
}

export async function acceptConversation(
    token: string,
    conversationId: number
): Promise<void> {
    await axios.post(`${BASE_URL}/conversations/accept`, {
        conversation_id: conversationId,
    }, {
        headers: { Authorization: `Bearer ${token}` }
    })
}

export async function ignoreConversation(
    token: string,
    conversationId: number
): Promise<void> {
    await axios.post(`${BASE_URL}/conversations/ignore`, {
        conversation_id: conversationId,
    }, {
        headers: { Authorization: `Bearer ${token}` }
    })
}

export async function getConversations(token: string): Promise<Conversation[]> {
    const response = await axios.get(`${BASE_URL}/conversations/`, {
        headers: { Authorization: `Bearer ${token}` }
    })
    return response.data
}

export async function getContactRequests(token: string): Promise<ContactRequest[]> {
    const response = await axios.get(`${BASE_URL}/conversations/requests`, {
        headers: { Authorization: `Bearer ${token}` }
    })
    return response.data
}