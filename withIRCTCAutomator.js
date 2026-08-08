const { withAndroidManifest, withDangerousMod, withMainApplication, withAppBuildGradle } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withIRCTCAutomator(config) {
  
  config = withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes('play-services-mlkit-text-recognition')) {
      config.modResults.contents = config.modResults.contents.replace(
        /dependencies\s?{/,
        `dependencies {\n    implementation 'com.google.android.gms:play-services-mlkit-text-recognition:19.0.0'`
      );
    }
    return config;
  });

  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    if (!manifest.manifest.queries) manifest.manifest.queries = [{ package: [] }];
    else if (!manifest.manifest.queries[0].package) manifest.manifest.queries[0].package = [];

    const packagesToQuery = ["cris.org.in.prs.ima"];
    packagesToQuery.forEach(pkg => {
        const exists = manifest.manifest.queries[0].package.some(p => p.$['android:name'] === pkg);
        if (!exists) manifest.manifest.queries[0].package.push({ '$': { 'android:name': pkg } });
    });

    const app = manifest.manifest.application[0];
    if (!app.service) app.service = [];
    
    const serviceExists = app.service.some(s => s.$['android:name'] === '.AutoClickService');
    if (!serviceExists) {
      app.service.push({
        '$': {
          'android:name': '.AutoClickService',
          'android:permission': 'android.permission.BIND_ACCESSIBILITY_SERVICE',
          'android:exported': 'true'
        },
        'intent-filter': [{ 'action': [{ '$': { 'android:name': 'android.accessibilityservice.AccessibilityService' } }] }],
        'meta-data': [{ '$': { 'android:name': 'android.accessibilityservice', 'android:resource': '@xml/accessibility_service_config' } }]
      });
    }
    return config;
  });

  config = withDangerousMod(config, [
    'android',
    (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const resXmlPath = path.join(projectRoot, 'android/app/src/main/res/xml');
      const javaPath = path.join(projectRoot, 'android/app/src/main/java/com/irctcgodmode');
      
      fs.mkdirSync(resXmlPath, { recursive: true });
      fs.mkdirSync(javaPath, { recursive: true });
      
      const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeWindowContentChanged|typeWindowStateChanged|typeViewClicked"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:accessibilityFlags="flagDefault|flagIncludeNotImportantViews|flagRetrieveInteractiveWindows|flagReportViewIds|flagRequestTouchExplorationMode"
    android:canRetrieveWindowContent="true"
    android:canPerformGestures="true" 
    android:canTakeScreenshot="true"
    android:notificationTimeout="0" />`; 
      
      const bridgeModuleContent = `package com.irctcgodmode;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import android.provider.Settings;
import android.text.TextUtils;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.HashMap;

public class IRCTCBridgeModule extends ReactContextBaseJavaModule {
    public static String pId = "";
    public static String pPass = "";
    public static String pTrain = "";
    public static String pClass = "";
    public static String pPayMode = "";
    public static boolean pUseMasterList = true;
    public static ArrayList<HashMap<String, String>> passengersList = new ArrayList<>();
    public static boolean isGodModeOn = false;

    public IRCTCBridgeModule(ReactApplicationContext context) { super(context); }
    @Override
    public String getName() { return "IRCTCBridge"; }

    @ReactMethod
    public void syncFullData(String id, String pass, String train, String tClass, String payMode, boolean masterList, String passJson) {
        pId = id; pPass = pass; pTrain = train; pClass = tClass; pPayMode = payMode; pUseMasterList = masterList;
        passengersList.clear();
        try {
            JSONArray arr = new JSONArray(passJson);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                HashMap<String, String> map = new HashMap<>();
                map.put("name", obj.getString("name"));
                map.put("age", obj.getString("age"));
                passengersList.add(map);
            }
        } catch (Exception e) {}
    }

    @ReactMethod
    public void setGodModeStatus(boolean status) { isGodModeOn = status; }

    @ReactMethod
    public void checkAccessibilityPermission(Promise promise) {
        int accessibilityEnabled = 0;
        final String service = getReactApplicationContext().getPackageName() + "/" + AutoClickService.class.getCanonicalName();
        try {
            accessibilityEnabled = Settings.Secure.getInt(getReactApplicationContext().getApplicationContext().getContentResolver(), Settings.Secure.ACCESSIBILITY_ENABLED);
        } catch (Settings.SettingNotFoundException e) {}
        
        TextUtils.SimpleStringSplitter mStringColonSplitter = new TextUtils.SimpleStringSplitter(':');
        if (accessibilityEnabled == 1) {
            String settingValue = Settings.Secure.getString(getReactApplicationContext().getApplicationContext().getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
            if (settingValue != null) {
                mStringColonSplitter.setString(settingValue);
                while (mStringColonSplitter.hasNext()) {
                    if (mStringColonSplitter.next().equalsIgnoreCase(service)) { promise.resolve(true); return; }
                }
            }
        }
        promise.resolve(false);
    }
}`;

      const bridgePackageContent = `package com.irctcgodmode;
import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class IRCTCBridgePackage implements ReactPackage {
    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) { return Collections.emptyList(); }
    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();
        modules.add(new IRCTCBridgeModule(reactContext));
        return modules;
    }
}`;

      const serviceContent = `package com.irctcgodmode;
import android.accessibilityservice.AccessibilityService;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.os.Bundle;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Rect;
import android.os.Build;
import android.view.Display;
import androidx.annotation.RequiresApi;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

public class AutoClickService extends AccessibilityService {
    private long lastActionTime = 0;
    private int currentPassengerIndex = 0; 
    private boolean isProcessingCaptcha = false;
    private TextRecognizer recognizer;

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
    }

    private long getRandomDelay() { return 300 + (long)(Math.random() * 400); }

    private void fillEditText(AccessibilityNodeInfo node, String value) {
        Bundle args = new Bundle(); 
        args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, value);
        node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args);
        lastActionTime = System.currentTimeMillis();
    }

    private boolean isPinScreen(AccessibilityNodeInfo node) {
        if (node == null) return false;
        CharSequence txt = node.getText();
        if (txt != null && txt.toString().toLowerCase().contains("login pin")) return true;
        for (int i = 0; i < node.getChildCount(); i++) {
            if (isPinScreen(node.getChild(i))) return true;
        }
        return false;
    }

    private Bitmap cleanCaptchaImage(Bitmap src) {
        int width = src.getWidth(); int height = src.getHeight();
        Bitmap bmOut = Bitmap.createBitmap(width, height, src.getConfig());
        for (int x = 0; x < width; ++x) {
            for (int y = 0; y < height; ++y) {
                int pixel = src.getPixel(x, y);
                int gray = (int) (0.299 * Color.red(pixel) + 0.587 * Color.green(pixel) + 0.114 * Color.blue(pixel));
                bmOut.setPixel(x, y, gray > 130 ? Color.WHITE : Color.BLACK);
            }
        }
        return bmOut;
    }

    private Rect getCaptchaImageRect(AccessibilityNodeInfo node, Rect inputBounds) {
        if (node == null) return null;
        if (node.getClassName() != null && node.getClassName().toString().contains("ImageView")) {
            Rect bounds = new Rect(); node.getBoundsInScreen(bounds);
            if (bounds.bottom <= inputBounds.bottom && bounds.bottom >= inputBounds.top - 500) {
                if (bounds.width() > 100 && bounds.height() > 50) return bounds;
            }
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            Rect res = getCaptchaImageRect(node.getChild(i), inputBounds);
            if (res != null) return res;
        }
        return null;
    }

    private void clickRefreshButton(AccessibilityNodeInfo node) {
        if (node == null) return;
        CharSequence desc = node.getContentDescription();
        if (desc != null && desc.toString().toLowerCase().contains("refresh") && node.isClickable()) {
            node.performAction(AccessibilityNodeInfo.ACTION_CLICK);
            return;
        }
        for (int i = 0; i < node.getChildCount(); i++) { clickRefreshButton(node.getChild(i)); }
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (!IRCTCBridgeModule.isGodModeOn) return;
        
        // 1. THE MASTER LOCK: Sirf IRCTC app me hi run karega!
        CharSequence pkgName = event.getPackageName();
        if (pkgName == null || !pkgName.toString().contains("cris.org.in.prs.ima")) {
            return; // Kisi aur app ko nahi chuyega
        }

        AccessibilityNodeInfo rootNode = getRootInActiveWindow();
        if (rootNode != null) {
            scanAndBypass(rootNode, isPinScreen(rootNode), new int[]{0});
        }
    }

    private void scanAndBypass(AccessibilityNodeInfo node, boolean isPinMode, int[] editTextCount) {
        if (node == null) return;

        CharSequence textSeq = node.getText();
        CharSequence descSeq = node.getContentDescription();
        CharSequence hintSeq = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ? node.getHintText() : null;

        String text = textSeq != null ? textSeq.toString().toLowerCase() : "";
        String desc = descSeq != null ? descSeq.toString().toLowerCase() : "";
        String hint = hintSeq != null ? hintSeq.toString().toLowerCase() : "";

        // FORCE FILLER FOR LOGIN & PASSENGERS
        if (node.getClassName().toString().contains("EditText") && node.isEditable()) {
            editTextCount[0]++;
            
            if (text.isEmpty()) {
                if (isPinMode && editTextCount[0] == 1) { fillEditText(node, IRCTCBridgeModule.pPass); return; }
                if (!isPinMode && editTextCount[0] == 1) { fillEditText(node, IRCTCBridgeModule.pId); return; }
                if (!isPinMode && editTextCount[0] == 2) { fillEditText(node, IRCTCBridgeModule.pPass); return; }
            }

            if (!IRCTCBridgeModule.pUseMasterList && currentPassengerIndex < IRCTCBridgeModule.passengersList.size()) {
                String name = IRCTCBridgeModule.passengersList.get(currentPassengerIndex).get("name");
                String age = IRCTCBridgeModule.passengersList.get(currentPassengerIndex).get("age");
                
                if (editTextCount[0] == 1 && text.isEmpty()) { fillEditText(node, name); return; }
                if (editTextCount[0] == 2 && text.isEmpty()) { fillEditText(node, age); return; }
            }
        }

        // CAPTCHA BYPASS
        if ((text.contains("captcha") || desc.contains("captcha") || hint.contains("captcha") || text.contains("enter text")) && node.getClassName().toString().contains("EditText")) {
            if (!isProcessingCaptcha && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                isProcessingCaptcha = true;
                processSilentCaptchaScreenshot(node);
                return;
            }
        }

        // BUTTON CLICKS
        if (System.currentTimeMillis() - lastActionTime > getRandomDelay()) {
            
            if ((text.equals("login") || desc.equals("login") || text.equals("pay") || text.equals("submit") || text.equals("proceed")) && node.isClickable()) {
                node.performAction(AccessibilityNodeInfo.ACTION_CLICK); lastActionTime = System.currentTimeMillis(); return;
            }
            
            if (!IRCTCBridgeModule.pTrain.isEmpty() && text.contains(IRCTCBridgeModule.pTrain) && node.isClickable()) {
                node.performAction(AccessibilityNodeInfo.ACTION_CLICK); lastActionTime = System.currentTimeMillis(); return;
            }
            if (!IRCTCBridgeModule.pClass.isEmpty() && text.equals(IRCTCBridgeModule.pClass.toLowerCase()) && node.isClickable()) {
                node.performAction(AccessibilityNodeInfo.ACTION_CLICK); lastActionTime = System.currentTimeMillis(); return;
            }

            if (IRCTCBridgeModule.pUseMasterList) {
                if (node.getClassName().toString().contains("CheckBox") && !node.isChecked()) {
                    node.performAction(AccessibilityNodeInfo.ACTION_CLICK); lastActionTime = System.currentTimeMillis();
                }
            } else {
                if (currentPassengerIndex < IRCTCBridgeModule.passengersList.size()) {
                    if (node.getClassName().toString().contains("RadioButton") && (text.equals("male") || desc.equals("male"))) {
                        if (!node.isChecked()) { node.performAction(AccessibilityNodeInfo.ACTION_CLICK); lastActionTime = System.currentTimeMillis(); return; }
                    }
                    if ((text.contains("add passenger") || desc.contains("add passenger")) && (node.isClickable() || node.getClassName().toString().contains("Button"))) {
                        node.performAction(AccessibilityNodeInfo.ACTION_CLICK); 
                        lastActionTime = System.currentTimeMillis(); 
                        currentPassengerIndex++; 
                        return;
                    }
                }
            }

            if ((text.contains("bhim") || text.contains("upi") || desc.contains("bhim")) && node.isClickable()) {
                node.performAction(AccessibilityNodeInfo.ACTION_CLICK); lastActionTime = System.currentTimeMillis(); return;
            }
            if (!IRCTCBridgeModule.pPayMode.isEmpty() && (text.contains(IRCTCBridgeModule.pPayMode) || desc.contains(IRCTCBridgeModule.pPayMode)) && node.isClickable()) {
                node.performAction(AccessibilityNodeInfo.ACTION_CLICK); lastActionTime = System.currentTimeMillis(); return;
            }
        }

        for (int i = 0; i < node.getChildCount(); i++) scanAndBypass(node.getChild(i), isPinMode, editTextCount);
    }

    @RequiresApi(api = Build.VERSION_CODES.R)
    private void processSilentCaptchaScreenshot(AccessibilityNodeInfo captchaInputNode) {
        takeScreenshot(Display.DEFAULT_DISPLAY, getMainExecutor(), new TakeScreenshotCallback() {
            @Override
            public void onSuccess(ScreenshotResult result) {
                try {
                    Bitmap fullScreen = Bitmap.wrapHardwareBuffer(result.getHardwareBuffer(), result.getColorSpace());
                    Rect inputBounds = new Rect(); captchaInputNode.getBoundsInScreen(inputBounds);
                    Rect imageBounds = getCaptchaImageRect(getRootInActiveWindow(), inputBounds);
                    if (imageBounds == null) imageBounds = new Rect(inputBounds.left, Math.max(0, inputBounds.top - 250), Math.min(inputBounds.right, fullScreen.getWidth()), inputBounds.top);
                    Bitmap rawCaptchaBitmap = Bitmap.createBitmap(fullScreen, imageBounds.left, imageBounds.top, imageBounds.width(), imageBounds.height());
                    Bitmap cleanedCaptcha = cleanCaptchaImage(rawCaptchaBitmap);
                    InputImage image = InputImage.fromBitmap(cleanedCaptcha, 0);
                    recognizer.process(image)
                        .addOnSuccessListener(visionText -> {
                            String cleanCaptcha = visionText.getText().replaceAll("[^a-zA-Z0-9]", "");
                            if (cleanCaptcha.length() >= 4) {
                                fillEditText(captchaInputNode, cleanCaptcha);
                            } else {
                                clickRefreshButton(getRootInActiveWindow());
                                lastActionTime = System.currentTimeMillis();
                            }
                            new android.os.Handler(getMainLooper()).postDelayed(() -> isProcessingCaptcha = false, 2500);
                        }).addOnFailureListener(e -> isProcessingCaptcha = false);
                } catch (Exception e) { isProcessingCaptcha = false; }
            }
            @Override
            public void onFailure(int errorCode) { isProcessingCaptcha = false; }
        });
    }
    @Override
    public void onInterrupt() {}
}`;

      fs.writeFileSync(path.join(resXmlPath, 'accessibility_service_config.xml'), xmlContent);
      fs.writeFileSync(path.join(javaPath, 'IRCTCBridgeModule.java'), bridgeModuleContent);
      fs.writeFileSync(path.join(javaPath, 'IRCTCBridgePackage.java'), bridgePackageContent);
      fs.writeFileSync(path.join(javaPath, 'AutoClickService.java'), serviceContent);
      
      return config;
    }
  ]);

  config = withMainApplication(config, (config) => {
    let content = config.modResults.contents;
    if (config.modResults.language === 'kt') {
      if (!content.includes('com.irctcgodmode.IRCTCBridgePackage')) {
        content = content.replace(
          /return PackageList\(this\)\.packages/g,
          'val customPackagesList = PackageList(this).packages\n          customPackagesList.add(com.irctcgodmode.IRCTCBridgePackage())\n          return customPackagesList'
        );
      }
    } else if (config.modResults.language === 'java') {
      if (!content.includes('com.irctcgodmode.IRCTCBridgePackage')) {
        if (content.includes('List<ReactPackage> packages = new PackageList(this).getPackages();')) {
            content = content.replace(
                'List<ReactPackage> packages = new PackageList(this).getPackages();',
                'List<ReactPackage> packages = new PackageList(this).getPackages();\n          packages.add(new com.irctcgodmode.IRCTCBridgePackage());'
            );
        } else {
            content = content.replace(
                /return new PackageList\(this\)\.getPackages\(\);/g,
                'List<ReactPackage> customPackagesList = new PackageList(this).getPackages();\n          customPackagesList.add(new com.irctcgodmode.IRCTCBridgePackage());\n          return customPackagesList;'
            );
        }
      }
    }
    config.modResults.contents = content;
    return config;
  });

  return config;
};
