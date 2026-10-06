package com.ezpixel.blunday;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.util.Log;
import android.view.Display;
import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "Blunday";

    // Smallest screen width (dp) from which a device counts as a large screen
    // (tablets, unfolded foldables, Chromebooks)
    private static final int LARGE_SCREEN_MIN_DP = 600;

    private PowerManager powerManager;
    private PowerManager.OnThermalStatusChangedListener thermalListener;

    private final BroadcastReceiver powerSaveReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            logDisplayState("power save changed");
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Edge to edge on every Android version, the way Android 15+ enforces it:
        // the window draws behind the system bars and the camera cutout (the
        // cutout mode is set too), and the web layer keeps its UI clear of them
        // with the insets Capacitor's SystemBars plugin passes in as CSS
        // variables (see App.jsx and src/index.css). Light icons for whenever the
        // bars show over the dark game.
        // Called after super.onCreate(), which swaps the splash theme for the app
        // theme: enabling it earlier creates the window decor while the splash
        // theme is active, and its splash background then stays visible behind
        // the status bar area.
        EdgeToEdge.enable(
            this,
            SystemBarStyle.dark(Color.TRANSPARENT),
            SystemBarStyle.dark(Color.TRANSPARENT)
        );
        applyOrientationPolicy(getResources().getConfiguration());
        hideSystemBars();
        startDisplayDiagnostics();
    }

    @Override
    public void onDestroy() {
        stopDisplayDiagnostics();
        super.onDestroy();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // Folding or unfolding, or resizing a window, can cross into or out of
        // large-screen territory
        applyOrientationPolicy(newConfig);
    }

    // Android shows the bars again after dialogs, ads and app switches, so
    // hide them each time the game gets focus back
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemBars();
            logDisplayState("focus");
        }
    }

    // Phones stay in portrait, the way the game is laid out. Large screens are
    // never locked: they rotate and resize freely (split screen, freeform
    // windows, foldables), and the game letterboxes itself to its 9:20 column.
    // Android 16 ignores orientation locks on large screens anyway.
    private void applyOrientationPolicy(Configuration config) {
        int wanted = config.smallestScreenWidthDp < LARGE_SCREEN_MIN_DP
            ? ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            : ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED;
        if (getRequestedOrientation() != wanted) setRequestedOrientation(wanted);
    }

    // Full screen: no status bar or navigation bar. A swipe from the edge
    // shows them briefly over the game, then they hide again.
    private void hideSystemBars() {
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.hide(WindowInsetsCompat.Type.systemBars());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }

    // ─── Display diagnostics ──────────────────────────────────────────────
    // Some players see the whole game run at a low frame rate now and then.
    // Logcat (tag "Blunday") gets the refresh rate, power saving and thermal
    // state at start, on focus and whenever power saving or the thermal state
    // changes, so a slow spell can be matched against what the device was
    // doing. The web side logs its measured frame rate (tag Capacitor/Console,
    // prefix [perf]).
    private void startDisplayDiagnostics() {
        powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        ContextCompat.registerReceiver(
            this,
            powerSaveReceiver,
            new IntentFilter(PowerManager.ACTION_POWER_SAVE_MODE_CHANGED),
            ContextCompat.RECEIVER_NOT_EXPORTED
        );
        if (powerManager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            thermalListener = status -> logDisplayState("thermal status " + status);
            powerManager.addThermalStatusListener(thermalListener);
        }
        logDisplayState("start");
    }

    private void stopDisplayDiagnostics() {
        try {
            unregisterReceiver(powerSaveReceiver);
        } catch (IllegalArgumentException ignored) {
            // never registered
        }
        if (powerManager != null && thermalListener != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            powerManager.removeThermalStatusListener(thermalListener);
        }
    }

    private void logDisplayState(String reason) {
        Display display = ContextCompat.getDisplayOrDefault(this);
        StringBuilder state = new StringBuilder("display (").append(reason).append("): ")
            .append(display.getRefreshRate()).append(" Hz");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Display.Mode mode = display.getMode();
            state.append(", mode ").append(mode.getPhysicalWidth()).append('x').append(mode.getPhysicalHeight())
                .append(" @ ").append(mode.getRefreshRate()).append(" Hz");
        }
        if (powerManager != null) {
            state.append(", power save ").append(powerManager.isPowerSaveMode() ? "on" : "off");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                state.append(", thermal ").append(powerManager.getCurrentThermalStatus());
            }
        }
        Log.i(TAG, state.toString());
    }
}
