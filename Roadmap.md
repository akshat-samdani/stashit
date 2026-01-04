Nice — love that you want a roadmap-first approach. Below is a compact, prioritized **todo list + product plan** for *stashit* so we can track work, build an MVP quickly, and iterate safely. I grouped things into **MVP (must-have)**, **Phase 2 (nice-to-have)**, and **Future / stretch** — plus exact **commands**, **data model**, **UI & actions**, **repo/dev checklist**, and **publishing items** so nothing gets lost.

# Stashit — Product & implementation todo list

---

## 1) High-level goal

Let users quickly **collect files / text / images / URLs** (via Raycast command or hotkey) into a persistent **Stack**, review the Stack in a list, and then drop/export/share those items in batch or individually.

---

## 2) MVP — must-have features (minimum shippable product)

These are required before public release.

### Functional

1. **Add to Stack**

   * Capture items from clipboard (files, plaintext, image, URLs).
   * Store items persistently (LocalStorage).
   * Show success/failure toast.

2. **Show Stack**

   * List all stacked items (sorted newest → oldest).
   * Preview/inspect item (file icon, filename, text snippet, URL).
   * Filter / search (simple text filter).

3. **Item actions (per-item)**

   * Open (open file, open URL).
   * Reveal in Finder (file).
   * Copy path / Copy content (text).
   * Remove from stack (single item).
   * Share (macOS share sheet, if possible via Raycast API).

4. **Stack-level actions**

   * Drop all to folder (prompt folder select → move/copy files there; for text/URL, create files or a combined .txt).
   * Clear stack (with confirmation).
   * Export stack as JSON (for backup).

5. **Persistence**

   * Use Raycast `LocalStorage` key(s).
   * Data migration support (versions).

6. **Keyboard shortcuts**

   * Hotkey for **Add to Stack** (core workflow).
   * Optional hotkey for **Show Stack**.

7. **Basic tests & lint**

   * Code compiles, basic unit tests where possible.
   * `npm run dev` works and docs show how to run.

### Non-functional

* Clean, minimal UI using Raycast components.
* Good README, MIT license, CONTRIBUTING file, issue templates.
* Repo initialized, published to GitHub `stashit`.

---

## 3) Phase 2 — useful expansions (post-MVP)

1. **Add via Finder Service / contextual menu** (if possible).
2. **Clipboard watchers / auto-capture toggle** (danger: persistent watchers may be restricted).
3. **Organize / tag items** (folders/tags within stack).
4. **Drag-out support**: attempt to support dragging items from Raycast to Finder (quirky/workaround).
5. **Upload targets**: quick upload to S3 / Google Drive / Dropbox / Imgur.
6. **Sync across machines** (GitHub Gist, cloud storage — auth needed).
7. **Menu bar extra** with quick stack count & add button.
8. **Image grid view** for image-heavy stacks.

---

## 4) Future / stretch features

* Web clipper / browser extension to send items to stashit.
* Integrations: Slack / Notion / Trello / Obsidian.
* Smart suggestions, deduplicate items.
* Shareable stack links.
* Multiple stacks / profiles.

---

## 5) Commands required (concrete list)

Create each as a separate Raycast command inside the extension:

* `add-to-stack` — Add clipboard contents to stack (hotkey).
* `show-stack` — Main list UI to view items (template: Show List).
* `remove-item` — Small helper to remove item (action in show-stack).
* `drop-stack` — Open folder selector and move/copy items there (action in show-stack).
* `clear-stack` — Clear all items (confirmation).
* `export-stack` — Save JSON to a chosen path (action).
* `import-stack` — Load from JSON backup (CLI or import command—opt).
* `settings` — (Optional) toggles (auto-capture, default drop behavior).
* `open-in-finder` / `reveal-item` — Action in UI; not separate command.

---

## 6) Data model & storage (exact recommended)

Use a single LocalStorage key: `stashit-stack-v1`.

Type definition (TypeScript):

