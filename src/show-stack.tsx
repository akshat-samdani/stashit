import {
  Action,
  ActionPanel,
  Alert,
  confirmAlert,
  Icon,
  List,
  LocalStorage,
  Toast,
  showToast,
  open,
  launchCommand,
  LaunchType,
  Clipboard,
  closeMainWindow,
  getPreferenceValues,
} from "@raycast/api";
import { useEffect, useState } from "react";

/* ----------------------------- Types ----------------------------- */

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

/* --------------------------- Component ---------------------------- */

export default function ShowStackCommand() {
  const [items, setItems] = useState<StackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const preferences = getPreferenceValues<Preferences>();

  useEffect(() => {
    loadStack();
  }, []);

  /* --------------------------- Storage ---------------------------- */

  async function loadStack() {
    try {
      const raw = await LocalStorage.getItem<string>(STORAGE_KEY);
      const parsed: StackItem[] = raw ? JSON.parse(raw) : [];
      setItems(parsed.sort((a, b) => b.addedAt - a.addedAt));
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to load stack",
        message: String(error),
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function saveStack(updated: StackItem[]) {
    setItems(updated);
    await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  /* --------------------------- Actions ---------------------------- */

  async function removeItem(id: string) {
    const confirmed = await confirmAlert({
      title: "Remove item?",
      message: "This will permanently remove the item from the stack.",
      primaryAction: {
        title: "Remove",
        style: Alert.ActionStyle.Destructive,
      },
    });

    if (!confirmed) return;

    await saveStack(items.filter((item) => item.id !== id));

    await showToast({
      style: Toast.Style.Success,
      title: "Item removed",
    });
  }

  async function clearStack() {
    const confirmed = await confirmAlert({
      title: "Clear stack?",
      message: "This will permanently remove all items.",
      primaryAction: {
        title: "Clear",
        style: Alert.ActionStyle.Destructive,
      },
    });

    if (!confirmed) return;

    await saveStack([]);

    await showToast({
      style: Toast.Style.Success,
      title: "Stack cleared",
    });
  }

  /* ----------------------------- UI ------------------------------- */

  async function dropStack() {
    await launchCommand({ name: "copy-stack-to-clipboard", type: LaunchType.UserInitiated });
    
    // If auto-clear is enabled, reload the stack after a short delay
    if (preferences.autoClearOnDrop) {
      setTimeout(() => loadStack(), 100);
    }
  }

  async function dropSingleItem(item: StackItem) {
    if (item.type !== "file") {
      await showToast({
        style: Toast.Style.Failure,
        title: "Cannot drop text",
        message: "Only files can be dropped. Use copy for text.",
      });
      return;
    }

    try {
      // Normalize path (handle file:// URLs)
      let path = item.path;
      if (path.startsWith("file://")) {
        path = path.replace(/^file:\/\/(\/)?(localhost\/)?/i, "");
        try {
          path = decodeURIComponent(path);
        } catch {
          // Already decoded
        }
        if (!path.startsWith("/")) {
          path = "/" + path;
        }
      }

      await Clipboard.copy({ file: path });
      
      // Remove this item from stack if auto-clear is enabled
      if (preferences.autoClearOnDrop) {
        await saveStack(items.filter((i) => i.id !== item.id));
        await showToast({
          style: Toast.Style.Success,
          title: "File dropped & removed",
          message: "Press ⌘V anywhere",
        });
      } else {
        await showToast({
          style: Toast.Style.Success,
          title: "File ready to paste",
          message: "Press ⌘V anywhere",
        });
      }
      
      if (preferences.closeWindowOnDrop) {
        await closeMainWindow();
      }
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to copy file",
        message: String(error),
      });
    }
  }

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search your stack…"
      actions={
        <ActionPanel>
          <Action
            title="Drop All Stack"
            icon={Icon.Clipboard}
            shortcut={{ modifiers: ["cmd"], key: "d" }}
            onAction={dropStack}
          />
          <Action
            title="Clear Stack"
            icon={Icon.Trash}
            style={Action.Style.Destructive}
            shortcut={{ modifiers: ["cmd", "shift"], key: "backspace" }}
            onAction={clearStack}
          />
        </ActionPanel>
      }
    >
      {items.length === 0 && !isLoading ? (
        <List.EmptyView
          icon={Icon.Tray}
          title="Stack is empty"
          description="Copy something and use “Add to Stack”"
        />
      ) : (
        items.map((item) => (
          <List.Item
            key={item.id}
            title={getTitle(item)}
            subtitle={getSubtitle(item)}
            icon={getIcon(item)}
            accessories={[
              {
                icon: Icon.Clock,
                text: new Date(item.addedAt).toLocaleTimeString(),
              },
            ]}
            detail={
              <List.Item.Detail
                markdown={getDetailMarkdown(item)}
                metadata={getMetadata(item)}
              />
            }
            actions={
              <ActionPanel>
                <Action
                  title="Drop All Stack"
                  icon={Icon.Clipboard}
                  shortcut={{ modifiers: ["cmd"], key: "d" }}
                  onAction={dropStack}
                />
                {item.type === "file" ? (
                  <>
                    <Action
                      title="Drop This Item"
                      icon={Icon.Clipboard}
                      shortcut={{ modifiers: ["cmd"], key: "return" }}
                      onAction={() => dropSingleItem(item)}
                    />
                    <Action
                      title="Open File"
                      icon={Icon.ArrowRight}
                      onAction={() => open(item.path)}
                    />
                    <Action.ShowInFinder path={item.path} />
                    <Action.CopyToClipboard
                      title="Copy File Path"
                      content={item.path}
                    />
                  </>
                ) : (
                  <Action.CopyToClipboard
                    title="Copy Text"
                    content={item.text}
                  />
                )}

                <ActionPanel.Section>
                  <Action
                    title="Remove from Stack"
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    shortcut={{ modifiers: ["cmd"], key: "backspace" }}
                    onAction={() => removeItem(item.id)}
                  />
                  <Action
                    title="Clear All Items"
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "backspace" }}
                    onAction={clearStack}
                  />
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}

/* ------------------------- Helpers -------------------------- */

function getTitle(item: StackItem): string {
  if (item.type === "file") return item.name;

  return (
    item.text
      .split("\n")
      .find((line) => line.trim())
      ?.slice(0, 80) ?? "Text"
  );
}

function getSubtitle(item: StackItem): string {
  if (item.type === "file") return "File";
  return `Text · ${item.text.length} chars`;
}

function getIcon(item: StackItem) {
  return item.type === "file" ? Icon.Document : Icon.Text;
}

function getDetailMarkdown(item: StackItem): string {
  if (item.type === "file") {
    return `### 📄 ${item.name}\n\n\`${item.path}\``;
  }

  const looksLikeCode =
    item.text.includes("import ") ||
    item.text.includes("{") ||
    item.text.includes(";") ||
    item.text.includes("const ");

  if (looksLikeCode) {
    return "```ts\n" + item.text + "\n```";
  }

  return item.text;
}

function getMetadata(item: StackItem) {
  return (
    <List.Item.Detail.Metadata>
      <List.Item.Detail.Metadata.Label title="Type" text={item.type} />
      <List.Item.Detail.Metadata.Label
        title="Added"
        text={new Date(item.addedAt).toLocaleString()}
      />
      {item.type === "file" && (
        <List.Item.Detail.Metadata.Label title="Path" text={item.path} />
      )}
    </List.Item.Detail.Metadata>
  );
}