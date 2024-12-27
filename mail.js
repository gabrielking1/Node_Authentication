import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url"; // Support for __dirname equivalent
import ejs from "ejs";

dotenv.config();

// Get __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create transport for nodemailer
const transport = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  secure: true, // Use true for SSL (port 465)
  auth: {
    user: process.env.MAIL_HOST_USER,
    pass: process.env.MAIL_HOST_PASSWORD,
  },
});

// Function to send email
export const sendMail = async (to, subject, templateData, pdfPath) => {
  try {
    // Define the path to the EJS template
    const templatePath = path.join(__dirname, "views", "email.ejs");

    // Render the email template with dynamic data
    const htmlContent = await ejs.renderFile(templatePath, templateData);

    // Send the email
    await transport.sendMail({
      from: process.env.DEFAULT_FROM_MAIL,
      to,
      subject,
      html: htmlContent, // Use the rendered HTML
      attachments: [
        {
          filename: "doulingo.pdf", // Attach the PDF file
          path: pdfPath,
        },
      ],
    });

    console.log("Email sent successfully!");
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

// Verify the SMTP connection
transport.verify((error, success) => {
  if (error) {
    console.error("SMTP connection error:", error);
  } else {
    console.log("SMTP connection successful:", success);
  }
});
