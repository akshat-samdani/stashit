import {
  Clipboard,
  LocalStorage,
  showToast,
  Toast,
  closeMainWindow,
  getSelectedFinderItems,
} from "@raycast/api";
import { randomUUID } from "crypto";
import fs from "fs/promises";

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

export default async function Command() {
  try {
    // 1. Load existing stack
    const existingRaw = await LocalStorage.getItem<string>(STORAGE_KEY);
    const stack: StackItem[] = existingRaw ? JSON.parse(existingRaw) : [];

    let addedCount = 0;

    // 2. Try to get files from Finder selection first (Dropover-like behavior)
    try {
      const finderItems = await getSelectedFinderItems();
      if (finderItems && finderItems.length > 0) {
        for (const item of finderItems) {
          try {
            // Check if it's a file (not a directory) by checking stats
            const stats = await fs.stat(item.path);
            if (stats.isFile()) {
              stack.push({
                id: randomUUID(),
                type: "file",
                path: item.path,
                name: item.path.split("/").pop() ?? item.path,
                addedAt: Date.now(),
              });
              addedCount++;
            }
          } catch (statError) {
            // Skip items that can't be accessed (permissions, etc.)
            continue;
          }
        }
      }
    } catch (error) {
      // Finder selection not available, continue to clipboard
      // Don't store error messages - just continue silently
    }

    // 3. If no Finder items, try clipboard
    if (addedCount === 0) {
      const clipboard = await Clipboard.read();

      if (clipboard?.file) {
        const files = Array.isArray(clipboard.file)
          ? clipboard.file
          : [clipboard.file];

        for (const filePath of files) {
          stack.push({
            id: randomUUID(),
            type: "file",
            path: filePath,
            name: filePath.split("/").pop() ?? filePath,
            addedAt: Date.now(),
          });
          addedCount++;
        }
      }

      // Handle text from clipboard
      if (clipboard?.text) {
        stack.push({
          id: randomUUID(),
          type: "text",
          text: clipboard.text,
          addedAt: Date.now(),
        });
        addedCount++;
      }
    }

    if (addedCount === 0) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Nothing to add",
        message: "Select files in Finder or copy files/text to clipboard",
      });
      return;
    }

    // 4. Persist stack
    await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(stack));

    // 5. Feedback
    await showToast({
      style: Toast.Style.Success,
      title: "Added to Stack",
      message: `${addedCount} item${addedCount > 1 ? "s" : ""} stashed`,
    });

    // Close Raycast for fast workflow
    await closeMainWindow();
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Failed to add to stack",
      message: String(error),
    });
  }
}
