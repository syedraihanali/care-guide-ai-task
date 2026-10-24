// Builds AI_Prompts.docx (project root) from prompts/AI_PROMPTS.md.
// Run it with: npm run prompts:docx
// Other files: node scripts/build-prompts-docx.mjs [input.md] [output.docx]
//
// Supports the Markdown the prompt log uses: # to ###### headings, paragraphs, bullet and
// numbered lists, **bold**, `inline code`, --- rules, and fenced code blocks (``` or ~~~ of
// any length), which become a shaded monospace box that keeps every line break.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Tab,
  TextRun,
} from 'docx';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INPUT = path.resolve(process.argv[2] ?? path.join(ROOT, 'prompts', 'AI_PROMPTS.md'));
const OUTPUT = path.resolve(process.argv[3] ?? path.join(ROOT, 'AI_Prompts.docx'));

const BODY_FONT = 'Calibri';
const CODE_FONT = 'Consolas';
const CODE_SIZE = 19; // half-points, so 9.5 pt
const INLINE_CODE_SIZE = 20; // 10 pt: Consolas looks larger than Calibri at the same size
const CODE_FILL = 'F2F2F2';
const BORDER_COLOR = 'D9D9D9';
const CODE_SHADING = { type: ShadingType.CLEAR, color: 'auto', fill: CODE_FILL };

