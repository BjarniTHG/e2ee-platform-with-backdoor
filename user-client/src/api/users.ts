import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050'

export async function userExists(token: string, shortCode: string): Promise<boolean> {
    try {
        await axios.get(`${BASE_URL}/users/exists/${shortCode}`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        return true
    } catch {
        return false
    }
}