import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function verifyUser(username, password) {
    const response = await fetch(`${process.env.ZILLIZ_ENDPOINT.replace(/\/$/, "")}/v2/vectordb/entities/query`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.ZILLIZ_TOKEN}`, 'Content-Type': 'application/json' },
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

    const { image, faction, type, auth } = req.body;

    if (!auth || !(await verifyUser(auth.user, auth.pass))) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!image || !faction || !type) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    const baseUrl = process.env.ZILLIZ_ENDPOINT.replace(/\/$/, "");
    const headers = { 'Authorization': `Bearer ${process.env.ZILLIZ_TOKEN}`, 'Content-Type': 'application/json' };

    try {
        // 1. Pull current frame structure row out from Zilliz
        const queryRes = await fetch(`${baseUrl}/v2/vectordb/entities/query`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                collectionName: 'warpforge_global_config',
                filter: "config_key == 'frame_library'",
                outputFields: ["config_value"]
            })
        });
        const queryData = await queryRes.json();
        
        if (!queryData.data || queryData.data.length === 0) {
            return res.status(500).json({ error: 'Config row missing in Zilliz' });
        }

        let library = JSON.parse(queryData.data[0].config_value);

        // Normalize type key ('warlord' targets 'troop' directory paths)
        const targetType = type === 'warlord' ? 'troop' : type;

        // 2. Compute the next incremental integer index
        const currentVariants = library[faction][targetType] || [];
        const nextInt = currentVariants.length > 0 
            ? Math.max(...currentVariants.map(v => parseInt(v) || 0)) + 1 
            : 1;
        const nextIntStr = String(nextInt);

        // 3. Upload file directly to the shared target path inside Cloudinary
        // Presets: Unique Filename must be OFF and folder use matching your UI configuration settings!
        const publicId = `${targetType}_${nextIntStr}`;
        const folderPath = `warpforge_frames/${faction}`;

        await cloudinary.uploader.upload(image, {
            public_id: publicId,
            folder: folderPath,
            overwrite: true,
            invalidate: true,
            resource_type: "auto"
        });

        // 4. Mutate layout matrix state array and save row back into Zilliz
        library[faction][targetType].push(nextIntStr);

        await fetch(`${baseUrl}/v2/vectordb/entities/insert`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                collectionName: 'warpforge_global_config',
                data: [{
                    config_key: 'frame_library',
                    config_value: JSON.stringify(library),
                    dummy_vector: [0.1, 0.2]
                }]
            })
        });

        return res.status(200).json({ success: true, newVariant: nextIntStr });
    } catch (error) {
        return res.status(500).json({ error: 'Operation failed', detail: error.message });
    }
}