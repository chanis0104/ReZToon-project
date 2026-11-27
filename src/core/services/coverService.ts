import { supabase } from '../lib/supabase';

const BUCKET = 'manga-covers';
const MAX_BYTES = 5 * 1024 * 1024;

/** Valide une image de couverture ; retourne un message d'erreur ou null. */
export function validateCoverFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'Le fichier doit être une image.';
  if (file.size > MAX_BYTES) return "L'image dépasse 5 Mo.";
  return null;
}

/** Téléverse une couverture (série ou chapitre) et retourne son URL publique. */
export async function uploadCover(
  file: File,
  userId: string,
  kind: 'series' | 'chapter',
): Promise<string> {
  const invalid = validateCoverFile(file);
  if (invalid) throw new Error(invalid);

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  // Le 1er dossier = id utilisateur (exigé par la politique de storage).
  const path = `${userId}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext || 'jpg'}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
    cacheControl: '31536000',
  });
  if (error) throw new Error(`Téléversement de la couverture impossible : ${error.message}`);

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
