export type Meeting = {
  id: string
  title: string
  start_time: string | null
  end_time: string | null
  created_at: string
}
export type Segment = {
  id: string
  content: string
  end_time: number
  meeting_id: string
  start_time: number
}
