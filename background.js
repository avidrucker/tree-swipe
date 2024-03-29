// import everything from treeswipe.js
let treeswipe;
importScripts("treeswipe.js");

const initialState = {
  token: null,
  currentEmailDetails: null,
  messagesMetaInfo: [],
  // map of ids to label array of labels to be applied to the thread
  idsAndTheirPendinglabels: {
    // id: [label1, label2]
  },
  currentIndex: -1,
  maxReviews: -1
};

const initialReviewState = { currentQuestion: treeswipe.INITIAL_NODE, 
                             questionText: treeswipe.getNodeText(treeswipe.INITIAL_NODE),
                             isLeafNode: treeswipe.isLeafNode(treeswipe.INITIAL_NODE) };

let reviewState = initialReviewState;

function resetReviewState() {
  reviewState = {...initialReviewState};
}

// Initialize global state
let state = initialState;


// Load the state when the background script loads
chrome.storage.local.get(['state'], function(result) {
  if (result.state) {
    state = result.state;
    // Update the UI appropriately with the loaded state
    
  } else {
    state = initialState;
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


/**
 * Fetches the authentication token using the chrome.identity API.
 * @returns {Promise<string>} A promise that resolves with the authentication token.
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


/**
 * Fetches the list of emails from the Gmail API.
 * @param {string} token - The access token for authentication.
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of email messages.
 * @throws {Error} - If no messages are found.
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


/**
 * Fetches email details from the Gmail API.
 * @param {string} token - The access token for authentication.
 * @param {string} messageId - The ID of the email message.
 * @returns {Promise<Object>} - A promise that resolves to an object containing the email details.
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


/**
 * Creates a new label in Gmail using the provided token and label name.
 * @param {string} token - The access token for authentication.
 * @param {string} labelName - The name of the label to create.
 * @returns {Promise<string>} - A promise that resolves with the ID of the created label.
 * @throws {Error} - If the label creation fails.
 */
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


/**
 * Retrieves the label ID for a given label name.
 * If the label is not found, it creates the label and returns its ID.
 *
 * @param {string} token - The access token for authentication.
 * @param {string} labelName - The name of the label to retrieve or create.
 * @returns {Promise<string>} - A promise that resolves to the label ID.
 */
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


/**
 * Handles the refresh of email by fetching the email list, updating the state,
 * fetching email details, updating the state again, and sending the response.
 *
 * @param {Function} sendResponse - The function to send the response.
 */
function handleRefreshEmail(sendResponse) {
  fetchEmailList(state.token).then(messages => {
    state.messagesMetaInfo = messages;
    state.currentIndex = 0;
    return fetchEmailDetails(state.token, state.messagesMetaInfo[state.currentIndex].id);
  })
    .then(emailDetails => {
      state.currentEmailDetails = emailDetails;
      sendResponse({
        data: { state, reviewState },
        type: "refreshEmail"
      });
    }).then(() => saveState())
    .catch(error => sendResponse({ error: error.message }));
}


/**
 * Handles the retrieval of the next email and sends the response.
 *
 * @param {Function} sendResponse - The function to send the response to the caller.
 * @returns {void}
 */
function handleNextEmail(sendResponse) {
  state.currentIndex = (state.currentIndex + 1); //  % state.messagesMetaInfo.length
  fetchEmailDetails(state.token, state.messagesMetaInfo[state.currentIndex].id)
    .then(emailDetails => {
      state.currentEmailDetails = emailDetails;
      sendResponse({
        data: { state, reviewState },
        type: "nextEmail"
      });
    }).then(() => saveState())
    .catch(error => sendResponse({ error: error.message }));
}


/**
 * Applies a label to a Gmail message.
 *
 * @param {string} token - The access token for the Gmail API.
 * @param {string} messageId - The ID of the message to apply the label to.
 * @param {string} labelId - The ID of the label to apply.
 * @param {string} labelName - The name of the label to apply.
 * @param {Function} sendResponse - The callback function to send the response.
 */
function applyLabelToMessage(token, messageId, labelId, labelName, sendResponse) {
  // https://developers.google.com/gmail/api/reference/rest/v1/users.messages/get
  fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}`, {
    headers: {
      'Authorization': 'Bearer ' + token
    }
  })
  .then(response => response.json())
  .then(message => {
    if (message.labelIds.includes(labelId)) {
      sendResponse({ success: true, message: `Label '${labelName}' is already applied`, type: "applyCheese" });
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
      .then(() => sendResponse({ success: true, type: "applyCheese", message: `Label '${labelName}' has been successfully applied.` }))
      .catch(error => sendResponse({ error: error.message }));
    }
  })
  .catch(error => sendResponse({ error: error.message }));
}


/**
 * Applies pending labels to an email.
 *
 * @param {string} emailId - The ID of the email to apply labels to.
 * @param {string[]} labelsToApply - An array of label names to apply.
 * @param {Function} sendResponse - The callback function to send the response.
 */
function applyPendingLabelsToEmail(emailId, labelsToApply, sendResponse) {
  // TODO: replace individual label applying w/ batch applying of labels, see todos.org
  labelsToApply.forEach(labelName => {
    getLabelId(state.token, labelName).then(labelId => {
      applyLabelToMessage(state.token, emailId, labelId, labelName, sendResponse);
    });
  });
}


/**
 * Handles applying all pending labels to the corresponding emails.
 * 
 * @param {Function} sendResponse - The callback function to send the response.
 */
function handleApplyAllLabels(sendResponse) {
  const entries = Object.entries(state.idsAndTheirPendinglabels);
  const delay = 200; // Delay in milliseconds

  entries.forEach(([emailId, labelsToApply], index) => {
    setTimeout(() => {
      applyPendingLabelsToEmail(emailId, labelsToApply, sendResponse);
    }, index * delay);
  });
}

function handleStartReviewSession(sendResponse, maxReviews) {
  state.maxReviews = maxReviews;
  handleRefreshEmail(sendResponse);
}

/**
 * Adds labels to the pending labels for the current email.
 *
 * @param {Array<string>} labels - The labels to be added.
 */
function addLabelsToPendingForCurrentEmail(labels) {
  const currentEmailId = state.messagesMetaInfo[state.currentIndex].id;
  const currentLabels = state.idsAndTheirPendinglabels[currentEmailId] || [];
  
  state.idsAndTheirPendinglabels[currentEmailId] = [...currentLabels, ...labels];
  
  saveState();
}

function batchRemoveLabels(labelId, messageIds) {
  const url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify';
  const requestBody = {
      ids: messageIds,
      removeLabelIds: [labelId]
  };

  return new Promise((resolve, reject) => {
      fetch(url, {
          method: 'POST',
          headers: {
              'Authorization': `Bearer ${state.token}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
      })
      .then(response => {
          if (!response.ok) {
              reject(`HTTP error! status: ${response.status}`);
          }
          // note: when successful, the response body is empty
          if(response.status === 204) {
            console.log("successful return from batchRemoveLabels");  
            resolve();
          }
      })
      .catch(error => {
          reject(error);
      });
  });
}

