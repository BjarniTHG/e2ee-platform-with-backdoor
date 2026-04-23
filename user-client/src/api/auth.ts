import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050'


export interface RegisterResponse {
    token: string
    short_code: string
}

export async function registerUser(): Promise<RegisterResponse> {
    const response = await axios.post(`${BASE_URL}/auth/register`)
    return response.data
}


export async function validateUser(token: string): Promise<{ valid: boolean; short_code: string }> {
    const response = await axios.post(`${BASE_URL}/auth/validate`, { token })
    return response.data
}

export const register = registerUser
export const validate = validateUser