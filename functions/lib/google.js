"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calendarClient = calendarClient;
exports.docsClient = docsClient;
exports.driveClient = driveClient;
const dotenv_1 = __importDefault(require("dotenv"));
const googleapis_1 = require("googleapis");
dotenv_1.default.config();
const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
if (!clientEmail || !privateKey) {
    console.warn('Google service account env vars missing. API calls will fail until configured.');
}
function getAuth(scopes) {
    return new googleapis_1.google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes,
        subject: process.env.GOOGLE_IMPERSONATED_USER || undefined
    });
}
function calendarClient() {
    return googleapis_1.google.calendar({ version: 'v3', auth: getAuth(['https://www.googleapis.com/auth/calendar']) });
}
function docsClient() {
    return googleapis_1.google.docs({ version: 'v1', auth: getAuth([
            'https://www.googleapis.com/auth/documents',
            'https://www.googleapis.com/auth/drive'
        ]) });
}
function driveClient() {
    return googleapis_1.google.drive({ version: 'v3', auth: getAuth(['https://www.googleapis.com/auth/drive']) });
}
