require('dotenv').config();

const { MilvusClient, DataType } = require('@zilliz/milvus2-sdk-node');

const URI = process.env.ZILLIZ_ENDPOINT;
const TOKEN = process.env.ZILLIZ_TOKEN;

// Add a quick safety check so the script warns you if the .env file is missing
if (!URI || !TOKEN) {
    console.error("❌ ERROR: Missing Zilliz credentials! Check your .env file.");
    process.exit(1);
}

const client = new MilvusClient({ address: URI, token: TOKEN });

async function runMigration() {
    console.log("🚀 Starting Data Migration...");

    const oldCollection = 'warpforge_community_cards';
    const newCollection = 'warpforge_community_cards_v2';

    // 1. CREATE THE NEW SCHEMA (Make card_identifier the Primary Key as you planned!)
    console.log(`📦 Creating new collection: ${newCollection}`);
    await client.createCollection({
        collection_name: newCollection,
        fields: [
            // Your new primary key
            { name: "card_identifier", data_type: DataType.VarChar, max_length: 500, is_primary_key: true },
            
            // Your existing fields
            { name: "card_title", data_type: DataType.VarChar, max_length: 500 },
            { name: "username", data_type: DataType.VarChar, max_length: 100 },
            { name: "art_url", data_type: DataType.VarChar, max_length: 1000 },
            { name: "frame_path", data_type: DataType.VarChar, max_length: 500 },
            { name: "faction", data_type: DataType.VarChar, max_length: 100 },
            { name: "type", data_type: DataType.VarChar, max_length: 100 },
            { name: "trait", data_type: DataType.VarChar, max_length: 200 },
            { name: "rules", data_type: DataType.VarChar, max_length: 2000 },
            { name: "stat_melee", data_type: DataType.Int64 },
            { name: "stat_ranged", data_type: DataType.Int64 },
            { name: "stat_health", data_type: DataType.Int64 },
            { name: "stat_special", data_type: DataType.Int64 },
            { name: "ui_config", data_type: DataType.VarChar, max_length: 2000 },
            
            // Dummy vector (Required by Zilliz)
            { name: "dummy_vector", data_type: DataType.FloatVector, dim: 2 } 
        ]
    });

    // Create the index for the vector field (Required before inserting)
    await client.createIndex({
        collection_name: newCollection,
        field_name: "dummy_vector",
        index_type: "AUTOINDEX",
        metric_type: "L2"
    });
    await client.loadCollectionSync({ collection_name: newCollection });

    // 2. FETCH ALL EXISTING PRODUCTION DATA
    console.log(`🔍 Fetching existing data from ${oldCollection}...`);
    const queryResult = await client.query({
        collection_name: oldCollection,
        // Empty filter or a broad match to get all records
        filter: "card_title != ''", 
        output_fields: ["*"] 
    });

    const oldRecords = queryResult.data;
    console.log(`✅ Found ${oldRecords.length} cards in production.`);

    // 3. TRANSFORM THE DATA
    console.log(`⚙️ Transforming records and generating clean identifiers...`);
    const newRecords = oldRecords.map(record => {
        
        // Safety check: if card_title is somehow missing, provide a fallback
        const safeTitle = record.card_title || `untitled_${Math.floor(Math.random()*1000)}`;
        const cleanIdentifier = safeTitle.replace(/\s+/g, ' ').trim();

        return {
            card_identifier: cleanIdentifier,
            card_title: record.card_title || "",
            username: record.username || "unknown",
            art_url: record.art_url || "",
            frame_path: record.frame_path || "",
            faction: record.faction || "unknown",
            
            // THE FIX: If type is missing, default it to "troop" or "stratagem" based on the frame path!
            type: record.type || (record.frame_path && record.frame_path.includes('stratagem') ? 'stratagem' : 'troop'),
            
            trait: record.trait || "",
            rules: record.rules || "",
            stat_melee: record.stat_melee || 0,
            stat_ranged: record.stat_ranged || 0,
            stat_health: record.stat_health || 0,
            stat_special: record.stat_special || 0,
            ui_config: record.ui_config || "{}",
            dummy_vector: record.dummy_vector || [0.1, 0.2]
        };
    });

    // 4. UPLOAD TO THE NEW COLLECTION (ONE-BY-ONE DEBUGGING)
    console.log(`📤 Uploading transformed data to ${newCollection} one by one...`);
    
    let successCount = 0;
    
    for (let i = 0; i < newRecords.length; i++) {
        try {
            const record = newRecords[i];
            
            const insertRes = await client.insert({
                collection_name: newCollection,
                data: [record],        // Standard V3 SDK format
                fields_data: [record]  // Fallback for V2 SDK format
            });

            // Zilliz often returns 200 OK but puts the error inside the status object!
            if (insertRes.status && insertRes.status.error_code !== 'Success') {
                console.error(`❌ Zilliz rejected record ${i + 1}:`, insertRes.status.reason);
                console.log("Record payload:", JSON.stringify(record, null, 2));
                break; // Stop the loop immediately so we can read the error
            }

            successCount++;
            process.stdout.write(`\r✅ Inserted: ${successCount} / ${newRecords.length}`);

        } catch (err) {
            console.error(`\n💥 Hard crash on record ${i + 1}:`, err.message);
            console.log("Record payload:", JSON.stringify(newRecords[i], null, 2));
            break; // Stop the loop
        }
    }

    console.log(`\n🎉 Process finished! Inserted ${successCount} records into ${newCollection}.`);
    
    await client.flushSync({ collection_names: [newCollection] });
    console.log(`🎉 Migration Complete! Inserted ${insertRes.insert_cnt} records into ${newCollection}.`);
}

runMigration().catch(console.error);