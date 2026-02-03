const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5173', 'https://jk-backend-aj.vercel.app', 'https://godrejarden.in'],
    credentials: true
}));
app.use(express.json());

// Google Sheets setup - Update these for Godrej Arden
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = 'Godrej Arden Lead Sheet';

// Initialize Google Sheets API
const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Test Google Sheets connection
async function testConnection() {
    try {
        const sheets = google.sheets({ version: 'v4', auth });

        const response = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
        });

        console.log('✅ Connected to Google Sheets:', response.data.properties.title);
        return true;
    } catch (error) {
        console.error('❌ Google Sheets connection failed:', error.message);
        return false;
    }
}

// Prepare sheet with headers
async function prepareSheet() {
    try {
        const sheets = google.sheets({ version: 'v4', auth });

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A1:I1`,
        });

        if (!response.data.values) {
            const headers = [
                ['Timestamp', 'Name', 'Email', 'Phone', 'City', 'Details', 'Form Type', 'Source', 'Submission Time']
            ];

            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEET_NAME}!A1:I1`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: headers }
            });

            console.log('✅ Headers created in Google Sheet');
        } else {
            console.log('✅ Headers already exist in Google Sheet');
        }
    } catch (error) {
        console.error('❌ Error preparing sheet:', error.message);
    }
}

// API endpoint to submit form data
app.post('/api/submit-form', async (req, res) => {
    try {
        console.log('📥 Godrej Arden - Received form submission:', req.body);

        const {
            name,
            email,
            phone,
            city,
            details,
            formType = 'general',
            timestamp = new Date().toISOString(),
            source = 'website'
        } = req.body;

        // Validate required fields
        if (!name || !email || !phone) {
            return res.status(400).json({
                error: 'Please fill all required fields: Name, Email, Phone'
            });
        }

        // Validate phone number (10 digits)
        const cleanPhone = phone.toString().replace(/\D/g, '');
        if (cleanPhone.length !== 10) {
            return res.status(400).json({
                error: 'Phone number must be exactly 10 digits'
            });
        }

        // Validate email format
        const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                error: 'Please enter a valid email address'
            });
        }

        // Format data for Google Sheets
        const values = [[
            timestamp,
            name,
            email,
            cleanPhone,
            city || 'Not specified',
            details || '',
            formType,
            source,
            new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        ]];

        console.log('📝 Preparing to save to Google Sheets:', { name, email });

        // Append data to Google Sheet
        const sheets = google.sheets({ version: 'v4', auth });

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:I`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values },
        });

        console.log('✅ Data written to Google Sheets:', { name, email });

        // Return success response
        res.status(200).json({
            success: true,
            message: 'Form submitted successfully',
            data: {
                name,
                email,
                phone: cleanPhone,
                formType
            }
        });

    } catch (error) {
        console.error('❌ Error submitting form:', error);

        res.status(500).json({
            error: 'Failed to submit form. Please try again later.',
            details: error.message,
            code: error.code
        });
    }
});

// Test endpoint
app.get('/api/test', async (req, res) => {
    try {
        const sheets = google.sheets({ version: 'v4', auth });

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A1:I10`,
        });

        res.status(200).json({
            success: true,
            message: 'Google Sheets connection successful',
            data: response.data.values || []
        });
    } catch (error) {
        res.status(500).json({
            error: 'Google Sheets connection failed',
            details: error.message
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        project: 'Godrej Arden',
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// Get all submissions (for admin)
app.get('/api/submissions', async (req, res) => {
    try {
        const sheets = google.sheets({ version: 'v4', auth });

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:I`,
        });

        res.status(200).json({
            success: true,
            data: response.data.values || []
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch submissions',
            details: error.message
        });
    }
});

// Root endpoint
app.get('/', (req, res) => {
    res.status(200).json({
        project: 'Godrej Arden API',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            test: '/api/test',
            submit: '/api/submit-form (POST)',
            submissions: '/api/submissions'
        }
    });
});

// Start server
async function startServer() {
    const connected = await testConnection();

    if (connected) {
        await prepareSheet();

        app.listen(PORT, () => {
            console.log(`🚀 Godrej Arden Server running on port ${PORT}`);
            console.log(`📊 Google Sheet: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`);
            console.log(`🔗 Test API: http://localhost:${PORT}/api/test`);
            console.log(`🔗 Health: http://localhost:${PORT}/health`);
            console.log(`📝 Submit form: http://localhost:${PORT}/api/submit-form`);
        });
    } else {
        console.error('Cannot start server due to Google Sheets connection failure');
        process.exit(1);
    }
}

startServer();
