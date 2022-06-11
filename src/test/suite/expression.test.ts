/* global suite, test */

import expect from "expect";
import fs from "fs";
import path from "path";

import {
  window,
  workspace,
  commands,
  Selection,
  ConfigurationTarget,
  Uri,
  TextDocument,
  Disposable,
  TextEditor,
} from "vscode";

const file = (name: string): string =>
  path.join(__dirname, "../../../test_files", name);

const uri = (name: string): Uri => Uri.file(file(name));

const compare = (document: TextDocument, filename: string) => {
  let result = document.getText();
  let expected = fs.readFileSync(file(filename), { encoding: "utf-8" });

  expect(result).toBe(expected);
};

const cloneSelection = (selection: Selection): Selection =>
  new Selection(
    selection.anchor.line,
    selection.anchor.character,
    selection.active.line,
    selection.active.character,
  );

const selectionSort = (a: Selection, b: Selection): number => {
  let lineCmp = a.start.line - b.start.line;
  if (lineCmp === 0) {
    return a.start.character - b.start.character;
  }
  return lineCmp;
};

function awaitComplete(): Promise<void> {
  if (window.visibleTextEditors.length === 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let listener: Disposable;

    let finished = () => {
      listener!.dispose();
      resolve();
    };

    listener = commands.registerTextEditorCommand(
      "backticks.test.complete",
      finished,
    );
  });
}

function closeEditor(): Promise<void> {
  return new Promise<void>((resolve) => {
    let listener: Disposable;

    let closed = (editors: readonly TextEditor[]) => {
      if (editors.length > 0) {
        return;
      }

      listener!.dispose();
      resolve();
    };

    listener = window.onDidChangeVisibleTextEditors(closed);
    commands.executeCommand("workbench.action.closeActiveEditor");
  });
}

async function manipulate(
  editor: TextEditor,
  selections: Selection[][],
  expectedSelections: Selection[][],
): Promise<void> {
  expect(selections.length).toBe(expectedSelections.length);

  for (let i = 0; i < selections.length; i++) {
    let selection = selections[i]!.map(cloneSelection);
    selection.sort(selectionSort);
    let expected = expectedSelections[i]!.map(cloneSelection);
    expected.sort(selectionSort);

    editor.selections = selection;
    let complete = awaitComplete();
    await commands.executeCommand("backticks.convertQuotes", {
      fromKeyboard: true,
    });
    await complete;

    let finalSelections = editor.selections.map(cloneSelection);
    finalSelections.sort(selectionSort);

    expect(finalSelections.length).toBe(expected.length);
    for (
      let j = 0;
      j < Math.min(finalSelections.length, expected.length);
      j++
    ) {
      expect(finalSelections[j]!.start.line).toBe(expected[j]!.start.line);
      expect(finalSelections[j]!.start.character).toBe(
        expected[j]!.start.character,
      );
      expect(finalSelections[j]!.end.line).toBe(expected[j]!.end.line);
      expect(finalSelections[j]!.end.character).toBe(
        expected[j]!.end.character,
      );
    }
  }
}

async function runTest(
  source: Uri,
  result: string,
  selections: Selection[][],
  expectedSelections: Selection[][],
) {
  let document = await workspace.openTextDocument(source);
  let editor = await window.showTextDocument(document);

  try {
    await manipulate(editor, selections, expectedSelections);
    compare(document, result);
  } finally {
    await closeEditor();
  }
}

