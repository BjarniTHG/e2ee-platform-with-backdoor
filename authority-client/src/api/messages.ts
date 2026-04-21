import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001'

export interface InterceptedMessage {
    id:           number
    sender_id:    string
    recipient_id: string
    plaintext?:   string
    error?:       string
    created_at:   string
}

export async function retrieveMessages(
    token:                  string,
    senderShortCode?:       string,
    recipientShortCode?:    string
): Promise<InterceptedMessage[]> {
    const params: any = {}
    if (senderShortCode) params.sender_id = senderShortCode
    if (recipientShortCode) params.recipient_id = recipientShortCode

    const response = await axios.get(`${BASE_URL}/messages/retrieve`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
    })
    return response.data
}