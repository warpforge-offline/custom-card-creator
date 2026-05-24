// Simple in-memory store for tracking IP request timestamps
const requestLog = new Map();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send();

    const clientIp = req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    
    // Rate limit: Max 5 requests per hour (3,600,000 ms)
    const windowMs = 3600000;
    const maxRequests = 5;

    const userHistory = requestLog.get(clientIp) || [];
    const recentRequests = userHistory.filter(timestamp => now - timestamp < windowMs);

    if (recentRequests.length >= maxRequests) {
        return res.status(429).json({ error: "Too many requests. Please wait an hour." });
    }

    recentRequests.push(now);
    requestLog.set(clientIp, recentRequests);

    // --- Proceed with GitHub Issue creation ---
    const { title, body, user } = req.body;
    
    try {
        // THE FIX: Dynamically import Octokit inside the function execution
        const { Octokit } = await import("@octokit/rest");
        
        const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

        const response = await octokit.issues.create({
            owner: 'warpforge-offline',  // <-- Make sure to replace this!
            repo: 'custom-card-creator',  // <-- Make sure to replace this!
            title: title,
            body: `${body}\n\n---\nReported by: ${user} via Card Creator`
        });

        res.status(200).json({ success: true, url: response.data.html_url });
    } catch (error) {
        // Log the error to your Vercel console so you can read it if it fails
        console.error("GitHub API Error:", error); 
        res.status(500).json({ error: error.message });
    }
}