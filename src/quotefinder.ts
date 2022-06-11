import { Position, TextDocument } from "vscode";

const QUOTES = ["`", '"', "'"];

enum State {
  Normal,
  TemplateQuote,
  DoubleQuote,
  SingleQuote,
  Escape,
  CommentStart,
  CommentSingleLine,
  CommentMultiLine,
  CommentMultiLineEnd,
}

interface QuotePosition {
  character: string | null;
  position: Position | null;
}

class QuoteState {
  private states: State[];

  public lastQuotePosition: Position | null;

  public lastQuoteChar: string | null;

  constructor(quoteChar: string | null = null) {
    this.states = [State.Normal];
    if (quoteChar) {
      this.pushState(QUOTES.indexOf(quoteChar) + 1);
    }
    this.lastQuotePosition = null;
    this.lastQuoteChar = quoteChar;
  }

  pushState(state: State) {
    this.states.push(state);
  }

  popState() {
    this.states.pop();
  }

  get state(): State | undefined {
    return this.states[this.states.length - 1];
  }

  pushChar(position: Position, char: string) {
    switch (this.state) {
      case State.CommentStart:
        // Regardless we're no longer in the start state.
        this.popState();

        if (char == "/") {
          this.pushState(State.CommentSingleLine);
          return;
        }
        if (char == "*") {
          this.pushState(State.CommentMultiLine);
          return;
        }

        // If we haven't entered a comment then just continue to process this
        // character.
        break;

      // Nothing can change this state.
      case State.CommentSingleLine:
        return;

      // The only way to change this state is by ending the comment.
      case State.CommentMultiLine:
        if (char == "*") {
          this.pushState(State.CommentMultiLineEnd);
        }
        return;

      // We always at least drop back to the comment state, maybe leave that entirely.
      case State.CommentMultiLineEnd:
        this.popState();
        if (char == "/") {
          this.popState();
        }
        return;

      // Throw away escaped characters.
      case State.Escape:
        this.popState();
        return;
    }

    if (this.state == State.Normal && char == "/") {
      this.pushState(State.CommentStart);
      return;
    }

    // Start of an escaped character
    if (char == "\\") {
      this.pushState(State.Escape);
      return;
    }

    // We now only need do something if this is a quote character.
    let type = QUOTES.indexOf(char) + 1;
    if (type > State.Normal) {
      // Check if we're entering a quote.
      if (this.state == State.Normal) {
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
      case State.Normal:
      case State.TemplateQuote:
      case State.CommentMultiLine:
        return;

      // These pop us up one state.
      case State.DoubleQuote:
      case State.SingleQuote:
      case State.Escape:
      case State.CommentStart:
      case State.CommentSingleLine:
      case State.CommentMultiLineEnd:
        this.popState();
    }
  }
}

export function findPreviousQuote(
  document: TextDocument,
  position: Position,
): QuotePosition {
  let state = new QuoteState();

  let line = 0;
  while (line <= position.line) {
    if (line > 0) {
      state.pushEOL();
    }

    let { text } = document.lineAt(line);
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

export function findEndQuote(
  document: TextDocument,
  position: Position,
  lastQuoteChar: string | null,
): Position | null {
  let state = new QuoteState(lastQuoteChar);

  let { line } = position;
  while (line < document.lineCount) {
    let { text } = document.lineAt(line);

    let char = line == position.line ? position.character : 0;
    while (char < text.length) {
      let pos = new Position(line, char);
      state.pushChar(pos, text.charAt(char));

      // If this character was the end of the quote then return its position.
      if (state.state == State.Normal) {
        return pos;
      }

      char++;
    }

    state.pushEOL();

    // If the EOL killed the quote then there is no quote character to replace.
    if (state.state == State.Normal) {
      return null;
    }

    line++;
  }

  // If the EOF killed the quote then there is no quote character to replace.
  return null;
}
