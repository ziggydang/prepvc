const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const FormData = require("form-data");

const app = express();
const PORT = process.env.PORT || 3000;

const AES_KEY = "RTO@N@1V@$U2024#";

const AES_ALGORITHM = "aes-128-ecb";
const INPUT_ENCODING = "utf8";
const OUTPUT_ENCODING = "base64";

const CUSTOM_RESPONSE_MESSAGE = "Fetched [ SENPAI ]";

const CARS24_CONFIG = {
  BASE_URL: "https://seller-lead.cars24.team",
  AUTH_HEADER: "Basic ",
  PVT_AUTH_HEADER: "Bearer ",
  PHONE_NUMBER: "",
  USER_ID: ""
};

function encrypt(plaintext, key) {
  const keyBuffer = Buffer.from(key, INPUT_ENCODING);
  const cipher = crypto.createCipheriv(AES_ALGORITHM, keyBuffer, null);
  cipher.setAutoPadding(true);
  let encrypted = cipher.update(plaintext, INPUT_ENCODING, OUTPUT_ENCODING);
  encrypted += cipher.final(OUTPUT_ENCODING);
  return encrypted;
}

function decrypt(ciphertextBase64, key) {
  try {
    const keyBuffer = Buffer.from(key, INPUT_ENCODING);
    const decipher = crypto.createDecipheriv(AES_ALGORITHM, keyBuffer, null);
    decipher.setAutoPadding(true);
    let decrypted = decipher.update(ciphertextBase64, OUTPUT_ENCODING, INPUT_ENCODING);
    decrypted += decipher.final(INPUT_ENCODING);
    return decrypted;
  } catch (error) {
    console.error("❌ Decryption error:", error.message);
    return null;
  }
}

async function getUnmaskedData(rcNumber) {
  try {
    const { data } = await axios.get(`http://147.93.27.177:3000/rc?search=${rcNumber}`);
    if (data.code === "SUCCESS" && data.data) {
      return {
        owner_name: data.data.registration_details?.owner_name,
        father_name: data.data.ownership_details?.father_name,
        vehicle_age: data.data.important_dates?.vehicle_age
      };
    }
    return null;
  } catch (error) {
    console.warn("⚠️ Unmasked API failed:", error.message);
    return null;
  }
}

async function getChallanInfo(rcNumber) {
  try {
    console.log(`🚓 Fetching challan info for: ${rcNumber}`);

    const leadData = {
      phone: CARS24_CONFIG.PHONE_NUMBER,
      vehicle_reg_no: rcNumber,
      user_id: CARS24_CONFIG.USER_ID,
      whatsapp_consent: true,
      type: "challan",
      device_category: "Mweb"
    };

    const leadResponse = await axios.post(
      `${CARS24_CONFIG.BASE_URL}/prospect/lead`,
      leadData,
      {
        headers: {
          'authority': 'seller-lead.cars24.team',
          'accept': 'application/json, text/plain, */*',
          'authorization': CARS24_CONFIG.AUTH_HEADER,
          'content-type': 'application/json',
          'origin': 'https://www.cars24.com',
          'pvtauthorization': CARS24_CONFIG.PVT_AUTH_HEADER,
          'referer': 'https://www.cars24.com/',
          'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
        }
      }
    );

    if (!leadResponse.data.success) {
      console.warn("⚠️ Failed to create lead:", leadResponse.data.message);
      return null;
    }

    const token = leadResponse.data.detail.token;
    console.log(`✅ Lead created successfully, token: ${token}`);

    const challanResponse = await axios.get(
      `${CARS24_CONFIG.BASE_URL}/challan/list/${token}`,
      {
        headers: {
          'authority': 'seller-lead.cars24.team',
          'accept': 'application/json, text/plain, */*',
          'authorization': CARS24_CONFIG.AUTH_HEADER,
          'device_category': 'm-web',
          'origin': 'https://www.cars24.com',
          'origin_source': 'c2b-website',
          'platform': 'Challan',
          'pvtauthorization': CARS24_CONFIG.PVT_AUTH_HEADER,
          'referer': 'https://www.cars24.com/',
          'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
        }
      }
    );

    if (challanResponse.data.status === 200) {
      console.log(`✅ Found challan data for ${rcNumber}`);
      return challanResponse.data.detail;
    } else {
      console.warn("⚠️ No challan data found or API error");
      return null;
    }

  } catch (error) {
    console.warn("⚠️ Challan API failed:", error.message);
    return null;
  }
}

