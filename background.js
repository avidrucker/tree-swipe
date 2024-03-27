let token = null;
let messagesMetaInfo = [];
let state = { currentIndex: 0, maxReviews: 10 };

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

// Adding a new function to handle state queries
function getCurrentState() {
  return state;
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
    token = t;
    let state = getCurrentState();
    if (action === "refreshEmail") {
      fetchEmailList(token).then(messages => {
        messagesMetaInfo = messages;
        state.currentIndex = 0;
        return fetchEmailDetails(token, messagesMetaInfo[state.currentIndex].id);
      })
        .then(emailDetails => sendResponse({
          data: { emailDetails, state },
          type: "refreshEmail"
        }))
        .catch(error => sendResponse({ error: error.message }));
    } else if (action === "nextEmail") {
      state.currentIndex = (state.currentIndex + 1) % messagesMetaInfo.length;
      fetchEmailDetails(token, messagesMetaInfo[state.currentIndex].id)
        .then(emailDetails => sendResponse({
          data: { emailDetails, state },
          type: "nextEmail"
        }))
        .catch(error => sendResponse({ error: error.message }));
    } else if (action === "getState") {
      const state = getCurrentState();
      sendResponse({ state });
    } else if (action === "applyReviewedLabel") {
      const labelName = 'Cheese';
      getLabelId(token, labelName).then(labelId => {
        // Fetch the current message to check its labels
        fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${messagesMetaInfo[state.currentIndex].id}`, {
          headers: {
            'Authorization': 'Bearer ' + token
          }
        })
        .then(response => response.json())
        .then(message => {
          // Check if the label is already applied
          if (message.labelIds.includes(labelId)) {
            sendResponse({ success: true, message: `Label '${labelName}' is already applied`, type: "applyReviewedLabel" });
          } else {
            // Apply the label if it's not already applied
            fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${messagesMetaInfo[state.currentIndex].id}/modify`, {
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
  if (action === "refreshEmail" || action === "nextEmail" || action === "getState" || action === "applyReviewedLabel") {
    handleMessageRequest(action, sendResponse);
  } else {
    sendResponse({ error: "Invalid action" });
  }
  return true; // indicates async response
});