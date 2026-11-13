package ro.elmont.smsgateway;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

public class MainActivity extends Activity {
    private EditText tokenInput;
    private TextView status;
    private TextView history;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        ScrollView scroll = new ScrollView(this);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(dp(24), dp(28), dp(24), dp(24));
        scroll.addView(layout);

        TextView title = new TextView(this);
        title.setText("Elmont SMS");
        title.setTextSize(26);
        title.setTextColor(0xff087f82);
        layout.addView(title);
        addText(layout, "Telefonul trimite mesajele beneficiarilor Elmont prin cartela SIM proprie. Lasă telefonul pornit și conectat la internet.", 15);
        addText(layout, "Cod de asociere din sms.elmont.ro", 14);

        tokenInput = new EditText(this);
        tokenInput.setSingleLine(false);
        tokenInput.setMinLines(2);
        tokenInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD);
        tokenInput.setHint("Lipește codul de asociere");
        layout.addView(tokenInput);

        Button save = new Button(this);
        save.setText("Salvează codul");
        save.setOnClickListener(view -> {
            String token = tokenInput.getText().toString().trim();
            if (token.length() < 40 || !token.contains(".")) {
                status.setText("Cod invalid. Copiază codul complet din Elmont.");
                return;
            }
            prefs().edit().putString("token", token).apply();
            tokenInput.setText("");
            status.setText("Cod salvat. Acordă permisiunea SMS și pornește serviciul.");
        });
        layout.addView(save);

        Button start = new Button(this);
        start.setText("Pornește trimiterea SMS");
        start.setOnClickListener(view -> startGateway());
        layout.addView(start);

        Button stop = new Button(this);
        stop.setText("Oprește");
        stop.setOnClickListener(view -> {
            stopService(new Intent(this, SmsGatewayService.class));
            prefs().edit().putBoolean("running", false).apply();
            updateStatus();
        });
        layout.addView(stop);

        status = addText(layout, "", 15);
        addText(layout, "Ultimele încercări", 17);
        history = addText(layout, "", 13);
        addText(layout, "Setează cartela +40 727 700 062 ca SIM implicit pentru SMS în Android. După repornirea telefonului, deschide aplicația și pornește din nou serviciul.", 13);
        setContentView(scroll);
        updateStatus();
    }

    @Override protected void onResume() {
        super.onResume();
        if (status != null) updateStatus();
    }

    private void startGateway() {
        if (prefs().getString("token", "").isEmpty()) {
            status.setText("Salvează mai întâi codul de asociere.");
            return;
        }
        if (checkSelfPermission(Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] { Manifest.permission.SEND_SMS }, 101);
            return;
        }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, 102);
            return;
        }
        startForegroundService(new Intent(this, SmsGatewayService.class));
        prefs().edit().putBoolean("running", true).apply();
        updateStatus();
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) startGateway();
        else if (requestCode == 101) status.setText("Permisiunea SEND_SMS este necesară pentru a trimite prin SIM.");
        else status.setText("Activează notificările pentru serviciul SMS.");
    }

    private void updateStatus() {
        boolean paired = !prefs().getString("token", "").isEmpty();
        boolean running = prefs().getBoolean("running", false);
        String lastError = prefs().getString("lastError", "");
        status.setText((paired ? "Telefon asociat" : "Telefon neasociat") + " · " + (running ? "Serviciu pornit" : "Serviciu oprit") + (lastError.isEmpty() ? "" : "\nUltima problemă: " + lastError));
        history.setText(prefs().getString("history", "Nu au fost trimise SMS-uri încă."));
    }

    private SharedPreferences prefs() { return getSharedPreferences("gateway", MODE_PRIVATE); }
    private int dp(int value) { return (int) (value * getResources().getDisplayMetrics().density); }
    private TextView addText(LinearLayout parent, String value, int size) {
        TextView text = new TextView(this);
        text.setText(value);
        text.setTextSize(size);
        text.setTextColor(0xff24343c);
        text.setPadding(0, dp(10), 0, dp(10));
        parent.addView(text);
        return text;
    }
}
