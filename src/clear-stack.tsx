import {
    LocalStorage,
    showToast,
    Toast,
    confirmAlert,
    Alert,
    closeMainWindow,
  } from "@raycast/api";
  
  const STORAGE_KEY = "stashit-stack";
  
  export default async function ClearStackCommand() {
    try {
      // Load current stack to show count
      const raw = await LocalStorage.getItem<string>(STORAGE_KEY);
      const stack = raw ? JSON.parse(raw) : [];
  
      if (stack.length === 0) {
        await showToast({
          style: Toast.Style.Animated,
          title: "Stack is already empty",
        });
        await closeMainWindow();
        return;
      }
  
      // Confirm before clearing
      const confirmed = await confirmAlert({
        title: "Clear entire stack?",
        message: `This will permanently remove all ${stack.length} item${stack.length > 1 ? "s" : ""} from your stack.`,
        primaryAction: {
          title: "Clear Stack",
          style: Alert.ActionStyle.Destructive,
        },
      });
  
      if (!confirmed) {
        return;
      }
  
      // Clear the stack
      await LocalStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  
      await showToast({
        style: Toast.Style.Success,
        title: "Stack cleared",
        message: `Removed ${stack.length} item${stack.length > 1 ? "s" : ""}`,
      });
  
      await closeMainWindow();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to clear stack",
        message: String(error),
      });
    }
  }