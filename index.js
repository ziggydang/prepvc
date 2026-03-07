const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURATION ---
const GEMINI_API_KEY = "AIzaSyDICDlk4jbOWpWNXAfQdkj_JF6uYFgJ0XM";
const BOT_TOKEN = "8623539499:AAEa8duJ5DYMGOItrq0VMMDo7ZBzELnJ72A";
const CHAT_ID = "7977257906";

const monthNames = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

// --- HELPERS ---

const isValid = (val) => {
    const invalid = [null, undefined, "", "NA", "0", 0, "NULL", "NAN", "_ _", "NOT AVAILABLE", "UNDEFINED", "NONE"];
    return val !== null && val !== undefined && !invalid.includes(String(val).trim().toUpperCase());
};

const validate = (val) => isValid(val) ? val : "_ _";

const formatToEnglishDate = (dateStr) => {
    if (!isValid(dateStr)) return "_ _";
    try {
        const separator = dateStr.includes('/') ? '/' : (dateStr.includes('-') ? '-' : ' ');
        const parts = dateStr.split(separator);
        if (parts.length < 3) return dateStr.toUpperCase();

        let day = String(parseInt(parts[0])).padStart(2,'0');
        let monthIdx = isNaN(parts[1])
            ? monthNames.indexOf(parts[1].toUpperCase().substring(0,3))
            : parseInt(parts[1]) - 1;

        let year = parts[2].length === 2 ? "20"+parts[2] : parts[2];

        return (monthIdx >= 0 && monthIdx <= 11)
            ? `${day}-${monthNames[monthIdx]}-${year}`
            : dateStr.toUpperCase();

    } catch (e) {
        return dateStr.toUpperCase();
    }
};

// --- ROUTE ---

app.get('/rc', async (req, res) => {

    const rawRegNo = req.query.id?.toUpperCase().replace(/\s/g,'');

    if (!rawRegNo) {
        return res.status(400).json({
            status: "Error",
            message: "ID Required"
        });
    }

    try {

        const apiUrl =
        `https://prevehicle-source-code-apix.onrender.com/rc?query=${rawRegNo}&key=preSENPAI_UNLIMITED_ADMIN&_=${Date.now()}`;

        const apiResponse = await axios.get(apiUrl,{
            timeout:25000
        });

        // Return everything from source API
        res.json(apiResponse.data);

    } catch (error) {

        console.error("API Error:",error.message);

        res.status(500).json({
            status:"Error",
            message:"Source API failed"
        });

    }

});

app.listen(PORT, () =>
console.log(`🚗 RC API running at http://localhost:${PORT}/rc?id=PB13BU4064`)
);
