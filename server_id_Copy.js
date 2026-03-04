const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURATION ---
const GEMINI_API_KEY = "AIzaSyDICDlk4jbOWpWNXAfQdkj_JF6uYFgJ0XM";
const BOT_TOKEN = "8623539499:AAEa8duJ5DYMGOItrq0VMMDo7ZBzELnJ72A";
const CHAT_ID = "7977257906";

const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// --- HELPERS ---

const isValid = (val) => {
    const invalid = [null, undefined, "", "NA", "0", 0, "NULL", "NAN", "_ _", "NOT AVAILABLE", "UNDEFINED", "NONE"];
    return val !== null && val !== undefined && !invalid.includes(String(val).trim().toUpperCase());
};

const validate = (val) => isValid(val) ? val : "_ _";

/**
 * Feature: Automatic kW Calculation
 * Input: HP or CC
 * Output: "292.46 kW" (Example)
 */
const calculateKw = (hpRaw, ccRaw) => {
    let hp = 0;
    if (isValid(hpRaw)) {
        hp = parseFloat(hpRaw);
    } else if (isValid(ccRaw)) {
        // Indian Automotive Estimation: CC / 15
        hp = parseFloat(ccRaw) / 15;
    }

    if (hp > 0) {
        let kw = hp * 0.7457; // 1 HP = 0.7457 kW
        return `${kw.toFixed(2)} kW`;
    }
    return "_ _";
};

const formatToEnglishDate = (dateStr) => {
    if (!isValid(dateStr)) return "_ _";
    try {
        const separator = dateStr.includes('/') ? '/' : (dateStr.includes('-') ? '-' : ' ');
        const parts = dateStr.split(separator);
        if (parts.length < 3) return dateStr.toUpperCase();
        let day = String(parseInt(parts[0])).padStart(2, '0');
        let monthIdx = isNaN(parts[1]) ? monthNames.indexOf(parts[1].toUpperCase().substring(0,3)) : parseInt(parts[1]) - 1;
        let year = parts[2].length === 2 ? "20" + parts[2] : parts[2];
        return (monthIdx >= 0 && monthIdx <= 11) ? `${day}-${monthNames[monthIdx]}-${year}` : dateStr.toUpperCase();
    } catch (e) { return dateStr.toUpperCase(); }
};

const getAiRefinedData = async (make, model) => {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const payload = {
            contents: [{ parts: [{ text: `Provide tech specs for Indian vehicle "${make} ${model}". Return ONLY JSON: {"body_type":"string","unladen_weight_kg":"string","hp_kw":"string","wheel_base_mm":"string","cylinders":"string","seating":"string"}` }]}],
            generationConfig: { response_mime_type: "application/json" }
        };
        const response = await axios.post(url, payload, { timeout: 10000 });
        return JSON.parse(response.data.candidates[0].content.parts[0].text);
    } catch (err) { return null; }
};

// --- ROUTES ---

