export interface User {
  id: string
  display_name: string
  email: string
  google_id: string
  created_at: string
}

export interface OffenseToken {
  type: "text" | "mention"
  value?: string
  user_id?: string
}

export interface Bong {
  id: string
  submitter: User
  subjects: User[]
  offense_tokens: OffenseToken[]
  tier: string | null
  score: string | null
  llm_response: string | null
  cosign_count: number
  created_at: string
}

export interface LeaderboardEntry {
  rank: number
  user_id: string
  display_name: string
  bong_count: number
  total_score: string
  highest_score: string
  cosign_count: number
}
