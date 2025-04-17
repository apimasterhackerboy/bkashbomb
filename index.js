const express = require('express');
const axios = require('axios');
require('dotenv').config(); // Add if using .env

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Proxy configuration
const proxyConfig = {
    host: '202.40.181.220',
    port: 31247
    // Add credentials if required:
    // auth: {
    //     username: 'your-username',
    //     password: 'your-password'
    // }
};

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
                'token': process.env.TOKEN || 'eyJhbGciOiJIUzI1NiJ9.eyJwYXlsb2FkIjp7IjAxNjgzODZjMTIzZWRiMmI2NTRjMTk5NDA0ZDMyNzE4IjoiNjIwNzRjNWU0ZDZlOGU3ZWU3MzdhMTNiNTQ0OTY4ZjIiLCIzNGE2ZTVkNjRhZGUxN2VmNGU1MTYxMmM1MGRkNzJmNSI6ImMzMWIzMjM2NGNlMTljYThmY2QxNTBhNDE3ZWNjZTU4In0sImNyZWF0ZV90aW1lIjoiMjAyNS0wMi0yNSAxMDoxNjoyNiArMDYwMCJ9.-sX0bHNjn5HRtqtvN2DN8sJ9SSeF7GEI9f6kGG91dcM',
                'platform': 'android',
                'appname': 'airtel',
                'locale': 'bn',
                'appversion': '7006004',
                'deviceid': process.env.DEVICE_ID || 'YOUR_DEVICE_ID',
                'Cookie': 'BIGipServerpool_myairtel_robi_com_bd=!EcpcJt9C2p/auuIVI/0fQakxcR7nTVVcc2hgm4FojMpUyA0KVba62Krfo/Yxnff7vv5MSKVzDGWpMGU=; TS01a382c8=010187030919898f93310adfd48bff002e8f99d5498f8bd944aaefed9b5e323127a850213011243b9ae579957a9b533772d01e1025'
            },
            proxy: proxyConfig
        });
        return response.data;
    } catch (error) {
        console.error('First API Error:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
        });
        return { error: `❌ Axios Error: ${error.message}`, details: error.response?.data };
    }
};

// Helper function to call the second API
const callSecondAPI = async (phoneNo, hashCode, redirectUri) => {
    try {
        const payload = {
            authClientId: 'super_local',
            otp: '',
            phoneNo: phoneNo,
            pin: '',
            hashCode: hashCode,
            redirectUri: redirectUri
        };
        console.log('Second API Request Payload:', payload);
        const response = await axios.post('https://directcharge.pay.bka.sh/capabilitycore/portal/verifyAccount', payload, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 9; Pixel 4 Build/PQ3A.190801.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/81.0.4044.117 Mobile Safari/537.36',
                'Accept': 'application/json, text/javascript, */*',
                'Content-Type': 'application/json'
            },
            proxy: proxyConfig
        });
        return response.data;
    } catch (error) {
        console.error('Second API Error:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
        });
        return { error: `❌ Axios Error: ${error.message}`, details: error.response?.data };
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
        const response = await callSecondAPI(trimmedPhoneNo, hashCode, redirectUri);
        responses.push(response);
        if (response.error) {
            return res.json({ error: '❌ Second API Failed!', details: response });
        }
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
    }

    res.json({ status: '✅ Success!', responses });
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
