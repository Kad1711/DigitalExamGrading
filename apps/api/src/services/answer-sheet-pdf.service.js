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

const THEME_PINK = "#E11D48";
const TEXT_BLACK = "#000000";

/**
 * Resolves available system/runtime TrueType font supporting Vietnamese Unicode.
 * Checks env vars, standard Windows and Linux locations.
 * Returns { regular, bold, italic } or null if none found.
 */
export function resolveUnicodeFont() {
  const customRegular = process.env.OMR_PDF_FONT_REGULAR;
  const customBold = process.env.OMR_PDF_FONT_BOLD;
  const customItalic = process.env.OMR_PDF_FONT_ITALIC;
  if (customRegular && customBold) {
    try {
      if (fs.existsSync(customRegular) && fs.existsSync(customBold)) {
        return {
          regular: customRegular,
          bold: customBold,
          italic: customItalic && fs.existsSync(customItalic) ? customItalic : customRegular,
        };
      }
    } catch {}
  }

  const candidates = [
    // Windows standard fonts
    {
      regular: "C:/Windows/Fonts/arial.ttf",
      bold: "C:/Windows/Fonts/arialbd.ttf",
      italic: "C:/Windows/Fonts/ariali.ttf",
    },
    {
      regular: "C:/Windows/Fonts/tahoma.ttf",
      bold: "C:/Windows/Fonts/tahomabd.ttf",
      italic: "C:/Windows/Fonts/tahoma.ttf",
    },
    {
      regular: "C:/Windows/Fonts/segoeui.ttf",
      bold: "C:/Windows/Fonts/segoeuib.ttf",
      italic: "C:/Windows/Fonts/segoeuii.ttf",
    },
    {
      regular: "C:/Windows/Fonts/times.ttf",
      bold: "C:/Windows/Fonts/timesbd.ttf",
      italic: "C:/Windows/Fonts/timesi.ttf",
    },
    // Linux standard fonts (Debian/Ubuntu fonts-dejavu-core, fonts-liberation, Alpine/RHEL)
    {
      regular: "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
      bold: "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
      italic: "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf",
    },
    {
      regular: "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
      bold: "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
      italic: "/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf",
    },
    {
      regular: "/usr/share/fonts/dejavu/DejaVuSans.ttf",
      bold: "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
      italic: "/usr/share/fonts/dejavu/DejaVuSans-Oblique.ttf",
    },
    {
      regular: "/usr/share/fonts/liberation-sans/LiberationSans-Regular.ttf",
      bold: "/usr/share/fonts/liberation-sans/LiberationSans-Bold.ttf",
      italic: "/usr/share/fonts/liberation-sans/LiberationSans-Italic.ttf",
    },
  ];

  for (const c of candidates) {
    try {
      if (fs.existsSync(c.regular) && fs.existsSync(c.bold)) {
        return c;
      }
    } catch {}
  }

  return null;
}

