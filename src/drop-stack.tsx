import {
    LocalStorage,
    showToast,
    Toast,
    confirmAlert,
    Alert,
    getSelectedFinderItems,
  } from "@raycast/api";
  import fs from "fs/promises";
  import path from "path";
  
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
  
    for (const item of stack) {
      if (item.type === "file") {
        const target = path.join(destination, item.name);
  
        if (shouldMove) {
          await fs.rename(item.path, target);
        } else {
          await fs.copyFile(item.path, target);
        }
      }
  
      if (item.type === "text") {
        const filename = `stashit-text-${textIndex}.txt`;
        const target = path.join(destination, filename);
  
        await fs.writeFile(target, item.text, "utf8");
        textIndex++;
      }
    }
  
    // 5. Clear stack?
    const clear = await confirmAlert({
      title: "Clear stack?",
      message: "Do you want to clear the stack after dropping?",
      primaryAction: {
        title: "Clear Stack",
        style: Alert.ActionStyle.Destructive,
      },
    });
  
    if (clear) {
      await LocalStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    }
  
    await showToast({
      style: Toast.Style.Success,
      title: "Stack dropped",
      message: `${stack.length} item(s)`,
    });
  }
  