async function simpleTest(
  source: string,
  replacingResult: string,
  surroundingResult: string,
  selections: Selection[][],
  expectedReplaceSelections: Selection[][],
  expectedSurroundSelections: Selection[][],
  config: any = undefined,
) {
  let docUri = uri(source);
  let cnf = workspace.getConfiguration("", docUri);
  if (config) {
    for (let name of Object.keys(config)) {
      await cnf.update(name, config[name], ConfigurationTarget.WorkspaceFolder);
    }
  }

  await cnf.update("editor.autoSurround", "never");
  await runTest(docUri, replacingResult, selections, expectedReplaceSelections);
  await cnf.update("editor.autoSurround", "languageDefined");
  await runTest(
    docUri,
    surroundingResult,
    selections,
    expectedSurroundSelections,
  );

  if (config) {
    for (let name of Object.keys(config)) {
      await cnf.update(name, undefined, ConfigurationTarget.WorkspaceFolder);
    }
  }
}

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
// const vscode = require('vscode');
// const myExtension = require('../extension');
suite("Expression Insertion Tests", () => {
  test("Insertion into simple strings", async () => {
    await simpleTest(
      "test.1.js",
      "replacing/result.1.js",
      "surrounding/result.1.js",
      [
        [new Selection(1, 26, 1, 26)],
        [new Selection(3, 22, 3, 22)],
        [new Selection(5, 25, 5, 25)],
      ],
      [
        [new Selection(1, 27, 1, 27)],
        [new Selection(3, 23, 3, 23)],
        [new Selection(5, 26, 5, 26)],
      ],
      [
        [new Selection(1, 27, 1, 27)],
        [new Selection(3, 23, 3, 23)],
        [new Selection(5, 26, 5, 26)],
      ],
    );
  });

  test("Insertion with multiple selections", async () => {
    await simpleTest(
      "test.1.js",
      "replacing/result.1.js",
      "surrounding/result.1.js",
      [
        [
          new Selection(1, 26, 1, 26),
          new Selection(3, 22, 3, 22),
          new Selection(5, 25, 5, 25),
        ],
      ],
      [
        [
          new Selection(1, 27, 1, 27),
          new Selection(3, 23, 3, 23),
          new Selection(5, 26, 5, 26),
        ],
      ],
      [
        [
          new Selection(1, 27, 1, 27),
          new Selection(3, 23, 3, 23),
          new Selection(5, 26, 5, 26),
        ],
      ],
    );
  });

  test("Selections should be deleted", async () => {
    await simpleTest(
      "test.1.js",
      "replacing/result.3.js",
      "surrounding/result.3.js",
      [
        [
          new Selection(1, 26, 1, 27),
          new Selection(3, 22, 3, 23),
          new Selection(5, 25, 5, 26),
        ],
      ],
      [
        [
          new Selection(1, 27, 1, 27),
          new Selection(3, 23, 3, 23),
          new Selection(5, 26, 5, 26),
        ],
      ],
      [
        [
          new Selection(1, 27, 1, 28),
          new Selection(3, 23, 3, 24),
          new Selection(5, 26, 5, 27),
        ],
      ],
    );
  });

  test("Multiline strings", async () => {
    await simpleTest(
      "test.4.js",
      "replacing/result.4.js",
      "surrounding/result.4.js",
      [[new Selection(1, 40, 1, 40)]],
      [[new Selection(1, 41, 1, 41)]],
      [[new Selection(1, 41, 1, 41)]],
    );
  });

  test("Escaped quotes", async () => {
    await simpleTest(
      "test.5.js",
      "replacing/result.5.js",
      "surrounding/result.5.js",
      [[new Selection(0, 17, 0, 17)]],
      [[new Selection(0, 18, 0, 18)]],
      [[new Selection(0, 18, 0, 18)]],
    );
  });

  test("Broken quotes", async () => {
    // This case seems to be a bug in VS code.
    await simpleTest(
      "test.6.js",
      "replacing/result.6.js",
      "surrounding/result.6.js",
      [[new Selection(4, 36, 4, 36)], [new Selection(6, 9, 6, 9)]],
      [[new Selection(4, 37, 4, 37)], [new Selection(6, 10, 6, 10)]],
      [[new Selection(4, 37, 4, 37)], [new Selection(6, 10, 6, 10)]],
    );
  });

  test("Unended quotes", async () => {
    await simpleTest(
      "test.7.js",
      "replacing/result.7.js",
      "surrounding/result.7.js",
      [[new Selection(0, 17, 0, 17)]],
      [[new Selection(0, 18, 0, 18)]],
      [[new Selection(0, 18, 0, 18)]],
    );
  });

  test("Selection over quote", async () => {
    await simpleTest(
      "test.8.js",
      "replacing/result.8.js",
      "surrounding/result.8.js",
      [[new Selection(0, 37, 0, 44)]],
      [[new Selection(0, 38, 0, 38)]],
      [[new Selection(0, 38, 0, 45)]],
    );
  });

  test("Insert without dollar", async () => {
    await simpleTest(
      "test.9.js",
      "replacing/result.9.js",
      "surrounding/result.9.js",
      [[new Selection(0, 3, 0, 3)], [new Selection(1, 22, 1, 22)]],
      [[new Selection(0, 4, 0, 4)], [new Selection(1, 23, 1, 23)]],
      [[new Selection(0, 4, 0, 4)], [new Selection(1, 23, 1, 23)]],
    );
  });

  test("Ignore comments", async () => {
    // This case seems to be a bug in VS code.
    await simpleTest(
      "test.10.js",
      "replacing/result.10.js",
      "surrounding/result.10.js",
      [
        [new Selection(0, 39, 0, 39)],
        [new Selection(1, 39, 1, 39)],
        [new Selection(3, 15, 3, 15)],
        [new Selection(5, 13, 5, 13)],
      ],
      [
        [new Selection(0, 40, 0, 40)],
        [new Selection(1, 40, 1, 40)],
        [new Selection(3, 16, 3, 16)],
        [new Selection(5, 14, 5, 14)],
      ],
      [
        [new Selection(0, 40, 0, 40)],
        [new Selection(1, 40, 1, 40)],
        [new Selection(3, 16, 3, 16)],
        [new Selection(5, 14, 5, 14)],
      ],
    );
  });

  test("Replace at end of line", async () => {
    // This case seems to be a bug in VS code.
    await simpleTest(
      "test.11.js",
      "replacing/result.11.js",
      "surrounding/result.11.js",
      [[new Selection(0, 32, 0, 32)]],
      [[new Selection(0, 33, 0, 33)]],
      [[new Selection(0, 33, 0, 33)]],
    );
  });

  test("Replace at end of file", async () => {
    await simpleTest(
      "test.12.js",
      "replacing/result.12.js",
      "surrounding/result.12.js",
      [[new Selection(0, 32, 0, 32)]],
      [[new Selection(0, 33, 0, 33)]],
      [[new Selection(0, 33, 0, 33)]],
    );
  });

  test("Replace multiple in the same line", async () => {
    await simpleTest(
      "test.13.js",
      "replacing/result.13.js",
      "surrounding/result.13.js",
      [
        [
          new Selection(0, 10, 0, 10),
          new Selection(0, 19, 0, 19),
          new Selection(0, 28, 0, 28),
          new Selection(1, 14, 1, 14),
          new Selection(1, 26, 1, 26),
        ],
      ],
      [
        [
          new Selection(0, 11, 0, 11),
          new Selection(0, 21, 0, 21),
          new Selection(0, 31, 0, 31),
          new Selection(1, 15, 1, 15),
          new Selection(1, 28, 1, 28),
        ],
      ],
      [
        [
          new Selection(0, 11, 0, 11),
          new Selection(0, 21, 0, 21),
          new Selection(0, 31, 0, 31),
          new Selection(1, 15, 1, 15),
          new Selection(1, 28, 1, 28),
        ],
      ],
    );
  });
});
