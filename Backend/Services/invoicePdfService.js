import PDFDocument from 'pdfkit';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serviceDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(serviceDirectory, '../../Frontend');
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 45;

function formatAmount(value) {
  return (Number(value) || 0).toLocaleString('fr-FR');
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('fr-FR');
}

export async function generateInvoicePdf(facture, lignes) {
  const logo = await readFile(path.join(frontendDirectory, 'logo.jpeg'));
  const stampPath = path.join(frontendDirectory, 'Cachet_+_Signature-removebg-preview.png');
  const isPaid = String(facture.statut || '').trim().toLowerCase() === 'payée';
  const stamp = isPaid ? await readFile(stampPath) : null;

  return new Promise((resolve, reject) => {
    const document = new PDFDocument({
      size: 'A4',
      margins: { top: PAGE_MARGIN, right: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN },
      bufferPages: true,
      info: {
        Title: `Facture ${facture.numero_facture}`,
        Author: 'ASSA-AC'
      }
    });
    const chunks = [];

    document.on('data', chunk => chunks.push(chunk));
    document.once('error', reject);
    document.once('end', () => resolve(Buffer.concat(chunks)));

    const pageContentWidth = PAGE_WIDTH - PAGE_MARGIN * 2;

    const addInvoiceHeader = () => {
      const top = 38;
      const leftWidth = 205;
      const logoX = 260;
      const visionX = 370;
      const visionWidth = PAGE_WIDTH - PAGE_MARGIN - visionX;

      document.font('Helvetica-Bold').fontSize(7.2).fillColor('#111827');
      document.text("COMMUNAUTÉ ÉCONOMIQUE ET MONÉTAIRE DE L'AFRIQUE CENTRALE", PAGE_MARGIN, top, {
        width: leftWidth,
        align: 'center'
      });
      document.text("UNION ÉCONOMIQUE DE L'AFRIQUE CENTRALE", PAGE_MARGIN, document.y + 3, {
        width: leftWidth,
        align: 'center'
      });
      document.text("AGENCE DE SUPERVISION DE LA SÉCURITÉ AÉRIENNE EN AFRIQUE CENTRALE", PAGE_MARGIN, document.y + 3, {
        width: leftWidth,
        align: 'center'
      });
      document.font('Helvetica').fontSize(8).text('ASSA-AC', PAGE_MARGIN, document.y + 3, {
        width: leftWidth,
        align: 'center'
      });
      document.moveTo(PAGE_MARGIN + 20, document.y + 5).lineTo(PAGE_MARGIN + leftWidth - 20, document.y + 5).stroke('#9ca3af');
      document.font('Helvetica-BoldOblique').fontSize(9).text('La Direction Générale', PAGE_MARGIN, document.y + 9, {
        width: leftWidth,
        align: 'center'
      });

      document.image(logo, logoX, top + 9, { fit: [75, 75], align: 'center', valign: 'center' });

      document.rect(visionX, top, visionWidth, 101).lineWidth(0.8).stroke('#374151');
      document.font('Helvetica-Oblique').fontSize(8).fillColor('#111827')
        .text('Vision CEMAC 2025 : « Faire de la CEMAC en 2025 un espace économique intégré et émergent, où règnent la sécurité, la solidarité et la bonne gouvernance, au service du développement humain ».', visionX + 8, top + 8, {
          width: visionWidth - 16,
          height: 85,
          align: 'justify',
          lineGap: 2
        });
    };

    const addTableHeader = y => {
      const widths = [30, 185, 85, 95, pageContentWidth - 395];
      const headers = ['N°', 'Désignation', 'Passagers', 'Coût unitaire', 'Coût total'];
      let x = PAGE_MARGIN;
      const height = 28;

      headers.forEach((heading, index) => {
        document.rect(x, y, widths[index], height).fillAndStroke('#e5e7eb', '#111827');
        document.font('Helvetica-Bold').fontSize(7.5).fillColor('#111827')
          .text(heading, x + 3, y + 8, { width: widths[index] - 6, align: 'center' });
        x += widths[index];
      });
      return { widths, nextY: y + height };
    };

    const addPage = () => {
      document.addPage();
      addInvoiceHeader();
      return addTableHeader(160).nextY;
    };

    try {
      addInvoiceHeader();

      document.font('Helvetica-Bold').fontSize(15).fillColor('#111827')
        .text(`FACTURE ${facture.numero_facture || ''}`, PAGE_MARGIN, 155, {
          width: pageContentWidth,
          align: 'center',
          underline: true
        });

      let y = 190;
      const details = [
        ['Client', facture.nom_client],
        ['Pour', facture.objet],
        ['Période', facture.periode],
        ['Aéroport', facture.aeroport]
      ];
      details.forEach(([label, value]) => {
        document.font('Helvetica-Bold').fontSize(9).fillColor('#111827')
          .text(`${label} :`, PAGE_MARGIN + 12, y, { width: 82 });
        document.font('Helvetica').text(String(value || '—'), PAGE_MARGIN + 100, y, {
          width: pageContentWidth - 112
        });
        y = Math.max(y + 18, document.y + 3);
      });

      y += 8;
      let { widths, nextY } = addTableHeader(y);
      y = nextY;

      for (const [index, ligne] of (Array.isArray(lignes) ? lignes : []).entries()) {
        const designation = String(ligne.designation || '—');
        const rowValues = [
          String(ligne.numero_ligne || index + 1),
          designation,
          formatAmount(ligne.nombre_passagers),
          formatAmount(ligne.cout_unitaire),
          formatAmount(ligne.cout_total ?? (Number(ligne.nombre_passagers || 0) * Number(ligne.cout_unitaire || 0)))
        ];
        const designationHeight = document.font('Helvetica').fontSize(8)
          .heightOfString(designation, { width: widths[1] - 10, lineGap: 2 });
        const rowHeight = Math.max(27, designationHeight + 12);

        if (y + rowHeight > PAGE_HEIGHT - 75) {
          y = addPage();
          widths = [30, 185, 85, 95, pageContentWidth - 395];
        }

        let x = PAGE_MARGIN;
        rowValues.forEach((value, column) => {
          document.rect(x, y, widths[column], rowHeight).lineWidth(0.6).stroke('#111827');
          document.font('Helvetica').fontSize(8).fillColor('#111827')
            .text(value, x + 5, y + 6, {
              width: widths[column] - 10,
              height: rowHeight - 10,
              align: column === 1 ? 'left' : 'right',
              lineGap: 2
            });
          x += widths[column];
        });
        y += rowHeight;
      }

      if (y + 45 > PAGE_HEIGHT - 65) y = addPage();
      const totalLabelWidth = widths.slice(0, 4).reduce((sum, width) => sum + width, 0);
      document.rect(PAGE_MARGIN, y, totalLabelWidth, 29).lineWidth(0.8).stroke('#111827');
      document.rect(PAGE_MARGIN + totalLabelWidth, y, widths[4], 29).fillAndStroke('#e5e7eb', '#111827');
      document.font('Helvetica-Bold').fontSize(9).fillColor('#111827')
        .text('TOTAL', PAGE_MARGIN + 5, y + 9, { width: totalLabelWidth - 12, align: 'right' });
      document.text(formatAmount(facture.montant_total), PAGE_MARGIN + totalLabelWidth + 4, y + 9, {
        width: widths[4] - 8,
        align: 'right'
      });
      y += 43;

      const amountInWords = String(facture.montant_en_lettres || '').trim();
      if (amountInWords) {
        const wordsHeight = document.font('Helvetica-Oblique').fontSize(9)
          .heightOfString(amountInWords, { width: pageContentWidth });
        if (y + wordsHeight + 90 > PAGE_HEIGHT - 50) y = addPage();
        document.font('Helvetica-Oblique').fontSize(9).fillColor('#111827')
          .text(amountInWords, PAGE_MARGIN, y, { width: pageContentWidth, lineGap: 2 });
        y = document.y + 24;
      }

      if (y + 130 > PAGE_HEIGHT - 45) y = addPage();
      document.font('Helvetica').fontSize(9).fillColor('#111827')
        .text(`Fait à ${facture.lieu_emission || '—'}, le ${formatDate(facture.date_emission)}`, PAGE_MARGIN, y, {
          width: pageContentWidth,
          align: 'right'
        });
      y += 26;

      if (stamp) {
        document.image(stamp, PAGE_WIDTH - PAGE_MARGIN - 145, y, { fit: [130, 95], align: 'center', valign: 'center' });
        y += 102;
      } else {
        document.font('Helvetica-Bold').fontSize(10).text('La Direction Générale', PAGE_MARGIN, y, {
          width: pageContentWidth,
          align: 'right'
        });
        y += 25;
      }

      if (y + 80 > PAGE_HEIGHT - PAGE_MARGIN) y = addPage();
      document.moveTo(PAGE_MARGIN, y).lineTo(PAGE_WIDTH - PAGE_MARGIN, y).stroke('#9ca3af');
      document.font('Helvetica-Bold').fontSize(8).fillColor('#111827')
        .text('Conditions de paiement :', PAGE_MARGIN, y + 9, { underline: true });
      document.font('Helvetica').fontSize(7.5)
        .text([
          'Par virement bancaire suivant RIB joint en annexe, à trente jours échus ;',
          'Au-delà des trente jours une pénalité de 5% est facturée par tranche de 15 jours de retard ;',
          'Chaque quinzaine entamée est due.'
        ].join('\n'), PAGE_MARGIN, y + 23, { width: pageContentWidth, lineGap: 2 });

      const pageRange = document.bufferedPageRange();
      for (let pageIndex = pageRange.start; pageIndex < pageRange.start + pageRange.count; pageIndex++) {
        document.switchToPage(pageIndex);
        document.font('Helvetica').fontSize(8).fillColor('#6b7280')
          .text(`${pageIndex + 1} / ${pageRange.count}`, PAGE_MARGIN, PAGE_HEIGHT - 32, {
            width: pageContentWidth,
            align: 'center'
          });
      }

      document.end();
    } catch (error) {
      reject(error);
    }
  });
}
