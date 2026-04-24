import { useContext, useEffect, useState } from "react"
import { SocketContext } from "../context/SocketContext"
import { useParams } from "react-router-dom"
import { sendMessage } from "../api/messages"

export default function Chat() {
  const socket = useContext(SocketContext)
  const { shortCode } = useParams()
  const [messages, setMessages] = useState<any[]>([])
  const [text, setText] = useState("")

  useEffect(() => {
    if (!socket) return;
      socket.on("receive_message", (msg) => {
        setMessages((m) => [...m, { 
          self: false, 
          text: msg.payload?.ciphertext || "[encrypted]"
        }])
      })
    return () => { socket.off("receive_message") }
  }, [socket])

  async function send() {
    if (!text || !shortCode) return
    const token = localStorage.getItem("token") || ""
    await sendMessage(token, shortCode, text, 1, text)
    setMessages((m) => [...m, { self: true, text }])
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