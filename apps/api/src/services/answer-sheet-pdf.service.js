import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { PT_PER_MM } from "../utils/answer-sheet-layout.js";

/**
 * Helper to convert mm to PDF points.
 */
function toPt(mm) {
  return mm * PT_PER_MM;
}

/**
 * Render complete vector PDF buffer from layoutJson.
 * @param {Object} layoutJson - Canonical geometry object produced by answer-sheet-layout.js
 * @returns {Promise<Buffer>}
 */
export async function renderAnswerSheetPdf(layoutJson) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 0,
        autoFirstPage: false,
        info: {
          Title: `Phieu Tra Loi - ${layoutJson.examId}`,
          Author: "DigitalExamGrading",
        },
      });

      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      const { markers, pages } = layoutJson;

      for (let pIndex = 0; pIndex < pages.length; pIndex++) {
        const page = pages[pIndex];
        doc.addPage({ size: "A4", margin: 0 });

        // 1. Draw 4 Corner Alignment Markers
        doc.save();
        doc.fillColor("#000000");
        for (const m of markers) {
          doc.rect(toPt(m.xMm), toPt(m.yMm), toPt(m.sizeMm), toPt(m.sizeMm)).fill();
        }
        doc.restore();

        // 2. Draw Header Text
        doc.save();
        doc.font("Helvetica-Bold").fontSize(13).fillColor("#000000");
        doc.text("PHIEU TRA LOI TRAC NGHIEM", toPt(20), toPt(16), { width: toPt(140) });

        doc.font("Helvetica").fontSize(9).fillColor("#333333");
        const titleStr = page.header.examTitle ? `Ky thi: ${page.header.examTitle}` : "";
        const subStr = page.header.subjectName ? `Mon: ${page.header.subjectName}` : "";
        const clsStr = page.header.className ? ` - Lop: ${page.header.className}` : "";
        doc.text(`${titleStr}`, toPt(20), toPt(23), { width: toPt(140) });
        doc.text(`${subStr}${clsStr}`, toPt(20), toPt(28), { width: toPt(140) });

        // Page indicator
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#555555");
        doc.text(`TRANG ${page.pageNumber} / ${page.totalPages}`, toPt(20), toPt(34));
        doc.restore();

        // 3. Draw QR Code
        if (page.qr && page.qr.payload) {
          const qrBuffer = await QRCode.toBuffer(JSON.stringify(page.qr.payload), {
            errorCorrectionLevel: "M",
            type: "png",
            margin: 4,
            width: 240,
          });
          doc.image(qrBuffer, toPt(page.qr.xMm), toPt(page.qr.yMm), {
            width: toPt(page.qr.sizeMm),
            height: toPt(page.qr.sizeMm),
          });
        }

        // 4. Instructions Box
        doc.save();
        const instX = toPt(90);
        const instY = toPt(42);
        const instW = toPt(100);
        const instH = toPt(56);
        doc.rect(instX, instY, instW, instH).lineWidth(0.8).strokeColor("#666666").stroke();
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#000000");
        doc.text("HUONG DAN TO PHIEU:", instX + 6, instY + 5);
        doc.font("Helvetica").fontSize(7.5).fillColor("#333333");
        doc.text("1. Dung but chi 2B de to tron cac o.", instX + 6, instY + 16);
        doc.text("2. To dam va kin o, khong to ngoai vien.", instX + 6, instY + 25);
        doc.text("3. Tay sach bang gom neu sua dap an.", instX + 6, instY + 34);
        doc.text("4. Giu phieu phang, khong gap, khong lam rach.", instX + 6, instY + 43);
        doc.restore();

        // 5. Draw SBD Grid
        if (page.studentNumber) {
          const sn = page.studentNumber;
          doc.save();
          doc.font("Helvetica-Bold").fontSize(8).fillColor("#000000");
          doc.text("SO BAO DANH", toPt(sn.xMm), toPt(sn.yMm - 5));

          // Draw columns
          for (const col of sn.columns) {
            // Write-in box
            doc.rect(toPt(col.writeBox.xMm), toPt(col.writeBox.yMm), toPt(col.writeBox.widthMm), toPt(col.writeBox.heightMm))
              .lineWidth(0.8).strokeColor("#000000").stroke();

            // Bubble digits
            for (const b of col.bubbles) {
              const cx = toPt(b.centerX);
              const cy = toPt(b.centerY);
              const r = toPt(b.radiusMm);
              doc.circle(cx, cy, r).lineWidth(0.6).strokeColor("#000000").stroke();
              doc.font("Helvetica").fontSize(6).fillColor("#000000");
              doc.text(String(b.digit), cx - 2, cy - 3, { width: 4, align: "center" });
            }
          }
          doc.restore();
        }

        // 6. Draw Exam Code Grid
        if (page.examCode) {
          const ec = page.examCode;
          doc.save();
          doc.font("Helvetica-Bold").fontSize(8).fillColor("#000000");
          doc.text("MA DE", toPt(ec.xMm), toPt(ec.yMm - 5));

          for (const col of ec.columns) {
            doc.rect(toPt(col.writeBox.xMm), toPt(col.writeBox.yMm), toPt(col.writeBox.widthMm), toPt(col.writeBox.heightMm))
              .lineWidth(0.8).strokeColor("#000000").stroke();

            for (const b of col.bubbles) {
              const cx = toPt(b.centerX);
              const cy = toPt(b.centerY);
              const r = toPt(b.radiusMm);
              doc.circle(cx, cy, r).lineWidth(0.6).strokeColor("#000000").stroke();
              doc.font("Helvetica").fontSize(6).fillColor("#000000");
              doc.text(String(b.digit), cx - 2, cy - 3, { width: 4, align: "center" });
            }
          }
          doc.restore();
        }

        // 7. Column Headers for Answers Area
        doc.save();
        doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#000000");
        // Column 1 header
        doc.text("CAU", toPt(20), toPt(101));
        doc.text("A", toPt(36), toPt(101));
        doc.text("B", toPt(45), toPt(101));
        doc.text("C", toPt(54), toPt(101));
        doc.text("D", toPt(63), toPt(101));

        // Column 2 header (if questions exist in col 2)
        const hasCol2 = page.answers.some((q) => q.column === 2);
        if (hasCol2) {
          doc.text("CAU", toPt(112), toPt(101));
          doc.text("A", toPt(128), toPt(101));
          doc.text("B", toPt(137), toPt(101));
          doc.text("C", toPt(146), toPt(101));
          doc.text("D", toPt(155), toPt(101));
        }
        doc.restore();

        // 8. Draw Answer Questions & Bubbles
        doc.save();
        for (const q of page.answers) {
          // Question number
          doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#000000");
          const qNumStr = q.questionNumber < 10 ? `0${q.questionNumber}` : String(q.questionNumber);
          doc.text(qNumStr, toPt(q.labelBox.xMm), toPt(q.labelBox.yMm + 1.2), {
            width: toPt(12),
            align: "left",
          });

          // Bubbles A, B, C, D
          for (const letter of ["A", "B", "C", "D"]) {
            const opt = q.options[letter];
            if (!opt) continue;
            const cx = toPt(opt.xMm);
            const cy = toPt(opt.yMm);
            const r = toPt(opt.radiusMm);

            // Vector circle stroke
            doc.circle(cx, cy, r).lineWidth(0.6).strokeColor("#000000").stroke();

            // Inner letter
            doc.font("Helvetica").fontSize(5.5).fillColor("#000000");
            doc.text(letter, cx - 2.2, cy - 2.8, { width: 4.4, align: "center" });
          }
        }
        doc.restore();

        // 9. Footer line
        doc.save();
        doc.font("Helvetica").fontSize(6.5).fillColor("#777777");
        doc.text(
          `DigitalExamGrading OMR - Template Version: ${layoutJson.templateVersion} - Page ${page.pageNumber}/${page.totalPages}`,
          toPt(20),
          toPt(285),
          { width: toPt(170), align: "center" }
        );
        doc.restore();
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}