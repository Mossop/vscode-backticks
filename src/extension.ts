import {
  Range,
  commands,
  ExtensionContext,
  TextEditor,
  TextEditorEdit,
  Selection,
  workspace,
  Position,
} from "vscode";
import { findPreviousQuote, findEndQuote } from "./quotefinder";

const isAutosurround = (val: any): boolean => val != "never" && val != "quotes";
const cloneSelection = (s: Selection): Selection =>
  new Selection(s.anchor, s.active);
const comparePosition = (a: Position, b: Position): number =>
  a.line == b.line ? a.character - b.character : a.line - b.line;
const compareSelection = (a: Selection, b: Selection): number =>
  comparePosition(a.start, b.start);

/**
 * Converts the quoting style, if any, around the selection to backticks.
 *
 * Returns true if the selection was within any kind of quotes.
 */
function convertQuotes(
  editor: TextEditor,
  edit: TextEditorEdit,
  selection: Selection,
): boolean {
  let { document } = editor;
  let { character, position } = findPreviousQuote(document, selection.start);

  // If we're already in a template string then there is nothing to do.
  if (character == "`") {
    return true;
  }

  if (position) {
    edit.replace(new Range(position, position.translate(0, 1)), "`");

    // We're going to wipe out the selection so scan from the end of it.
    let endQuote = findEndQuote(document, selection.end, character);
    if (endQuote) {
      edit.replace(new Range(endQuote, endQuote.translate(0, 1)), "`");
    }
  }

  return !!position;
}

function followsDollar(editor: TextEditor, selection: Selection) {
  let position = selection.start;
  if (position.character == 0) {
    return false;
  }

  let range = new Range(position.translate(0, -1), position);
  let character = editor.document.getText(range);
  return character == "$";
}

interface KeyCommandArg {
  fromKeyboard: boolean;
}

function positionShift(
  position: Position,
  delta: number,
  referenceLine: number,
  lineDelta: number,
  columnDelta: number,
): Position {
  if (position.line != referenceLine) {
    return position.translate(columnDelta, delta);
  }

  return position.translate(columnDelta, delta + lineDelta);
}

async function bracePressed(
  editor: TextEditor,
  _edit: TextEditorEdit,
  args: KeyCommandArg | undefined = undefined,
) {
  let fromKeyboard = args ? args.fromKeyboard : false;
  let config = workspace.getConfiguration("editor", editor.document);
  let autoSurround = isAutosurround(config.get("autoSurround"));

  let editorSelections = editor.selections.map(cloneSelection);
  editorSelections.sort(compareSelection);

  let quoteSelections = new Set<Selection>();

  // Apply an edit that changes the quote styles.
  await editor.edit((edit: TextEditorEdit) => {
    for (let selection of editorSelections) {
      if (
        !fromKeyboard ||
        (selection.isEmpty && followsDollar(editor, selection))
      ) {
        try {
          if (convertQuotes(editor, edit, selection)) {
            quoteSelections.add(selection);
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
  });

  if (fromKeyboard) {
    let newSelections: Selection[] = [];
    // Now apply an edit that enters the '{' character. Ideally we would
    // actually do this first, but since it adjusts the position of everything...
    await editor.edit((edit: TextEditorEdit) => {
      let lastLine: number | null = null;
      let lineDelta = 0;
      let columnDelta = 0;

      // These are sorted in document order.
      for (let selection of editorSelections) {
        if (selection.start.line != lastLine) {
          lastLine = selection.start.line;
          columnDelta = 0;
        }

        if (autoSurround && !selection.isEmpty) {
          // Here we just surround the selection with braces.
          let anchor = positionShift(
            selection.anchor,
            1,
            lastLine,
            lineDelta,
            columnDelta,
          );
          let active = positionShift(
            selection.active,
            1,
            lastLine,
            lineDelta,
            columnDelta,
          );
          let newSelection = new Selection(anchor, active);
          newSelections.push(newSelection);

          if (newSelection.end.line == lastLine) {
            columnDelta += 1;
          } else {
            lastLine = newSelection.end.line;
            columnDelta = 1;
          }

          edit.insert(selection.start, "{");
          edit.insert(selection.end, "}");
        } else if (
          autoSurround &&
          selection.isEmpty &&
          quoteSelections.has(selection)
        ) {
          // Here we are entering a brace inside a quote so add trailing brace.
          let anchor = positionShift(
            selection.anchor,
            1,
            lastLine,
            lineDelta,
            columnDelta,
          );
          newSelections.push(new Selection(anchor, anchor));

          if (anchor.line == lastLine) {
            columnDelta += 2;
          } else {
            lastLine = anchor.line;
            columnDelta = 2;
          }

          edit.replace(selection, "{}");
        } else {
          // Just simulates the keypress.
          let anchor = positionShift(
            selection.anchor,
            1,
            lastLine,
            lineDelta,
            columnDelta,
          );
          newSelections.push(new Selection(anchor, anchor));

          if (selection.end.line == lastLine) {
            columnDelta += 1;
          } else {
            lastLine = selection.end.line;
            columnDelta = 1;
          }

          lineDelta -= selection.end.line - selection.start.line;

          edit.replace(selection, "{");
        }
      }
    });

    // Now update the selections. This may rearrange them, is that a problem?
    editor.selections = newSelections;
  }

  try {
    // Used to signal to the test harness that the command has completed.
    await commands.executeCommand("backticks.test.complete");
  } catch (e) {
    // We expect this to throw in non-test.
  }
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
  context.subscriptions.push(
    commands.registerTextEditorCommand("backticks.convertQuotes", bracePressed),
  );
}

export function deactivate() {}
