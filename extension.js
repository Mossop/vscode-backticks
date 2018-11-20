const { Range, commands } = require('vscode');
const { findPreviousQuote, findEndQuote } = require('./quotefinder');

const languageIdentifiers = new Set(['javascript', 'typescript', 'javascriptreact', 'typescriptreact']);

function convertQuotes(editor, edit, selection) {
    if (!languageIdentifiers.has(editor.document.languageId)) {
        return;
    }

    let document = editor.document;
    let { character, position } = findPreviousQuote(document, selection.start);

    // If we're already in a template string then there is nothing to do.
    if (character == '`') {
        return;
    }

    if (position) {
        edit.replace(new Range(position, position.translate(0, 1)), '`');

        // We're going to wipe out the selection so scan from the end of it.
        let endQuote = findEndQuote(document, selection.end, character);
        if (endQuote) {
            edit.replace(new Range(endQuote, endQuote.translate(0, 1)), '`');
        }
    }
}

function followsDollar(editor, selection) {
    let position = selection.start;
    if (position.character == 0) {
        return false;
    }

    let range = new Range(position.line, position.character - 1, position.line, position.character);
    let character = editor.document.getText(range);
    return character == "$";
}

function bracePressed(editor, edit) {
    for (let selection of editor.selections) {
        if (followsDollar(editor, selection)) {
            try {
                // Do this first as it won't alter the positions of characters which
                // confuses matters.
                convertQuotes(editor, edit, selection);
            } catch (e) {
                console.error(e);
            }
        }

        // We must insert the { key manually regardless.
        if (!selection.isEmpty) {
            edit.delete(selection);
        }
        edit.insert(selection.start, '{');
    }
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    context.subscriptions.push(
        commands.registerTextEditorCommand('backticks.convertQuotes', bracePressed)
    );
}
exports.activate = activate;

function deactivate() {
}
exports.deactivate = deactivate;
