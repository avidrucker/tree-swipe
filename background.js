// Initialize global state
let state = {
  token: null,
  messagesMetaInfo: [],
  currentIndex: -1,
  maxReviews: 10
};

// Load the state when the background script loads
chrome.storage.local.get(['state'], function(result) {
  console.log("attempting to load state...");
  if (result.state) {
    console.log("State loaded:", result.state);
    state = result.state;
    // Update the UI appropriately with the loaded state
    
  } else {
    console.log("No state found, using default state");
    state = { currentIndex: -1, maxReviews: 10, messagesMetaInfo: [], token: null };
  }
});

// A function to save the current state
function saveState() {
  chrome.storage.local.set({ state }, function() {
    console.log("State saved:", state);
  });
}

function decodeMime(str) {
  return str.replace(/=\?([^?]+)\?(Q|B)\?([^?]*?)\?=/g, function (_, charset, encoding, text) {
    if (encoding === 'B') {
      text = atob(text);
    } else if (encoding === 'Q') {
      text = text.replace(/_/g, ' ').replace(/=(\w{2})/g, function (_, hex) {
        return String.fromCharCode(parseInt(hex, 16));
      });
    }
    return decodeURIComponent(escape(text));
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

/*
  * Handles the refreshEmail, nextEmail, and getState actions.
  */
function handleMessageRequest(action, sendResponse) {
  fetchAuthToken().then(t => {
    state.token = t;
    if (action === "refreshEmail") {
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
    } else if (action === "loadFromState") {
      console.log("Loading from state...")
      sendResponse({ data: { state }, type: "loadFromState" });
    } else if (action === "nextEmail") {
      state.currentIndex = (state.currentIndex + 1) % state.messagesMetaInfo.length;
      fetchEmailDetails(state.token, state.messagesMetaInfo[state.currentIndex].id)
        .then(emailDetails => {
          state.currentEmailDetails = emailDetails; // Save the current email details in the state
          sendResponse({
            data: { emailDetails, state },
            type: "nextEmail"
          });
        }).then(() => saveState())
        .catch(error => sendResponse({ error: error.message })); 
    } else if (action === "getState") {
      sendResponse({ state });
    } else if (action === "applyReviewedLabel") {
      const labelName = 'Cheese';
      getLabelId(state.token, labelName).then(labelId => {
        // Fetch the current message to check its labels
        fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${state.messagesMetaInfo[state.currentIndex].id}`, {
          headers: {
            'Authorization': 'Bearer ' + state.token
          }
        })
        .then(response => response.json())
        .then(message => {
          // Check if the label is already applied
          if (message.labelIds.includes(labelId)) {
            sendResponse({ success: true, message: `Label '${labelName}' is already applied`, type: "applyReviewedLabel" });
          } else {
            // Apply the label if it's not already applied
            fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${state.messagesMetaInfo[state.currentIndex].id}/modify`, {
              method: 'POST',
              headers: {
                'Authorization': 'Bearer ' + state.token,
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
      }).catch(error => sendResponse({ error: error.message }));
      return true; // indicates async response
    }
  });
}

/*
  * Listens for messages from the popup and content script.
  */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { action } = request;
  if (action === "refreshEmail" || action === "nextEmail" || action === "getState" || action === "applyReviewedLabel" || action === "loadFromState") {
    handleMessageRequest(action, sendResponse);
  } else {
    sendResponse({ error: "Invalid action" });
  }
  return true; // indicates async response
});