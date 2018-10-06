const { Position } = require('vscode');

const STATE_NO_QUOTE = 0;
const STATE_TEMPLATE_QUOTE = 1;
const STATE_DOUBLE_QUOTE = 2;
const STATE_SINGLE_QUOTE = 3;
const STATE_ESCAPE = 4;

const QUOTES = ['`', '"', '\''];

class QuoteState {
  constructor(quoteChar = null) {
    this.states = [STATE_NO_QUOTE];
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
    // Throw away escaped characters.
    if (this.state == STATE_ESCAPE) {
      this.popState();
      return;
    }

    // Start of an escaped character
    if (char == '\\') {
      this.pushState(STATE_ESCAPE);
      return;
    }

    // We only need do something if this is a quote character.
    let type = QUOTES.indexOf(char) + 1;
    if (type > STATE_NO_QUOTE) {
      // Check if we're entering a quote.
      if (this.state == STATE_NO_QUOTE) {
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
    // Both these states survive an EOL.
    if (this.state <= STATE_TEMPLATE_QUOTE) {
      return;
    }

    // Anything else pops us up one state.
    this.popState();
  }
}

exports.findPreviousQuote = function(document, position) {
  let state = new QuoteState();

  let line = 0;
  while (line < document.lineCount) {
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

    state.pushEOL();

    line++;
  }

  // It should be impossible to get here.
  console.error('findPreviousQuote never found expected position.');
  return {
    character: null,
    position: null,
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
      if (state.state == STATE_NO_QUOTE) {
        return pos;
      }

      char++;
    }

    state.pushEOL();

    // If the EOL killed the quote then there is no quote character to replace.
    if (state.state == STATE_NO_QUOTE) {
      return null;
    }

    line++;
  }

  // If the EOF killed the quote then there is no quote character to replace.
  return null;
}
