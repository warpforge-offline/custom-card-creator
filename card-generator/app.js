const canvas = document.getElementById('cardCanvas');
const ctx = canvas.getContext('2d');

// --- Configuration / "Database" ---
const frameLibrary = {
    chaos: {
        troop: ["1", "2", "3", "4"],
        stratagem: ["1", "2", "3", "4"]
    },
    dark_angels: {
        troop: ["1", "2", "3", "4"],
        stratagem: ["1", "2", "3", "4"]
    },
    demons: {
        troop: ["1", "2", "3", "4"],
        stratagem: ["1", "2", "3", "4"]
    },
    eldars: {
        troop: ["1", "2", "3", "4"],
        stratagem: ["1", "2", "3", "4"]
    },
    genestealers: {
        troop: ["1", "2", "3", "4"],
        stratagem: ["1", "2", "3", "4"]
    },
    imperial_guard: {
        troop: ["1", "2", "3", "4"],
        stratagem: ["1", "2", "3", "4"]
    },
    iron_hands: {
        troop: ["1"],
        stratagem: []
    },
    necrons: {
        troop: ["1", "2", "3", "4"],
        stratagem: ["1", "2", "3", "4"]
    },
    orks: {
        troop: ["1", "2", "3", "4"],
        stratagem: ["1", "2", "3", "4"]
    },
    sisters: {
        troop: ["1", "2", "3", "4"],
        stratagem: ["1", "2", "3", "4"]
    },
    tau: {
        troop: ["1", "2", "3", "4"],
        stratagem: ["1", "2", "3", "4"]
    },
    ultramarines: {
        troop: ["1", "2", "3", "4"],
        stratagem: ["1", "2", "3", "4"]
    },
    wolves: {
        troop: ["1", "2", "3", "4"],
        stratagem: ["1", "2", "3", "4"]
    }
};

// Adjust these percentages independently to fit your specific frame design
let cardMargins = {
    top: 0.08,    // 8% from top
    bottom: 0.15, // 15% from bottom (increased to hide those edges!)
    left: 0.08,   // 8% from left
    right: 0.08   // 8% from right
};

// --- Elements ---
const factionSelect = document.getElementById('factionSelect');
const typeSelect = document.getElementById('typeSelect');
const variantSelect = document.getElementById('variantSelect');
const galleryContainer = document.getElementById('frameGallery');

// --- State ---
let artImage = new Image();
let frameImage = new Image();

let statBgImage = new Image();
// Tell the canvas to redraw once this image successfully downloads from Github
statBgImage.onload = () => { drawCard(); };
statBgImage.src = 'assets/energy.png';

let rarityBgImage = new Image();
rarityBgImage.onload = () => { drawCard(); };

// Update your statPositions to include the 4th stat
let statPositions = {
    melee:  { baseX: 0.10, baseY: 0.89, offsetX: 0, offsetY: 0 },
    ranged: { baseX: 0.21, baseY: 0.96, offsetX: 0, offsetY: 0 },
    health: { baseX: 0.83, baseY: 0.95, offsetX: 0, offsetY: 0 },
    special:{ baseX: 0.89, baseY: 0.29, offsetX: 0, offsetY: 0 },
    rarity: { baseX: 0.50, baseY: 0.92, offsetX: 0, offsetY: 0 }
};

