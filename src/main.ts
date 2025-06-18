import {invoke} from "@tauri-apps/api/core";
import {listen} from '@tauri-apps/api/event';

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

async function getModels() {
    if (modelSelectEl) {
        // Fetch the models from the Rust backend
        const models: string[] = await invoke("get_models");

        // Clear existing options
        modelSelectEl.innerHTML = "";

        // Add new options to the select element
        models.forEach((model) => {
            const option = document.createElement("option");
            option.value = model;
            option.textContent = model;
            // @ts-ignore
            modelSelectEl.appendChild(option);
        });
    }

    // Populate the models-list ul
    const modelsListEl = document.querySelector("#models-list");
    if (modelsListEl) {
        // Fetch the models from the Rust backend
        const models: string[] = await invoke("get_models");
        modelsListEl.innerHTML = "";
        models.forEach((model) => {
            const li = document.createElement("li");
            li.style.display = "flex";
            li.style.alignItems = "center";
            li.style.justifyContent = "space-between";
            li.style.gap = "0.5em";
            li.textContent = model;
            // Trash can icon (SVG)
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

    console.log("Inside downloadModel function");

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
});
