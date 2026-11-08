import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { avatarColorOf, initialsOf } from "@/lib/avatar";
import { cn } from "@/lib/utils";

type Props = { pseudo: string; seed?: string; avatarUrl?: string | null; className?: string };

/** Avatar d'un joueur : photo si disponible, sinon initiales sur une couleur stable. */
export function PlayerAvatar({ pseudo, seed, avatarUrl, className }: Props) {
  return (
    <Avatar className={cn("size-9", className)}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt="" referrerPolicy="no-referrer" /> : null}
      <AvatarFallback className="text-xs font-semibold text-white" style={{ backgroundColor: avatarColorOf(seed ?? pseudo) }}>
        {initialsOf(pseudo)}
      </AvatarFallback>
    </Avatar>
  );
}