// --- Initialization ---
function init() {
    setupMarginSliders();
    setupStatSliders();
    applyTypeDefaults();
    updateRarityImage();
    updateFilters();
}
function updateFilters() {
    const faction = factionSelect.value;
    const type = typeSelect.value === 'warlord' ? 'troop' : typeSelect.value;
    const variants = frameLibrary[faction][type];
    
    variantSelect.innerHTML = '';
    galleryContainer.innerHTML = '';

    // dummy comment

    variants.forEach(v => {
        const vKey = v.toLowerCase().replace(/\s+/g, '_');
        const path = `assets/frames/${faction}/${type}_${vKey}.png`;

        // Update Dropdown
        const opt = document.createElement('option');
        opt.value = vKey;
        opt.textContent = v;
        variantSelect.appendChild(opt);

        // Update Gallery
        const thumb = document.createElement('img');
        thumb.src = path;
        thumb.className = 'thumbnail';
        thumb.onclick = () => {
            variantSelect.value = vKey;
            loadFrame(path);
            updateActiveThumbnail(thumb);
        };
        galleryContainer.appendChild(thumb);
    });

    if (variants.length > 0) {
        galleryContainer.firstChild.click();
    }
}

function loadFrame(src) {
    frameImage.onload = () => {
        // Dynamically resize canvas to match the PNG's natural dimensions
        canvas.width = frameImage.naturalWidth;
        canvas.height = frameImage.naturalHeight;
        
        drawCard();
    };
    frameImage.src = src;
}

function updateActiveThumbnail(selectedThumb) {
    document.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
    selectedThumb.classList.add('active');
}

// 2. Helper function to setup slider listeners
function setupMarginSliders() {
    const sides = ['top', 'bottom', 'left', 'right'];
    
    sides.forEach(side => {
        const slider = document.getElementById(`${side}Slider`);
        const display = document.getElementById(`${side}Val`);
        
        if (!slider) {
            console.error(`Slider not found: ${side}Slider`);
            return;
        }

        slider.oninput = (e) => {
            const val = parseFloat(e.target.value);
            
            // UI Sync
            display.textContent = val;
            
            // Logic Sync (Convert 10 to 0.10)
            cardMargins[side] = val / 100;
            
            console.log(`Updated ${side}:`, cardMargins[side]); // Debug check
            
            // Trigger the Redraw
            drawCard();
        };
    });
}

function drawCard() {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const marginLeft = w * cardMargins.left;
    const marginRight = w * cardMargins.right;
    const marginTop = h * cardMargins.top;
    const marginBottom = h * cardMargins.bottom;
    
    const safeWidth = w - (marginLeft + marginRight);
    const safeHeight = h - (marginTop + marginBottom);

    if (artImage.complete && artImage.src) {
        drawCenterCrop(artImage, marginLeft, marginTop, safeWidth, safeHeight);
    }

    if (frameImage.complete) {
        ctx.drawImage(frameImage, 0, 0, w, h);
    }
    
    // --- CALL YOUR TEXT RENDERING HERE ---
    renderName(w, h);
    renderRules(w, h);
    renderRarity(w, h);
    renderStats(w, h);
}

function drawCenterCrop(img, destX, destY, destW, destH) {
    const sourceAspect = img.width / img.height;
    const destAspect = destW / destH;

    let sx, sy, sWidth, sHeight;

    if (sourceAspect > destAspect) {
        sHeight = img.height;
        sWidth = img.height * destAspect;
        sx = (img.width - sWidth) / 2;
        sy = 0;
    } else {
        sWidth = img.width;
        sHeight = img.width / destAspect;
        sx = 0;
        sy = (img.height - sHeight) / 2;
    }

    // This draws the art ONLY inside the calculated safe rectangle
    ctx.drawImage(img, sx, sy, sWidth, sHeight, destX, destY, destW, destH);
}

function applyTypeDefaults() {
    const cardType = document.getElementById('typeSelect').value;
    
    // Warlords and Troops share the same combat stats
    const isTroop = cardType === 'troop' || cardType === 'warlord';
    // Troops and Stratagems have Energy. Warlords do NOT.
    const hasEnergy = cardType === 'troop' || cardType === 'stratagem';

    // 1. Force the checkboxes to the correct state
    document.getElementById('meleeToggle').checked = isTroop;
    document.getElementById('rangedToggle').checked = isTroop;
    document.getElementById('healthToggle').checked = isTroop;
    document.getElementById('energyToggle').checked = hasEnergy;

    // 2. Hide or show the control containers in the sidebar
    document.getElementById('meleeControlsContainer').style.display = isTroop ? 'block' : 'none';
    document.getElementById('rangedControlsContainer').style.display = isTroop ? 'block' : 'none';
    document.getElementById('healthControlsContainer').style.display = isTroop ? 'block' : 'none';
    document.getElementById('energyControlsContainer').style.display = hasEnergy ? 'block' : 'none';

    // 3. Redraw the canvas
    drawCard();
}

