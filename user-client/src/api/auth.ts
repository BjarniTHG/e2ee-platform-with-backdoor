const API_URL = import.meta.env.VITE_API_URL;

export async function registerUser() {
  const res = await fetch(`${API_URL}/auth/register`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to register")
  return res.json()
}

export async function validateUser(token: string) {
  const res = await fetch(`${API_URL}/auth/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  return res.json()
}