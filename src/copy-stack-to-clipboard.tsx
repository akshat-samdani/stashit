import {
    Clipboard,
    LocalStorage,
    Toast,
    showToast,
    closeMainWindow,
  } from "@raycast/api";
  import { promisify } from "util";
  import { execFile } from "child_process";
  import fs from "fs/promises";
  
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
   * Uses NSPasteboardItem for better reliability with multiple files
   */
  async function copyFilesToClipboard(filePaths: string[]): Promise<void> {
    if (filePaths.length === 0) {
      throw new Error("No files to copy");
    }
  
    if (filePaths.length === 1) {
      await Clipboard.copy({ file: filePaths[0] });
      return;
    }
  
    // For multiple files, use JXA with NSPasteboardItem (like Maccy does)
    const jxaScript = `
      const app = Application.currentApplication();
      app.includeStandardAdditions = true;
      
      ObjC.import('AppKit');
      ObjC.import('Foundation');
      
      const pasteboard = $.NSPasteboard.generalPasteboard;
      pasteboard.clearContents;
      
      // Create array of NSPasteboardItem objects (more reliable than direct URLs)
      const items = $.NSMutableArray.alloc.init;
      
      ${filePaths.map(p => {
        const escaped = p.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return `
      const url${filePaths.indexOf(p)} = $.NSURL.fileURLWithPath('${escaped}');
      const item${filePaths.indexOf(p)} = $.NSPasteboardItem.alloc.init;
      const data${filePaths.indexOf(p)} = url${filePaths.indexOf(p)}.dataRepresentation;
      item${filePaths.indexOf(p)}.setDataForType(data${filePaths.indexOf(p)}, $.NSPasteboardTypeFileURL);
      items.addObject(item${filePaths.indexOf(p)});`;
      }).join('\n')}
      
      const success = pasteboard.writeObjects(items);
      
      if (!success) {
        throw new Error('NSPasteboard writeObjects returned false');
      }
      
      // Verify files were written
      const types = pasteboard.types;
      if (!types.containsObject($.NSPasteboardTypeFileURL)) {
        throw new Error('File URL type not in pasteboard after write');
      }
      
      'Success: ' + items.count + ' files copied';
    `;
  
    try {
      const { stdout } = await execFileAsync("osascript", ["-l", "JavaScript", "-e", jxaScript]);
      console.log("JXA result:", stdout);
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
  
      // Validate which files actually exist
      const validFiles: string[] = [];
      const missingFiles: string[] = [];
  
      for (const filePath of filePaths) {
        try {
          await fs.access(filePath);
          validFiles.push(filePath);
        } catch {
          missingFiles.push(filePath);
        }
      }
  
      if (validFiles.length === 0) {
        await showToast({
          style: Toast.Style.Failure,
          title: "All files are missing",
          message: "Files may have been moved or deleted",
        });
        return;
      }
  
      // Warn if some files are missing
      if (missingFiles.length > 0) {
        await showToast({
          style: Toast.Style.Animated,
          title: "Some files are missing",
          message: `${missingFiles.length} file(s) no longer exist - copying ${validFiles.length} available`,
        });
        // Give user time to see the warning
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
  
      await copyFilesToClipboard(validFiles);
  
      await showToast({
        style: Toast.Style.Success,
        title: "Files ready to paste!",
        message: `${validFiles.length} file${validFiles.length > 1 ? "s" : ""} copied - Press ⌘V anywhere`,
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