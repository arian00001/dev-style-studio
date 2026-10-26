package com.devstyle.studio;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
  private static final int FILE_CHOOSER_REQUEST = 1001;

  private WebView web;
  private ValueCallback<Uri[]> filePathCallback;

  @SuppressLint("SetJavaScriptEnabled")
  @Override
  protected void onCreate(Bundle state) {
    super.onCreate(state);

    web = new WebView(this);

    WebSettings settings = web.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setDatabaseEnabled(true);
    settings.setMediaPlaybackRequiresUserGesture(false);
    settings.setAllowFileAccess(true);
    settings.setSupportMultipleWindows(true);
    settings.setJavaScriptCanOpenWindowsAutomatically(true);

    web.setWebViewClient(new WebViewClient() {
      @Override
      public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        if (request == null || request.isForMainFrame()) {
          showMessage("Can't reach the app",
              "Check your internet connection, then reopen the app and try again.");
        }
      }

      @SuppressWarnings("deprecation")
      @Override
      public boolean shouldOverrideUrlLoading(WebView view, String url) {
        if (url == null) return false;
        if (url.startsWith("http")) return false;
        try {
          view.getContext().startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (Exception ignored) {
          // nothing can handle this scheme; ignore it
        }
        return true;
      }
    });

    web.setWebChromeClient(new WebChromeClient() {
      @Override
      public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
        if (filePathCallback != null) {
          filePathCallback.onReceiveValue(null);
        }
        filePathCallback = callback;
        try {
          startActivityForResult(params.createIntent(), FILE_CHOOSER_REQUEST);
          return true;
        } catch (Exception e) {
          filePathCallback = null;
          return false;
        }
      }

      @Override
      public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
        WebView popup = new WebView(MainActivity.this);
        WebSettings popupSettings = popup.getSettings();
        popupSettings.setJavaScriptEnabled(true);
        popupSettings.setDomStorageEnabled(true);
        popup.setWebViewClient(new WebViewClient() {
          @SuppressWarnings("deprecation")
          @Override
          public boolean shouldOverrideUrlLoading(WebView popupView, String url) {
            if (url != null && url.startsWith("http")) {
              web.loadUrl(url);
            }
            popupView.destroy();
            return true;
          }
        });
        WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
        transport.setWebView(popup);
        resultMsg.sendToTarget();
        return true;
      }
    });

    setContentView(web);

    String url = BuildConfig.APP_URL == null ? "" : BuildConfig.APP_URL.trim();
    if (url.isEmpty()) {
      showMessage("App URL not set",
          "This APK was built without an app URL. Rebuild it with the published website address so the app can load Dev Style Studio.");
    } else {
      web.loadUrl(url);
    }
  }

  private void showMessage(String title, String body) {
    String html = "<!doctype html><html><head>"
        + "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        + "<style>html,body{margin:0;height:100%;background:#0b0f14;color:#e5e7eb;"
        + "font-family:-apple-system,Roboto,Arial,sans-serif;display:flex;align-items:center;"
        + "justify-content:center;text-align:center}div{padding:32px}"
        + "h1{font-size:20px;margin:0 0 12px}p{font-size:15px;line-height:1.5;color:#94a3b8;margin:0}</style>"
        + "</head><body><div><h1>" + title + "</h1><p>" + body + "</p></div></body></html>";
    web.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
  }

  @Override
  protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    if (requestCode == FILE_CHOOSER_REQUEST) {
      if (filePathCallback != null) {
        filePathCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
        filePathCallback = null;
      }
      return;
    }
    super.onActivityResult(requestCode, resultCode, data);
  }

  @Override
  public void onBackPressed() {
    if (web != null && web.canGoBack()) web.canGoBack();
    else super.onBackPressed();
  }
}