function updateRarityImage() {
    const rarity = document.getElementById('raritySelect').value;
    rarityBgImage.src = `assets/rarities/${rarity}.png`;
}

function setupStatSliders() {
    const configs = [
        { id: 'stat1', key: 'melee' },
        { id: 'stat2', key: 'ranged' },
        { id: 'stat3', key: 'health' },
        { id: 'stat4', key: 'special' },
        { id: 'rarity', key: 'rarity' }
    ];

    configs.forEach(conf => {
        ['X', 'Y'].forEach(axis => {
            const slider = document.getElementById(`${conf.id}${axis}`);
            const display = document.getElementById(`${conf.id}${axis}Val`);

            slider?.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                
                // Add a '+' sign for positive numbers so it looks like a true offset UI
                display.textContent = (val > 0 ? '+' : '') + val.toFixed(1); 
                
                // Update the Offset state (convert +/- 5 into +/- 0.05)
                statPositions[conf.key]['offset' + axis] = val / 100;
                
                drawCard();
            });
        });
    });
}

function renderStats(w, h) {
    // Grab the toggle states
    const isMeleeEnabled = document.getElementById('meleeToggle').checked;
    const isRangedEnabled = document.getElementById('rangedToggle').checked;
    const isHealthEnabled = document.getElementById('healthToggle').checked;
    const isEnergyEnabled = document.getElementById('energyToggle').checked;

    // Grab the values
    const meleeVal = document.getElementById('stat1').value;
    const rangedVal = document.getElementById('stat2').value;
    const healthVal = document.getElementById('stat3').value;
    const specialVal = document.getElementById('stat4').value; 
    
    // Calculate Final Coordinates: Base + Offset
    const meleeX = w * (statPositions.melee.baseX + statPositions.melee.offsetX);
    const meleeY = h * (statPositions.melee.baseY + statPositions.melee.offsetY);

    const rangedX = w * (statPositions.ranged.baseX + statPositions.ranged.offsetX);
    const rangedY = h * (statPositions.ranged.baseY + statPositions.ranged.offsetY);
    
    const healthX = w * (statPositions.health.baseX + statPositions.health.offsetX);
    const healthY = h * (statPositions.health.baseY + statPositions.health.offsetY);

    const specialX = w * (statPositions.special.baseX + statPositions.special.offsetX);
    const specialY = h * (statPositions.special.baseY + statPositions.special.offsetY);

    // --- DRAW THE ENERGY IMAGE FIRST (If enabled) ---
    if (isEnergyEnabled && statBgImage.complete && statBgImage.src) {
        const badgeW = statBgImage.width * 0.35; 
        const badgeH = statBgImage.height * 0.35;
        
        ctx.drawImage(
            statBgImage, 
            specialX - (badgeW / 2), 
            specialY - (badgeH / 2) - 25, 
            badgeW, 
            badgeH
        );
    }

    // --- DRAW THE TEXT ---
    ctx.textAlign = "center";
    ctx.fillStyle = "white";
    ctx.font = "70px 'Oswald'";
    ctx.shadowColor = "black";
    ctx.shadowBlur = 8;

    // Only draw the ones that are toggled ON
    if (isMeleeEnabled) ctx.fillText(meleeVal, meleeX, meleeY);
    if (isRangedEnabled) ctx.fillText(rangedVal, rangedX, rangedY);
    if (isHealthEnabled) ctx.fillText(healthVal, healthX, healthY);
    if (isEnergyEnabled) ctx.fillText(specialVal, specialX, specialY); 

    ctx.shadowBlur = 0;
}

