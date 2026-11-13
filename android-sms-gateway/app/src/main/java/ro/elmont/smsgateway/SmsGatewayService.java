package ro.elmont.smsgateway;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.IBinder;
import android.telephony.SmsManager;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.DateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

public class SmsGatewayService extends Service {
    private static final String ENDPOINT = "https://elmont.ro/api/sms/device/jobs";
    private volatile boolean running;
    private Thread worker;

    @Override public void onCreate() {
        super.onCreate();
        NotificationChannel channel = new NotificationChannel("elmont_sms", "Elmont SMS", NotificationManager.IMPORTANCE_LOW);
        getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (running) return START_STICKY;
        Notification notification = new Notification.Builder(this, "elmont_sms")
            .setSmallIcon(android.R.drawable.ic_dialog_email)
            .setContentTitle("Elmont SMS este activ")
            .setContentText("Telefonul verifică mesajele și trimite SMS prin SIM.")
            .setOngoing(true)
            .build();
        startForeground(1, notification);
        running = true;
        prefs().edit().putBoolean("running", true).apply();
        worker = new Thread(this::loop, "elmont-sms-poll");
        worker.start();
        return START_STICKY;
    }

    private void loop() {
        while (running) {
            try {
                if (checkSelfPermission(Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) throw new Exception("Permisiunea SEND_SMS lipsește.");
                String token = prefs().getString("token", "");
                if (token.isEmpty()) throw new Exception("Codul de asociere lipsește.");
                JSONObject response = request("GET", null, token);
                JSONObject job = response.optJSONObject("job");
                prefs().edit().remove("lastError").apply();
                if (job != null) process(job, token);
                else Thread.sleep(12_000);
            } catch (Exception error) {
                prefs().edit().putString("lastError", error.getMessage() == null ? "Conexiune eșuată" : error.getMessage()).apply();
                try { Thread.sleep(20_000); } catch (InterruptedException ignored) { break; }
            }
        }
    }

    private void process(JSONObject job, String token) {
        String id = job.optString("id");
        String to = job.optString("to");
        String text = job.optString("text");
        String error = null;
        try { sendBySim(id, to, text); }
        catch (Exception failure) { error = failure.getMessage() == null ? "SMS eșuat" : failure.getMessage(); }
        try {
            JSONObject report = new JSONObject();
            report.put("id", id);
            report.put("status", error == null ? "SENT" : "FAILED");
            if (error != null) report.put("error", error);
            request("POST", report, token);
        } catch (Exception reportError) {
            prefs().edit().putString("lastError", "SMS procesat, dar raportarea a eșuat: " + reportError.getMessage()).apply();
        }
        String line = DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(new Date()) + " · " + to + " · " + (error == null ? "Predat rețelei mobile" : "Eroare: " + error);
        String old = prefs().getString("history", "");
        prefs().edit().putString("history", (line + "\n" + old).substring(0, Math.min(2500, line.length() + 1 + old.length()))).apply();
    }

    private void sendBySim(String id, String to, String text) throws Exception {
        SmsManager manager = SmsManager.getDefault();
        ArrayList<String> parts = manager.divideMessage(text);
        if (parts.isEmpty()) throw new Exception("Mesaj SMS gol.");
        String action = "ro.elmont.smsgateway.SENT." + id;
        CountDownLatch latch = new CountDownLatch(parts.size());
        AtomicBoolean failed = new AtomicBoolean(false);
        AtomicInteger lastCode = new AtomicInteger(ActivityResult.OK);
        BroadcastReceiver receiver = new BroadcastReceiver() {
            @Override public void onReceive(Context context, Intent intent) {
                if (getResultCode() != ActivityResult.OK) { failed.set(true); lastCode.set(getResultCode()); }
                latch.countDown();
            }
        };
        IntentFilter filter = new IntentFilter(action);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(receiver, filter);
        try {
            ArrayList<PendingIntent> sent = new ArrayList<>();
            for (int i = 0; i < parts.size(); i++) {
                Intent intent = new Intent(action).setPackage(getPackageName());
                intent.putExtra("part", i);
                sent.add(PendingIntent.getBroadcast(this, id.hashCode() + i, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
            }
            if (parts.size() == 1) manager.sendTextMessage(to, null, text, sent.get(0), null);
            else manager.sendMultipartTextMessage(to, null, parts, sent, null);
            if (!latch.await(90, TimeUnit.SECONDS)) throw new Exception("Telefonul nu a confirmat trimiterea în 90 de secunde.");
            if (failed.get()) throw new Exception("Eroare Android SMS: " + lastCode.get());
        } finally { unregisterReceiver(receiver); }
    }

    private JSONObject request(String method, JSONObject body, String token) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(ENDPOINT).openConnection();
        connection.setRequestMethod(method);
        connection.setRequestProperty("Authorization", "Bearer " + token);
        connection.setRequestProperty("Accept", "application/json");
        connection.setConnectTimeout(10_000);
        connection.setReadTimeout(15_000);
        if (body != null) {
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            try (OutputStream output = connection.getOutputStream()) { output.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
        }
        int status = connection.getResponseCode();
        InputStream stream = status < 400 ? connection.getInputStream() : connection.getErrorStream();
        String content;
        try (InputStream input = stream) {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            if (input != null) {
                byte[] buffer = new byte[4096];
                int length;
                while ((length = input.read(buffer)) != -1) output.write(buffer, 0, length);
            }
            content = new String(output.toByteArray(), StandardCharsets.UTF_8);
        }
        connection.disconnect();
        if (status >= 400) throw new Exception(status == 401 ? "Codul de asociere a expirat. Generează altul în Elmont." : "Serverul a răspuns cu " + status);
        return new JSONObject(content);
    }

    private SharedPreferences prefs() { return getSharedPreferences("gateway", MODE_PRIVATE); }
    @Override public void onDestroy() {
        running = false;
        if (worker != null) worker.interrupt();
        prefs().edit().putBoolean("running", false).apply();
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
    private static class ActivityResult { static final int OK = -1; }
}
