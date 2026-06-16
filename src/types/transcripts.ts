export type Meeting = {
  id: string
  title: string
  start_time: string | null
  end_time: string | null
  createdAt: string
}
export type Segment = {
  id: string
  text: string
  end: number
  meetingId: string
  start: number
  speaker?: string
}
