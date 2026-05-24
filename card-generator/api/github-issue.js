// Simple in-memory store for tracking IP request timestamps
const requestLog = new Map();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send();

    const { title, body, user, pass } = req.body;

    // 1. ZILLIZ AUTHENTICATION CHECK (The Gatekeeper)
    if (!user || !pass || !(await verifyUser(user, pass))) {
        return res.status(401).json({ error: 'Unauthorized. Invalid Vault credentials.' });
    }

    // 2. RATE LIMITING
    const clientIp = req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    const windowMs = 3600000; // 1 Hour
    const maxRequests = 5;

    const userHistory = requestLog.get(clientIp) || [];
    const recentRequests = userHistory.filter(timestamp => now - timestamp < windowMs);

    if (recentRequests.length >= maxRequests) {
        return res.status(429).json({ error: "Too many requests. Please wait an hour." });
    }

    recentRequests.push(now);
    requestLog.set(clientIp, recentRequests);

    // 3. GITHUB API EXECUTION
    try {
        const { Octokit } = await import("@octokit/rest");
        const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

        const response = await octokit.issues.create({
            owner: 'warpforge-offline',
            repo: 'custom-card-creator',
            title: title,
            body: `${body}\n\n---\nReported by: ${user} via Card Creator`
        });

        res.status(200).json({ success: true, url: response.data.html_url });
    } catch (error) {
        console.error("GitHub API Error:", error); 
        res.status(500).json({ error: error.message });
    }
}

// --- Zilliz Verification Function ---
async function verifyUser(username, password) {
    const ZILLIZ_ENDPOINT = process.env.ZILLIZ_ENDPOINT;
    const ZILLIZ_TOKEN = process.env.ZILLIZ_TOKEN;

    // Failsafe in case environment variables are missing on Vercel
    if (!ZILLIZ_ENDPOINT || !ZILLIZ_TOKEN) {
        console.error("Missing Zilliz environment variables!");
        return false;
    }

    try {
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
    } catch (err) {
        console.error("Zilliz Verification Error:", err);
        return false;
    }
}