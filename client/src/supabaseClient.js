import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://osrlezlnimaknoxowswe.supabase.co'; // 👈 Paste your URL here again
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zcmxlemxuaW1ha25veG93c3dlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NTIzNTMsImV4cCI6MjA3MzUyODM1M30.Wbf7LUofMxbr6QkxEZYJzN_3TxNBP7TNwOLfRNA7pjA'; // 👈 Paste your Key here again

export const supabase = createClient(supabaseUrl, supabaseKey);