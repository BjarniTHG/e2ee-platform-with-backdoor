import { createContext, useContext, useEffect, useState } from "react"
import { io, Socket } from "socket.io-client"
import { AuthContext } from "./AuthContext"

export const SocketContext = createContext<Socket | null>(null)

export function SocketProvider({ children }) {
  const { token, loading } = useContext(AuthContext);
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    if (loading || !token) return

    const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050'
    const s = io(SOCKET_URL, { auth: { token } })
    setSocket(s)

    return () => s.disconnect()
  }, [token, loading]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}