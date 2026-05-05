/**
 * PinButton — small icon attached to any card.
 *
 * Pins the card's payload into the artifactStore so it survives across
 * sessions and stays accessible from the right-edge ArtifactRail.
 */

import { useState } from 'react';
import { Pin, Check } from 'lucide-react';
import { useArtifactStore } from '../state/artifactStore';

interface Props {
  cardType: string;
  payload: any;
  /** Stable id; prevents duplicate pins of the same source card. */
  cardId?: string;
  title?: string;
  sourceSessionId?: string;
  sourceMessageId?: string;
  className?: string;
}

export function PinButton({
  cardType,
  payload,
  cardId,
  title,
  sourceSessionId,
  sourceMessageId,
  className,
}: Props) {
  const pin = useArtifactStore((s) => s.pin);
  const setOpen = useArtifactStore((s) => s.setOpen);
  const alreadyPinned = useArtifactStore((s) =>
    cardId ? s.artifacts.some((a) => a.id === cardId) : false,
  );
  const [justPinned, setJustPinned] = useState(false);

  const handle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (alreadyPinned) return;
    pin({
      id: cardId ?? `pin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      cardType,
      payload,
      title,
      sourceSessionId,
      sourceMessageId,
    });
    setJustPinned(true);
    setOpen(true);
    setTimeout(() => setJustPinned(false), 1500);
  };

  return (
    <button
      onClick={handle}
      title={alreadyPinned ? 'Pinned' : 'Pin to artifacts rail'}
      className={`p-1 rounded text-white/40 hover:text-amber-300 transition-colors ${
        alreadyPinned || justPinned ? 'text-amber-300' : ''
      } ${className ?? ''}`}
    >
      {justPinned || alreadyPinned ? <Check className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
    </button>
  );
}
