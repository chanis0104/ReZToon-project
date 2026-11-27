/**
 * Transforme une erreur Supabase/PostgREST en message lisible.
 * 403 / 42501 = politique RLS manquante ou refusée.
 */
export function explainDbError(
  error: { code?: string; message?: string; status?: number } | null | undefined,
  fallback = 'Une erreur est survenue. Réessayez.',
): string {
  if (!error) return fallback;
  const code = error.code;
  const status = (error as { status?: number }).status;
  if (code === '42501' || status === 403) {
    return (
      "Action refusée par la base de données (RLS). Exécutez le script " +
      'supabase/migrations/20261126_reviews_comments_covers.sql dans Supabase > SQL Editor.'
    );
  }
  if (code === '23505') return 'Cet élément existe déjà.';
  if (code === '23503') return 'Élément lié introuvable (série, chapitre ou profil supprimé ?).';
  if (code === '23514') return 'Une valeur ne respecte pas les contraintes autorisées.';
  return error.message || fallback;
}
