import { DownloadSimple, ShareNetwork } from '@phosphor-icons/react';
import { useState } from 'react';
import { SheetFrame } from '../components/sheet';
import { Button, Segmented } from '../components/ui';
import { RecapCard } from './Recap';

export function ShareSheet() {
  const [format, setFormat] = useState<'square' | 'linkedin'>('square');
  return (
    <SheetFrame title="Partager le récap">
      <div className="px-4 pt-2">
        <p className="text-[17px] font-bold">Partager le récap</p>
        <p className="text-xs text-muted">Image générée automatiquement à la fin de la saison.</p>
        <Segmented className="mt-3" value={format} onChange={setFormat} options={[{ value: 'square', label: 'Carré (Instagram)' }, { value: 'linkedin', label: 'LinkedIn (1,91:1)' }]} />
        <div className="mx-auto mt-3" style={{ maxWidth: format === 'square' ? 320 : '100%' }}>
          <RecapCard wide={format === 'linkedin'} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Button variant="secondary" className="px-2 text-sm"><DownloadSimple size={18} /> Enregistrer</Button>
          <Button variant="secondary" className="px-2 text-sm">LinkedIn</Button>
          <Button variant="gold" className="px-2 text-sm"><ShareNetwork size={18} /> Autre</Button>
        </div>
      </div>
    </SheetFrame>
  );
}
