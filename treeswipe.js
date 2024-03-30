const NODES = {
    "a": "Is it clear?",
    "b": "Put into CLARIFY box.",
    "c": "Is it an ACTIONABLE item?",
    "d": "Is it TRASH?",
    "e": "Is it DOABLE NOW?",
    "f": "Is it REFERENCE material?",
    "g": "Put into TRASH bin.",
    "h": "Is it BLOCKED by anything?",
    "i": "Is it DOABLE IN 2 MIN?",
    "j": "Put into MISC box.",
    "k": "Put into REFERENCE box.",
    "l": "Can it be SCHEDULED?",
    "m": "Put into BLOCKED box & label to add blockers to INBOX.",
    "n": "Is it DOABLE IN ONE SITTING?",
    "o": "Put into DO-IT box & label TINY.",
    "p": "Put into TICKLER folder.",
    "q": "Schedule on the CALENDAR.",
    "r": "Is it a PROJECT?",
    "s": "Put into DO-IT box.",
    "t": "SPLIT it & put split items into INBOX.",
    "u": "Put into PROJECTS folder."
};

const Q_EXPLANATIONS = {
    "a": "Is it clear exactly what the current email is about?",
    "c": "Is the current email an actionable item that requires taking action?",
    "d": "Is the current email something you can comfortably toss out?",
    "e": "Can you do the action required by the current email now?",
    "f": "Is the current email something you want to keep for future reference?",
    "h": "Are the actions needing to be taken for the current email blocked by anything?",
    "i": "Can you do the action required by the current email in 2 minutes or less?",
    "l": "Can you schedule the action/task required by the current email?",
    "n": "Can you do the action required by the current email in one session or time-boxing?",
    "r": "Is the current email itself representing a project?",
};

const EDGES = {
    "a": { "no": "b", "yes": "c" },
    "c": { "no": "d", "yes": "e" },
    "d": { "no": "f", "yes": "g" },
    "e": { "no": "h", "yes": "i" },
    "f": { "no": "j", "yes": "k" },
    "h": { "no": "l", "yes": "m" },
    "i": { "no": "n", "yes": "o" },
    "l": { "no": "p", "yes": "q" },
    "n": { "no": "r", "yes": "s" },
    "r": { "no": "t", "yes": "u" }
};

const LABELS = {
    "b": ["clarify"],
    "g": ["trash-it"],
    "j": ["misc"],
    "k": ["reference"],
    "m": ["blocked", "add-blockers-to-inbox"],
    "o": ["do-it", "tiny"],
    "p": ["tickler"],
    "q": ["calendar"],
    "s": ["do-it"],
    "t": ["split", "add-split-items-to-inbox"],
    "u": ["projects"]
};

function getAllLabels() {
    return Object.values(LABELS).reduce((acc, val) => acc.concat(val), []);
}

function getNodeText(nodeKey) {
    return NODES[nodeKey];
}

function getQexplanation(qKey) {
    return Q_EXPLANATIONS[qKey];
}

function getNodeLabels(nodeKey) {
    return LABELS[nodeKey];
}

function getNextQ(qKey, answer) {
    return EDGES[qKey][answer];
}

function isLeafNode(nodeKey) {
    return EDGES[nodeKey] === undefined || EDGES[nodeKey] === null;
}

// export all variables and functions
ts = {
    INIT_NODE:"a",
    getNodeText,
    getQexplanation,
    getNodeLabels,
    getNextQ,
    isLeafNode
};