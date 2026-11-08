import { CaretLeft } from '@phosphor-icons/react';
import { useState } from 'react';
import { Button, Glyph, LogoMark } from '../components/ui';

/** Connexion par lien magique ou Google (visuel ; branché sur Supabase à l'étape suivante). */
export function LoginScreen({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const submit = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Adresse email invalide.');
    setError('');
    setSent(true);
  };

  return (
    <div className="flex min-h-dvh flex-col px-5 pt-[max(env(safe-area-inset-top),12px)] pb-[max(env(safe-area-inset-bottom),20px)]">
      <button onClick={onBack} className="press -ml-2 grid size-11 place-items-center rounded-[2px]" aria-label="Retour"><CaretLeft size={24} weight="bold" /></button>
      <LogoMark size={44} />
      <h1 className="display mt-5 text-[46px]">{sent ? 'Regarde tes emails' : 'Connexion'}</h1>

      {sent ? (
        <div className="anim-fade mt-4">
          <Glyph name="envelope-with-arrow" size={64} />
          <p className="mt-4 text-[15px] text-ink-2">Un lien de connexion a été envoyé à <b className="text-ink">{email}</b>. Touche-le depuis ce téléphone. Pense à vérifier les spams.</p>
          <Button className="mt-8 w-full" onClick={onDone}>Continuer avec la démo</Button>
          <button onClick={() => setSent(false)} className="mt-3 w-full text-sm font-semibold text-muted underline underline-offset-4">Changer d’adresse</button>
        </div>
      ) : (
        <>
          <p className="mt-2 text-[14px] text-muted">Pas de mot de passe : on t’envoie un lien par email. Première fois ? Ton compte est créé automatiquement.</p>
          <label className="mt-6 block text-sm font-bold" htmlFor="email">Adresse email</label>
          <input id="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom@exemple.com" className="mt-1.5 h-12 w-full rounded-[2px] border border-line-2 bg-card px-3 text-[15px] outline-none focus:border-ink" aria-invalid={!!error} />
          {error ? <p className="mt-1.5 text-sm font-semibold text-loss" role="alert">{error}</p> : null}
          <Button className="mt-3 w-full" onClick={submit}>Recevoir mon lien de connexion</Button>
          <div className="my-5 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />ou<span className="h-px flex-1 bg-line" /></div>
          <Button variant="secondary" className="w-full" onClick={onDone}>
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
              <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8Z" />
              <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23Z" />
              <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.7-2.8Z" />
              <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4Z" />
            </svg>
            Continuer avec Google
          </Button>
          <p className="mt-auto pt-8 text-center text-[11px] text-muted">En continuant, tu acceptes que tout soit fictif : aucun argent réel, aucun gain réel.</p>
        </>
      )}
    </div>
  );
}
