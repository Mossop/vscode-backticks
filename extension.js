const { Range, commands } = require('vscode');

const QUOTES = ['"', '\'', '`'];

function convertQuotes(editor, edit, selection) {
    if (editor.document.languageId != 'javascript') {
        return;
    }

    let line = editor.document.lineAt(selection.start);
    let start = line.firstNonWhitespaceCharacterIndex;
    let pos = selection.start.character - 1;
    if (pos < start || line.text.charAt(pos) != '$') {
        return;
    }

    // Track back to find a quote character
    let quoteChar = null;
    pos--;
    while (pos >= start) {
        let char = line.text.charAt(pos);
        if (QUOTES.indexOf(char) >= 0) {
            // Already in a backtick quote so bail out
            if (char == '`') {
                return;
            }
            quoteChar = char;
            edit.replace(new Range(line.lineNumber, pos, line.lineNumber, pos + 1), '`');
            break;
        }
        pos--;
    }

    if (quoteChar) {
        pos = selection.end.character;
        line = editor.document.lineAt(selection.end);
        while (pos < line.text.length) {
            if (line.text.charAt(pos) == quoteChar) {
                edit.replace(new Range(line.lineNumber, pos, line.lineNumber, pos + 1), '`');
            }
            pos++;
        }
    }
}

function bracePressed(editor, edit) {
    for (let selection of editor.selections) {
        try {
            // Do this first as it won't alter the positions of characters which
            // confuses matters.
            convertQuotes(editor, edit, selection);
        } catch (e) {
            console.error(e);
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
