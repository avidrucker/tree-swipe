// Initialize global state
let state = {
  token: null,
  messagesMetaInfo: [],
  currentIndex: -1,
  maxReviews: -1
};

// Load the state when the background script loads
chrome.storage.local.get(['state'], function(result) {
  // console.log("attempting to load state..."); // debugging
  if (result.state) {
    // console.log("State loaded:", result.state); // debugging
    state = result.state;
    // Update the UI appropriately with the loaded state
    
  } else {
    // console.log("No state found, using default state"); // debugging
    state = { currentIndex: -1, maxReviews: -1, messagesMetaInfo: [], token: null };
  }
});

// A function to save the current state
function saveState() {
  chrome.storage.local.set({ state }, function() {
    // console.log("State saved:", state); // debugging
  });
}

function decodeMime(str) {
  return str.replace(/=\?([^?]+)\?(Q|B)\?([^?]*?)\?=/gi, function (_, charset, encoding, encodedText) {
    let buffer;
    if (encoding.toUpperCase() === 'B') {
      buffer = atob(encodedText);
    } else if (encoding.toUpperCase() === 'Q') {
      // Replace underscore with spaces as per RFC 2047 Section 4.2.2 for 'Q' encoding
      encodedText = encodedText.replace(/_/g, ' ');
      // Decode quoted-printable encoding
      buffer = encodedText.replace(/=([A-Fa-f0-9]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    } else {
      return encodedText; // Unrecognized encoding
    }
    try {
      // Try decoding as UTF-8 if possible
      return decodeURIComponent(escape(buffer));
    } catch (e) {
      // Fallback for characters not correctly encoded as UTF-8
      return unescape(buffer);
    }
  });
}


function atobOrOriginal(str) {
  try {
    return atob(str);
  } catch (e) {
    return str;
  }
}

/*
 * Fetches an OAuth 2.0 token using the Chrome Identity API.
*/
function fetchAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, token => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      resolve(token);
    });
  });
}

/*
  * Fetches a list of emails from the user's Gmail inbox.
  */
function fetchEmailList(token) {
  return fetch('https://www.googleapis.com/gmail/v1/users/me/messages?q=in:inbox&maxResults=200', {
    headers: { 'Authorization': 'Bearer ' + token }
  })
    .then(response => response.json())
    .then(data => {
      if (!data.messages || data.messages.length === 0) {
        throw new Error('No messages found');
      }
      // Group messages by thread ID, selecting only the first message in each thread
      let threads = {};
      for (let message of data.messages) {
        if (!threads[message.threadId]) {
          threads[message.threadId] = message;
        }
      }
      // Convert the threads object back into an array of messages (one per thread)
      return Object.values(threads);
    });
}

/*
  * Fetches the details of a specific email message.
  */
