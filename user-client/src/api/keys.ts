import axios from 'axios'
import type { ServerPrekeyBundle } from '../crypto/x3dh'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050'

const OPK_THRESHOLD = 5
const OPK_BATCH     = 20

export async function uploadPrekeyBundle(token: string, bundle: object): Promise<void> {
    await axios.post(`${BASE_URL}/keys/upload`, bundle, {
        headers: { Authorization: `Bearer ${token}` }
    })
}

export async function fetchPrekeyBundle(
    token: string,
    shortCode: string
): Promise<ServerPrekeyBundle> {
    const response = await axios.get(`${BASE_URL}/keys/${shortCode}`, {
        headers: { Authorization: `Bearer ${token}` }
    })
    return response.data
}

// OPK
export async function getOpkCount(token: string): Promise<number> {
    const response = await axios.get(`${BASE_URL}/keys/opk-count`, {
        headers: { Authorization: `Bearer ${token}` }
    })
    return response.data.opk_count
}

export async function uploadAdditionalOpks(token: string, opks: object[]): Promise<void> {
    await axios.post(`${BASE_URL}/keys/upload`, { opks }, {
        headers: { Authorization: `Bearer ${token}` }
    })
}

export async function replenishOpksIfNeeded(token: string): Promise<void> {
    const count = await getOpkCount(token)
    console.log(`[opk] ${count} OPKs remaining`)
    if (count < OPK_THRESHOLD) {
        console.log(`[opk] below threshold, replenishing...`)
        // Start new IDs from current timestamp to avoid collisions
        const startId = Date.now()
        const { generateAdditionalOpks } = await import('../crypto/keyGeneration')
        const opks    = await generateAdditionalOpks(startId, OPK_BATCH)
        await uploadAdditionalOpks(token, opks.map(opk => ({
            id:     opk.id,
            public: arrayBufferToBase64(opk.pubKey),
        })))
        console.log(`[opk] replenished ${OPK_BATCH} OPKs`)
    }
}