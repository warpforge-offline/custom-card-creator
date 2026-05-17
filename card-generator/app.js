const canvas = document.getElementById('cardCanvas');
const ctx = canvas.getContext('2d');

// --- Configuration ---
let frameLibrary = {};
let cardMargins = { top: 0.08, bottom: 0.15, left: 0.08, right: 0.08 };

// --- Elements ---
const factionSelect = document.getElementById('factionSelect');
const typeSelect = document.getElementById('typeSelect');
const variantSelect = document.getElementById('variantSelect');
const galleryContainer = document.getElementById('frameGallery');

// --- State ---
let artImage = new Image();
artImage.crossOrigin = "anonymous";

let frameImage = new Image();
frameImage.crossOrigin = "anonymous";

let activeFramePath = "";
let currentRawArtBase64 = ""; 

let statBgImage = new Image();
let rarityBgImage = new Image();

let statPositions = {
    melee:  { baseX: 0.10, baseY: 0.89, offsetX: 0, offsetY: 0 },
    ranged: { baseX: 0.21, baseY: 0.96, offsetX: 0, offsetY: 0 },
    health: { baseX: 0.83, baseY: 0.95, offsetX: 0, offsetY: 0 },
    special:{ baseX: 0.89, baseY: 0.29, offsetX: 0, offsetY: 0 },
    rarity: { baseX: 0.50, baseY: 0.92, offsetX: 0, offsetY: 0 }
};

// --- Secure Initialization ---
// This guarantees the HTML is 100% loaded before JS starts looking for IDs
document.addEventListener('DOMContentLoaded', () => {
    init();
});

async function init() {
    setupEventListeners(); // Bind all inputs safely first
    setupMarginSliders();
    setupStatSliders();
    setupAuthListeners();
    
    // Assign Image Sources after DOM is ready to prevent premature draw calls
    statBgImage.onload = () => { drawCard(); };
    statBgImage.src = 'assets/energy.png';
    rarityBgImage.onload = () => { drawCard(); };
    
    showLoader("Fetching frame library...");
    await fetchLibraryConfig();
    hideLoader();

    applyTypeDefaults();
    updateRarityImage();
    updateFilters();
}

// --- DOM Manipulation & Rendering ---
function updateFilters(selectedVariantKey = null) {
    const faction = factionSelect.value;
    const type = typeSelect.value === 'warlord' ? 'troop' : typeSelect.value;
    const variants = frameLibrary[faction]?.[type] || [];
    
    variantSelect.innerHTML = '';
    galleryContainer.innerHTML = '';

    variants.forEach(v => {
        const vKey = v.toLowerCase().replace(/\s+/g, '_');
        const cloudBaseUrl = `https://res.cloudinary.com/dhny3c6gr/image/upload/warpforge_frames`;
        const path = `${cloudBaseUrl}/${faction}/${type}_${vKey}.png`;

        const opt = document.createElement('option');
        opt.value = vKey;
        opt.textContent = v;
        variantSelect.appendChild(opt);

        const thumb = document.createElement('img');
        thumb.src = path;
        thumb.className = 'thumbnail';
        thumb.crossOrigin = "anonymous"; 
        thumb.onclick = () => {
            variantSelect.value = vKey;
            loadFrame(path);
            updateActiveThumbnail(thumb);
        };
        galleryContainer.appendChild(thumb);
    });

    if (variants.length > 0 && !selectedVariantKey) {
        galleryContainer.firstChild.click();
    }
}

