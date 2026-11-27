import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { validateCoverFile } from '../../core/services/coverService';
import { useT } from '../../config/i18n';

export interface CoverPickerValue {
  /** Nouveau fichier choisi (à téléverser à l'enregistrement). */
  file: File | null;
  /** true = l'utilisateur a retiré la couverture existante. */
  removed: boolean;
}

interface CoverPickerProps {
  label: string;
  /** URL de la couverture déjà enregistrée (modification). */
  currentUrl?: string | null;
  value: CoverPickerValue;
  onChange: (next: CoverPickerValue) => void;
  aspect?: 'portrait' | 'landscape';
  disabled?: boolean;
}

/** Sélecteur d'image de couverture — toujours facultatif. */
export default function CoverPicker({
  label,
  currentUrl,
  value,
  onChange,
  aspect = 'portrait',
  disabled,
}: CoverPickerProps) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!value.file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(value.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value.file]);

  const shown = preview ?? (value.removed ? null : currentUrl ?? null);

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const invalid = validateCoverFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    onChange({ file, removed: false });
  };

  const handleRemove = () => {
    setError(null);
    onChange({ file: null, removed: Boolean(currentUrl) });
  };

  return (
    <div className="creator-form-group cover-picker">
      <label>
        {label} <span className="cover-picker-optional">({t.coverForm.optional})</span>
      </label>

      <div className="cover-picker-row">
        <div className={`cover-picker-preview ${aspect}`}>
          {shown ? (
            <img src={shown} alt="" />
          ) : (
            <ImagePlus size={26} aria-hidden="true" />
          )}
        </div>

        <div className="cover-picker-actions">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handlePick}
            disabled={disabled}
          />
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
          >
            <ImagePlus size={14} /> {shown ? t.coverForm.change : t.coverForm.choose}
          </button>
          {shown && (
            <button
              type="button"
              className="btn btn-outline cover-picker-remove"
              onClick={handleRemove}
              disabled={disabled}
            >
              <X size={14} /> {t.coverForm.remove}
            </button>
          )}
          <span className="creator-char-counter">{t.coverForm.hint}</span>
          {error && <span className="form-message error" role="alert">{error}</span>}
        </div>
      </div>
    </div>
  );
}
