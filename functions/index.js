/* eslint-disable */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

admin.initializeApp();

/**
 * HTTPS Cloud Function that receives Web Vitals,
 * then stores each payload in Firestore:
 *   web_vitals/{cid}/metrics/{autoId}
 */
exports.trackWebVitals = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    // Accept POSTs only
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    /* ── Parse body ───────────────────────────────────────────── */
    // navigator.sendBeacon() sends text/plain, so req.body is a string;
    // JSON.parse it when needed.
    const payload =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;

    /* ── Validate CID ─────────────────────────────────────────── */
    const cidRaw = payload.cid;
    const cid =
      typeof cidRaw === "string" ? cidRaw.trim().toLowerCase() : "";
    if (!cid || cid === "unknown") {
      console.warn(`🚫 Dropping metric with invalid cid: "${cidRaw}"`);
      return res.sendStatus(204); // early exit, no Firestore write
    }

    /* ── Write to Firestore ───────────────────────────────────── */
    const record = {
      ...payload,
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    try {
      await admin
        .firestore()
        .collection("web_vitals")
        .doc(cid)
        .collection("metrics")
        .add(record);

      return res.status(200).send("OK");
    } catch (err) {
      console.error("❌ Firestore write failed:", err);
      return res.status(500).send("Internal Server Error");
    }
  });
});
