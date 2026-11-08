package android.webkit;

import android.net.Uri;

// Déclaration de compilation uniquement (API 21) : la vraie classe est fournie par Android.
// Placée avant android.jar dans le classpath pour exposer onShowFileChooser.
public class WebChromeClient {
  public WebChromeClient() {}

  public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
    return false;
  }

  public abstract static class FileChooserParams {
    public abstract String[] getAcceptTypes();
  }
}
