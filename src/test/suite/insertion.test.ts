import expect from "expect";
import fs from "fs";
import path from "path";

import {
  window,
  workspace,
  commands,
  Selection,
  Uri,
  Disposable,
  TextEditor,
  TextDocumentChangeEvent,
} from "vscode";

const SEPARATOR =
  "\n// -----------------------------------------------------------------------------\n";

const file = (...names: string[]): string =>
  path.join(__dirname, "../../../test_files", ...names);

function* zip<T>(a: readonly T[], b: readonly T[]): Generator<[T, T]> {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    yield [a[i]!, b[i]!];
  }
}

const s = (
  anchorLine: number,
  anchorChar: number,
  activeLine: number,
  activeChar: number,
): Selection => new Selection(anchorLine, anchorChar, activeLine, activeChar);

interface TestFileParts {
  original: string;
  replacementResult: string;
  surroundingResult: string;
}

function parseTestFile(name: string): TestFileParts {
  let content = fs.readFileSync(file(name), { encoding: "utf8" });
  let [original, replacementResult, surroundingResult] =
    content.split(SEPARATOR);
  return {
    original: original!,
    replacementResult: replacementResult!,
    surroundingResult: surroundingResult!,
  };
}

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

    listener = workspace.onDidChangeTextDocument(
      (ev: TextDocumentChangeEvent) => {
        if (ev.contentChanges.some((ch) => ch.text.startsWith("{"))) {
          finished();
        }
      },
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

function compareSelection(received: Selection, expected: Selection) {
  expect(
    JSON.stringify([
      received.anchor.line,
      received.anchor.character,
      received.active.line,
      received.active.character,
    ]),
  ).toEqual(
    JSON.stringify([
      expected.anchor.line,
      expected.anchor.character,
      expected.active.line,
      expected.active.character,
    ]),
  );
}

async function manipulate(
  editor: TextEditor,
  selectionLists: Selection[][],
  expectedSelectionLists: Selection[][],
): Promise<void> {
  expect(selectionLists.length).toBe(expectedSelectionLists.length);

  for (let [selections, expectedSelections] of zip(
    selectionLists,
    expectedSelectionLists,
  )) {
    editor.selections = selections;
    let complete = awaitComplete();
    await commands.executeCommand("backticks.convertQuotes", {
      fromKeyboard: true,
    });
    await complete;

    expect(editor.selections.length).toBe(expectedSelections.length);
    for (let [received, expected] of zip(
      editor.selections,
      expectedSelections,
    )) {
      compareSelection(received, expected);
    }
  }
}

async function runTest(
  source: string,
  expected: string,
  selections: Selection[][],
  expectedSelections: Selection[][],
  config: Record<string, any> = {},
) {
  let testFile = file(`test-file-${Math.trunc(Math.random() * 100000)}.js`);
  fs.writeFileSync(testFile, source);
  let testUri = Uri.file(testFile);

  let cnf = workspace.getConfiguration("", testUri);
  for (let [key, value] of Object.entries(config)) {
    await cnf.update(key, value);
  }

  let document = await workspace.openTextDocument(testUri);
  let editor = await window.showTextDocument(document);

  try {
    await manipulate(editor, selections, expectedSelections);
    let result = editor.document.getText();
    expect(result).toBe(expected);
  } finally {
    await closeEditor();
    fs.unlinkSync(testFile);
  }
}

interface TestSpec {
  name: string;
  file: string;
  selections: Selection[][];
  replacedSelections: Selection[][];
  surroundedSelections: Selection[][];
}

function replacementTest(spec: TestSpec, parts: TestFileParts) {
  test("autoSurround disabled", async () => {
    await runTest(
      parts.original,
      parts.replacementResult,
      spec.selections,
      spec.replacedSelections!,
      { "editor.autoSurround": "never" },
    );
  });
}

function autosurroundTest(spec: TestSpec, parts: TestFileParts) {
  test("autoSurround enabled", async () => {
    await runTest(
      parts.original,
      parts.surroundingResult,
      spec.selections,
      spec.surroundedSelections!,
      { "editor.autoSurround": "languageDefined" },
    );
  });
}

const TEST_SPECS: TestSpec[] = [
  {
    name: "Insertion into simple strings",
    file: "test.1.txt",
    selections: [[s(1, 26, 1, 26)], [s(3, 22, 3, 22)], [s(5, 25, 5, 25)]],
    replacedSelections: [
      [s(1, 27, 1, 27)],
      [s(3, 23, 3, 23)],
      [s(5, 26, 5, 26)],
    ],
    surroundedSelections: [
      [s(1, 27, 1, 27)],
      [s(3, 23, 3, 23)],
      [s(5, 26, 5, 26)],
    ],
  },

  {
    name: "Multiple insertion into simple strings",
    file: "test.1.txt",
    selections: [[s(1, 26, 1, 26), s(3, 22, 3, 22), s(5, 25, 5, 25)]],
    replacedSelections: [[s(1, 27, 1, 27), s(3, 23, 3, 23), s(5, 26, 5, 26)]],
    surroundedSelections: [[s(1, 27, 1, 27), s(3, 23, 3, 23), s(5, 26, 5, 26)]],
  },

  {
    name: "Brace surrounding",
    file: "test.2.txt",

    selections: [[s(0, 0, 2, 0)]],
    replacedSelections: [[s(0, 1, 0, 1)]],
    surroundedSelections: [[s(0, 1, 2, 0)]],
  },

  {
    name: "Selections should be deleted",
    file: "test.3.txt",
    selections: [[s(1, 26, 1, 27)], [s(3, 22, 3, 23)], [s(5, 25, 5, 26)]],
    replacedSelections: [
      [s(1, 27, 1, 27)],
      [s(3, 23, 3, 23)],
      [s(5, 26, 5, 26)],
    ],
    surroundedSelections: [
      [s(1, 27, 1, 28)],
      [s(3, 23, 3, 24)],
      [s(5, 26, 5, 27)],
    ],
  },

  {
    name: "Multiline strings",
    file: "test.4.txt",
    selections: [[s(1, 40, 1, 40)]],
    replacedSelections: [[s(1, 41, 1, 41)]],
    surroundedSelections: [[s(1, 41, 1, 41)]],
  },

  {
    name: "Escaped quotes",
    file: "test.5.txt",
    selections: [[s(0, 17, 0, 17)]],
    replacedSelections: [[s(0, 18, 0, 18)]],
    surroundedSelections: [[s(0, 18, 0, 18)]],
  },

  {
    name: "Broken quotes",
    file: "test.6.txt",
    selections: [[s(4, 36, 4, 36)], [s(6, 9, 6, 9)]],
    replacedSelections: [[s(4, 37, 4, 37)], [s(6, 10, 6, 10)]],
    surroundedSelections: [[s(4, 37, 4, 37)], [s(6, 10, 6, 10)]],
  },

  {
    name: "Unended quotes",
    file: "test.7.txt",
    selections: [[s(0, 17, 0, 17)]],
    replacedSelections: [[s(0, 18, 0, 18)]],
    surroundedSelections: [[s(0, 18, 0, 18)]],
  },

  {
    name: "Selection over quote",
    file: "test.8.txt",
    selections: [[s(0, 37, 0, 44)]],
    replacedSelections: [[s(0, 38, 0, 38)]],
    surroundedSelections: [[s(0, 38, 0, 45)]],
  },

  {
    name: "Insert without dollar",
    file: "test.9.txt",
    selections: [[s(0, 3, 0, 3)], [s(1, 22, 1, 22)]],
    replacedSelections: [[s(0, 4, 0, 4)], [s(1, 23, 1, 23)]],
    surroundedSelections: [[s(0, 4, 0, 4)], [s(1, 23, 1, 23)]],
  },

  // {
  //   name: "Ignore comments",
  //   file: "test.10.txt",
  //   selections: [
  //     [s(0, 39, 0, 39)],
  //     [s(1, 39, 1, 39)],
  //     [s(3, 15, 3, 15)],
  //     [s(5, 13, 5, 13)],
  //   ],
  //   replacedSelections: [
  //     [s(0, 40, 0, 40)],
  //     [s(1, 40, 1, 40)],
  //     [s(3, 16, 3, 16)],
  //     [s(5, 14, 5, 14)],
  //   ],
  //   surroundedSelections: [
  //     [s(0, 40, 0, 40)],
  //     [s(1, 40, 1, 40)],
  //     [s(3, 16, 3, 16)],
  //     [s(5, 14, 5, 14)],
  //   ],
  // },

  {
    name: "Replace at end of line",
    file: "test.11.txt",
    selections: [[s(0, 32, 0, 32)]],
    replacedSelections: [[s(0, 33, 0, 33)]],
    surroundedSelections: [[s(0, 33, 0, 33)]],
  },

  {
    name: "Replace at end of file",
    file: "test.12.txt",
    selections: [[s(0, 32, 0, 32)]],
    replacedSelections: [[s(0, 33, 0, 33)]],
    surroundedSelections: [[s(0, 33, 0, 33)]],
  },

  {
    name: "Replace multiple in the same line",
    file: "test.13.txt",
    selections: [
      [
        s(0, 10, 0, 10),
        s(0, 19, 0, 19),
        s(0, 28, 0, 28),
        s(1, 14, 1, 14),
        s(1, 26, 1, 26),
      ],
    ],
    replacedSelections: [
      [
        s(0, 11, 0, 11),
        s(0, 21, 0, 21),
        s(0, 31, 0, 31),
        s(1, 15, 1, 15),
        s(1, 28, 1, 28),
      ],
    ],
    surroundedSelections: [
      [
        s(0, 11, 0, 11),
        s(0, 21, 0, 21),
        s(0, 31, 0, 31),
        s(1, 15, 1, 15),
        s(1, 28, 1, 28),
      ],
    ],
  },
];

TEST_SPECS.forEach((spec: TestSpec) => {
  suite(spec.name, () => {
    let parts = parseTestFile(spec.file);

    replacementTest(spec, parts);
    autosurroundTest(spec, parts);
  });
});
