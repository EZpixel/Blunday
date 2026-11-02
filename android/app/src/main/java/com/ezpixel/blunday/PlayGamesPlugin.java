package com.ezpixel.blunday;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.games.AuthenticationResult;
import com.google.android.gms.games.PlayGames;
import com.google.android.gms.games.PlayGamesSdk;
import com.google.android.gms.games.SnapshotsClient;
import com.google.android.gms.games.snapshot.Snapshot;
import com.google.android.gms.games.snapshot.SnapshotMetadataChange;
import com.google.android.gms.tasks.Task;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

// Google Play Games Services v2 for the web layer: sign-in, achievements and
// one Saved Games slot holding the whole save as JSON (see src/game/cloudSave.js,
// which does the merging; this side only moves the bytes).
@CapacitorPlugin(name = "PlayGames")
public class PlayGamesPlugin extends Plugin {

    private static final String SAVE_NAME = "blunday-save";

    // Two devices writing at once is the only way to get a conflict. Whichever
    // copy loses still lives on its device and gets merged in on its next sync.
    private static final int CONFLICT_POLICY = SnapshotsClient.RESOLUTION_POLICY_MOST_RECENTLY_MODIFIED;

    @Override
    public void load() {
        PlayGamesSdk.initialize(getContext());
    }

    // Play Games signs the player in by itself at launch; this asks how that went
    @PluginMethod
    public void isAuthenticated(PluginCall call) {
        resolveAuth(call, PlayGames.getGamesSignInClient(getActivity()).isAuthenticated());
    }

    // For players who skipped or dismissed the automatic sign-in
    @PluginMethod
    public void signIn(PluginCall call) {
        resolveAuth(call, PlayGames.getGamesSignInClient(getActivity()).signIn());
    }

    // Resolves { authenticated, error? }. The error (Play's exception, e.g. an
    // ApiException status code) is only there to be logged, so a failed sign-in
    // says why instead of just "not signed in".
    private void resolveAuth(PluginCall call, Task<AuthenticationResult> task) {
        task.addOnCompleteListener(t -> {
            JSObject result = new JSObject();
            result.put("authenticated", t.isSuccessful() && t.getResult().isAuthenticated());
            if (t.getException() != null) result.put("error", t.getException().toString());
            call.resolve(result);
        });
    }

    // Fire and forget: Play queues the unlock if the device is offline
    @PluginMethod
    public void unlockAchievement(PluginCall call) {
        String id = call.getString("id");
        if (id == null || id.isEmpty()) {
            call.reject("Missing achievement id");
            return;
        }
        PlayGames.getAchievementsClient(getActivity()).unlock(id);
        call.resolve();
    }

    // Play's own achievements screen
    @PluginMethod
    public void showAchievements(PluginCall call) {
        PlayGames.getAchievementsClient(getActivity()).getAchievementsIntent().addOnCompleteListener(t -> {
            if (!t.isSuccessful()) {
                call.reject("Achievements unavailable", t.getException());
                return;
            }
            getActivity().startActivity(t.getResult());
            call.resolve();
        });
    }

    // Resolves { data: string }, empty when there's no cloud save yet
    @PluginMethod
    public void loadSave(PluginCall call) {
        SnapshotsClient snapshots = PlayGames.getSnapshotsClient(getActivity());
        snapshots.open(SAVE_NAME, true, CONFLICT_POLICY).addOnCompleteListener(t -> {
            Snapshot snapshot = t.isSuccessful() ? t.getResult().getData() : null;
            if (snapshot == null) {
                call.reject("Could not open the cloud save", t.getException());
                return;
            }
            try {
                byte[] bytes = snapshot.getSnapshotContents().readFully();
                JSObject result = new JSObject();
                result.put("data", new String(bytes, StandardCharsets.UTF_8));
                call.resolve(result);
            } catch (IOException e) {
                call.reject("Could not read the cloud save", e);
            } finally {
                snapshots.discardAndClose(snapshot);
            }
        });
    }

    // Replaces the cloud save with { data: string }
    @PluginMethod
    public void writeSave(PluginCall call) {
        String data = call.getString("data");
        if (data == null) {
            call.reject("Missing save data");
            return;
        }
        SnapshotsClient snapshots = PlayGames.getSnapshotsClient(getActivity());
        snapshots.open(SAVE_NAME, true, CONFLICT_POLICY).addOnCompleteListener(t -> {
            Snapshot snapshot = t.isSuccessful() ? t.getResult().getData() : null;
            if (snapshot == null) {
                call.reject("Could not open the cloud save", t.getException());
                return;
            }
            snapshot.getSnapshotContents().writeBytes(data.getBytes(StandardCharsets.UTF_8));
            SnapshotMetadataChange change = new SnapshotMetadataChange.Builder()
                .setDescription("Blunday progress")
                .build();
            snapshots.commitAndClose(snapshot, change).addOnCompleteListener(c -> {
                if (c.isSuccessful()) call.resolve();
                else call.reject("Could not write the cloud save", c.getException());
            });
        });
    }
}
