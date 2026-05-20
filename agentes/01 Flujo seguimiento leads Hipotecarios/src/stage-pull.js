import { supabase } from './clients.js';

// Mapeo amigable → nombre exacto del stage en GHL
export const STAGE_ALIAS = {
  'agente':              'Ingreso - Test Agent IA',
  'lead':                'Ingreso',
  'calificacion-asesor': 'Calificación Asesor',
  'calif-asesor':        'Calificación Asesor'
};

export function resolveStageName(input) {
  if (!input) return null;
  const norm = input.toLowerCase().trim();
  if (STAGE_ALIAS[norm]) return STAGE_ALIAS[norm];
  // Pasar tal cual si el user puso el nombre exacto
  return input;
}

/**
 * Pull leads del pipeline Credito Hipotecario en el stage indicado.
 * Devuelve filas raw de Supabase (mismo schema que usa Alejandra).
 */
export async function pullLeadsInStage(stageName) {
  const { data, error } = await supabase
    .from('leads')
    .select('contact_id, opp_id, nombre, bot_full_name, telefono, tags, stage_name, pipeline_name, bot_stage, bot_followup_count, bot_last_msg_at, bot_retake_scheduled_at, bot_appointment_at, bot_profile, bot_intent, ultima_actividad, ghl_updated_at, eventos')
    .eq('stage_name', stageName)
    .eq('pipeline_name', 'Credito Hipotecario')
    .order('ghl_updated_at', { ascending: false });
  if (error) throw new Error(`Supabase pull falló: ${error.message}`);
  return data || [];
}
