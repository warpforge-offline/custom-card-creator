// api/github-issue.js
import { Octokit } from "@octokit/rest";

// Simple in-memory store for tracking IP request timestamps
// Note: This resets every time the Vercel function cold-starts.
const requestLog = new Map();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send();

    const clientIp = req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    
    // Rate limit: Max 5 requests per hour (3,600,000 ms)
    const windowMs = 3600000;
    const maxRequests = 5;

    // Get history for this IP
    const userHistory = requestLog.get(clientIp) || [];
    
    // Filter out requests older than the window
    const recentRequests = userHistory.filter(timestamp => now - timestamp < windowMs);

    if (recentRequests.length >= maxRequests) {
        return res.status(429).json({ error: "Too many requests in an hour. Please wait an hour to make a new request." });
    }

    // Add current request to history
    recentRequests.push(now);
    requestLog.set(clientIp, recentRequests);

    // --- Proceed with GitHub Issue creation ---
    const { title, body, user } = req.body;
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    try {
        const response = await octokit.issues.create({
            owner: 'YOUR_ORG_NAME',
            repo: 'YOUR_REPO_NAME',
            title: title,
            body: `${body}\n\n---\nReported by: ${user} via Card Creator`
        });

        res.status(200).json({ success: true, url: response.data.html_url });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}