function renderRarity(w, h) {
    if (rarityBgImage.complete && rarityBgImage.src) {
        const rarityX = w * (statPositions.rarity.baseX + statPositions.rarity.offsetX);
        const rarityY = h * (statPositions.rarity.baseY + statPositions.rarity.offsetY);
        
        const badgeW = rarityBgImage.width;
        const badgeH = rarityBgImage.height;
        
        ctx.drawImage(
            rarityBgImage, 
            rarityX - (badgeW / 2), 
            rarityY - (badgeH / 2), 
            badgeW, 
            badgeH
        );
    }
}

function renderRules(w, h) {
    const rules = document.getElementById('rulesInput').value;
    const cardType = document.getElementById('typeSelect').value; // Get the current type
    if (!rules) return;

    ctx.font = "34px 'Barlow', sans-serif"; 
    ctx.textAlign = "center";
    
    ctx.strokeStyle = "black";
    ctx.lineWidth = 4;      
    ctx.lineJoin = "round"; 

    const lines = rules.split('\n');
    const lineHeight = 42; 
    
    // Default Stratagem Y is 0.72. If Troop or Warlord, pull it up to 0.63
    let y = cardType === 'stratagem' ? h * 0.72 : h * 0.63; 

    // Draw the Rules Text
    ctx.fillStyle = "#e0e0e0"; 
    lines.forEach(line => {
        ctx.strokeText(line, w / 2, y);
        ctx.fillText(line, w / 2, y);
        y += lineHeight;
    });

    // Draw the Subtype (Trait)
    const trait = document.getElementById('traitInput').value;
    ctx.font = "34px 'Barlow', sans-serif"; 
    ctx.fillStyle = "#E88E57"; 
    
    ctx.strokeText(trait, w / 2, y + 10); 
    ctx.fillText(trait, w / 2, y + 10); 
}

function renderName(w, h) {
    const name = document.getElementById('cardNameInput').value;
    const cardType = document.getElementById('typeSelect').value; // Get the current type
    
    // Default Troop or Warlord Y is 0.58. If Stratagem, push it down to 0.63
    const nameY = cardType === 'stratagem' ? h * 0.67 : h * 0.58;
    
    ctx.font = "700 50px 'Merriweather', serif"; 
    ctx.textAlign = "center";
    ctx.fillStyle = "#E88E57"; 
    
    ctx.shadowBlur = 4;
    ctx.shadowColor = "rgba(0,0,0,0.8)"; 
    
    // Use the dynamic nameY instead of hardcoding h * 0.58
    ctx.fillText(name, w / 2, nameY);
    
    ctx.shadowBlur = 0; 
}

// --- Event Listeners ---
// Setup all the stat visibility toggles
const statToggles = [
    { id: 'energyToggle', container: 'energyControlsContainer' },
    { id: 'meleeToggle', container: 'meleeControlsContainer' },
    { id: 'rangedToggle', container: 'rangedControlsContainer' },
    { id: 'healthToggle', container: 'healthControlsContainer' }
];

statToggles.forEach(toggle => {
    document.getElementById(toggle.id)?.addEventListener('change', (e) => {
        const container = document.getElementById(toggle.container);
        // Hide or show the inputs in the sidebar
        container.style.display = e.target.checked ? 'block' : 'none';
        // Redraw to update the canvas
        drawCard(); 
    });
});

// Ensure this variable name matches what your save function uses
let currentRawArtBase64 = ""; 

document.getElementById('artInput').onchange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
        currentRawArtBase64 = event.target.result; // Update this specific variable
        artImage.onload = drawCard;
        artImage.src = currentRawArtBase64;
    };
    reader.readAsDataURL(file);
};

document.getElementById('cardNameInput').oninput = drawCard;

