import {
  Range,
  commands,
  ExtensionContext,
  TextEditor,
  TextEditorEdit,
  Selection,
} from "vscode";
import { findPreviousQuote, findEndQuote } from "./quotefinder";

function convertQuotes(
  editor: TextEditor,
  edit: TextEditorEdit,
  selection: Selection,
) {
  let { document } = editor;
  let { character, position } = findPreviousQuote(document, selection.start);

  // If we're already in a template string then there is nothing to do.
  if (character == "`") {
    return;
  }

  if (position) {
    edit.replace(new Range(position, position.translate(0, 1)), "`");

    // We're going to wipe out the selection so scan from the end of it.
    let endQuote = findEndQuote(document, selection.end, character);
    if (endQuote) {
      edit.replace(new Range(endQuote, endQuote.translate(0, 1)), "`");
    }
  }
}

function followsDollar(editor: TextEditor, selection: Selection) {
  let position = selection.start;
  if (position.character == 0) {
    return false;
  }

  let range = new Range(
    position.line,
    position.character - 1,
    position.line,
    position.character,
  );
  let character = editor.document.getText(range);
  return character == "$";
}

interface KeyCommandArg {
  fromKeyboard: boolean;
}

async function bracePressed(
  editor: TextEditor,
  edit: TextEditorEdit,
  args: KeyCommandArg | undefined = undefined,
) {
  let fromKeyboard = args ? args.fromKeyboard : false;

  for (let selection of editor.selections) {
    if (
      !fromKeyboard ||
      (selection.isEmpty && followsDollar(editor, selection))
    ) {
      try {
        // Do this first as it won't alter the positions of characters which
        // confuses matters.
        convertQuotes(editor, edit, selection);
      } catch (e) {
        console.error(e);
      }
    }
  }

  if (fromKeyboard) {
    await commands.executeCommand("type", { text: "{" });
  }

  try {
    // Used to signal to the test harness that the command has completed.
    await commands.executeCommand("backticks.test.complete");
  } catch (e) {
    console.error(e);
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