```ts
type StackItemBase = {
  id: string;            // uuid
  type: "file" | "text" | "url" | "image";
  addedAt: number;       // epoch ms
  source?: string;       // optional (where it came from)
};

type FileItem = StackItemBase & {
  type: "file";
  path: string;          // absolute path
  name: string;
  size?: number;
};

type TextItem = StackItemBase & {
  type: "text";
  text: string;
  preview?: string;      // first 200 chars
};

type UrlItem = StackItemBase & {
  type: "url";
  url: string;
  title?: string;
};

type ImageItem = StackItemBase & {
  type: "image";
  path?: string;         // if saved to tmp file
  dataUri?: string;      // optional small image
  name?: string;
};

type StackItem = FileItem | TextItem | UrlItem | ImageItem;
```

Store: `LocalStorage.setItem("stashit-stack-v1", JSON.stringify(stackArray))`.

Support a lightweight `meta` object for version or settings:

* key: `stashit-meta` -> `{ version: 1, lastBackup?: ..., settings: { preferMoveOnDrop: true } }`

---

## 7) UI & actions (details for Show Stack)

* Use `List` component.
* For each `List.Item`:

  * title: filename / first line of text / URL host
  * icon: file icon or `Icon.Document` etc.
  * accessories: time added (human readable), type tag
  * actions (ActionPanel):

    * Open
    * Reveal in Finder (file)
    * Copy (path/text)
    * Share
    * Remove
    * Move/Copy to... (sub-menu)
* Top-level actions for `List`:

  * Drop all...
  * Export stack
  * Clear stack

UX notes:

* Use `confirm` dialog before destructive actions (clear, remove all).
* Show a toast after drop/move operations.

---

## 8) Error handling & edge cases

* If a file path no longer exists, display “Missing file” and offer to remove.
* For move vs copy: ask user or use default setting.
* For very large stacks, support pagination or lazy-loading (for now, warn at >500 items).
* Handle JSON parse errors (migrate or reset after user confirmation).

---

## 9) Repo & developer checklist (what to add to GitHub)

* `README.md` with features + install instructions
* `LICENSE` (MIT recommended)
* `CONTRIBUTING.md`
* `CODE_OF_CONDUCT.md` (basic)
* `ISSUE_TEMPLATE` + `PULL_REQUEST_TEMPLATE`
* `package.json` with scripts:

  * `dev`, `lint`, `build`, `test`
* `src/` structure:

  ```
  src/
    commands/
      add-to-stack.tsx
      show-stack.tsx
      drop-stack.tsx
    utils/
      storage.ts
      types.ts
      clipboard.ts
    assets/
    README.dev.md
  ```
* GitHub Actions CI:

  * run `npm ci`, `npm run lint`, `npm run build`
  * test Node version matrix (optional)
* Basic unit tests for storage utilities (Jest or Vitest).

---

## 10) Publishing checklist (Raycast store & OSS)

* Ensure extension metadata (description, category, icon).
* Add `README` usage instructions, hotkey suggestions.
* Add a simple demo GIF (optional).
* License & contribution guidelines in repo.
* When submitting to Raycast store, follow their publishing guide (manifest, versioning).
* Add release notes for each version.

---

## 11) Security, privacy & permissions

* Do not upload clipboard contents automatically anywhere (privacy).
* If adding remote upload features later, require explicit OAuth and explain privacy in README.
* Avoid storing sensitive content unencrypted; inform users if stack is synced.

---

## 12) Roadmap & priorities (single-line roadmap)

1. MVP: Add to Stack (clipboard), Show Stack list, per-item actions, Drop all, Clear, Export.
2. Phase 2: Upload targets, tagging, menu bar extra, drag-out experiments.
3. Future: Sync, browser clipper, integrations.

---

## 13) Next actionable steps (what I’ll do next if you say go)

1. Create `add-to-stack.tsx` command (you already have this; we’ll refine as needed).
2. Implement `storage.ts` util + types.
3. Implement `show-stack.tsx` (full List UI + actions).
4. Add unit tests for storage read/write and migration.
5. Add README & GitHub housekeeping files.

---

If you want, I’ll **generate the full file structure and code for step 1 & 2 now**:

* `src/commands/add-to-stack.tsx`
* `src/utils/storage.ts`
* `src/utils/types.ts`
* Update `package.json` scripts

Say **“generate code for MVP add & storage”** and I’ll produce the exact TypeScript code files and small helper utilities you can drop into your repo.
