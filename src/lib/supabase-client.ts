
import { createClient } from '@supabase/supabase-js'
import { projectId, publicKey } from './constants';

export const supabase = createClient("https://" + projectId + ".supabase.co", publicKey);
