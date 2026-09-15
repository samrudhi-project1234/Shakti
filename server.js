require("dotenv").config();

const express = require("express");
const twilio = require("twilio");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "50kb" }));

// Serve your existing index.html
app.use(express.static(__dirname));

function validPhone(phone) {
    return /^\+[1-9]\d{7,14}$/.test(phone);
}

app.post("/api/send-emergency", async (req, res) => {

    try {

        const { contacts, message } = req.body || {};

        // Check contacts
        if (!Array.isArray(contacts) || contacts.length === 0) {

            return res.status(400).json({
                ok: false,
                error: "Add at least one emergency contact."
            });

        }

        // Check Twilio configuration
        if (
            !process.env.TWILIO_ACCOUNT_SID ||
            !process.env.TWILIO_AUTH_TOKEN ||
            !process.env.TWILIO_PHONE_NUMBER
        ) {

            return res.status(500).json({
                ok: false,
                error: "Twilio is not configured on the server."
            });

        }

        // Get unique phone numbers
        const numbers = [
            ...new Set(
                contacts
                    .map(contact => String(contact.phone || "").trim())
                    .filter(Boolean)
            )
        ];

        // Validate phone numbers
        const invalidNumbers = numbers.filter(
            number => !validPhone(number)
        );

        if (invalidNumbers.length > 0) {

            return res.status(400).json({
                ok: false,
                error:
                    "Use international phone format, for example +919876543210."
            });

        }

        // Create Twilio client
        const client = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
        );

        const results = [];

        // Send SMS to every emergency contact
        for (const number of numbers) {

            try {

                const sms = await client.messages.create({

                    body:
                        String(message ||
                        "🚨 SHAKTI SHIELD EMERGENCY\n\nEmergency assistance has been requested. Please contact the user immediately."),

                    from:
                        process.env.TWILIO_PHONE_NUMBER,

                    to: number

                });

                results.push({

                    phone: number,

                    success: true,

                    sid: sms.sid,

                    status: sms.status

                });

            }

            catch (error) {

                console.error(
                    `SMS failed for ${number}:`,
                    error.message
                );

                results.push({

                    phone: number,

                    success: false,

                    error: error.message

                });

            }

        }

        const successful =
            results.filter(
                result => result.success
            ).length;

        return res.json({

            ok: successful > 0,

            sent: successful,

            total: results.length,

            results

        });

    }

    catch (error) {

        console.error(
            "Emergency SMS error:",
            error
        );

        return res.status(500).json({

            ok: false,

            error: "Emergency SMS service error."

        });

    }

});


// Open index.html
app.get("/", (req, res) => {

    res.sendFile(
        path.join(__dirname, "index.html")
    );

});


app.listen(PORT, () => {

    console.log(
        `Shakti Shield server running on port ${PORT}`
    );

});
