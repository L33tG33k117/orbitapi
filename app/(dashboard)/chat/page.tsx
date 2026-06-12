import { ChatUI } from './chat-ui'

export default function ChatPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-8 py-5 border-b shrink-0">
        <h1 className="text-2xl font-bold">Orbit Assistant</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Talk to your connected APIs in plain English
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <ChatUI />
      </div>
    </div>
  )
}
