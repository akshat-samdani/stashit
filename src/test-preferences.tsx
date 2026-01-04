import {
    showToast,
    Toast,
    getPreferenceValues,
    closeMainWindow,
    LocalStorage,
  } from "@raycast/api";
  
  interface Preferences {
    autoClearOnDrop: boolean;
    closeWindowOnDrop: boolean;
  }
  
  const STORAGE_KEY = "stashit-stack";
  
  export default async function TestPreferencesCommand() {
    try {
      const preferences = getPreferenceValues<Preferences>();
      
      // Get current stack count
      const raw = await LocalStorage.getItem<string>(STORAGE_KEY);
      const stack = raw ? JSON.parse(raw) : [];
      
      await showToast({
        style: Toast.Style.Success,
        title: "Preference Test",
        message: `Auto-clear: ${preferences.autoClearOnDrop ? "✓ ON" : "✗ OFF"} | Stack: ${stack.length} items`,
      });
      
      console.log("=== PREFERENCE TEST ===");
      console.log("autoClearOnDrop:", preferences.autoClearOnDrop);
      console.log("closeWindowOnDrop:", preferences.closeWindowOnDrop);
      console.log("Stack items:", stack.length);
      console.log("======================");
      
      // Don't auto-close so user can see the message
      setTimeout(() => closeMainWindow(), 3000);
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Preference test failed",
        message: String(error),
      });
      console.error("Preference test error:", error);
    }
  }