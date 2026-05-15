export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { image } = req.body; // This will be the Base64 string from app.js
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const uploadPreset = 'ml_default'; // Replace with your actual preset name

    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                file: image,
                upload_preset: uploadPreset,
            })
        });

        const data = await response.json();

        if (data.error) {
            return res.status(400).json({ error: data.error.message });
        }

        // We return the secure_url (https) to be saved in Zilliz
        return res.status(200).json({ url: data.secure_url });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to upload to Cloudinary' });
    }
}