const HEADINGS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
];

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})\s*$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const RULE = /^ {0,3}([-*_])(?: *\1){2,} *$/;
const BULLET = /^(\s*)[-*+]\s+(.*)$/;
const NUMBERED = /^(\s*)(\d{1,9})[.)]\s+(.*)$/;
// **bold**, or a code span: a run of N backticks closed by exactly N backticks (as in CommonMark).
const INLINE = /\*\*(.+?)\*\*|(?<!`)(`+)(?!`)(.+?)(?<!`)\2(?!`)/g;

/** Turns Markdown into a flat list of blocks: heading, paragraph, bullet, numbered, rule, code. */
function parseBlocks(markdown) {
  const text = markdown.charCodeAt(0) === 0xfeff ? markdown.slice(1) : markdown; // drop a UTF-8 BOM
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (lines.at(-1) === '') lines.pop(); // the file's final newline ends a line; it is not an empty line
  const blocks = [];
  let paragraph = [];
  let listItem = null; // the open list item that following text lines continue
  let listIndents = []; // indent widths of the open list levels

  const closeParagraph = () => {
    if (paragraph.length > 0) blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };
  const endList = () => {
    listItem = null;
    listIndents = [];
  };
  const listLevel = (indent) => {
    const width = indent.replace(/\t/g, '    ').length;
    while (listIndents.length > 0 && listIndents.at(-1) > width) listIndents.pop();
    if (listIndents.length === 0 || listIndents.at(-1) < width) listIndents.push(width);
    return Math.min(listIndents.length - 1, 8);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const fence = FENCE_OPEN.exec(line);
    // A backtick in a backtick fence's info string means this is inline code, not a fence.
    if (fence && !(fence[1].startsWith('`') && fence[2].includes('`'))) {
      closeParagraph();
      endList();
      const code = [];
      for (i++; i < lines.length && !closesFence(lines[i], fence[1]); i++) code.push(lines[i]);
      blocks.push({ type: 'code', lines: code });
      continue;
    }

    if (line.trim() === '') {
      closeParagraph();
      listItem = null; // a blank line ends the item, but the list may continue
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      closeParagraph();
      endList();
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2].trim() });
      continue;
    }

    if (RULE.test(line)) {
      closeParagraph();
      endList();
      blocks.push({ type: 'rule' });
      continue;
    }

    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    if (bullet || numbered) {
      closeParagraph();
      listItem = bullet
        ? { type: 'bullet', level: listLevel(bullet[1]), text: bullet[2].trim() }
        : { type: 'numbered', level: listLevel(numbered[1]), number: numbered[2], text: numbered[3].trim() };
      blocks.push(listItem);
      continue;
    }

    if (listItem) {
      listItem.text += ` ${line.trim()}`;
      continue;
    }

    endList();
    paragraph.push(line.trim());
  }

  closeParagraph();
  return blocks;
}

function closesFence(line, opening) {
  const match = FENCE_CLOSE.exec(line);
  return match !== null && match[1][0] === opening[0] && match[1].length >= opening.length;
}

/**
 * Splits inline Markdown into runs, handling **bold** and `inline code` (also code inside bold).
 * Headings pass codeSize = null so their code inherits the heading size.
 */
function inlineRuns(text, style = {}, codeSize = INLINE_CODE_SIZE) {
  const runs = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) runs.push(new TextRun({ ...style, text: text.slice(last, match.index) }));
    if (match[1] !== undefined) {
      runs.push(...inlineRuns(match[1], { ...style, bold: true }, codeSize));
    } else {
      runs.push(
        new TextRun({
          ...style,
          text: codeSpanText(match[3]),
          font: CODE_FONT,
          shading: CODE_SHADING,
          ...(codeSize !== null && { size: codeSize }),
        }),
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) runs.push(new TextRun({ ...style, text: text.slice(last) }));
  return runs;
}

/** Like CommonMark, drops one padding space from each side, which lets a code span start or end with a backtick. */
function codeSpanText(content) {
  const padded = content.length > 2 && content.startsWith(' ') && content.endsWith(' ') && content.trim() !== '';
  return padded ? content.slice(1, -1) : content;
}

function codeBlock(lines) {
  const side = { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR, space: 4 };
  const content = lines.length > 0 ? lines : [''];
  return new Paragraph({
    shading: CODE_SHADING,
    border: { top: side, bottom: side, left: side, right: side },
    indent: { left: 100, right: 100 },
    spacing: { before: 120, after: 240, line: 240 },
    // One paragraph with explicit line breaks keeps the block as a single shaded box.
    children: content.map(
      (line, index) =>
        new TextRun({
          text: line.replace(/\t/g, '    '),
          font: CODE_FONT,
          size: CODE_SIZE,
          ...(index > 0 && { break: 1 }),
        }),
    ),
  });
}

function toParagraph(block) {
  switch (block.type) {
    case 'heading':
      return new Paragraph({
        heading: HEADINGS[block.level - 1],
        keepNext: true,
        children: inlineRuns(block.text, {}, null),
      });
    case 'paragraph':
      return new Paragraph({ spacing: { after: 140 }, children: inlineRuns(block.text) });
    case 'bullet':
      return new Paragraph({
        numbering: { reference: 'bullets', level: block.level },
        spacing: { after: 80 },
        children: inlineRuns(block.text),
      });
    case 'numbered':
      return new Paragraph({
        indent: { left: 720 * (block.level + 1), hanging: 360 },
        spacing: { after: 80 },
        children: [new TextRun({ children: [`${block.number}.`, new Tab()] }), ...inlineRuns(block.text)],
      });
    case 'rule':
      return new Paragraph({
        spacing: { after: 240 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BORDER_COLOR, space: 1 } },
      });
    case 'code':
      return codeBlock(block.lines);
    default:
      throw new Error(`Unknown block type: ${block.type}`);
  }
}

function pageNumberFooter() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            size: 18,
            color: '808080',
            children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES],
          }),
        ],
      }),
    ],
  });
}

function buildDocument(markdown) {
  const blocks = parseBlocks(markdown);
  const title = blocks.find((block) => block.type === 'heading' && block.level === 1)?.text ?? 'AI Prompts';
  const author = /^\*\*Author:\*\*\s*(.+)$/m.exec(markdown)?.[1]?.trim();

  return new Document({
    title,
    creator: author,
    description: 'Every AI prompt used to plan and build this project.',
    styles: {
      default: {
        document: { run: { font: BODY_FONT, size: 22 } },
        heading1: { run: { font: BODY_FONT, size: 36, bold: true, color: '1F3864' }, paragraph: { spacing: { before: 360, after: 160 } } },
        heading2: { run: { font: BODY_FONT, size: 30, bold: true, color: '2F5496' }, paragraph: { spacing: { before: 360, after: 120 } } },
        heading3: { run: { font: BODY_FONT, size: 25, bold: true, color: '2F5496' }, paragraph: { spacing: { before: 280, after: 100 } } },
      },
    },
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: Array.from({ length: 9 }, (_, level) => ({
            level,
            format: LevelFormat.BULLET,
            text: ['•', '◦', '▪'][level % 3],
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
          })),
        },
      ],
    },
    sections: [{ footers: { default: pageNumberFooter() }, children: blocks.map(toParagraph) }],
  });
}

async function main() {
  const markdown = await readFile(INPUT, 'utf8');
  const buffer = await Packer.toBuffer(buildDocument(markdown));

  try {
    await writeFile(OUTPUT, buffer);
  } catch (error) {
    if (error.code === 'EBUSY' || error.code === 'EPERM') {
      throw new Error(`${path.basename(OUTPUT)} is locked, probably because it is open in Word. Close it and run again.`);
    }
    throw error;
  }

  console.log(`Wrote ${path.relative(ROOT, OUTPUT)} from ${path.relative(ROOT, INPUT)} (${Math.round(buffer.length / 1024)} KB)`);
}

main().catch((error) => {
  console.error(`prompts:docx failed: ${error.message}`);
  process.exitCode = 1;
});