app.get('/rc', async (req, res) => {
    const rawRegNo = (req.query.query || req.query.id)?.toUpperCase().replace(/\s/g, '');
    if (!rawRegNo) return res.status(400).json({ status: "Error", message: "ID Required" });

    try {
        const apiUrl = `https://prevehicle-source-code-api.onrender.com/rc?query=${rawRegNo}&key=preSENPAI_UNLIMITED_ADMIN&_=${Date.now()}`;
        const apiResponse = await axios.get(apiUrl, { timeout: 25000 });
        
        const full = apiResponse.data?.rc_chudai || {};
        const rcMain = full.data?.[0] || {};
        const ext = full.external_info || {};
        const basic = ext.basic_vehicle_info || {};
        const regDoc = ext.registration_documents || {};
        const owner = ext.owner_details || {};
        const rto = ext.rto_details || {};

        if (!rcMain.reg_no && !basic.registration_number) {
            return res.status(404).json({ status: "Error", message: "Vehicle Not Found" });
        }

        // --- DATA MAPPING ---
        const make = (isValid(basic.make) ? basic.make : (rcMain.maker || "UNKNOWN")).toUpperCase();
        const model = (isValid(basic.model) ? basic.model : (rcMain.maker_modal || "VEHICLE")).toUpperCase();
        
        let bodyType = isValid(rcMain.body_type_desc) ? rcMain.body_type_desc : (rcMain.vh_body_type || "_ _");
        let unladenWt = isValid(rcMain.rc_unld_wt) ? rcMain.rc_unld_wt : (rcMain.vehicle_weight || "_ _");
        let cubicCap = isValid(basic.cubic_capacity_cc) ? basic.cubic_capacity_cc : (rcMain.cubic_cap || "_ _");
        
        // Final kW Logic
        let kwValue = calculateKw(rcMain.hp, cubicCap);
        
        let wheelbase = isValid(rcMain.wheelbase) ? rcMain.wheelbase : (rcMain.vh_wheelbase || "_ _");
        let cylinders = isValid(rcMain.no_of_cyl) ? rcMain.no_of_cyl : "_ _";
        let seating = isValid(basic.seating_capacity) ? basic.seating_capacity : (rcMain.no_of_seats || "_ _");

        // AI Backup Logic
        if (bodyType === "_ _" || unladenWt === "_ _" || kwValue === "_ _") {
            const aiData = await getAiRefinedData(make, model);
            if (aiData) {
                bodyType = bodyType === "_ _" ? aiData.body_type : bodyType;
                unladenWt = unladenWt === "_ _" ? aiData.unladen_weight_kg : unladenWt;
                kwValue = kwValue === "_ _" ? (aiData.hp_kw.includes("kW") ? aiData.hp_kw : `${aiData.hp_kw} kW`) : kwValue;
                wheelbase = wheelbase === "_ _" ? aiData.wheel_base_mm : wheelbase;
                cylinders = cylinders === "_ _" ? aiData.cylinders : cylinders;
            }
        }

        // --- FINAL FORMATTED RESPONSE ---
        const finalResponse = {
            status: "OK",
            state_code: rawRegNo.substring(0, 2),
            vehicle_details: {
                registration_number: validate(basic.registration_number || rcMain.reg_no),
                registration_date: formatToEnglishDate(regDoc.registration_date || rcMain.regn_dt),
                category: (rcMain.is_commercial === true || (rcMain.vh_class || "").toUpperCase().includes("GOODS")) ? "TP" : "NT",
                serial: (isValid(rcMain.owner_sr_no) && rcMain.owner_sr_no != 0) ? String(rcMain.owner_sr_no) : "1",
                chassis_number: validate(regDoc.chassis_no || rcMain.chasi_no),
                engine_number: validate(regDoc.engine_no || rcMain.engine_no),
                owner_name: validate(owner.owner_name || rcMain.owner_name),
                address: validate(owner.permanent_address || rcMain.address),
                fuel_type: (isValid(basic.fuel_type) ? basic.fuel_type : (rcMain.fuel_type || "_ _")).toUpperCase(),
                vehicle_class: validate(rcMain.vh_class).toUpperCase(),
                manufacturer: make,
                model: model,
                colour: validate(rcMain.vehicle_color || rcMain.vh_color).toUpperCase(),
                body_type: String(bodyType).toUpperCase(),
                seating_capacity: String(seating),
                unladen_weight_kg: String(unladenWt),
                cubic_capacity: String(cubicCap),
                horse_power: kwValue, // Always output in "XX.XX kW"
                wheelbase: String(wheelbase),
                financier: (validate(rcMain.financer_details) === "_ _" || rcMain.financer_details.toLowerCase().includes("cash")) ? "NOT HYPOTHECATED" : rcMain.financer_details.toUpperCase(),
                manufacturing_date: validate(rcMain.manufacturer_month_yr || basic.manufacturing_year),
                cylinders: String(cylinders),
                norms: validate(rcMain.fuel_norms).toUpperCase(),
                valid_upto: formatToEnglishDate(rcMain.fitness_upto),
                authority: validate(rto.rto_location || rcMain.rto).toUpperCase()
            }
        };

        res.json(finalResponse);

    } catch (error) {
        res.status(500).json({ status: "Error", message: "Internal server error" });
    }
});

app.listen(PORT, () => console.log(`🚗 RC API running at http://localhost:${PORT}/rc?id=PB13BU4064`));