/**
 * Render complete vector PDF buffer from layoutJson matching MOET 2025 Standard.
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
          Title: `Phiếu Trả Lời Trắc Nghiệm Chuẩn BGD - ${layoutJson.examId}`,
          Author: "DigitalExamGrading",
        },
      });

      // Register Unicode font
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
      doc.registerFont("AppUnicodeFont-Italic", fontCandidate.italic || fontCandidate.regular);
      const fontRegular = "AppUnicodeFont";
      const fontBold = "AppUnicodeFont-Bold";
      const fontItalic = "AppUnicodeFont-Italic";

      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      const { markers, pages } = layoutJson;

      for (let pIndex = 0; pIndex < pages.length; pIndex++) {
        const page = pages[pIndex];
        doc.addPage({ size: "A4", margin: 0 });

        // 1. Draw 4 Corner Alignment Markers (Solid black squares)
        doc.save();
        doc.fillColor(TEXT_BLACK);
        for (const m of markers) {
          doc.rect(toPt(m.xMm), toPt(m.yMm), toPt(m.sizeMm), toPt(m.sizeMm)).fill();
        }

        // Section margin alignment marks (Left & Right)
        const sectionMarkersY = [89.0, 148.5, 188.5];
        for (const sym of sectionMarkersY) {
          doc.rect(toPt(8.0), toPt(sym), toPt(4.0), toPt(3.5)).fill();
          doc.rect(toPt(198.0), toPt(sym), toPt(4.0), toPt(3.5)).fill();
        }

        // Right margin timing dashes aligned with SBD & Mã đề rows
        // Top row write box dash
        doc.rect(toPt(197.0), toPt(27.4), toPt(4.5), toPt(1.2)).fill();
        // 10 bubble rows dashes
        for (let d = 0; d <= 9; d++) {
          const dashY = 31.0 + d * 4.6 + 1.7;
          doc.rect(toPt(197.0), toPt(dashY), toPt(4.5), toPt(1.2)).fill();
        }
        doc.restore();

        // 2. Page Header Title & Exam Info
        doc.save();
        doc.font(fontBold).fontSize(14).fillColor(TEXT_BLACK);
        doc.text("PHIẾU TRẢ LỜI TRẮC NGHIỆM", toPt(14), toPt(9.5), { width: toPt(182), align: "center" });

        // Left exam info (constrained to 120mm to prevent collision with SBD / Mã đề)
        doc.font(fontRegular).fontSize(8.5).fillColor(TEXT_BLACK);
        const titleStr = page.header.examTitle
          ? `Kỳ thi: ${page.header.examTitle}`
          : "Kỳ thi: .......................................................................................................";
        doc.text(titleStr, toPt(14), toPt(15.2), { width: toPt(120), align: "left" });

        const subjStr = page.header.subjectName ? `Môn thi: ${page.header.subjectName}` : "Môn thi: ........................................";
        const clsStr = page.header.className ? ` - Lớp: ${page.header.className}` : "";
        doc.text(`${subjStr}${clsStr}         Ngày thi: ........./........./ 20.........`, toPt(14), toPt(19.2), {
          width: toPt(120),
          align: "left",
        });
        doc.restore();

        // 3. Top Three Info Boxes (Pink theme: #E11D48)
        // Box 1: Left - Giám thị (44mm x 56mm)
        doc.save();
        const b1X = toPt(14.0);
        const b1Y = toPt(25.0);
        const b1W = toPt(44.0);
        const b1H = toPt(56.0);
        doc.rect(b1X, b1Y, b1W, b1H).lineWidth(0.6).strokeColor(THEME_PINK).stroke();
        doc.moveTo(b1X, b1Y + b1H / 2)
          .lineTo(b1X + b1W, b1Y + b1H / 2)
          .lineWidth(0.6)
          .strokeColor(THEME_PINK)
          .stroke();

        doc.font(fontRegular).fontSize(7.5).fillColor(TEXT_BLACK);
        doc.text("Họ tên, chữ ký\ncủa Giám thị 1", b1X + 4, b1Y + 7, { width: b1W - 8, align: "center" });
        doc.text("Họ tên, chữ ký\ncủa Giám thị 2", b1X + 4, b1Y + b1H / 2 + 7, { width: b1W - 8, align: "center" });

        // Box 2: Center - Thông tin thí sinh (76mm x 56mm)
        const b2X = toPt(60.0);
        const b2Y = toPt(25.0);
        const b2W = toPt(76.0);
        const b2H = toPt(56.0);
        doc.rect(b2X, b2Y, b2W, b2H).lineWidth(0.6).strokeColor(THEME_PINK).stroke();

        doc.font(fontRegular).fontSize(7).fillColor(TEXT_BLACK);
        const candidateFields = [
          "1. Hội đồng thi: .....................................................................",
          "2. Điểm thi: ..............................................................................",
          "3. Phòng thi số: ......................................................................",
          "4. Họ và tên thí sinh: .............................................................",
          "5. Ngày sinh: ........./........./................ (Nam/ Nữ): ..............",
          "6. Chữ ký của thí sinh: ...........................................................",
        ];
        candidateFields.forEach((field, fIdx) => {
          doc.text(field, b2X + 6, b2Y + 5 + fIdx * 8.5);
        });

        // Box 3: Right - Số báo danh & Mã đề thi (54mm x 56mm)
        const b3X = toPt(138.0);
        const b3Y = toPt(25.0);
        const b3W = toPt(54.0);
        const b3H = toPt(56.0);

        // Labels above Box 3
        doc.font(fontBold).fontSize(7.5).fillColor(TEXT_BLACK);
        doc.text("7. Số báo danh", b3X, toPt(20.5), { width: toPt(31.2), align: "center" });
        doc.text("8. Mã đề thi", b3X + toPt(32.5), toPt(20.5), { width: toPt(21.5), align: "center" });

        // Outer border of Box 3
        doc.rect(b3X, b3Y, b3W, b3H).lineWidth(0.6).strokeColor(THEME_PINK).stroke();
        // Divider line between SBD and Mã đề
        doc.moveTo(b3X + toPt(32.0), b3Y)
          .lineTo(b3X + toPt(32.0), b3Y + b3H)
          .lineWidth(0.6)
          .strokeColor(THEME_PINK)
          .stroke();

        // Render SBD Grid
        if (page.studentNumber) {
          for (const col of page.studentNumber.columns) {
            doc.rect(toPt(col.writeBox.xMm), toPt(col.writeBox.yMm), toPt(col.writeBox.widthMm), toPt(col.writeBox.heightMm))
              .lineWidth(0.5).strokeColor(THEME_PINK).stroke();

            for (const b of col.bubbles) {
              const cx = toPt(b.centerX);
              const cy = toPt(b.centerY);
              const r = toPt(b.radiusMm);
              doc.circle(cx, cy, r).lineWidth(0.5).strokeColor(THEME_PINK).stroke();
              doc.font(fontRegular).fontSize(5.5).fillColor(THEME_PINK);
              doc.text(String(b.digit), cx - 2, cy - 2.8, { width: 4, align: "center" });
            }
          }
        }

        // Render Exam Code Grid
        if (page.examCode) {
          for (const col of page.examCode.columns) {
            doc.rect(toPt(col.writeBox.xMm), toPt(col.writeBox.yMm), toPt(col.writeBox.widthMm), toPt(col.writeBox.heightMm))
              .lineWidth(0.5).strokeColor(THEME_PINK).stroke();

            for (const b of col.bubbles) {
              const cx = toPt(b.centerX);
              const cy = toPt(b.centerY);
              const r = toPt(b.radiusMm);
              doc.circle(cx, cy, r).lineWidth(0.5).strokeColor(THEME_PINK).stroke();
              doc.font(fontRegular).fontSize(5.5).fillColor(THEME_PINK);
              doc.text(String(b.digit), cx - 2, cy - 2.8, { width: 4, align: "center" });
            }
          }
        }
        doc.restore();

        // 4. Center Instruction Notice
        doc.save();
        doc.font(fontItalic).fontSize(7.5).fillColor(TEXT_BLACK);
        doc.text("Chú ý: Thí sinh cần đọc kỹ hướng dẫn ở mặt sau Phiếu này.", toPt(14), toPt(83.5), {
          width: toPt(182),
          align: "center",
        });
        doc.restore();

        // 5. PHẦN I: Trắc nghiệm 40 câu nhiều phương án lựa chọn
        doc.save();
        doc.font(fontBold).fontSize(8.5).fillColor(TEXT_BLACK);
        doc.text("PHẦN I", toPt(14.0), toPt(89.0));

        const p1ColX = [14.0, 59.5, 105.0, 150.5];
        const p1Width = 43.0;
        const p1Height = 51.0;

        for (let colIdx = 0; colIdx < 4; colIdx++) {
          const colX = p1ColX[colIdx];
          // Outer box for each column
          doc.rect(toPt(colX), toPt(94.0), toPt(p1Width), toPt(p1Height))
            .lineWidth(0.6).strokeColor(THEME_PINK).stroke();

          // Column headers A B C D
          doc.font(fontBold).fontSize(6.5).fillColor(THEME_PINK);
          const letters = ["A", "B", "C", "D"];
          const optOffsets = [15.5, 22.5, 29.5, 36.5];
          letters.forEach((l, lIdx) => {
            const lx = colX + optOffsets[lIdx];
            doc.text(l, toPt(lx - 2.5), toPt(95.0), { width: toPt(5), align: "center" });
          });
        }

        // Draw 40 Questions & Bubbles
        if (page.answers) {
          for (const q of page.answers) {
            doc.font(fontBold).fontSize(6.5).fillColor(TEXT_BLACK);
            const qStr = String(q.questionNumber);
            doc.text(qStr, toPt(q.labelBox.xMm + 0.5), toPt(q.labelBox.yMm + 0.8), {
              width: toPt(q.labelBox.widthMm),
              align: "left",
            });

            for (const letter of ["A", "B", "C", "D"]) {
              const b = q.options[letter];
              if (!b) continue;
              const cx = toPt(b.xMm);
              const cy = toPt(b.yMm);
              const r = toPt(b.radiusMm);
              doc.circle(cx, cy, r).lineWidth(0.5).strokeColor(THEME_PINK).stroke();
            }
          }
        }
        doc.restore();

        // 6. PHẦN II: Trắc nghiệm Đúng / Sai (8 câu)
        doc.save();
        doc.font(fontBold).fontSize(8.5).fillColor(TEXT_BLACK);
        doc.text("PHẦN II", toPt(14.0), toPt(148.5));

        const p2BoxX = [14.0, 59.5, 105.0, 150.5];
        const p2Width = 43.0;
        const p2Height = 32.0;

        for (let bIdx = 0; bIdx < 4; bIdx++) {
          const bx = p2BoxX[bIdx];
          doc.rect(toPt(bx), toPt(153.5), toPt(p2Width), toPt(p2Height))
            .lineWidth(0.6).strokeColor(THEME_PINK).stroke();

          // Vertical divider between the two questions
          doc.moveTo(toPt(bx + 21.5), toPt(153.5))
            .lineTo(toPt(bx + 21.5), toPt(153.5 + p2Height))
            .lineWidth(0.5).strokeColor(THEME_PINK).stroke();
        }

        // Draw questions in Phần II
        if (page.part2) {
          for (const q of page.part2) {
            const subX = q.xMm;
            doc.font(fontBold).fontSize(6.5).fillColor(TEXT_BLACK);
            doc.text(`Câu ${q.questionNumber}`, toPt(subX), toPt(154.5), {
              width: toPt(21.5),
              align: "center",
            });

            doc.font(fontRegular).fontSize(5.5).fillColor(THEME_PINK);
            doc.text("Đúng", toPt(subX + 9.0), toPt(158.0), { width: toPt(5), align: "center" });
            doc.text("Sai", toPt(subX + 15.0), toPt(158.0), { width: toPt(5), align: "center" });

            for (const subKey of ["a", "b", "c", "d"]) {
              const item = q.items[subKey];
              if (!item) continue;

              // Row label a), b), c), d)
              doc.font(fontRegular).fontSize(5.5).fillColor(TEXT_BLACK);
              doc.text(`${subKey})`, toPt(subX + 2.5), toPt(item.trueOption.yMm - 2.5), {
                width: toPt(6),
                align: "left",
              });

              // Đúng bubble
              doc.circle(toPt(item.trueOption.xMm), toPt(item.trueOption.yMm), toPt(item.trueOption.radiusMm))
                .lineWidth(0.5).strokeColor(THEME_PINK).stroke();

              // Sai bubble
              doc.circle(toPt(item.falseOption.xMm), toPt(item.falseOption.yMm), toPt(item.falseOption.radiusMm))
                .lineWidth(0.5).strokeColor(THEME_PINK).stroke();
            }
          }
        }
        doc.restore();

        // 7. PHẦN III: Trắc nghiệm trả lời ngắn (6 câu)
        doc.save();
        doc.font(fontBold).fontSize(8.5).fillColor(TEXT_BLACK);
        doc.text("PHẦN III", toPt(14.0), toPt(188.5));

        const p3BoxX = [14.0, 44.2, 74.4, 104.6, 134.8, 165.0];
        const p3Width = 28.5;
        const p3Height = 68.0;

        for (let qIdx = 0; qIdx < 6; qIdx++) {
          const bx = p3BoxX[qIdx];
          doc.rect(toPt(bx), toPt(193.5), toPt(p3Width), toPt(p3Height))
            .lineWidth(0.6).strokeColor(THEME_PINK).stroke();
        }

        if (page.part3) {
          for (const q of page.part3) {
            const bx = q.boxX;
            doc.font(fontBold).fontSize(6.5).fillColor(TEXT_BLACK);
            doc.text(`Câu ${q.questionNumber}`, toPt(bx), toPt(194.5), {
              width: toPt(q.boxWidth),
              align: "center",
            });

            // Minus row
            doc.font(fontRegular).fontSize(6.5).fillColor(THEME_PINK);
            doc.text("-", toPt(bx + 3.0), toPt(q.minusBubble.yMm - 3.5), { width: toPt(4), align: "center" });
            doc.circle(toPt(q.minusBubble.xMm), toPt(q.minusBubble.yMm), toPt(q.minusBubble.radiusMm))
              .lineWidth(0.5).strokeColor(THEME_PINK).stroke();

            // Comma row
            doc.font(fontBold).fontSize(6.5).fillColor(THEME_PINK);
            doc.text(",", toPt(bx + 3.0), toPt(q.commaBubbles[0].yMm - 4.0), { width: toPt(4), align: "center" });
            for (const cb of q.commaBubbles) {
              doc.circle(toPt(cb.xMm), toPt(cb.yMm), toPt(cb.radiusMm))
                .lineWidth(0.5).strokeColor(THEME_PINK).stroke();
            }

            // Digit rows 0..9
            for (const dr of q.digitRows) {
              doc.font(fontRegular).fontSize(5.5).fillColor(THEME_PINK);
              const cy = dr.bubbles[0].yMm;
              doc.text(String(dr.digit), toPt(bx + 3.0), toPt(cy - 2.8), { width: toPt(4), align: "center" });
              for (const db of dr.bubbles) {
                doc.circle(toPt(db.xMm), toPt(db.yMm), toPt(db.radiusMm))
                  .lineWidth(0.5).strokeColor(THEME_PINK).stroke();
              }
            }
          }
        }
        doc.restore();

        // 8. Draw QR Code (Positioned cleanly at bottom right footer margin)
        if (page.qr && page.qr.payload) {
          const qrBuffer = await QRCode.toBuffer(JSON.stringify(page.qr.payload), {
            errorCorrectionLevel: "M",
            type: "png",
            margin: 2,
            width: 200,
          });
          doc.image(qrBuffer, toPt(page.qr.xMm), toPt(page.qr.yMm), {
            width: toPt(page.qr.sizeMm),
            height: toPt(page.qr.sizeMm),
          });
        }

        // 9. Footer Note
        doc.save();
        doc.font(fontRegular).fontSize(6.5).fillColor("#777777");
        doc.text(
          "DigitalExamGrading OMR - Mẫu phiếu trả lời trắc nghiệm chuẩn Bộ Giáo dục & Đào tạo (GDPT 2018)",
          toPt(14.0),
          toPt(269.0),
          { width: toPt(160.0), align: "left" }
        );
        doc.restore();
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}