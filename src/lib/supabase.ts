import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://zhkgdbjhcignpcspllso.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export type Skill = {
  id: string
  user_id: string
  class_id: string
  name: string
  display_order: number
  created_at: string
}

export type SkillMastery = {
  id: string
  user_id: string
  skill_id: string
  student_id: string
  level: 0 | 1 | 2 | 3
  updated_at: string
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
