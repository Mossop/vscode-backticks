/* global suite, test */

// The module 'assert' provides assertion methods from node
const expect = require('expect');
const fs = require('fs');
const { window, workspace, commands, Selection, ConfigurationTarget, Uri } = require('vscode');
const path = require('path');

const file = (name) => {
    return path.join(__dirname, 'files', name);
};

const uri = (name) => Uri.file(file(name));

const compare = (document, filename) => {
    let result = document.getText();
    let expected = fs.readFileSync(file(filename), { encoding: 'utf-8' });

    expect(result).toBe(expected);
};

const manipulate = async (editor, selections) => {
    for (let selection of selections) {
        editor.selections = selection;
        await commands.executeCommand('backticks.convertQuotes');
    }
};

const simpleTest = async (source, result, selections, config) => {
    let document = await workspace.openTextDocument(uri(source));
    let editor = await window.showTextDocument(document);

    if (config) {
        let cnf = workspace.getConfiguration('', document.uri);

        for (let name of Object.keys(config)) {
            await cnf.update(name, config[name], ConfigurationTarget.WorkspaceFolder)
        }
    }

    await manipulate(editor, selections);
    compare(document, result);
    await commands.executeCommand('workbench.action.closeActiveEditor');

    if (config) {
        let cnf = workspace.getConfiguration('', document.uri);

        for (let name of Object.keys(config)) {
            await cnf.update(name, undefined, ConfigurationTarget.WorkspaceFolder)
        }
    }
};

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
// const vscode = require('vscode');
// const myExtension = require('../extension');
suite("Expression Insertion Tests", function() {
    test("Insertion into simple strings", async function() {
        await simpleTest('test.1.js', 'result.1.js', [
            [new Selection(1, 26, 1, 26)],
            [new Selection(3, 22, 3, 22)],
            [new Selection(5, 25, 5, 25)],
        ]);
    });

    test("Insertion with multiple selections", async function() {
        await simpleTest('test.1.js', 'result.1.js', [
            [new Selection(1, 26, 1, 26),
             new Selection(3, 22, 3, 22),
             new Selection(5, 25, 5, 25)],
        ]);
    });

    test("Selections should be deleted", async function() {
        await simpleTest('test.1.js', 'result.3.js', [
            [new Selection(1, 26, 1, 27),
             new Selection(3, 22, 3, 23),
             new Selection(5, 25, 5, 26)],
        ], {
            "editor.autoSurround": "never",
        });
    });

    test("Multiline strings", async function() {
        await simpleTest('test.4.js', 'result.4.js', [
            [new Selection(1, 40, 1, 40)],
        ]);
    });

    test("Escaped quotes", async function() {
        await simpleTest('test.5.js', 'result.5.js', [
            [new Selection(0, 17, 0, 17)],
        ]);
    });

    test("Broken quotes", async function() {
        await simpleTest('test.6.js', 'result.6.js', [
            [new Selection(4, 36, 4, 36)],
            [new Selection(6, 9, 6, 9)],
        ]);
    });

    test("Unended quotes", async function() {
        await simpleTest('test.7.js', 'result.7.js', [
            [new Selection(0, 17, 0, 17)],
        ]);
    });

    test("Selection over quote", async function() {
        await simpleTest('test.8.js', 'result.8.js', [
            [new Selection(0, 37, 0, 44)],
        ], {
            "editor.autoSurround": "never",
        });
    });

    test("Insert without dollar", async function() {
        await simpleTest('test.9.js', 'result.9.js', [
            [new Selection(0, 3, 0, 3)],
            [new Selection(1, 22, 1, 22)],
        ])
    });

    test("Ignore comments", async function() {
        await simpleTest('test.10.js', 'result.10.js', [
            [new Selection(0, 39, 0, 39)],
            [new Selection(1, 39, 1, 39)],
            [new Selection(3, 15, 3, 15)],
            [new Selection(5, 13, 5, 13)],
        ])
    });

    test("Replace at end of line", async function() {
        await simpleTest('test.11.js', 'result.11.js', [
            [new Selection(0, 32, 0, 32)],
        ])
    });

    test("Replace at end of file", async function() {
        await simpleTest('test.12.js', 'result.12.js', [
            [new Selection(0, 32, 0, 32)],
        ])
    });

    test("Selections should be surrounded", async function() {
        await simpleTest('test.1.js', 'result.13.js', [
            [new Selection(1, 26, 1, 27),
             new Selection(3, 22, 3, 23),
             new Selection(5, 25, 5, 26)],
        ], {
            "editor.autoSurround": "languageDefined",
        });
    });

    test("Surround selection over quote", async function() {
        await simpleTest('test.8.js', 'result.14.js', [
            [new Selection(0, 37, 0, 44)],
        ], {
            "editor.autoSurround": "languageDefined",
        });
    });
});
