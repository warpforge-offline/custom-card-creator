// api/vault.js
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { action, payload } = req.body;
    const ZILLIZ_ENDPOINT = process.env.ZILLIZ_ENDPOINT;
    const ZILLIZ_TOKEN = process.env.ZILLIZ_TOKEN;

    const zillizUrl = action === 'save' ? `${ZILLIZ_ENDPOINT}/upsert` : `${ZILLIZ_ENDPOINT}/query`;

    try {
        const response = await fetch(zillizUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ZILLIZ_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: 'Cloud Sync Failed' });
    }
}