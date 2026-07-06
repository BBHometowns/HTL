const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { GoogleAuth } = require("google-auth-library");
const { google } = require("googleapis");

// Reference the secret we stored
const SERVICE_ACCOUNT_KEY = defineSecret("GOOGLE_SERVICE_ACCOUNT_KEY");

// Your Google Sheet ID
const SHEET_ID = "1EN3FSORt1A0TKcHcnaz62CDF0rdGABVGG_2IuYEja7o";

exports.markQuestionUsed = onRequest(
    { secrets: [SERVICE_ACCOUNT_KEY], cors: true },
    async (req, res) => {
        try {
            // Only allow POST requests
            if (req.method !== "POST") {
                return res.status(405).json({ error: "Method not allowed" });
            }

            // Get the data sent from the game
            const { tabName, row, col, matchName } = req.body;

            if (!tabName || (!row && !col) || !matchName) {
                return res.status(400).json({ error: "Missing required fields" });
            }

            // Build the "Last Used" stamp
            const now = new Date();
            const easternDate = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/New_York',
                month: '2-digit',
                day: '2-digit'
            }).formatToParts(now);
            const month = easternDate.find(p => p.type === 'month').value;
            const day = easternDate.find(p => p.type === 'day').value;
            const dateStamp = `${month}.${day}`;

            // Authenticate using the Service Account
            const keyFile = JSON.parse(SERVICE_ACCOUNT_KEY.value());
            const auth = new GoogleAuth({
                credentials: keyFile,
                scopes: ["https://www.googleapis.com/auth/spreadsheets"],
            });

            const sheets = google.sheets({ version: "v4", auth });

            // Build the cell range to write to
            // For Closest To: col C (column 3), specific row
            // For Shootout: row 2, specific column
            let range;
            if (row) {
                // Closest To - write to column C of the given row
                range = `${tabName}!C${row}`;
            } else {
                // Shootout - write to row 2 of the given column
                const colLetter = String.fromCharCode(65 + col); // 0=A, 1=B, etc.
                range = `${tabName}!${colLetter}2`;
            }

            // Write to the Sheet
            await sheets.spreadsheets.values.update({
                spreadsheetId: SHEET_ID,
                range: range,
                valueInputOption: "RAW",
                requestBody: {
                    values: [[usedStamp]],
                },
            });

            return res.status(200).json({ 
                success: true, 
                message: `Marked ${range} as used: ${usedStamp}` 
            });

        } catch (error) {
            console.error("Error marking question as used:", error);
            return res.status(500).json({ error: error.message });
        }
    }
);