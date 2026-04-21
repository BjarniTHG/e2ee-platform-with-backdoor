import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001'

export async function login(username: string, password: string): Promise<string> {
    const response = await axios.post(`${BASE_URL}/auth/login`, { username, password })
    return response.data.token
}