function processChallanData(challanDetail) {
  if (!challanDetail) return null;

  const processed = {
    processing_status: challanDetail.processingStatus,
    total_online_amount: challanDetail.pendingChallans?.totalOnlineChallanAmount || 0,
    total_offline_amount: challanDetail.pendingChallans?.totalOfflineChallanAmount || 0,
    total_amount: (challanDetail.pendingChallans?.totalOnlineChallanAmount || 0) + 
                  (challanDetail.pendingChallans?.totalOfflineChallanAmount || 0),
    pending_challans: []
  };

  if (challanDetail.pendingChallans?.physicalCourtChallans) {
    challanDetail.pendingChallans.physicalCourtChallans.forEach(challan => {
      processed.pending_challans.push({
        challan_no: challan.challanNo,
        unique_id: challan.uniqueIdentifier,
        status: challan.status,
        computed_status: challan.computedStatus,
        offence_name: challan.offences?.[0]?.offenceName || "Unknown Offence",
        penalty_amount: challan.amount,
        date_time: challan.dateTime,
        location: challan.offenceLocation,
        state: challan.stateCd,
        court_type: challan.courtType,
        payment_status: challan.paymentStatus,
        pending_duration: challan.challanPendingFor,
        is_payable: challan.isPayable,
        challan_images: challan.challanImages || [],
        provider_type: challan.challanProviderSubType
      });
    });
  }

  if (challanDetail.pendingChallans?.virtualCourtChallans) {
    challanDetail.pendingChallans.virtualCourtChallans.forEach(challan => {
      processed.pending_challans.push({
        challan_no: challan.challanNo,
        unique_id: challan.uniqueIdentifier,
        status: challan.status,
        computed_status: challan.computedStatus,
        offence_name: challan.offences?.[0]?.offenceName || "Unknown Offence",
        penalty_amount: challan.amount,
        date_time: challan.dateTime,
        location: challan.offenceLocation,
        state: challan.stateCd,
        court_type: challan.courtType,
        payment_status: challan.paymentStatus,
        pending_duration: challan.challanPendingFor,
        is_payable: challan.isPayable,
        challan_images: challan.challanImages || [],
        provider_type: challan.challanProviderSubType
      });
    });
  }

  if (challanDetail.pendingChallans?.recentlyAddedChallans) {
    challanDetail.pendingChallans.recentlyAddedChallans.forEach(challan => {
      processed.pending_challans.push({
        challan_no: challan.challanNo,
        unique_id: challan.uniqueIdentifier,
        status: challan.status,
        computed_status: challan.computedStatus,
        offence_name: challan.offences?.[0]?.offenceName || "Unknown Offence",
        penalty_amount: challan.amount,
        date_time: challan.dateTime,
        location: challan.offenceLocation,
        state: challan.stateCd,
        court_type: challan.courtType,
        payment_status: challan.paymentStatus,
        pending_duration: challan.challanPendingFor,
        is_payable: challan.isPayable,
        challan_images: challan.challanImages || [],
        provider_type: challan.challanProviderSubType
      });
    });
  }

  processed.pending_challans.sort((a, b) => new Date(b.date_time) - new Date(a.date_time));

  return processed;
}

function formatChallanResponse(processedChallanInfo) {
  if (!processedChallanInfo) {
    return {
      status: false,
      response_code: 404,
      response_message: "No challan information available",
      data: []
    };
  }

  return {
    status: true,
    response_code: 200,
    response_message: "Challan information fetched successfully",
    data: [processedChallanInfo]
  };
}

function mergeRcData(originalData, unmaskedData) {
  if (!originalData.data || !Array.isArray(originalData.data) || originalData.data.length === 0) {
    return originalData;
  }

  const mergedData = { ...originalData };
  const rcItem = { ...mergedData.data[0] };

  if (unmaskedData) {
    if (unmaskedData.owner_name && rcItem.owner_name && rcItem.owner_name.includes('*')) {
      console.log(`🔄 Replacing owner_name: ${rcItem.owner_name} → ${unmaskedData.owner_name}`);
      rcItem.owner_name = unmaskedData.owner_name;
    }

    if (unmaskedData.father_name && rcItem.father_name && rcItem.father_name.includes('*')) {
      console.log(`🔄 Replacing father_name: ${rcItem.father_name} → ${unmaskedData.father_name}`);
      rcItem.father_name = unmaskedData.father_name;
    }

    if (unmaskedData.vehicle_age) {
      console.log(`🔄 Adding vehicle_age: ${unmaskedData.vehicle_age}`);
      rcItem.vehicle_age = unmaskedData.vehicle_age;
    } else if (!rcItem.vehicle_age) {
      console.log(`ℹ️ No vehicle_age available from unmasked API`);
    }
  }

  mergedData.response_message = CUSTOM_RESPONSE_MESSAGE;
  console.log(`✅ Response message set to: "${CUSTOM_RESPONSE_MESSAGE}"`);

  mergedData.data = [rcItem];
  return mergedData;
}

function decryptApiResponse(encryptedResponse) {
  try {

    if (typeof encryptedResponse === 'string') {
      const decrypted = decrypt(encryptedResponse, AES_KEY);
      if (decrypted) {
        try {
          return JSON.parse(decrypted);
        } catch (parseError) {
          console.log("⚠️ Decrypted data is not JSON, returning as string");
          return decrypted;
        }
      }
    }

    return encryptedResponse;
  } catch (error) {
    console.error("❌ Response decryption error:", error.message);
    return encryptedResponse;
  }
}

