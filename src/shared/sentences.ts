export type SegmentLang = 'target' | 'en' | 'fix';

export interface Correction {
  /** What the learner said, as transcribed. */
  wrong: string;
  /** The better phrasing in the target language. */
  right: string;
  /** Short English reason. */
  why: string;
}

export interface Segment {
  text: string;
  lang: SegmentLang;
  /** Set on correction lines ("FIX:"). */
  fix?: Correction;
}

const EN_PREFIX = /^\s*EN:\s*/;
const FIX_PREFIX = /^\s*FIX:\s*/;

/** Reads a correction line: `"wrong" -> "right" | reason`. Quotes and the reason are optional. */
export function parseCorrection(line: string): Correction | null {
  const m = /^(.*?)\s*(?:->|→)\s*(.*?)\s*(?:\|\s*(.*))?$/.exec(line.trim());
  if (!m) return null;
  const unquote = (t: string) => t.trim().replace(/^["“„«]\s*|\s*["”“»]$/g, '');
  const wrong = unquote(m[1]);
  const right = unquote(m[2]);
  if (!right) return null;
  return { wrong, right, why: (m[3] ?? '').trim() };
}
// A sentence ends at . ! ? … (plus closing quotes) followed by whitespace.
const BOUNDARY = /[.!?…]+["»”')]*\s/;

/**
 * Cuts a streamed reply into speakable pieces so speech can start before the
 * whole answer has arrived. Lines starting with "EN:" are explanations that
 * get the English voice; lines starting with "FIX:" are corrections and are
 * kept whole; everything else is in the target language.
 */
export class SentenceSplitter {
  private buffer = '';
  private lineLang: SegmentLang | null = null;

  feed(delta: string): Segment[] {
    this.buffer += delta;
    const out: Segment[] = [];
    for (;;) {
      const newline = this.buffer.indexOf('\n');
      // A correction is one unit: wait for the end of its line.
      if (this.lineLang === 'fix' || (this.lineLang === null && FIX_PREFIX.test(this.buffer))) {
        if (newline === -1) break;
        this.emit(this.buffer.slice(0, newline + 1), out);
        this.buffer = this.buffer.slice(newline + 1);
        this.lineLang = null;
        continue;
      }
      // "FIX:" may still be arriving; do not decide the line's kind on a fragment of it.
      if (this.lineLang === null && newline === -1 && 'FIX:'.startsWith(this.buffer.trimStart()) && this.buffer.trim()) break;
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
      this.lineLang = FIX_PREFIX.test(piece) ? 'fix' : EN_PREFIX.test(piece) ? 'en' : 'target';
      piece = piece.replace(FIX_PREFIX, '').replace(EN_PREFIX, '');
    }
    const text = piece.replace(/[*_#`]/g, '').trim();
    if (!text) return;
    if (this.lineLang === 'fix') {
      const fix = parseCorrection(text);
      // A malformed correction is still worth hearing as an explanation.
      out.push(fix ? { text, lang: 'fix', fix } : { text, lang: 'en' });
    } else {
      out.push({ text, lang: this.lineLang });
    }
  }
}
