import {
  Document as DocxDocument,
  Paragraph,
  TextRun,
  BorderStyle,
  AlignmentType,
  LineRuleType,
} from 'docx';

function getRunsFromLine(line: string): TextRun[] {
  return line.split(/(\*\*.*?\*\*)/g).filter(Boolean).map((part) => {
    const isBold = /^\*\*(.*)\*\*$/.test(part);
    return new TextRun({
      text: isBold ? part.slice(2, -2) : part,
      bold: isBold,
    });
  });
}

/**
 * Builds a professional black-and-white DOCX document from PV markdown text.
 * Styling mirrors PVRenderer.tsx (Times New Roman, uppercase section headers
 * with bottom border, left-bar sub-sections, em-dash lists, etc.).
 *
 * @param content   PV text in the same markdown dialect used by PVRenderer
 * @param participants  When provided, a programmatic SIGNATURES section is
 *   appended at the bottom (used for draft exports where signatures are not
 *   yet embedded in the content text).
 */
export function buildPVDocxDocument(
  content: string,
  participants?: string[]
): DocxDocument {
  const paragraphs: Paragraph[] = [];
  // Handle JSON-encoded newlines that may be present in legacy stored content
  const lines = content.replace(/\\n/g, '\n').split(/\r?\n/);

  lines.forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line) {
      paragraphs.push(new Paragraph({ spacing: { after: 80 } }));
      return;
    }

    // ___________________________ → signature underline rule
    if (/^_{10,}$/.test(line)) {
      paragraphs.push(
        new Paragraph({
          spacing: { before: 280, after: 60 },
          children: [
            new TextRun({
              text: ' '.repeat(32),
              underline: {},
              size: 22,
            }),
          ],
        })
      );
      return;
    }

    // --- → horizontal rule
    if (line === '---') {
      paragraphs.push(
        new Paragraph({
          spacing: { before: 200, after: 200 },
          border: {
            bottom: { color: '888888', size: 4, style: BorderStyle.SINGLE, space: 1 },
          },
          children: [],
        })
      );
      return;
    }

    // # TITRE PRINCIPAL — centré, 16pt, uppercase, bordure bas 2.5pt
    if (line.startsWith('# ')) {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 140 },
          border: {
            bottom: { color: '000000', size: 20, style: BorderStyle.SINGLE, space: 4 },
          },
          children: [
            new TextRun({
              text: line.replace('# ', ''),
              bold: true,
              size: 32,
              allCaps: true,
            }),
          ],
        })
      );
      return;
    }

    // ## SECTION — 10.5pt, uppercase, bordure bas 1.5pt
    if (line.startsWith('## ')) {
      paragraphs.push(
        new Paragraph({
          spacing: { before: 560, after: 160 },
          border: {
            bottom: { color: '000000', size: 12, style: BorderStyle.SINGLE, space: 4 },
          },
          children: [
            new TextRun({
              text: line.replace('## ', ''),
              bold: true,
              size: 21,
              allCaps: true,
            }),
          ],
        })
      );
      return;
    }

    // ### Sous-section — 11pt, gras, barre gauche 3pt
    if (line.startsWith('### ')) {
      paragraphs.push(
        new Paragraph({
          spacing: { before: 360, after: 120 },
          border: {
            left: { color: '000000', size: 24, style: BorderStyle.SINGLE, space: 10 },
          },
          indent: { left: 180 },
          children: [
            new TextRun({
              text: line.replace('### ', ''),
              bold: true,
              size: 22,
            }),
          ],
        })
      );
      return;
    }

    // - Liste → em-dash (—)
    if (line.startsWith('- ')) {
      paragraphs.push(
        new Paragraph({
          spacing: { after: 60 },
          alignment: AlignmentType.BOTH,
          indent: { left: 360, hanging: 180 },
          children: [
            new TextRun({
              text: `— ${line.replace('- ', '')}`,
              size: 22,
            }),
          ],
        })
      );
      return;
    }

    // • Bullet
    if (line.startsWith('• ')) {
      paragraphs.push(
        new Paragraph({
          spacing: { after: 60 },
          alignment: AlignmentType.BOTH,
          indent: { left: 420, hanging: 180 },
          children: [
            new TextRun({
              text: `• ${line.replace('• ', '')}`,
              size: 22,
            }),
          ],
        })
      );
      return;
    }

    // 1. Numéroté
    if (/^\d+\.\s/.test(line)) {
      paragraphs.push(
        new Paragraph({
          spacing: { after: 60 },
          indent: { left: 360 },
          children: getRunsFromLine(line),
        })
      );
      return;
    }

    // Paragraphe normal — justifié
    paragraphs.push(
      new Paragraph({
        spacing: { after: 100 },
        alignment: AlignmentType.BOTH,
        children: getRunsFromLine(line),
      })
    );
  });

  // Section signatures programmatique — uniquement pour le brouillon
  // (le PV final intègre les signatures directement dans son texte)
  if (participants && participants.length > 0) {
    paragraphs.push(
      new Paragraph({
        spacing: { before: 800, after: 160 },
        border: {
          bottom: { color: '000000', size: 12, style: BorderStyle.SINGLE, space: 4 },
        },
        children: [
          new TextRun({
            text: 'SIGNATURES',
            bold: true,
            size: 21,
            allCaps: true,
          }),
        ],
      })
    );

    for (let i = 0; i < participants.length; i += 2) {
      const left = participants[i];
      const right = participants[i + 1];
      const [leftName, leftRole = ''] = left.split(' — ');
      const [rightName = '', rightRole = ''] = right ? right.split(' — ') : [];

      paragraphs.push(
        new Paragraph({
          spacing: { before: 400, after: 60 },
          children: [
            new TextRun({ text: leftName, bold: true, size: 22 }),
            new TextRun({ text: '\t\t\t\t', size: 22 }),
            new TextRun({ text: rightName, bold: true, size: 22 }),
          ],
        })
      );
      paragraphs.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [
            new TextRun({ text: leftRole, italics: true, size: 20 }),
            new TextRun({ text: '\t\t\t\t', size: 22 }),
            new TextRun({ text: rightRole, italics: true, size: 20 }),
          ],
        })
      );
      paragraphs.push(
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({ text: ' '.repeat(28), underline: {}, size: 22 }),
            new TextRun({ text: '\t\t\t\t', size: 22 }),
            new TextRun({
              text: rightName ? ' '.repeat(28) : '',
              underline: rightName ? {} : undefined,
              size: 22,
            }),
          ],
        })
      );
    }
  }

  return new DocxDocument({
    styles: {
      default: {
        document: {
          run: {
            font: 'Times New Roman',
            size: 22,
            color: '000000',
          },
          paragraph: {
            spacing: { line: 276, lineRule: LineRuleType.AUTO },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        children: paragraphs,
      },
    ],
  });
}
