let encryptLocation = null;
let decryptLocation = null;

// Get user location
function getLocation(callback, locationSpan) {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                callback(location);
                locationSpan.textContent = `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
            },
            (error) => {
                locationSpan.textContent = 'Location access denied';
                showStatus('error', 'Please enable location access to use this app', 
                    locationSpan.id.includes('encrypt') ? 'encrypt' : 'decrypt');
            }
        );
    } else {
        locationSpan.textContent = 'Geolocation not supported';
        showStatus('error', 'Your browser does not support geolocation', 
            locationSpan.id.includes('encrypt') ? 'encrypt' : 'decrypt');
    }
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}

// Switch tabs
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    if (tab === 'encrypt') {
        document.querySelector('.tab-btn:first-child').classList.add('active');
        document.getElementById('encrypt-tab').classList.add('active');
        getLocation((loc) => { encryptLocation = loc; }, document.getElementById('encrypt-location'));
    } else {
        document.querySelector('.tab-btn:last-child').classList.add('active');
        document.getElementById('decrypt-tab').classList.add('active');
        getLocation((loc) => { decryptLocation = loc; }, document.getElementById('decrypt-location'));
    }
}

// Show status message
function showStatus(type, message, tab) {
    const statusEl = document.getElementById(`${tab}-status`);
    statusEl.className = `status ${type}`;
    statusEl.textContent = message;
    statusEl.style.display = 'block';
    
    if (type === 'success') {
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 5000);
    }
}

// File input handlers
document.getElementById('encrypt-file-input').addEventListener('change', function(e) {
    const fileName = e.target.files[0]?.name || '';
    document.getElementById('encrypt-file-name').textContent = fileName ? `Selected: ${fileName}` : '';
});

document.getElementById('decrypt-file-input').addEventListener('change', function(e) {
    const fileName = e.target.files[0]?.name || '';
    document.getElementById('decrypt-file-name').textContent = fileName ? `Selected: ${fileName}` : '';
});

// Encrypt data
async function encryptData() {
    const message = document.getElementById('encrypt-message').value;
    const fileInput = document.getElementById('encrypt-file-input');
    const password = document.getElementById('encrypt-password').value;

    if (!encryptLocation) {
        showStatus('error', 'Location not available. Please allow location access.', 'encrypt');
        return;
    }

    if (!password) {
        showStatus('error', 'Please enter a password', 'encrypt');
        return;
    }

    let dataToEncrypt = message;
    let fileName = 'message';
    let fileType = 'text';

    // Handle file input
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        fileName = file.name.split('.')[0];
        fileType = file.type || 'application/octet-stream';
        
        const reader = new FileReader();
        reader.onload = async function(e) {
            dataToEncrypt = e.target.result;
            await performEncryption(dataToEncrypt, password, fileName, fileType);
        };
        reader.readAsDataURL(file);
        return;
    }

    if (!dataToEncrypt) {
        showStatus('error', 'Please enter a message or select a file', 'encrypt');
        return;
    }

    await performEncryption(dataToEncrypt, password, fileName, fileType);
}

async function performEncryption(data, password, fileName, fileType) {
    try {
        // Create encryption package
        const encryptionPackage = {
            location: encryptLocation,
            data: data,
            fileName: fileName,
            fileType: fileType,
            timestamp: new Date().toISOString()
        };

        // Encrypt using AES-128
        const encrypted = CryptoJS.AES.encrypt(
            JSON.stringify(encryptionPackage), 
            password
        ).toString();

        // Download encrypted file
        const blob = new Blob([encrypted], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.encrypted`;
        a.click();
        URL.revokeObjectURL(url);

        showStatus('success', '✓ File encrypted and downloaded successfully!', 'encrypt');
    } catch (error) {
        showStatus('error', 'Encryption failed: ' + error.message, 'encrypt');
    }
}

// Decrypt data
async function decryptData() {
    const fileInput = document.getElementById('decrypt-file-input');
    const password = document.getElementById('decrypt-password').value;

    if (!decryptLocation) {
        showStatus('error', 'Location not available. Please allow location access.', 'decrypt');
        return;
    }

    if (!password) {
        showStatus('error', 'Please enter the password', 'decrypt');
        return;
    }

    if (fileInput.files.length === 0) {
        showStatus('error', 'Please select an encrypted file', 'decrypt');
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        try {
            const encryptedData = e.target.result;
            
            // Decrypt using AES
            const decrypted = CryptoJS.AES.decrypt(encryptedData, password);
            const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);
            
            if (!decryptedStr) {
                showStatus('error', '❌ Incorrect password', 'decrypt');
                return;
            }

            const encryptionPackage = JSON.parse(decryptedStr);
            
            // Check location proximity (10 meters)
            const distance = calculateDistance(
                decryptLocation.lat,
                decryptLocation.lng,
                encryptionPackage.location.lat,
                encryptionPackage.location.lng
            );

            if (distance > 30) {
                showStatus('error', `❌ You must be within 30 meters of the encryption location. Current distance: ${distance.toFixed(2)}m`, 'decrypt');
                return;
            }

            // Location verified, show decrypted content
            if (encryptionPackage.data.startsWith('data:')) {
                // It's a file
                const a = document.createElement('a');
                a.href = encryptionPackage.data;
                a.download = encryptionPackage.fileName;
                a.click();
                showStatus('success', `✓ File decrypted successfully! Distance: ${distance.toFixed(2)}m`, 'decrypt');
            } else {
                // It's a text message
                const blob = new Blob([encryptionPackage.data], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${encryptionPackage.fileName}_decrypted.txt`;
                a.click();
                URL.revokeObjectURL(url);
                showStatus('success', `✓ Message decrypted successfully! Distance: ${distance.toFixed(2)}m`, 'decrypt');
            }
        } catch (error) {
            showStatus('error', '❌ Decryption failed: Invalid file or password', 'decrypt');
        }
    };
    
    reader.readAsText(file);
}

// Initialize with encrypt tab
getLocation((loc) => { encryptLocation = loc; }, document.getElementById('encrypt-location'));