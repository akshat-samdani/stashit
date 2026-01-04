import {
    LocalStorage,
    showToast,
    Toast,
    confirmAlert,
    Alert,
    getSelectedFinderItems,
    getPreferenceValues,
  } from "@raycast/api";
  import fs from "fs/promises";
  import path from "path";
  
  interface Preferences {
    autoClearOnDrop: boolean;
    closeWindowOnDrop: boolean;
  }
  
  type StackItem =
    | {
        id: string;
        type: "file";
        path: string;
        name: string;
        addedAt: number;
      }
    | {
        id: string;
        type: "text";
        text: string;
        addedAt: number;
      };
  
  const STORAGE_KEY = "stashit-stack";
  
  export default async function DropStackCommand() {
    const preferences = getPreferenceValues<Preferences>();
    
    // 1. Load stack
    const raw = await LocalStorage.getItem<string>(STORAGE_KEY);
    const stack: StackItem[] = raw ? JSON.parse(raw) : [];
  
    if (stack.length === 0) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Stack is empty",
      });
      return;
    }
  
    // 2. Get destination folder (Finder selection)
    const finderItems = await getSelectedFinderItems();
  
    if (!finderItems || finderItems.length !== 1) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Select a destination folder in Finder",
        message: "Exactly one folder must be selected",
      });
      return;
    }
  
    const destination = finderItems[0].path;
  
    // Verify destination is a directory
    try {
      const stats = await fs.stat(destination);
      if (!stats.isDirectory()) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Invalid destination",
          message: "Selected item must be a folder",
        });
        return;
      }
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Cannot access destination",
        message: String(error),
      });
      return;
    }
  
    // 3. Copy or Move?
    const shouldMove = await confirmAlert({
      title: "Drop stack",
      message: "How do you want to drop the items?",
      primaryAction: {
        title: "Move",
      },
    });
  
    // 4. Perform drop
    let textIndex = 1;
    let successCount = 0;
    let failedCount = 0;
  
    for (const item of stack) {
      try {
        if (item.type === "file") {
          // Check if source file exists
          try {
            await fs.access(item.path);
          } catch {
            console.log(`File not found: ${item.path}`);
            failedCount++;
            continue;
          }
  
          const target = path.join(destination, item.name);
  
          if (shouldMove) {
            await fs.rename(item.path, target);
          } else {
            await fs.copyFile(item.path, target);
          }
          successCount++;
        }
  
        if (item.type === "text") {
          const filename = `stashit-text-${textIndex}.txt`;
          const target = path.join(destination, filename);
  
          await fs.writeFile(target, item.text, "utf8");
          textIndex++;
          successCount++;
        }
      } catch (error) {
        console.error(`Failed to drop item:`, error);
        failedCount++;
      }
    }
  
    // 5. Handle clearing based on preference
    let shouldClear = preferences.autoClearOnDrop;
  
    // If auto-clear is disabled, ask the user
    if (!shouldClear) {
      shouldClear = await confirmAlert({
        title: "Clear stack?",
        message: "Do you want to clear the stack after dropping?",
        primaryAction: {
          title: "Clear Stack",
          style: Alert.ActionStyle.Destructive,
        },
      });
    }
  
    if (shouldClear) {
      await LocalStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    }
  
    // 6. Show result
    const messages: string[] = [];
    if (successCount > 0) {
      messages.push(`${successCount} item${successCount > 1 ? "s" : ""} dropped`);
    }
    if (failedCount > 0) {
      messages.push(`${failedCount} failed`);
    }
    if (shouldClear) {
      messages.push("stack cleared");
    }
  
    await showToast({
      style: failedCount > 0 ? Toast.Style.Animated : Toast.Style.Success,
      title: successCount > 0 ? "Drop complete" : "Drop failed",
      message: messages.join(", "),
    });
  }