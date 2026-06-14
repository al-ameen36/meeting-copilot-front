export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type ChatRequestBody = {
  query: string
  history: Array<ChatMessage>
}