factionSelect.addEventListener('change', updateFilters);

// Cleaned up to only fire once!
typeSelect.addEventListener('change', () => {
    applyTypeDefaults(); 
    updateFilters();     
});

// Added back so the HTML dropdown works in sync with the thumbnails
variantSelect.addEventListener('change', () => {
    // Map warlord to troop for the file path
    const type = typeSelect.value === 'warlord' ? 'troop' : typeSelect.value;
    const path = `assets/frames/${factionSelect.value}/${type}_${variantSelect.value}.png`;
    loadFrame(path);
    
    // Sync the gallery visual to match the dropdown selection
    const allThumbs = document.querySelectorAll('.thumbnail');
    allThumbs.forEach(thumb => {
        if (thumb.src.includes(path)) {
            updateActiveThumbnail(thumb);
        }
    });
});

document.getElementById('stat4')?.addEventListener('input', drawCard);
document.getElementById('stat1').oninput = drawCard;
document.getElementById('stat2').oninput = drawCard;
document.getElementById('stat3').oninput = drawCard;
document.getElementById('rulesInput').oninput = drawCard;
document.getElementById('traitInput').addEventListener('input', drawCard);

document.getElementById('raritySelect').addEventListener('change', () => {
    updateRarityImage();
});

document.getElementById('downloadBtn').onclick = () => {
    // 1. Grab the current Card Name from the input
    const cardName = document.getElementById('cardNameInput').value;

    // 2. Clean the filename (removes characters that operating systems don't like)
    const safeName = cardName.replace(/[/\\?%*:|"<>]/g, '-');

    // 3. Fallback to 'card' if the name field is empty
    const fileName = safeName.trim() || "card";

    // 4. Trigger the download
    const link = document.createElement('a');
    link.download = `${fileName}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
};

// --- Cloud Sync Logic ---

async function syncToVault(action, payload) {
    const response = await fetch('/api/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload })
    });
    return await response.json();
}

async function saveCardToCloud() {
    const cardName = document.getElementById('cardNameInput').value;

    // Capture the current frame path from the image object
    const currentFramePath = frameImage.getAttribute('src');
    
    // 1. Upload the RAW ORIGINAL art, not the canvas
    const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: currentRawArtBase64, cardName: cardName })
    });
    const uploadData = await uploadRes.json();

    // 2. Save to Zilliz
const payload = {
    collectionName: 'warpforge_community_cards',
    data: [{
        card_title: cardName,
        art_url: uploadData.url,
        faction: factionSelect.value,
        type: typeSelect.value,
        trait: document.getElementById('traitInput').value || "",
        rules: document.getElementById('rulesInput').value || "",
        stat_melee: parseInt(document.getElementById('stat1').value) || 0,
        stat_ranged: parseInt(document.getElementById('stat2').value) || 0,
        stat_health: parseInt(document.getElementById('stat3').value) || 0,
        stat_special: parseInt(document.getElementById('stat4').value) || 0,
        ui_config: JSON.stringify({
            margins: cardMargins,
            positions: statPositions,
            rarity: document.getElementById('raritySelect').value
        }),
        dummy_vector: [0.1, 0.2]
    }]
};

    await syncToVault('save', payload);
}

async function loadCardFromCloud() {
    const cardName = document.getElementById('cardNameInput').value;

    const result = await syncToVault('load', {
        collectionName: 'warpforge_community_cards',
        filter: `card_title == '${cardName}'`,
        outputFields: ["*"]
    });

    if (result && result.data && result.data.length > 0) {
        const d = result.data[0];

        // 1. Sync Base Global State & HTML Text Inputs
        factionSelect.value = d.faction;
        typeSelect.value = d.type;
        document.getElementById('traitInput').value = d.trait;
        document.getElementById('rulesInput').value = d.rules;
        document.getElementById('stat1').value = d.stat_melee;
        document.getElementById('stat2').value = d.stat_ranged;
        document.getElementById('stat3').value = d.stat_health;
        document.getElementById('stat4').value = d.stat_special;

        // 2. Rebuild UI Layout (Dropdowns and Thumbnails) Exactly Once
        updateFilters();

        // 3. Force Variant Dropdown Selection & Sync Active Thumbnail
        if (d.frame_path) {
            const variantPart = d.frame_path.split('_').pop().replace('.png', '');
            variantSelect.value = variantPart;

            // Loop through the fresh gallery thumbnails to highlight the saved variant
            const allThumbs = document.querySelectorAll('.thumbnail');
            allThumbs.forEach(thumb => {
                if (thumb.src.includes(d.frame_path)) {
                    updateActiveThumbnail(thumb);
                }
            });
        }

        // 4. Restore Visual Metadata Configurations
        const config = JSON.parse(d.ui_config);
        cardMargins = config.margins;
        statPositions = config.positions;
        document.getElementById('raritySelect').value = config.rarity;

        // 5. Explicit Visibility Sync (Handles Warlord/Troop/Stratagem toggle structures)
        const isTroop = d.type === 'troop' || d.type === 'warlord';
        const hasEnergy = d.type === 'troop' || d.type === 'stratagem';

        document.getElementById('meleeToggle').checked = isTroop;
        document.getElementById('rangedToggle').checked = isTroop;
        document.getElementById('healthToggle').checked = isTroop;
        document.getElementById('energyToggle').checked = hasEnergy;

        document.getElementById('meleeControlsContainer').style.display = isTroop ? 'block' : 'none';
        document.getElementById('rangedControlsContainer').style.display = isTroop ? 'block' : 'none';
        document.getElementById('healthControlsContainer').style.display = isTroop ? 'block' : 'none';
        document.getElementById('energyControlsContainer').style.display = hasEnergy ? 'block' : 'none';

        // 6. Asynchronously Load Assets to Draw to Canvas 
        updateSliderDisplays();
        updateRarityImage(); // Updates rarity background source, triggers load + draw

        // Restore Raw Image Asset from Cloudinary
        if (d.art_url) {
            currentRawArtBase64 = d.art_url; 
            artImage.onload = drawCard;
            artImage.src = d.art_url; 
        } else {
            currentRawArtBase64 = "";
            artImage.src = ""; 
        }

        // Finally, load the frame asset (resizes canvas and draws final image sequence)
        if (d.frame_path) {
            loadFrame(d.frame_path); 
        } else {
            drawCard();
        }
        
        alert(`Loaded "${cardName}" successfully.`);
    } else {
        alert("Card not found in the vault.");
    }
}

// Helper to make sure the slider bars and numbers move to the saved positions
function updateSliderDisplays() {
    // 1. Update Margin Sliders
    const sides = ['top', 'bottom', 'left', 'right'];
    sides.forEach(side => {
        const slider = document.getElementById(`${side}Slider`);
        const display = document.getElementById(`${side}Val`);
        if (slider && display) {
            const val = cardMargins[side] * 100;
            slider.value = val;
            display.textContent = val.toFixed(0);
        }
    });

    // 2. Update Stat & Rarity Offset Sliders
    const configs = [
        { id: 'stat1', key: 'melee' },
        { id: 'stat2', key: 'ranged' },
        { id: 'stat3', key: 'health' },
        { id: 'stat4', key: 'special' },
        { id: 'rarity', key: 'rarity' }
    ];

    configs.forEach(conf => {
        ['X', 'Y'].forEach(axis => {
            const slider = document.getElementById(`${conf.id}${axis}`);
            const display = document.getElementById(`${conf.id}${axis}Val`);
            if (slider && display) {
                const rawVal = statPositions[conf.key]['offset' + axis] * 100;
                slider.value = rawVal;
                display.textContent = (rawVal > 0 ? '+' : '') + rawVal.toFixed(1);
            }
        });
    });
}

init();