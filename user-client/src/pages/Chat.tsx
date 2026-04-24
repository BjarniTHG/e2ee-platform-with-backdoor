import { useContext, useEffect, useState } from "react"
import { SocketContext } from "../context/SocketContext"
import { useParams } from "react-router-dom"

export default function Chat() {
  const socket = useContext(SocketContext)
  const { shortCode } = useParams()
  const [messages, setMessages] = useState<any[]>([])
  const [text, setText] = useState("")

  useEffect(() => {
    if (!socket) return;
    socket.on("receive_message", (msg) => {
      setMessages((m) => [...m, msg])
    });
    return () => socket.off("receive_message")
  }, [socket])

  async function send() {
    // TODO later: encrypt with double ratchet
    const payload = { ciphertext: "TODO" }

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050'
    await fetch(`${API_URL}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
      body: JSON.stringify({
        recipient_short_code: shortCode,
        payload,
      }),
    })

    setMessages((m) => [...m, { self: true, text }]);
    setText("")
  }

  return (
    <div>
      <h2>Chat with {shortCode}</h2>

      <div className="messages">
        {messages.map((m, i) => (
          <div key={i} className={m.self ? "me" : "them"}>
            {m.text || "[encrypted]"}
          </div>
        ))}
      </div>

      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a message..."
      />
      <button onClick={send}>Send</button>
    </div>
  )
}