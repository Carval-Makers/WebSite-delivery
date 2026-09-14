import { getSupabase } from '../utils/supabase'

export default defineEventHandler(async (event) => {
  try {
    const supabase = getSupabase()
    
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString()
    await supabase.from('online_locations').delete().lt('lastupdate', oneMinuteAgo)
    
    const { data: locations, error } = await supabase.from('online_locations').select('*')
    
    if (error) throw error
    
    // Convert column names back to camelCase for the frontend
    const mapped = locations?.map(loc => ({
      userId: loc.userid,
      name: loc.name,
      lat: loc.lat,
      lng: loc.lng,
      lastUpdate: loc.lastupdate
    })) || []
    
    return mapped
  } catch (error) {
    console.error('Erro ao listar localizações:', error)
    return []
  }
})
