import {invoke} from "@tauri-apps/api/core";
import {listen} from '@tauri-apps/api/event';

// Utility type for model info
interface ModelInfo {
  [key: string]: string | number | null;
}

let streamChatInputEl: HTMLInputElement | null;
let streamChatMsgEl: HTMLElement | null;
let streamChatButtonEl: HTMLButtonElement | null;
let modelSelectEl: HTMLSelectElement | null;
let modelDownloadInputEl: HTMLInputElement | null;
let modelDownloadButtonEl: HTMLButtonElement | null;
let modelDeleteInputEl: HTMLInputElement | null;
let modelDeleteButtonEl: HTMLButtonElement | null;

let conversation: { role: "user" | "assistant", content: string }[] = [];

function renderConversation() {
    if (!streamChatMsgEl) return;
    streamChatMsgEl.innerHTML = "";
    conversation.forEach(msg => {
        const div = document.createElement("div");
        div.className = `chat-bubble ${msg.role}`;
        div.textContent = msg.content;
        streamChatMsgEl?.appendChild(div);
    });
    streamChatMsgEl.scrollTop = streamChatMsgEl.scrollHeight;
}

async function chat() {
    if (streamChatMsgEl && streamChatInputEl && streamChatButtonEl) {
        const userInput = streamChatInputEl.value;
        if (!userInput.trim()) return;
        streamChatButtonEl.textContent = "Thinking...";
        // Add user message to conversation
        conversation.push({ role: "user", content: userInput });
        renderConversation();
        let accumulatedResponse = "";
        let assistantIndex = conversation.length;
        // Reserve a spot for the assistant's message
        conversation.push({ role: "assistant", content: "" });
        renderConversation();
        const unlisten = await listen("chat-message", (event) => {
            // @ts-ignore
            if (event.payload && event.payload.message) {
                // @ts-ignore
                accumulatedResponse += event.payload.message;
                // Update the last assistant message in the conversation
                conversation[assistantIndex] = { role: "assistant", content: accumulatedResponse };
                renderConversation();
            }
        });
        await invoke("chat", {
            "request": {
                model: modelSelectEl?.value,
                prompt: userInput,
            }
        });
        unlisten();
        streamChatButtonEl.textContent = "Chat";
        streamChatInputEl.value = "";
    }
}

async function newConversation() {
    await invoke("new_conversation");
    conversation = [];
    renderConversation();
}

// Improved: Only fetch models once, use for both select and list
async function getModels() {
    const models: string[] = await invoke("get_models");
    if (modelSelectEl) {
        modelSelectEl.innerHTML = "";
        models.forEach((model) => {
            const option = document.createElement("option");
            option.value = model;
            option.textContent = model;
            modelSelectEl?.appendChild(option);
        });
    }
    const modelsListEl = document.querySelector("#models-list");
    if (modelsListEl) {
        modelsListEl.innerHTML = "";
        models.forEach((model) => {
            const li = document.createElement("li");
            const modelLink = document.createElement("a");
            modelLink.href = "#";
            modelLink.textContent = model;
            modelLink.addEventListener("click", (e) => {
                e.preventDefault();
                showModelInfo(model);
            });
            li.appendChild(modelLink);
            const trash = document.createElement("span");
            trash.innerHTML = `<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='3 6 5 6 21 6'></polyline><path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2'></path><line x1='10' y1='11' x2='10' y2='17'></line><line x1='14' y1='11' x2='14' y2='17'></line></svg>`;
            trash.style.cursor = "pointer";
            trash.title = "Delete model";
            trash.addEventListener("click", (e) => {
                e.stopPropagation();
                deleteModel(model);
            });
            li.appendChild(trash);
            modelsListEl.appendChild(li);
        });
    }
}

async function downloadModel() {
    if (modelDownloadInputEl && modelSelectEl && modelDownloadButtonEl) {
        modelDownloadButtonEl.textContent = "Downloading...";
        const modelName = modelDownloadInputEl.value;

        // Call the Rust function to download the model
        let res = await invoke("download_model", {modelName: modelName});
        if (res) {
            alert(res + " downloaded successfully!");
        } else {
            alert("Failed to download " + modelName);
        }

        // Clear the input field
        modelDownloadInputEl.textContent = "";
        // Reset the button text
        modelDownloadButtonEl.textContent = "Download";
        // Fetch the models from the Rust backend
        getModels();
    }
}

