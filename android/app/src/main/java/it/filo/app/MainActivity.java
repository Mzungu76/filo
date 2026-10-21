package it.filo.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FocusPlugin.class);
        registerPlugin(OcrPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
