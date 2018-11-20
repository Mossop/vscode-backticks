const { Position } = require('vscode');

const STATE_NORMAL = 0;
const STATE_TEMPLATE_QUOTE = 1;
const STATE_DOUBLE_QUOTE = 2;
const STATE_SINGLE_QUOTE = 3;
const STATE_ESCAPE = 4;
const STATE_COMMENT_START = 5;
const STATE_COMMENT_SINGLELINE = 6;
const STATE_COMMENT_MULTILINE = 7;
const STATE_COMMENT_MULTILINE_END = 8;

const QUOTES = ['`', '"', '\''];

class QuoteState {
  constructor(quoteChar = null) {
    this.states = [STATE_NORMAL];
    if (quoteChar) {
      this.pushState(QUOTES.indexOf(quoteChar) + 1);
    }
    this.lastQuotePosition = null;
    this.lastQuoteChar = quoteChar;
  }

  pushState(state) {
    this.states.push(state);
  }

  popState() {
    this.states.pop();
  }

  get state() {
    return this.states[this.states.length - 1];
  }

  pushChar(position, char) {
    switch (this.state) {
      case STATE_COMMENT_START:
        // Regardless we're no longer in the start state.
        this.popState();

        if (char == '/') {
          this.pushState(STATE_COMMENT_SINGLELINE);
          return;
        } else if (char == '*') {
          this.pushState(STATE_COMMENT_MULTILINE);
          return;
        }

        // If we haven't entered a comment then just continue to process this
        // character.
        break;

      // Nothing can change this state.
      case STATE_COMMENT_SINGLELINE:
        return;

      // The only way to change this state is by ending the comment.
      case STATE_COMMENT_MULTILINE:
        if (char == '*') {
          this.pushState(STATE_COMMENT_MULTILINE_END);
        }
        return;

      // We always at least drop back to the comment state, maybe leave that entirely.
      case STATE_COMMENT_MULTILINE_END:
        this.popState();
        if (char == '/') {
          this.popState();
        }
        return;

      // Throw away escaped characters.
      case STATE_ESCAPE:
        this.popState();
        return;
    }

    if (this.state == STATE_NORMAL && char == '/') {
      this.pushState(STATE_COMMENT_START);
      return;
    }

    // Start of an escaped character
    if (char == '\\') {
      this.pushState(STATE_ESCAPE);
      return;
    }

    // We now only need do something if this is a quote character.
    let type = QUOTES.indexOf(char) + 1;
    if (type > STATE_NORMAL) {
      // Check if we're entering a quote.
      if (this.state == STATE_NORMAL) {
        this.pushState(type);
        this.lastQuotePosition = position;
        this.lastQuoteChar = char;
        return;
      }

      // Check if we're leaving a quote.
      if (char == this.lastQuoteChar) {
        this.popState();
        this.lastQuoteChar = null;
        this.lastQuotePosition = null;
      }

      // This is a quote character within a different kind of quote, ignore it.
    }
  }

  pushEOL() {
    switch (this.state) {
      // These states survive an EOL.
      case STATE_NORMAL:
      case STATE_TEMPLATE_QUOTE:
      case STATE_COMMENT_MULTILINE:
        return;

      // These pop us up one state.
      case STATE_DOUBLE_QUOTE:
      case STATE_SINGLE_QUOTE:
      case STATE_ESCAPE:
      case STATE_COMMENT_START:
      case STATE_COMMENT_SINGLELINE:
      case STATE_COMMENT_MULTILINE_END:
        this.popState();
        return;
    }
  }
}

exports.findPreviousQuote = function(document, position) {
  let state = new QuoteState();

  let line = 0;
  while (line <= position.line) {
    if (line > 0) {
      state.pushEOL();
    }

    let text = document.lineAt(line).text;
    let char = 0;
    while (char < text.length) {
      let pos = new Position(line, char);
      if (pos.isEqual(position)) {
        return {
          character: state.lastQuoteChar,
          position: state.lastQuotePosition,
        };
      }

      state.pushChar(pos, text.charAt(char));

      char++;
    }

    line++;
  }

  // We get here when the insertion position is at the end of the line.
  return {
    character: state.lastQuoteChar,
    position: state.lastQuotePosition,
  };
}

exports.findEndQuote = function(document, position, lastQuoteChar) {
  let state = new QuoteState(lastQuoteChar);

  let line = position.line;
  while (line < document.lineCount) {
    let text = document.lineAt(line).text;

    let char = line == position.line ? position.character : 0;
    while (char < text.length) {
      let pos = new Position(line, char);
      state.pushChar(pos, text.charAt(char));

      // If this character was the end of the quote then return its position.
      if (state.state == STATE_NORMAL) {
        return pos;
      }

      char++;
    }

    state.pushEOL();

    // If the EOL killed the quote then there is no quote character to replace.
    if (state.state == STATE_NORMAL) {
      return null;
    }

    line++;
  }

  // If the EOF killed the quote then there is no quote character to replace.
  return null;
}
