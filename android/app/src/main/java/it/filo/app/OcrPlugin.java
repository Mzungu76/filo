package it.filo.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

/** Sceglie un'immagine dalla galleria e ne legge il testo sul telefono (Google ML Kit, senza rete). */
@CapacitorPlugin(name = "Ocr")
public class OcrPlugin extends Plugin {

    @PluginMethod
    public void pickAndRead(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
        intent.setType("image/*");
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        startActivityForResult(call, Intent.createChooser(intent, "Scegli lo screenshot"), "onPicked");
    }

    @ActivityCallback
    private void onPicked(final PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            JSObject ret = new JSObject();
            ret.put("cancelled", true);
            ret.put("text", "");
            call.resolve(ret);
            return;
        }
        Uri uri = data.getData();
        try {
            InputImage image = InputImage.fromFilePath(getContext(), uri);
            final TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
            recognizer.process(image)
                    .addOnSuccessListener(text -> {
                        JSObject ret = new JSObject();
                        ret.put("cancelled", false);
                        ret.put("text", text.getText());
                        call.resolve(ret);
                        recognizer.close();
                    })
                    .addOnFailureListener(e -> {
                        call.reject("Lettura non riuscita: " + e.getMessage(), e);
                        recognizer.close();
                    });
        } catch (Exception e) {
            call.reject("Immagine non leggibile: " + e.getMessage(), e);
        }
    }
}
