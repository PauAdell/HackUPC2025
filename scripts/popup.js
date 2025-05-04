const OAUTH_CONFIG = {
  CLIENT_ID: 'oauth-mkplace-oauthsohhwmhegtbiurpylcpropro',
  CLIENT_SECRET: 'OPIxQvc1g?x0gz*?',
  TOKEN_URL: 'https://auth.inditex.com:443/openam/oauth2/itxid/itxidmp/access_token',
  SCOPE: 'technology.catalog.read',
  USER_AGENT: 'OpenPlatform/1.0'
};

const API_CONFIG = {
  API_URL: 'https://api.inditex.com/pubvsearch/products?image=',
  USER_AGENT: 'OpenPlatform/1.0'
};

let products = [];

let imageUrl;

chrome.storage.local.get('lastImageUrl', (result) => {
  if (result.lastImageUrl) {
    imageUrl = result.lastImageUrl;
    const img = document.getElementById("preview");
    img.src = imageUrl;
  }
});


// Utility wrappers for Chrome storage
function getFromStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => {
      resolve(result);
    });
  });
}

function setInStorage(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set(data, () => {
      resolve();
    });
  });
}

function removeFromStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys, () => {
      resolve();
    });
  });
}

class AuthService {
  constructor() {
    this.token = null;
    this.tokenExpiry = null;
  }

  async getAccessToken() {
    const { accessToken, expiry } = await getFromStorage(['accessToken', 'expiry']);
    
    if (accessToken && expiry && Date.now() < expiry) {
      console.log('Token Still Valid:');
      this.token = accessToken;
      this.tokenExpiry = expiry;
      console.log(accessToken);
      return accessToken;
    }

    return this.requestNewToken();
  }

  async requestNewToken() {
    try {
      const credentials = btoa(`${OAUTH_CONFIG.CLIENT_ID}:${OAUTH_CONFIG.CLIENT_SECRET}`);
      
      const response = await fetch(OAUTH_CONFIG.TOKEN_URL, {
        method: 'POST',
        headers: {
          'User-Agent': OAUTH_CONFIG.USER_AGENT,
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          'grant_type': 'client_credentials',
          'scope': OAUTH_CONFIG.SCOPE
        })
      });

      if (!response.ok) {
        throw new Error(`Auth failed: ${response.status}`);
      }

      const tokenData = await response.json();
      await this.storeToken(tokenData);
      console.log('Token generated!!');
      return tokenData.id_token;
    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    }
  }

  async storeToken(tokenData) {
    this.token = tokenData.id_token;
    this.tokenExpiry = Date.now() + (tokenData.expires_in * 1000);

    await setInStorage({
      accessToken: this.token,
      expiry: this.tokenExpiry
    });
  }

  async clearToken() {
    this.token = null;
    this.tokenExpiry = null;
    await removeFromStorage(['accessToken', 'expiry']);
  }
}

const authService = new AuthService();


let screenshotBtn = document.querySelector("#screenshotBtn")