async function deleteModel(modelName?: string) {
    if (modelName) {
        console.log('Attempting to delete model:', modelName); // Debug
        // Called from trash icon
        // const confirmed = confirm(`Are you sure you want to delete model: ${modelName}?`);
        // if (!confirmed) return;
        let res;
        try {
            res = await invoke("delete_model", {modelName});
            console.log('delete_model result:', res); // Debug
        } catch (err) {
            console.error('Error invoking delete_model:', err);
            alert("Error deleting model: " + err);
            return;
        }
        if (res) {
            alert(res + " deleted successfully!");
        } else {
            alert("Failed to delete " + modelName);
        }
        getModels();
        return;
    }

    if (modelDeleteInputEl && modelSelectEl && modelDeleteButtonEl) {
        modelDeleteButtonEl.textContent = "Deleting...";
        const modelName = modelDeleteInputEl.value;
        let res = await invoke("delete_model", {modelName: modelName});
        if (res) {
            alert(res + " deleted successfully!");
        } else {
            alert("Failed to delete " + modelName);
        }
        modelDeleteInputEl.textContent = "";
        modelDeleteButtonEl.textContent = "Delete";
        getModels();
    }
}

// Improved: Add type and error handling
async function showModelInfo(modelName: string): Promise<void> {
    try {
        const info: ModelInfo = await invoke("show_model_info", { modelName });
        showModal(info);
    } catch (err) {
        alert("Failed to fetch model info: " + err);
    }
}

// Improved: Add type and error handling
function showModal(content: ModelInfo | string): void {
    let modal = document.getElementById("model-info-modal");
    let modalContent = document.getElementById("model-info-modal-content");
    if (modal && modalContent) {
        if (typeof content === 'object' && content !== null) {
            let html = '<table style="width:100%;border-collapse:collapse;">';
            for (const [key, value] of Object.entries(content)) {
                let displayValue = value;
                if (typeof value === 'string' && value.startsWith('String("')) {
                    displayValue = value.replace(/^String\("|"\)$/g, '');
                } else if (typeof value === 'string' && value.startsWith('Number(')) {
                    displayValue = value.replace(/^Number\(|\)$/g, '');
                } else if (value === null || value === 'Null') {
                    displayValue = '<span style="color:#888;">null</span>';
                }
                html += `<tr><td style='padding:4px 8px;border-bottom:1px solid #eee;vertical-align:top;'><strong>${key}</strong></td><td style='padding:4px 8px;border-bottom:1px solid #eee;'>${displayValue}</td></tr>`;
            }
            html += '</table>';
            modalContent.innerHTML = html;
        } else {
            modalContent.textContent = String(content);
        }
        modal.style.display = "flex";
    }
}

window.addEventListener("DOMContentLoaded", () => {
    streamChatInputEl = document.querySelector("#stream-chat-input");
    streamChatMsgEl = document.querySelector("#stream-chat-msg");
    streamChatButtonEl = document.querySelector("#chat-button");
    modelSelectEl = document.querySelector("#model-select");
    modelDownloadInputEl = document.querySelector("#model-download-input");
    modelDownloadButtonEl = document.querySelector("#model-download-button");
    modelDeleteInputEl = document.querySelector("#model-delete-input");
    modelDeleteButtonEl = document.querySelector("#model-delete-button");

    getModels();

    document.querySelector("#stream-chat-form")?.addEventListener("submit", (e) => {
        e.preventDefault();
        chat();
    });

    document.querySelector("#model-download-form")?.addEventListener("submit", (e) => {
        e.preventDefault();
        downloadModel();
    });

    document.querySelector("#model-delete-form")?.addEventListener("submit", (e) => {
        e.preventDefault();
        deleteModel();
    });

    document.querySelector("#new-conversation-btn")?.addEventListener("click", () => {
        newConversation();
    });

    // Modal close logic
    const modal = document.getElementById("model-info-modal");
    const modalClose = document.getElementById("model-info-modal-close");
    if (modal && modalClose) {
        modalClose.addEventListener("click", () => {
            modal.style.display = "none";
        });
        // Close modal when clicking outside modal-content
        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                modal.style.display = "none";
            }
        });
    }
});

