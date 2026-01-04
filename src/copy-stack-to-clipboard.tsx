import {
    Clipboard,
    LocalStorage,
    Toast,
    showToast,
    closeMainWindow,
  } from "@raycast/api";
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
  
  function normalizePath(path: string): string {
    if (!path) return path;
    
    let normalized = path;
    normalized = normalized.replace(/^file:\/\/(\/)?(localhost\/)?/i, "");
    
    try {
      normalized = decodeURIComponent(normalized);
    } catch {
      // Already decoded
    }
    
    if (!normalized.startsWith("/")) {
      normalized = "/" + normalized;
    }
    
    return normalized;
  }
  
  /**
   * Copy files using JXA (JavaScript for Automation)
   * This is more reliable than AppleScript for multiple files
   */
  async function copyFilesToClipboard(filePaths: string[]): Promise<void> {
    if (filePaths.length === 0) {
      throw new Error("No files to copy");
    }
  
    if (filePaths.length === 1) {
      await Clipboard.copy({ file: filePaths[0] });
      return;
    }
  
    // For multiple files, use JXA which properly handles NSPasteboard
    const jxaScript = `
      const app = Application.currentApplication();
      app.includeStandardAdditions = true;
      
      ObjC.import('AppKit');
      
      const pasteboard = $.NSPasteboard.generalPasteboard;
      pasteboard.clearContents;
      
      const fileURLs = $.NSMutableArray.alloc.init;
      ${filePaths.map(p => `fileURLs.addObject($.NSURL.fileURLWithPath('${p.replace(/'/g, "\\'")}'));`).join('\n    ')}
      
      const success = pasteboard.writeObjects(fileURLs);
      
      if (success) {
        'Success';
      } else {
        throw new Error('Failed to write to pasteboard');
      }
    `;
  
    try {
      await execFileAsync("osascript", ["-l", "JavaScript", "-e", jxaScript]);
    } catch (error) {
      throw new Error(`Failed to copy files: ${error}`);
    }
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
  
      const filePaths = stack
        .filter((item): item is Extract<StackItem, { type: "file" }> => item.type === "file")
        .map((item) => normalizePath(item.path))
        .filter((path) => path.length > 0);
  
      if (filePaths.length === 0) {
        await showToast({
          style: Toast.Style.Failure,
          title: "No files in stack",
          message: "Only files can be pasted.",
        });
        return;
      }
  
      await copyFilesToClipboard(filePaths);
  
      await showToast({
        style: Toast.Style.Success,
        title: "Files ready to paste!",
        message: `${filePaths.length} file${filePaths.length > 1 ? "s" : ""} copied - Press ⌘V anywhere`,
      });
  
      await closeMainWindow();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to copy stack",
        message: String(error),
      });
    }
  }