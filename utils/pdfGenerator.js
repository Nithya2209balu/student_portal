const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

/**
 * Generates a styled PDF certificate
 * @param {Object} data - Contains studentName, courseName, certificateNumber, issueDate, content, duration
 * @param {String} outputPath - Absolute or relative path where the PDF should be saved
 * @returns {Promise<String>} - The path of the saved file
 */
const generateCertificate = (data, outputPath) => {
    return new Promise((resolve, reject) => {
        try {
            // Ensure directory exists
            const dir = path.dirname(outputPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Create a document in Landscape mode
            const doc = new PDFDocument({
                size: "A4",
                layout: "landscape",
                margin: 0,
            });

            const stream = fs.createWriteStream(outputPath);
            doc.pipe(stream);

            const { studentName, courseName, certificateNumber, issueDate, content, duration } = data;

            // ── Background & Borders ──────────────────────────────────────────────────
            // Outer thick blue border
            doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40)
                .lineWidth(8)
                .stroke("#1c4587");

            // Inner thin golden border
            doc.rect(32, 32, doc.page.width - 64, doc.page.height - 64)
                .lineWidth(2)
                .stroke("#d4af37");

            // ── Header / Logos (Text alternative for logos) ───────────────────────────
            // Emulating the "BY8LABSAI" logo at the top center
            doc.font("Helvetica-Bold")
                .fontSize(32)
                .fillColor("#e69138")
                .text("<BY", 0, 60, { continued: true, align: "center" })
                .fillColor("#1c4587")
                .text("8LABSAI", { continued: true })
                .fillColor("#e69138")
                .text(">");
                
            doc.font("Helvetica")
                .fontSize(12)
                .fillColor("#1c4587")
                .text("Private Limited", 0, 95, { align: "center" });

            // Date of Issue (Top Left)
            doc.font("Helvetica-Bold")
                .fontSize(10)
                .fillColor("#333333")
                .text(`DATE OF ISSUE: ${issueDate}`, 50, 70);

            // Certificate ID (Top Right)
            doc.font("Helvetica-Bold")
                .fontSize(10)
                .text(`CERTIFICATE ID : ${certificateNumber}`, doc.page.width - 250, 70, {
                    width: 200,
                    align: "right",
                });

            // ── Main Titles ───────────────────────────────────────────────────────────
            doc.moveDown(3);
            doc.font("Times-Bold")
                .fontSize(48)
                .fillColor("#1c4587")
                .text("CERTIFICATE", { align: "center" });

            doc.moveDown(0.5);
            doc.font("Times-Roman")
                .fontSize(20)
                .fillColor("#333333")
                .text("OF EXCELLENCE", { align: "center" });

            doc.moveDown(1.5);
            doc.font("Helvetica-Bold")
                .fontSize(14)
                .fillColor("#1c4587")
                .text("THIS CERTIFICATE IS AWARDED TO", { align: "center" });

            // ── Student Name ──────────────────────────────────────────────────────────
            doc.moveDown(1);
            doc.font("Times-Bold")
                .fontSize(36)
                .fillColor("#000000")
                .text(studentName.toUpperCase(), { align: "center" });

            // ── Course Description ────────────────────────────────────────────────────
            doc.moveDown(1);
            doc.font("Times-Roman")
                .fontSize(16)
                .fillColor("#333333")
                .text("For successfully completing training on", { align: "center" });

            doc.moveDown(0.5);
            doc.font("Times-Bold")
                .fontSize(28)
                .fillColor("#333333")
                .text(courseName.toUpperCase(), { align: "center" });

            // Dynamic content text
            doc.moveDown(1);
            doc.font("Times-Roman")
                .fontSize(14)
                .fillColor("#555555")
                .text(content || `equipping him/her with the knowledge and skills required to master the same.`, {
                    align: "center",
                    width: 600,
                    columns: 1,
                }, doc.page.width / 2 - 300, doc.y);

            // ── Signatures ────────────────────────────────────────────────────────────
            const signatureY = doc.page.height - 120;

            // Signature 1 (CEO)
            doc.lineWidth(1)
                .strokeColor("#000000")
                .moveTo(100, signatureY)
                .lineTo(250, signatureY)
                .stroke();
            doc.font("Helvetica-Bold")
                .fontSize(12)
                .fillColor("#333333")
                .text("DINESH KUMAR", 100, signatureY + 10, { width: 150, align: "center" });
            doc.font("Helvetica")
                .fontSize(10)
                .fillColor("#666666")
                .text("CEO of By8labsAI", 100, signatureY + 25, { width: 150, align: "center" });

            // Signature 2 (HR)
            doc.lineWidth(1)
                .strokeColor("#000000")
                .moveTo(doc.page.width - 250, signatureY)
                .lineTo(doc.page.width - 100, signatureY)
                .stroke();
            doc.font("Helvetica-Bold")
                .fontSize(12)
                .fillColor("#333333")
                .text("NANCY", doc.page.width - 250, signatureY + 10, { width: 150, align: "center" });
            doc.font("Helvetica")
                .fontSize(10)
                .fillColor("#666666")
                .text("HR of By8labsAI", doc.page.width - 250, signatureY + 25, { width: 150, align: "center" });

            doc.end();

            stream.on("finish", () => resolve(outputPath));
            stream.on("error", (err) => reject(err));
        } catch (error) {
            reject(error);
        }
    });
};

module.exports = { generateCertificate };