function loadFrame(src) {
    activeFramePath = src;
    frameImage.onload = () => {
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

function setupMarginSliders() {
    const sides = ['top', 'bottom', 'left', 'right'];
    sides.forEach(side => {
        const slider = document.getElementById(`${side}Slider`);
        const display = document.getElementById(`${side}Val`);
        if (!slider) return;

        slider.oninput = (e) => {
            const val = parseFloat(e.target.value);
            display.textContent = val;
            cardMargins[side] = val / 100;
            drawCard();
        };
    });
}

function drawCard() {
    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return; // Failsafe against empty canvas sizes

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

    if (frameImage.complete && frameImage.naturalWidth !== 0) {
        ctx.drawImage(frameImage, 0, 0, w, h);
    }
    
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
    ctx.drawImage(img, sx, sy, sWidth, sHeight, destX, destY, destW, destH);
}

function applyTypeDefaults() {
    const cardType = document.getElementById('typeSelect').value;
    const isTroop = cardType === 'troop' || cardType === 'warlord';
    const hasEnergy = cardType === 'troop' || cardType === 'stratagem';

    document.getElementById('meleeToggle').checked = isTroop;
    document.getElementById('rangedToggle').checked = isTroop;
    document.getElementById('healthToggle').checked = isTroop;
    document.getElementById('energyToggle').checked = hasEnergy;

    document.getElementById('meleeControlsContainer').style.display = isTroop ? 'block' : 'none';
    document.getElementById('rangedControlsContainer').style.display = isTroop ? 'block' : 'none';
    document.getElementById('healthControlsContainer').style.display = isTroop ? 'block' : 'none';
    document.getElementById('energyControlsContainer').style.display = hasEnergy ? 'block' : 'none';

    drawCard();
}

async function fetchLibraryConfig() {
    try {
        const response = await fetch('/api/vault', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'load',
                payload: {
                    collectionName: 'warpforge_global_config',
                    filter: "config_key == 'frame_library'",
                    outputFields: ["config_value"]
                },
                auth: { user: "guest", pass: "guest" } 
            })
        });
        const resJson = await response.json();
        if (resJson && resJson.data && resJson.data.length > 0) {
            frameLibrary = JSON.parse(resJson.data[0].config_value);
        }
    } catch(e) {
        console.error("Config load failed, fallback applied", e);
    }
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
                display.textContent = (val > 0 ? '+' : '') + val.toFixed(1); 
                statPositions[conf.key]['offset' + axis] = val / 100;
                drawCard();
            });
        });
    });
}

function renderStats(w, h) {
    const isMeleeEnabled = document.getElementById('meleeToggle').checked;
    const isRangedEnabled = document.getElementById('rangedToggle').checked;
    const isHealthEnabled = document.getElementById('healthToggle').checked;
    const isEnergyEnabled = document.getElementById('energyToggle').checked;

    const meleeVal = document.getElementById('stat1').value;
    const rangedVal = document.getElementById('stat2').value;
    const healthVal = document.getElementById('stat3').value;
    const specialVal = document.getElementById('stat4').value; 
    
    const meleeX = w * (statPositions.melee.baseX + statPositions.melee.offsetX);
    const meleeY = h * (statPositions.melee.baseY + statPositions.melee.offsetY);
    const rangedX = w * (statPositions.ranged.baseX + statPositions.ranged.offsetX);
    const rangedY = h * (statPositions.ranged.baseY + statPositions.ranged.offsetY);
    const healthX = w * (statPositions.health.baseX + statPositions.health.offsetX);
    const healthY = h * (statPositions.health.baseY + statPositions.health.offsetY);
    const specialX = w * (statPositions.special.baseX + statPositions.special.offsetX);
    const specialY = h * (statPositions.special.baseY + statPositions.special.offsetY);

    if (isEnergyEnabled && statBgImage.complete && statBgImage.src) {
        const badgeW = statBgImage.width * 0.35; 
        const badgeH = statBgImage.height * 0.35;
        ctx.drawImage(statBgImage, specialX - (badgeW / 2), specialY - (badgeH / 2) - 25, badgeW, badgeH);
    }

    ctx.textAlign = "center";
    ctx.fillStyle = "white";
    ctx.font = "70px 'Oswald'";
    ctx.shadowColor = "black";
    ctx.shadowBlur = 8;

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
        ctx.drawImage(rarityBgImage, rarityX - (badgeW / 2), rarityY - (badgeH / 2), badgeW, badgeH);
    }
}