document.getElementById("screenshotBtn").addEventListener("click", async () => {
  console.log("screenshot button activated");

  // SCREENSHOT
  chrome.tabs.captureVisibleTab(null, { format: "png" }, async function(dataUrl) {
    if (chrome.runtime.lastError) {
      console.error("Error capturing tab:", chrome.runtime.lastError);
      return;
    }

    // VISUALIZE SCREENSHOT IMAGE DONE
    const img = document.getElementById("preview");
    img.src = dataUrl;
    
    // UPLOAD IMAGE TO IMGUR
    const base64Image = dataUrl.split(',')[1];
    const clientId = "481832f1fd833a7";
    try {
      const response = await fetch("https://api.imgur.com/3/image", {
        method: "POST",
        headers: {
          Authorization: `Client-ID ${clientId}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ image: base64Image, type: "base64" })
      });

      const result = await response.json();

      if (result.success) {
        imageUrl = result.data.link;
        console.log("Public Image URL:", imageUrl);

        chrome.storage.local.set({ lastImageUrl: imageUrl }, () => {
          console.log("Image URL saved");
        });

        // Show preview
        const img = document.getElementById("preview");
        img.src = imageUrl;
      } else {
        console.error("Imgur upload failed:", result);
      }
    } catch (err) {
      console.error("Upload error:", err);
    }

    // SEND IMAGE TO INDITEX API
    try {
      const token = await authService.getAccessToken();
      console.log("Token: ", token);
      //console.log("Imagelinkquelestoypasando: ", imageUrl);
      products = await searchProducts(imageUrl, token);

      const resultsDiv = document.getElementById('results');
      const heading = document.createElement('h5');
      heading.textContent = 'Search Results';
      heading.className = 'text-center';
      heading.style.marginTop = '10px';
      heading.style.marginBottom = '10px';
      resultsDiv.appendChild(heading);

      let images = ["camisa.jpg", "jaket.jpeg", "pants.jpg", "shoes.jpg"];
      let counter = 0;

      if (!products || products.length === 0) {
        const resultsDiv = document.getElementById('results');
        resultsDiv.innerHTML = '';
      
        const noItemsMsg = document.createElement('h5');
        noItemsMsg.textContent = 'No items found!';
        noItemsMsg.className = 'text-center text-muted';
        noItemsMsg.style.marginTop = '10px';
      
        resultsDiv.appendChild(noItemsMsg);
        return;
      }

      products.forEach(product => {

        const productDiv = document.createElement('div');
        productDiv.className = 'card mb-3';
        productDiv.style.maxWidth = '540px';
      
        const rowDiv = document.createElement('div');
        rowDiv.className = 'row g-0';
      
        const imgCol = document.createElement('div');
        imgCol.className = 'col-md-4';
      
        const img = document.createElement('img');
        if (counter < images.length) {
          img.src = images[counter];
          ++counter;
        } else {
          img.src = 'https://via.placeholder.com/150';
        }
        img.className = 'img-fluid rounded-start';
        img.alt = product.name;
        imgCol.appendChild(img);
      
        const infoCol = document.createElement('div');
        infoCol.className = 'col-md-8';
      
        const cardBody = document.createElement('div');
        cardBody.className = 'card-body';
      
        const nameHeader = document.createElement('h5');
        nameHeader.className = 'card-title';
        nameHeader.textContent = product.name;
      
        const priceDiv = document.createElement('p');
        priceDiv.className = 'card-text mb-1';
      
        const currentPrice = document.createElement('span');
        currentPrice.className = 'fw-bold text-success';
        currentPrice.textContent = `${product.price.value.current} ${product.price.currency}`;
        priceDiv.appendChild(currentPrice);
      
        if (product.price.value.original) {
          const originalPrice = document.createElement('span');
          originalPrice.className = 'text-muted text-decoration-line-through ms-2';
          originalPrice.textContent = `${product.price.value.original} ${product.price.currency}`;
          priceDiv.appendChild(originalPrice);
        }
      

        const link = document.createElement('a');
        link.href = product.link;
        link.target = '_blank';
        link.className = 'link-primary small';
        link.textContent = 'View on ZARA';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
      
        cardBody.appendChild(nameHeader);
        cardBody.appendChild(priceDiv);
        cardBody.appendChild(link);
      
        infoCol.appendChild(cardBody);
        rowDiv.appendChild(imgCol);
        rowDiv.appendChild(infoCol);
        productDiv.appendChild(rowDiv);
        resultsDiv.appendChild(productDiv);
      });
    } catch (error) {
      console.error("Error:", error);
    }
  });
});

async function searchProducts(imageURL, token) {
  const fullURL = `${API_CONFIG.API_URL}${encodeURIComponent(imageURL)}`;
  console.log(fullURL);

  const response = await fetch(fullURL, {
    method: 'GET',
    headers: {
      'User-Agent': API_CONFIG.USER_AGENT,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  try {
    return await response.json();
  } catch (error) {
    console.error("Error parsing JSON response:", error);
    throw new Error(`Failed to parse API response.`);
  }
}