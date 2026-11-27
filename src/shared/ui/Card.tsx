import { Info } from 'lucide-react';
import { getIcon } from './Icon';
// 👇 Correction du chemin d'import (remontée de 2 niveaux)
import type { PopularCardData } from '../../config/types';

interface CardProps {
  data: PopularCardData;
  onClick?: () => void;
}

export default function PopularCard({ data, onClick }: CardProps) {
  const IconCmp = getIcon(data.icon);
  return (
    <div className="card" data-genre={data.genre} onClick={onClick}>
      <div className="card-img-placeholder">
        {data.coverUrl ? (
          <img className="cover-fill" src={data.coverUrl} alt="" loading="lazy" />
        ) : (
          <IconCmp size={56} />
        )}
      </div>
      <div className="card-body">
        <div className="card-text">
          <h4 title={data.title}>{data.title}</h4>
          <span className="card-sub">{data.sub}</span>
        </div>
        <span className="card-tag">{data.tag}</span>
      </div>
    </div>
  );
}

interface CatalogueCardProps {
  tag: string;
  genre: string;
  onClick?: () => void;
}

export function CatalogueCard({ tag, genre, onClick }: CatalogueCardProps) {
  return (
    <div className="card" data-genre={genre} onClick={onClick}>
      <div className="card-body">
        <div className="card-meta">
          <span className="card-tag">{tag}</span>
          <span className="card-hint">
            <Info size={12} />
          </span>
        </div>
      </div>
    </div>
  );
}
