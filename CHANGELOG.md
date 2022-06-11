# Change Log

## 1.7.0

- Switch to TypeScript and update to more modern extension practices.

## 1.6.0

- Use the internal type command again. Brace output is defined by Visual Studio Code.

## 1.5.1

- Revert to manually simulate keypresses and don't support auto-surrounding for now.

## 1.5.0

- Only apply keybindings on js-like files.
- Use built-in commands for typing the actual { rather than faking it.
- Running the command from the command palette should not insert a {.

## 1.4.1

- Surround selections with braces when configured to do so.

## 1.4.0

- Skips over quotes embedded inside comments.
- Fixes cases where the brace was inserted at the end of a line or file.

## 1.3.0

- Scans the entire script to support detecting multi-line strings and escaped quote characters.

## 1.2.1

- Fix a conflict with the Vim extension.

## 1.2.0

- Fix use of the { key in other contexts.
- Support typescript, jsx and tsx files.

## 1.1.0

- Correct some types.

## 1.0.0

- Initial release.
