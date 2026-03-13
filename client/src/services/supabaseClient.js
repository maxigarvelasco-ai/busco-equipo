import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://pmgznkvcvpwvephivvur.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtZ3pua3ZjdnB3dmVwaGl2dnVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMjU4MTQsImV4cCI6MjA4ODkwMTgxNH0.BBW--W7euRGLmfW9mYvpgPGicRIr9S2lHaXdSzVG4nU'

export const supabase = createClient(supabaseUrl, supabaseKey)
