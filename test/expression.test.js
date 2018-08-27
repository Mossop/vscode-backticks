/* global suite, test */

// The module 'assert' provides assertion methods from node
const expect = require('expect');
const fs = require('fs');
const { window, workspace, commands, Selection } = require('vscode');
const path = require('path');

const file = (name) => {
    return path.join(__dirname, 'files', name);
};

const compare = (document, filename) => {
    let result = document.getText();
    let expected = fs.readFileSync(file(filename), { encoding: 'utf-8' });

    expect(result).toBe(expected);
};

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
// const vscode = require('vscode');
// const myExtension = require('../extension');
suite("Expression Insertion Tests", function() {
    test("Insertion into simple strings", async function() {
        let document = await workspace.openTextDocument(file('test.1.js'));
        let editor = await window.showTextDocument(document);

        editor.selections = [new Selection(1, 26, 1, 26)];
        await commands.executeCommand('backticks.convertQuotes');

        editor.selections = [new Selection(3, 22, 3, 22)];
        await commands.executeCommand('backticks.convertQuotes');

        editor.selections = [new Selection(5, 25, 5, 25)];
        await commands.executeCommand('backticks.convertQuotes');

        compare(document, 'result.1.js');
    });
});
