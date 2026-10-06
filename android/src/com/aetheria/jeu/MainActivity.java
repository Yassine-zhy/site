package com.aetheria.jeu;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
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
 * Aetheria sur téléphone : le jeu (HTML/JS/WebGL) est embarqué dans l'APK et servi
 * hors-ligne depuis une origine https locale, pour que les modules, fetch() et les
 * sauvegardes (localStorage) fonctionnent comme dans le navigateur.
 */
public class MainActivity extends Activity {
  static final String ORIGIN = "https://appassets.androidplatform.net/";
  static final int NIGHT = 0xFF0E0A24;
  // LAYOUT_STABLE | LAYOUT_HIDE_NAVIGATION | LAYOUT_FULLSCREEN | HIDE_NAVIGATION | FULLSCREEN | IMMERSIVE_STICKY
  static final int IMMERSIVE = 0x1706;
  static final Map<String, String> MIME = new HashMap<String, String>();
  static {
    MIME.put("html", "text/html");
    MIME.put("js", "text/javascript");
    MIME.put("mjs", "text/javascript");
    MIME.put("css", "text/css");
    MIME.put("json", "application/json");
    MIME.put("txt", "text/plain");
    MIME.put("glb", "model/gltf-binary");
    MIME.put("gltf", "model/gltf+json");
    MIME.put("bin", "application/octet-stream");
    MIME.put("png", "image/png");
    MIME.put("jpg", "image/jpeg");
    MIME.put("jpeg", "image/jpeg");
    MIME.put("webp", "image/webp");
    MIME.put("svg", "image/svg+xml");
    MIME.put("ico", "image/x-icon");
    MIME.put("woff2", "font/woff2");
    MIME.put("woff", "font/woff");
    MIME.put("wasm", "application/wasm");
  }

  WebView web;

  @Override
  protected void onCreate(Bundle state) {
    super.onCreate(state);
    Window w = getWindow();
    w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_FULLSCREEN);
    w.getDecorView().setBackgroundColor(NIGHT);
    immersive();
    open();
  }

  void open() {
    web = new WebView(this);
    web.setBackgroundColor(NIGHT);
    web.setOverScrollMode(View.OVER_SCROLL_NEVER);
    web.setVerticalScrollBarEnabled(false);
    web.setHorizontalScrollBarEnabled(false);
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setDatabaseEnabled(true);
    call(s, "setMediaPlaybackRequiresUserGesture", new Class<?>[] {boolean.class}, false);
    s.setTextZoom(100);
    s.setSupportZoom(false);
    s.setBuiltInZoomControls(false);
    s.setDisplayZoomControls(false);
    s.setUseWideViewPort(true);
    s.setAllowFileAccess(false);
    s.setAllowContentAccess(false);
    s.setUserAgentString(s.getUserAgentString() + " AetheriaApp/" + version());
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
          // aucun navigateur : on ignore le lien
        }
        return true;
      }

      // API 26+ : si le moteur du jeu est arrêté par le système (mémoire), on relance la page
      public boolean onRenderProcessGone(WebView v, RenderProcessGoneDetail d) {
        if (v == web) restart();
        return true;
      }
    });
    call(web, "setRendererPriorityPolicy", new Class<?>[] {int.class, boolean.class}, 2, true);
    setContentView(web);
    web.loadUrl(ORIGIN + "index.html");
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

  // ------------------------------------------------------------------ fichiers du jeu
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
      headers.put("Access-Control-Allow-Origin", "*");
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

  // ------------------------------------------------------------------ écran et cycle de vie
  void immersive() {
    getWindow().getDecorView().setSystemUiVisibility(IMMERSIVE);
  }

  @Override
  public void onWindowFocusChanged(boolean focus) {
    super.onWindowFocusChanged(focus);
    if (focus) immersive();
  }

  @Override
  public void onBackPressed() {
    if (web == null) {
      moveTaskToBack(true);
      return;
    }
    js("window.__appBack ? !!window.__appBack() : false", new ValueCallback<String>() {
      @Override
      public void onReceiveValue(String handled) {
        if (!"true".equals(handled)) moveTaskToBack(true);
      }
    });
  }

  @Override
  protected void onPause() {
    if (web != null) {
      js("window.__appPause && window.__appPause()", null);
      web.onPause();
    }
    super.onPause();
  }

  @Override
  protected void onStop() {
    if (web != null) web.pauseTimers();
    super.onStop();
  }

  @Override
  protected void onResume() {
    super.onResume();
    immersive();
    if (web != null) {
      web.resumeTimers();
      web.onResume();
      js("window.__appResume && window.__appResume()", null);
    }
  }

  @Override
  protected void onDestroy() {
    if (web != null) {
      web.destroy();
      web = null;
    }
    super.onDestroy();
  }

  // ------------------------------------------------------------------ outils
  String version() {
    try {
      return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
    } catch (Exception e) {
      return "1";
    }
  }

  void js(String code, ValueCallback<String> done) {
    if (call(web, "evaluateJavascript", new Class<?>[] {String.class, ValueCallback.class}, code, done)) return;
    web.loadUrl("javascript:" + code);
    if (done != null) done.onReceiveValue(null);
  }

  // Méthodes d'API récentes appelées par réflexion (l'APK est compilé contre une API minimale).
  static boolean call(Object target, String name, Class<?>[] types, Object... args) {
    try {
      Method m = target.getClass().getMethod(name, types);
      m.invoke(target, args);
      return true;
    } catch (Exception e) {
      return false;
    }
  }
}
