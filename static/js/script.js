document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    updateTime();
    setInterval(updateTime, 1000);


    loadRefreshTokens();
    parseIdToken();
});

function initializeEventListeners() {
    document.getElementById('queryTenantForm')?.addEventListener('submit', handleQueryTenant);
    document.getElementById('insertTokenForm')?.addEventListener('submit', handleInsertToken);
    document.getElementById('requestTokenSecretForm')?.addEventListener('submit', handleRequestTokenSecret);
    document.getElementById('requestTokenCertificateForm')?.addEventListener('submit', handleRequestTokenCertificate);
    document.getElementById('generateFromRefreshForm')?.addEventListener('submit', handleGenerateFromRefresh);
    document.getElementById('insertRefreshTokenForm')?.addEventListener('submit', handleInsertRefreshToken);
    document.getElementById('authenticateForm')?.addEventListener('submit', handleAuthenticate);
    document.getElementById('requestTokenPasswordForm')?.addEventListener('submit', handleRequestTokenPassword);
}

function showSection(sectionId) {
    console.log('Showing section:', sectionId);
    document.querySelectorAll('.action-section').forEach(section => {
        section.style.display = 'none';
    });
    const sectionToShow = document.getElementById(sectionId);
    if (sectionToShow) {
        sectionToShow.style.display = 'block';
    } else {
        console.error('Section not found:', sectionId);
    }
}

function updateTime() {
    document.getElementById('currentTime').textContent = new Date().toUTCString();
}

function copyToken(tokenId) {
    fetch(`/get_access_token/${tokenId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.access_token) {
                navigator.clipboard.writeText(data.access_token)
                    .then(() => alert('Access token copied to clipboard'))
                    .catch(err => {
                        console.error('Could not copy text: ', err);
                        alert('Failed to copy to clipboard. See console for details.');
                    });
            } else {
                alert('Failed to get access token: ' + (data.error || 'Unknown error'));
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while fetching the token');
        });
}

function handleRequestTokenPassword(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const tenant = formData.get('tenant');

    if (!tenant) {
        alert('Tenant ID or Domain is required');
        return;
    }

    // Construct the token endpoint URL
    const tokenUrl = tenant.includes('.')
        ? `https://login.microsoftonline.com/${tenant}/oauth2/token`
        : `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;

    // Prepare the request body
    const body = new URLSearchParams({
        client_id: formData.get('client_id'),
        grant_type: 'password',
        username: formData.get('username'),
        password: formData.get('password'),
        scope: formData.get('scope'),
        tenant: tenant  // Include tenant in the body
    });

    fetch('/request_token_password', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Token generated successfully!');
            document.getElementById('passwordTokenResult').innerHTML =
                `Access Token: ${data.access_token}<br>Refresh Token: ${data.refresh_token || 'Not provided'}`;
        } else {
            alert('Failed to generate token: ' + (data.error || 'Unknown error'));
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('An error occurred while requesting the token');
    });
}




function showTokenDetails(tokenId) {
    fetch(`/token_details/${tokenId}`)
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(`HTTP error! status: ${response.status}, message: ${text}`);
                });
            }
            return response.json();
        })
        .then(data => {
            if (!data.success) {
                throw new Error(data.error || 'Unknown error occurred');
            }
            // Update highlighted claims table
            const highlightedClaimsTable = document.querySelector('#highlightedClaimsTable tbody');
            highlightedClaimsTable.innerHTML = '';
            for (const [claim, value] of Object.entries(data.highlighted_claims || {})) {
                const row = highlightedClaimsTable.insertRow();
                row.insertCell(0).textContent = claim;
                row.insertCell(1).textContent = value;
            }

            // Update full decoded token
            if (data.full_decoded) {
                document.getElementById('fullDecodedToken').textContent = JSON.stringify(data.full_decoded, null, 2);
            } else {
                document.getElementById('fullDecodedToken').textContent = 'Full decoded token not available';
            }

            // Show the token details section
            document.getElementById('tokenDetails').style.display = 'block';
        })
        .catch(error => {
            console.error('Error fetching token details:', error);
            alert('An error occurred while fetching token details: ' + error.message);
        });
}

function handleQueryTenant(e) {
    e.preventDefault();
    const tenantDomain = document.getElementById('tenantDomain').value;
    fetchPostRequest('/query_tenant_details', { tenant_domain: tenantDomain })
        .then(data => {
            document.getElementById('tenantDetails').textContent = JSON.stringify(data, null, 2);
        })
        .catch(() => alert('Failed to query tenant details'));
}

function handleInsertToken(e) {
    e.preventDefault();
    const token = document.getElementById('token').value;
    fetchPostRequest('/insert_token', { token: token })
        .then(data => {
            if (data.error) {
                alert(data.error);
            } else {
                alert(data.message);
                document.getElementById('token').value = '';
                refreshTokenTable();
            }
        })
        .catch(() => alert('Failed to insert token'));
}

function handleRequestTokenSecret(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const tenant = formData.get('tenant');

    // Determine the token endpoint based on tenant
    let tokenEndpoint = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;

    // Prepare the data for the token request
    const data = {
        tenant: formData.get('tenant'),
        client_id: formData.get('client_id'),
        scope: formData.get('scope'),
        client_secret: formData.get('client_secret'),
        grant_type: 'client_credentials'
    };

    // URL encode the client secret
    data.client_secret = encodeURIComponent(data.client_secret);

    fetch('/request_token_secret', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(data)
    })
    .then(response => response.json())
    .then(data => {
        const resultDiv = document.getElementById('tokenResult');
        if (data.success) {
            resultDiv.innerHTML = `
                <p>Access Token: ${data.access_token}</p>
                <p>Token Type: ${data.token_type}</p>
                <p>Expires In: ${data.expires_in} seconds</p>
            `;
            alert('Token generated successfully!');
            refreshTokenTable();
        } else {
            resultDiv.innerHTML = `<p>Error: ${data.error}</p>`;
        }
    })
    .catch(error => {
        console.error('Error:', error);
        document.getElementById('tokenResult').innerHTML = '<p>An error occurred while requesting the token.</p>';
    });
}

function handleRequestTokenCertificate(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    fetchPostRequest('/request_token_certificate', formData)
        .then(data => {
            alert(data.message);
            if (data.success) refreshTokenTable();
        })
        .catch(() => alert('Failed to request token with certificate'));
}

function handleGenerateFromRefresh(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    fetchPostRequest('/generate_from_refresh', formData)
        .then(data => {
            if (data.error) {
                alert(data.error);
            } else {
                alert(data.message);
                if (data.refresh_token) {
                    document.getElementById('newRefreshToken').value = data.refresh_token;
                }
                window.location.href = '/';
            }
        })
        .catch(() => alert('Failed to generate token from refresh token'));
}



function handleInsertRefreshToken(e) {
    e.preventDefault();
    const refreshToken = document.getElementById('newRefreshToken').value;
    fetchPostRequest('/insert_token', { token: refreshToken })
        .then(data => {
            if (data.error) {
                alert(data.error);
            } else {
                alert(data.message);
                document.getElementById('newRefreshToken').value = '';
                refreshTokenTable();
            }
        })
        .catch(() => alert('Failed to insert refresh token'));
}

function handleAuthenticate(e) {
    e.preventDefault();
    const clientId = document.getElementById('authClientId').value;
    const tenantId = document.getElementById('authTenantId').value;
    fetch(`/request_auth?client_id=${encodeURIComponent(clientId)}&tenant_id=${encodeURIComponent(tenantId)}`)
        .then(response => response.json())
        .then(data => {
            if (data.auth_url) {
                window.open(data.auth_url, '_blank');
            } else {
                alert('Failed to generate authentication URL');
            }
        })
        .catch(() => alert('Failed to initiate authentication'));
}

function refreshTokenTable() {
    fetch('/')
        .then(response => response.text())
        .then(html => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            ['accessTokenTable', 'refreshTokenTable'].forEach(tableId => {
                const newTable = doc.querySelector(`#${tableId}`);
                if (newTable) document.querySelector(`#${tableId}`).replaceWith(newTable);
            });
        })
        .catch(error => console.error('Error refreshing token tables:', error));
}

