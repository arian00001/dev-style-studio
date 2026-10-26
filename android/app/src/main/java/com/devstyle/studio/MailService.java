package com.devstyle.studio;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.util.Properties;

import javax.mail.Address;
import javax.mail.Folder;
import javax.mail.Message;
import javax.mail.Session;
import javax.mail.Store;
import javax.mail.Transport;
import javax.mail.internet.InternetAddress;
import javax.mail.internet.MimeMessage;

/** 24/7 inbox monitor: polls IMAP, mirrors mail locally and can auto-reply with Gemini. */
public class MailService extends Service {

  public static final String CHANNEL_MONITOR = "monitor";
  public static final String CHANNEL_MAIL = "mail";
  public static final int NOTIFICATION_MONITOR = 1001;
  private static final long INTERVAL = 60_000L;
  private static final String TAG = "MailService";

  private final Handler handler = new Handler(Looper.getMainLooper());
  private Prefs prefs;
  private MailStore store;
  private boolean running = false;

  private final Runnable tick = new Runnable() {
    @Override
    public void run() {
      poll();
      handler.postDelayed(this, INTERVAL);
    }
  };

  @Override
  public void onCreate() {
    super.onCreate();
    prefs = new Prefs(this);
    store = new MailStore(this);
    createChannels();
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    startForeground(NOTIFICATION_MONITOR, monitorNotification("Watching your inbox 24/7"));
    if (!running) {
      running = true;
      handler.post(tick);
    }
    return START_STICKY;
  }

  @Nullable
  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

  @Override
  public void onDestroy() {
    running = false;
    handler.removeCallbacksAndMessages(null);
    super.onDestroy();
  }

  private void createChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationManager manager = getSystemService(NotificationManager.class);
    NotificationChannel monitor = new NotificationChannel(
        CHANNEL_MONITOR, "Inbox monitor", NotificationManager.IMPORTANCE_LOW);
    monitor.setDescription("Keeps your inbox monitored in the background.");
    manager.createNotificationChannel(monitor);