function fetchEmailDetails(token, messageId) {
  return fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=raw`, {
    headers: { 'Authorization': 'Bearer ' + token }
  })
    .then(response => response.json())
    .then(data => {
      // Assuming data.raw contains the raw email
      var raw = atob(data.raw.replace(/-/g, '+').replace(/_/g, '/'));
      var decoded = new TextDecoder("utf-8").decode(new Uint8Array([...raw].map(char => char.charCodeAt(0))));

      // Extract and decode subject, from, and prepare body snippet
      var subjectMatch = decoded.match(/^Subject: (.*?)(?=\r\n)/m);
      var fromMatch = decoded.match(/^From:\s*((.|\n)*?)(?=\r\n)/m);

      var emailDetails = {
        subject: subjectMatch ? decodeMime(subjectMatch[1]).substring(0, 40) : 'No subject',
        from: fromMatch ? decodeMime(fromMatch[1]).trim().substring(0, 40) : 'No from',
        body: data.snippet ? data.snippet.replace(/&#39;/g, "'").replace(/&quot;/g, '"') : 'Message body parsing unsuccessful'
      };

      return emailDetails; // Pass the prepared details back for display
    });
}

function createLabel(token, labelName) {
  return fetch('https://www.googleapis.com/gmail/v1/users/me/labels', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: labelName,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show'
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.id) {
      return data.id;
    } else {
      throw new Error(`Failed to create label: ${labelName}`);
    }
  });
}

function getLabelId(token, labelName) {
  return fetch('https://www.googleapis.com/gmail/v1/users/me/labels', {
    headers: { 'Authorization': 'Bearer ' + token }
  })
    .then(response => response.json())
    .then(data => {
      const label = data.labels.find(label => label.name === labelName);
      if (label) {
        return label.id;
      } else {
        // Create the label if it's not found
        return createLabel(token, labelName);
      }
    });
}

function handleRefreshEmail(sendResponse) {
  fetchEmailList(state.token).then(messages => {
    state.messagesMetaInfo = messages;
    state.currentIndex = 0;
    return fetchEmailDetails(state.token, state.messagesMetaInfo[state.currentIndex].id);
  })
    .then(emailDetails => {
      state.currentEmailDetails = emailDetails;
      sendResponse({
        data: { emailDetails, state },
        type: "refreshEmail"
      });
    }).then(() => saveState())
    .catch(error => sendResponse({ error: error.message }));
}

function handleNextEmail(sendResponse) {
  state.currentIndex = (state.currentIndex + 1) % state.messagesMetaInfo.length;
  fetchEmailDetails(state.token, state.messagesMetaInfo[state.currentIndex].id)
    .then(emailDetails => {
      state.currentEmailDetails = emailDetails;
      sendResponse({
        data: { emailDetails, state },
        type: "nextEmail"
      });
    }).then(() => saveState())
    .catch(error => sendResponse({ error: error.message }));
}

function handleApplyReviewedLabel(sendResponse) {
  const labelName = 'Cheese';
  getLabelId(state.token, labelName).then(labelId => {
    applyLabelToMessage(state.token, state.messagesMetaInfo[state.currentIndex].id, labelId, labelName, sendResponse);
  }).catch(error => sendResponse({ error: error.message }));
  return true; // indicates async response
}

function applyLabelToMessage(token, messageId, labelId, labelName, sendResponse) {
  fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}`, {
    headers: {
      'Authorization': 'Bearer ' + token
    }
  })
  .then(response => response.json())
  .then(message => {
    if (message.labelIds.includes(labelId)) {
      sendResponse({ success: true, message: `Label '${labelName}' is already applied`, type: "applyReviewedLabel" });
    } else {
      fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          addLabelIds: [labelId]
        })
      })
      .then(() => sendResponse({ success: true, type: "applyReviewedLabel", message: `Label '${labelName}' has been successfully applied.` }))
      .catch(error => sendResponse({ error: error.message }));
    }
  })
  .catch(error => sendResponse({ error: error.message }));
}

function handleStartReviewSession(sendResponse, maxReviews) {
  state.maxReviews = maxReviews;
  handleRefreshEmail(sendResponse);
}

function handleMessageRequest(action, sendResponse, maxReviews) {
  fetchAuthToken().then(t => {
    state.token = t;
    if (action === "refreshEmail") {
      handleRefreshEmail(sendResponse);
    } else if (action === "loadFromState") {
      sendResponse({ data: { state }, type: "loadFromState" });
    } else if (action === "nextEmail") {
      handleNextEmail(sendResponse);
    } else if (action === "getState") {
      sendResponse({ state });
    } else if (action === "applyReviewedLabel") {
      handleApplyReviewedLabel(sendResponse);
    } else if (action === "startReviewSession") {
      handleStartReviewSession(sendResponse, maxReviews);
    } else if (action === "returnToSetup") {
      state = { currentIndex: -1, maxReviews: -1, messagesMetaInfo: [], token: state.token };
      saveState();
      console.log("state cleared:", state);
      sendResponse({ type: "returnToSetup" });
    }
  });
}

/*
  * Listens for messages from the popup and content script.
  */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { action, maxReviews } = request;
  if (action === "refreshEmail" || action === "nextEmail" || action === "getState" || action === "applyReviewedLabel" || action === "loadFromState" || action === "startReviewSession" || action === "returnToSetup") {
    handleMessageRequest(action, sendResponse, maxReviews);
  } else {
    sendResponse({ error: "Invalid action" });
  }
  return true; // indicates async response
});