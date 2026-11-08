import { Minus, Plus } from '@phosphor-icons/react';
import { useState } from 'react';
import { Button, Emoji, ScreenHeader, Segmented, Tag, cx } from '../components/ui';
import { formatDate, formatUSD } from '../lib/format';
import { useNav } from '../state/nav';
import { InviteCard } from './LeagueSettings';

export function CreateLeagueScreen() {
  const { pop } = useNav();
  const [name, setName] = useState('');
  const [cash, setCash] = useState('10000');
  const [months, setMonths] = useState('2');
  const [fee, setFee] = useState('0');
  const [max, setMax] = useState(8);
  const [created, setCreated] = useState(false);
  const start = new Date(Date.now() + 2 * 86400000);
  const end = new Date(start.getTime() + Number(months) * 30 * 86400000);
  const valid = name.trim().length >= 3;

  if (created) {
    return (
      <div className="pb-10">
        <ScreenHeader title="Ligue créée" />
        <div className="px-4 pt-6 text-center">
          <Emoji name="party-popper" size={72} className="anim-pop mx-auto" />
          <p className="display mt-4 text-[34px]">{name}</p>
          <p className="mt-1 text-sm text-muted">Début le {formatDate(start)}. Invite tes amis maintenant.</p>
          <InviteCard code="M3TZ7Q" className="mt-6 text-left" />
          <Button variant="secondary" className="mt-4 w-full" onClick={pop}>Retour à mes ligues</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <ScreenHeader title="Nouvelle ligue" />
      <div className="space-y-5 px-4 pt-4">
        <Field label="Nom de la ligue">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Ex. Les Loups de la L3" className="h-12 w-full rounded-btn border border-line-2 bg-card px-3 text-[15px] outline-none focus:border-ink" />
        </Field>
        <Field label="Capital de départ (fictif)">
          <Segmented value={cash} onChange={setCash} options={[{ value: '5000', label: '5 000 $' }, { value: '10000', label: '10 000 $' }, { value: '25000', label: '25 000 $' }, { value: '100000', label: '100 000 $' }]} />
        </Field>
        <Field label="Durée de la saison" hint={`Du ${formatDate(start)} au ${formatDate(end)}`}>
          <Segmented value={months} onChange={setMonths} options={[{ value: '1', label: '1 mois' }, { value: '2', label: '2 mois' }, { value: '3', label: '3 mois' }]} />
        </Field>
        <Field label="Frais par ordre (fictifs)" hint="Des frais limitent les allers-retours et récompensent la patience.">
          <Segmented value={fee} onChange={setFee} options={[{ value: '0', label: 'Aucun' }, { value: '1', label: '1 $' }, { value: '5', label: '5 $' }]} />
        </Field>
        <Field label="Nombre maximum de joueurs">
          <div className="flex items-center justify-between rounded-btn border border-line bg-card p-1.5">
            <button onClick={() => setMax(Math.max(2, max - 1))} className="press grid size-10 place-items-center rounded-[9px] bg-card-2" aria-label="Moins"><Minus size={18} weight="bold" /></button>
            <span className="display text-[28px] nums">{max}</span>
            <button onClick={() => setMax(Math.min(50, max + 1))} className="press grid size-10 place-items-center rounded-[9px] bg-card-2" aria-label="Plus"><Plus size={18} weight="bold" /></button>
          </div>
        </Field>
        <Field label="Marchés autorisés">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 rounded-btn border-2 border-ink bg-card p-3"><span className="text-xl">🇺🇸</span><span className="text-sm font-bold">États-Unis</span></div>
            <div className={cx('flex items-center gap-2 rounded-btn border border-line bg-card p-3 opacity-50')}><span className="text-xl">🇨🇦</span><span className="text-sm font-bold">Toronto</span><Tag className="ml-auto">Bientôt</Tag></div>
          </div>
        </Field>
        <div className="rounded-tile border border-line bg-card-2 p-3 text-xs text-ink-2">
          Chaque joueur reçoit <b>{formatUSD(Number(cash))}</b> fictifs. Tu seras admin : tu pourras modifier ces réglages jusqu’au début de la saison.
        </div>
        <Button className="w-full" disabled={!valid} onClick={() => setCreated(true)}>Créer la ligue</Button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-bold">{label}</p>
      {children}
      {hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
