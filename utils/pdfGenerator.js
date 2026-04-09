const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const generateCertificate = (data, outputDest) => {
    return new Promise((resolve, reject) => {
        try {
            const width = 841.89;
            const height = 595.28;

            const doc = new PDFDocument({
                size: [width, height],
                margin: 0,
            });

            let stream;
            if (typeof outputDest === "string") {
                const dir = path.dirname(outputDest);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                stream = fs.createWriteStream(outputDest);
            } else {
                stream = outputDest;
            }

            doc.pipe(stream);

            const { studentName, courseName, certificateNumber, issueDate, content } = data;

            // Background
            const bgPath = path.join(__dirname, "../certificate.png");
            if (fs.existsSync(bgPath)) {
                doc.image(bgPath, 0, 0, { width, height });
            }

            // Colors
            const primaryColor = "#1c4587";
            const secondaryColor = "#e69138";
            const textColor = "#333333";
            const labelColor = "#000000";

            // ── HEADER (Top Left & Right) ──
            const headerY = 70; // slightly top
            const marginX = 25;

            // LEFT - Date
            doc.font("Helvetica-Bold").fontSize(11).fillColor(labelColor);
            doc.text(`Date of Issue: ${issueDate}`, marginX, headerY);

            // RIGHT - Certificate ID
            const idText = `Certificate ID: ${certificateNumber}`;
            const idWidth = doc.widthOfString(idText);

            doc.text(idText, width - marginX - idWidth, headerY);

            // ── CENTER CONTENT (Moved Up) ──
            const centerX = 0;
            const contentWidth = width;

            // CERTIFICATE (moved UP)
            doc.font("Times-Bold").fontSize(48).fillColor(primaryColor);
            doc.text("CERTIFICATE", centerX, 105, {
                align: "center",
                width: contentWidth,
            });

            // OF EXCELLENCE
            doc.font("Times-Bold").fontSize(20).fillColor(textColor);
            doc.text("OF EXCELLENCE", centerX, 155, {
                align: "center",
                width: contentWidth,
            });

            // Award line
            doc.font("Helvetica-Bold").fontSize(14).fillColor(primaryColor);
            doc.text("THIS CERTIFICATE IS AWARDED TO", centerX, 190, {
                align: "center",
                width: contentWidth,
            });

            // NAME (slightly up)
            doc.font("Times-Bold").fontSize(46).fillColor(labelColor);
            doc.text(studentName.toUpperCase(), centerX, 220, {
                align: "center",
                width: contentWidth,
            });

            // Sub text
            doc.font("Helvetica").fontSize(14).fillColor(textColor);
            doc.text("For successfully completing training on", centerX, 270, {
                align: "center",
                width: contentWidth,
            });

            // COURSE NAME (slightly up)
            doc.font("Times-Bold").fontSize(34).fillColor(secondaryColor);
            doc.text(courseName.toUpperCase(), centerX, 310, {
                align: "center",
                width: contentWidth,
            });

            // ✅ FIXED: Reduced gap + Increased font size
            if (content && content.length > 5) {
                doc.font("Times-Roman").fontSize(15).fillColor("#555555");
                doc.text(content, 140, 355, {
                    align: "center",
                    width: 600,
                    lineGap: 4, // tighter lines
                });
            }

            doc.end();

            if (typeof outputDest === "string") {
                stream.on("finish", () => resolve(outputDest));
                stream.on("error", reject);
            } else {
                resolve();
            }
        } catch (error) {
            reject(error);
        }
    });
};

module.exports = { generateCertificate };