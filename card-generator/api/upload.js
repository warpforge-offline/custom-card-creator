import { v2 as cloudinary } from 'cloudinary';

// Configure with the Env Variables you just set up in Vercel
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { image, cardName, auth } = req.body;

    if (!auth || !(await verifyUser(auth.user, auth.pass))) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!image || !cardName) {
        return res.status(400).json({ error: 'Missing image or card name' });
    }

    // Create a unique but consistent ID from the card name
    // e.g., "Twin Succubus" -> "twin_succubus"
    const publicId = cardName.toLowerCase().trim().replace(/\s+/g, '_');

    try {
        const uploadResponse = await cloudinary.uploader.upload(image, {
            public_id: publicId,
            folder: "warpforge_community",
            overwrite: true,    // This replaces the old image if names match
            invalidate: true,   // This forces the CDN to update immediately
            resource_type: "auto"
        });

        // Return the secure URL to save in Zilliz
        return res.status(200).json({ url: uploadResponse.secure_url });
    } catch (error) {
        console.error("Cloudinary Error:", error);
        return res.status(500).json({ error: 'Upload failed', detail: error.message });
    }
}

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
