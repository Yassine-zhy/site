import { Camera, MagnifyingGlassMinus, MagnifyingGlassPlus } from '@phosphor-icons/react';
import { useRef, useState, type PointerEvent } from 'react';
import { haptic } from '../lib/haptics';
import { Button, cx } from './ui';

const OUT = 320; // taille finale de la photo (px)

/**
 * Choisir une photo dans la galerie puis la recadrer (glisser pour déplacer, zoom).
 * La photo est réduite à 320 × 320 px et enregistrée sur le téléphone.
 */
export function PhotoPicker({ onDone, children, className }: { onDone: (dataUrl: string) => void; children: React.ReactNode; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState('');

  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return setError('Ce fichier n’est pas une image.');
    if (f.size > 15 * 1024 * 1024) return setError('Image trop lourde (15 Mo maximum).');
    setError('');
    const reader = new FileReader();
    reader.onload = () => setSrc(String(reader.result));
    reader.readAsDataURL(f);
  };

  return (
    <>
      <button type="button" onClick={() => input.current?.click()} className={className}>{children}</button>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
      {error ? <p role="alert" className="mt-2 text-sm font-semibold text-loss">{error}</p> : null}
      {src ? <Cropper src={src} onCancel={() => setSrc(null)} onDone={(d) => { setSrc(null); onDone(d); haptic('success'); }} /> : null}
    </>
  );
}

function Cropper({ src, onCancel, onDone }: { src: string; onCancel: () => void; onDone: (d: string) => void }) {
  const FRAME = 280;
  const img = useRef<HTMLImageElement>(null);
  const [nat, setNat] = useState({ w: 1, h: 1 });
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const base = FRAME / Math.min(nat.w, nat.h); // l'image couvre tout le cadre à zoom 1
  const scale = base * zoom;
  const w = nat.w * scale, h = nat.h * scale;
  const clamp = (p: { x: number; y: number }) => ({ x: Math.min(0, Math.max(FRAME - w, p.x)), y: Math.min(0, Math.max(FRAME - h, p.y)) });

  const onLoad = () => {
    const i = img.current!;
    setNat({ w: i.naturalWidth, h: i.naturalHeight });
    const s = FRAME / Math.min(i.naturalWidth, i.naturalHeight);
    setPos({ x: (FRAME - i.naturalWidth * s) / 2, y: (FRAME - i.naturalHeight * s) / 2 });
  };
  const setZoomCentered = (z: number) => {
    const c = { x: (FRAME / 2 - pos.x) / scale, y: (FRAME / 2 - pos.y) / scale };
    const ns = base * z;
    setZoom(z);
    setPos(clampWith({ x: FRAME / 2 - c.x * ns, y: FRAME / 2 - c.y * ns }, nat.w * ns, nat.h * ns));
  };
  const clampWith = (p: { x: number; y: number }, ww: number, hh: number) => ({ x: Math.min(0, Math.max(FRAME - ww, p.x)), y: Math.min(0, Math.max(FRAME - hh, p.y)) });

  const down = (e: PointerEvent) => { (e.target as Element).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }; };
  const move = (e: PointerEvent) => { const d = drag.current; if (d) setPos(clamp({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y })); };

  const save = () => {
    const c = document.createElement('canvas');
    c.width = c.height = OUT;
    const ctx = c.getContext('2d')!;
    const k = OUT / FRAME;
    ctx.drawImage(img.current!, pos.x * k, pos.y * k, w * k, h * k);
    onDone(c.toDataURL('image/jpeg', 0.86));
  };

  return (
    <div className="anim-fade fixed inset-0 z-[80] flex flex-col items-center justify-center bg-[#050b14]/92 px-6 text-white" role="dialog" aria-modal="true" aria-label="Recadrer la photo">
      <p className="display text-[30px]">Recadre ta photo</p>
      <p className="mt-1 text-sm opacity-70">Fais glisser pour la placer.</p>
      <div
        className="relative mt-5 touch-none overflow-hidden rounded-[2px]"
        style={{ width: FRAME, height: FRAME, boxShadow: '0 0 0 3px #F2B705' }}
        onPointerDown={down} onPointerMove={move} onPointerUp={() => (drag.current = null)}
      >
        <img ref={img} src={src} onLoad={onLoad} alt="" draggable={false} className="absolute max-w-none select-none" style={{ left: pos.x, top: pos.y, width: w, height: h }} />
      </div>
      <div className="mt-5 flex w-full max-w-[280px] items-center gap-3">
        <MagnifyingGlassMinus size={20} />
        <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoomCentered(Number(e.target.value))} className={cx('flex-1 accent-[#F2B705]')} aria-label="Zoom" />
        <MagnifyingGlassPlus size={20} />
      </div>
      <div className="mt-6 grid w-full max-w-[280px] grid-cols-2 gap-2">
        <Button variant="secondary" className="border-white/20 bg-transparent text-white" onClick={onCancel}>Annuler</Button>
        <Button variant="gold" onClick={save}><Camera size={18} weight="bold" /> Utiliser</Button>
      </div>
    </div>
  );
}
