package com.devstyle.studio;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import java.util.ArrayList;
import java.util.List;

/** Local inbox mirror so the app can show mail without asking the network every time. */
public class MailStore extends SQLiteOpenHelper {

  public static class Mail {
    public long id;
    public String uid;
    public String from;
    public String subject;
    public String body;
    public long time;
    public boolean replied;
  }

  public MailStore(Context context) {
    super(context, "inbox.db", null, 1);
  }

  @Override
  public void onCreate(SQLiteDatabase db) {
    db.execSQL("CREATE TABLE mails ("
        + "id INTEGER PRIMARY KEY AUTOINCREMENT,"
        + "uid TEXT UNIQUE,"
        + "sender TEXT,"
        + "subject TEXT,"
        + "body TEXT,"
        + "received INTEGER,"
        + "replied INTEGER DEFAULT 0)");
  }

  @Override
  public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
    db.execSQL("DROP TABLE IF EXISTS mails");
    onCreate(db);
  }

  public boolean exists(String uid) {
    SQLiteDatabase db = getReadableDatabase();
    Cursor cursor = db.rawQuery("SELECT id FROM mails WHERE uid = ?", new String[]{uid});
    boolean found = cursor.moveToFirst();
    cursor.close();
    return found;
  }

  public void insert(String uid, String sender, String subject, String body, long received) {
    ContentValues values = new ContentValues();
    values.put("uid", uid);
    values.put("sender", sender);
    values.put("subject", subject);
    values.put("body", body);
    values.put("received", received);
    getWritableDatabase().insertWithOnConflict("mails", null, values, SQLiteDatabase.CONFLICT_IGNORE);
  }

  public void markReplied(String uid) {
    ContentValues values = new ContentValues();
    values.put("replied", 1);
    getWritableDatabase().update("mails", values, "uid = ?", new String[]{uid});
  }

  public int count() {
    Cursor cursor = getReadableDatabase().rawQuery("SELECT COUNT(*) FROM mails", null);
    int total = cursor.moveToFirst() ? cursor.getInt(0) : 0;
    cursor.close();
    return total;
  }

  public List<Mail> list(int limit) {
    List<Mail> mails = new ArrayList<>();
    Cursor cursor = getReadableDatabase().rawQuery(
        "SELECT id, uid, sender, subject, body, received, replied FROM mails "
            + "ORDER BY received DESC LIMIT " + limit, null);
    while (cursor.moveToNext()) {
      Mail mail = new Mail();
      mail.id = cursor.getLong(0);
      mail.uid = cursor.getString(1);
      mail.from = cursor.getString(2);
      mail.subject = cursor.getString(3);
      mail.body = cursor.getString(4);
      mail.time = cursor.getLong(5);
      mail.replied = cursor.getInt(6) == 1;
      mails.add(mail);
    }
    cursor.close();
    return mails;
  }
}