function handleMessageRequest(action, sendResponse, maxReviews) {
  fetchAuthToken().then(t => {
    state.token = t;
    if (action === "nextQuestionNo") {
      const { currentQuestion } = reviewState;
      reviewState.currentQuestion = treeswipe.getNextQ(currentQuestion, "no");
      reviewState.questionText = treeswipe.getNodeText(reviewState.currentQuestion);
      // if the current question is a leaf node, we will signal to display two different
      // buttons, an 'Apply Label' button and a 'Redo' button which goes back to node 'a'
      // for the current email thread. we can do this with a boolean flag in the response
      reviewState.isLeafNode = treeswipe.isLeafNode(reviewState.currentQuestion);
      sendResponse({ data: { state, reviewState }, type: action });
    } else if (action === "nextQuestionYes") {
      const { currentQuestion } = reviewState;
      reviewState.currentQuestion = treeswipe.getNextQ(currentQuestion, "yes");
      reviewState.questionText = treeswipe.getNodeText(reviewState.currentQuestion);
      reviewState.isLeafNode = treeswipe.isLeafNode(reviewState.currentQuestion);
      sendResponse({ data: { state, reviewState }, type: action });
    } else if (action === "loadFromState") {
      resetReviewState();
      sendResponse({ data: { state, reviewState }, type: action });
    } else if (action === "nextEmail") {
      resetReviewState();
      addLabelsToPendingForCurrentEmail(["Reviewed"]);
      handleNextEmail(sendResponse);
    } else if (action === "getState") {
      sendResponse({ state });
    } else if (action === "applyCheese") {
      addLabelsToPendingForCurrentEmail(["Cheese"]);
      sendResponse({ type: "notification", message: "Say 'Cheese'!" });
    } else if (action === "applyCurrentNodeLabel") {
      let currentLabels = treeswipe.LABELS[reviewState.currentQuestion];
      let currentLabelsString = currentLabels.join(", ");
      addLabelsToPendingForCurrentEmail(["Reviewed", ...currentLabels]);
      sendResponse({ type: "notification", message: `Labels '${currentLabelsString}' applied successfully` });
    } else if (action === "applyLabelAndGotoNextEmail") {
      // TODO: uncomment the following 5 lines to implement applyLabelAndGotoNextEmail action
      // let currentLabels = treeswipe.LABELS[reviewState.currentQuestion];
      // let currentLabelsString = currentLabels.join(", ");
      // addLabelsToPendingForCurrentEmail(["Reviewed", ...currentLabels]);
      // sendResponse({ type: "notification", message: `Labels '${currentLabelsString}' applied successfully` });
      // handleNextEmail(sendResponse);
    } else if (action === "startReviewSession") {
      // anonymous function that passes in the response object and 
      // updates it with the startReviewSession action type
      handleStartReviewSession((response) => sendResponse({ ...response, type: action }), maxReviews);
    } else if (action === "clearReviewedLabel") {
      getLabelId(state.token, "Reviewed")
        .then(labelId => {
          let messageIds = state.messagesMetaInfo.map(message => message.id);
          batchRemoveLabels(labelId, messageIds)
            .then(() => sendResponse({ type: "notification", message: "Label 'Reviewed' cleared successfully." }))
            .catch(error => sendResponse({ error: error.message }));
        })
    }
    // quit early w/o applying any labels
    else if (action === "returnToSetup") {
      state = { ...initialState, token: state.token };
      saveState();
      console.log("return to setup, state cleared:", state);
      sendResponse({ type: action });
    } 
    // finish review session, apply labels, and quit
    else if (action === "finishReview") {
      addLabelsToPendingForCurrentEmail(["Reviewed"]);
      handleApplyAllLabels(sendResponse);
      state = { ...initialState, token: state.token, messagesMetaInfo: state.messagesMetaInfo};
      saveState();
      console.log("finishing review session");
      sendResponse({ type: action });
    }
  });
}


/*
  * Listens for messages from the popup and content script.
  */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { action, maxReviews } = request;
  if (action === "refreshEmail" || action === "nextEmail" || action === "getState" ||
   action === "applyCheese" || action === "loadFromState" || action === "startReviewSession" ||
    action === "returnToSetup" || action === "finishReview" || action === "clearReviewedLabel" || 
    action === "nextQuestionNo" || action === "nextQuestionYes" || action === "applyCurrentNodeLabel") {
    handleMessageRequest(action, sendResponse, maxReviews);
  } else {
    sendResponse({ error: "Invalid action" });
  }
  return true; // indicates async response
});