function renderRules(w, h) {
    const rules = document.getElementById('rulesInput').value;
    const cardType = document.getElementById('typeSelect').value;
    if (!rules) return;

    ctx.font = "34px 'Barlow', sans-serif"; 
    ctx.textAlign = "center";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 4;      
    ctx.lineJoin = "round"; 

    const lines = rules.split('\n');
    const lineHeight = 42; 
    let y = cardType === 'stratagem' ? h * 0.72 : h * 0.63; 

    ctx.fillStyle = "#e0e0e0"; 
    lines.forEach(line => {
        ctx.strokeText(line, w / 2, y);
        ctx.fillText(line, w / 2, y);
        y += lineHeight;
    });

    const trait = document.getElementById('traitInput').value;
    ctx.font = "34px 'Barlow', sans-serif"; 
    ctx.fillStyle = "#E88E57"; 
    ctx.strokeText(trait, w / 2, y + 10); 
    ctx.fillText(trait, w / 2, y + 10); 
}

function renderName(w, h) {
    const name = document.getElementById('cardNameInput').value;
    const cardType = document.getElementById('typeSelect').value; 
    const nameY = cardType === 'stratagem' ? h * 0.67 : h * 0.58;
    
    ctx.font = "700 50px 'Merriweather', serif"; 
    ctx.textAlign = "center";
    ctx.fillStyle = "#E88E57"; 
    ctx.shadowBlur = 4;
    ctx.shadowColor = "rgba(0,0,0,0.8)"; 
    ctx.fillText(name, w / 2, nameY);
    ctx.shadowBlur = 0; 
}

