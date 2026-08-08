const { withAndroidManifest, withDangerousMod, withMainApplication } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withIRCTCAutomator(config) {
  
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    
    if (!manifest.manifest.queries) {
        manifest.manifest.queries = [{ package: [] }];
    } else if (!manifest.manifest.queries[0].package) {
        manifest.manifest.queries[0].package = [];
    }

    const packagesToQuery = ["cris.org.in.prs.ima"];
    packagesToQuery.forEach(pkg => {
        const exists = manifest.manifest.queries[0].package.some(p => p.$['android:name'] === pkg);
        if (!exists) {
            manifest.manifest.queries[0].package.push({ '$': { 'android:name': pkg } });
        }
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
    android:accessibilityFlags="flagDefault|flagIncludeNotImportantViews|flagRetrieveInteractiveWindows|flagReportViewIds"
    android:canRetrieveWindowContent="true"
    android:canPerformGestures="true" 
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
    public static String pTrain = "";
    public static String pClass = "";
    public static ArrayList<HashMap<String, String>> passengersList = new ArrayList<>();
    public static boolean isGodModeOn = false;

    public IRCTCBridgeModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() { return "IRCTCBridge"; }

    @ReactMethod
    public void syncPassengerData(String train, String tClass, String passengersJson) {
        pTrain = train;
        pClass = tClass;
        passengersList.clear();
        try {
            JSONArray arr = new JSONArray(passengersJson);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                HashMap<String, String> map = new HashMap<>();
                map.put("name", obj.getString("name"));
                map.put("age", obj.getString("age"));
                passengersList.add(map);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @ReactMethod
    public void setGodModeStatus(boolean status) {
        isGodModeOn = status;
    }

    @ReactMethod
    public void checkAccessibilityPermission(Promise promise) {
        int accessibilityEnabled = 0;
        final String service = getReactApplicationContext().getPackageName() + "/" + AutoClickService.class.getCanonicalName();
        try {
            accessibilityEnabled = Settings.Secure.getInt(
                getReactApplicationContext().getApplicationContext().getContentResolver(),
                Settings.Secure.ACCESSIBILITY_ENABLED);
        } catch (Settings.SettingNotFoundException e) {}
        
        TextUtils.SimpleStringSplitter mStringColonSplitter = new TextUtils.SimpleStringSplitter(':');
        if (accessibilityEnabled == 1) {
            String settingValue = Settings.Secure.getString(
                getReactApplicationContext().getApplicationContext().getContentResolver(),
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
            if (settingValue != null) {
                mStringColonSplitter.setString(settingValue);
                while (mStringColonSplitter.hasNext()) {
                    String accessibilityService = mStringColonSplitter.next();
                    if (accessibilityService.equalsIgnoreCase(service)) {
                        promise.resolve(true);
                        return;
                    }
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
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }

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

public class AutoClickService extends AccessibilityService {
    private long lastActionTime = 0;
    private int currentPassengerIndex = 0; // Tracks which passenger is being filled

    // Random Human Delay (400ms to 900ms) to bypass Bot Detection
    private long getRandomDelay() {
        return 400 + (long)(Math.random() * 500);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (!IRCTCBridgeModule.isGodModeOn) return;
        
        CharSequence pkgName = event.getPackageName();
        if (pkgName == null || !pkgName.toString().contains("cris.org.in.prs.ima")) return;

        // Reset index if we reach booking summary or home (To be safe)
        if (event.getEventType() == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
             CharSequence className = event.getClassName();
             if (className != null && className.toString().contains("DashboardActivity")) {
                 currentPassengerIndex = 0; // Reset on Dashboard
             }
        }

        AccessibilityNodeInfo rootNode = getRootInActiveWindow();
        if (rootNode != null) {
            scanAndBypass(rootNode);
        }
    }

    private void scanAndBypass(AccessibilityNodeInfo node) {
        if (node == null) return;
        
        CharSequence textSeq = node.getText();
        CharSequence descSeq = node.getContentDescription();
        String text = textSeq != null ? textSeq.toString().toLowerCase() : "";
        String desc = descSeq != null ? descSeq.toString().toLowerCase() : "";

        if (System.currentTimeMillis() - lastActionTime > getRandomDelay()) {
            
            // 1. Auto Login
            if ((text.equals("login") || desc.equals("login")) && node.isClickable()) {
                node.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                lastActionTime = System.currentTimeMillis();
                return;
            }
            
            // 2. Train Selection
            if (!IRCTCBridgeModule.pTrain.isEmpty() && text.contains(IRCTCBridgeModule.pTrain) && node.isClickable()) {
                node.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                lastActionTime = System.currentTimeMillis();
                return;
            }

            // 3. Class Selection (SL / 3A)
            if (!IRCTCBridgeModule.pClass.isEmpty() && text.equals(IRCTCBridgeModule.pClass.toLowerCase()) && node.isClickable()) {
                node.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                lastActionTime = System.currentTimeMillis();
                return;
            }

            // 4. Fill Passenger Name & Age dynamically from ArrayList
            if (currentPassengerIndex < IRCTCBridgeModule.passengersList.size()) {
                
                String targetName = IRCTCBridgeModule.passengersList.get(currentPassengerIndex).get("name");
                String targetAge = IRCTCBridgeModule.passengersList.get(currentPassengerIndex).get("age");

                // Fill Name
                if ((text.contains("first name") || text.contains("passenger name") || desc.contains("name")) && node.getClassName().toString().contains("EditText")) {
                    Bundle arguments = new Bundle();
                    arguments.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, targetName);
                    node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments);
                    lastActionTime = System.currentTimeMillis();
                    return;
                }
                
                // Fill Age & Move to Next Index
                if ((text.contains("age") || desc.contains("age") || text.equals("yea")) && node.getClassName().toString().contains("EditText")) {
                    Bundle arguments = new Bundle();
                    arguments.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, targetAge);
                    node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments);
                    lastActionTime = System.currentTimeMillis();
                    
                    // Increment passenger index after age is filled so it moves to next person
                    currentPassengerIndex++; 
                    return;
                }
            }
        }

        int childCount = node.getChildCount();
        for (int i = 0; i < childCount; i++) {
            scanAndBypass(node.getChild(i));
        }
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
