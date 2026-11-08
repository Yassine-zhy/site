package com.stockleague.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.Map;

/**
 * StockLeague sur Android : l'interface (React) est embarquée dans l'APK et servie
 * hors-ligne depuis une origine https locale, pour que localStorage, fetch() et les
 * modules fonctionnent comme dans un navigateur.
 */
public class MainActivity extends Activity {
  static final String ORIGIN = "https://appassets.androidplatform.net/";
  static final int BOARD = 0xFF0B1A30;
  static final int LIGHT_STATUS_BAR = 0x2000; // View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR (API 23)
  static final int LIGHT_NAV_BAR = 0x10; // View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR (API 26)
  static final Map<String, String> MIME = new HashMap<String, String>();
  static {
    MIME.put("html", "text/html");
    MIME.put("js", "text/javascript");
    MIME.put("css", "text/css");
    MIME.put("json", "application/json");
    MIME.put("png", "image/png");
    MIME.put("jpg", "image/jpeg");
    MIME.put("webp", "image/webp");
    MIME.put("svg", "image/svg+xml");
    MIME.put("ico", "image/x-icon");
    MIME.put("woff2", "font/woff2");
    MIME.put("woff", "font/woff");
  }

  WebView web;

  @Override
  protected void onCreate(Bundle state) {
    super.onCreate(state);
    getWindow().getDecorView().setBackgroundColor(BOARD);
    bars(BOARD, false);
    open();
  }

  void open() {
    web = new WebView(this);
    web.setBackgroundColor(BOARD);
    web.setOverScrollMode(View.OVER_SCROLL_NEVER);
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setTextZoom(100);
    s.setSupportZoom(false);
    s.setBuiltInZoomControls(false);
    s.setDisplayZoomControls(false);
    s.setAllowFileAccess(false);
    s.setAllowContentAccess(false);
    web.addJavascriptInterface(new Bridge(), "StockLeagueApp");
    web.setWebChromeClient(new WebChromeClient());
    web.setWebViewClient(new WebViewClient() {
      @Override
      public WebResourceResponse shouldInterceptRequest(WebView v, String url) {
        return serve(url);
      }

      @Override
      public boolean shouldOverrideUrlLoading(WebView v, String url) {
        if (url.startsWith(ORIGIN)) return false;
        try {
          startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (Exception e) {
        }
        return true;
      }

      public boolean onRenderProcessGone(WebView v, RenderProcessGoneDetail d) {
        if (v == web) restart();
        return true;
      }
    });
    setContentView(web);
    web.loadUrl(ORIGIN + "index.html");
  }

  /** Appelé depuis JavaScript : couleur de la barre d'état assortie à l'écran affiché. */
  class Bridge {
    @JavascriptInterface
    public void setBars(final String color, final boolean darkIcons) {
      runOnUiThread(new Runnable() {
        @Override
        public void run() {
          try {
            bars(Color.parseColor(color), darkIcons);
          } catch (IllegalArgumentException e) {
          }
        }
      });
    }
  }

  void bars(int color, boolean darkIcons) {
    Window w = getWindow();
    call(w, "setStatusBarColor", new Class<?>[] {int.class}, color);
    call(w, "setNavigationBarColor", new Class<?>[] {int.class}, color);
    View d = w.getDecorView();
    int flags = d.getSystemUiVisibility() & ~(LIGHT_STATUS_BAR | LIGHT_NAV_BAR);
    if (darkIcons) flags |= LIGHT_STATUS_BAR | LIGHT_NAV_BAR;
    d.setSystemUiVisibility(flags);
  }

  void restart() {
    WebView old = web;
    web = null;
    if (old != null) {
      ((android.view.ViewGroup) old.getParent()).removeView(old);
      old.destroy();
    }
    open();
  }

  WebResourceResponse serve(String url) {
    if (url == null || !url.startsWith(ORIGIN)) return null;
    String path = url.substring(ORIGIN.length());
    int cut = path.indexOf('?');
    if (cut >= 0) path = path.substring(0, cut);
    cut = path.indexOf('#');
    if (cut >= 0) path = path.substring(0, cut);
    path = Uri.decode(path);
    if (path.length() == 0 || path.endsWith("/")) path += "index.html";
    if (path.contains("..")) return missing();
    String ext = path.substring(path.lastIndexOf('.') + 1).toLowerCase();
    String mime = MIME.containsKey(ext) ? MIME.get(ext) : "application/octet-stream";
    boolean text = mime.startsWith("text/") || mime.endsWith("json") || mime.endsWith("xml");
    try {
      InputStream in = getAssets().open("www/" + path);
      WebResourceResponse r = new WebResourceResponse(mime, text ? "utf-8" : null, in);
      Map<String, String> headers = new HashMap<String, String>();
      headers.put("Cache-Control", "no-cache");
      call(r, "setResponseHeaders", new Class<?>[] {Map.class}, headers);
      return r;
    } catch (IOException e) {
      return missing();
    }
  }

  WebResourceResponse missing() {
    InputStream empty = new ByteArrayInputStream(new byte[0]);
    try {
      return WebResourceResponse.class
          .getConstructor(String.class, String.class, int.class, String.class, Map.class, InputStream.class)
          .newInstance("text/plain", "utf-8", 404, "Not Found", new HashMap<String, String>(), empty);
    } catch (Exception e) {
      return new WebResourceResponse("text/plain", "utf-8", empty);
    }
  }

  @Override
  public void onBackPressed() {
    if (web == null) {
      super.onBackPressed();
      return;
    }
    ValueCallback<String> cb = new ValueCallback<String>() {
      @Override
      public void onReceiveValue(String handled) {
        if (!"true".equals(handled)) moveTaskToBack(true);
      }
    };
    // evaluateJavascript (API 19) appelé par réflexion : on compile contre une API plus ancienne.
    call(web, "evaluateJavascript", new Class<?>[] {String.class, ValueCallback.class},
        "window.__appBack ? !!window.__appBack() : false", cb);
  }

  @Override
  protected void onPause() {
    if (web != null) web.onPause();
    super.onPause();
  }

  @Override
  protected void onResume() {
    super.onResume();
    if (web != null) web.onResume();
  }

  @Override
  protected void onDestroy() {
    if (web != null) web.destroy();
    super.onDestroy();
  }

  static Object call(Object target, String name, Class<?>[] types, Object... args) {
    try {
      Method m = target.getClass().getMethod(name, types);
      return m.invoke(target, args);
    } catch (Exception e) {
      return null;
    }
  }
}