    NotificationChannel mail = new NotificationChannel(
        CHANNEL_MAIL, "New mail", NotificationManager.IMPORTANCE_DEFAULT);
    mail.setDescription("Alerts when a new email arrives.");
    manager.createNotificationChannel(mail);
  }

  private Notification monitorNotification(String text) {
    PendingIntent open = PendingIntent.getActivity(this, 0,
        new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
    return new NotificationCompat.Builder(this, CHANNEL_MONITOR)
        .setContentTitle("Dev Style Studio")
        .setContentText(text)
        .setSmallIcon(R.drawable.ic_stat_monitor)
        .setOngoing(true)
        .setContentIntent(open)
        .build();
  }

  private void notifyMail(String sender, String subject) {
    PendingIntent open = PendingIntent.getActivity(this, 1,
        new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
    NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_MAIL)
        .setContentTitle(sender)
        .setContentText(subject)
        .setSmallIcon(R.drawable.ic_stat_monitor)
        .setAutoCancel(true)
        .setContentIntent(open);
    NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
    if (manager != null) manager.notify((int) (System.currentTimeMillis() % 100000), builder.build());
  }

  private void poll() {
    if (!prefs.hasMail()) {
      stopSelf();
      return;
    }
    new Thread(() -> {
      Store mailStore = null;
      try {
        Properties props = new Properties();
        props.setProperty("mail.store.protocol", "imaps");
        props.setProperty("mail.imaps.host", "imap.gmail.com");
        props.setProperty("mail.imaps.port", "993");
        props.setProperty("mail.imaps.ssl.enable", "true");
        props.setProperty("mail.imaps.timeout", "20000");
        props.setProperty("mail.mime.decodetext.strict", "false");

        Session session = Session.getInstance(props);
        mailStore = session.getStore("imaps");
        mailStore.connect("imap.gmail.com", prefs.email(), prefs.appPassword());

        Folder inbox = mailStore.getFolder("INBOX");
        inbox.open(Folder.READ_ONLY);
        int total = inbox.getMessageCount();
        int from = Math.max(1, total - 24);
        if (total > 0) {
          Message[] messages = inbox.getMessages(from, total);
          for (Message message : messages) {
            String subject = message.getSubject() == null ? "(no subject)" : message.getSubject();
            String sender = addressOf(message);
            long received = message.getReceivedDate() == null
                ? System.currentTimeMillis() : message.getReceivedDate().getTime();
            String uid = sender + "#" + received + "#" + subject;

            if (store.exists(uid)) continue;

            String body = textOf(message);
            store.insert(uid, sender, subject, body, received);
            notifyMail(sender, subject);

            if (prefs.autoReply() && !sender.equalsIgnoreCase(prefs.email())
                && System.currentTimeMillis() - received < 86_400_000L) {
              String reply = buildReply(sender, subject, body);
              if (reply != null && sendReply(sender, subject, reply)) {
                store.markReplied(uid);
              }
            }
          }
        }
        inbox.close(false);
      } catch (Exception e) {
        Log.w(TAG, "IMAP poll failed: " + e.getMessage());
      } finally {
        try {
          if (mailStore != null) mailStore.close();
        } catch (Exception ignored) {
          // nothing to close
        }
      }
    }).start();
  }

  private String addressOf(Message message) {
    try {
      Address[] addresses = message.getFrom();
      if (addresses != null && addresses.length > 0) {
        if (addresses[0] instanceof InternetAddress) {
          return ((InternetAddress) addresses[0]).getAddress();
        }
        return addresses[0].toString();
      }
    } catch (Exception ignored) {
      // fall through
    }
    return "unknown";
  }

  private String textOf(Message message) {
    try {
      Object content = message.getContent();
      if (content instanceof String) return (String) content;
      if (content instanceof javax.mail.Multipart) {
        javax.mail.Multipart multipart = (javax.mail.Multipart) content;
        for (int i = 0; i < multipart.getCount(); i++) {
          Object part = multipart.getBodyPart(i).getContent();
          if (part instanceof String) return (String) part;
        }
      }
    } catch (Exception ignored) {
      // fall through
    }
    return "";
  }

  private String buildReply(String sender, String subject, String body) {
    String template = prefs.template();
    if (template == null || template.trim().length() == 0) {
      template = "Hi,\n\nThanks for your email — I have received it and will reply shortly.\n\n"
          + "— Sent from Dev Style Studio";
    }
    template = template.replace("{{from}}", sender).replace("{{subject}}", subject);

    String key = prefs.gemini();
    if (key.trim().length() == 0) return template;

    // Gemini polishes the template with the actual message; falls back to the template on error.
    final String[] holder = new String[]{template};
    final Object lock = new Object();
    final String prompt = "Write a short, friendly reply email (max 90 words, no subject line) "
        + "to this message. Reply body:\n" + body + "\n\nUse this house style as guidance:\n" + template;

    GeminiApi.ask(key, prompt, new GeminiApi.Callback() {
      @Override
      public void onSuccess(String text) {
        synchronized (lock) {
          if (text != null && text.trim().length() > 0) holder[0] = text.trim();
          lock.notifyAll();
        }
      }

      @Override
      public void onError(String message) {
        synchronized (lock) {
          lock.notifyAll();
        }
      }
    });

    synchronized (lock) {
      try {
        lock.wait(30_000);
      } catch (InterruptedException ignored) {
        Thread.currentThread().interrupt();
      }
    }
    return holder[0];
  }

  private boolean sendReply(String to, String subject, String body) {
    try {
      Properties props = new Properties();
      props.setProperty("mail.smtp.host", "smtp.gmail.com");
      props.setProperty("mail.smtp.port", "465");
      props.setProperty("mail.smtp.ssl.enable", "true");
      props.setProperty("mail.smtp.auth", "true");
      props.setProperty("mail.smtp.timeout", "20000");

      final String user = prefs.email();
      final String pass = prefs.appPassword();
      Session session = Session.getInstance(props, new javax.mail.Authenticator() {
        @Override
        protected javax.mail.PasswordAuthentication getPasswordAuthentication() {
          return new javax.mail.PasswordAuthentication(user, pass);
        }
      });

      MimeMessage reply = new MimeMessage(session);
      reply.setFrom(new InternetAddress(user));
      reply.setRecipients(Message.RecipientType.TO, InternetAddress.parse(to));
      reply.setSubject(subject.startsWith("Re:") ? subject : "Re: " + subject);
      reply.setText(body);
      Transport.send(reply);
      return true;
    } catch (Exception e) {
      Log.w(TAG, "SMTP reply failed: " + e.getMessage());
      return false;
    }
  }
}