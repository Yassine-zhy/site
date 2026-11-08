"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type ProfileState, updateProfile } from "./actions";

export function ProfileForm({ pseudo }: { pseudo: string }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateProfile, { status: "idle" });

  useEffect(() => {
    if (state.status === "saved") toast.success(state.message);
  }, [state]);

  return (
    <form action={action} className="space-y-2">
      <Label htmlFor="pseudo">Pseudo</Label>
      <div className="flex gap-2">
        <Input
          id="pseudo"
          name="pseudo"
          defaultValue={pseudo}
          maxLength={24}
          autoComplete="nickname"
          aria-invalid={state.status === "error" || undefined}
          aria-describedby="pseudo-help"
          className="h-11"
        />
        <Button type="submit" className="h-11" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Enregistrer
        </Button>
      </div>
      <p id="pseudo-help" className={state.status === "error" ? "text-sm text-destructive" : "text-xs text-muted-foreground"}>
        {state.status === "error" ? state.message : "Visible par les joueurs de tes ligues. 2 à 24 caractères."}
      </p>
    </form>
  );
}
