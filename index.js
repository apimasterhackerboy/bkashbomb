const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Helper function to validate phone number (Bangladesh)
const validatePhoneNumber = (phoneNo) => {
    const regex = /^01[3-9]\d{8}$/;
    return regex.test(phoneNo);
};

// Helper function to call the first API
const callFirstAPI = async () => {
    try {
        const response = await axios.get('https://myairtel.robi.com.bd/api/v2/bkash_direct_charge/prepare', {
            headers: {
                'User-Agent': 'okhttp/4.12.0',
                'Connection': 'Keep-Alive',
                'Accept-Encoding': 'gzip',
                'token': 'eyJhbGciOiJIUzI1NiJ9.eyJwYXlsb2FkIjp7IjAxNjgzODZjMTIzZWRiMmI2NTRjMTk5NDA0ZDMyNzE4IjoiNjIwNzRjNWU0ZDZlOGU3ZWU3MzdhMTNiNTQ0OTY4ZjIiLCIzNGE2ZTVkNjRhZGUxN2VmNGU1MTYxMmM1MGRkNzJmNSI6ImMzMWIzMjM2NGNlMTljYThmY2QxNTBhNDE3ZWNjZTU4In0sImNyZWF0ZV90aW1lIjoiMjAyNS0wMi0yNSAxMDoxNjoyNiArMDYwMCJ9.-sX0bHNjn5HRtqtvN2DN8sJ9SSeF7GEI9f6kGG91dcM',
                'platform': 'android',
                'appname': 'airtel',
                'locale': 'bn',
                'appversion': '7006004',
                'deviceid': 'YOUR_DEVICE_ID',
                'Cookie': 'BIGipServerpool_myairtel_robi_com_bd=!EcpcJt9C2p/auuIVI/0fQakxcR7nTVVcc2hgm4FojMpUyA0KVba62Krfo/Yxnff7vv5MSKVzDGWpMGU=; TS01a382c8=010187030919898f93310adfd48bff002e8f99d5498f8bd944aaefed9b5e323127a850213011243b9ae579957a9b533772d01e1025'
            }
        });
        return response.data;
    } catch (error) {
        return { error: `❌ Axios Error: ${error.message}` };
    }
};

// Helper function to call the second API
const callSecondAPI = async (phoneNo, hashCode, redirectUri) => {
    try {
        const response = await axios.post('https://directcharge.pay.bka.sh/capabilitycore/portal/verifyAccount', {
            authClientId: 'super_local',
            otp: '',
            phoneNo: phoneNo,
            pin: '',
            hashCode: hashCode,
            redirectUri: redirectUri
        }, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 9; Pixel 4 Build/PQ3A.190801.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/81.0.4044.117 Mobile Safari/537.36',
                'Accept': 'application/json, text/javascript, */*',
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        return { error: `❌ Axios Error: ${error.message}` };
    }
};

// Helper function to parse URL query parameters
const parseQueryParams = (url) => {
    const query = new URL(url).searchParams;
    return {
        hashCode: query.get('hashCode'),
        redirectUri: query.get('redirectUri')
    };
};

// Main GET endpoint
app.get('/api', async (req, res) => {
    const { phoneNo, amount } = req.query;

    // Check if parameters exist
    if (!phoneNo || !amount) {
        return res.json({ error: '❌ Missing parameters! Please provide phone number & amount.' });
    }

    const trimmedPhoneNo = phoneNo.trim();
    const parsedAmount = parseInt(amount);

    // Validate Phone Number (Bangladesh)
    if (!validatePhoneNumber(trimmedPhoneNo)) {
        return res.json({ error: '❌ Invalid phone number! Please remove +880.' });
    }

    // Validate Amount
    if (parsedAmount < 1 || parsedAmount > 10) {
        return res.json({ error: '❌ Amount should be between 1 and 10.' });
    }

    // STEP 1: Call First API to Get hashCode & redirectUri
    const firstApiResponse = await callFirstAPI();

    if (firstApiResponse.error) {
        return res.json({ error: '❌ First API Failed!', details: firstApiResponse.error });
    }

    if (!firstApiResponse.payment_url) {
        return res.json({ error: '❌ Payment URL Not Found!' });
    }

    const { hashCode, redirectUri } = parseQueryParams(firstApiResponse.payment_url);
    if (!hashCode || !redirectUri) {
        return res.json({ error: '❌ hashCode & redirectUri missing in response!' });
    }

    // STEP 2: Call Second API Multiple Times Based on Amount
    const responses = [];
    for (let i = 0; i < parsedAmount; i++) {
        responses.push(await callSecondAPI(trimmedPhoneNo, hashCode, redirectUri));
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    }

    res.json({ status: '✅ Success!', responses });
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
