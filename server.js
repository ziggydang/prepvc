const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURATION ---
const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// Realistic User-Agents (2026-era mix)
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.3800.97',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',
  'Mozilla/5.0 (Linux; Android 14; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.7632.160 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
];

const acceptLanguages = [
  'en-US,en;q=0.9',
  'en-GB,en;q=0.8',
  'de-DE,de;q=0.9,en;q=0.8',
  'fr-FR,fr;q=0.9,en;q=0.8',
];

// Pick random item from array
const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

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
    let day = String(parseInt(parts[0])).padStart(2, '0');
    let monthIdx = isNaN(parts[1])
      ? monthNames.indexOf(parts[1].toUpperCase().substring(0, 3))
      : parseInt(parts[1]) - 1;
    let year = parts[2].length === 2 ? "20" + parts[2] : parts[2];
    return (monthIdx >= 0 && monthIdx <= 11)
      ? `${day}-${monthNames[monthIdx]}-${year}`
      : dateStr.toUpperCase();
  } catch (e) {
    return dateStr.toUpperCase();
  }
};

// --- ROUTE ---
app.get('/rc', async (req, res) => {
  const rawRegNo = req.query.query?.toUpperCase().replace(/\s/g, '');
  
  if (!rawRegNo) {
    return res.status(400).json({
      status: "Error",
      message: "Query parameter 'query' is required (example: ?query=PB13BU4064)"
    });
  }

  try {
    const apiUrl = `https://prevehicle-source-code-apix.onrender.com/rc?query=${rawRegNo}&key=preSENPAI_UNLIMITED_ADMIN&_=${Date.now()}`;

    // Rotate headers for each request
    const config = {
      timeout: 25000,
      headers: {
        'User-Agent': getRandom(userAgents),
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': getRandom(acceptLanguages),
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Referer': 'https://www.google.com/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
      },
    };

    const apiResponse = await axios.get(apiUrl, config);

    // Forward the response from the source API
    res.json(apiResponse.data);
  } catch (error) {
    console.error("API Error:", error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
    }
    res.status(500).json({
      status: "Error",
      message: "Source API failed",
      details: error.message
    });
  }
});

app.listen(PORT, () =>
  console.log(`🚗 RC API running at http://localhost:${PORT}/rc?query=PB13BU4064`)
);