app.get("/rc", async (req, res) => {
  const rc = req.query.query;

  if (!rc) {
    return res.status(400).json({
      status: false,
      message: "Missing query parameter. Example: /rc?query=UK04AQ9000",
    });
  }

  try {

    const [unmaskedData, challanDetail] = await Promise.all([
      getUnmaskedData(rc),
      getChallanInfo(rc)
    ]);

    const processedChallanInfo = processChallanData(challanDetail);

    const encryptedRc = encrypt(rc, AES_KEY);
    console.log(`🔐 Encrypted RC: ${encryptedRc}`);

    const formData = new FormData();

    formData.append('YLnoBJXFHWIb6n+vaU5Fqw===', 'hEetH/fxDYkaiPV1O08JXGavuWKAHB7H//KqlbPQizq1sxbHamO8edqhIcOJJybWVc4wf11tUxC1uEtwt2OHiKuzQ4fSmex9pkrf6bj/yztMQT9yb5+E3V3RttX0S1WRXRiNakRvo+pOiu6k8j8M+C6aLHvrWxqTQnP9ND0xv3EQyxcgjYt5rk2qVOWP+nf8');
    formData.append('uniDRnuJvTpCyd8qqa7bmg===', '6UcabyegT3XEmP2Mw0Jwfw==');
    formData.append('wmbVbuTELPkity3gk1FSLw===', 'hwc6sd9eQz3sd8aZ5tWtOSO9P/8c0ruHIRUDVqC4PzmK3ZgUJ5W/1ibrOgk6+bHhGaWCca3iQ6qfy5v/zhdLXw==');
    formData.append('kqvOc7zzeKL9GQi3s97hRg===', 'KOgloc/Wkh/JKFVr/Y5bZA==');
    formData.append('6itFonmUeG7GaEL8YAz1dw===', 'DHKgKTb0PD667WXK14bQxQ==');
    formData.append('gaQw08ye60GZvOaEjDxwSg===', '7Xx2UpV+mliqWirrrkrJ4A==');
    formData.append('KldjgNJiCoLPelKQK12wCg===', 'Wg4luew+ZNYaVLvuYevUwhJMt5Q0FwINOnT3ntNuXiM=');
    formData.append('8qv0XiLt71c2Mcb7A/0ETw===', '2femjV0XNiZlRIoza3rq/Q==');
    formData.append('zKMffadDKn74L6D8Erq/Ow===', 'HjCiWD0aGnOHqRk+sJhmSg==');
    formData.append('aQ1IgwRQsEsftk0pG3qVOA===', 'NDEpmB1IH3r0ZWPKlDX42g==');
    formData.append('kxBCVJqsDl1CnYYrPI+ESg===', '6UcabyegT3XEmP2Mw0Jwfw==');

    formData.append('4svShi1T5ftaZPNNHhJzig===', encryptedRc);

    formData.append('lES0BMK4Gbc62W3W5/cR3Q===', '6UcabyegT3XEmP2Mw0Jwfw==');
    formData.append('5ES5V9fBsVv2zixvup+QfGUYTXf6w2Wb7rfo1vbyiZo==', '6UcabyegT3XEmP2Mw0Jwfw==');
    formData.append('w0dcvRNvk81864M2TM1R4w===', '4n04akOAWVJ7qY7ccwxckA==');
    formData.append('Qh35ea+zP5C5YndUy+/5hQ===', 'Eky3lDQXAg06dPee025eIw==');
    formData.append('zdR9T9RDHgdRB7xdozvLRNUdr4dDNKvva1aeDyqC22ASTLeUNBcCDTp0957Tbl4j=', 'zeLxdIWt2S3VdsxhpTwY1A==');
    formData.append('eMY6P1CkF0Iya2o8nxqYGpW47fJY0qkIn/5knbV9Kos==', 'zeLxdIWt2S3VdsxhpTwY1A==');

    const { data } = await axios.post(
      "https://rcdetailsapi.vehicleinfo.app/api/vasu_rc_doc_details",
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'User-Agent': 'okhttp/5.0.0-alpha.11',
          'Accept-Encoding': 'gzip',
          'Content-Type': 'application/x-www-form-urlencoded',
          'authorization': '',
          'version_code': '13.39',
          'device_type': 'android'
        },
        http2: true
      }
    );

    let rc_xhudai = decryptApiResponse(data);
    console.log("🔓 Decrypted response type:", typeof rc_xhudai);

    if (rc_xhudai && typeof rc_xhudai === 'object') {
      rc_xhudai = mergeRcData(rc_xhudai, unmaskedData);
    }

    const response = {
      query: rc,
      rc_chudai: rc_xhudai,
      challan_info: formatChallanResponse(processedChallanInfo)
    };

    res.json(response);
  } catch (error) {
    console.error("❌ Request error:", error.message);
    res.status(500).json({
      status: false,
      message: "Failed to fetch RC details",
      error: error.response?.data || error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚗 RC API running at http://localhost:${PORT}/rc?query=UK04AQ9000`);
  console.log(`📝 Current response message: "${CUSTOM_RESPONSE_MESSAGE}"`);
  console.log(`🔐 Using new AES encryption with key: ${AES_KEY}`);
  console.log(`🚓 Challan information feature: ENABLED`);
});
