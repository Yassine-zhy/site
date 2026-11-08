import { Camera } from '@phosphor-icons/react';
import { useState } from 'react';
import { PhotoPicker } from '../components/photo-picker';
import { Avatar, Button, Glyph } from '../components/ui';
import { ME } from '../data/demo';
import { useStore } from '../state/store';

/** Après l'inscription : photo et pseudo, en 10 secondes. */
export function ProfileSetup() {
  const { pseudo, photo, patch } = useStore();
  const [name, setName] = useState(pseudo);
  const valid = name.trim().length >= 2 && name.trim().length <= 24;
  return (
    <div className="flex min-h-dvh flex-col px-5 pt-[max(env(safe-area-inset-top),24px)] pb-[max(env(safe-area-inset-bottom),20px)]">
      <p className="text-sm font-semibold text-muted">Étape 1 sur 2</p>
      <h1 className="display mt-1 text-[46px]">Ton profil de joueur</h1>
      <p className="mt-2 text-[14px] text-ink-2">C’est ce que tes amis verront au classement et dans le fil d’activité.</p>

      <div className="mt-8 flex flex-col items-center">
        <PhotoPicker onDone={(d) => patch({ photo: d })} className="press relative">
          <Avatar id={ME} size={132} />
          <span className="absolute -right-2 -bottom-2 grid size-11 place-items-center rounded-[2px] border-4 border-bg bg-gold text-gold-ink"><Camera size={20} weight="bold" /></span>
        </PhotoPicker>
        <p className="mt-3 text-sm font-semibold">{photo ? 'Belle photo. Touche-la pour la changer.' : 'Ajoute ta photo depuis ta galerie'}</p>
      </div>

      <label htmlFor="pseudo" className="mt-8 block text-sm font-bold">Pseudo</label>
      <input id="pseudo" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} className="mt-1.5 h-12 w-full rounded-[2px] border border-line-2 bg-card px-3 text-[17px] font-semibold outline-none focus:border-ink" autoComplete="nickname" />
      <p className="mt-1.5 text-xs text-muted">2 à 24 caractères.</p>

      <div className="mt-auto pt-8">
        <div className="mb-4 flex items-center gap-3 rounded-[2px] border border-line bg-card p-3">
          <Glyph name="wrapped-gift" size={32} />
          <p className="text-xs text-ink-2"><b className="text-ink">Cadeau de bienvenue :</b> tu démarres avec 10 000 $ fictifs et une ligue de démo déjà lancée.</p>
        </div>
        <Button className="w-full" disabled={!valid} onClick={() => patch({ pseudo: name.trim(), profileDone: true })}>C’est parti</Button>
      </div>
    </div>
  );
}
