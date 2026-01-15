import React from "react";
import {
  App,
  Editor,
  FileView,
  MarkdownView,
  TFile,
  WorkspaceLeaf,
} from "obsidian";
import { ArrowUpRight } from "lucide-react";
import { findTaskLineByIdOrText } from "../lib/utils";
import { BaseTask } from "../types/base-task";

interface LinkButtonProps {
  taskStatus?: "todo" | "done" | "canceled" | "in_progress";
  link: string;
  app: App;
  task: BaseTask;
}

// Detect if the file is already opened in a leaf.
// Checks both loaded views and deferred/unactivated tabs.
function findLeafWithFile(app: App, filePath: string): WorkspaceLeaf | null {
  const leaves = app.workspace.getLeavesOfType("markdown");

  for (const leaf of leaves) {
    // Check loaded view first
    const fileView = leaf.view as FileView;
    if (fileView?.file && fileView.file.path === filePath) {
      return leaf;
    }

    // Check deferred/unactivated tabs via view state
    const state = leaf.getViewState();
    if (state?.state?.file === filePath) {
      return leaf;
    }
  }

  return null;
}

export const LinkButton = ({
  link,
  app,
  taskStatus = "todo",
  task,
}: LinkButtonProps) => {
  const status =
    taskStatus === "done"
      ? "success"
      : taskStatus === "canceled"
        ? "error"
        : "normal";
  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Try to find the file obj
    const abstractFile = app.vault.getAbstractFileByPath(link);

    if (!(abstractFile instanceof TFile)) {
      throw new Error(`File not found: ${link}`);
    }

    const existingLeaf = findLeafWithFile(app, link);
    let targetLeaf: WorkspaceLeaf | null;

    if (existingLeaf) {
      await app.workspace.revealLeaf(existingLeaf);
      app.workspace.setActiveLeaf(existingLeaf, { focus: true });
      targetLeaf = existingLeaf;
    } else {
      await app.workspace.openLinkText(link, link);
      targetLeaf = findLeafWithFile(app, link);
    }

    // Wait for the view to be fully loaded
    const highlightTask = async () => {
      if (!targetLeaf || !(targetLeaf.view instanceof MarkdownView)) {
        return;
      }

      const editor = targetLeaf.view.editor;
      if (!editor || !task?.text) {
        return;
      }

      // Search for the exact task text in the document
      const content = editor.getValue();
      const lines = content.split("\n");
      let lineIdx = findTaskLineByIdOrText(lines, task.id, task.text);

      if (lineIdx === -1) {
        return; // Task not found
      }

      // lineIdx = getAdjustedSourceLine(app, lineIdx);

      const scrollAndSelect = async (editor: Editor, lineIdx: number) => {
        const scrollPromise = new Promise<void>((resolve) => {
          editor.scrollIntoView(
            {
              from: { line: lineIdx, ch: 0 },
              to: { line: lineIdx, ch: 0 },
            },
            true
          );

          // wait for scroll
          setTimeout(resolve, 350);
        });

        await scrollPromise;

        editor.setCursor({ line: lineIdx, ch: 0 });
        const lineLength = editor.getLine(lineIdx).length;
        editor.setSelection(
          { line: lineIdx, ch: 0 },
          { line: lineIdx, ch: lineLength }
        );
      };

      await scrollAndSelect(editor, lineIdx);
    };

    const waitForEditor = () => {
      if (targetLeaf && targetLeaf.view instanceof MarkdownView) {
        highlightTask();
      } else {
        setTimeout(waitForEditor, 100);
      }
    };

    setTimeout(waitForEditor, 100);
  };

  return (
    <button
      className={`tasks-map-link-button tasks-map-link-button--${status}`}
      onClick={handleClick}
    >
      <ArrowUpRight size={16} />
    </button>
  );
};