function parseIdToken() {
    const hash = window.location.hash.substr(1);
    const result = hash.split('&').reduce((result, item) => {
        const [key, value] = item.split('=');
        result[key] = value;
        return result;
    }, {});
    if (result.id_token) {
        console.log("ID Token:", result.id_token);
        // Handle the ID token as needed
    } else {
        console.log("No ID token found in URL hash");
    }
}

function fetchPostRequest(url, data) {
    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(data)
    }).then(response => response.json());
}

function loadRefreshTokens() {
    const select = document.getElementById('refreshTokenSelect');
    fetch('/get_refresh_tokens')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                select.innerHTML = '<option value="">Select a refresh token</option>';
                data.refresh_tokens.forEach(token => {
                    const option = document.createElement('option');
                    option.value = token.token;
                    option.textContent = `Token ID: ${token.id}`;
                    select.appendChild(option);
                });
            } else {
                console.error('Failed to load refresh tokens:', data.error);
            }
        })
        .catch(error => console.error('Error loading refresh tokens:', error));
}



function deleteToken(tokenId, tokenType) {
    if (confirm('Are you sure you want to delete this token?')) {
        showLoader();
        fetch(`/delete_token/${tokenId}`, { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                hideLoader();
                if (data.success) {
                    // Remove the token row from the table
                    const row = document.querySelector(`#${tokenType}Token-${tokenId}`);
                    if (row) {
                        row.remove();
                    }
                    showNotification('Token deleted successfully', 'success');
                } else {
                    showNotification('Failed to delete token: ' + data.error, 'error');
                }
            })
            .catch(error => {
                hideLoader();
                console.error('Error:', error);
                showNotification('An error occurred while deleting the token', 'error');
            });
    }
}

function showLoader() {
    // Implement a loading indicator
    const loader = document.createElement('div');
    loader.id = 'loader';
    loader.innerHTML = 'Deleting...';
    document.body.appendChild(loader);
}

function hideLoader() {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.remove();
    }
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}