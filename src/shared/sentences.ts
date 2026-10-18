export type SegmentLang = 'target' | 'en';

export interface Segment {
  text: string;
  lang: SegmentLang;
}

const EN_PREFIX = /^\s*EN:\s*/;
// A sentence ends at . ! ? … (plus closing quotes) followed by whitespace.
const BOUNDARY = /[.!?…]+["»”')]*\s/;

/**
 * Cuts a streamed reply into speakable pieces so speech can start before the
 * whole answer has arrived. Lines starting with "EN:" are explanations that
 * get the English voice; everything else is in the target language.
 */
export class SentenceSplitter {
  private buffer = '';
  private lineLang: SegmentLang | null = null;

  feed(delta: string): Segment[] {
    this.buffer += delta;
    const out: Segment[] = [];
    for (;;) {
      const newline = this.buffer.indexOf('\n');
      const match = BOUNDARY.exec(this.buffer);
      const sentenceEnd = match ? match.index + match[0].length : -1;
      let cut: number;
      let endsLine = false;
      if (newline !== -1 && (sentenceEnd === -1 || newline < sentenceEnd)) {
        cut = newline + 1;
        endsLine = true;
      } else if (sentenceEnd !== -1) {
        cut = sentenceEnd;
      } else {
        break;
      }
      this.emit(this.buffer.slice(0, cut), out);
      this.buffer = this.buffer.slice(cut);
      if (endsLine) this.lineLang = null;
    }
    return out;
  }

  flush(): Segment[] {
    const out: Segment[] = [];
    this.emit(this.buffer, out);
    this.buffer = '';
    this.lineLang = null;
    return out;
  }

  private emit(piece: string, out: Segment[]): void {
    if (this.lineLang === null) {
      this.lineLang = EN_PREFIX.test(piece) ? 'en' : 'target';
      piece = piece.replace(EN_PREFIX, '');
    }
    const text = piece.replace(/[*_#`]/g, '').trim();
    if (text) out.push({ text, lang: this.lineLang });
  }
}
