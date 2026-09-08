import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import fs from "fs";
import { PT_PER_MM } from "../utils/answer-sheet-layout.js";
import { AppError } from "../middlewares/error.middleware.js";

/**
 * Helper to convert mm to PDF points.
 */
function toPt(mm) {
  return mm * PT_PER_MM;
}

/**
 * Resolves available system/runtime TrueType font supporting Vietnamese Unicode.
 * Checks env vars, standard Windows and Linux locations.
 * Returns { regular, bold } or null if none found.
 */
export function resolveUnicodeFont() {
  const customRegular = process.env.OMR_PDF_FONT_REGULAR;
  const customBold = process.env.OMR_PDF_FONT_BOLD;
  if (customRegular && customBold) {
    try {
      if (fs.existsSync(customRegular) && fs.existsSync(customBold)) {
        return { regular: customRegular, bold: customBold };
      }
    } catch {}
  }

  const candidates = [
    // Windows standard fonts
    {
      regular: "C:/Windows/Fonts/arial.ttf",
      bold: "C:/Windows/Fonts/arialbd.ttf",
    },
    {
      regular: "C:/Windows/Fonts/tahoma.ttf",
      bold: "C:/Windows/Fonts/tahomabd.ttf",
    },
    {
      regular: "C:/Windows/Fonts/segoeui.ttf",
      bold: "C:/Windows/Fonts/segoeuib.ttf",
    },
    {
      regular: "C:/Windows/Fonts/times.ttf",
      bold: "C:/Windows/Fonts/timesbd.ttf",
    },
    // Linux standard fonts (Debian/Ubuntu fonts-dejavu-core, fonts-liberation, Alpine/RHEL)
    {
      regular: "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
      bold: "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    },
    {
      regular: "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
      bold: "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    },
    {
      regular: "/usr/share/fonts/dejavu/DejaVuSans.ttf",
      bold: "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
    },
    {
      regular: "/usr/share/fonts/liberation-sans/LiberationSans-Regular.ttf",
      bold: "/usr/share/fonts/liberation-sans/LiberationSans-Bold.ttf",
    },
  ];

  for (const c of candidates) {
    try {
      if (fs.existsSync(c.regular) && fs.existsSync(c.bold)) {
        return c;
      }
    } catch {
      // ignore access error
    }
  }

  return null;
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
          Title: `Phiếu Trả Lời - ${layoutJson.examId}`,
          Author: "DigitalExamGrading",
        },
      });

      // Register Unicode font (fail clearly if unavailable)
      const fontCandidate = resolveUnicodeFont();
      if (!fontCandidate) {
        throw new AppError(
          "Không tìm thấy font chữ Unicode hỗ trợ tiếng Việt trên hệ thống máy chủ (cần cài đặt TrueType font như DejaVuSans, LiberationSans hoặc Arial).",
          500,
          "UNICODE_FONT_NOT_CONFIGURED"
        );
      }

      doc.registerFont("AppUnicodeFont", fontCandidate.regular);
      doc.registerFont("AppUnicodeFont-Bold", fontCandidate.bold);
      const fontRegular = "AppUnicodeFont";
      const fontBold = "AppUnicodeFont-Bold";

      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      const { markers, pages } = layoutJson;

      for (let pIndex = 0; pIndex < pages.length; pIndex++) {
        const page = pages[pIndex];
        doc.addPage({ size: "A4", margin: 0 });

        // 1. Draw 4 Corner Alignment Markers (Identical Canonical Geometry)
        doc.save();
        doc.fillColor("#000000");
        for (const m of markers) {
          doc.rect(toPt(m.xMm), toPt(m.yMm), toPt(m.sizeMm), toPt(m.sizeMm)).fill();
        }
        doc.restore();

        // 2. Draw Header Text (Vietnamese Unicode Supported)
        doc.save();
        doc.font(fontBold).fontSize(13).fillColor("#000000");
        doc.text("PHIẾU TRẢ LỜI TRẮC NGHIỆM", toPt(20), toPt(16), { width: toPt(140) });

        doc.font(fontRegular).fontSize(9).fillColor("#333333");
        const titleStr = page.header.examTitle ? `Kỳ thi: ${page.header.examTitle}` : "";
        const subStr = page.header.subjectName ? `Môn: ${page.header.subjectName}` : "";
        const clsStr = page.header.className ? ` - Lớp: ${page.header.className}` : "";
        doc.text(`${titleStr}`, toPt(20), toPt(23), { width: toPt(140) });
        doc.text(`${subStr}${clsStr}`, toPt(20), toPt(28), { width: toPt(140) });

        // Page indicator
        doc.font(fontBold).fontSize(8).fillColor("#555555");
        doc.text(`TRANG ${page.pageNumber} / ${page.totalPages}`, toPt(20), toPt(34));
        doc.restore();

        // 3. Draw QR Code (Identical Geometry & Placement)
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

        // 4. Instructions Box (Vietnamese Unicode Supported)
        doc.save();
        const instX = toPt(90);
        const instY = toPt(42);
        const instW = toPt(100);
        const instH = toPt(56);
        doc.rect(instX, instY, instW, instH).lineWidth(0.8).strokeColor("#666666").stroke();
        doc.font(fontBold).fontSize(8).fillColor("#000000");
        doc.text("HƯỚNG DẪN TÔ PHIẾU:", instX + 6, instY + 5);
        doc.font(fontRegular).fontSize(7.5).fillColor("#333333");
        doc.text("1. Dùng bút chì 2B để tô tròn các ô.", instX + 6, instY + 16);
        doc.text("2. Tô đậm và kín ô, không tô ngoài viền.", instX + 6, instY + 25);
        doc.text("3. Tẩy sạch bằng gôm nếu sửa đáp án.", instX + 6, instY + 34);
        doc.text("4. Giữ phiếu phẳng, không gập, không làm rách.", instX + 6, instY + 43);
        doc.restore();

        // 5. Draw SBD Grid (Identical Geometry & Placement)
        if (page.studentNumber) {
          const sn = page.studentNumber;
          doc.save();
          doc.font(fontBold).fontSize(8).fillColor("#000000");
          doc.text("SỐ BÁO DANH", toPt(sn.xMm), toPt(sn.yMm - 5));

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
              doc.font(fontRegular).fontSize(6).fillColor("#000000");
              doc.text(String(b.digit), cx - 2, cy - 3, { width: 4, align: "center" });
            }
          }
          doc.restore();
        }

        // 6. Draw Exam Code Grid (Identical Geometry & Placement)
        if (page.examCode) {
          const ec = page.examCode;
          doc.save();
          doc.font(fontBold).fontSize(8).fillColor("#000000");
          doc.text("MÃ ĐỀ", toPt(ec.xMm), toPt(ec.yMm - 5));

          for (const col of ec.columns) {
            doc.rect(toPt(col.writeBox.xMm), toPt(col.writeBox.yMm), toPt(col.writeBox.widthMm), toPt(col.writeBox.heightMm))
              .lineWidth(0.8).strokeColor("#000000").stroke();

            for (const b of col.bubbles) {
              const cx = toPt(b.centerX);
              const cy = toPt(b.centerY);
              const r = toPt(b.radiusMm);
              doc.circle(cx, cy, r).lineWidth(0.6).strokeColor("#000000").stroke();
              doc.font(fontRegular).fontSize(6).fillColor("#000000");
              doc.text(String(b.digit), cx - 2, cy - 3, { width: 4, align: "center" });
            }
          }
          doc.restore();
        }

        // 7. Column Headers for Answers Area
        doc.save();
        doc.font(fontBold).fontSize(7.5).fillColor("#000000");
        // Column 1 header
        doc.text("CÂU", toPt(20), toPt(101));
        doc.text("A", toPt(36), toPt(101));
        doc.text("B", toPt(45), toPt(101));
        doc.text("C", toPt(54), toPt(101));
        doc.text("D", toPt(63), toPt(101));

        // Column 2 header (if questions exist in col 2)
        const hasCol2 = page.answers.some((q) => q.column === 2);
        if (hasCol2) {
          doc.text("CÂU", toPt(112), toPt(101));
          doc.text("A", toPt(128), toPt(101));
          doc.text("B", toPt(137), toPt(101));
          doc.text("C", toPt(146), toPt(101));
          doc.text("D", toPt(155), toPt(101));
        }
        doc.restore();

        // 8. Draw Answer Questions & Bubbles (Identical Geometry)
        doc.save();
        for (const q of page.answers) {
          // Question number
          doc.font(fontBold).fontSize(7.5).fillColor("#000000");
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
            doc.font(fontRegular).fontSize(5.5).fillColor("#000000");
            doc.text(letter, cx - 2.2, cy - 2.8, { width: 4.4, align: "center" });
          }
        }
        doc.restore();

        // 9. Footer line
        doc.save();
        doc.font(fontRegular).fontSize(6.5).fillColor("#777777");
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