// --- Safely Encapsulated Event Listeners ---
function setupEventListeners() {
    const statToggles = [
        { id: 'energyToggle', container: 'energyControlsContainer' },
        { id: 'meleeToggle', container: 'meleeControlsContainer' },
        { id: 'rangedToggle', container: 'rangedControlsContainer' },
        { id: 'healthToggle', container: 'healthControlsContainer' }
    ];

    statToggles.forEach(toggle => {
        document.getElementById(toggle.id)?.addEventListener('change', (e) => {
            document.getElementById(toggle.container).style.display = e.target.checked ? 'block' : 'none';
            drawCard(); 
        });
    });

    document.getElementById('artInput').onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            currentRawArtBase64 = event.target.result;
            artImage.removeAttribute('crossOrigin'); 
            artImage.onload = drawCard;
            artImage.src = currentRawArtBase64;
        };
        reader.readAsDataURL(file);
    };

    const mainNameInput = document.getElementById('cardNameInput');
    const vaultNameInput = document.getElementById('vaultCardName'); 

    mainNameInput?.addEventListener('input', (e) => {
        if (vaultNameInput) vaultNameInput.value = e.target.value;
        drawCard();
    });

    if (vaultNameInput) {
        vaultNameInput.addEventListener('input', (e) => {
            if (mainNameInput) mainNameInput.value = e.target.value;
            drawCard();
        });
    }

    factionSelect?.addEventListener('change', () => updateFilters());

    typeSelect?.addEventListener('change', () => {
        applyTypeDefaults(); 
        updateFilters();    
    });

    variantSelect?.addEventListener('change', () => {
        const type = typeSelect.value === 'warlord' ? 'troop' : typeSelect.value;
        const path = `assets/frames/${factionSelect.value}/${type}_${variantSelect.value}.png`;
        loadFrame(path);
        
        document.querySelectorAll('.thumbnail').forEach(thumb => {
            if (thumb.src.includes(path)) updateActiveThumbnail(thumb);
        });
    });

    document.getElementById('stat4')?.addEventListener('input', drawCard);
    document.getElementById('stat1')?.addEventListener('input', drawCard);
    document.getElementById('stat2')?.addEventListener('input', drawCard);
    document.getElementById('stat3')?.addEventListener('input', drawCard);
    document.getElementById('rulesInput')?.addEventListener('input', drawCard);
    document.getElementById('traitInput')?.addEventListener('input', drawCard);

    document.getElementById('raritySelect')?.addEventListener('change', () => {
        updateRarityImage();
    });

    document.getElementById('downloadBtn').onclick = () => {
        const cardName = document.getElementById('cardNameInput').value;
        const safeName = cardName.replace(/[/\\?%*:|"<>]/g, '-');
        const fileName = safeName.trim() || "card";
        const link = document.createElement('a');
        link.download = `${fileName}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    };
}

function setupAuthListeners() {
    const authInputs = ['vaultUser', 'vaultPass'];
    const saveBtn = document.getElementById('saveBtn'); 
    const loadBtn = document.getElementById('loadBtn');

    authInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.oninput = () => {
                const user = document.getElementById('vaultUser').value.trim();
                const pass = document.getElementById('vaultPass').value.trim();
                const hasCreds = user !== "" && pass !== "";
                if(saveBtn) saveBtn.style.display = hasCreds ? 'block' : 'none';
                if(loadBtn) loadBtn.style.display = hasCreds ? 'block' : 'none';
            };
        }
    });
}

// --- Cloud & Network Functions ---
function getAuth() {
    return {
        user: document.getElementById('vaultUser').value,
        pass: document.getElementById('vaultPass').value
    };
}

async function syncToVault(action, payload) {
    const response = await fetch('/api/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload, auth: getAuth() })
    });
    if (response.status === 401) {
        alert("Invalid Username or Password. Access Denied.");
        throw new Error("Unauthorized");
    }
    return await response.json();
}

async function saveCardToCloud() {
    const cardName = document.getElementById('cardNameInput').value;
    if (!cardName || cardName.trim() === "") return alert("Please enter a valid card name before saving.");

    showLoader(`Saving "${cardName}"...`);
    try {
        const uploadRes = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: currentRawArtBase64, cardName: cardName, auth: getAuth() })
        });
        const uploadData = await uploadRes.json();
        if (uploadData.error) throw new Error(uploadData.error);

        const payload = {
            collectionName: 'warpforge_community_cards',
            data: [{
                card_title: cardName,
                username: getAuth().user, 
                art_url: uploadData.url,
                frame_path: activeFramePath,
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

        const result = await syncToVault('save', payload);
        hideLoader();

        if (result && result.code === 0) {
            alert(`"${cardName}" has been successfully vaulted to the cloud!`);
        } else {
            alert("Database accepted payload, but encountered an internal code mismatch.");
        }
    } catch (err) {
        hideLoader();
        console.error(err);
        alert("Save operation failed: " + err.message);
    }
}

async function uploadCustomFrame(fileInputId) {
    const file = document.getElementById(fileInputId).files[0];
    if (!file) return alert("Please select a PNG frame image file first.");

    const user = document.getElementById('factoryUser').value.trim();
    const pass = document.getElementById('factoryPass').value.trim();
    if (!user || !pass) return alert("Please fill out your credentials to authorize a frame submission.");

    const targetFaction = document.getElementById('factoryFactionSelect').value;
    const targetType = document.getElementById('factoryTypeSelect').value;

    showLoader("Uploading shared frame asset...");
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const res = await fetch('/api/upload-frame.js', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: e.target.result,
                    faction: targetFaction, 
                    type: targetType,       
                    auth: { user, pass }    
                })
            });
            const data = await res.json();
            hideLoader();

            if (data.success) {
                alert(`Success! Frame added globally as variant "${data.newVariant}". Returning to workspace.`);
                await fetchLibraryConfig();
                
                document.getElementById(fileInputId).value = "";
                document.getElementById('factoryUser').value = "";
                document.getElementById('factoryPass').value = "";
                
                updateFilters(); 
                switchTab('studio');
            } else {
                alert("Upload failed: " + data.error);
            }
        } catch (err) {
            hideLoader();
            alert("Connection error: " + err.message);
        }
    };
    reader.readAsDataURL(file);
}

async function loadCardFromCloud() {
    const cardName = document.getElementById('cardNameInput').value;
    if (!cardName || cardName.trim() === "") return alert("Please enter a card name to load.");

    showLoader(`Searching Vault for "${cardName}"...`);
    try {
        const currentUser = getAuth().user;
        const result = await syncToVault('load', {
            collectionName: 'warpforge_community_cards',
            filter: `card_title == '${cardName}' && username == '${currentUser}'`,
            outputFields: ["*"]
        });

        if (result && result.data && result.data.length > 0) {
            const d = result.data[0];

            factionSelect.value = d.faction;
            typeSelect.value = d.type;
            document.getElementById('traitInput').value = d.trait;
            document.getElementById('rulesInput').value = d.rules;
            document.getElementById('stat1').value = d.stat_melee;
            document.getElementById('stat2').value = d.stat_ranged;
            document.getElementById('stat3').value = d.stat_health;
            document.getElementById('stat4').value = d.stat_special;

            let savedVariantPart = null;
            if (d.frame_path) savedVariantPart = d.frame_path.split('_').pop().replace('.png', '');

            updateFilters(savedVariantPart);

            if (d.frame_path && savedVariantPart) {
                variantSelect.value = savedVariantPart;
                document.querySelectorAll('.thumbnail').forEach(thumb => {
                    if (thumb.getAttribute('src') === d.frame_path || thumb.src.includes(d.frame_path)) {
                        updateActiveThumbnail(thumb);
                    }
                });
            }
            
            const config = JSON.parse(d.ui_config);
            cardMargins = config.margins;
            statPositions = config.positions;
            document.getElementById('raritySelect').value = config.rarity;

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

            updateSliderDisplays();
            updateRarityImage(); 

            if (d.art_url) {
                currentRawArtBase64 = d.art_url; 
                artImage.onload = drawCard;
                artImage.src = d.art_url; 
            } else {
                currentRawArtBase64 = "";
                artImage.src = ""; 
            }

            if (d.frame_path) {
                loadFrame(d.frame_path); 
            } else {
                drawCard();
            }
            
            hideLoader();
            alert(`Loaded "${cardName}" successfully.`);
        } else {
            hideLoader();
            alert("Card not found in your private vault.");
        }
    } catch (err) {
        hideLoader(); 
        console.error(err);
        alert("Load operation failed: " + err.message);
    }
}

// --- UI Sync Utilities ---
function updateSliderDisplays() {
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

    const configs = [
        { id: 'stat1', key: 'melee' }, { id: 'stat2', key: 'ranged' },
        { id: 'stat3', key: 'health' }, { id: 'stat4', key: 'special' },
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

function showLoader(message = "Processing...") {
    const modal = document.getElementById('loadingModal');
    const text = document.getElementById('loadingText');
    if (modal && text) {
        text.textContent = message;
        modal.style.display = 'flex'; 
    }
}

function hideLoader() {
    const modal = document.getElementById('loadingModal');
    if (modal) modal.style.display = 'none';
}

function switchTab(targetTab) {
    const studioDiv = document.getElementById('tabStudio');
    const factoryDiv = document.getElementById('tabFactory');
    const studioBtn = document.getElementById('tabBtnStudio');
    const factoryBtn = document.getElementById('tabBtnFactory');

    if (targetTab === 'studio') {
        studioDiv.style.display = 'flex';
        factoryDiv.style.display = 'none';
        studioBtn.style.backgroundColor = '#E88E57';
        factoryBtn.style.backgroundColor = '#444';
    } else if (targetTab === 'factory') {
        studioDiv.style.display = 'none';
        factoryDiv.style.display = 'flex';
        studioBtn.style.backgroundColor = '#444';
        factoryBtn.style.backgroundColor = '#7289da';
    }
}