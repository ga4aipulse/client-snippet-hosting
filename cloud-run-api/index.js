import express from 'express';
import cors from 'cors';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK
initializeApp({
  credential: applicationDefault(),
});

const db = getFirestore();
const app = express();
app.use(cors());
app.use(express.json());

// Health check route
app.get('/', (req, res) => {
  res.status(200).send('Cloud Run is working!');
});

// Receive web vitals
app.post('/', async (req, res) => {
  try {
    const metric = req.body;

    const cid = typeof metric.cid === 'string' ? metric.cid.trim().toLowerCase() : '';
    const visibility = metric.documentVisibility || 'unknown';
    const ua = metric.ua || '';

    // ✅ Drop if cid is invalid
    if (!cid || cid === 'unknown') {
      console.warn(`🚫 Dropping metric with invalid cid: "${metric.cid}"`);
      return res.sendStatus(204);
    }

    // ✅ Drop if document was not visible
    if (visibility !== 'visible') {
      console.warn(`🙈 Skipping metric from hidden/inactive tab (visibility = "${visibility}")`);
      return res.sendStatus(204);
    }

    // ✅ Drop if sessionId is missing
    if (!metric.sessionId) {
      console.warn('❌ Dropping metric with missing sessionId');
      return res.sendStatus(204);
    }

    // ✅ Drop if value is out of normal range (0–60s)
    if (typeof metric.value !== 'number' || metric.value < 0 || metric.value > 60000) {
      console.warn(`📉 Dropping metric with outlier value: ${metric.value}`);
      return res.sendStatus(204);
    }

    // ✅ Drop bots/crawlers based on UA
    if (/bot|crawl|spider|headless/i.test(ua)) {
      console.warn(`🤖 Dropping bot traffic: UA = "${ua}"`);
      return res.sendStatus(204);
    }

    // ✅ Save valid metric to Firestore
    await db
      .collection('web_vitals')
      .doc(cid)
      .collection('metrics')
      .add({
        ...metric,
        receivedAt: Date.now(),
      });

    console.log(`✅ Saved metric: ${metric.name} | CID: ${cid} | Session: ${metric.sessionId}`);
    res.status(200).send('Metric saved!');
  } catch (err) {
    console.error('🔥 Error saving metric:', err);
    res.status(500).send('Server error');
  }
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
});
