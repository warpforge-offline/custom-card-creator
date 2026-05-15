async function verifyUser(username, password) {
    const ZILLIZ_ENDPOINT = process.env.ZILLIZ_ENDPOINT;
    const ZILLIZ_TOKEN = process.env.ZILLIZ_TOKEN;

    const response = await fetch(`${ZILLIZ_ENDPOINT.replace(/\/$/, "")}/v2/vectordb/entities/query`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${ZILLIZ_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            collectionName: 'users',
            filter: `username == '${username}' && password == '${password}'`,
            outputFields: ["username"]
        })
    });

    const result = await response.json();
    return result.data && result.data.length > 0;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { action, payload } = req.body;

    // --- Valid User GATEKEEPER ---
    if (!auth || !(await verifyUser(auth.user, auth.pass))) {
        return res.status(401).json({ error: 'Unauthorized: Invalid Vault Credentials' });
    }

    const ZILLIZ_ENDPOINT = process.env.ZILLIZ_ENDPOINT;
    const ZILLIZ_TOKEN = process.env.ZILLIZ_TOKEN;

    const baseUrl = ZILLIZ_ENDPOINT.replace(/\/$/, "");
    const zillizUrl = action === 'save' 
        ? `${baseUrl}/v2/vectordb/entities/insert` 
        : `${baseUrl}/v2/vectordb/entities/query`;

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
        return res.status(500).json({ error: 'Database Sync Failed', details: error.message });
    }
}