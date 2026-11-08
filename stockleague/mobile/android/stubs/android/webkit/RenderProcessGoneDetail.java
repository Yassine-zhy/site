package android.webkit;

// Déclaration de compilation uniquement (API 26) : la vraie classe est fournie par Android.
public abstract class RenderProcessGoneDetail {
  public abstract boolean didCrash();
  public abstract int rendererPriorityAtExit();
}
