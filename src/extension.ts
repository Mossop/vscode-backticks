import {
  Range,
  commands,
  ExtensionContext,
  TextEditor,
  TextEditorEdit,
  Position,
} from "vscode";
import { findPreviousQuote, findEndQuote } from "./quotefinder";

interface QuoteRange {
  character: string;
  start: Position;
  end: Position | null;
}

function findQuoteRange(
  editor: TextEditor,
  atPosition: Position,
): QuoteRange | null {
  let { document } = editor;
  let { character, position } = findPreviousQuote(document, atPosition);

  if (!character || !position) {
    return null;
  }

  return {
    character,
    start: position,
    end: findEndQuote(document, atPosition, character),
  };
}

/**
 * Converts the quoting style, if any, at the position to backticks.
 *
 * Returns true if the position was within any kind of quotes.
 */
function convertQuotes(
  editor: TextEditor,
  edit: TextEditorEdit,
  atPosition: Position,
) {
  let { document } = editor;
  let { character, position } = findPreviousQuote(document, atPosition);

  // If we're already in a template string then there is nothing to do.
  if (character == "`") {
    return;
  }

  if (position) {
    edit.replace(new Range(position, position.translate(0, 1)), "`");

    let endQuote = findEndQuote(document, atPosition, character);
    if (endQuote) {
      edit.replace(new Range(endQuote, endQuote.translate(0, 1)), "`");
    }
  }
}

function followsDollar(editor: TextEditor, position: Position): boolean {
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

async function bracePressed(editor: TextEditor): Promise<void> {
  let ranges: QuoteRange[] = [];

  for (let selection of editor.selections) {
    if (!selection.isEmpty || !followsDollar(editor, selection.active)) {
      return;
    }

    let range = findQuoteRange(editor, selection.active);
    if (!range) {
      return;
    }

    ranges.push(range);
  }

  await editor.edit((edit: TextEditorEdit) => {
    for (let range of ranges) {
      edit.replace(new Range(range.start, range.start.translate(0, 1)), "`");
      if (range.end) {
        edit.replace(new Range(range.end, range.end.translate(0, 1)), "`");
      }
    }
  });
}

async function execCommand(
  editor: TextEditor,
  edit: TextEditorEdit,
  args: KeyCommandArg | undefined = undefined,
) {
  try {
    let fromKeyboard = args ? args.fromKeyboard : false;

    if (!fromKeyboard) {
      for (let selection of editor.selections) {
        convertQuotes(editor, edit, selection.active);
      }

      return;
    }

    await bracePressed(editor);

    // Just simulate the keypress.
    await commands.executeCommand("type", { text: "{" });
  } catch (e) {
    console.error(e);
  }
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
  context.subscriptions.push(
    commands.registerTextEditorCommand("backticks.convertQuotes", execCommand),
  );
}

export function deactivate() {}
