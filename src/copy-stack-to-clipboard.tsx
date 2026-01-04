import {
  Clipboard,
  LocalStorage,
  Toast,
  showToast,
  closeMainWindow,
} from "@raycast/api";
import { spawn } from "child_process";
import { promisify } from "util";
import { execFile } from "child_process";

const execFileAsync = promisify(execFile);

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

/**
 * Normalize file path - handles file:// URLs and URL encoding
 */
function normalizePath(path: string): string {
  if (!path) return path;
  
  let normalized = path;
  
  // Remove file:// protocol if present (handles file://, file:///, file://localhost/)
  normalized = normalized.replace(/^file:\/\/(\/)?(localhost\/)?/i, "");
  
  // Decode URL encoding (e.g., %20 -> space, %2F -> /)
  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    // If decoding fails, use the path as-is (might already be decoded)
  }
  
  // Ensure we have a valid absolute path (starts with /)
  if (!normalized.startsWith("/")) {
    normalized = "/" + normalized;
  }
  
  return normalized;
}

/**
 * Copy files to clipboard using AppleScript (works for single or multiple files)
 */
async function copyFilesToClipboard(filePaths: string[]): Promise<void> {
  if (filePaths.length === 0) {
    throw new Error("No files to copy");
  }

  if (filePaths.length === 1) {
    // Single file - use Raycast API
    await Clipboard.copy({ file: filePaths[0] });
    return;
  }

  // Multiple files - use AppleScript
  // Build a simple, reliable script that copies all files at once
  const fileRefs: string[] = [];
  
  for (const path of filePaths) {
    // Escape backslashes and quotes for AppleScript
    const escaped = path.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    // Create alias reference (required for clipboard)
    fileRefs.push(`(POSIX file "${escaped}" as alias)`);
  }
  
  // Single command to set clipboard with all files
  // This is the standard macOS way to copy multiple files
  const script = `set the clipboard to {${fileRefs.join(", ")}}`;
  
  // Execute with error handling
  await execFileAsync("osascript", ["-e", script]);
}

export default async function CopyStackToClipboardCommand() {
  try {
    const raw = await LocalStorage.getItem<string>(STORAGE_KEY);
    const stack: StackItem[] = raw ? JSON.parse(raw) : [];

    if (stack.length === 0) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Stack is empty",
        message: "Add files to stack first",
      });
      return;
    }

    // Extract and normalize file paths
    const filePaths = stack
      .filter((item): item is Extract<StackItem, { type: "file" }> => item.type === "file")
      .map((item) => normalizePath(item.path))
      .filter((path) => path.length > 0); // Filter out invalid paths

    if (filePaths.length === 0) {
      await showToast({
        style: Toast.Style.Failure,
        title: "No files in stack",
        message: "Only files can be pasted. Text items are not supported.",
      });
      return;
    }

    // Copy files to clipboard (Dropover-like behavior)
    // This allows pasting anywhere: Finder, email, browser, etc.
    await copyFilesToClipboard(filePaths);

    // Verify files were copied by checking clipboard
    // (This helps debug if clipboard isn't being set)
    const clipboardCheck = await Clipboard.read();
    const hasFiles = clipboardCheck?.file !== undefined;
    
    await showToast({
      style: Toast.Style.Success,
      title: hasFiles ? "Stack ready to paste" : "Files copied (verify in Finder)",
      message: `${filePaths.length} file${filePaths.length > 1 ? "s" : ""} ready - Try ⌘V in Finder first to test`,
    });

    // Auto-close for fast workflow (like Dropover)
    await closeMainWindow();
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Failed to copy stack",
      message: String(error),
    });
  }
}
  